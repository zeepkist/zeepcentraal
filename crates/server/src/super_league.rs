use crate::{
    AppState, auth,
    problem::{AUTH_INVALID_TOKEN, AUTH_USER_NOT_FOUND, INVALID_REQUEST, Problem},
    turnstile,
};
use axum::{
    Json,
    extract::{Path, Query, State, rejection::QueryRejection},
    http::{HeaderMap, StatusCode},
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use zc_core::jwt::Provider;
use zc_database::services::{
    UserAccount,
    super_league::{VoteResultsSnapshot, VoteSnapshot},
};

type ApiResult<T> = Result<T, Problem>;

#[derive(Deserialize, utoipa::IntoParams)]
#[serde(rename_all = "camelCase")]
pub struct VoteResultsQuery {
    round_id: i32,
}

#[utoipa::path(get, path = "/super-league/vote-results", params(VoteResultsQuery), responses((status = 200, body = VoteResultsSnapshot), (status = 400), (status = 404)))]
pub async fn get_vote_results(
    State(state): State<Arc<AppState>>,
    query: Result<Query<VoteResultsQuery>, QueryRejection>,
) -> ApiResult<impl axum::response::IntoResponse> {
    let Query(query) =
        query.map_err(|_| Problem::code(StatusCode::BAD_REQUEST, INVALID_REQUEST))?;
    if query.round_id <= 0 {
        return Err(Problem::code(StatusCode::BAD_REQUEST, INVALID_REQUEST));
    }
    let snapshot = state
        .database
        .super_league_vote_results(query.round_id)
        .await
        .map_err(Problem::internal)?
        .ok_or_else(|| Problem::code(StatusCode::NOT_FOUND, INVALID_REQUEST))?;
    Ok((
        [(axum::http::header::CACHE_CONTROL, "no-store")],
        Json(snapshot),
    ))
}

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
) -> ApiResult<impl axum::response::IntoResponse> {
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
    Ok((
        [(axum::http::header::CACHE_CONTROL, "private, no-store")],
        Json(snapshot),
    ))
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

#[derive(Deserialize, utoipa::IntoParams)]
#[serde(rename_all = "camelCase")]
pub struct ContestQuery {
    round_id: Option<i32>,
    season_id: Option<i32>,
}
#[derive(Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SubmissionBody {
    round_id: i32,
    workshop_id: String,
    authors: Vec<String>,
}
fn submission_problem(error: anyhow::Error) -> Problem {
    use zc_database::services::submissions::SubmissionError;
    if let Some(reason) = error.downcast_ref::<SubmissionError>() {
        let status = if matches!(reason, SubmissionError::Conflict) {
            StatusCode::CONFLICT
        } else {
            StatusCode::BAD_REQUEST
        };
        let mut problem = Problem::code(status, INVALID_REQUEST);
        problem.detail = reason.to_string();
        return problem;
    }
    Problem::internal(error)
}
#[utoipa::path(get,path="/super-league/contests",params(ContestQuery),responses((status=200)))]
pub async fn get_contests(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ContestQuery>,
) -> ApiResult<impl axum::response::IntoResponse> {
    if query.round_id.is_some_and(|id| id <= 0) || query.season_id.is_some_and(|id| id <= 0) {
        return Err(Problem::code(StatusCode::BAD_REQUEST, INVALID_REQUEST));
    }
    Ok((
        [(axum::http::header::CACHE_CONTROL, "no-store")],
        Json(
            state
                .database
                .submission_contests(query.season_id, query.round_id)
                .await
                .map_err(Problem::internal)?,
        ),
    ))
}
#[utoipa::path(get,path="/super-league/submit-level",params(ContestQuery),responses((status=200),(status=401)))]
pub async fn get_submission(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ContestQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let user = web_user(&state, &headers).await?;
    if query.round_id.is_some_and(|id| id <= 0) {
        return Err(Problem::code(StatusCode::BAD_REQUEST, INVALID_REQUEST));
    }
    Ok(Json(
        state
            .database
            .viewer_submission(
                query.round_id,
                &user.steam_id.unwrap_or_default().to_string(),
            )
            .await
            .map_err(Problem::internal)?,
    ))
}
#[utoipa::path(post,path="/super-league/submit-level",request_body=SubmissionBody,responses((status=202,body=i64),(status=400),(status=401),(status=409)))]
pub async fn post_submission(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<SubmissionBody>,
) -> ApiResult<(StatusCode, Json<i64>)> {
    let user = web_user(&state, &headers).await?;
    let workshop = body.workshop_id.parse::<i64>().ok().filter(|id| *id > 0);
    if body.round_id <= 0
        || body.workshop_id.len() > 19
        || body.workshop_id.starts_with('0')
        || !body.workshop_id.bytes().all(|b| b.is_ascii_digit())
        || workshop.is_none()
    {
        return Err(Problem::code(StatusCode::BAD_REQUEST, INVALID_REQUEST));
    }
    let id = state
        .database
        .submit_level(
            body.round_id,
            workshop.unwrap_or_default(),
            &body.authors,
            &user.steam_id.unwrap_or_default().to_string(),
        )
        .await
        .map_err(submission_problem)?;
    Ok((StatusCode::ACCEPTED, Json(id)))
}
#[utoipa::path(delete,path="/super-league/submit-level",params(ContestQuery),responses((status=204),(status=400),(status=401)))]
pub async fn delete_submission(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ContestQuery>,
) -> ApiResult<StatusCode> {
    let user = web_user(&state, &headers).await?;
    let round = query
        .round_id
        .filter(|id| *id > 0)
        .ok_or_else(|| Problem::code(StatusCode::BAD_REQUEST, INVALID_REQUEST))?;
    state
        .database
        .withdraw_submission(round, &user.steam_id.unwrap_or_default().to_string())
        .await
        .map_err(submission_problem)?;
    Ok(StatusCode::NO_CONTENT)
}
#[utoipa::path(get,path="/super-league/submission-status/{id}",params(("id"=i64,Path,description="Submission ID")),responses((status=200),(status=401),(status=404)))]
pub async fn get_submission_status(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<i64>,
) -> ApiResult<Json<serde_json::Value>> {
    let user = web_user(&state, &headers).await?;
    state
        .database
        .submission_status(id, &user.steam_id.unwrap_or_default().to_string())
        .await
        .map_err(Problem::internal)?
        .map(Json)
        .ok_or_else(|| Problem::code(StatusCode::NOT_FOUND, INVALID_REQUEST))
}
