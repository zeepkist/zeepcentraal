#[tokio::main]
async fn main() -> anyhow::Result<()> {
    use std::sync::Arc;

    let telemetry = zc_telemetry::initialize("jobs")?;
    let config = zc_core::DatabaseConfig::from_env(8)?;
    let database = zc_database::Database::connect(&config.url, config.pool_max).await?;
    database.ping().await?;
    let queue = zc_jobs::queue::Queue::connect(
        &config.url,
        std::env::var("JOBS_QUEUE_POOL_MAX")
            .unwrap_or_else(|_| "8".to_owned())
            .parse()?,
    )
    .await?;
    let storage_config = zc_core::config::ObjectStorageConfig::from_env()?;
    let storage: Arc<dyn zc_core::object_storage::ObjectStorage> = Arc::new(
        zc_core::object_storage::S3ObjectStorage::new(&storage_config)?,
    );
    let app_id = std::env::var("STEAM_APP_ID").unwrap_or_else(|_| "1440670".to_owned());
    let metadata: Arc<dyn zc_workshop::WorkshopMetadataAdapter> =
        Arc::new(zc_workshop::metadata::SteamWebApiMetadata::new(
            zc_core::config::required("STEAM_API_KEY")?,
            &app_id,
        )?);
    let downloader: Arc<dyn zc_workshop::WorkshopDownloader> =
        Arc::new(zc_workshop::steamcmd::SteamCmdDownloader::new(
            &app_id,
            zc_core::config::required("STEAMCMD_PATH")?,
        ));
    let persistence: Arc<dyn zc_workshop::WorkshopPersistence> =
        Arc::new(zc_workshop::persistence::DatabaseWorkshopPersistence::new(
            database.clone(),
            storage.clone(),
            storage_config.thumbnail_folder,
        )?);
    let handler = Arc::new(zc_jobs::handlers::ServiceJobHandler::new(
        database,
        queue.clone(),
        metadata,
        downloader,
        persistence,
        storage,
    ));
    tracing::info!(
        fast = zc_jobs::FAST_CONCURRENCY,
        bulk = zc_jobs::BULK_CONCURRENCY,
        "Jobs runtime ready"
    );
    let (shutdown_tx, shutdown_rx) = tokio::sync::watch::channel(false);
    let mut runtime = tokio::spawn(zc_jobs::runtime::run(
        queue.clone(),
        handler,
        shutdown_rx.clone(),
    ));
    let mut scheduler = tokio::spawn(zc_jobs::cron::run(config.url.clone(), queue, shutdown_rx));
    let result = tokio::select! {
        signal = shutdown_signal() => signal,
        result = &mut runtime => result?,
        result = &mut scheduler => result?,
    };
    let _ = shutdown_tx.send(true);
    if !runtime.is_finished() {
        runtime.await??;
    }
    if !scheduler.is_finished() {
        scheduler.await??;
    }
    telemetry.shutdown().await?;
    result
}

async fn shutdown_signal() -> anyhow::Result<()> {
    #[cfg(unix)]
    {
        let mut terminate =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())?;
        tokio::select! {
            result = tokio::signal::ctrl_c() => result?,
            _ = terminate.recv() => {},
        }
        Ok(())
    }
    #[cfg(not(unix))]
    tokio::signal::ctrl_c().await.map_err(Into::into)
}
