//! Standalone REST evaluation; production services remain separate.
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    middleware::{self, Next},
    response::{Html, IntoResponse, Redirect},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;
use utoipa::OpenApi;
use zc_database::Database;

#[derive(OpenApi)]
#[openapi(
    paths(user, leaderboard, submit, health),
    info(
        title = "ZeepCentraal REST evaluation",
        version = "0.1.0",
        description = "Synthetic local fixture. Not the production API."
    )
)]
struct ApiDoc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .json()
        .with_env_filter("zc_server=info")
        .init();
    let config = zc_core::PreviewConfig::from_env()?;
    let database = Database::connect(&config.database_url, config.pool_max).await?;
    let app = router(database, config.address.to_string());
    let listener = tokio::net::TcpListener::bind(config.address).await?;
    tracing::info!(adapter=Database::NAME, address=%config.address, "Standalone REST evaluation ready");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown())
        .await?;
    Ok(())
}

fn router(database: Database, authority: String) -> Router {
    Router::new()
        .route("/", get(|| async { Redirect::temporary("/docs") }))
        .route("/healthz", get(health))
        .route("/evaluation/user/{steam_id}", get(user))
        .route("/evaluation/leaderboard/{level}", get(leaderboard))
        .route("/evaluation/record", post(submit))
        .route("/docs", get(docs))
        .route("/docs/scalar.js", get(scalar_asset))
        .route("/openapi.json", get(|| async { Json(ApiDoc::openapi()) }))
        .with_state(database)
        .layer(middleware::from_fn(
            move |headers: HeaderMap, request, next: Next| {
                let expected = authority.clone();
                async move {
                    if !local_request(&headers, &expected) {
                        return StatusCode::FORBIDDEN.into_response();
                    }
                    next.run(request).await
                }
            },
        ))
}

#[utoipa::path(get, path = "/healthz", responses((status = 200, description = "Process is serving", body = serde_json::Value)))]
async fn health() -> Json<serde_json::Value> {
    Json(json!({"status":"ok"}))
}

async fn docs() -> Html<String> {
    Html(scalar_api_reference::scalar_html(
        &json!({"url":"/openapi.json", "agent":{"disabled":true}}),
        Some("/docs/scalar.js"),
    ))
}
async fn scalar_asset() -> impl IntoResponse {
    match scalar_api_reference::get_asset_with_mime("scalar.js") {
        Some((mime, content)) => ([("content-type", mime)], content).into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

fn local_request(headers: &HeaderMap, expected: &str) -> bool {
    let localhost = expected.replacen("127.0.0.1", "localhost", 1);
    let valid = |authority: &str| authority == expected || authority == localhost;
    if !headers
        .get("host")
        .and_then(|v| v.to_str().ok())
        .is_some_and(valid)
    {
        return false;
    }
    if headers
        .get("sec-fetch-site")
        .is_some_and(|v| v == "cross-site")
    {
        return false;
    }
    headers.get("origin").is_none_or(|v| {
        v.to_str()
            .ok()
            .and_then(|s| s.strip_prefix("http://"))
            .is_some_and(valid)
    })
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

type ApiError = (StatusCode, Json<serde_json::Value>);
fn failure(_: anyhow::Error) -> ApiError {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({"error":"Evaluation database operation failed"})),
    )
}
#[utoipa::path(get, path = "/evaluation/user/{steam_id}", params(("steam_id" = i64, Path)), responses((status = 200, body = Option<zc_database::User>), (status = 400, description = "Invalid path parameter"), (status = 500, description = "Database failure")))]
async fn user(
    State(db): State<Database>,
    Path(id): Path<i64>,
) -> Result<Json<Option<zc_database::User>>, ApiError> {
    db.user(id).await.map(Json).map_err(failure)
}
#[utoipa::path(get, path = "/evaluation/leaderboard/{level}", params(("level" = i32, Path)), responses((status = 200, body = Vec<zc_database::Standing>), (status = 400, description = "Invalid path parameter"), (status = 500, description = "Database failure")))]
async fn leaderboard(
    State(db): State<Database>,
    Path(level): Path<i32>,
) -> Result<Json<Vec<zc_database::Standing>>, ApiError> {
    db.leaderboard(level, 100).await.map(Json).map_err(failure)
}
#[derive(Deserialize, utoipa::ToSchema)]
struct RecordInput {
    user: i32,
    level: i32,
    time: f64,
}
#[utoipa::path(post, path = "/evaluation/record", request_body = RecordInput, responses((status = 204, description = "Record and audit committed"), (status = 400, description = "Invalid time or malformed JSON"), (status = 422, description = "Invalid JSON fields"), (status = 415, description = "JSON content type required"), (status = 500, description = "Database transaction failed")))]
async fn submit(
    State(db): State<Database>,
    Json(input): Json<RecordInput>,
) -> Result<StatusCode, ApiError> {
    if !input.time.is_finite() || input.time <= 0.0 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"error":"Invalid time"})),
        ));
    }
    db.submit(input.user, input.level, input.time)
        .await
        .map_err(failure)?;
    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn openapi_matches_wire_names_and_empty_success() {
        let schema = serde_json::to_value(ApiDoc::openapi()).unwrap();
        assert!(schema["components"]["schemas"]["User"]["properties"]["steamId"].is_object());
        assert!(schema["components"]["schemas"]["User"]["properties"]
            .get("steam_id")
            .is_none());
        assert!(
            schema["paths"]["/evaluation/record"]["post"]["responses"]["204"]
                .get("content")
                .is_none()
        );
        assert_eq!(schema["paths"].as_object().unwrap().len(), 4);
        let (mime, asset) = scalar_api_reference::get_asset_with_mime("scalar.js").unwrap();
        assert_eq!(mime, "application/javascript");
        assert!(asset.len() > 100_000);
    }
    #[test]
    fn preview_rejects_foreign_hosts_and_origins() {
        let mut h = HeaderMap::new();
        h.insert("host", "127.0.0.1:4310".parse().unwrap());
        assert!(local_request(&h, "127.0.0.1:4310"));
        h.insert("origin", "https://example.org".parse().unwrap());
        assert!(!local_request(&h, "127.0.0.1:4310"));
        h.remove("origin");
        h.insert("host", "example.org:4310".parse().unwrap());
        assert!(!local_request(&h, "127.0.0.1:4310"));
    }
}
