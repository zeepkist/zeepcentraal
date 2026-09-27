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
    let args: Vec<_> = std::env::args().skip(1).collect();
    let watch = args.iter().any(|arg| arg == "--watch") && !args.iter().any(|arg| arg == "--once");
    let options = zc_inspector_zeep::config::parse_options(
        &args
            .into_iter()
            .filter(|arg| arg != "--watch" && arg != "--once")
            .collect::<Vec<_>>(),
    )?;
    let config = zc_inspector_zeep::config::InspectorConfig::parse(
        &tokio::fs::read_to_string(&path).await?,
    )?;
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
    let storage_config = zc_core::config::ObjectStorageConfig::from_env()?;
    let storage = std::sync::Arc::new(zc_core::object_storage::S3ObjectStorage::new(
        &storage_config,
    )?);
    let persistence = zc_workshop::persistence::DatabaseWorkshopPersistence::new(
        database.clone(),
        storage.clone(),
        storage_config.thumbnail_folder,
    )?;
    let runtime = zc_inspector_zeep::run::InspectorRuntime {
        database: &database,
        discord: &discord,
        downloader: &downloader,
        metadata: &metadata,
        storage: storage.as_ref(),
        persistence: &persistence,
    };
    if !watch {
        return tokio::time::timeout(
            std::time::Duration::from_millis(config.run_timeout_ms),
            zc_inspector_zeep::run::run_inspector(&runtime, &config, options),
        )
        .await
        .map_err(|_| anyhow::anyhow!("Inspector run timed out"))?;
    }
    loop {
        let config = zc_inspector_zeep::config::InspectorConfig::parse(
            &tokio::fs::read_to_string(&path).await?,
        )?;
        let result = tokio::time::timeout(
            std::time::Duration::from_millis(config.run_timeout_ms),
            zc_inspector_zeep::run::run_inspector(&runtime, &config, options),
        )
        .await;
        let failed = match result {
            Ok(Ok(())) => false,
            Ok(Err(error)) => {
                tracing::warn!(%error, "Inspector scan failed; retrying");
                true
            }
            Err(_) => {
                tracing::warn!("Inspector scan timed out; retrying");
                true
            }
        };
        let delay = if failed {
            60
        } else {
            match database.next_inspector_finalize_delay().await {
                Ok(Some(seconds)) => seconds.clamp(1, 1_800),
                Ok(None) => 1_800,
                Err(error) => {
                    tracing::warn!(%error, "Inspector deadline lookup failed");
                    60
                }
            }
        };
        tokio::time::sleep(std::time::Duration::from_secs(delay as u64)).await;
    }
}
