use crate::{AppState, discord_runtime_routes as discord_routes, docs, routes};
use anyhow::{Context, Result};
use axum::{
    Router,
    extract::DefaultBodyLimit,
    middleware,
    routing::{delete, get, patch, post, put},
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
        .route("/lobby", get(crate::lobby::snapshot))
        .route("/lobby/events", get(crate::lobby::events))
        .route("/openapi", get(docs::page))
        .route("/openapi/json", get(docs::schema))
        .route("/openapi/scalar.js", get(docs::scalar_asset))
        .route("/favourite/add", post(routes::add_favourite))
        .route("/favourite/remove", post(routes::remove_favourite))
        .route("/vote/submit", post(routes::submit_vote))
        .route("/level/request", post(routes::request_level))
        .route("/record/submit", post(routes::submit_record))
        .route("/job/trigger", post(routes::trigger_job))
        .route("/user/updateSteamName", post(routes::update_steam_name))
        .route("/user/updateDiscordId", post(routes::update_discord_id))
        .route(
            "/user/discord/link-code",
            post(routes::create_discord_link_code),
        )
        .route("/user/discord", delete(routes::unlink_discord))
        .route(
            "/discord-bot/link/redeem",
            post(routes::redeem_discord_link_code),
        )
        .route(
            "/discord-bot/users/{discord_id}/link",
            delete(routes::unlink_discord_bot_user),
        )
        .route(
            "/discord-bot/users/{discord_id}",
            get(routes::get_discord_bot_user),
        )
        .route(
            "/discord-bot/users/{discord_id}/preferences",
            patch(routes::update_discord_bot_preferences),
        )
        .route(
            "/discord-bot/users/{discord_id}/watches",
            post(routes::add_discord_bot_watch),
        )
        .route(
            "/discord-bot/users/{discord_id}/watches/{watch_id}",
            delete(routes::remove_discord_bot_watch),
        )
        .route(
            "/discord-bot/watches/matches",
            post(discord_routes::match_watches),
        )
        .route(
            "/discord-bot/activity-events",
            get(discord_routes::activity_events),
        )
        .route(
            "/discord-bot/tournaments/current",
            get(discord_routes::current_tournaments),
        )
        .route(
            "/discord-bot/tournaments/{tournament_id}/standings",
            get(discord_routes::tournament_standings),
        )
        .route(
            "/discord-bot/profiles/{identifier}",
            get(discord_routes::profile),
        )
        .route(
            "/discord-bot/levels/lookup",
            post(discord_routes::level_lookup),
        )
        .route(
            "/discord-bot/levels/search",
            post(discord_routes::level_search),
        )
        .route(
            "/discord-bot/levels/{level_id}/standings",
            get(discord_routes::level_standings),
        )
        .route(
            "/discord-bot/levels/random",
            get(discord_routes::random_level),
        )
        .route(
            "/discord-bot/users/{discord_id}/statistics",
            get(discord_routes::user_statistics),
        )
        .route("/discord-bot/playlists", post(discord_routes::playlist))
        .route(
            "/discord-bot/playlists/recommended",
            post(discord_routes::recommended_playlist),
        )
        .route(
            "/discord-bot/watches/{watch_id}/delivery",
            patch(discord_routes::update_watch_delivery),
        )
        .route(
            "/discord-bot/workers/{key}/cursor",
            get(discord_routes::get_worker_cursor).post(discord_routes::advance_worker_cursor),
        )
        .route(
            "/discord-bot/guild-feeds/enabled",
            get(discord_routes::enabled_guild_feeds),
        )
        .route(
            "/discord-bot/guilds/{guild_id}",
            get(discord_routes::guild_state),
        )
        .route(
            "/discord-bot/guilds/{guild_id}/linked-role",
            put(discord_routes::set_linked_role),
        )
        .route(
            "/discord-bot/guilds/{guild_id}/feeds/{kind}",
            put(discord_routes::set_guild_feed),
        )
        .route(
            "/discord-bot/guilds/{guild_id}/feeds/{kind}/cursor",
            post(discord_routes::advance_guild_feed),
        )
        .route(
            "/discord-bot/guilds/{guild_id}/digest",
            put(discord_routes::set_guild_digest),
        )
        .route(
            "/discord-bot/guilds/{guild_id}/deliveries/{source_event_id}",
            get(discord_routes::get_delivery).put(discord_routes::set_delivery),
        )
        .route(
            "/discord-bot/guilds/{guild_id}/tournaments/{tournament_id}/message",
            put(discord_routes::set_tournament_message),
        )
        .route("/auth/web/refresh", post(routes::refresh_web_session))
        .route(
            "/auth/discord/link/redirect",
            get(crate::browser_auth::discord_link_redirect),
        )
        .route(
            "/auth/discord/redirect",
            get(crate::browser_auth::discord_redirect),
        )
        .route(
            "/auth/discord/callback",
            get(crate::browser_auth::discord_callback),
        )
        .route(
            "/auth/steam/redirect",
            get(crate::browser_auth::steam_redirect),
        )
        .route(
            "/auth/steam/callback",
            get(crate::browser_auth::steam_callback),
        )
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
