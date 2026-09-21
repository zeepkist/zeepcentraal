#[tokio::main]
async fn main() -> anyhow::Result<()> {
    use std::sync::Arc;

    zc_core::environment::initialize()?;
    let telemetry = zc_telemetry::initialize("jobs")?;
    let config = zc_core::DatabaseConfig::from_env_with_profile(
        8,
        zc_core::config::DatabaseProfile::Worker,
    )?;
    tracing::info!(
        source = %config.source,
        host = %config.host,
        port = config.port,
        "Jobs database configured"
    );
    let queue_max = zc_core::environment::var("JOBS_QUEUE_POOL_MAX")
        .unwrap_or_else(|_| "2".to_owned())
        .parse()?;
    anyhow::ensure!(queue_max > 0, "JOBS_QUEUE_POOL_MAX must be positive");
    let (shutdown_tx, shutdown_rx) = tokio::sync::watch::channel(false);
    let signal_tx = shutdown_tx.clone();
    let mut signal_task = tokio::spawn(async move {
        let result = shutdown_signal().await;
        let _ = signal_tx.send(true);
        result
    });
    let Some(prepared) = prepare_database(&config, queue_max, shutdown_rx.clone()).await? else {
        let result = signal_task.await?;
        telemetry.shutdown().await?;
        return result;
    };
    let PreparedDatabase {
        pool,
        database,
        queue,
        scheduler_connection,
    } = prepared;
    let storage_config = zc_core::config::ObjectStorageConfig::from_env()?;
    let storage: Arc<dyn zc_core::object_storage::ObjectStorage> = Arc::new(
        zc_core::object_storage::S3ObjectStorage::new(&storage_config)?,
    );
    let app_id = zc_core::environment::var("STEAM_APP_ID").unwrap_or_else(|_| "1440670".to_owned());
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
        physical = pool.snapshot().physical_connections,
        idle = pool.snapshot().idle_connections,
        "Jobs runtime ready"
    );
    let mut scheduler = tokio::spawn(zc_jobs::cron::run(
        pool.scheduler()?,
        scheduler_connection,
        queue.clone(),
        shutdown_rx.clone(),
    ));
    let mut runtime = tokio::spawn(zc_jobs::runtime::run(queue, handler, shutdown_rx));
    let result = tokio::select! {
        signal = &mut signal_task => signal?,
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

struct PreparedDatabase {
    pool: zc_database::DatabasePool,
    database: zc_database::Database,
    queue: zc_jobs::queue::Queue,
    scheduler_connection: zc_database::PoolConnection,
}

async fn prepare_database(
    config: &zc_core::DatabaseConfig,
    queue_max: u32,
    mut shutdown: tokio::sync::watch::Receiver<bool>,
) -> anyhow::Result<Option<PreparedDatabase>> {
    let mut retry = zc_jobs::retry::RetryBackoff::new();
    loop {
        match prepare_database_once(config, queue_max).await {
            Ok(prepared) => return Ok(Some(prepared)),
            Err(error) if zc_jobs::retry::is_unavailable(&error) => {
                let decision = retry.failure();
                if decision.warn {
                    log_startup_retry(&error, decision.delay);
                }
                if zc_jobs::retry::wait_or_shutdown(decision.delay, &mut shutdown).await {
                    return Ok(None);
                }
            }
            Err(error) => return Err(error),
        }
    }
}

fn log_startup_retry(error: &anyhow::Error, delay: std::time::Duration) {
    if let Some(pool) = error
        .chain()
        .find_map(|error| error.downcast_ref::<zc_database::PoolAcquireError>())
    {
        tracing::warn!(
            retry_ms = delay.as_millis(),
            stage = ?pool.last_connection_failure,
            category = ?pool.last_failure_category,
            host = pool.endpoint_host.as_deref().unwrap_or("unknown"),
            port = pool.endpoint_port.unwrap_or(0),
            "Jobs database unavailable during startup; preparation will retry"
        );
    } else {
        tracing::warn!(
            retry_ms = delay.as_millis(),
            "Jobs database unavailable during startup; preparation will retry"
        );
    }
}

async fn prepare_database_once(
    config: &zc_core::DatabaseConfig,
    queue_max: u32,
) -> anyhow::Result<PreparedDatabase> {
    let pool = zc_database::DatabasePool::connect(
        &config.url,
        zc_database::PoolSettings::from_database_config(config, "zeepcentraal-jobs"),
        zc_database::PoolBudget {
            application: config.pool_max,
            queue: queue_max,
            scheduler: 1,
        },
    )
    .await?;
    let database = zc_database::Database::from_partition(pool.application());
    database.ping().await?;
    let queue_partition = pool.queue()?;
    let queue = zc_jobs::queue::Queue::connect(queue_partition.clone()).await?;
    let scheduler_connection = pool.scheduler()?.connection().await?;
    queue_partition.warm(queue_partition.limit().min(2)).await?;
    Ok(PreparedDatabase {
        pool,
        database,
        queue,
        scheduler_connection,
    })
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
