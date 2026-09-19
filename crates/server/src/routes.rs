use crate::{
    AppState, auth,
    problem::{
        AUTH_INVALID_TOKEN, AUTH_MISSING_REQUIRED_FIELDS, AUTH_MOD_OUTDATED,
        AUTH_STEAM_AUTHENTICATION_FAILED, AUTH_STEAM_ID_MISMATCH, AUTH_USER_NOT_FOUND,
        INVALID_REQUEST, LEVEL_NOT_FOUND, Problem, VOTE_MISSING_PARAMS,
    },
};
use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use std::{
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};
use zc_core::jwt::Provider;
use zc_database::services::discord::DiscordLinkStatus;
use zc_jobs::{TaskIdentifier, queue::JobLane};

type ApiResult<T> = Result<T, Problem>;

#[derive(Serialize, utoipa::ToSchema)]
pub struct Health {
    status: &'static str,
}

#[utoipa::path(get, path = "/healthz", responses((status = 200, body = Health)))]
pub async fn health() -> Json<Health> {
    Json(Health { status: "ok" })
}

#[derive(Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "PascalCase")]
pub struct LoginBody {
    mod_version: String,
    steam_id: String,
    authentication_ticket: String,
}

#[derive(Serialize, utoipa::ToSchema)]
#[serde(rename_all = "PascalCase")]
pub struct TokenBody {
    access_token: String,
    access_token_expiry: i64,
    refresh_token: String,
    refresh_token_expiry: i64,
}

#[utoipa::path(post, path = "/auth/login", request_body = LoginBody, responses((status = 200, body = TokenBody), (status = 400), (status = 401), (status = 500)))]
pub async fn login_gtr(
    State(state): State<Arc<AppState>>,
    Json(body): Json<LoginBody>,
) -> ApiResult<Json<TokenBody>> {
    if body.mod_version.is_empty()
        || body.steam_id.is_empty()
        || body.authentication_ticket.is_empty()
    {
        return Err(Problem::code(
            StatusCode::BAD_REQUEST,
            AUTH_MISSING_REQUIRED_FIELDS,
        ));
    }
    require_current_mod(&state, &body.mod_version).await?;
    let steam =
        state.config.steam.as_ref().ok_or_else(|| {
            Problem::code(StatusCode::UNAUTHORIZED, AUTH_STEAM_AUTHENTICATION_FAILED)
        })?;
    let authenticated = steam
        .authenticate_ticket(&body.authentication_ticket)
        .await
        .map_err(|error| {
            tracing::warn!(error = %error, "Steam ticket authentication failed");
            Problem::code(StatusCode::UNAUTHORIZED, AUTH_STEAM_AUTHENTICATION_FAILED)
        })?;
    if authenticated != body.steam_id {
        return Err(Problem::code(
            StatusCode::UNAUTHORIZED,
            AUTH_STEAM_ID_MISMATCH,
        ));
    }
    let steam_id = body
        .steam_id
        .parse()
        .map_err(|_| Problem::code(StatusCode::UNAUTHORIZED, AUTH_STEAM_AUTHENTICATION_FAILED))?;
    let steam_user = steam
        .user(&body.steam_id)
        .await
        .map_err(Problem::internal)?;
    let user = state
        .database
        .upsert_user(steam_id, &steam_user.personaname)
        .await
        .map_err(Problem::internal)?;
    if user.banned {
        return Err(Problem::code(StatusCode::UNAUTHORIZED, AUTH_INVALID_TOKEN));
    }
    issue_session(&state, user.id, Provider::Gtr, &body.steam_id, None).await
}

#[derive(Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "PascalCase")]
pub struct RefreshBody {
    mod_version: String,
    steam_id: String,
    login_token: String,
    refresh_token: String,
}

#[utoipa::path(post, path = "/auth/refresh", request_body = RefreshBody, responses((status = 200, body = TokenBody), (status = 400), (status = 401)))]
pub async fn refresh_gtr_session(
    State(state): State<Arc<AppState>>,
    Json(body): Json<RefreshBody>,
) -> ApiResult<Json<TokenBody>> {
    if body.mod_version.is_empty()
        || body.steam_id.is_empty()
        || body.login_token.is_empty()
        || body.refresh_token.is_empty()
    {
        return Err(Problem::code(
            StatusCode::BAD_REQUEST,
            AUTH_MISSING_REQUIRED_FIELDS,
        ));
    }
    require_current_mod(&state, &body.mod_version).await?;
    let steam_id = body
        .steam_id
        .parse()
        .map_err(|_| Problem::code(StatusCode::UNAUTHORIZED, AUTH_USER_NOT_FOUND))?;
    let user = state
        .database
        .get_user(steam_id)
        .await
        .map_err(Problem::internal)?
        .ok_or_else(|| Problem::code(StatusCode::UNAUTHORIZED, AUTH_USER_NOT_FOUND))?;
    if user.banned {
        return Err(Problem::code(StatusCode::UNAUTHORIZED, AUTH_INVALID_TOKEN));
    }
    let pair = state
        .config
        .jwt
        .issue(Provider::Gtr, &body.steam_id, None)
        .map_err(Problem::internal)?;
    let rotated = state
        .database
        .rotate_auth(
            &body.refresh_token,
            zc_database::services::AuthRecord {
                id_user: user.id,
                access_token: &pair.access_token,
                access_token_expiry: pair.access_token_expiry,
                refresh_token: &pair.refresh_token,
                refresh_token_expiry: pair.refresh_token_expiry,
                provider: "gtr",
            },
        )
        .await
        .map_err(Problem::internal)?;
    if !rotated {
        return Err(Problem::code(StatusCode::UNAUTHORIZED, AUTH_INVALID_TOKEN));
    }
    Ok(Json(token_body(pair)))
}

async fn issue_session(
    state: &AppState,
    id_user: i32,
    provider: Provider,
    steam_id: &str,
    discord_id: Option<&str>,
) -> ApiResult<Json<TokenBody>> {
    let pair = state
        .config
        .jwt
        .issue(provider, steam_id, discord_id)
        .map_err(Problem::internal)?;
    state
        .database
        .insert_auth(zc_database::services::AuthRecord {
            id_user,
            access_token: &pair.access_token,
            access_token_expiry: pair.access_token_expiry,
            refresh_token: &pair.refresh_token,
            refresh_token_expiry: pair.refresh_token_expiry,
            provider: match provider {
                Provider::Gtr => "gtr",
                Provider::Steam => "steam",
                Provider::Discord => "discord",
            },
        })
        .await
        .map_err(Problem::internal)?;
    Ok(Json(token_body(pair)))
}

fn token_body(pair: zc_core::jwt::TokenPair) -> TokenBody {
    TokenBody {
        access_token: pair.access_token,
        access_token_expiry: pair.access_token_expiry,
        refresh_token: pair.refresh_token,
        refresh_token_expiry: pair.refresh_token_expiry,
    }
}

async fn require_current_mod(state: &AppState, version: &str) -> ApiResult<()> {
    if state.database.is_mod_outdated(version).await {
        Err(Problem::code(StatusCode::BAD_REQUEST, AUTH_MOD_OUTDATED))
    } else {
        Ok(())
    }
}

#[derive(Deserialize, utoipa::ToSchema)]
pub struct FavouriteBody {
    hash: String,
}

#[utoipa::path(post, path = "/favourite/add", request_body = FavouriteBody, responses((status = 200), (status = 400), (status = 401)))]
pub async fn add_favourite(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<FavouriteBody>,
) -> ApiResult<StatusCode> {
    let user = authenticated_user(&state, &headers, false).await?;
    let level = state
        .database
        .get_level_by_xx_hash(&body.hash)
        .await
        .map_err(Problem::internal)?
        .ok_or_else(|| Problem::code(StatusCode::BAD_REQUEST, LEVEL_NOT_FOUND))?;
    state
        .database
        .add_favourite(user.id, level.id)
        .await
        .map_err(Problem::internal)?;
    Ok(StatusCode::OK)
}

#[utoipa::path(post, path = "/favourite/remove", request_body = FavouriteBody, responses((status = 200), (status = 400), (status = 401)))]
pub async fn remove_favourite(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<FavouriteBody>,
) -> ApiResult<StatusCode> {
    let user = authenticated_user(&state, &headers, false).await?;
    if let Some(level) = state
        .database
        .get_level_by_xx_hash(&body.hash)
        .await
        .map_err(Problem::internal)?
    {
        state
            .database
            .remove_favourite(user.id, level.id)
            .await
            .map_err(Problem::internal)?;
    }
    Ok(StatusCode::OK)
}

#[derive(Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "PascalCase")]
pub struct VoteBody {
    hash: String,
    value: i32,
}

#[utoipa::path(post, path = "/vote/submit", request_body = VoteBody, responses((status = 200), (status = 400), (status = 401)))]
pub async fn submit_vote(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<VoteBody>,
) -> ApiResult<StatusCode> {
    if !valid_xxh128(&body.hash) || !(-2..=2).contains(&body.value) {
        return Err(Problem::code(StatusCode::BAD_REQUEST, VOTE_MISSING_PARAMS));
    }
    let user = authenticated_user(&state, &headers, false).await?;
    let level = state
        .database
        .get_level_by_xx_hash(&body.hash)
        .await
        .map_err(Problem::internal)?
        .ok_or_else(|| Problem::code(StatusCode::BAD_REQUEST, LEVEL_NOT_FOUND))?;
    state
        .database
        .upsert_vote(user.id, level.id, body.value)
        .await
        .map_err(Problem::internal)?;
    Ok(StatusCode::OK)
}

#[derive(Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "PascalCase")]
pub struct LevelRequestBody {
    workshop_id: String,
    hash: String,
}

#[utoipa::path(post, path = "/level/request", request_body = LevelRequestBody, responses((status = 200), (status = 400), (status = 401)))]
pub async fn request_level(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<LevelRequestBody>,
) -> ApiResult<StatusCode> {
    auth::user(&headers, &state, true)?;
    let workshop_id = positive_i64(&body.workshop_id)
        .ok_or_else(|| Problem::code(StatusCode::BAD_REQUEST, INVALID_REQUEST))?;
    if !valid_xxh128(&body.hash) {
        return Err(Problem::code(StatusCode::BAD_REQUEST, INVALID_REQUEST));
    }
    if state
        .database
        .get_level_by_xx_hash(&body.hash)
        .await
        .map_err(Problem::internal)?
        .is_some()
    {
        return Ok(StatusCode::OK);
    }
    if state
        .database
        .claim_level_request(workshop_id, &body.hash)
        .await
        .map_err(Problem::internal)?
    {
        let payload = serde_json::json!({"workshopId": workshop_id.to_string()});
        let key = format!("scan-workshop-item:{workshop_id}");
        if let Err(error) = state
            .queue
            .enqueue(
                TaskIdentifier::ScanWorkshopItem,
                payload,
                JobLane::Bulk,
                Some(&key),
            )
            .await
        {
            state
                .database
                .release_level_request(workshop_id)
                .await
                .map_err(Problem::internal)?;
            tracing::error!(workshop_id, error = %error, "Failed to enqueue workshop scan");
        }
    }
    Ok(StatusCode::OK)
}

#[derive(Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "PascalCase")]
pub struct JobBody {
    task: String,
    options: serde_json::Value,
}

#[utoipa::path(post, path = "/job/trigger", request_body = JobBody, responses((status = 200), (status = 400), (status = 401)))]
pub async fn trigger_job(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<JobBody>,
) -> ApiResult<StatusCode> {
    auth::service_token(&headers, &state.config.trigger_job_token)?;
    let task = TaskIdentifier::parse(&body.task)
        .filter(|task| task.compatible() && task.validate_payload(&body.options))
        .ok_or_else(|| Problem::code(StatusCode::BAD_REQUEST, INVALID_REQUEST))?;
    state
        .queue
        .enqueue(task, body.options, JobLane::Bulk, None)
        .await
        .map_err(Problem::internal)?;
    Ok(StatusCode::OK)
}

#[derive(Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "PascalCase")]
pub struct SteamNameBody {
    name: String,
}

#[utoipa::path(post, path = "/user/updateSteamName", request_body = SteamNameBody, responses((status = 200), (status = 400), (status = 401)))]
pub async fn update_steam_name(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(_body): Json<SteamNameBody>,
) -> ApiResult<StatusCode> {
    let _ = _body.name;
    let claims = auth::user(&headers, &state, true)?;
    let steam_id = claims
        .steamid
        .parse()
        .map_err(|_| Problem::code(StatusCode::UNAUTHORIZED, AUTH_USER_NOT_FOUND))?;
    let user = state
        .database
        .get_user(steam_id)
        .await
        .map_err(Problem::internal)?
        .filter(|user| !user.banned)
        .ok_or_else(|| Problem::code(StatusCode::UNAUTHORIZED, AUTH_USER_NOT_FOUND))?;
    let _ = user;
    Ok(StatusCode::OK)
}

#[derive(Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "PascalCase")]
pub struct DiscordIdBody {
    id: String,
}

#[utoipa::path(post, path = "/user/updateDiscordId", request_body = DiscordIdBody, responses((status = 200), (status = 400), (status = 401)))]
pub async fn update_discord_id(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<DiscordIdBody>,
) -> ApiResult<StatusCode> {
    let claims = auth::user(&headers, &state, false)?;
    let steam_id = claims
        .steamid
        .parse()
        .map_err(|_| Problem::code(StatusCode::UNAUTHORIZED, AUTH_USER_NOT_FOUND))?;
    let _ = state
        .database
        .get_user(steam_id)
        .await
        .map_err(Problem::internal)?
        .filter(|user| !user.banned)
        .ok_or_else(|| Problem::code(StatusCode::UNAUTHORIZED, AUTH_USER_NOT_FOUND))?;
    if body.id.is_empty() {
        return Ok(StatusCode::OK);
    }
    if body.id != "-1" {
        return Err(Problem {
            status: StatusCode::BAD_REQUEST,
            detail: "Positive Discord IDs require OAuth or one-time code verification.".to_owned(),
            error_code: Some("discord_ownership_required".into()),
        });
    }
    state
        .database
        .update_discord_id(steam_id, Some(-1))
        .await
        .map_err(Problem::internal)?;
    Ok(StatusCode::OK)
}

#[derive(Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DiscordLinkCodeBody {
    code: String,
    expires_at: String,
}

#[utoipa::path(post, path = "/user/discord/link-code", responses((status = 200, body = DiscordLinkCodeBody), (status = 400), (status = 401)))]
pub async fn create_discord_link_code(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> ApiResult<Json<DiscordLinkCodeBody>> {
    let user = authenticated_user(&state, &headers, false).await?;
    let mut last_error = None;
    for _ in 0..5 {
        let code = zc_core::discord::random_link_code();
        let code_hash = state
            .config
            .jwt
            .discord_link_hash("code", &code)
            .map_err(Problem::internal)?;
        match state
            .database
            .create_discord_link_code(user.id, &code_hash)
            .await
        {
            Ok(expires_at) => return Ok(Json(DiscordLinkCodeBody { code, expires_at })),
            Err(error) => last_error = Some(error),
        }
    }
    Err(Problem::internal(last_error.unwrap_or_else(|| {
        anyhow::anyhow!("Unable to generate Discord link code")
    })))
}

#[utoipa::path(delete, path = "/user/discord", responses((status = 204), (status = 400), (status = 401)))]
pub async fn unlink_discord(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> ApiResult<StatusCode> {
    let claims = auth::user(&headers, &state, false)?;
    let steam_id = claims
        .steamid
        .parse()
        .map_err(|_| Problem::code(StatusCode::UNAUTHORIZED, AUTH_USER_NOT_FOUND))?;
    state
        .database
        .unlink_discord_by_steam_id(steam_id)
        .await
        .map_err(Problem::internal)?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RedeemDiscordLinkBody {
    code: String,
    discord_id: String,
}

#[derive(Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DiscordLinkedBody {
    status: &'static str,
    id_user: i32,
    steam_id: Option<String>,
}

#[derive(Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DiscordUnlinkedBody {
    id_user: i32,
    discord_id: Option<String>,
}

#[utoipa::path(post, path = "/discord-bot/link/redeem", request_body = RedeemDiscordLinkBody, responses((status = 200, body = DiscordLinkedBody), (status = 400), (status = 401), (status = 409)))]
pub async fn redeem_discord_link_code(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<RedeemDiscordLinkBody>,
) -> ApiResult<Json<DiscordLinkedBody>> {
    require_discord_bot(&state, &headers)?;
    if body.code.len() != 8 || !body.code.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err(named_problem(
            StatusCode::BAD_REQUEST,
            "Invalid request",
            "invalid",
        ));
    }
    let discord_id = parse_snowflake(&body.discord_id)?;
    let code_hash = state
        .config
        .jwt
        .discord_link_hash("code", &body.code)
        .map_err(Problem::internal)?;
    let result = state
        .database
        .consume_discord_link_code(&code_hash, discord_id)
        .await
        .map_err(Problem::internal)?;
    match result.status {
        DiscordLinkStatus::Linked => Ok(Json(DiscordLinkedBody {
            status: "linked",
            id_user: result.id_user.expect("linked result has user"),
            steam_id: result.steam_id.map(|value| value.to_string()),
        })),
        DiscordLinkStatus::Conflict => {
            Err(named_problem(StatusCode::CONFLICT, "Conflict", "conflict"))
        }
        DiscordLinkStatus::Expired => Err(named_problem(
            StatusCode::BAD_REQUEST,
            "Invalid request",
            "expired",
        )),
        DiscordLinkStatus::Invalid => Err(named_problem(
            StatusCode::BAD_REQUEST,
            "Invalid request",
            "invalid",
        )),
        DiscordLinkStatus::Consumed => Err(named_problem(
            StatusCode::BAD_REQUEST,
            "Invalid request",
            "consumed",
        )),
    }
}

#[utoipa::path(delete, path = "/discord-bot/users/{discord_id}/link", params(("discord_id" = String, Path)), responses((status = 200, body = DiscordUnlinkedBody), (status = 401)))]
pub async fn unlink_discord_bot_user(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(discord_id): Path<String>,
) -> ApiResult<Json<Option<DiscordUnlinkedBody>>> {
    require_discord_bot(&state, &headers)?;
    let unlinked = state
        .database
        .unlink_discord_by_discord_id(parse_snowflake(&discord_id)?)
        .await
        .map_err(Problem::internal)?;
    Ok(Json(unlinked.map(|user| DiscordUnlinkedBody {
        id_user: user.id_user,
        discord_id: user.discord_id.map(|value| value.to_string()),
    })))
}

#[utoipa::path(get, path = "/discord-bot/users/{discord_id}", params(("discord_id" = String, Path)), responses((status = 200), (status = 401)))]
pub async fn get_discord_bot_user(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(discord_id): Path<String>,
) -> ApiResult<Json<zc_database::services::discord::DiscordUserState>> {
    require_discord_bot(&state, &headers)?;
    Ok(Json(
        state
            .database
            .discord_user_state(parse_snowflake(&discord_id)?)
            .await
            .map_err(Problem::internal)?,
    ))
}

#[derive(Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DiscordPreferenceBody {
    ping_on_world_record_loss: bool,
}

#[utoipa::path(patch, path = "/discord-bot/users/{discord_id}/preferences", params(("discord_id" = String, Path)), request_body = DiscordPreferenceBody, responses((status = 200), (status = 401)))]
pub async fn update_discord_bot_preferences(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(discord_id): Path<String>,
    Json(body): Json<DiscordPreferenceBody>,
) -> ApiResult<Json<zc_database::services::discord::DiscordUserPreference>> {
    require_discord_bot(&state, &headers)?;
    Ok(Json(
        state
            .database
            .set_discord_user_preference(
                parse_snowflake(&discord_id)?,
                body.ping_on_world_record_loss,
            )
            .await
            .map_err(Problem::internal)?,
    ))
}

#[derive(Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DiscordWatchBody {
    kind: String,
    target_id: String,
}

#[utoipa::path(post, path = "/discord-bot/users/{discord_id}/watches", params(("discord_id" = String, Path)), request_body = DiscordWatchBody, responses((status = 200), (status = 400), (status = 401)))]
pub async fn add_discord_bot_watch(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(discord_id): Path<String>,
    Json(body): Json<DiscordWatchBody>,
) -> ApiResult<Json<zc_database::services::discord::DiscordWatch>> {
    require_discord_bot(&state, &headers)?;
    let target_id = body.target_id.trim();
    if !valid_discord_watch_kind(&body.kind) || target_id.is_empty() || target_id.len() > 128 {
        return Err(named_problem(
            StatusCode::BAD_REQUEST,
            "Invalid request",
            "invalid",
        ));
    }
    Ok(Json(
        state
            .database
            .add_discord_watch(parse_snowflake(&discord_id)?, &body.kind, target_id)
            .await
            .map_err(Problem::internal)?,
    ))
}

#[utoipa::path(delete, path = "/discord-bot/users/{discord_id}/watches/{watch_id}", params(("discord_id" = String, Path), ("watch_id" = String, Path)), responses((status = 200), (status = 400), (status = 401)))]
pub async fn remove_discord_bot_watch(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((discord_id, watch_id)): Path<(String, String)>,
) -> ApiResult<Json<Option<zc_database::services::discord::DiscordWatch>>> {
    require_discord_bot(&state, &headers)?;
    Ok(Json(
        state
            .database
            .remove_discord_watch(
                parse_snowflake(&discord_id)?,
                parse_positive_bigint(&watch_id)?,
            )
            .await
            .map_err(Problem::internal)?,
    ))
}

fn require_discord_bot(state: &AppState, headers: &HeaderMap) -> ApiResult<()> {
    auth::service_token(headers, &state.config.discord_bot_api_token).map_err(|_| {
        named_problem(
            StatusCode::UNAUTHORIZED,
            "Not authenticated",
            "invalid_bot_token",
        )
    })
}

fn parse_snowflake(value: &str) -> ApiResult<i64> {
    if value.is_empty() || value.len() > 20 || !value.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err(named_problem(
            StatusCode::BAD_REQUEST,
            "Invalid request",
            "invalid",
        ));
    }
    value
        .parse()
        .map_err(|_| named_problem(StatusCode::BAD_REQUEST, "Invalid request", "invalid"))
}

fn parse_positive_bigint(value: &str) -> ApiResult<i64> {
    value
        .parse()
        .ok()
        .filter(|value| *value > 0)
        .ok_or_else(|| named_problem(StatusCode::BAD_REQUEST, "Invalid request", "invalid"))
}

fn valid_discord_watch_kind(value: &str) -> bool {
    matches!(value, "player" | "level" | "author" | "tournament")
}

fn named_problem(status: StatusCode, detail: &str, code: &str) -> Problem {
    Problem {
        status,
        detail: detail.to_owned(),
        error_code: Some(code.into()),
    }
}

#[utoipa::path(post, path = "/auth/web/refresh", responses((status = 200), (status = 400), (status = 401), (status = 404)))]
pub async fn refresh_web_session(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> ApiResult<impl IntoResponse> {
    let cookie = headers
        .get(header::COOKIE)
        .and_then(|value| value.to_str().ok());
    let refresh = zc_core::cookies::get_cookie(cookie, zc_core::cookies::REFRESH_TOKEN)
        .ok_or_else(|| Problem::code(StatusCode::BAD_REQUEST, 14))?;
    let steam_text = zc_core::cookies::get_cookie(cookie, zc_core::cookies::STEAM_ID)
        .ok_or_else(|| Problem::code(StatusCode::BAD_REQUEST, 14))?;
    let steam_id = steam_text
        .parse()
        .map_err(|_| Problem::code(StatusCode::NOT_FOUND, AUTH_USER_NOT_FOUND))?;
    let user = state
        .database
        .get_user(steam_id)
        .await
        .map_err(Problem::internal)?
        .ok_or_else(|| Problem::code(StatusCode::NOT_FOUND, AUTH_USER_NOT_FOUND))?;
    if user.banned {
        return Err(Problem::code(StatusCode::UNAUTHORIZED, 15));
    }
    let pair = state
        .config
        .jwt
        .issue(Provider::Steam, &steam_text, None)
        .map_err(Problem::internal)?;
    let rotated = state
        .database
        .rotate_auth(
            &refresh,
            zc_database::services::AuthRecord {
                id_user: user.id,
                access_token: &pair.access_token,
                access_token_expiry: pair.access_token_expiry,
                refresh_token: &pair.refresh_token,
                refresh_token_expiry: pair.refresh_token_expiry,
                provider: "steam",
            },
        )
        .await
        .map_err(Problem::internal)?;
    if !rotated {
        return Err(Problem::code(StatusCode::UNAUTHORIZED, 15));
    }
    let mut response = StatusCode::OK.into_response();
    for cookie in session_cookies(&state, &pair, &steam_text)? {
        response.headers_mut().append(
            header::SET_COOKIE,
            HeaderValue::from_str(&cookie).map_err(|error| Problem::internal(error.into()))?,
        );
    }
    Ok(response)
}

async fn authenticated_user(
    state: &AppState,
    headers: &HeaderMap,
    gtr_only: bool,
) -> ApiResult<zc_database::services::UserAccount> {
    let claims = auth::user(headers, state, gtr_only)?;
    let steam_id = claims
        .steamid
        .parse()
        .map_err(|_| Problem::code(StatusCode::UNAUTHORIZED, AUTH_USER_NOT_FOUND))?;
    state
        .database
        .get_user(steam_id)
        .await
        .map_err(Problem::internal)?
        .filter(|user| !user.banned)
        .ok_or_else(|| Problem::code(StatusCode::UNAUTHORIZED, AUTH_USER_NOT_FOUND))
}

fn valid_xxh128(value: &str) -> bool {
    value.len() == 32
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'A'..=b'F').contains(&byte))
}
fn positive_i64(value: &str) -> Option<i64> {
    if value.starts_with('0') {
        None
    } else {
        value.parse().ok().filter(|value| *value > 0)
    }
}

fn session_cookies(
    state: &AppState,
    pair: &zc_core::jwt::TokenPair,
    steam_id: &str,
) -> ApiResult<Vec<String>> {
    let now = i64::try_from(
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| Problem::internal(error.into()))?
            .as_secs(),
    )
    .map_err(|error| Problem::internal(error.into()))?;
    let local = state.config.backend_url.contains("localhost")
        || state.config.backend_url.contains("127.0.0.1");
    let domain = if local {
        String::new()
    } else {
        let parsed = url::Url::parse(&state.config.frontend_url)
            .map_err(|error| Problem::internal(error.into()))?;
        let host = parsed
            .host_str()
            .ok_or_else(|| Problem::internal(anyhow::anyhow!("FRONTEND_URL has no hostname")))?;
        format!("Domain=.{host}; ")
    };
    let secure = if local { "" } else { "Secure; " };
    let access_age = (pair.access_token_expiry - now).max(0);
    let refresh_age = (pair.refresh_token_expiry - now).max(0);
    Ok(vec![
        format!(
            "{}={}; Path=/; Max-Age={access_age}; {domain}SameSite=Lax; {secure}HttpOnly",
            zc_core::cookies::ACCESS_TOKEN,
            pair.access_token
        ),
        format!(
            "{}={}; Path=/; Max-Age={refresh_age}; {domain}SameSite=Lax; {secure}HttpOnly",
            zc_core::cookies::REFRESH_TOKEN,
            pair.refresh_token
        ),
        format!(
            "{}={steam_id}; Path=/; Max-Age={refresh_age}; {domain}SameSite=Lax; {secure}",
            zc_core::cookies::STEAM_ID
        ),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_existing_v1_hash_and_workshop_contracts() {
        assert!(valid_xxh128("0123456789ABCDEF0123456789ABCDEF"));
        assert!(!valid_xxh128("0123456789abcdef0123456789abcdef"));
        assert_eq!(positive_i64("9223372036854775807"), Some(i64::MAX));
        assert_eq!(positive_i64("0"), None);
        assert_eq!(positive_i64("01"), None);
    }

    #[test]
    fn validates_discord_snowflakes_for_bigint_storage() {
        assert_eq!(
            parse_snowflake("123456789012345678").unwrap(),
            123_456_789_012_345_678
        );
        assert!(parse_snowflake("").is_err());
        assert!(parse_snowflake("discord").is_err());
        assert!(parse_snowflake("99999999999999999999").is_err());
        assert!(valid_discord_watch_kind("tournament"));
        assert!(!valid_discord_watch_kind("unknown"));
        assert_eq!(parse_positive_bigint("1").unwrap(), 1);
        assert!(parse_positive_bigint("0").is_err());
    }
}
