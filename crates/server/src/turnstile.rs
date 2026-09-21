use crate::{AppState, problem::Problem, rate_limit};
use axum::{
    Json,
    extract::{FromRequest, State},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use std::{sync::Arc, time::Duration};

const SITEVERIFY_URL: &str = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

#[derive(Deserialize, utoipa::ToSchema)]
#[serde(deny_unknown_fields)]
pub struct TurnstileBody {
    token: String,
}

#[derive(Serialize, utoipa::ToSchema)]
pub struct TurnstileSuccess {
    success: bool,
}

#[derive(Serialize)]
struct SiteverifyRequest<'a> {
    secret: &'a str,
    response: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    remoteip: Option<&'a str>,
}

#[derive(Deserialize)]
struct SiteverifyResponse {
    success: bool,
    action: Option<String>,
    hostname: Option<String>,
}

#[utoipa::path(post, path = "/turnstile/verify", request_body = TurnstileBody, responses((status = 200, body = TurnstileSuccess), (status = 403), (status = 503)))]
pub async fn verify(
    State(state): State<Arc<AppState>>,
    request: axum::extract::Request,
) -> Result<Json<TurnstileSuccess>, Problem> {
    let remote_ip = rate_limit::client_ip(&request, state.config.trust_proxy);
    let Json(body): Json<TurnstileBody> = Json::from_request(request, &state)
        .await
        .map_err(|_| Problem::code(StatusCode::BAD_REQUEST, crate::problem::INVALID_REQUEST))?;
    if body.token.is_empty() || body.token.len() > 2_048 {
        return Err(Problem::code(
            StatusCode::BAD_REQUEST,
            crate::problem::INVALID_REQUEST,
        ));
    }
    let response = state
        .http
        .post(SITEVERIFY_URL)
        .timeout(Duration::from_secs(10))
        .json(&SiteverifyRequest {
            secret: &state.config.turnstile_secret,
            response: &body.token,
            remoteip: (remote_ip != "unknown").then_some(remote_ip.as_str()),
        })
        .send()
        .await
        .map_err(|_| unavailable())?;
    if !response.status().is_success() {
        return Err(unavailable());
    }
    let result: SiteverifyResponse = response.json().await.map_err(|_| unavailable())?;
    if !accepted(&result, &state.config.turnstile_hostnames) {
        return Err(Problem {
            status: StatusCode::FORBIDDEN,
            detail: "Turnstile verification failed".to_owned(),
            error_code: None,
        });
    }
    Ok(Json(TurnstileSuccess { success: true }))
}

fn accepted(result: &SiteverifyResponse, allowed_hostnames: &[String]) -> bool {
    let hostname = result.hostname.as_deref().map(str::to_lowercase);
    result.success
        && result.action.as_deref() == Some("record-replay")
        && hostname
            .as_ref()
            .is_some_and(|hostname| allowed_hostnames.contains(hostname))
}

fn unavailable() -> Problem {
    Problem {
        status: StatusCode::SERVICE_UNAVAILABLE,
        detail: "Turnstile verification unavailable".to_owned(),
        error_code: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn requires_success_action_and_allowed_hostname() {
        let allowed = vec!["zeepki.st".to_owned()];
        assert!(accepted(
            &SiteverifyResponse {
                success: true,
                action: Some("record-replay".to_owned()),
                hostname: Some("ZEEPKI.ST".to_owned()),
            },
            &allowed
        ));
        assert!(!accepted(
            &SiteverifyResponse {
                success: true,
                action: Some("login".to_owned()),
                hostname: Some("zeepki.st".to_owned()),
            },
            &allowed
        ));
        assert!(!accepted(
            &SiteverifyResponse {
                success: true,
                action: Some("record-replay".to_owned()),
                hostname: Some("attacker.example".to_owned()),
            },
            &allowed
        ));
    }
}
