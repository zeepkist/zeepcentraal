pub mod app;
pub mod auth;
pub mod browser_auth;
pub mod config;
pub mod discord_runtime_routes;
pub mod docs;
pub mod lobby;
pub mod lobby_runtime;
pub mod problem;
pub mod rate_limit;
pub mod readiness;
pub mod routes;
pub mod turnstile;

use std::sync::Arc;

pub struct AppState {
    pub config: config::ServerConfig,
    pub database: zc_database::Database,
    pub queue: zc_jobs::queue::Queue,
    pub database_readiness: readiness::DatabaseReadiness,
    pub rate_limits: rate_limit::RateLimitStore,
    pub http: reqwest::Client,
    pub object_storage: Arc<dyn zc_core::object_storage::ObjectStorage>,
    pub record_parser_slots: Arc<tokio::sync::Semaphore>,
    pub record_upload_slots: Arc<tokio::sync::Semaphore>,
    pub record_upload_bytes: Arc<tokio::sync::Semaphore>,
    pub lobby: lobby::LobbySnapshotStore,
}

pub async fn run() -> anyhow::Result<()> {
    let telemetry = zc_telemetry::initialize("server")?;
    let config = config::ServerConfig::from_env()?;
    let queue_max = zc_core::environment::var("JOBS_QUEUE_POOL_MAX")
        .unwrap_or_else(|_| "2".to_owned())
        .parse()?;
    anyhow::ensure!(queue_max > 0, "JOBS_QUEUE_POOL_MAX must be positive");
    tracing::info!(
        source = %config.runtime.database.source,
        host = %config.runtime.database.host,
        port = config.runtime.database.port,
        "Server database configured"
    );
    let pool = zc_database::DatabasePool::connect_lazy(
        &config.runtime.database.url,
        zc_database::PoolSettings::from_database_config(
            &config.runtime.database,
            "zeepcentraal-server",
        ),
        zc_database::PoolBudget {
            application: config.runtime.database.pool_max,
            queue: queue_max,
            scheduler: 0,
        },
    )?;
    let database = zc_database::Database::from_partition(pool.application());
    let queue = zc_jobs::queue::Queue::deferred(pool.queue()?);
    let database_readiness = readiness::DatabaseReadiness::default();
    let address = config.runtime.address;
    let lobby_config = config.lobby.clone();
    let object_storage = Arc::new(zc_core::object_storage::S3ObjectStorage::new(
        &config.object_storage,
    )?);
    let state = Arc::new(AppState {
        config,
        database,
        queue,
        database_readiness,
        rate_limits: rate_limit::RateLimitStore::default(),
        http: reqwest::Client::builder().build()?,
        object_storage,
        record_parser_slots: Arc::new(tokio::sync::Semaphore::new(4)),
        record_upload_slots: Arc::new(tokio::sync::Semaphore::new(2)),
        record_upload_bytes: Arc::new(tokio::sync::Semaphore::new(64 * 1024 * 1024)),
        lobby: lobby::LobbySnapshotStore::default(),
    });
    let lobby_runtime = lobby_runtime::LobbyRuntime::start(
        lobby_config,
        state.lobby.clone(),
        state.database.clone(),
    )
    .await?;
    let listener = tokio::net::TcpListener::bind(address).await?;
    let router = app::router(state.clone())?;
    let (shutdown_tx, shutdown_rx) = tokio::sync::watch::channel(false);
    let signal_tx = shutdown_tx.clone();
    let mut signal_task = tokio::spawn(async move {
        let result = shutdown_signal().await;
        let _ = signal_tx.send(true);
        result
    });
    let mut supervisor_task = tokio::spawn(readiness::supervise(
        state.database.clone(),
        state.queue.clone(),
        state.database_readiness.clone(),
        shutdown_rx.clone(),
    ));
    let mut server_task = tokio::spawn(async move {
        axum::serve(
            listener,
            router.into_make_service_with_connect_info::<std::net::SocketAddr>(),
        )
        .with_graceful_shutdown(wait_for_shutdown(shutdown_rx))
        .await
        .map_err(anyhow::Error::from)
    });
    tracing::info!(%address, "ZeepCentraal API listening");
    let mut result = tokio::select! {
        result = &mut signal_task => flatten_task(result),
        result = &mut supervisor_task => flatten_task(result),
        result = &mut server_task => flatten_task(result),
    };
    let _ = shutdown_tx.send(true);
    if !server_task.is_finished() {
        retain_first_error(&mut result, flatten_task(server_task.await));
    }
    if !supervisor_task.is_finished() {
        retain_first_error(&mut result, flatten_task(supervisor_task.await));
    }
    if !signal_task.is_finished() {
        signal_task.abort();
    }
    lobby_runtime.stop().await;
    retain_first_error(&mut result, telemetry.shutdown().await);
    result
}

fn flatten_task(result: Result<anyhow::Result<()>, tokio::task::JoinError>) -> anyhow::Result<()> {
    result
        .map_err(anyhow::Error::from)
        .and_then(|result| result)
}

fn retain_first_error(result: &mut anyhow::Result<()>, cleanup: anyhow::Result<()>) {
    if result.is_ok()
        && let Err(error) = cleanup
    {
        *result = Err(error);
    }
}

async fn wait_for_shutdown(mut shutdown: tokio::sync::watch::Receiver<bool>) {
    while !*shutdown.borrow() && shutdown.changed().await.is_ok() {}
}

async fn shutdown_signal() -> anyhow::Result<()> {
    #[cfg(unix)]
    {
        let mut term = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .map_err(anyhow::Error::from)?;
        tokio::select! {
            result = tokio::signal::ctrl_c() => result?,
            _ = term.recv() => {},
        }
        Ok(())
    }
    #[cfg(not(unix))]
    tokio::signal::ctrl_c().await.map_err(Into::into)
}
