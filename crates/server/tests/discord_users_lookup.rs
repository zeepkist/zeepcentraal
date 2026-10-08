use anyhow::{Result, bail, ensure};
use async_trait::async_trait;
use axum::{
    Router,
    body::{Body, to_bytes},
    http::{Request, StatusCode},
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

fn app(url: &str) -> Result<Router> {
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
        object_storage: Arc::new(UnusedStorage),
        record_parser_slots: Arc::new(tokio::sync::Semaphore::new(1)),
        record_upload_slots: Arc::new(tokio::sync::Semaphore::new(1)),
        record_upload_bytes: Arc::new(tokio::sync::Semaphore::new(4096)),
        lobby: zc_server::lobby::LobbySnapshotStore::default(),
    });
    state.database_readiness.set(true);
    zc_server::app::router(state)
}

async fn request(app: &Router, token: Option<&str>, body: Value) -> Result<(StatusCode, Value)> {
    let mut builder = Request::builder()
        .method("POST")
        .uri("/discord-bot/users/lookup")
        .header("Content-Type", "application/json");
    if let Some(token) = token {
        builder = builder.header("Authorization", format!("Bearer {token}"));
    }
    let response = app
        .clone()
        .oneshot(builder.body(Body::from(serde_json::to_vec(&body)?))?)
        .await?;
    let status = response.status();
    let bytes = to_bytes(response.into_body(), 64 * 1024).await?;
    let value =
        serde_json::from_slice(&bytes).unwrap_or_else(|_| json!(String::from_utf8_lossy(&bytes)));
    Ok((status, value))
}

async fn flush(app: &Router, token: Option<&str>) -> Result<(StatusCode, Value)> {
    let mut builder = Request::builder()
        .method("POST")
        .uri("/discord-bot/rank-batches/flush");
    if let Some(token) = token {
        builder = builder.header("Authorization", format!("Bearer {token}"));
    }
    let response = app.clone().oneshot(builder.body(Body::empty())?).await?;
    let status = response.status();
    let bytes = to_bytes(response.into_body(), 64 * 1024).await?;
    Ok((status, serde_json::from_slice(&bytes)?))
}

#[tokio::test]
async fn rank_batch_flush_requires_bot_token() -> Result<()> {
    let app = app("postgres://fixture:fixture@127.0.0.1:1/discord_feeds_test")?;
    for token in [None, Some("wrong-token")] {
        assert_eq!(flush(&app, token).await?.0, StatusCode::UNAUTHORIZED);
    }
    Ok(())
}

#[tokio::test]
async fn ghost_validation_admin_rejects_game_sessions_and_checks_web_roles() -> Result<()> {
    let app = app("postgres://fixture:fixture@127.0.0.1:1/admin_test")?;
    let issuer = JwtIssuer::new(
        "fake-unit-test-secret-at-least-32-bytes",
        "fixture",
        "fixture",
        Duration::from_secs(600),
        Duration::from_secs(1200),
    )?;
    // Game sessions cannot access admin routes. Both web providers require a
    // database role lookup, which fails closed when this fixture DB is offline.
    for (provider, expected) in [
        (zc_core::jwt::Provider::Gtr, StatusCode::FORBIDDEN),
        (
            zc_core::jwt::Provider::Steam,
            StatusCode::SERVICE_UNAVAILABLE,
        ),
        (
            zc_core::jwt::Provider::Discord,
            StatusCode::SERVICE_UNAVAILABLE,
        ),
    ] {
        let token = issuer
            .issue(provider, "76561198000000001", Some("123456789"))?
            .access_token;
        for path in [
            "/admin/ghost-validation",
            "/admin/ghost-validation/records/1",
            "/admin/ghost-validation/records/1/ghost",
        ] {
            let response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .uri(path)
                        .header("Authorization", format!("Bearer {token}"))
                        .body(Body::empty())?,
                )
                .await?;
            assert_eq!(response.status(), expected, "{provider:?}: {path}");
        }
    }
    let response = app
        .oneshot(
            Request::builder()
                .uri("/admin/ghost-validation")
                .header("Authorization", "Bearer forged")
                .body(Body::empty())?,
        )
        .await?;
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    Ok(())
}

#[tokio::test]
#[ignore = "requires disposable local PostgreSQL named discord_feeds_test"]
async fn rank_batch_flush_http_contract_accepts_empty_body_and_is_idempotent() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/discord_feeds_test",
        "Dedicated disposable database required"
    );
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move {
        let _ = connection.await;
    });
    client.batch_execute("CREATE SCHEMA IF NOT EXISTS zc_private; CREATE TABLE IF NOT EXISTS zc_private.discord_rank_batch_state(id smallint PRIMARY KEY,changes jsonb,window_started_at timestamptz,last_change_at timestamptz); INSERT INTO zc_private.discord_rank_batch_state VALUES(1,'[]',NULL,NULL) ON CONFLICT DO NOTHING").await?;
    let app = app(&url)?;
    for _ in 0..2 {
        assert_eq!(
            flush(&app, Some("fake-discord-api-test-token")).await?,
            (StatusCode::OK, json!({"emittedBatches":0}))
        );
    }
    Ok(())
}

#[tokio::test]
async fn lookup_requires_bot_token_and_validates_ids_before_database_access() -> Result<()> {
    let app = app("postgres://fixture:fixture@127.0.0.1:1/discord_feeds_test")?;
    for token in [None, Some("wrong-token")] {
        assert_eq!(
            request(&app, token, json!({"userIds":[1]})).await?.0,
            StatusCode::UNAUTHORIZED
        );
    }
    for ids in [vec![0], vec![-1], (1..=51).collect()] {
        assert_eq!(
            request(
                &app,
                Some("fake-discord-api-test-token"),
                json!({"userIds":ids})
            )
            .await?
            .0,
            StatusCode::BAD_REQUEST
        );
    }
    for ids in [json!([2147483648_u64]), json!([1.5]), json!(["1"])] {
        assert!(
            !request(
                &app,
                Some("fake-discord-api-test-token"),
                json!({"userIds":ids})
            )
            .await?
            .0
            .is_success()
        );
    }
    Ok(())
}

#[tokio::test]
#[ignore = "requires disposable local PostgreSQL named discord_feeds_test"]
async fn lookup_http_contract_returns_only_requested_users_and_nullable_points() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/discord_feeds_test",
        "Dedicated disposable database required"
    );
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move {
        let _ = connection.await;
    });
    client.batch_execute(r#"
        CREATE TABLE IF NOT EXISTS public."user" (id integer PRIMARY KEY, steam_id bigint, steam_name varchar(255), discord_id bigint);
        CREATE TABLE IF NOT EXISTS public.user_points (id_user integer PRIMARY KEY, points integer);
        INSERT INTO public."user"(id,steam_name,discord_id) VALUES
            (9001,'Fixture player',123456789012345678),(9002,NULL,NULL)
            ON CONFLICT(id) DO UPDATE SET steam_name=excluded.steam_name,discord_id=excluded.discord_id;
        INSERT INTO public.user_points(id_user,points) VALUES(9001,123000)
            ON CONFLICT(id_user) DO UPDATE SET points=excluded.points;
    "#).await?;
    let app = app(&url)?;
    let user_ids = [vec![9002, 9001, 9001], (10_000..=10_046).collect()].concat();
    let (status, users) = request(
        &app,
        Some("fake-discord-api-test-token"),
        json!({"userIds":user_ids}),
    )
    .await?;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        users,
        json!([
            {"id":9001,"steamName":"Fixture player","discordId":"123456789012345678","points":123000},
            {"id":9002,"steamName":null,"discordId":null,"points":null}
        ])
    );
    assert_eq!(
        request(
            &app,
            Some("fake-discord-api-test-token"),
            json!({"userIds":[]})
        )
        .await?,
        (StatusCode::OK, json!([]))
    );
    Ok(())
}
