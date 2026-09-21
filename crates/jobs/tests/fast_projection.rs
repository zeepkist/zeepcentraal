use anyhow::{Context, Result, ensure};
use diesel::{QueryableByName, sql_query, sql_types::BigInt};
use diesel_async::RunQueryDsl;
use serde_json::json;
use std::time::Duration;
use zc_database::{DatabasePool, PoolBudget, PoolSettings};
use zc_jobs::{
    TaskIdentifier,
    queue::{JobLane, Queue},
};

#[derive(QueryableByName)]
struct CountRow {
    #[diesel(sql_type = BigInt)]
    count: i64,
}

#[tokio::test]
#[ignore = "requires fresh disposable PostgreSQL with pgmq 1.12.0 and zc_jobs schema"]
async fn fast_level_jobs_coalesce_and_submitter_repairs_keep_order() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL").context("ZC_TEST_DATABASE_URL is required")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed
            .host_str()
            .is_some_and(|host| matches!(host, "127.0.0.1" | "localhost"))
            && parsed.path().contains("test"),
        "Fast projection test requires local disposable test database"
    );
    let pool = DatabasePool::connect(
        &url,
        PoolSettings {
            application_name: "zeepcentraal-fast-projection-test".to_owned(),
            acquire_timeout: Duration::from_secs(5),
            statement_timeout: Duration::from_secs(15),
            lock_timeout: Duration::from_secs(3),
            idle_transaction_timeout: Duration::from_secs(30),
            idle_timeout: Duration::from_secs(30),
        },
        PoolBudget {
            application: 1,
            queue: 2,
            scheduler: 0,
        },
    )
    .await?;
    let partition = pool.queue()?;
    let queue = Queue::connect(partition.clone()).await?;
    let mut connection = partition.connection().await?;
    let initial: CountRow = sql_query("SELECT count(*)::bigint AS count FROM zc_jobs.job")
        .get_result(&mut connection)
        .await?;
    ensure!(
        initial.count == 0,
        "Fast projection test requires empty queue"
    );
    drop(connection);

    let score = queue
        .enqueue(
            TaskIdentifier::UpdateLevelScore,
            json!({"idLevel": 12790, "idUser": 101}),
            JobLane::Fast,
            None,
        )
        .await?;
    let coalesced = queue
        .enqueue(
            TaskIdentifier::UpdateLevelScore,
            json!({"idLevel": 12790, "idUser": 102}),
            JobLane::Fast,
            None,
        )
        .await?;
    assert_eq!(score.id, coalesced.id);
    let first_repair = queue
        .enqueue(
            TaskIdentifier::UpdateLevelContributions,
            json!({"idLevel": 12790, "idUser": 101, "projectionToken": "9001", "deferCount": 0}),
            JobLane::Fast,
            None,
        )
        .await?;
    let second_repair = queue
        .enqueue(
            TaskIdentifier::UpdateLevelContributions,
            json!({"idLevel": 12790, "idUser": 102, "projectionToken": "9002", "deferCount": 0}),
            JobLane::Fast,
            None,
        )
        .await?;
    assert_ne!(first_repair.id, second_repair.id);
    assert!(queue.has_fast_level_score(12790).await?);

    let claimed = queue.claim(JobLane::Fast, 4).await?;
    assert_eq!(claimed.len(), 1);
    assert_eq!(claimed[0].id, score.id);
    assert_eq!(claimed[0].payload["idUser"], 102);
    assert!(queue.claim(JobLane::Fast, 4).await?.is_empty());
    assert!(queue.finish(&claimed[0], None).await?);
    assert!(!queue.has_fast_level_score(12790).await?);

    let claimed = queue.claim(JobLane::Fast, 4).await?;
    assert_eq!(claimed.len(), 1);
    assert_eq!(claimed[0].id, first_repair.id);
    assert_eq!(claimed[0].payload["projectionToken"], "9001");
    assert!(queue.finish(&claimed[0], None).await?);
    let claimed = queue.claim(JobLane::Fast, 4).await?;
    assert_eq!(claimed.len(), 1);
    assert_eq!(claimed[0].id, second_repair.id);
    assert!(queue.finish(&claimed[0], None).await?);

    let player = queue
        .enqueue(
            TaskIdentifier::UpdatePlayerScore,
            json!({"idUser": 101, "projectionToken": "9001"}),
            JobLane::Fast,
            Some("update-player-score-submit:101:9001"),
        )
        .await?;
    let claimed = queue.claim(JobLane::Fast, 4).await?;
    assert_eq!(claimed.len(), 1);
    assert_eq!(claimed[0].id, player.id);
    assert_eq!(claimed[0].payload["projectionToken"], "9001");
    assert!(queue.finish(&claimed[0], None).await?);
    let mut connection = partition.connection().await?;
    let remaining: CountRow = sql_query("SELECT count(*)::bigint AS count FROM zc_jobs.job")
        .get_result(&mut connection)
        .await?;
    assert_eq!(remaining.count, 0);
    let archived: CountRow =
        sql_query("SELECT count(*)::bigint AS count FROM pgmq.a_zeepcentraal_fast")
            .get_result(&mut connection)
            .await?;
    assert_eq!(archived.count, 0);

    let cursor = queue.enqueue_level_projection(12790, 100).await?;
    let merged = queue.enqueue_level_projection(12790, 0).await?;
    assert_eq!(cursor.id, merged.id);
    let claimed = queue.claim(JobLane::Bulk, 1).await?;
    assert_eq!(claimed[0].id, cursor.id);
    assert_eq!(claimed[0].payload["afterUserId"], 0);
    let pending = queue.enqueue_level_projection(12790, 50).await?;
    queue.enqueue_level_projection(12790, 0).await?;
    assert_ne!(pending.id, cursor.id);
    assert!(queue.defer(&claimed[0]).await?);
    let mut connection = partition.connection().await?;
    let remaining: CountRow = sql_query("SELECT count(*)::bigint AS count FROM zc_jobs.job WHERE lane='bulk' AND job_key='update-level-contributions:12790'")
        .get_result(&mut connection).await?;
    assert_eq!(remaining.count, 1);
    drop(connection);
    let claimed = queue.claim(JobLane::Bulk, 1).await?;
    assert_eq!(claimed[0].id, pending.id);
    assert_eq!(claimed[0].payload["afterUserId"], 0);
    assert!(queue.defer(&claimed[0]).await?);
    for delay in [300, 550, 1_050, 2_050] {
        tokio::time::sleep(Duration::from_millis(delay)).await;
        let claimed = queue.claim(JobLane::Bulk, 1).await?;
        assert_eq!(claimed[0].id, pending.id);
        assert_eq!(claimed[0].attempts, 1);
        if delay == 2_050 {
            assert!(queue.finish(&claimed[0], None).await?);
        } else {
            assert!(queue.defer(&claimed[0]).await?);
        }
    }
    let mut connection = partition.connection().await?;
    let archived: CountRow =
        sql_query("SELECT count(*)::bigint AS count FROM pgmq.a_zeepcentraal_bulk")
            .get_result(&mut connection)
            .await?;
    assert_eq!(archived.count, 0);
    Ok(())
}
