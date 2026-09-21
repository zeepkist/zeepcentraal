//! Synthetic local benchmark. Never part of production service images.
use anyhow::{Context, Result};
use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::{Html, IntoResponse, Redirect},
    routing::{get, post},
};
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{BigInt, Bool, Double, Integer, Text},
};
use diesel_async::{
    AsyncConnection, AsyncPgConnection, RunQueryDsl,
    pooled_connection::{AsyncDieselConnectionManager, bb8::Pool},
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use utoipa::OpenApi;

#[derive(Clone)]
struct Database(Pool<AsyncPgConnection>);

impl Database {
    async fn connect(url: &str) -> Result<Self> {
        let manager = AsyncDieselConnectionManager::<AsyncPgConnection>::new(url);
        Ok(Self(
            Pool::builder()
                .max_size(4)
                .min_idle(Some(0))
                .idle_timeout(Some(std::time::Duration::from_secs(30)))
                .connection_timeout(std::time::Duration::from_secs(5))
                .build(manager)
                .await?,
        ))
    }

    async fn user(&self, steam_id: i64) -> Result<Option<User>> {
        Ok(sql_query(
            "SELECT id, steam_id::text, steam_name, banned FROM public.\"user\" WHERE steam_id=$1",
        )
        .bind::<BigInt, _>(steam_id)
        .get_result(&mut self.0.get().await?)
        .await
        .optional()?)
    }

    async fn leaderboard(&self, level: i32) -> Result<Vec<Standing>> {
        Ok(sql_query("SELECT r.id_user,u.steam_name,min(r.time) AS time FROM public.record r JOIN public.\"user\" u ON u.id=r.id_user WHERE r.id_level=$1 AND NOT u.banned GROUP BY r.id_user,u.steam_name ORDER BY time,r.id_user LIMIT $2")
            .bind::<Integer, _>(level)
            .bind::<BigInt, _>(100_i64)
            .load(&mut self.0.get().await?)
            .await?)
    }

    async fn submit(&self, input: RecordInput) -> Result<()> {
        let mut connection = self.0.get().await?;
        connection
            .transaction::<_, anyhow::Error, _>(|connection| {
                Box::pin(async move {
                    let row: Inserted = sql_query("INSERT INTO public.record(id_user,id_level,time) VALUES ($1,$2,$3) RETURNING id")
                        .bind::<Integer, _>(input.user)
                        .bind::<Integer, _>(input.level)
                        .bind::<Double, _>(input.time)
                        .get_result(connection)
                        .await?;
                    sql_query("INSERT INTO public.record_audit(id_record) VALUES ($1)")
                        .bind::<Integer, _>(row.id)
                        .execute(connection)
                        .await?;
                    Ok(())
                })
            })
            .await
    }
}

#[derive(Debug, Serialize, QueryableByName, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
struct User {
    #[diesel(sql_type = Integer)]
    id: i32,
    #[diesel(sql_type = Text)]
    steam_id: String,
    #[diesel(sql_type = Text)]
    steam_name: String,
    #[diesel(sql_type = Bool)]
    banned: bool,
}

#[derive(Debug, Serialize, QueryableByName, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
struct Standing {
    #[diesel(sql_type = Integer)]
    id_user: i32,
    #[diesel(sql_type = Text)]
    steam_name: String,
    #[diesel(sql_type = Double)]
    time: f64,
}

#[derive(Deserialize, utoipa::ToSchema)]
struct RecordInput {
    user: i32,
    level: i32,
    time: f64,
}

#[derive(QueryableByName)]
struct Inserted {
    #[diesel(sql_type = Integer)]
    id: i32,
}

#[derive(OpenApi)]
#[openapi(paths(health, user, leaderboard, submit))]
struct ApiDoc;

#[tokio::main]
async fn main() -> Result<()> {
    zc_core::environment::initialize()?;
    tracing_subscriber::fmt().json().init();
    let url = zc_core::environment::var("ZC_PREVIEW_DATABASE_URL")
        .context("ZC_PREVIEW_DATABASE_URL is required")?;
    let port = zc_core::environment::var("ZC_PREVIEW_PORT").unwrap_or_else(|_| "4310".into());
    let address = format!("0.0.0.0:{port}");
    let listener = tokio::net::TcpListener::bind(&address).await?;
    axum::serve(listener, router(Database::connect(&url).await?)).await?;
    Ok(())
}

fn router(database: Database) -> Router {
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
}

#[utoipa::path(get, path = "/healthz", responses((status = 200)))]
async fn health() -> Json<serde_json::Value> {
    Json(json!({"status":"ok"}))
}

#[utoipa::path(get, path = "/evaluation/user/{steam_id}", params(("steam_id" = i64, Path)), responses((status = 200, body = Option<User>)))]
async fn user(
    State(db): State<Database>,
    Path(id): Path<i64>,
) -> Result<Json<Option<User>>, StatusCode> {
    db.user(id).await.map(Json).map_err(internal)
}

#[utoipa::path(get, path = "/evaluation/leaderboard/{level}", params(("level" = i32, Path)), responses((status = 200, body = Vec<Standing>)))]
async fn leaderboard(
    State(db): State<Database>,
    Path(level): Path<i32>,
) -> Result<Json<Vec<Standing>>, StatusCode> {
    db.leaderboard(level).await.map(Json).map_err(internal)
}

#[utoipa::path(post, path = "/evaluation/record", request_body = RecordInput, responses((status = 204)))]
async fn submit(
    State(db): State<Database>,
    Json(input): Json<RecordInput>,
) -> Result<StatusCode, StatusCode> {
    if !input.time.is_finite() || input.time <= 0.0 {
        return Err(StatusCode::BAD_REQUEST);
    }
    db.submit(input).await.map_err(internal)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn docs() -> Html<String> {
    Html(scalar_api_reference::scalar_html(
        &json!({"url":"/openapi.json", "agent":{"disabled":true}}),
        Some("/docs/scalar.js"),
    ))
}

async fn scalar_asset() -> impl IntoResponse {
    scalar_api_reference::get_asset_with_mime("scalar.js")
        .map(|(mime, content)| ([("content-type", mime)], content).into_response())
        .unwrap_or_else(|| StatusCode::NOT_FOUND.into_response())
}

fn internal(_: anyhow::Error) -> StatusCode {
    StatusCode::INTERNAL_SERVER_ERROR
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn benchmark_contract_stays_bounded() {
        let document = serde_json::to_value(ApiDoc::openapi()).unwrap();
        assert_eq!(document["paths"].as_object().unwrap().len(), 4);
        assert!(document.to_string().find("graphql").is_none());
    }
}
