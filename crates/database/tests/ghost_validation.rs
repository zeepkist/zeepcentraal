use anyhow::{Context, Result, ensure};
use zc_core::{ghost_validation::ValidationReport, ghosts::GhostStatistics};
use zc_database::{
    Database,
    services::{ghost_validation::AcceptedEvidence, record::RecordSubmission},
};

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
    client.batch_execute("INSERT INTO public.\"user\"(id,steam_id) VALUES(1,42); INSERT INTO public.level(id,xx_hash) VALUES(1,repeat('a',32)); INSERT INTO public.record(id,id_user,id_level,time,date_created) VALUES(1276,1,1,10,'2020-01-01'); INSERT INTO public.personal_best_global(id_record,id_user,id_level) VALUES(1276,1,1); INSERT INTO public.world_record_global(id_record,id_user,id_level) VALUES(1276,1,1); INSERT INTO public.level_points(id_level,points) VALUES(1,100); INSERT INTO public.level_item(id_level,workshop_id) VALUES(1,123);").await?;
    let database = Database::connect(&url, 2).await?;
    let eligibility = || async {
        Ok::<_,anyhow::Error>(client.query_one("SELECT jsonb_build_object('record',(SELECT to_jsonb(r) FROM public.record r WHERE id=1276),'pb',(SELECT jsonb_agg(p) FROM public.personal_best_global p),'wr',(SELECT jsonb_agg(w) FROM public.world_record_global w),'points',(SELECT jsonb_agg(s) FROM public.level_points s))::text", &[]).await?.get::<_,String>(0))
    };
    let before = eligibility().await?;
    let mut previous: Option<serde_json::Value> = None;
    for status in ["pass", "fail", "uncertain"] {
        let mut report = ValidationReport::uncertain("test_evidence");
        report.status = status.into();
        let (left, right) = tokio::join!(
            database.save_record_validation(1276, Some("initial"), &report),
            database.save_record_validation(1276, Some("initial"), &report)
        );
        left?;
        right?;
        let rows = database.record_validation_attempts(1276).await?;
        assert_eq!(rows.len(), 1);
        let current = &rows[0];
        assert_eq!(
            current["id_level"], "1",
            "assigned level required even without geometry"
        );
        if let Some(old) = &previous {
            assert_eq!(old["id"], current["id"]);
            assert_eq!(old["created_at"], current["created_at"]);
            assert_ne!(old["updated_at"], current["updated_at"]);
        }
        database
            .save_record_validation(1276, Some("ignored-digest"), &report)
            .await?;
        assert_eq!(
            database.record_validation_attempts(1276).await?,
            rows,
            "identical report must not write digest or timestamp"
        );
        report.reasons.push("changed_report".into());
        database
            .save_record_validation(1276, Some("changed-digest"), &report)
            .await?;
        let changed = database.record_validation_attempts(1276).await?.remove(0);
        assert_eq!(changed["id"], current["id"]);
        assert_eq!(changed["created_at"], current["created_at"]);
        assert_ne!(changed["updated_at"], current["updated_at"]);
        assert_eq!(changed["ghost_digest"], "changed-digest");
        report.validator_version = "test-next-version".into();
        database.save_record_validation(1276, None, &report).await?;
        let version = database.record_validation_attempts(1276).await?.remove(0);
        assert_eq!(version["id"], current["id"]);
        assert_ne!(version["updated_at"], changed["updated_at"]);
        previous = Some(version);
    }
    let mut old = ValidationReport::failed("invalid_splits");
    old.validator_version = "geometry-6".into();
    database.save_record_validation(1276, None, &old).await?;
    let filter = json!({"reasons":["invalid_splits","missing_ghost"]});
    assert_eq!(database.audit_record_ids(&filter).await?, vec![1276]);
    let corrected = ValidationReport::uncertain("legacy_telemetry_incomplete");
    database
        .save_record_validation(1276, None, &corrected)
        .await?;
    assert!(database.audit_record_ids(&filter).await?.is_empty());
    database
        .save_record_validation(
            1276,
            None,
            &ValidationReport::uncertain("ghost_storage_unavailable"),
        )
        .await?;
    assert!(database.audit_record_ids(&filter).await?.is_empty());
    database
        .save_record_validation(1276, None, &corrected)
        .await?;
    let mut candidate = corrected.clone();
    candidate.comparison = true;
    assert!(
        database
            .save_record_validation(1276, None, &candidate)
            .await
            .is_err()
    );
    assert!(
        database
            .admin_validations(0, Some(1276), Some("fail"), &json!({"history":true}))
            .await?
            .is_empty()
    );
    assert_eq!(
        database
            .admin_validations(0, Some(1276), None, &json!({"workshopId":"123"}))
            .await?
            .len(),
        1
    );
    assert!(
        database
            .admin_validations(0, Some(1276), None, &json!({"workshopId":"124"}))
            .await?
            .is_empty()
    );
    let latest = database.record_validation_attempts(1276).await?;
    let cursor = latest[0]["id"].as_str().unwrap().parse()?;
    assert!(
        database
            .admin_validations(cursor, None, None, &json!({}))
            .await?
            .is_empty()
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
    transaction.batch_execute("INSERT INTO public.\"user\"(id) VALUES(1); INSERT INTO public.level(id,xx_hash) VALUES(1,repeat('a',32)); INSERT INTO public.record(id,id_user,id_level) VALUES(1,1,1);").await?;
    transaction
        .batch_execute(include_str!(
            "../migrations/20261006180000_ghost_validation/up.sql"
        ))
        .await?;
    transaction.batch_execute("INSERT INTO zc_private.record_validation(id_record,id_user,id_level,status,report,validator_version) VALUES(1,1,1,'fail','{}','old'),(1,1,1,'pass','{}','old'),(NULL,1,NULL,'fail','{}','old');").await?;
    transaction
        .batch_execute(include_str!(
            "../migrations/20261008020000_mutable_record_validation/up.sql"
        ))
        .await?;
    assert_eq!(
        transaction
            .query_one("SELECT count(*) FROM zc_private.record_validation", &[])
            .await?
            .get::<_, i64>(0),
        0
    );
    assert!(transaction.query_one("SELECT to_regclass('zc_private.level_version_lineage') IS NULL AND to_regprocedure('zc_private.immutable_validation_evidence()') IS NULL",&[]).await?.get::<_,bool>(0));
    assert_eq!(transaction.query_one("SELECT count(*) FROM information_schema.columns WHERE table_schema='zc_private' AND table_name='record_validation' AND column_name='level_xx_hash'",&[]).await?.get::<_,i64>(0),0);
    transaction.batch_execute("INSERT INTO zc_private.record_validation(id_record,id_user,id_level,status,report,validator_version) VALUES(1,1,1,'pass','{}','new'); UPDATE zc_private.record_validation SET status='uncertain';").await?;
    for sql in [
        "INSERT INTO zc_private.record_validation(id_record,id_user,id_level,status,report,validator_version) VALUES(1,1,1,'pass','{}','new')",
        "INSERT INTO zc_private.record_validation(id_record,id_user,id_level,status,report,validator_version) VALUES(NULL,1,1,'pass','{}','new')",
        "INSERT INTO zc_private.record_validation(id_record,id_user,id_level,status,report,validator_version) VALUES(999,1,1,'pass','{}','new')",
        "INSERT INTO zc_private.record_validation(id_record,id_user,id_level,status,report,validator_version) VALUES(2,1,NULL,'pass','{}','new')",
    ] {
        transaction
            .batch_execute("SAVEPOINT constraint_test")
            .await?;
        assert!(transaction.batch_execute(sql).await.is_err());
        transaction
            .batch_execute("ROLLBACK TO SAVEPOINT constraint_test")
            .await?;
    }
    transaction
        .batch_execute(include_str!(
            "../migrations/20261008020000_mutable_record_validation/down.sql"
        ))
        .await?;
    assert!(transaction.query_one("SELECT to_regclass('zc_private.level_version_lineage') IS NOT NULL AND to_regprocedure('zc_private.immutable_validation_evidence()') IS NOT NULL",&[]).await?.get::<_,bool>(0));
    assert_eq!(
        transaction
            .query_one("SELECT count(*) FROM zc_private.record_validation", &[])
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
            .query_one("SELECT count(*) FROM zc_private.record_validation", &[])
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
            true,
        )
        .await?;
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
            checked_at: "1970-01-01T00:00:00Z",
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
            checked_at: "1970-01-01T00:00:00Z",
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
            .resolve_submission_level(&format!("alias-{suffix}-{index}"), &hash, true)
            .await?;
        client
            .execute(
                "INSERT INTO public.level_metadata(id_level,format,blocks) VALUES($1,1,$2::text::jsonb)",
                &[&level.id, &blocks.to_string()],
            )
            .await?;
        client
            .execute(
                "INSERT INTO public.level_item(id_level,workshop_id,file_uid) VALUES($1,$2,$3)",
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
