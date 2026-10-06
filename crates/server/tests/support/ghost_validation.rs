use anyhow::Result;
use std::{path::PathBuf, sync::Arc, time::Duration};
use zc_core::{
    config::{DatabaseConfig, DatabaseProfile, Environment, ObjectStorageConfig, RuntimeConfig},
    jwt::JwtIssuer,
    object_storage::ObjectStorage,
};
use zc_database::{Database, DatabasePool, PoolBudget, PoolSettings};
use zc_server::{
    AppState,
    config::{LobbyRuntimeConfig, RateLimits, ServerConfig},
};

pub fn state(url: &str, storage: Arc<dyn ObjectStorage>, enforce: bool) -> Result<Arc<AppState>> {
    let database_config = DatabaseConfig {
        url: url.into(),
        source: zc_core::environment::VariableSource::Process,
        host: "127.0.0.1".into(),
        port: 5432,
        pool_max: 2,
        timeouts: DatabaseProfile::Interactive.defaults(),
    };
    let pool = DatabasePool::connect_lazy(
        url,
        PoolSettings::from_database_config(&database_config, "discord-users-http-test"),
        PoolBudget {
            application: 1,
            queue: 1,
            scheduler: 0,
        },
    )?;
    let state = Arc::new(AppState {
        config: ServerConfig {
            validation_manifest: None,
            validation_enforce: enforce,
            runtime: RuntimeConfig {
                environment: Environment::Test,
                address: "127.0.0.1:0".parse()?,
                database: database_config,
            },
            object_storage: ObjectStorageConfig {
                access_key: "fake".into(),
                secret_key: "fake".into(),
                bucket: "fake".into(),
                endpoint: "https://example.com".into(),
                region: "test".into(),
                ghost_folder: "ghosts".into(),
                thumbnail_folder: "thumbnails".into(),
            },
            jwt: JwtIssuer::new(
                "fake-unit-test-secret-at-least-32-bytes",
                "fixture",
                "fixture",
                Duration::from_secs(600),
                Duration::from_secs(1200),
            )?,
            steam: None,
            trigger_job_token: "fake".into(),
            kofi_verification_token: None,
            discord_bot_api_token: "fake-discord-api-test-token".into(),
            discord_client_id: None,
            discord_client_secret: None,
            discord_redirect_uri: None,
            body_limit: 4096,
            cors_origins: vec!["http://localhost:4000".into()],
            frontend_url: "http://localhost:4000".into(),
            backend_url: "http://localhost:3000".into(),
            trust_proxy: false,
            rate_limits: RateLimits {
                auth: 100,
                record: 100,
                mutation: 100,
                job: 100,
            },
            turnstile_secret: "fake".into(),
            turnstile_hostnames: vec!["example.com".into()],
            lobby: LobbyRuntimeConfig {
                enabled: false,
                app_id: 1440670,
                master: None,
                build: None,
                refresh_token_file: PathBuf::new(),
                broker: None,
            },
        },
        database: Database::from_partition(pool.application()),
        queue: zc_jobs::queue::Queue::deferred(pool.queue()?),
        database_readiness: zc_server::readiness::DatabaseReadiness::default(),
        rate_limits: zc_server::rate_limit::RateLimitStore::default(),
        http: reqwest::Client::new(),
        object_storage: storage,
        record_parser_slots: Arc::new(tokio::sync::Semaphore::new(1)),
        record_upload_slots: Arc::new(tokio::sync::Semaphore::new(1)),
        record_upload_bytes: Arc::new(tokio::sync::Semaphore::new(2 * 1024 * 1024)),
        lobby: zc_server::lobby::LobbySnapshotStore::default(),
    });
    state.database_readiness.set(true);
    Ok(state)
}
