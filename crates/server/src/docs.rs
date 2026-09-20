use axum::{
    Json,
    http::StatusCode,
    response::{Html, IntoResponse},
};
use serde_json::json;
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    paths(
        crate::routes::health,
        crate::lobby::snapshot,
        crate::lobby::events,
        crate::routes::add_favourite,
        crate::routes::remove_favourite,
        crate::routes::submit_vote,
        crate::routes::request_level,
        crate::routes::submit_record,
        crate::routes::trigger_job,
        crate::routes::update_steam_name,
        crate::routes::update_discord_id,
        crate::routes::create_discord_link_code,
        crate::routes::unlink_discord,
        crate::routes::redeem_discord_link_code,
        crate::routes::unlink_discord_bot_user,
        crate::routes::get_discord_bot_user,
        crate::routes::update_discord_bot_preferences,
        crate::routes::add_discord_bot_watch,
        crate::routes::remove_discord_bot_watch,
        crate::discord_runtime_routes::match_watches,
        crate::discord_runtime_routes::activity_events,
        crate::discord_runtime_routes::current_tournaments,
        crate::discord_runtime_routes::profile,
        crate::discord_runtime_routes::level_lookup,
        crate::discord_runtime_routes::level_search,
        crate::discord_runtime_routes::random_level,
        crate::discord_runtime_routes::user_statistics,
        crate::discord_runtime_routes::playlist,
        crate::discord_runtime_routes::recommended_playlist,
        crate::discord_runtime_routes::update_watch_delivery,
        crate::discord_runtime_routes::get_worker_cursor,
        crate::discord_runtime_routes::advance_worker_cursor,
        crate::discord_runtime_routes::enabled_guild_feeds,
        crate::discord_runtime_routes::guild_state,
        crate::discord_runtime_routes::set_linked_role,
        crate::discord_runtime_routes::set_guild_feed,
        crate::discord_runtime_routes::advance_guild_feed,
        crate::discord_runtime_routes::set_guild_digest,
        crate::discord_runtime_routes::set_delivery,
        crate::discord_runtime_routes::get_delivery,
        crate::discord_runtime_routes::set_tournament_message,
        crate::routes::refresh_web_session,
        crate::browser_auth::discord_link_redirect,
        crate::browser_auth::discord_redirect,
        crate::browser_auth::discord_callback,
        crate::browser_auth::steam_redirect,
        crate::browser_auth::steam_callback,
        crate::routes::login_gtr,
        crate::routes::refresh_gtr_session,
        crate::turnstile::verify
    ),
    info(title = "ZeepCentraal API V3", version = "0.1.0")
)]
pub struct ApiDoc;

pub async fn page() -> Html<String> {
    Html(scalar_api_reference::scalar_html(
        &json!({"url":"/openapi/json", "agent":{"disabled":true}}),
        Some("/openapi/scalar.js"),
    ))
}

pub async fn schema() -> Json<utoipa::openapi::OpenApi> {
    Json(ApiDoc::openapi())
}

pub async fn scalar_asset() -> impl IntoResponse {
    match scalar_api_reference::get_asset_with_mime("scalar.js") {
        Some((mime, content)) => ([("content-type", mime)], content).into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scalar_and_openapi_are_embedded() {
        let schema = serde_json::to_value(ApiDoc::openapi()).unwrap();
        assert_eq!(schema["paths"].as_object().unwrap().len(), 48);
        assert!(schema.to_string().find("graphql").is_none());
        let (mime, asset) = scalar_api_reference::get_asset_with_mime("scalar.js").unwrap();
        assert_eq!(mime, "application/javascript");
        assert!(asset.len() > 100_000);
    }
}
