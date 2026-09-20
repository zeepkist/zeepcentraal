#[tokio::main]
async fn main() -> anyhow::Result<()> {
    zc_core::environment::initialize()?;
    let telemetry = zc_telemetry::initialize("inspector-zeep")?;
    let result = run().await;
    let shutdown = telemetry.shutdown().await;
    result?;
    shutdown
}

async fn run() -> anyhow::Result<()> {
    let path = zc_core::environment::var("INSPECTOR_CONFIG_FILE")
        .or_else(|_| zc_core::environment::var("INSPECTOR_ZEEP_CONFIG_FILE"))?;
    let config =
        zc_inspector_zeep::config::InspectorConfig::parse(&tokio::fs::read_to_string(path).await?)?;
    let options =
        zc_inspector_zeep::config::parse_options(&std::env::args().skip(1).collect::<Vec<_>>())?;
    let database_config = zc_core::DatabaseConfig::from_env_with_profile(
        2,
        zc_core::config::DatabaseProfile::Worker,
    )?;
    anyhow::ensure!(
        database_config.pool_max >= 2,
        "Inspector requires DATABASE_POOL_MAX of at least 2"
    );
    let pool = zc_database::DatabasePool::connect(
        &database_config.url,
        zc_database::PoolSettings::from_database_config(
            &database_config,
            "zeepcentraal-inspector-zeep",
        ),
        zc_database::PoolBudget::application(database_config.pool_max),
    )
    .await?;
    let database = zc_database::Database::from_partition(pool.application());
    let discord = zc_inspector_zeep::discord::DiscordRest::new(zc_core::config::required(
        "INSPECTOR_DISCORD_TOKEN",
    )?)?;
    let app_id = zc_core::config::required("STEAM_APP_ID")?;
    let metadata = zc_workshop::metadata::SteamWebApiMetadata::new(
        zc_core::config::required("STEAM_API_KEY")?,
        &app_id,
    )?;
    let downloader = zc_workshop::steamcmd::SteamCmdDownloader::new(
        app_id,
        zc_core::config::required("STEAMCMD_PATH")?,
    );
    let storage = zc_core::object_storage::S3ObjectStorage::new(
        &zc_core::config::ObjectStorageConfig::from_env()?,
    )?;
    let runtime = zc_inspector_zeep::run::InspectorRuntime {
        database: &database,
        discord: &discord,
        downloader: &downloader,
        metadata: &metadata,
        storage: &storage,
    };
    tokio::time::timeout(
        std::time::Duration::from_millis(config.run_timeout_ms),
        zc_inspector_zeep::run::run_inspector(&runtime, &config, options),
    )
    .await
    .map_err(|_| anyhow::anyhow!("Inspector run timed out"))?
}
