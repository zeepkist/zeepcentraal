#[tokio::main]
async fn main() -> anyhow::Result<()> {
    zc_core::environment::initialize()?;
    let telemetry = zc_telemetry::initialize("streamkist")?;
    let config = zc_streamkist::config::Config::from_env()?;
    let database_config = zc_core::config::DatabaseConfig::from_env(3)?;
    let pool = zc_database::DatabasePool::connect(
        &database_config.url,
        zc_database::PoolSettings::from_database_config(
            &database_config,
            "zeepcentraal-streamkist",
        ),
        zc_database::PoolBudget::application(database_config.pool_max),
    )
    .await?;
    let database = zc_database::Database::from_partition(pool.application());
    // Fail before registering commands if Diesel migration has not run.
    database.streamkist_watches(None).await?;
    let result = zc_streamkist::runtime::run(config, database).await;
    telemetry.shutdown().await?;
    result
}
