use anyhow::{Result, ensure};
use serde_json::json;
use zc_core::ghost_validation::ValidationReport;
use zc_database::Database;

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
    if client.query_one("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='level' AND column_name='validation_metadata_updated_at')",&[]).await?.get::<_,bool>(0) {
        client.batch_execute(DOWN).await?;
    }
    client.batch_execute(r#"
      TRUNCATE public."user",public.level,public.record,public.personal_best_global,
        public.world_record_global,public.user_point_contribution,public.player_skill_aggregate,
        public.user_points,public.level_points,public.record_media,public.level_item,
        public.level_metadata,zc_private.record_validation,zc_jobs.job RESTART IDENTITY CASCADE;
      TRUNCATE pgmq.q_zeepcentraal_bulk,pgmq.q_zeepcentraal_fast;
      INSERT INTO public."user"(id,steam_id) OVERRIDING SYSTEM VALUE VALUES(1,42);
      INSERT INTO public.level(id,hash,xx_hash) OVERRIDING SYSTEM VALUE VALUES(1,'a',repeat('a',32)),(2,'b',repeat('b',32));
      INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version) OVERRIDING SYSTEM VALUE
        SELECT id,1,1,10,'test','test' FROM generate_series(1,1105) id;
      INSERT INTO zc_private.record_validation(id_record,id_user,id_level,status,report,validator_version,checked_at)
        SELECT id,1,1,CASE WHEN id<=1100 THEN 'fail' WHEN id=1101 THEN 'uncertain' WHEN id=1102 THEN 'pass' ELSE 'pending' END,
          '{"reasons":["ghost_storage_unavailable"]}','old','epoch' FROM generate_series(1,1104) id;
      INSERT INTO public.personal_best_global(id_user,id_level,id_record) VALUES(1,1,1101);
      INSERT INTO public.world_record_global(id_user,id_level,id_record) VALUES(1,1,1101);
    "#).await?;
    // Migration must preserve queued/running repair state and pgmq messages.
    client
        .batch_execute("SELECT * FROM zc_jobs.claim('bulk',1,120)")
        .await?;
    let queue_snapshot = || async {
        Ok::<_, anyhow::Error>(client.query_one("SELECT jsonb_build_array((SELECT jsonb_agg(to_jsonb(j) ORDER BY id) FROM zc_jobs.job j),(SELECT jsonb_agg(to_jsonb(q) ORDER BY msg_id) FROM pgmq.q_zeepcentraal_bulk q))::text", &[]).await?.get::<_,String>(0))
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
    client.batch_execute("TRUNCATE zc_jobs.job,pgmq.q_zeepcentraal_bulk; INSERT INTO public.level_item(id_level,workshop_id) VALUES(1,123); UPDATE public.level_item SET name='rename',deleted=true; UPDATE public.level_item SET deleted=false,id_level=2; DELETE FROM public.level_item").await?;
    assert_eq!(database.validation_check_timestamp(1).await?, initial);
    assert_eq!(
        database
            .validation_check_timestamp(2)
            .await?
            .checked_metadata_at,
        initial.checked_metadata_at
    );
    assert_eq!(client.query_one("SELECT count(*) FROM zc_jobs.job WHERE task IN ('reconcileRecordEligibility','auditRecordGhosts')",&[]).await?.get::<_,i64>(0),0);
    assert!(
        client
            .query_one(
                "SELECT count(*)>0 FROM zc_jobs.job WHERE task='updateLevelRecordCounts'",
                &[]
            )
            .await?
            .get::<_, bool>(0)
    );

    client
        .batch_execute("UPDATE public.record SET id_level=2 WHERE id=1105")
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
        .batch_execute("INSERT INTO public.level_metadata(id_level,format,blocks) VALUES(1,1,'[]')")
        .await?;
    let observed = database.validation_check_timestamp(1).await?;
    assert_ne!(observed, initial);
    assert!(database.audit_record_for_validation(1101).await?.is_some());
    client.batch_execute("UPDATE public.level_metadata SET date_updated=clock_timestamp(),date_created=clock_timestamp()").await?;
    assert_eq!(database.validation_check_timestamp(1).await?, observed);
    client
        .batch_execute("UPDATE public.level_metadata SET publicly_visible=false")
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
            .query_one(
                "SELECT count(*) FROM zc_jobs.job WHERE task='reconcileRecordEligibility'",
                &[]
            )
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
    client.batch_execute("UPDATE zc_private.record_validation SET status='pass',id_level=2 WHERE id_record=1; DELETE FROM zc_private.record_validation WHERE id_record=1").await?;
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
            .query_one(
                "SELECT count(*) FROM zc_jobs.job WHERE task='reconcileRecordEligibility'",
                &[]
            )
            .await?
            .get::<_, i64>(0),
        1
    );
    client
        .batch_execute("DELETE FROM public.level_metadata")
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
