use anyhow::{Context, Result};
use std::time::Duration;
use zc_database::{DatabasePool, PoolBudget, PoolSettings};

#[tokio::test]
#[ignore = "requires development PostgreSQL with pgmq 1.12.0 and zc_jobs schema"]
async fn queue_verification_reuses_shared_warm_pool() -> Result<()> {
    zc_core::environment::initialize()?;
    let mut url = url::Url::parse(
        &zc_core::environment::var("ZC_TEST_DATABASE_URL")
            .or_else(|_| zc_core::environment::var("DATABASE_URL"))
            .context("ZC_TEST_DATABASE_URL or DATABASE_URL is required")?,
    )?;
    if let Ok(host) = zc_core::environment::var("ZC_TEST_DATABASE_HOST") {
        url.set_host(Some(&host))
            .map_err(|_| anyhow::anyhow!("ZC_TEST_DATABASE_HOST is invalid"))?;
    }
    let pool = DatabasePool::connect(
        url.as_str(),
        PoolSettings {
            application_name: "zeepcentraal-queue-test".to_owned(),
            acquire_timeout: Duration::from_secs(5),
            statement_timeout: Duration::from_secs(15),
            lock_timeout: Duration::from_secs(3),
            idle_transaction_timeout: Duration::from_secs(30),
            idle_timeout: Duration::from_secs(30),
        },
        PoolBudget {
            application: 1,
            queue: 1,
            scheduler: 0,
        },
    )
    .await?;
    assert_eq!(pool.snapshot().physical_connections, 1);
    let _queue = zc_jobs::queue::Queue::connect(pool.queue()?).await?;
    assert_eq!(pool.snapshot().physical_connections, 1);
    assert_eq!(pool.snapshot().idle_connections, 1);
    Ok(())
}
