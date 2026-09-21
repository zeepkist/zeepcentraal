use crate::{
    AppState, auth,
    problem::{
        AUTH_DISCORD_NOT_LINKED, AUTH_INVALID_TOKEN, AUTH_MISSING_TOKEN, AUTH_USER_NOT_FOUND,
        Problem,
    },
};
use axum::{
    extract::{Query, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
};
use serde::Deserialize;
use std::{
    collections::HashMap,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};
use subtle::ConstantTimeEq;
use url::Url;
use zc_core::jwt::Provider;
use zc_database::services::{AuthRecord, discord::DiscordLinkStatus};

const DISCORD_AUTHORIZE_URL: &str = "https://discord.com/api/oauth2/authorize";
const DISCORD_TOKEN_URL: &str = "https://discord.com/api/oauth2/token";
const DISCORD_USER_URL: &str = "https://discord.com/api/users/@me";
const STEAM_OPENID_URL: &str = "https://steamcommunity.com/openid/login";

#[derive(Deserialize)]
struct DiscordToken {
    access_token: Option<String>,
}

#[derive(Deserialize)]
struct DiscordUser {
    id: String,
}

#[utoipa::path(get, path = "/auth/discord/link/redirect", responses((status = 302), (status = 401)))]
pub async fn discord_link_redirect(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Response {
    let claims = match auth::user(&headers, &state, false) {
        Ok(claims) => claims,
        Err(problem) => return problem.into_response(),
    };
    let steam_id = match claims.steamid.parse() {
        Ok(value) => value,
        Err(_) => {
            return Problem::code(StatusCode::UNAUTHORIZED, AUTH_USER_NOT_FOUND).into_response();
        }
    };
    let user = match state.database.get_user(steam_id).await {
        Ok(Some(user)) if !user.banned => user,
        Ok(_) => {
            return Problem::code(StatusCode::UNAUTHORIZED, AUTH_USER_NOT_FOUND).into_response();
        }
        Err(error) => return Problem::internal(error).into_response(),
    };
    let oauth_state = format!("link.{}", uuid::Uuid::new_v4());
    let hash = match state.config.jwt.discord_link_hash("oauth", &oauth_state) {
        Ok(hash) => hash,
        Err(error) => return Problem::internal(error).into_response(),
    };
    if let Err(error) = state
        .database
        .create_discord_oauth_link_state(&hash, user.id)
        .await
    {
        return Problem::internal(error).into_response();
    }
    discord_redirect_response(&state, &oauth_state)
}

#[utoipa::path(get, path = "/auth/discord/redirect", responses((status = 302)))]
pub async fn discord_redirect(State(state): State<Arc<AppState>>) -> Response {
    discord_redirect_response(&state, &uuid::Uuid::new_v4().to_string())
}

fn discord_redirect_response(state: &AppState, oauth_state: &str) -> Response {
    let redirect_uri = discord_callback_url(&state.config);
    let mut target = Url::parse(DISCORD_AUTHORIZE_URL).expect("static Discord URL");
    target
        .query_pairs_mut()
        .append_pair(
            "client_id",
            state
                .config
                .discord_client_id
                .as_deref()
                .unwrap_or_default(),
        )
        .append_pair("redirect_uri", &redirect_uri)
        .append_pair("response_type", "code")
        .append_pair("scope", "identify")
        .append_pair("state", oauth_state);
    redirect(
        target.as_str(),
        [state_cookie(&state.config, oauth_state, 300)],
    )
}

#[utoipa::path(get, path = "/auth/discord/callback", responses((status = 302), (status = 400), (status = 401)))]
pub async fn discord_callback(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<HashMap<String, String>>,
) -> Response {
    let Some(code) = query.get("code") else {
        return Problem::code(StatusCode::BAD_REQUEST, AUTH_MISSING_TOKEN).into_response();
    };
    let Some(oauth_state) = query.get("state") else {
        return Problem::code(StatusCode::BAD_REQUEST, AUTH_MISSING_TOKEN).into_response();
    };
    if !valid_state(&headers, oauth_state) {
        return Problem::code(StatusCode::BAD_REQUEST, AUTH_MISSING_TOKEN).into_response();
    }
    let Some(client_id) = state.config.discord_client_id.as_deref() else {
        return Problem::code(StatusCode::UNAUTHORIZED, AUTH_INVALID_TOKEN).into_response();
    };
    let Some(client_secret) = state.config.discord_client_secret.as_deref() else {
        return Problem::code(StatusCode::UNAUTHORIZED, AUTH_INVALID_TOKEN).into_response();
    };
    let redirect_uri = discord_callback_url(&state.config);
    let token = match state
        .http
        .post(DISCORD_TOKEN_URL)
        .form(&[
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("grant_type", "authorization_code"),
            ("code", code.as_str()),
            ("redirect_uri", redirect_uri.as_str()),
        ])
        .send()
        .await
    {
        Ok(response) if response.status().is_success() => {
            match response.json::<DiscordToken>().await {
                Ok(token) => token.access_token,
                Err(_) => None,
            }
        }
        _ => None,
    };
    let Some(token) = token else {
        return Problem::code(StatusCode::UNAUTHORIZED, AUTH_INVALID_TOKEN).into_response();
    };
    let discord = match state
        .http
        .get(DISCORD_USER_URL)
        .bearer_auth(token)
        .send()
        .await
    {
        Ok(response) if response.status().is_success() => response.json::<DiscordUser>().await.ok(),
        _ => None,
    };
    let Some(discord) = discord else {
        return Problem::code(StatusCode::UNAUTHORIZED, AUTH_INVALID_TOKEN).into_response();
    };
    let discord_id: i64 = match discord.id.parse() {
        Ok(value) if value > 0 => value,
        _ => return Problem::code(StatusCode::UNAUTHORIZED, AUTH_INVALID_TOKEN).into_response(),
    };
    if oauth_state.starts_with("link.") {
        let hash = match state.config.jwt.discord_link_hash("oauth", oauth_state) {
            Ok(hash) => hash,
            Err(error) => return Problem::internal(error).into_response(),
        };
        let result = match state
            .database
            .consume_discord_oauth_link_state(&hash, discord_id)
            .await
        {
            Ok(result) => result,
            Err(error) => return Problem::internal(error).into_response(),
        };
        let (path, status) = match result.status {
            DiscordLinkStatus::Linked => ("/settings/discord?linked=1", None),
            DiscordLinkStatus::Expired => ("/settings/discord", Some("expired")),
            DiscordLinkStatus::Invalid => ("/settings/discord", Some("invalid")),
            DiscordLinkStatus::Consumed => ("/settings/discord", Some("consumed")),
            DiscordLinkStatus::Conflict => ("/settings/discord", Some("conflict")),
        };
        let mut target = frontend_target(&state.config.frontend_url, path);
        if let Some(status) = status {
            target
                .query_pairs_mut()
                .append_pair("discordLinkError", status);
        }
        return redirect(target.as_str(), [state_cookie(&state.config, "", 0)]);
    }
    let user = match state.database.get_user_by_discord_id(discord_id).await {
        Ok(Some(user)) if user.steam_id.is_some() => user,
        Ok(_) => {
            return Problem::code(StatusCode::BAD_REQUEST, AUTH_DISCORD_NOT_LINKED).into_response();
        }
        Err(error) => return Problem::internal(error).into_response(),
    };
    if user.banned {
        return Problem::code(StatusCode::UNAUTHORIZED, AUTH_INVALID_TOKEN).into_response();
    }
    let steam_id = user.steam_id.expect("checked steam ID").to_string();
    let pair = match state
        .config
        .jwt
        .issue(Provider::Discord, &steam_id, Some(&discord.id))
    {
        Ok(pair) => pair,
        Err(error) => return Problem::internal(error).into_response(),
    };
    if let Err(error) = insert_auth(&state, user.id, &pair, "discord").await {
        return Problem::internal(error).into_response();
    }
    let mut cookies = session_cookies(&state.config, &pair, &steam_id);
    cookies.push(state_cookie(&state.config, "", 0));
    redirect(
        frontend_target(&state.config.frontend_url, "/?auth=callback").as_str(),
        cookies,
    )
}

#[utoipa::path(get, path = "/auth/steam/redirect", responses((status = 302)))]
pub async fn steam_redirect(State(state): State<Arc<AppState>>) -> Response {
    let oauth_state = uuid::Uuid::new_v4().to_string();
    let callback = steam_callback_url(&state.config, Some(&oauth_state));
    let mut target = Url::parse(STEAM_OPENID_URL).expect("static Steam URL");
    target
        .query_pairs_mut()
        .append_pair("openid.ns", "http://specs.openid.net/auth/2.0")
        .append_pair("openid.mode", "checkid_setup")
        .append_pair("openid.return_to", &callback)
        .append_pair("openid.realm", &state.config.backend_url)
        .append_pair(
            "openid.identity",
            "http://specs.openid.net/auth/2.0/identifier_select",
        )
        .append_pair(
            "openid.claimed_id",
            "http://specs.openid.net/auth/2.0/identifier_select",
        );
    redirect(
        target.as_str(),
        [state_cookie(&state.config, &oauth_state, 300)],
    )
}

#[utoipa::path(get, path = "/auth/steam/callback", responses((status = 302), (status = 400), (status = 401)))]
pub async fn steam_callback(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<HashMap<String, String>>,
) -> Response {
    let Some(oauth_state) = query.get("state") else {
        return Problem::code(StatusCode::UNAUTHORIZED, AUTH_INVALID_TOKEN).into_response();
    };
    if !valid_state(&headers, oauth_state) || !valid_steam_callback(&state, &query).await {
        return Problem::code(StatusCode::UNAUTHORIZED, AUTH_INVALID_TOKEN).into_response();
    }
    let steam_id = query
        .get("openid.identity")
        .and_then(|identity| identity.rsplit('/').next())
        .filter(|value| !value.is_empty() && value.bytes().all(|byte| byte.is_ascii_digit()))
        .and_then(|value| value.parse::<i64>().ok());
    let Some(steam_id) = steam_id else {
        return Problem::code(StatusCode::BAD_REQUEST, AUTH_MISSING_TOKEN).into_response();
    };
    let user = match state.database.get_or_insert_user(steam_id).await {
        Ok(user) => user,
        Err(error) => return Problem::internal(error).into_response(),
    };
    if user.banned {
        return Problem::code(StatusCode::UNAUTHORIZED, AUTH_INVALID_TOKEN).into_response();
    }
    let steam_id = steam_id.to_string();
    let pair = match state.config.jwt.issue(Provider::Steam, &steam_id, None) {
        Ok(pair) => pair,
        Err(error) => return Problem::internal(error).into_response(),
    };
    if let Err(error) = insert_auth(&state, user.id, &pair, "steam").await {
        return Problem::internal(error).into_response();
    }
    let mut cookies = session_cookies(&state.config, &pair, &steam_id);
    cookies.push(state_cookie(&state.config, "", 0));
    redirect(
        frontend_target(&state.config.frontend_url, "/?auth=callback").as_str(),
        cookies,
    )
}

async fn valid_steam_callback(state: &AppState, query: &HashMap<String, String>) -> bool {
    if query.get("openid.op_endpoint").map(String::as_str) != Some(STEAM_OPENID_URL) {
        return false;
    }
    let expected = steam_callback_url(&state.config, None);
    if !query
        .get("openid.return_to")
        .is_some_and(|value| value.starts_with(&expected))
    {
        return false;
    }
    let mut form = query.clone();
    form.insert("openid.mode".into(), "check_authentication".into());
    match state.http.post(STEAM_OPENID_URL).form(&form).send().await {
        Ok(response) => response
            .text()
            .await
            .is_ok_and(|body| body.contains("is_valid:true")),
        Err(_) => false,
    }
}

async fn insert_auth(
    state: &AppState,
    id_user: i32,
    pair: &zc_core::jwt::TokenPair,
    provider: &str,
) -> anyhow::Result<()> {
    state
        .database
        .insert_auth(AuthRecord {
            id_user,
            access_token: &pair.access_token,
            access_token_expiry: pair.access_token_expiry,
            refresh_token: &pair.refresh_token,
            refresh_token_expiry: pair.refresh_token_expiry,
            provider,
        })
        .await?;
    Ok(())
}

fn valid_state(headers: &HeaderMap, state: &str) -> bool {
    let cookie = headers
        .get(header::COOKIE)
        .and_then(|value| value.to_str().ok());
    let Some(expected) = zc_core::cookies::get_cookie(cookie, zc_core::cookies::OAUTH_STATE) else {
        return false;
    };
    bool::from(expected.as_bytes().ct_eq(state.as_bytes()))
}

fn discord_callback_url(config: &crate::config::ServerConfig) -> String {
    config.discord_redirect_uri.clone().unwrap_or_else(|| {
        Url::parse(&config.backend_url)
            .expect("validated backend URL")
            .join("/auth/discord/callback")
            .expect("static callback path")
            .to_string()
    })
}

fn steam_callback_url(config: &crate::config::ServerConfig, state: Option<&str>) -> String {
    let mut url = Url::parse(&config.backend_url)
        .expect("validated backend URL")
        .join("/auth/steam/callback")
        .expect("static callback path");
    if let Some(state) = state {
        url.query_pairs_mut().append_pair("state", state);
    }
    url.to_string()
}

fn frontend_target(base: &str, path: &str) -> Url {
    Url::parse(base)
        .expect("validated frontend URL")
        .join(path)
        .expect("static frontend path")
}

fn state_cookie(config: &crate::config::ServerConfig, value: &str, max_age: i64) -> String {
    format!(
        "{}={}; Path=/auth/; Max-Age={max_age}; SameSite=Lax; {}HttpOnly",
        zc_core::cookies::OAUTH_STATE,
        cookie_value(value),
        if secure_cookies(config) {
            "Secure; "
        } else {
            ""
        }
    )
}

fn session_cookies(
    config: &crate::config::ServerConfig,
    pair: &zc_core::jwt::TokenPair,
    steam_id: &str,
) -> Vec<String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_secs() as i64);
    let access_age = (pair.access_token_expiry - now).max(0);
    let refresh_age = (pair.refresh_token_expiry - now).max(0);
    let domain = cookie_domain(config)
        .map(|domain| format!("Domain={domain}; "))
        .unwrap_or_default();
    let secure = if secure_cookies(config) {
        "Secure; "
    } else {
        ""
    };
    vec![
        format!(
            "{}={}; Path=/; Max-Age={access_age}; {domain}SameSite=Lax; {secure}HttpOnly",
            zc_core::cookies::ACCESS_TOKEN,
            cookie_value(&pair.access_token)
        ),
        format!(
            "{}={}; Path=/; Max-Age={refresh_age}; {domain}SameSite=Lax; {secure}HttpOnly",
            zc_core::cookies::REFRESH_TOKEN,
            cookie_value(&pair.refresh_token)
        ),
        format!(
            "{}={}; Path=/; Max-Age={refresh_age}; {domain}SameSite=Lax; {secure}",
            zc_core::cookies::STEAM_ID,
            cookie_value(steam_id)
        ),
    ]
}

fn cookie_domain(config: &crate::config::ServerConfig) -> Option<String> {
    if !secure_cookies(config) {
        return None;
    }
    Url::parse(&config.frontend_url)
        .ok()?
        .host_str()
        .map(|host| format!(".{host}"))
}

fn secure_cookies(config: &crate::config::ServerConfig) -> bool {
    !config.backend_url.contains("localhost") && !config.backend_url.contains("127.0.0.1")
}

fn cookie_value(value: &str) -> String {
    url::form_urlencoded::byte_serialize(value.as_bytes()).collect()
}

fn redirect(url: &str, cookies: impl IntoIterator<Item = String>) -> Response {
    let mut response = StatusCode::FOUND.into_response();
    let Ok(location) = HeaderValue::from_str(url) else {
        return Problem::code(StatusCode::INTERNAL_SERVER_ERROR, 0).into_response();
    };
    response.headers_mut().insert(header::LOCATION, location);
    for cookie in cookies {
        if let Ok(cookie) = HeaderValue::from_str(&cookie) {
            response.headers_mut().append(header::SET_COOKIE, cookie);
        }
    }
    response
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cookie_value_preserves_safe_token_shape() {
        assert_eq!(cookie_value("a=b c"), "a%3Db+c");
    }
}
