use anyhow::{Result, ensure};

#[tokio::test]
#[ignore = "requires fresh isolated timing_failure_recovery_test database"]
async fn guarded_recovery_retains_evidence_and_restores_eligibility() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/timing_failure_recovery_test",
        "Dedicated isolated database required"
    );
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("fixture connection") });
    client
        .batch_execute(include_str!("fixtures/ghost_validation.sql"))
        .await?;
    for migration in [
        include_str!("../migrations/20261006180000_ghost_validation/up.sql"),
        include_str!("../migrations/20261008020000_mutable_record_validation/up.sql"),
        include_str!("../migrations/20261008040000_incremental_ghost_audits/up.sql"),
        include_str!("../migrations/20261018010000_validation_metadata_guards/up.sql"),
    ] {
        client.batch_execute(migration).await?;
    }
    client
        .batch_execute(include_str!("fixtures/timing_failure_recovery_setup.sql"))
        .await?;
    let scheduling = include_str!("../migrations/20261012010000_record_eligibility/up.sql");
    let start = scheduling
        .find("CREATE FUNCTION zc_private.schedule_record_eligibility(")
        .unwrap();
    let end = start + scheduling[start..].find("END $$;").unwrap() + "END $$;".len();
    client.batch_execute(&scheduling[start..end]).await?;
    let eligibility =
        include_str!("../migrations/20261013020000_persist_record_eligibility/up.sql");
    let start = eligibility
        .find("CREATE OR REPLACE FUNCTION zc_private.tg_record_validation_eligibility()")
        .unwrap();
    let end = start + eligibility[start..].find("END $$;").unwrap() + "END $$;".len();
    client.batch_execute(&eligibility[start..end]).await?;
    client
        .batch_execute(include_str!(
            "../migrations/20261106010000_timing_failure_recovery/up.sql"
        ))
        .await?;
    let (seed, assertions) = include_str!("fixtures/timing_failure_recovery_assertions.sql")
        .split_once("DO $$")
        .unwrap();
    client.batch_execute(seed).await?;
    let db = zc_database::Database::connect(&url, 2).await?;
    let recovery = serde_json::json!({"recoverTimingFailures":true});
    let candidates = db.audit_record_window(&recovery, 3).await?;
    assert_eq!(
        candidates.iter().map(|r| r.id).collect::<Vec<_>>(),
        vec![1, 3]
    );
    assert!(candidates.iter().all(|r| r.needs_check));
    assert_eq!(db.audit_level_window(&recovery, 3).await?.len(), 2);
    assert!(
        db.audit_record_window(&serde_json::json!({}), 3)
            .await?
            .is_empty()
    );
    assert!(db.timing_failure_evidence(1).await?.is_some());
    assert!(db.timing_failure_evidence(2).await?.is_none());
    client.batch_execute(&format!("DO $${assertions}")).await?;
    assert!(
        db.audit_record_window(&serde_json::json!({"recoverTimingFailures":true}), 3)
            .await?
            .is_empty()
    );
    assert!(
        db.audit_level_window(&serde_json::json!({"recoverTimingFailures":true}), 3)
            .await?
            .is_empty()
    );
    let previous = client
        .query_one(
            "SELECT (report->'timingRecovery')::text FROM zc_private.record_validation WHERE id_record=1",
            &[],
        )
        .await?
        .get::<_, String>(0);
    client
        .batch_execute("INSERT INTO public.level_metadata(id_level,blocks) VALUES(1,'[]')")
        .await?;
    let checked = db.validation_check_timestamp(1).await?;
    db.save_checked_record_validations(
        &[1],
        Some("fixture-digest"),
        &zc_core::ghost_validation::ValidationReport {
            status: "pass".into(),
            reasons: vec![],
            ..zc_core::ghost_validation::ValidationReport::uncertain("unused")
        },
        &checked,
    )
    .await?;
    let updated=client.query_one("SELECT status,(report->'timingRecovery')::text FROM zc_private.record_validation WHERE id_record=1",&[]).await?;
    assert_eq!(updated.get::<_, String>(0), "pass");
    assert_eq!(updated.get::<_, String>(1), previous);
    client
        .batch_execute(include_str!(
            "../migrations/20261106010000_timing_failure_recovery/down.sql"
        ))
        .await?;
    client
        .batch_execute("DELETE FROM zc_private.record_validation WHERE id_record=2")
        .await?;
    assert_eq!(
        client
            .query_one(
                "SELECT status FROM zc_private.record_validation WHERE id_record=2",
                &[]
            )
            .await?
            .get::<_, String>(0),
        "fail"
    );
    client
        .batch_execute(include_str!(
            "../migrations/20261106010000_timing_failure_recovery/up.sql"
        ))
        .await?;
    Ok(())
}
