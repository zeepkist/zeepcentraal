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
    jwt::{JwtIssuer, Provider},
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
#[tokio::test(flavor = "multi_thread")]
#[ignore = "requires migrated disposable zsl_migration_test; no external network services"]
async fn first_party_http_auth_privacy_and_contract() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/zsl_migration_test",
        "Dedicated fixture DB required"
    );
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move {
        let _ = connection.await;
    });
    let round:i32=client.query_one("INSERT INTO public.zsl_round(id_season,name,round,workshop_id,event_date,submission_start,submission_end,zsl_vote_end,cosmetic_vote_end) VALUES(9000,'API fixture',3,0,now()+interval '14 days',now()-interval '1 day',now()+interval '1 day',now()+interval '8 days',now()+interval '28 days') RETURNING id",&[]).await?.get(0);
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
    db.configure_inspector_contest(round, json!({"minBlocks":0}), "rules")
        .await?;
    let jwt = JwtIssuer::new(
        "fake-unit-test-secret-at-least-32-bytes",
        "fixture",
        "fixture",
        Duration::from_secs(600),
        Duration::from_secs(1200),
    )?;
    let tokens = [
        jwt.issue(Provider::Steam, "76561198000000001", None)?
            .access_token,
        jwt.issue(Provider::Discord, "76561198000000002", Some("123"))?
            .access_token,
        jwt.issue(Provider::Steam, "76561198000000003", None)?
            .access_token,
        jwt.issue(Provider::Gtr, "76561198000000001", None)?
            .access_token,
        jwt.issue(Provider::Steam, "76561198000000099", None)?
            .access_token,
    ];
    let state = Arc::new(AppState {
        config: ServerConfig {
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
    });
    state.database_readiness.set(true);
    let app = zc_server::app::router(state)?;
    let path = format!("/super-league/submit-level?roundId={round}");
    let unauth = request(&app, Method::GET, &path, None, None).await?;
    assert_eq!(unauth.0, StatusCode::BAD_REQUEST);
    assert_eq!(unauth.1["errorCode"], 14);
    assert_eq!(
        request(&app, Method::GET, &path, Some(&tokens[3]), None)
            .await?
            .0,
        StatusCode::UNAUTHORIZED
    );
    let public = request(
        &app,
        Method::GET,
        &format!("/super-league/contests?roundId={round}"),
        None,
        None,
    )
    .await?;
    assert_eq!(public.0, StatusCode::OK);
    assert_eq!(public.1[0]["submissionsOpen"], true);
    assert!(public.1[0].get("authors").is_none());
    assert!(public.1[0].get("submission").is_none());
    assert!(public.1[0].get("votes").is_none());
    let new_author = 76561198000000888_i64;
    assert!(
        client
            .query_opt(
                "SELECT id FROM public.\"user\" WHERE steam_id=$1",
                &[&new_author]
            )
            .await?
            .is_none()
    );
    let body = json!({"roundId":round,"workshopId":"3810000002","authors":["76561198000000001","76561198000000002",new_author.to_string()]});
    let created = request(
        &app,
        Method::POST,
        "/super-league/submit-level",
        Some(&tokens[0]),
        Some(body.clone()),
    )
    .await?;
    assert_eq!(created.0, StatusCode::ACCEPTED);
    let placeholder = client
        .query_one(
            "SELECT steam_name,banned FROM public.\"user\" WHERE steam_id=$1",
            &[&new_author],
        )
        .await?;
    assert!(placeholder.get::<_, Option<String>>(0).is_none());
    assert!(!placeholder.get::<_, bool>(1));
    let id = created.1.as_i64().unwrap();
    assert_eq!(
        request(&app, Method::GET, &path, Some(&tokens[1]), None)
            .await?
            .1["submission"]["id"],
        id
    );
    let status = format!("/super-league/submission-status/{id}");
    assert_eq!(
        request(&app, Method::GET, &status, Some(&tokens[2]), None)
            .await?
            .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        request(&app, Method::GET, &status, Some(&tokens[0]), None)
            .await?
            .1["status"],
        "queued"
    );
    assert_eq!(
        request(
            &app,
            Method::POST,
            "/super-league/submit-level",
            Some(&tokens[1]),
            Some(body)
        )
        .await?
        .1,
        id
    );
    let invalid = json!({"roundId":round,"workshopId":"https://steamcommunity.com/sharedfiles/filedetails/?id=3810000002","authors":["76561198000000001"]});
    assert_eq!(
        request(
            &app,
            Method::POST,
            "/super-league/submit-level",
            Some(&tokens[0]),
            Some(invalid)
        )
        .await?
        .0,
        StatusCode::BAD_REQUEST
    );
    assert_eq!(
        request(&app, Method::DELETE, &path, Some(&tokens[1]), None).await?,
        (StatusCode::NO_CONTENT, Value::Null)
    );
    assert_eq!(
        request(&app, Method::GET, &path, Some(&tokens[0]), None)
            .await?
            .1["submission"]["status"],
        "withdrawn"
    );
    // Existing frozen ballot GET works and never includes other voters' identities.
    let vote = request(
        &app,
        Method::GET,
        "/super-league/vote?roundId=9000",
        Some(&tokens[4]),
        None,
    )
    .await?;
    assert_eq!(vote.0, StatusCode::OK);
    assert_eq!(vote.1["votes"][0], json!([9000]));
    assert!(vote.1.get("userId").is_none());
    let rejected = request(
        &app,
        Method::POST,
        "/super-league/vote",
        Some(&tokens[4]),
        Some(json!({"roundId":9000,"voteType":1,"levelIds":[9000],"turnstileToken":""})),
    )
    .await?;
    assert_eq!(rejected.0, StatusCode::BAD_REQUEST);
    client
        .execute(
            "UPDATE public.zsl_round SET submission_end=now()-interval '1 second' WHERE id=$1",
            &[&round],
        )
        .await?;
    assert_eq!(
        request(&app, Method::DELETE, &path, Some(&tokens[1]), None)
            .await?
            .0,
        StatusCode::BAD_REQUEST
    );
    Ok(())
}
