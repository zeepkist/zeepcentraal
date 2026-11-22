use anyhow::{Result, ensure};
use serde_json::json;
use zc_core::ghost_validation::ValidationReport;
use zc_database::Database;

const COUNT_JOB_BY_TASK_RECONCILE_RECORD_ELIGIBILITY: &str = include_str!(
    "fixtures/validation_metadata_policy/count_job_by_task_reconcile_record_eligibility.sql"
);

const UP: &str = include_str!("../migrations/20261018010000_validation_metadata_guards/up.sql");
const DOWN: &str = include_str!("../migrations/20261018010000_validation_metadata_guards/down.sql");

#[tokio::test]
#[ignore = "requires isolated local validation_metadata_policy_test with scoring schema and pgmq"]
async fn metadata_gates_uncertainty_and_failures_remain_terminal() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1")
            && parsed.path() == "/validation_metadata_policy_test",
        "Dedicated local fixture required"
    );
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("fixture connection") });
    if client
        .query_one(
            include_str!("fixtures/validation_metadata_policy/exists.sql"),
            &[],
        )
        .await?
        .get::<_, bool>(0)
    {
        client.batch_execute(DOWN).await?;
    }
    client
        .batch_execute(include_str!(
            "fixtures/validation_metadata_policy/truncate_user.sql"
        ))
        .await?;
    // Migration must preserve queued/running repair state and pgmq messages.
    client
        .batch_execute(include_str!(
            "fixtures/validation_metadata_policy/select_claim.sql"
        ))
        .await?;
    let queue_snapshot = || async {
        Ok::<_, anyhow::Error>(
            client
                .query_one(
                    include_str!("fixtures/validation_metadata_policy/select_job.sql"),
                    &[],
                )
                .await?
                .get::<_, String>(0),
        )
    };
    let before = queue_snapshot().await?;
    client.batch_execute(UP).await?;
    assert_eq!(queue_snapshot().await?, before);
    let database = Database::connect(&url, 4).await?;
    let initial = database.validation_check_timestamp(1).await?;
    assert!(database.audit_record_for_validation(1).await?.is_none());
    assert!(
        database.audit_record(1).await?.is_some(),
        "retained evidence remains readable"
    );
    assert!(database.audit_record_for_validation(1101).await?.is_none());
    let window = database.audit_record_window(&json!({}), 1105).await?;
    assert_eq!(
        window.len(),
        5,
        "failed prefix must not consume audit limit"
    );
    assert!(
        !window[0].needs_check,
        "old validator cannot bypass uncertainty"
    );
    assert!(window[1..].iter().all(|record| record.needs_check));
    assert!(
        database
            .audit_level_window(&json!({"recordIds":[1,1101]}), 1105)
            .await?
            .iter()
            .all(|record| !record.needs_check)
    );
    client
        .batch_execute(include_str!(
            "fixtures/validation_metadata_policy/truncate_job.sql"
        ))
        .await?;
    assert_eq!(database.validation_check_timestamp(1).await?, initial);
    assert_eq!(
        database
            .validation_check_timestamp(2)
            .await?
            .checked_metadata_at,
        initial.checked_metadata_at
    );
    assert_eq!(
        client
            .query_one(
                include_str!("fixtures/validation_metadata_policy/count_job.sql"),
                &[]
            )
            .await?
            .get::<_, i64>(0),
        0
    );
    assert!(
        client
            .query_one(
                include_str!("fixtures/validation_metadata_policy/count_job_by_task_update_level_record_counts.sql"),
                &[]
            )
            .await?
            .get::<_, bool>(0)
    );

    client
        .batch_execute(include_str!(
            "fixtures/validation_metadata_policy/set_id_level_record.sql"
        ))
        .await?;
    database
        .save_checked_record_validations(
            &[1105],
            None,
            &ValidationReport::failed("stale_assignment"),
            &initial,
        )
        .await?;
    assert!(
        database.record_validation_attempts(1105).await?.is_empty(),
        "captured level assignment fences stale evidence even when both metadata markers equal epoch"
    );
    let mut pass = ValidationReport::uncertain("test");
    pass.status = "pass".into();
    database
        .save_checked_record_validations(&[1101], None, &pass, &initial)
        .await?;
    assert_eq!(
        database.record_validation_attempts(1101).await?[0]["status"],
        "uncertain"
    );
    client
        .batch_execute(include_str!(
            "fixtures/validation_metadata_policy/insert_level_metadata.sql"
        ))
        .await?;
    let observed = database.validation_check_timestamp(1).await?;
    assert_ne!(observed, initial);
    assert!(database.audit_record_for_validation(1101).await?.is_some());
    client
        .batch_execute(include_str!(
            "fixtures/validation_metadata_policy/set_date_updated_level_metadata.sql"
        ))
        .await?;
    assert_eq!(database.validation_check_timestamp(1).await?, observed);
    client
        .batch_execute(include_str!(
            "fixtures/validation_metadata_policy/set_publicly_visible_level_metadata.sql"
        ))
        .await?;
    database
        .save_checked_record_validations(&[1101], None, &pass, &observed)
        .await?;
    assert_eq!(
        database.record_validation_attempts(1101).await?[0]["status"],
        "uncertain",
        "stale evidence discarded"
    );
    let latest = database.validation_check_timestamp(1).await?;
    database
        .save_checked_record_validations(&[1101], None, &pass, &latest)
        .await?;
    assert_eq!(
        database.record_validation_attempts(1101).await?[0]["status"],
        "pass"
    );
    assert_eq!(
        client
            .query_one(COUNT_JOB_BY_TASK_RECONCILE_RECORD_ELIGIBILITY, &[])
            .await?
            .get::<_, i64>(0),
        0
    );
    let failed_before = database.record_validation_attempts(1).await?;
    for status in ["pending", "pass", "uncertain", "fail"] {
        let mut report = pass.clone();
        report.status = status.into();
        database
            .save_checked_record_validations(&[1], None, &report, &latest)
            .await?;
    }
    client
        .batch_execute(include_str!(
            "fixtures/validation_metadata_policy/set_status_record_validation.sql"
        ))
        .await?;
    assert_eq!(database.record_validation_attempts(1).await?, failed_before);
    database
        .save_checked_record_validations(
            &[1101],
            None,
            &ValidationReport::failed("missing_checkpoint"),
            &latest,
        )
        .await?;
    assert_eq!(
        database.record_validation_attempts(1101).await?[0]["status"],
        "fail"
    );
    assert_eq!(
        client
            .query_one(COUNT_JOB_BY_TASK_RECONCILE_RECORD_ELIGIBILITY, &[])
            .await?
            .get::<_, i64>(0),
        1
    );
    client
        .batch_execute(include_str!(
            "fixtures/validation_metadata_policy/delete_level_metadata.sql"
        ))
        .await?;
    assert!(database.audit_record_for_validation(1101).await?.is_none());
    let stamp = database.validation_check_timestamp(2).await?;
    let report = ValidationReport::failed("concurrent_failure");
    let (left, right) = tokio::join!(
        database.save_checked_record_validations(&[1105], None, &report, &stamp),
        database.save_checked_record_validations(&[1105], None, &report, &stamp)
    );
    left?;
    right?;
    assert_eq!(
        database.record_validation_attempts(1105).await?[0]["status"],
        "fail"
    );
    // Reversing schema preserves queue rows; reapplying establishes conservative baseline.
    let before = queue_snapshot().await?;
    client.batch_execute(DOWN).await?;
    assert_eq!(queue_snapshot().await?, before);
    client.batch_execute(UP).await?;
    assert_eq!(queue_snapshot().await?, before);
    Ok(())
}
