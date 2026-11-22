use anyhow::{Result, ensure};
use diesel::{
    QueryableByName, sql_query,
    sql_types::{BigInt, Integer},
};
use diesel_async::{RunQueryDsl, SimpleAsyncConnection};
use std::time::Duration;
use zc_database::{Database, DatabasePool, PoolBudget, PoolSettings};
use zc_jobs::queue::Queue;

#[derive(QueryableByName)]
struct Id {
    #[diesel(sql_type=Integer)]
    id: i32,
}
#[derive(QueryableByName)]
struct Count {
    #[diesel(sql_type=BigInt)]
    count: i64,
}

#[tokio::test]
#[ignore = "requires empty current schema in local tournament_recovery_test with pgmq 1.12.0"]
async fn scheduler_startup_and_concurrent_rotation_recover_current_period() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/tournament_recovery_test",
        "Dedicated isolated database required"
    );
    let pool = DatabasePool::connect(
        &url,
        PoolSettings {
            application_name: "tournament-recovery-test".into(),
            acquire_timeout: Duration::from_secs(5),
            statement_timeout: Duration::from_secs(10),
            lock_timeout: Duration::from_secs(5),
            idle_transaction_timeout: Duration::from_secs(30),
            idle_timeout: Duration::from_secs(30),
        },
        PoolBudget {
            application: 2,
            queue: 1,
            scheduler: 1,
        },
    )
    .await?;
    let application = pool.application();
    let database = Database::from_partition(application.clone());
    let queue = Queue::connect(pool.queue()?).await?;
    let mut connection = application.connection().await?;
    ensure!(
        sql_query(include_str!("fixtures/tournament_recovery/count_level.sql"))
            .get_result::<Count>(&mut connection)
            .await?
            .count
            == 0,
        "Empty fixture required"
    );
    let user = database.get_or_insert_user(42).await?;
    connection
        .batch_execute(include_str!(
            "fixtures/tournament_recovery/insert_workshop_item.sql"
        ))
        .await?;
    let level = sql_query(include_str!(
        "fixtures/tournament_recovery/insert_level.sql"
    ))
    .get_result::<Id>(&mut connection)
    .await?
    .id;
    sql_query(include_str!(
        "fixtures/tournament_recovery/insert_level_points.sql"
    ))
    .bind::<Integer, _>(level)
    .execute(&mut connection)
    .await?;
    sql_query(include_str!(
        "fixtures/tournament_recovery/insert_level_item.sql"
    ))
    .bind::<Integer, _>(level)
    .execute(&mut connection)
    .await?;
    let record = sql_query(include_str!(
        "fixtures/tournament_recovery/insert_record.sql"
    ))
    .bind::<Integer, _>(user.id)
    .bind::<Integer, _>(level)
    .get_result::<Id>(&mut connection)
    .await?
    .id;
    drop(connection);

    // Two replicas must select once, then return the same tournament.
    let (first, second) = tokio::join!(
        database.rotate_track_tournament(0),
        database.rotate_track_tournament(0)
    );
    let (first, second) = (first?, second?);
    assert_ne!(first.created, second.created);
    assert_eq!(first.id_tournament, second.id_tournament);
    let mut connection = application.connection().await?;
    let winner = sql_query(include_str!(
        "fixtures/tournament_recovery/select_id_record_track_tournament_result.sql"
    ))
    .bind::<Integer, _>(first.id_tournament.unwrap())
    .bind::<Integer, _>(user.id)
    .get_result::<Id>(&mut connection)
    .await?;
    assert_eq!(winner.id, record);
    drop(connection);

    let (daily_first, daily_second) = tokio::join!(
        database.rotate_track_tournament(2),
        database.rotate_track_tournament(2)
    );
    let (daily_first, daily_second) = (daily_first?, daily_second?);
    assert_ne!(daily_first.created, daily_second.created);
    assert_eq!(daily_first.id_tournament, daily_second.id_tournament);
    assert_ne!(daily_first.id_tournament, first.id_tournament);

    // Restart leadership within the same minute: stable keys must coalesce.
    for _ in 0..2 {
        let before = sql_query(include_str!("fixtures/tournament_recovery/select_job.sql"))
            .get_result::<Count>(&mut application.connection().await?)
            .await?
            .count;
        let scheduler = pool.scheduler()?;
        let initial = scheduler.connection().await?;
        let (shutdown, receiver) = tokio::sync::watch::channel(false);
        let task = tokio::spawn(zc_jobs::cron::run(
            scheduler,
            initial,
            queue.clone(),
            receiver,
        ));
        let observed = tokio::time::timeout(Duration::from_secs(5), async {
            loop {
                let mut connection = application.connection().await?;
                #[derive(QueryableByName)]
                struct Progress {
                    #[diesel(sql_type=BigInt)]
                    count: i64,
                    #[diesel(sql_type=BigInt)]
                    version: i64,
                }
                let progress =
                    sql_query(include_str!("fixtures/tournament_recovery/count_job.sql"))
                        .get_result::<Progress>(&mut connection)
                        .await?;
                if progress.count == 3 && progress.version > before {
                    return Ok::<_, anyhow::Error>(());
                }
                drop(connection);
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
        })
        .await;
        shutdown.send(true)?;
        tokio::time::timeout(Duration::from_secs(5), task).await???;
        observed??;
    }
    Ok(())
}
