use anyhow::{Result, bail, ensure};
use async_trait::async_trait;
use axum::{
    Router,
    body::{Body, to_bytes},
    http::{Method, Request, StatusCode},
};
use serde_json::{Value, json};
use std::{path::PathBuf, sync::Arc, time::Duration};
use tower::ServiceExt;
use zc_core::{
    config::{DatabaseConfig, DatabaseProfile, Environment, ObjectStorageConfig, RuntimeConfig},
    jwt::JwtIssuer,
    object_storage::{DownloadConstraints, ObjectStorage},
};
use zc_database::{Database, DatabasePool, PoolBudget, PoolSettings};
use zc_server::{
    AppState,
    config::{LobbyRuntimeConfig, RateLimits, ServerConfig},
};
struct UnusedStorage;
#[async_trait]
impl ObjectStorage for UnusedStorage {
    async fn upload(&self, _: &str, _: Vec<u8>, _: &str) -> Result<()> {
        bail!("Unexpected object write")
    }
    async fn download(&self, _: &str, _: DownloadConstraints<'_>) -> Result<Vec<u8>> {
        bail!("Unexpected object read")
    }
    async fn delete(&self, _: &str) -> Result<()> {
        bail!("Unexpected object delete")
    }
}
async fn request(
    app: &Router,
    method: Method,
    path: &str,
    token: Option<&str>,
    body: Option<Value>,
) -> Result<(StatusCode, Value)> {
    let mut request = Request::builder().method(method).uri(path);
    if let Some(token) = token {
        request = request.header("Authorization", format!("Bearer {token}"));
    }
    let body = if let Some(body) = body {
        request = request.header("Content-Type", "application/json");
        Body::from(serde_json::to_vec(&body)?)
    } else {
        Body::empty()
    };
    let response = app.clone().oneshot(request.body(body)?).await?;
    let status = response.status();
    let bytes = to_bytes(response.into_body(), 1_000_000).await?;
    Ok((
        status,
        if bytes.is_empty() {
            Value::Null
        } else {
            serde_json::from_slice(&bytes)?
        },
    ))
}
#[tokio::test]
#[ignore = "requires local disposable zsl_submission_playlist_test fixture"]
async fn anonymous_submission_overview_contract() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1")
            && (parsed.path() == "/zsl_submission_playlist_test"
                || parsed
                    .path()
                    .strip_prefix("/zsl_submission_playlist_test_")
                    .is_some_and(
                        |suffix| !suffix.is_empty() && suffix.bytes().all(|c| c.is_ascii_digit())
                    )),
        "Disposable fixture required"
    );
    let database_config = DatabaseConfig {
        url: url.clone(),
        source: zc_core::environment::VariableSource::Process,
        host: "127.0.0.1".into(),
        port: 5432,
        pool_max: 3,
        timeouts: DatabaseProfile::Interactive.defaults(),
    };
    let pool = DatabasePool::connect_lazy(
        &url,
        PoolSettings::from_database_config(&database_config, "submission-http-test"),
        PoolBudget {
            application: 2,
            queue: 1,
            scheduler: 0,
        },
    )?;
    let db = Database::from_partition(pool.application());
    let jwt = JwtIssuer::new(
        "fake-unit-test-secret-at-least-32-bytes",
        "fixture",
        "fixture",
        Duration::from_secs(600),
        Duration::from_secs(1200),
    )?;
    let state = Arc::new(AppState {
        config: ServerConfig {
            validation_manifest: None,
            validation_enforce: false,
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
            jwt,
            steam: None,
            trigger_job_token: "fake".into(),
            kofi_verification_token: None,
            discord_bot_api_token: "fake".into(),
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
        database: db,
        queue: zc_jobs::queue::Queue::deferred(pool.queue()?),
        database_readiness: zc_server::readiness::DatabaseReadiness::default(),
        rate_limits: zc_server::rate_limit::RateLimitStore::default(),
        http: reqwest::Client::new(),
        object_storage: Arc::new(UnusedStorage),
        record_parser_slots: Arc::new(tokio::sync::Semaphore::new(1)),
        record_upload_slots: Arc::new(tokio::sync::Semaphore::new(1)),
        record_upload_bytes: Arc::new(tokio::sync::Semaphore::new(4096)),
        lobby: zc_server::lobby::LobbySnapshotStore::default(),
        streamkist_stats: Default::default(),
    });
    state.database_readiness.set(true);
    let app = zc_server::app::router(state)?;

    let overview = request(
        &app,
        Method::GET,
        "/super-league/submission-overview?roundId=1",
        None,
        None,
    )
    .await?;
    assert_eq!(overview.0, StatusCode::OK);
    assert_eq!(overview.1["contest"]["roundId"], 1);
    assert_eq!(overview.1["totalCount"], 4);
    assert_eq!(overview.1["validCount"], 0);
    assert!(overview.1.get("submission").is_none());
    for query in ["0", "-1", "abc", "2147483648"] {
        assert_eq!(
            request(
                &app,
                Method::GET,
                &format!("/super-league/submission-overview?roundId={query}"),
                None,
                None
            )
            .await?
            .0,
            StatusCode::BAD_REQUEST
        );
    }
    let missing = request(
        &app,
        Method::GET,
        "/super-league/submission-overview?roundId=999",
        None,
        None,
    )
    .await?;
    assert_eq!(missing.0, StatusCode::OK);
    assert!(missing.1["contest"].is_null());
    for method in [Method::POST, Method::DELETE] {
        let response = request(
            &app,
            method,
            "/super-league/submit-level?roundId=1",
            None,
            Some(json!({"roundId":1,"workshopId":"123","authors":["76561198000000001"]})),
        )
        .await?;
        assert!(
            !response.0.is_success(),
            "Submission mutations still require authentication"
        );
    }
    Ok(())
}
