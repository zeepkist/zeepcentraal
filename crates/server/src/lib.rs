pub mod app;
pub mod auth;
pub mod config;
pub mod discord_runtime_routes;
pub mod docs;
pub mod problem;
pub mod rate_limit;
pub mod routes;
pub mod turnstile;

use std::sync::Arc;

pub struct AppState {
    pub config: config::ServerConfig,
    pub database: zc_database::Database,
    pub queue: zc_jobs::queue::Queue,
    pub rate_limits: rate_limit::RateLimitStore,
    pub http: reqwest::Client,
    pub object_storage: Arc<dyn zc_core::object_storage::ObjectStorage>,
    pub record_parser_slots: Arc<tokio::sync::Semaphore>,
    pub record_upload_slots: Arc<tokio::sync::Semaphore>,
    pub record_upload_bytes: Arc<tokio::sync::Semaphore>,
}

pub async fn run() -> anyhow::Result<()> {
    let telemetry = zc_telemetry::initialize("server")?;
    let config = config::ServerConfig::from_env()?;
    let database = zc_database::Database::connect(
        &config.runtime.database.url,
        config.runtime.database.pool_max,
    )
    .await?;
    let queue = zc_jobs::queue::Queue::connect(
        &config.runtime.database.url,
        std::env::var("JOBS_QUEUE_POOL_MAX")
            .unwrap_or_else(|_| "2".to_owned())
            .parse()?,
    )
    .await?;
    let address = config.runtime.address;
    let object_storage = Arc::new(zc_core::object_storage::S3ObjectStorage::new(
        &config.object_storage,
    )?);
    let state = Arc::new(AppState {
        config,
        database,
        queue,
        rate_limits: rate_limit::RateLimitStore::default(),
        http: reqwest::Client::builder().build()?,
        object_storage,
        record_parser_slots: Arc::new(tokio::sync::Semaphore::new(4)),
        record_upload_slots: Arc::new(tokio::sync::Semaphore::new(2)),
        record_upload_bytes: Arc::new(tokio::sync::Semaphore::new(64 * 1024 * 1024)),
    });
    let listener = tokio::net::TcpListener::bind(address).await?;
    tracing::info!(%address, "ZeepCentraal API ready");
    axum::serve(
        listener,
        app::router(state)?.into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown())
    .await?;
    telemetry.shutdown().await
}

async fn shutdown() {
    #[cfg(unix)]
    {
        let mut term = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("signal handler");
        tokio::select! { _ = tokio::signal::ctrl_c() => {}, _ = term.recv() => {} }
    }
    #[cfg(not(unix))]
    let _ = tokio::signal::ctrl_c().await;
}
