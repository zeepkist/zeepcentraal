use anyhow::{Result, ensure};
use zc_core::ghost_validation::ValidationReport;
use zc_database::{Database, services::jobs::MaintenanceOutcome};

const COUNT_JOB: &str = include_str!("fixtures/eligibility_fanout/count_job.sql");

async fn queued_levels(client: &tokio_postgres::Client) -> Result<Vec<i32>> {
    Ok(client
        .query_one(
            include_str!("fixtures/eligibility_fanout/select_job.sql"),
            &[],
        )
        .await?
        .get::<_, Option<Vec<i32>>>(0)
        .unwrap_or_default())
}

async fn clear_queue(client: &tokio_postgres::Client) -> Result<()> {
    client
        .batch_execute(include_str!("fixtures/eligibility_fanout/truncate_job.sql"))
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
    client
        .batch_execute(include_str!(
            "fixtures/eligibility_fanout/truncate_user.sql"
        ))
        .await?;
    clear_queue(&client).await?;
    let database = Database::connect(&url, 4).await?;

    // Representative producer volume: 50,000 other PB levels never become score jobs.
    let started = std::time::Instant::now();
    client
        .batch_execute(include_str!("fixtures/eligibility_fanout/set_config.sql"))
        .await?;
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
        client.query_one(COUNT_JOB, &[]).await?.get::<_, i64>(0),
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
        client.query_one(COUNT_JOB, &[]).await?.get::<_, i64>(0),
        3,
        "repair publishes only its level work and durable player seed"
    );
    clear_queue(&client).await?;

    // Repairing user 1's skill inputs must not refresh dependent levels.
    client
        .batch_execute(include_str!(
            "fixtures/eligibility_fanout/set_placement_sum_player_skill_aggregate.sql"
        ))
        .await?;
    assert_eq!(
        database.reconcile_record_eligibility(1).await?,
        MaintenanceOutcome::Applied(())
    );
    assert_eq!(queued_levels(&client).await?, vec![1]);
    assert_eq!(
        client.query_one(COUNT_JOB, &[]).await?.get::<_, i64>(0),
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
        client.query_one(COUNT_JOB, &[]).await?.get::<_, i64>(0),
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
        client.query_one(COUNT_JOB, &[]).await?.get::<_, i64>(0),
        3,
        "repair publishes only its level work and durable player seed"
    );
    clear_queue(&client).await?;
    // If seed publication fails, projections and all queue effects roll back together.
    client
        .batch_execute(include_str!(
            "fixtures/eligibility_fanout/insert_record.sql"
        ))
        .await?;
    assert!(database.reconcile_record_eligibility(1).await.is_err());
    assert_eq!(
        client
            .query_one(
                include_str!(
                    "fixtures/eligibility_fanout/select_id_record_personal_best_global.sql"
                ),
                &[]
            )
            .await?
            .get::<_, i32>(0),
        2
    );
    assert_eq!(client.query_one(COUNT_JOB, &[]).await?.get::<_, i64>(0), 0);
    client
        .batch_execute(include_str!(
            "fixtures/eligibility_fanout/drop_reject_eligibility_seed_fixture.sql"
        ))
        .await?;
    Ok(())
}
