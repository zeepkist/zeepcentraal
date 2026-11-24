#[path = "support/ghost_validation.rs"]
mod support;

use anyhow::{Result, bail, ensure};
use async_trait::async_trait;
use axum::{
    Router,
    body::{Body, to_bytes},
    http::{Request, StatusCode, header},
};
use serde_json::{Value, json};
use std::sync::Arc;
use tower::ServiceExt;
use zc_core::{
    jwt::Provider,
    object_storage::{DownloadConstraints, ObjectStorage},
};

struct NoStorage;
#[async_trait]
impl ObjectStorage for NoStorage {
    async fn upload(&self, _: &str, _: Vec<u8>, _: &str) -> Result<()> {
        bail!("Unexpected upload")
    }
    async fn download(&self, _: &str, _: DownloadConstraints<'_>) -> Result<Vec<u8>> {
        bail!("Unexpected download")
    }
    async fn delete(&self, _: &str) -> Result<()> {
        bail!("Unexpected deletion")
    }
}

async fn request(
    app: &Router,
    path: &str,
    token: &str,
    body: Option<Value>,
) -> Result<(StatusCode, Value)> {
    let request = Request::builder()
        .uri(path)
        .method(if body.is_some() { "POST" } else { "GET" })
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(body.map_or_else(Body::empty, |body| Body::from(body.to_string())))?;
    let response = app.clone().oneshot(request).await?;
    let status = response.status();
    let bytes = to_bytes(response.into_body(), 1024 * 1024).await?;
    Ok((status, serde_json::from_slice(&bytes)?))
}

#[tokio::test]
#[ignore = "requires an empty local PostgreSQL database named zsl_admin_http_test"]
async fn routes_require_current_admin_and_expose_validation() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/zsl_admin_http_test");
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    let connection = tokio::spawn(connection);
    for sql in [
        include_str!("../../database/tests/fixtures/zsl_tournament.sql"),
        include_str!("../../database/tests/fixtures/zsl_admin.sql"),
        include_str!("../../database/migrations/20261010120000_zsl_tournament/up.sql"),
        include_str!("../../database/migrations/20261122001000_zsl_admin/up.sql"),
        include_str!("../../database/migrations/20261122002000_zsl_practice_upload/up.sql"),
        include_str!("fixtures/zsl_admin_users.sql"),
    ] {
        client.batch_execute(sql).await?;
    }

    let state = support::state(&url, Arc::new(NoStorage), false)?;
    let token = |provider, steam| {
        state
            .config
            .jwt
            .issue(provider, steam, None)
            .map(|tokens| tokens.access_token)
    };
    let admin = token(Provider::Steam, "42")?;
    let player = token(Provider::Steam, "43")?;
    let banned = token(Provider::Steam, "44")?;
    let mod_token = token(Provider::Gtr, "42")?;
    let app = zc_server::app::router(state.clone())?;
    let settings = json!({"settings":{"kind":"points","name":"Defined by admin","points":[10,5],"minimumPoints":1,"bestOf":4}});
    for denied in [&player, &banned, &mod_token] {
        assert_eq!(
            request(&app, "/admin/zsl", denied, None).await?.0,
            StatusCode::FORBIDDEN
        );
        assert_eq!(
            request(&app, "/admin/zsl", denied, Some(settings.clone()))
                .await?
                .0,
            StatusCode::FORBIDDEN
        );
        assert_eq!(
            request(&app, "/admin/zsl/rounds/1/playlists", denied, None)
                .await?
                .0,
            StatusCode::FORBIDDEN
        );
        assert_eq!(
            request(
                &app,
                "/admin/zsl/rounds/1/playlists",
                denied,
                Some(json!({"action":"regenerate"}))
            )
            .await?
            .0,
            StatusCode::FORBIDDEN
        );
    }
    assert_eq!(
        request(&app, "/admin/zsl", &admin, Some(settings)).await?.0,
        StatusCode::OK
    );
    let (status, dashboard) = request(&app, "/admin/zsl", &admin, None).await?;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(dashboard["points"][0]["name"], "Defined by admin");
    let (status, error) = request(
        &app,
        "/admin/zsl/rounds/1/playlists",
        &admin,
        Some(json!({"action":"upload","source":"{}"})),
    )
    .await?;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert!(error["detail"].as_str().is_some());

    for settings in [
        json!({"kind":"season","name":"Practice season","pointsStructureId":1,
            "startDate":"2099-01-01T12:00:00Z","endDate":"2099-12-01T12:00:00Z"}),
        json!({"kind":"round","name":"Practice round","seasonId":1,"number":1,
            "eventDate":"2099-05-01T12:00:00Z"}),
    ] {
        assert_eq!(
            request(
                &app,
                "/admin/zsl",
                &admin,
                Some(json!({"settings":settings}))
            )
            .await?
            .0,
            StatusCode::OK
        );
    }
    let path = "/admin/zsl/rounds/1/playlists";
    let levels: Vec<_> = (0..15)
        .map(|i| {
            json!({
                "UID": format!("track-{i}"), "WorkshopID":42, "Author":"Test",
                "Name": if i == 7 { "Break Time".into() } else { format!("ZSL Track {i}") },
            })
        })
        .collect();
    let tournament = json!({"roundLength":420,"levels":levels}).to_string();
    assert_eq!(
        request(
            &app,
            path,
            &admin,
            Some(json!({"action":"upload","source":tournament}))
        )
        .await?
        .0,
        StatusCode::OK
    );
    let contains_break = json!({"levels":[levels[7].clone()]}).to_string();
    assert_eq!(
        request(
            &app,
            path,
            &admin,
            Some(json!({"action":"uploadPractice","source":contains_break}))
        )
        .await?
        .0,
        StatusCode::UNPROCESSABLE_ENTITY
    );
    let practice = json!({"levels":[levels[0].clone()]}).to_string();
    let (status, upload) = request(
        &app,
        path,
        &admin,
        Some(json!({"action":"uploadPractice","source":practice})),
    )
    .await?;
    assert_eq!(status, StatusCode::OK);
    let (_, dashboard) = request(&app, path, &admin, None).await?;
    assert_eq!(dashboard["playlists"][0]["kind"], "practice");
    assert_eq!(
        dashboard["playlists"][0]["selectedRevision"],
        upload["revision"]
    );
    assert_eq!(dashboard["playlists"][0]["levels"][0]["uid"], "track-0");
    assert_eq!(dashboard["playlists"][0]["levels"][0]["state"], "pending");
    let tournament = &dashboard["playlists"][1];
    assert_eq!(tournament["kind"], "tournament");
    assert_eq!(tournament["levels"].as_array().unwrap().len(), 15);
    assert_eq!(tournament["levels"][7]["name"], "Break Time");
    assert_eq!(tournament["levels"][7]["position"], 8);
    assert_eq!(tournament["levels"][7]["state"], "pending");
    client
        .batch_execute(include_str!(
            "../../database/migrations/20261122002000_zsl_practice_upload/down.sql"
        ))
        .await?;
    drop(client);
    connection.await??;
    Ok(())
}
