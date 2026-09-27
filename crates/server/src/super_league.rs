use crate::{
    AppState, auth,
    problem::{AUTH_INVALID_TOKEN, AUTH_USER_NOT_FOUND, INVALID_REQUEST, Problem},
    turnstile,
};
use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use zc_core::jwt::Provider;
use zc_database::services::{UserAccount, super_league::VoteSnapshot};

type ApiResult<T> = Result<T, Problem>;

#[derive(Deserialize, utoipa::IntoParams)]
#[serde(rename_all = "camelCase")]
pub struct VoteQuery {
    round_id: Option<i32>,
}

#[derive(Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct VoteBody {
    round_id: i32,
    vote_type: i16,
    level_ids: Vec<i32>,
    turnstile_token: String,
}

#[derive(Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct VoteSaved {
    saved: bool,
}

async fn web_user(state: &AppState, headers: &HeaderMap) -> ApiResult<UserAccount> {
    let claims = auth::user(headers, state, false)?;
    if claims.provider == Provider::Gtr {
        return Err(Problem::code(StatusCode::UNAUTHORIZED, AUTH_INVALID_TOKEN));
    }
    let steam_id: i64 = claims
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

#[utoipa::path(get, path = "/super-league/vote", params(VoteQuery), responses((status = 200, body = Option<VoteSnapshot>), (status = 401)))]
pub async fn get_vote(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<VoteQuery>,
) -> ApiResult<Json<Option<VoteSnapshot>>> {
    let user = web_user(&state, &headers).await?;
    if query.round_id.is_some_and(|id| id <= 0) {
        return Err(Problem::code(StatusCode::BAD_REQUEST, INVALID_REQUEST));
    }
    let snapshot = state
        .database
        .super_league_vote_snapshot(
            query.round_id,
            user.id,
            &user.steam_id.map(|id| id.to_string()).unwrap_or_default(),
        )
        .await
        .map_err(Problem::internal)?;
    Ok(Json(snapshot))
}

#[utoipa::path(post, path = "/super-league/vote", request_body = VoteBody, responses((status = 200, body = VoteSaved), (status = 400), (status = 401), (status = 403)))]
pub async fn post_vote(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<VoteBody>,
) -> ApiResult<Json<VoteSaved>> {
    let user = web_user(&state, &headers).await?;
    let limit = match body.vote_type {
        1 => 14,
        2 | 3 => 3,
        _ => 0,
    };
    if body.round_id <= 0
        || body.level_ids.is_empty()
        || body.level_ids.len() > limit
        || body.level_ids.iter().any(|id| *id <= 0)
        || body.turnstile_token.len() > 2_048
    {
        return Err(Problem::code(StatusCode::BAD_REQUEST, INVALID_REQUEST));
    }
    turnstile::verify_token(&state, &body.turnstile_token, None, "zsl-vote").await?;
    let saved = state
        .database
        .replace_super_league_ballot(
            body.round_id,
            user.id,
            &user.steam_id.map(|id| id.to_string()).unwrap_or_default(),
            body.vote_type,
            &body.level_ids,
        )
        .await
        .map_err(Problem::internal)?;
    if !saved {
        return Err(Problem::code(StatusCode::BAD_REQUEST, INVALID_REQUEST));
    }
    Ok(Json(VoteSaved { saved }))
}

fn unavailable() -> Problem {
    Problem::service_unavailable()
}

#[utoipa::path(get, path = "/super-league/submit-level", responses((status = 401), (status = 503)))]
pub async fn unavailable_get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> ApiResult<StatusCode> {
    web_user(&state, &headers).await?;
    Err(unavailable())
}
#[utoipa::path(post, path = "/super-league/submit-level", responses((status = 401), (status = 503)))]
pub async fn unavailable_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> ApiResult<StatusCode> {
    unavailable_get(State(state), headers).await
}
#[utoipa::path(delete, path = "/super-league/submit-level", responses((status = 401), (status = 503)))]
pub async fn unavailable_delete(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> ApiResult<StatusCode> {
    unavailable_get(State(state), headers).await
}
#[utoipa::path(get, path = "/super-league/submission-status/{id}", params(("id" = i64, Path, description = "Submission ID")), responses((status = 401), (status = 503)))]
pub async fn unavailable_status(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(_id): Path<i64>,
) -> ApiResult<StatusCode> {
    unavailable_get(State(state), headers).await
}
