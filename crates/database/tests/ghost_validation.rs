use anyhow::{Context, Result, ensure};
use zc_core::{ghost_validation::ValidationReport, ghosts::GhostStatistics};
use zc_database::{
    Database,
    services::{ghost_validation::AcceptedEvidence, record::RecordSubmission},
};

const COUNT_RECORD_VALIDATION: &str =
    include_str!("fixtures/ghost_validation/count_record_validation.sql");
const INSERT_LEVEL_METADATA: &str =
    include_str!("fixtures/ghost_validation/insert_level_metadata.sql");

async fn fixture_url(database_name: &str) -> Result<String> {
    zc_core::environment::initialize()?;
    let value =
        zc_core::environment::var("ZC_TEST_DATABASE_URL").context("Disposable test DB required")?;
    let parsed = url::Url::parse(&value)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == format!("/{database_name}"),
        "Dedicated local test DB required"
    );
    Ok(value)
}

#[tokio::test]
#[ignore = "requires empty local ghost_validation_incremental_history_test database"]
async fn mutable_results_preserve_identity_timestamps_and_record_eligibility() -> Result<()> {
    use serde_json::json;
    let url = fixture_url("ghost_validation_incremental_history_test").await?;
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("fixture connection") });
    client
        .batch_execute(include_str!("fixtures/ghost_validation.sql"))
        .await?;
    client
        .batch_execute(include_str!(
            "../migrations/20261006180000_ghost_validation/up.sql"
        ))
        .await?;
    client
        .batch_execute(include_str!(
            "../migrations/20261008020000_mutable_record_validation/up.sql"
        ))
        .await?;
    client
        .batch_execute(include_str!(
            "../migrations/20261008040000_incremental_ghost_audits/up.sql"
        ))
        .await?;
    client
        .batch_execute(include_str!(
            "../migrations/20261018010000_validation_metadata_guards/up.sql"
        ))
        .await?;
    client
        .batch_execute(include_str!("fixtures/ghost_validation/insert_user.sql"))
        .await?;
    let database = Database::connect(&url, 2).await?;
    let eligibility = || async {
        Ok::<_, anyhow::Error>(
            client
                .query_one(
                    include_str!("fixtures/ghost_validation/select_record.sql"),
                    &[],
                )
                .await?
                .get::<_, String>(0),
        )
    };
    let before = eligibility().await?;
    let mut report = ValidationReport::uncertain("test_evidence");
    report.status = "pass".into();
    database
        .save_record_validation(1276, Some("initial"), &report)
        .await?;
    let original = database.record_validation_attempts(1276).await?;
    database
        .save_record_validation(1276, Some("ignored"), &report)
        .await?;
    assert_eq!(database.record_validation_attempts(1276).await?, original);
    report.status = "fail".into();
    database.save_record_validation(1276, None, &report).await?;
    let failed = database.record_validation_attempts(1276).await?;
    assert_eq!(failed[0]["id"], original[0]["id"]);
    for status in ["pass", "uncertain", "pending"] {
        report.status = status.into();
        report.validator_version = "new".into();
        database.save_record_validation(1276, None, &report).await?;
        assert_eq!(database.record_validation_attempts(1276).await?, failed);
    }
    assert!(
        database
            .audit_record_ids(&json!({"idRecord":1276}))
            .await?
            .is_empty()
    );
    report.comparison = true;
    assert!(
        database
            .save_record_validation(1276, None, &report)
            .await
            .is_err()
    );
    assert_eq!(eligibility().await?, before);

    Ok(())
}

#[tokio::test]
#[ignore = "requires empty local ghost_validation_mutable_migration_test database"]
async fn mutable_migration_reset_constraints_and_rollback() -> Result<()> {
    let url = fixture_url("ghost_validation_mutable_migration_test").await?;
    let (mut client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("fixture connection") });
    let transaction = client.transaction().await?;
    transaction
        .batch_execute(include_str!("fixtures/ghost_validation.sql"))
        .await?;
    transaction
        .batch_execute(include_str!("fixtures/ghost_validation/insert_user_2.sql"))
        .await?;
    transaction
        .batch_execute(include_str!(
            "../migrations/20261006180000_ghost_validation/up.sql"
        ))
        .await?;
    transaction
        .batch_execute(include_str!(
            "fixtures/ghost_validation/insert_record_validation.sql"
        ))
        .await?;
    transaction
        .batch_execute(include_str!(
            "../migrations/20261008020000_mutable_record_validation/up.sql"
        ))
        .await?;
    assert_eq!(
        transaction
            .query_one(COUNT_RECORD_VALIDATION, &[])
            .await?
            .get::<_, i64>(0),
        0
    );
    assert!(
        transaction
            .query_one(
                include_str!("fixtures/ghost_validation/to_regclass.sql"),
                &[]
            )
            .await?
            .get::<_, bool>(0)
    );
    assert_eq!(
        transaction
            .query_one(
                include_str!("fixtures/ghost_validation/count_information_schema.sql"),
                &[]
            )
            .await?
            .get::<_, i64>(0),
        0
    );
    transaction
        .batch_execute(include_str!(
            "fixtures/ghost_validation/insert_record_validation_uncertain.sql"
        ))
        .await?;
    for sql in [
        include_str!("fixtures/ghost_validation/insert_record_validation_2.sql"),
        include_str!("fixtures/ghost_validation/insert_record_validation_3.sql"),
        include_str!("fixtures/ghost_validation/insert_record_validation_4.sql"),
        include_str!("fixtures/ghost_validation/insert_record_validation_5.sql"),
    ] {
        transaction
            .batch_execute(include_str!(
                "fixtures/ghost_validation/savepoint_constraint_test.sql"
            ))
            .await?;
        assert!(transaction.batch_execute(sql).await.is_err());
        transaction
            .batch_execute(include_str!(
                "fixtures/ghost_validation/rollback_to_savepoint_constraint_test.sql"
            ))
            .await?;
    }
    transaction
        .batch_execute(include_str!(
            "../migrations/20261008020000_mutable_record_validation/down.sql"
        ))
        .await?;
    assert!(
        transaction
            .query_one(
                include_str!("fixtures/ghost_validation/to_regclass_2.sql"),
                &[]
            )
            .await?
            .get::<_, bool>(0)
    );
    assert_eq!(
        transaction
            .query_one(COUNT_RECORD_VALIDATION, &[])
            .await?
            .get::<_, i64>(0),
        1,
        "rollback cannot restore deleted evidence"
    );
    transaction
        .batch_execute(include_str!(
            "../migrations/20261008020000_mutable_record_validation/up.sql"
        ))
        .await?;
    assert_eq!(
        transaction
            .query_one(COUNT_RECORD_VALIDATION, &[])
            .await?
            .get::<_, i64>(0),
        0
    );
    transaction.rollback().await?;
    Ok(())
}

#[tokio::test]
#[ignore = "requires migrated local zsl_incremental_migration_test database"]
async fn accepted_run_retry_is_atomic_and_changed_payload_fails() -> Result<()> {
    let url = fixture_url("zsl_incremental_migration_test").await?;
    let database = Database::connect(&url, 2).await?;
    let suffix = i64::from(std::process::id());
    let user = database
        .get_or_insert_user(76_561_198_600_000_000 + suffix)
        .await?;
    let level = database
        .resolve_submission_level(
            &format!("validation-{suffix}"),
            &format!("{suffix:032X}"),
            false,
        )
        .await?
        .context("fixture level")?;
    let report = ValidationReport::uncertain("missing_snapshot");
    let statistics = GhostStatistics::default();
    let run_uuid = format!("00000000-0000-4000-8000-{suffix:012x}");
    let submission = RecordSubmission {
        id_user: user.id,
        id_level: level.id,
        time: 10.,
        game_version: "test",
        mod_version: "test",
        splits: &[],
        speeds: &[],
        statistics: &statistics,
        evidence: Some(AcceptedEvidence {
            ghost_key: "ghosts/test.bin",
            ghost_digest: "digest",
            payload_digest: "original",
            run_uuid: Some(&run_uuid),
            report: &report,
            checked_at: zc_database::services::ghost_validation::ValidationCheckTimestamp {
                id_level: None,
                checked_at: "1970-01-01T00:00:00Z".into(),
                checked_metadata_at: "1970-01-01T00:00:00Z".into(),
            },
        }),
    };
    let first = database.submit_record(submission.clone()).await?;
    let second = database.submit_record(submission.clone()).await?;
    assert_eq!(first.id_record, second.id_record);
    assert!(!second.personal_best_changed);
    assert_eq!(
        database
            .accepted_run_digest(user.id, &run_uuid)
            .await?
            .as_deref(),
        Some("original")
    );
    let mut changed = submission;
    changed.evidence.as_mut().unwrap().payload_digest = "changed";
    assert!(database.submit_record(changed).await.is_err());
    let attempts = database
        .admin_validations(0, Some(first.id_record), None, &serde_json::json!({}))
        .await?;
    assert_eq!(attempts.len(), 1);
    assert_eq!(attempts[0]["status"], "uncertain");
    let concurrent_uuid = format!("00000000-0000-4001-8000-{suffix:012x}");
    let mut concurrent =
        second_submission(&statistics, &report, user.id, level.id, &concurrent_uuid);
    concurrent.time = 9.;
    let (left, right) = tokio::join!(
        database.submit_record(concurrent.clone()),
        database.submit_record(concurrent)
    );
    let (left, right) = (left?, right?);
    assert_eq!(left.id_record, right.id_record);
    assert_ne!(left.personal_best_changed, right.personal_best_changed);
    assert_eq!(
        database
            .admin_validations(0, Some(left.id_record), None, &serde_json::json!({}))
            .await?
            .len(),
        1
    );
    assert!(
        database
            .audit_record(first.id_record)
            .await?
            .unwrap()
            .ghost_url
            .is_some()
    );
    Ok(())
}

fn second_submission<'a>(
    statistics: &'a GhostStatistics,
    report: &'a ValidationReport,
    user: i32,
    level: i32,
    run: &'a str,
) -> RecordSubmission<'a> {
    RecordSubmission {
        id_user: user,
        id_level: level,
        time: 9.,
        game_version: "test",
        mod_version: "test",
        splits: &[],
        speeds: &[],
        statistics,
        evidence: Some(AcceptedEvidence {
            ghost_key: "ghosts/concurrent.bin",
            ghost_digest: "digest",
            payload_digest: "concurrent",
            run_uuid: Some(run),
            report,
            checked_at: zc_database::services::ghost_validation::ValidationCheckTimestamp {
                id_level: None,
                checked_at: "1970-01-01T00:00:00Z".into(),
                checked_metadata_at: "1970-01-01T00:00:00Z".into(),
            },
        }),
    }
}

#[tokio::test]
#[ignore = "requires migrated local workshop_incremental_validation_test fixture DB"]
async fn version_candidates_share_workshop_without_trusting_builder_uid() -> Result<()> {
    let url = fixture_url("workshop_incremental_validation_test").await?;
    let database = Database::connect(&url, 2).await?;
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("fixture connection") });
    let suffix = i64::from(std::process::id());
    let mut levels = Vec::new();
    for index in 0..2 {
        let blocks = serde_json::json!([{"i":1,"p":{"x":suffix+index}}]);
        let hash = zc_core::levels::calculate_json_level_xxhash(
            &serde_json::json!({"blox":blocks}).to_string(),
        )?;
        let level = database
            .resolve_submission_level(&format!("alias-{suffix}-{index}"), &hash, false)
            .await?
            .context("fixture level")?;
        client
            .execute(INSERT_LEVEL_METADATA, &[&level.id, &blocks.to_string()])
            .await?;
        client
            .execute(
                include_str!("fixtures/ghost_validation/insert_level_item.sql"),
                &[
                    &level.id,
                    &(900_000_000 + suffix),
                    &format!("untrusted-{suffix}-{index}"),
                ],
            )
            .await?;
        levels.push(level.id);
    }
    let candidates = database.validation_candidates(levels[0]).await?;
    for id in levels {
        assert!(
            candidates
                .iter()
                .any(|candidate| candidate.id_level == id && candidate.verified())
        );
    }
    Ok(())
}

#[tokio::test]
#[ignore = "requires empty local submission_classification_test database"]
async fn submission_classification_uses_catalog_and_verified_legacy_metadata() -> Result<()> {
    let url = fixture_url("submission_classification_test").await?;
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("fixture connection") });
    client
        .batch_execute(include_str!("fixtures/ghost_validation.sql"))
        .await?;
    client
        .batch_execute(include_str!(
            "fixtures/ghost_validation/create_fixture_schema.sql"
        ))
        .await?;
    let database = Database::connect(&url, 2).await?;
    let hash = "A".repeat(32);
    assert!(
        database
            .resolve_submission_level("unknown", &hash, true)
            .await?
            .is_none()
    );
    assert_eq!(
        client
            .query_one(
                include_str!("fixtures/ghost_validation/count_level.sql"),
                &[]
            )
            .await?
            .get::<_, i64>(0),
        0
    );
    let workshop = database
        .resolve_submission_level("workshop", &hash, false)
        .await?
        .context("workshop level")?;
    assert!(
        database
            .resolve_submission_level("workshop", &hash, true)
            .await?
            .is_none()
    );
    assert!(
        !client
            .query_one(
                include_str!("fixtures/ghost_validation/select_adventure_level.sql"),
                &[&workshop.id]
            )
            .await?
            .get::<_, bool>(0)
    );
    client
        .execute(
            include_str!("fixtures/ghost_validation/set_adventure_level.sql"),
            &[&workshop.id],
        )
        .await?;
    assert!(
        database
            .resolve_submission_level("workshop", &hash, true)
            .await?
            .context("adventure")?
            .adventure
    );
    assert!(
        database
            .resolve_submission_level("workshop", &hash, false)
            .await?
            .context("adventure alias")?
            .adventure
    );
    let blocks = serde_json::json!([{"i":22}]);
    let canonical = zc_core::levels::calculate_json_level_xxhash(
        &serde_json::json!({"blox":blocks}).to_string(),
    )?;
    let legacy: i32 = client
        .query_one(
            include_str!("fixtures/ghost_validation/insert_level.sql"),
            &[],
        )
        .await?
        .get(0);
    client
        .execute(INSERT_LEVEL_METADATA, &[&legacy, &blocks.to_string()])
        .await?;
    assert!(
        database
            .resolve_submission_level("legacy-adventure", &"B".repeat(32), true)
            .await?
            .is_none()
    );
    let adopted = database
        .resolve_submission_level("legacy-adventure", &canonical, true)
        .await?
        .context("verified adventure")?;
    assert_eq!(adopted.id, legacy);
    assert!(adopted.adventure);
    Ok(())
}
