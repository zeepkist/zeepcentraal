use crate::{AppState, docs, routes};
use anyhow::{Context, Result};
use axum::{
    Router,
    extract::DefaultBodyLimit,
    middleware,
    routing::{delete, get, post},
};
use std::sync::Arc;
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    trace::TraceLayer,
};

pub fn router(state: Arc<AppState>) -> Result<Router> {
    let origins = state
        .config
        .cors_origins
        .iter()
        .map(|origin| origin.parse())
        .collect::<Result<Vec<_>, _>>()
        .context("CORS_ALLOWED_ORIGINS contains an invalid header value")?;
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_credentials(true)
        .allow_headers(tower_http::cors::Any)
        .allow_methods(tower_http::cors::Any);
    let body_limit = state.config.body_limit;
    Ok(Router::new()
        .route(
            "/favicon.ico",
            get(|| async { axum::http::StatusCode::NO_CONTENT }),
        )
        .route("/healthz", get(routes::health).head(routes::health))
        .route("/openapi", get(docs::page))
        .route("/openapi/json", get(docs::schema))
        .route("/openapi/scalar.js", get(docs::scalar_asset))
        .route("/favourite/add", post(routes::add_favourite))
        .route("/favourite/remove", post(routes::remove_favourite))
        .route("/vote/submit", post(routes::submit_vote))
        .route("/level/request", post(routes::request_level))
        .route("/job/trigger", post(routes::trigger_job))
        .route("/user/updateSteamName", post(routes::update_steam_name))
        .route("/user/updateDiscordId", post(routes::update_discord_id))
        .route(
            "/user/discord/link-code",
            post(routes::create_discord_link_code),
        )
        .route("/user/discord", delete(routes::unlink_discord))
        .route("/auth/web/refresh", post(routes::refresh_web_session))
        .route("/auth/login", post(routes::login_gtr))
        .route("/auth/refresh", post(routes::refresh_gtr_session))
        .route("/turnstile/verify", post(crate::turnstile::verify))
        .layer(DefaultBodyLimit::max(body_limit))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            crate::rate_limit::middleware,
        ))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state))
}
