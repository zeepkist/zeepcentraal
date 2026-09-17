//! Local migration preview. Production API routes are deliberately not replaced.
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    middleware::{self, Next},
    response::{Html, IntoResponse, Redirect},
    routing::{any, get, post},
    Extension, Json, Router,
};
use postrust_core::{AppConfig, SchemaCache};
use postrust_graphql::{context::GraphQLContext, handler::GraphQLState, schema::SchemaConfig};
use serde::Deserialize;
use serde_json::json;
use std::{sync::Arc, time::Duration};
use tokio::sync::RwLock;
use zc_database::Database;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .json()
        .with_env_filter("zc_server=info")
        .init();
    let config = zc_core::PreviewConfig::from_env()?;
    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(config.postrust_pool_max)
        .min_connections(0)
        .idle_timeout(Duration::from_secs(30))
        .acquire_timeout(Duration::from_secs(5))
        .connect(&config.database_url)
        .await?;
    let database = Database::connect(&config.database_url, config.pool_max, pool.clone()).await?;
    let mut app = Router::new()
        .route("/", get(index))
        .route("/healthz", get(|| async { Json(json!({"status":"ok"})) }))
        .route("/evaluation/user/{steam_id}", get(user))
        .route("/evaluation/leaderboard/{level}", get(leaderboard))
        .route("/evaluation/record", post(submit))
        .with_state(database);
    let mut graphql = None;
    if config.preview_features {
        let mut cache = SchemaCache::load_with_search_path(&pool, &["public".into()], &[]).await?;
        // Migration bookkeeping must not change the A/B generated API surface.
        cache.tables.retain(|_, table| {
            !["_sqlx_migrations", "__diesel_schema_migrations"].contains(&table.name.as_str())
        });
        let state = Arc::new(postrust_server::AppState {
            pool: pool.clone(),
            schema_cache: RwLock::new(cache.clone()),
            config: AppConfig {
                db_schemas: vec!["public".into()],
                db_anon_role: Some("zc_preview".into()),
                ..Default::default()
            },
            jwt_config: postrust_auth::JwtConfig {
                anon_role: Some("zc_preview".into()),
                ..Default::default()
            },
            jwt_cache: None,
        });
        let cache_ref = postrust_core::schema_cache::SchemaCacheRef::from_static(cache.clone());
        let gql = Arc::new(GraphQLState::new(
            pool.clone(),
            Arc::new(cache),
            SchemaConfig {
                enable_subscriptions: true,
                subscription_refresh_seconds: 2,
                max_rows: Some(100),
                exposed_schemas: vec!["public".into()],
                ..Default::default()
            },
        )?);
        // WebSocket operations are read-only: mutations use the HTTP transaction boundary.
        let ws_schema = GraphQLState::new(
            pool.clone(),
            gql.schema_cache.clone(),
            SchemaConfig {
                enable_mutations: false,
                ..gql.config.clone()
            },
        )?
        .schema;
        gql.init_subscriptions().await?;
        let gql_routes = Router::new()
            .route("/", post(graphql_http).get(playground))
            .route("/ws", get(graphql_ws))
            .with_state(gql.clone())
            .layer(Extension(cache_ref))
            .layer(Extension(WsSchema(ws_schema)));
        let rest = Router::new()
            .route("/", any(postrust_server::handle_request))
            .route("/{*path}", any(postrust_server::handle_request))
            .with_state(state.clone());
        app = app
            .route("/admin/", get(|| async { Redirect::temporary("/admin") }))
            .nest("/admin", postrust_server::admin_router().with_state(state))
            .nest("/api", rest)
            .nest("/graphql", gql_routes.clone())
            .nest("/api/graphql", gql_routes.clone())
            .nest("/v1/graphql", gql_routes);
        graphql = Some(gql);
    }
    let authority = config.address.to_string();
    app = app.layer(middleware::from_fn(
        move |headers: HeaderMap, request, next: Next| {
            let expected = authority.clone();
            async move {
                // Prevent another site or DNS rebinding from using this local write-capable demo.
                if !local_request(&headers, &expected) {
                    return StatusCode::FORBIDDEN.into_response();
                }
                next.run(request).await
            }
        },
    ));
    let listener = tokio::net::TcpListener::bind(config.address).await?;
    tracing::info!(adapter=Database::NAME, address=%config.address, preview=config.preview_features, "Rust evaluation ready");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown())
        .await?;
    if let Some(gql) = graphql {
        gql.stop_subscriptions().await;
    }
    pool.close().await;
    Ok(())
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

async fn index() -> Html<String> {
    Html(format!(
        r#"<!doctype html><html lang="en"><meta charset="utf-8"><title>ZeepCentraal Rust preview</title><style>body{{font:18px system-ui;max-width:820px;margin:60px auto;padding:0 24px}}li{{margin:14px 0}}code{{background:#eee;padding:3px}}</style><h1>ZeepCentraal Rust preview</h1><p>Database adapter: <strong>{}</strong>. Synthetic data. Existing production services remain separate.</p><ul><li><a href="/admin/">Postrust dashboard</a></li><li><a href="/admin/swagger">Swagger</a> · <a href="/admin/scalar">Scalar</a> · <a href="/admin/openapi.json">OpenAPI</a></li><li><a href="/graphql">GraphQL playground</a></li><li><a href="/api/level">Generated REST: levels</a></li><li><a href="/evaluation/leaderboard/1">Application adapter: leaderboard</a></li></ul><p>GraphQL query: <code>{{ level {{ id name }} }}</code></p><p>Subscription: <code>subscription {{ record {{ id id_user id_level time }} }}</code></p><p>Generate a change through <code>POST /evaluation/record</code> with <code>{{"user":1,"level":1,"time":28.5}}</code>.</p><p>With ZC_PREVIEW_FEATURES=false, admin and GraphQL links intentionally return 404.</p></html>"#,
        Database::NAME
    ))
}

async fn playground() -> Html<String> {
    Html(async_graphql::http::playground_source(
        async_graphql::http::GraphQLPlaygroundConfig::new("/graphql")
            .subscription_endpoint("/graphql/ws"),
    ))
}

#[derive(Clone)]
struct WsSchema(async_graphql::dynamic::Schema);

async fn graphql_ws(
    State(state): State<Arc<GraphQLState>>,
    Extension(cache): Extension<postrust_core::schema_cache::SchemaCacheRef>,
    Extension(schema): Extension<WsSchema>,
    protocol: async_graphql_axum::GraphQLProtocol,
    ws: axum::extract::WebSocketUpgrade,
) -> impl IntoResponse {
    ws.protocols(["graphql-transport-ws", "graphql-ws"])
        .on_upgrade(move |socket| async move {
            let mut data = async_graphql::Data::default();
            data.insert(GraphQLContext::new(
                state.pool.clone(),
                cache,
                postrust_auth::AuthResult::anonymous("zc_preview"),
            ));
            data.insert(state.pool.clone());
            data.insert(state.broker.clone());
            async_graphql_axum::GraphQLWebSocket::new(socket, schema.0, protocol)
                .with_data(data)
                .serve()
                .await;
        })
}

async fn graphql_http(
    State(state): State<Arc<GraphQLState>>,
    Extension(cache): Extension<postrust_core::schema_cache::SchemaCacheRef>,
    request: async_graphql_axum::GraphQLRequest,
) -> Json<serde_json::Value> {
    let context = GraphQLContext::new(
        state.pool.clone(),
        cache,
        postrust_auth::AuthResult::anonymous("zc_preview"),
    );
    let write = context.write.clone();
    let request = request
        .into_inner()
        .data(context)
        .data(state.pool.clone())
        .data(state.broker.clone());
    let mut result = state.schema.execute(request).await;
    if let Some(tx) = write.lock().await.take() {
        let settled = if result.errors.is_empty() {
            tx.commit().await
        } else {
            tx.rollback().await
        };
        if settled.is_err() {
            result.data = async_graphql::Value::Null;
            result.errors.push(async_graphql::ServerError::new(
                "Mutation transaction failed",
                None,
            ));
        }
    }
    Json(serde_json::to_value(result).expect("GraphQL response serializes"))
}

type ApiError = (StatusCode, Json<serde_json::Value>);
fn failure(_: anyhow::Error) -> ApiError {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({"error":"Evaluation database operation failed"})),
    )
}
async fn user(
    State(db): State<Database>,
    Path(id): Path<i64>,
) -> Result<Json<Option<zc_database::User>>, ApiError> {
    db.user(id).await.map(Json).map_err(failure)
}
async fn leaderboard(
    State(db): State<Database>,
    Path(level): Path<i32>,
) -> Result<Json<Vec<zc_database::Standing>>, ApiError> {
    db.leaderboard(level, 100).await.map(Json).map_err(failure)
}
#[derive(Deserialize)]
struct RecordInput {
    user: i32,
    level: i32,
    time: f64,
}
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
