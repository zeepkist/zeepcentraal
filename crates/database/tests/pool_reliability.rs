use anyhow::{Context, Result};
use diesel::{
    QueryableByName, sql_query,
    sql_types::{Bool, Text},
};
use diesel_async::RunQueryDsl;
use std::time::Duration;
use zc_database::{DatabasePool, PoolBudget, PoolSettings};

#[derive(QueryableByName)]
struct SessionSettings {
    #[diesel(sql_type = Text)]
    application_name: String,
    #[diesel(sql_type = Text)]
    statement_timeout: String,
    #[diesel(sql_type = Text)]
    lock_timeout: String,
    #[diesel(sql_type = Text)]
    idle_transaction_timeout: String,
}

#[derive(QueryableByName)]
struct LockResult {
    #[diesel(sql_type = Bool)]
    acquired: bool,
}

fn settings() -> PoolSettings {
    PoolSettings {
        application_name: "zeepcentraal-pool-test".to_owned(),
        acquire_timeout: Duration::from_millis(250),
        statement_timeout: Duration::from_secs(15),
        lock_timeout: Duration::from_secs(3),
        idle_transaction_timeout: Duration::from_secs(30),
        idle_timeout: Duration::from_secs(30),
    }
}

#[tokio::test]
#[ignore = "requires development PostgreSQL and waits through idle timeout"]
async fn warm_pool_and_reserved_partition_survive_idle() -> Result<()> {
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
        settings(),
        PoolBudget {
            application: 1,
            queue: 1,
            scheduler: 1,
        },
    )
    .await?;
    assert_eq!(pool.physical_limit(), 3);
    tokio::time::sleep(Duration::from_secs(31)).await;

    let application = pool.application();
    let mut held_application = application.connection().await?;
    let unavailable_application = match application.connection().await {
        Ok(_) => anyhow::bail!("application partition exceeded its limit"),
        Err(error) => error,
    };
    assert_eq!(
        unavailable_application
            .downcast_ref::<zc_database::PoolAcquireError>()
            .context("expected PoolAcquireError")?
            .role,
        "application"
    );
    let mut queue = pool.queue()?.connection().await?;
    sql_query("SELECT 1").execute(&mut queue).await?;

    let session: SessionSettings = sql_query(
        "SELECT current_setting('application_name') AS application_name, \
         current_setting('statement_timeout') AS statement_timeout, \
         current_setting('lock_timeout') AS lock_timeout, \
         current_setting('idle_in_transaction_session_timeout') AS idle_transaction_timeout",
    )
    .get_result(&mut held_application)
    .await?;
    assert_eq!(session.application_name, "zeepcentraal-pool-test");
    assert_eq!(session.statement_timeout, "15s");
    assert_eq!(session.lock_timeout, "3s");
    assert_eq!(session.idle_transaction_timeout, "30s");
    assert!(pool.snapshot().physical_connections >= 1);

    let mut scheduler = pool.scheduler()?.connection().await?;
    sql_query("SELECT pg_advisory_lock(1861284951, 32767)")
        .execute(&mut scheduler)
        .await?;
    sql_query("SELECT 1").execute(&mut scheduler).await?;
    let contested: LockResult =
        sql_query("SELECT pg_try_advisory_lock(1861284951, 32767) AS acquired")
            .get_result(&mut queue)
            .await?;
    assert!(!contested.acquired);
    sql_query("SELECT pg_advisory_unlock(1861284951, 32767)")
        .execute(&mut scheduler)
        .await?;
    Ok(())
}
