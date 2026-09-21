use crate::{
    AppState,
    problem::{AUTH_INVALID_TOKEN, AUTH_MISSING_TOKEN, Problem},
};
use axum::http::{HeaderMap, StatusCode, header};
use subtle::ConstantTimeEq;
use zc_core::jwt::{AccessTokenClaims, Provider};

pub fn user(
    headers: &HeaderMap,
    state: &AppState,
    gtr_only: bool,
) -> Result<AccessTokenClaims, Problem> {
    let bearer = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "));
    let cookie_header = headers
        .get(header::COOKIE)
        .and_then(|value| value.to_str().ok());
    let cookie = zc_core::cookies::get_cookie(cookie_header, zc_core::cookies::ACCESS_TOKEN);
    let token = bearer
        .map(str::to_owned)
        .or(cookie)
        .ok_or_else(|| Problem::code(StatusCode::BAD_REQUEST, AUTH_MISSING_TOKEN))?;
    let claims = state
        .config
        .jwt
        .verify(&token)
        .map_err(|_| Problem::code(StatusCode::UNAUTHORIZED, AUTH_INVALID_TOKEN))?;
    if gtr_only && claims.provider != Provider::Gtr {
        return Err(Problem::code(StatusCode::UNAUTHORIZED, AUTH_INVALID_TOKEN));
    }
    Ok(claims)
}

pub fn service_token(headers: &HeaderMap, expected: &str) -> Result<(), Problem> {
    let Some(value) = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
    else {
        return Err(Problem::code(StatusCode::UNAUTHORIZED, AUTH_INVALID_TOKEN));
    };
    if !bool::from(value.as_bytes().ct_eq(expected.as_bytes())) {
        return Err(Problem::code(StatusCode::UNAUTHORIZED, AUTH_INVALID_TOKEN));
    }
    Ok(())
}
