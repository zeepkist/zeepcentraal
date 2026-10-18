use anyhow::{Result, ensure};
use zc_core::ghost_validation::ValidationReport;
use zc_database::{Database, services::jobs::MaintenanceOutcome};

async fn queued_levels(client: &tokio_postgres::Client) -> Result<Vec<i32>> {
    Ok(client
        .query_one(
            "SELECT array_agg((payload->>'idLevel')::integer ORDER BY (payload->>'idLevel')::integer) FROM zc_jobs.job WHERE task='updateLevelScore'",
            &[],
        )
        .await?
        .get::<_, Option<Vec<i32>>>(0)
        .unwrap_or_default())
}

async fn clear_queue(client: &tokio_postgres::Client) -> Result<()> {
    client
        .batch_execute("TRUNCATE zc_jobs.job,pgmq.q_zeepcentraal_bulk,pgmq.q_zeepcentraal_fast")
        .await?;
    Ok(())
}

#[tokio::test]
#[ignore = "requires isolated record_eligibility_fanout_test with scoring schema and pgmq 1.12.0"]
async fn skill_changes_never_fan_out_to_other_levels() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1")
            && parsed.path() == "/record_eligibility_fanout_test",
        "Dedicated isolated database required"
    );
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("fixture connection") });
    client.batch_execute(r#"
        TRUNCATE public."user",public.level,public.record,
          public.personal_best_global,public.world_record_global,
          public.user_point_contribution,public.player_skill_aggregate,
          public.user_points,public.level_points,public.record_media,
          public.record_statistic,public.track_tournament,
          public.track_tournament_result,zc_private.record_validation
          RESTART IDENTITY CASCADE;
        INSERT INTO public."user"(id,steam_id,banned) OVERRIDING SYSTEM VALUE
          SELECT id,100000+id,false FROM generate_series(1,20) id;
        INSERT INTO public.level(id,hash,xx_hash,adventure) OVERRIDING SYSTEM VALUE
          SELECT id,'fanout-'||id,md5(id::text),true FROM generate_series(1,3) id;
        INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version) OVERRIDING SYSTEM VALUE
          SELECT id,id,1,id::real,'test','test' FROM generate_series(1,20) id;
        INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version) OVERRIDING SYSTEM VALUE
          VALUES(21,1,2,7,'test','test'),(22,2,3,7,'test','test');
        INSERT INTO public.personal_best_global(id_user,id_level,id_record)
          SELECT id,1,id FROM generate_series(1,20) id;
        INSERT INTO public.personal_best_global(id_user,id_level,id_record) VALUES(1,2,21),(2,3,22);
    "#).await?;
    clear_queue(&client).await?;
    let database = Database::connect(&url, 4).await?;

    // Representative producer volume: 50,000 other PB levels never become score jobs.
    let started = std::time::Instant::now();
    client.batch_execute(r#"
      BEGIN;
      SELECT set_config('zc.validation_correction','on',true);
      INSERT INTO public.level(id,hash,xx_hash) OVERRIDING SYSTEM VALUE
        SELECT id,'other-'||id,lpad(to_hex(id),32,'0') FROM generate_series(4,50003) id;
      INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version) OVERRIDING SYSTEM VALUE
        SELECT id+19,1,id,7,'test','test' FROM generate_series(4,50003) id;
      INSERT INTO public.personal_best_global(id_user,id_level,id_record)
        SELECT 1,id,id+19 FROM generate_series(4,50003) id;
      COMMIT;
    "#).await?;
    println!(
        "50,000-PB fixture prepared in {} ms",
        started.elapsed().as_millis()
    );
    let started = std::time::Instant::now();
    // Creating skill inputs refreshes only the repaired level.
    assert_eq!(
        database.reconcile_record_eligibility(1).await?,
        MaintenanceOutcome::Applied(())
    );
    assert_eq!(queued_levels(&client).await?, vec![1]);
    assert_eq!(
        client
            .query_one("SELECT count(*) FROM zc_jobs.job", &[])
            .await?
            .get::<_, i64>(0),
        3,
        "repair publishes only its level work and durable player seed"
    );
    clear_queue(&client).await?;

    println!(
        "50,000 dependent levels: repair publishes three requests in {} ms",
        started.elapsed().as_millis()
    );
    // Replaying an already repaired level must not invalidate unrelated levels.
    assert_eq!(
        database.reconcile_record_eligibility(1).await?,
        MaintenanceOutcome::Applied(())
    );
    assert_eq!(queued_levels(&client).await?, vec![1]);
    assert_eq!(
        client
            .query_one("SELECT count(*) FROM zc_jobs.job", &[])
            .await?
            .get::<_, i64>(0),
        3,
        "repair publishes only its level work and durable player seed"
    );
    clear_queue(&client).await?;

    // Repairing user 1's skill inputs must not refresh dependent levels.
    client.batch_execute("UPDATE public.player_skill_aggregate SET placement_sum=placement_sum+0.25 WHERE id_user=1").await?;
    assert_eq!(
        database.reconcile_record_eligibility(1).await?,
        MaintenanceOutcome::Applied(())
    );
    assert_eq!(queued_levels(&client).await?, vec![1]);
    assert_eq!(
        client
            .query_one("SELECT count(*) FROM zc_jobs.job", &[])
            .await?
            .get::<_, i64>(0),
        3,
        "repair publishes only its level work and durable player seed"
    );
    clear_queue(&client).await?;

    // Invalidating one PB changes every skill input. No other level refreshes.
    database
        .save_record_validation(1, None, &ValidationReport::failed("missing_checkpoint"))
        .await?;
    clear_queue(&client).await?;
    assert_eq!(
        database.reconcile_record_eligibility(1).await?,
        MaintenanceOutcome::Applied(())
    );
    assert_eq!(queued_levels(&client).await?, vec![1]);
    assert_eq!(
        client
            .query_one("SELECT count(*) FROM zc_jobs.job", &[])
            .await?
            .get::<_, i64>(0),
        3,
        "repair publishes only its level work and durable player seed"
    );
    clear_queue(&client).await?;
    assert_eq!(
        database.reconcile_record_eligibility(1).await?,
        MaintenanceOutcome::Applied(())
    );
    assert_eq!(queued_levels(&client).await?, vec![1]);
    assert_eq!(
        client
            .query_one("SELECT count(*) FROM zc_jobs.job", &[])
            .await?
            .get::<_, i64>(0),
        3,
        "repair publishes only its level work and durable player seed"
    );
    clear_queue(&client).await?;
    // If seed publication fails, projections and all queue effects roll back together.
    client.batch_execute(r#"
      INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version) OVERRIDING SYSTEM VALUE VALUES(60000,2,1,0.01,'test','test');
      CREATE FUNCTION public.reject_eligibility_seed_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.task='fanOutRecordEligibility' THEN RAISE EXCEPTION 'fixture rollback'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_eligibility_seed_fixture BEFORE INSERT ON zc_jobs.job FOR EACH ROW EXECUTE FUNCTION public.reject_eligibility_seed_fixture();
    "#).await?;
    assert!(database.reconcile_record_eligibility(1).await.is_err());
    assert_eq!(
        client
            .query_one(
                "SELECT id_record FROM public.personal_best_global WHERE id_user=2 AND id_level=1",
                &[]
            )
            .await?
            .get::<_, i32>(0),
        2
    );
    assert_eq!(
        client
            .query_one("SELECT count(*) FROM zc_jobs.job", &[])
            .await?
            .get::<_, i64>(0),
        0
    );
    client.batch_execute("DROP TRIGGER reject_eligibility_seed_fixture ON zc_jobs.job; DROP FUNCTION public.reject_eligibility_seed_fixture()").await?;
    Ok(())
}
