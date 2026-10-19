use anyhow::{Result, bail, ensure};
use async_trait::async_trait;
use diesel::{QueryableByName, sql_query, sql_types::Bool};
use diesel_async::RunQueryDsl;
use std::{sync::Arc, time::Duration};
use tokio::sync::watch;
use zc_core::object_storage::{DownloadConstraints, ObjectStorage};
use zc_database::{Database, DatabasePool, PoolBudget, PoolSettings};
use zc_jobs::{
    TaskIdentifier,
    handlers::ServiceJobHandler,
    queue::{JobLane, Queue},
    runtime::{JobHandler, JobOutcome},
};

static TEST_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

struct NoStorage;
#[async_trait]
impl ObjectStorage for NoStorage {
    async fn upload(&self, _: &str, _: Vec<u8>, _: &str) -> Result<()> {
        bail!("No storage during metrics test")
    }
    async fn download(&self, _: &str, _: DownloadConstraints<'_>) -> Result<Vec<u8>> {
        bail!("No storage during metrics test")
    }
    async fn delete(&self, _: &str) -> Result<()> {
        bail!("No storage during metrics test")
    }
}
#[derive(QueryableByName)]
struct Check {
    #[diesel(sql_type=Bool)]
    valid: bool,
}

async fn refresh(queue: &Queue, handler: &ServiceJobHandler) -> Result<()> {
    tokio::time::timeout(Duration::from_secs(40), async {
        loop {
            let jobs = queue.claim(JobLane::Fast, 1).await?;
            if let Some(job) = jobs.as_slice().first() {
                ensure!(
                    job.task == TaskIdentifier::RefreshGlobalMetrics.as_str(),
                    "Dedicated test requires empty fast queue"
                );
                assert_eq!(
                    handler.handle_claimed(job, JobLane::Fast).await?,
                    JobOutcome::Completed
                );
                ensure!(
                    queue.finish(job, None).await?,
                    "Metrics job completion failed"
                );
                return Ok::<_, anyhow::Error>(());
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    })
    .await??;
    Ok(())
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
#[ignore = "requires dedicated loopback zc_optimization_test with current migrations and empty fast queue"]
async fn scheduler_startup_and_next_slot_publish_statistics_through_real_handler() -> Result<()> {
    let _guard = TEST_LOCK.lock().await;
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/zc_optimization_test",
        "Dedicated fixture required"
    );
    let pool = DatabasePool::connect(
        &url,
        PoolSettings {
            application_name: "zeepcentraal-metrics-test".into(),
            acquire_timeout: Duration::from_secs(5),
            statement_timeout: Duration::from_secs(15),
            lock_timeout: Duration::from_secs(3),
            idle_transaction_timeout: Duration::from_secs(30),
            idle_timeout: Duration::from_secs(30),
        },
        PoolBudget {
            application: 1,
            queue: 2,
            scheduler: 1,
        },
    )
    .await?;
    let database = Database::from_partition(pool.application());
    let queue = Queue::connect(pool.queue()?).await?;
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
            database,
            storage.clone(),
            "test",
        )?),
        storage,
    );
    let (shutdown, receiver) = watch::channel(false);
    let scheduler_partition = pool.scheduler()?;
    let scheduler_connection = scheduler_partition.connection().await?;
    {
        let mut connection = pool.application().connection().await?;
        sql_query("UPDATE public.statistics SET records=-7,as_of='2000-01-01Z'")
            .execute(&mut connection)
            .await?;
    }
    let scheduler = tokio::spawn(zc_jobs::cron::run(
        scheduler_partition,
        scheduler_connection,
        queue.clone(),
        receiver,
    ));
    let result = async {
        for _ in 0..2 {
            refresh(&queue,&handler).await?;
            let mut connection = pool.application().connection().await?;
            let check: Check = sql_query("SELECT count(*)=1 AND bool_and(records=(SELECT count(*) FROM public.record WHERE record_eligible) AND as_of>statement_timestamp()-interval '10 seconds') AS valid FROM public.statistics")
                .get_result(&mut connection).await?;
            ensure!(check.valid,"Scheduled refresh did not publish exact statistics");
            sql_query("UPDATE public.statistics SET records=-8,as_of='2000-01-01Z'").execute(&mut connection).await?;
        }
        Ok::<_,anyhow::Error>(())
    }.await;
    let _ = shutdown.send(true);
    scheduler.await??;
    result?;
    // Leave a valid snapshot for later fixture checks.
    handler
        .handle(
            TaskIdentifier::RefreshGlobalMetrics,
            serde_json::json!({}),
            JobLane::Fast,
            1,
        )
        .await?;
    Ok(())
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
#[ignore = "requires dedicated loopback zc_optimization_test without another scheduler"]
async fn scheduler_releases_leadership_when_queue_checkout_times_out() -> Result<()> {
    let _guard = TEST_LOCK.lock().await;
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/zc_optimization_test",
        "Dedicated fixture required"
    );
    let pool = DatabasePool::connect(
        &url,
        PoolSettings {
            application_name: "zeepcentraal-scheduler-retry-test".into(),
            acquire_timeout: Duration::from_millis(200),
            statement_timeout: Duration::from_secs(5),
            lock_timeout: Duration::from_secs(1),
            idle_transaction_timeout: Duration::from_secs(10),
            idle_timeout: Duration::from_secs(30),
        },
        PoolBudget {
            application: 1,
            queue: 1,
            scheduler: 1,
        },
    )
    .await?;
    let queue_partition = pool.queue()?;
    let queue = Queue::connect(queue_partition.clone()).await?;
    let held_queue = queue_partition.connection().await?;
    let scheduler_partition = pool.scheduler()?;
    let scheduler_connection = scheduler_partition.connection().await?;
    let mut observer = pool.application().connection().await?;
    let (shutdown, receiver) = watch::channel(false);
    let scheduler = tokio::spawn(zc_jobs::cron::run(
        scheduler_partition,
        scheduler_connection,
        queue,
        receiver,
    ));
    let result = tokio::time::timeout(Duration::from_secs(5), async {
        for expected in [true, false] {
            loop {
                let check: Check = sql_query("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND classid=1861284951 AND objid=0 AND granted) AS valid")
                    .get_result(&mut observer).await?;
                if check.valid == expected {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        }
        Ok::<_, anyhow::Error>(())
    })
    .await;
    let _ = shutdown.send(true);
    drop(held_queue);
    scheduler.await??;
    result??;
    Ok(())
}
