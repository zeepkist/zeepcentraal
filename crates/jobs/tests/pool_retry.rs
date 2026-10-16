use anyhow::{Context, Result, ensure};
use async_trait::async_trait;
use diesel::{QueryableByName, sql_query, sql_types::BigInt};
use diesel_async::RunQueryDsl;
use serde_json::{Value, json};
use std::{sync::Arc, time::Duration};
use tokio::sync::watch;
use zc_database::{Database, DatabasePool, PoolBudget, PoolSettings};
use zc_jobs::{
    TaskIdentifier,
    queue::{JobLane, Queue},
    runtime::{JobHandler, JobOutcome, run},
};

struct ProbeHandler {
    database: Database,
    shutdown: watch::Sender<bool>,
    query_error: bool,
}

#[async_trait]
impl JobHandler for ProbeHandler {
    async fn handle(&self, _: TaskIdentifier, _: Value, _: JobLane, _: i32) -> Result<JobOutcome> {
        let result = if self.query_error {
            Err(diesel::result::Error::NotFound.into())
        } else {
            self.database.ping().await.context("reconciliation probe")
        };
        self.shutdown.send(true)?;
        result?;
        Ok(JobOutcome::Completed)
    }
}

async fn run_probe(queue: &Queue, database: &Database, query_error: bool) -> Result<()> {
    let (shutdown, receiver) = watch::channel(false);
    tokio::time::timeout(
        Duration::from_secs(5),
        run(
            queue.clone(),
            Arc::new(ProbeHandler {
                database: database.clone(),
                shutdown,
                query_error,
            }),
            receiver,
        ),
    )
    .await??;
    Ok(())
}

#[derive(QueryableByName)]
struct Count {
    #[diesel(sql_type = BigInt)]
    count: i64,
}

async fn count(queue_pool: &zc_database::PoolPartition, query: &str) -> Result<i64> {
    Ok(sql_query(query)
        .get_result::<Count>(&mut queue_pool.connection().await?)
        .await?
        .count)
}

#[tokio::test]
#[ignore = "requires empty isolated job_pool_retry_test database with pgmq 1.12.0"]
async fn pool_timeout_preserves_final_attempt_and_query_errors_still_fail() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/job_pool_retry_test",
        "Dedicated isolated database required"
    );
    let pool = DatabasePool::connect(
        &url,
        PoolSettings {
            application_name: "zeepcentraal-pool-retry-test".to_owned(),
            acquire_timeout: Duration::from_millis(100),
            statement_timeout: Duration::from_secs(5),
            lock_timeout: Duration::from_secs(1),
            idle_transaction_timeout: Duration::from_secs(5),
            idle_timeout: Duration::from_secs(30),
        },
        PoolBudget {
            application: 1,
            queue: 2,
            scheduler: 0,
        },
    )
    .await?;
    let queue_pool = pool.queue()?;
    let queue = Queue::connect(queue_pool.clone()).await?;
    let database = Database::from_partition(pool.application());
    ensure!(
        count(
            &queue_pool,
            "SELECT count(*)::bigint AS count FROM zc_jobs.job"
        )
        .await?
            == 0,
        "Test requires empty queue"
    );
    let archived_failures = count(&queue_pool, "SELECT count(*)::bigint AS count FROM pgmq.a_zeepcentraal_bulk WHERE message->>'failure'='attempts_exhausted'").await?;
    for query_error in [false, true] {
        queue
            .enqueue(
                TaskIdentifier::ReconcileRecordEligibility,
                json!({"idLevel":86176}),
                JobLane::Bulk,
                None,
            )
            .await?;
        sql_query("UPDATE zc_jobs.job SET attempts=2 WHERE task='reconcileRecordEligibility'")
            .execute(&mut queue_pool.connection().await?)
            .await?;

        let held_connection = database.pool_partition().connection().await?;
        run_probe(&queue, &database, false).await?;
        assert_eq!(count(&queue_pool, "SELECT count(*)::bigint AS count FROM zc_jobs.job WHERE task='reconcileRecordEligibility' AND attempts=2 AND generation=1 AND NOT running AND lease_until IS NULL AND payload->>'idLevel'='86176' AND payload->>'deferCount'='1'").await?, 1);
        drop(held_connection);

        // Recovery succeeds on the final allowed attempt. Real query failures retain
        // their failure budget and archive when that final attempt fails.
        run_probe(&queue, &database, query_error).await?;
        assert_eq!(
            count(
                &queue_pool,
                "SELECT count(*)::bigint AS count FROM zc_jobs.job"
            )
            .await?,
            0
        );
        assert_eq!(count(&queue_pool, "SELECT count(*)::bigint AS count FROM pgmq.a_zeepcentraal_bulk WHERE message->>'failure'='attempts_exhausted'").await?, archived_failures+i64::from(query_error));
    }
    Ok(())
}
