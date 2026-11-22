use anyhow::{Result, bail, ensure};
use async_trait::async_trait;
use diesel::{QueryableByName, sql_query, sql_types::BigInt};
use diesel_async::{RunQueryDsl, SimpleAsyncConnection};
use serde_json::json;
use std::{sync::Arc, time::Duration};
use zc_core::object_storage::{DownloadConstraints, ObjectStorage};
use zc_database::Database;
use zc_jobs::{
    TaskIdentifier,
    handlers::ServiceJobHandler,
    queue::{ClaimedJob, JobLane, Queue},
    runtime::{JobHandler, JobOutcome},
};

const COUNT_JOB: &str = include_str!("fixtures/eligibility_player_pages/count_job.sql");
const COUNT_JOB_BY_TASK_FAN_OUT_RECORD_ELIGIBILITY: &str = include_str!(
    "fixtures/eligibility_player_pages/count_job_by_task_fan_out_record_eligibility.sql"
);

struct NoStorage;
#[async_trait]
impl ObjectStorage for NoStorage {
    async fn upload(&self, _: &str, _: Vec<u8>, _: &str) -> Result<()> {
        bail!("No storage during scoring")
    }
    async fn download(&self, _: &str, _: DownloadConstraints<'_>) -> Result<Vec<u8>> {
        bail!("No storage during scoring")
    }
    async fn delete(&self, _: &str) -> Result<()> {
        bail!("No storage during scoring")
    }
}
#[derive(QueryableByName)]
struct Count {
    #[diesel(sql_type=BigInt)]
    count: i64,
}
async fn count(database: &Database, query: &str) -> Result<i64> {
    Ok(sql_query(query)
        .get_result::<Count>(&mut database.pool_partition().connection().await?)
        .await?
        .count)
}
async fn parent(queue: &Queue) -> Result<ClaimedJob> {
    loop {
        let jobs = queue.claim(JobLane::Bulk, 15).await?;
        ensure!(!jobs.is_empty(), "missing fan-out continuation");
        let mut parent = None;
        for job in jobs {
            if job.task == TaskIdentifier::FanOutRecordEligibility.as_str() {
                parent = Some(job);
            } else {
                ensure!(queue.finish(&job, None).await?);
            }
        }
        if let Some(job) = parent {
            return Ok(job);
        }
    }
}

#[tokio::test]
#[ignore = "requires isolated local eligibility_player_pages_test with scoring schema and pgmq"]
async fn player_pages_are_atomic_fenced_and_resumable() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/eligibility_player_pages_test",
        "Dedicated local fixture required"
    );
    let database = Database::connect(&url, 4).await?;
    database
        .pool_partition()
        .connection()
        .await?
        .batch_execute(include_str!(
            "fixtures/eligibility_player_pages/truncate_job.sql"
        ))
        .await?;
    let queue = Queue::connect(database.pool_partition()).await?;
    let storage: Arc<dyn ObjectStorage> = Arc::new(NoStorage);
    let handler = ServiceJobHandler::new(
        database.clone(),
        queue.clone(),
        Arc::new(zc_workshop::metadata::SteamWebApiMetadata::new(
            "test", "1440670",
        )?),
        Arc::new(zc_workshop::steamcmd::SteamCmdDownloader::new(
            "1440670",
            "unused-test-executable",
        )),
        Arc::new(zc_workshop::persistence::DatabaseWorkshopPersistence::new(
            database.clone(),
            storage.clone(),
            "test",
        )?),
        storage,
    );
    queue
        .enqueue(
            TaskIdentifier::FanOutRecordEligibility,
            json!({"operationId":"12345","userIds":(1..=250).collect::<Vec<_>>(),"afterUserId":0}),
            JobLane::Bulk,
            None,
        )
        .await?;
    let first = parent(&queue).await?;
    assert!(queue.has_pending_score_projections().await?);
    assert!(queue.eligibility_pipeline_pending().await?);
    let mut stale = first.clone();
    stale.generation = "999999".into();
    assert!(matches!(
        handler.handle_claimed(&stale, JobLane::Bulk).await?,
        JobOutcome::Completed
    ));
    assert_eq!(count(&database, COUNT_JOB).await?, 1);
    database
        .pool_partition()
        .connection()
        .await?
        .batch_execute(
            &include_str!("fixtures/eligibility_player_pages/expire_job_lease.sql")
                .replace("{{job_id}}", &first.id.parse::<i64>()?.to_string()),
        )
        .await?;
    handler.handle_claimed(&first, JobLane::Bulk).await?;
    assert_eq!(count(&database, COUNT_JOB).await?, 1);
    database
        .pool_partition()
        .connection()
        .await?
        .batch_execute(
            &include_str!("fixtures/eligibility_player_pages/extend_job_lease.sql")
                .replace("{{job_id}}", &first.id.parse::<i64>()?.to_string()),
        )
        .await?;
    handler.handle_claimed(&first, JobLane::Bulk).await?;
    assert_eq!(
        count(
            &database,
            include_str!(
                "fixtures/eligibility_player_pages/count_job_by_task_update_player_score.sql"
            )
        )
        .await?,
        100
    );
    assert_eq!(
        count(&database, COUNT_JOB_BY_TASK_FAN_OUT_RECORD_ELIGIBILITY).await?,
        2
    );
    // Commit-before-ack replay must coalesce both children and continuation.
    handler.handle_claimed(&first, JobLane::Bulk).await?;
    assert_eq!(count(&database, COUNT_JOB).await?, 102);
    ensure!(queue.heartbeat(&first).await?);
    ensure!(queue.finish(&first, None).await?);
    let second = parent(&queue).await?;
    assert_eq!(second.payload["afterUserId"], 100);
    let before = count(&database, COUNT_JOB).await?;
    database
        .pool_partition()
        .connection()
        .await?
        .batch_execute(include_str!(
            "fixtures/eligibility_player_pages/create_reject_fanout_fixture.sql"
        ))
        .await?;
    assert!(
        handler
            .handle_claimed(&second, JobLane::Bulk)
            .await
            .is_err()
    );
    assert_eq!(count(&database, COUNT_JOB).await?, before);
    database
        .pool_partition()
        .connection()
        .await?
        .batch_execute(include_str!(
            "fixtures/eligibility_player_pages/drop_reject_fanout_fixture.sql"
        ))
        .await?;
    handler.handle_claimed(&second, JobLane::Bulk).await?;
    ensure!(queue.finish(&second, None).await?);
    let third = parent(&queue).await?;
    assert_eq!(third.payload["afterUserId"], 200);
    handler.handle_claimed(&third, JobLane::Bulk).await?;
    assert_eq!(
        count(
            &database,
            include_str!(
                "fixtures/eligibility_player_pages/count_job_by_task_update_player_scores.sql"
            )
        )
        .await?,
        1
    );
    assert_eq!(
        count(
            &database,
            include_str!(
                "fixtures/eligibility_player_pages/count_job_by_task_update_level_score.sql"
            )
        )
        .await?,
        0
    );
    ensure!(queue.finish(&third, None).await?);
    // Empty and exact boundary pages still publish their final sweep.
    for (operation, users) in [("12346", Vec::new()), ("12347", (1..=100).collect())] {
        queue
            .enqueue(
                TaskIdentifier::FanOutRecordEligibility,
                json!({"operationId":operation,"userIds":users,"afterUserId":0}),
                JobLane::Bulk,
                None,
            )
            .await?;
        let job = parent(&queue).await?;
        handler.handle_claimed(&job, JobLane::Bulk).await?;
        assert_eq!(
            count(&database, COUNT_JOB_BY_TASK_FAN_OUT_RECORD_ELIGIBILITY).await?,
            1
        );
        ensure!(queue.finish(&job, None).await?);
    }
    // Acknowledgements and heartbeats do not wait for application-side page discovery.
    let job = queue
        .enqueue(
            TaskIdentifier::FanOutRecordEligibility,
            json!({"operationId":"12348","userIds":[1],"afterUserId":0}),
            JobLane::Bulk,
            None,
        )
        .await?;
    assert!(!job.id.is_empty());
    let job = parent(&queue).await?;
    let started = std::time::Instant::now();
    let (heartbeat, claims) = tokio::join!(queue.heartbeat(&job), queue.claim(JobLane::Fast, 1));
    assert!(heartbeat?);
    assert!(claims?.is_empty());
    ensure!(queue.finish(&job, None).await?);
    println!(
        "Concurrent claim and heartbeat: {} ms",
        started.elapsed().as_millis()
    );
    assert!(started.elapsed() < Duration::from_secs(5));
    Ok(())
}
