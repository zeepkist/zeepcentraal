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
async fn only_changed_skill_inputs_fan_out_to_other_levels() -> Result<()> {
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

    // Creating skill inputs invalidates both dependent levels.
    assert_eq!(
        database.reconcile_record_eligibility(1).await?,
        MaintenanceOutcome::Applied(())
    );
    assert_eq!(queued_levels(&client).await?, vec![1, 2, 3]);
    clear_queue(&client).await?;

    // Replaying an already repaired level must not invalidate unrelated levels.
    assert_eq!(
        database.reconcile_record_eligibility(1).await?,
        MaintenanceOutcome::Applied(())
    );
    assert_eq!(queued_levels(&client).await?, vec![1]);
    clear_queue(&client).await?;

    // Only user 1's dependent level needs refreshing when its inputs are repaired.
    client.batch_execute("UPDATE public.player_skill_aggregate SET placement_sum=placement_sum+0.25 WHERE id_user=1").await?;
    assert_eq!(
        database.reconcile_record_eligibility(1).await?,
        MaintenanceOutcome::Applied(())
    );
    assert_eq!(queued_levels(&client).await?, vec![1, 2]);
    clear_queue(&client).await?;

    // Invalidating one PB drops the field below 20. Every affected player's skill
    // inputs change, so other players' dependent levels must still refresh.
    database
        .save_record_validation(1, None, &ValidationReport::failed("missing_checkpoint"))
        .await?;
    assert_eq!(
        database.reconcile_record_eligibility(1).await?,
        MaintenanceOutcome::Applied(())
    );
    assert_eq!(queued_levels(&client).await?, vec![1, 2, 3]);
    clear_queue(&client).await?;
    assert_eq!(
        database.reconcile_record_eligibility(1).await?,
        MaintenanceOutcome::Applied(())
    );
    assert_eq!(queued_levels(&client).await?, vec![1]);
    clear_queue(&client).await?;
    Ok(())
}
