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
        crate::routes::add_favourite,
        crate::routes::remove_favourite,
        crate::routes::submit_vote,
        crate::routes::request_level,
        crate::routes::trigger_job,
        crate::routes::update_steam_name,
        crate::routes::update_discord_id,
        crate::routes::refresh_web_session,
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
        assert_eq!(schema["paths"].as_object().unwrap().len(), 12);
        assert!(schema.to_string().find("graphql").is_none());
        let (mime, asset) = scalar_api_reference::get_asset_with_mime("scalar.js").unwrap();
        assert_eq!(mime, "application/javascript");
        assert!(asset.len() > 100_000);
    }
}
