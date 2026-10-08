use anyhow::{Context, Result, ensure};
use serde_json::json;
use zc_core::ghost_validation::{VALIDATOR_VERSION, ValidationReport};
use zc_database::Database;

async fn fixture(name: &str) -> Result<(Database, tokio_postgres::Client)> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")
        .context("Disposable database required")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == format!("/{name}"),
        "Dedicated local test database required"
    );
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
    client.batch_execute("INSERT INTO public.\"user\"(id,steam_id) VALUES(1,42); INSERT INTO public.level(id,xx_hash) VALUES(1,repeat('a',32)),(2,repeat('b',32)); CREATE INDEX ON public.level_metadata(id_level); CREATE INDEX ON public.level_item(id_level,workshop_id);").await?;
    Ok((Database::connect(&url, 2).await?, client))
}

#[tokio::test]
#[ignore = "requires fresh local ghost_validation_incremental_bounds_test database"]
async fn incremental_skips_watermarks_changes_and_rollback() -> Result<()> {
    let (db, client) = fixture("ghost_validation_incremental_bounds_test").await?;
    client.batch_execute("INSERT INTO public.record(id,id_user,id_level,time) SELECT id,1,1,10 FROM generate_series(1,2001) id").await?;
    let bounded = db
        .audit_record_window(&json!({"afterId":1000}), 1500)
        .await?;
    assert_eq!(bounded.len(), 500);
    assert_eq!(bounded.first().unwrap().id, 1001);
    assert_eq!(bounded.last().unwrap().id, 1500);
    for (start, end, status) in [
        (1, 667, "pass"),
        (668, 1334, "fail"),
        (1335, 2000, "uncertain"),
    ] {
        let mut report = ValidationReport::uncertain("test_evidence");
        report.status = status.into();
        let ids: Vec<_> = (start..=end).collect();
        let stamp = db.validation_check_timestamp(1).await?;
        db.save_checked_record_validations(&ids, Some("initial"), &report, &stamp)
            .await?;
    }
    assert_eq!(
        db.audit_record_ids(&json!({})).await?,
        vec![2001],
        "must traverse entirely skipped windows"
    );
    let stamp = db.validation_check_timestamp(1).await?;
    db.save_checked_record_validations(
        &[2001],
        None,
        &ValidationReport::uncertain("missing_snapshot"),
        &stamp,
    )
    .await?;
    assert!(db.audit_record_ids(&json!({})).await?.is_empty());
    let mut terminal = ValidationReport::failed("missing_ghost");
    terminal.validator_version = "old".into();
    db.save_checked_record_validations(&[1], None, &terminal, &stamp)
        .await?;
    client.batch_execute("INSERT INTO public.level_metadata(id_level,format,blocks) VALUES(1,1,'[]'); INSERT INTO public.level_item(id_level,workshop_id) VALUES(1,123)").await?;
    let rows = db.audit_record_window(&json!({}), 2001).await?;
    assert!(
        !rows[0].needs_check,
        "missing_ghost stays terminal across source/version changes"
    );
    assert!(rows[1..].iter().all(|r| r.needs_check));
    let mut pass = ValidationReport::uncertain("test_evidence");
    pass.status = "pass".into();
    let before = db.record_validation_attempts(2).await?.remove(0);
    let observed = db.validation_check_timestamp(1).await?;
    client.batch_execute("UPDATE public.level_metadata SET blocks=blocks,date_updated=date_updated WHERE id_level=1").await?;
    assert_eq!(
        db.validation_check_timestamp(1).await?,
        observed,
        "unchanged source rows must not invalidate results"
    );
    client.batch_execute("UPDATE public.level_metadata SET blocks='[{\"i\":22}]',date_updated=clock_timestamp() WHERE id_level=1").await?;
    db.save_checked_record_validations(&[2], Some("ignored"), &pass, &observed)
        .await?;
    assert!(
        db.audit_record_window(&json!({"idRecord":2}), 2001).await?[0].needs_check,
        "change during check must stay eligible"
    );
    let latest = db.validation_check_timestamp(1).await?;
    db.save_checked_record_validations(&[2], Some("ignored"), &pass, &latest)
        .await?;
    let after = db.record_validation_attempts(2).await?.remove(0);
    for field in ["id", "created_at", "updated_at", "ghost_digest", "report"] {
        assert_eq!(
            before[field], after[field],
            "bookkeeping must preserve {field}"
        );
    }
    assert_ne!(before["checked_at"], after["checked_at"]);
    assert!(!db.audit_record_window(&json!({"idRecord":2}), 2001).await?[0].needs_check);
    db.save_checked_record_validations(&[2], None, &ValidationReport::failed("stale"), &observed)
        .await?;
    assert_eq!(
        db.record_validation_attempts(2).await?[0],
        after,
        "older evaluation cannot replace newer result"
    );
    client
        .batch_execute("UPDATE public.level_item SET id_level=2 WHERE id_level=1")
        .await?;
    assert!(
        db.audit_record_window(&json!({"idRecord":2}), 2001).await?[0].needs_check,
        "moved membership invalidates old level inputs"
    );
    let latest = db.validation_check_timestamp(1).await?;
    db.save_checked_record_validations(&[2], None, &pass, &latest)
        .await?;
    client
        .batch_execute("DELETE FROM public.level_metadata WHERE id_level=1")
        .await?;
    assert!(
        db.audit_record_window(&json!({"idRecord":2}), 2001).await?[0].needs_check,
        "removed geometry remains observable"
    );
    let stamp = db.validation_check_timestamp(1).await?;
    db.save_checked_record_validations(&[2], None, &pass, &stamp)
        .await?;
    client
        .batch_execute(
            "UPDATE zc_private.record_validation SET validator_version='old' WHERE id_record=2",
        )
        .await?;
    assert!(db.audit_record_window(&json!({"idRecord":2}), 2001).await?[0].needs_check);
    let v = db.record_validation_attempts(1).await?.remove(0);
    assert_eq!(v["report"]["reasons"][0], "missing_ghost");
    client
        .batch_execute(include_str!(
            "../migrations/20261008040000_incremental_ghost_audits/down.sql"
        ))
        .await?;
    assert_eq!(
        client
            .query_one("SELECT count(*) FROM zc_private.record_validation", &[])
            .await?
            .get::<_, i64>(0),
        2001
    );
    assert_eq!(client.query_one("SELECT count(*) FROM information_schema.columns WHERE column_name IN ('checked_at','validation_inputs_updated_at') AND table_schema IN ('public','zc_private')",&[]).await?.get::<_,i64>(0),0);
    client
        .batch_execute(include_str!(
            "../migrations/20261008040000_incremental_ghost_audits/up.sql"
        ))
        .await?;
    assert_eq!(
        client
            .query_one(
                "SELECT count(*) FROM zc_private.record_validation WHERE checked_at IS NULL",
                &[]
            )
            .await?
            .get::<_, i64>(0),
        2001
    );
    Ok(())
}

#[tokio::test]
#[ignore = "large benchmark requires fresh local ghost_validation_incremental_benchmark_test database"]
async fn three_million_records_use_bounded_windows() -> Result<()> {
    let (db, client) = fixture("ghost_validation_incremental_benchmark_test").await?;
    client.batch_execute("INSERT INTO public.record(id,id_user,id_level,time) SELECT id,1,1+(id%2),10 FROM generate_series(1,3000001) id").await?;
    client.execute("INSERT INTO zc_private.record_validation(id_record,id_user,id_level,status,report,validator_version,checked_at) SELECT id,id_user,id_level,CASE WHEN id%3=0 THEN 'pass' WHEN id%3=1 THEN 'fail' ELSE 'uncertain' END,'{\"reasons\":[]}'::jsonb,$1,'epoch' FROM public.record WHERE id NOT IN (2500001,3000001)",&[&VALIDATOR_VERSION]).await?;
    client
        .batch_execute(
            "ANALYZE public.record; ANALYZE zc_private.record_validation; ANALYZE public.level",
        )
        .await?;
    let start = std::time::Instant::now();
    assert_eq!(
        db.audit_record_ids(&json!({})).await?,
        vec![2500001, 3000001]
    );
    println!(
        "3,000,001 records; sparse eligible traversal: {} ms",
        start.elapsed().as_millis()
    );
    let start = std::time::Instant::now();
    let window = db
        .audit_record_window(&json!({"idLevel":2,"afterId":2500000}), 3000001)
        .await?;
    assert_eq!(window.len(), 1000);
    assert!(window.iter().all(|r| r.id_level == 2));
    println!(
        "Level-filtered 1,000-record window: {} ms",
        start.elapsed().as_millis()
    );
    Ok(())
}
