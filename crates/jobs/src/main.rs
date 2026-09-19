#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let telemetry = zc_telemetry::initialize("jobs")?;
    let config = zc_core::DatabaseConfig::from_env(2)?;
    let database = zc_database::Database::connect(&config.url, config.pool_max).await?;
    database.ping().await?;
    tracing::info!(
        fast = zc_jobs::FAST_CONCURRENCY,
        bulk = zc_jobs::BULK_CONCURRENCY,
        "Jobs runtime ready"
    );
    tokio::signal::ctrl_c().await?;
    telemetry.shutdown().await
}
