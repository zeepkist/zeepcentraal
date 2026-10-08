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
#[ignore = "requires empty local ghost_validation_history_test database"]
async fn corrected_attempts_supersede_failures_without_changing_records() -> Result<()> {
    use serde_json::json;
    use zc_core::ghost_validation::VALIDATOR_VERSION;
    let url = fixture_url("ghost_validation_history_test").await?;
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
    client.batch_execute("INSERT INTO public.\"user\"(id,steam_id) VALUES(1,42); INSERT INTO public.level(id,xx_hash) VALUES(1,repeat('a',32)),(2,repeat('b',32)); INSERT INTO public.record(id,id_user,id_level,time,date_created) VALUES(1276,1,1,10,'2020-01-01'); INSERT INTO public.personal_best_global(id_record,id_user,id_level) VALUES(1276,1,1); INSERT INTO public.world_record_global(id_record,id_user,id_level) VALUES(1276,1,1); INSERT INTO public.level_points(id_level,points) VALUES(1,100);").await?;
    let database = Database::connect(&url, 2).await?;
    let before = client.query_one("SELECT to_jsonb(r)::text, (SELECT jsonb_agg(p)::text FROM public.personal_best_global p), (SELECT jsonb_agg(w)::text FROM public.world_record_global w), (SELECT jsonb_agg(s)::text FROM public.level_points s) FROM public.record r WHERE id=1276", &[]).await?;
    let snapshot = |id, hash: char| zc_database::services::ghost_validation::LevelSnapshot {
        id,
        id_level: id as i32,
        canonical_hash: hash.to_string().repeat(32),
        type_ground: 0,
        type_skybox: 0,
        file_uids: vec![],
        format: 1,
        blocks: json!([]),
        environment: None,
    };
    let assigned = snapshot(1, 'a');
    let candidate = snapshot(2, 'b');
    let mut old = ValidationReport::failed("invalid_splits");
    old.validator_version = "geometry-6".into();
    database
        .save_record_validation(Some(1276), 1, None, None, &old)
        .await?;
    old.comparison = true;
    database
        .save_record_validation(Some(1276), 1, Some(&assigned), None, &old)
        .await?;
    database
        .save_record_validation(Some(1276), 1, Some(&candidate), None, &old)
        .await?;
    let filter = json!({"reasons":["invalid_splits","missing_ghost"]});
    assert_eq!(database.audit_record_ids(&filter).await?, vec![1276]);
    assert!(
        database
            .audit_record_ids(&json!({"reasons":["missing_ghost"]}))
            .await?
            .is_empty()
    );
    assert!(
        database
            .audit_record_ids(&json!({"reasons":["invalid_splits"],"afterId":1276}))
            .await?
            .is_empty()
    );
    let corrected = ValidationReport::uncertain("legacy_telemetry_incomplete");
    database
        .save_record_validation(Some(1276), 1, Some(&assigned), None, &corrected)
        .await?;
    // Partial progress does not skip outstanding candidate versions.
    assert_eq!(database.audit_record_ids(&filter).await?, vec![1276]);
    let mut comparison = corrected.clone();
    comparison.comparison = true;
    database
        .save_record_validation(Some(1276), 1, Some(&assigned), None, &comparison)
        .await?;
    let mut outage = ValidationReport::uncertain("ghost_storage_unavailable");
    outage.comparison = true;
    database
        .save_record_validation(Some(1276), 1, Some(&candidate), None, &outage)
        .await?;
    assert_eq!(database.audit_record_ids(&filter).await?, vec![1276]);
    database
        .save_record_validation(Some(1276), 1, Some(&candidate), None, &comparison)
        .await?;
    assert!(database.audit_record_ids(&filter).await?.is_empty());
    let latest = database
        .admin_validations(0, Some(1276), None, &json!({}))
        .await?;
    assert_eq!(latest.len(), 3);
    assert!(
        latest
            .iter()
            .all(|v| v["status"] == "uncertain" && v["validator_version"] == VALIDATOR_VERSION)
    );
    assert!(
        database
            .admin_validations(0, Some(1276), Some("fail"), &json!({}))
            .await?
            .is_empty()
    );
    let history = database
        .admin_validations(0, Some(1276), Some("fail"), &json!({"history":true}))
        .await?;
    assert_eq!(history.len(), 3);
    assert_eq!(database.record_validation_attempts(1276).await?.len(), 7);
    let after = latest[0]["id"].as_str().unwrap().parse()?;
    assert_eq!(
        database
            .admin_validations(after, Some(1276), None, &json!({}))
            .await?
            .len(),
        2
    );
    let after = client.query_one("SELECT to_jsonb(r)::text, (SELECT jsonb_agg(p)::text FROM public.personal_best_global p), (SELECT jsonb_agg(w)::text FROM public.world_record_global w), (SELECT jsonb_agg(s)::text FROM public.level_points s) FROM public.record r WHERE id=1276", &[]).await?;
    for index in 0..4 {
        assert_eq!(
            before.get::<_, String>(index),
            after.get::<_, String>(index)
        );
    }
    Ok(())
}

#[tokio::test]
#[ignore = "requires empty local ghost_validation_migration_test database"]
async fn migration_round_trip_and_immutable_lineage() -> Result<()> {
    let url = fixture_url("ghost_validation_migration_test").await?;
    let (mut client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("test database connection") });
    let transaction = client.transaction().await?;
    transaction.batch_execute("CREATE TABLE public.level(id integer PRIMARY KEY,xx_hash text); CREATE TABLE public.\"user\"(id integer PRIMARY KEY); CREATE TABLE public.record(id integer PRIMARY KEY); CREATE TABLE public.level_metadata(id integer,id_level integer,format integer,blocks jsonb,environment jsonb,type_ground integer,type_skybox integer); CREATE TABLE public.level_item(id_level integer,workshop_id bigint,file_uid text); INSERT INTO public.level VALUES(1,repeat('a',32)); INSERT INTO public.level_metadata VALUES(1,1,1,'[]',NULL,0,0); INSERT INTO public.level_item VALUES(1,123,'uid');").await?;
    transaction
        .batch_execute(include_str!(
            "../migrations/20261006180000_ghost_validation/up.sql"
        ))
        .await?;
    assert_eq!(
        transaction
            .query_one("SELECT count(*) FROM zc_private.level_version_lineage", &[])
            .await?
            .get::<_, i64>(0),
        1
    );
    transaction.batch_execute("INSERT INTO zc_private.level_version_lineage(id_level,workshop_id,file_uid,source) VALUES(1,123,'uid','current_membership_seed') ON CONFLICT DO NOTHING;").await?;
    assert_eq!(
        transaction
            .query_one("SELECT count(*) FROM zc_private.level_version_lineage", &[])
            .await?
            .get::<_, i64>(0),
        1
    );
    assert!(
        transaction
            .query_one(
                "SELECT to_regclass('zc_private.level_snapshot') IS NULL",
                &[]
            )
            .await?
            .get::<_, bool>(0)
    );
    assert_eq!(transaction.query_one("SELECT count(*) FROM information_schema.columns WHERE table_schema='zc_private' AND table_name='level_version_lineage' AND data_type='jsonb'", &[]).await?.get::<_, i64>(0), 0);
    transaction
        .batch_execute("SAVEPOINT immutable_test")
        .await?;
    assert!(
        transaction
            .execute(
                "UPDATE zc_private.level_version_lineage SET file_uid='changed'",
                &[]
            )
            .await
            .is_err()
    );
    transaction
        .batch_execute("ROLLBACK TO SAVEPOINT immutable_test")
        .await?;
    transaction
        .batch_execute(include_str!(
            "../migrations/20261006180000_ghost_validation/down.sql"
        ))
        .await?;
    assert!(
        transaction
            .query_one(
                "SELECT to_regclass('zc_private.level_version_lineage') IS NULL",
                &[]
            )
            .await?
            .get::<_, bool>(0)
    );
    transaction.rollback().await?;
    Ok(())
}

#[tokio::test]
#[ignore = "requires migrated local zsl_migration_test database"]
async fn accepted_run_retry_is_atomic_and_changed_payload_fails() -> Result<()> {
    let url = fixture_url("zsl_migration_test").await?;
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
            snapshot: None,
            report: &report,
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
            snapshot: None,
            report,
        }),
    }
}

#[tokio::test]
#[ignore = "requires migrated local workshop_validation_test fixture DB"]
async fn version_candidates_share_workshop_without_trusting_builder_uid() -> Result<()> {
    let url = fixture_url("workshop_validation_test").await?;
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
        client.execute("INSERT INTO zc_private.level_version_lineage(id_level,workshop_id,file_uid,source) VALUES($1,$2,$3,'workshop_scan') ON CONFLICT DO NOTHING", &[&level.id,&(900_000_000+suffix),&format!("untrusted-{suffix}-{index}")]).await?;
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
