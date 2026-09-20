use axum::{
    Json,
    http::{HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
};
use serde::Serialize;

pub const INTERNAL: i32 = 0;
pub const AUTH_MISSING_REQUIRED_FIELDS: i32 = 8;
pub const AUTH_MOD_OUTDATED: i32 = 9;
pub const AUTH_STEAM_ID_MISMATCH: i32 = 10;
pub const AUTH_STEAM_AUTHENTICATION_FAILED: i32 = 11;
pub const AUTH_MISSING_TOKEN: i32 = 14;
pub const AUTH_INVALID_TOKEN: i32 = 15;
pub const AUTH_USER_NOT_FOUND: i32 = 16;
pub const AUTH_DISCORD_NOT_LINKED: i32 = 24;
pub const VOTE_MISSING_PARAMS: i32 = 17;
pub const LEVEL_NOT_FOUND: i32 = 18;
pub const RECORD_SUBMIT_MISSING_PARAMS: i32 = 19;
pub const RECORD_SUBMIT_FAILED: i32 = 20;
pub const INVALID_REQUEST: i32 = 22;

#[derive(Debug)]
pub struct Problem {
    pub status: StatusCode,
    pub detail: String,
    pub error_code: Option<serde_json::Value>,
}

#[derive(Serialize)]
struct Body<'a> {
    #[serde(rename = "type")]
    kind: &'static str,
    title: &'static str,
    status: u16,
    detail: &'a str,
    #[serde(rename = "errorCode", skip_serializing_if = "Option::is_none")]
    error_code: Option<&'a serde_json::Value>,
}

impl Problem {
    pub fn code(status: StatusCode, code: i32) -> Self {
        let detail = match code {
            AUTH_MISSING_REQUIRED_FIELDS => "Missing required fields",
            AUTH_MOD_OUTDATED => "Mod version is outdated",
            AUTH_STEAM_ID_MISMATCH => "Steam ID mismatch",
            AUTH_STEAM_AUTHENTICATION_FAILED => "Steam authentication failed",
            AUTH_MISSING_TOKEN => "Not authenticated",
            AUTH_INVALID_TOKEN => "Invalid or expired token",
            AUTH_USER_NOT_FOUND => "User not found",
            AUTH_DISCORD_NOT_LINKED => "Discord account not linked",
            VOTE_MISSING_PARAMS => "Missing required parameters",
            LEVEL_NOT_FOUND => "Level not found",
            RECORD_SUBMIT_MISSING_PARAMS => "Missing required parameters",
            RECORD_SUBMIT_FAILED => "Failed to submit record",
            INVALID_REQUEST => "Invalid request",
            _ => "Internal server error",
        };
        Self {
            status,
            detail: detail.to_owned(),
            error_code: Some(code.into()),
        }
    }

    pub fn internal(error: anyhow::Error) -> Self {
        if error.chain().any(zc_database::is_unavailable_error) {
            return Self::unavailable(error);
        }
        tracing::error!(error = %error, "API operation failed");
        Self::code(StatusCode::INTERNAL_SERVER_ERROR, INTERNAL)
    }

    pub fn unavailable(error: anyhow::Error) -> Self {
        tracing::warn!(error = %error, "Database unavailable");
        Self {
            status: StatusCode::SERVICE_UNAVAILABLE,
            detail: "Service unavailable".to_owned(),
            error_code: None,
        }
    }
}

impl IntoResponse for Problem {
    fn into_response(self) -> Response {
        let title = self.status.canonical_reason().unwrap_or("Error");
        let body = Body {
            kind: "about:blank",
            title,
            status: self.status.as_u16(),
            detail: &self.detail,
            error_code: self.error_code.as_ref(),
        };
        let mut response = (self.status, Json(body)).into_response();
        response.headers_mut().insert(
            header::CONTENT_TYPE,
            HeaderValue::from_static("application/problem+json"),
        );
        response
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn pool_acquisition_failure_maps_to_service_unavailable() {
        let error = zc_database::PoolAcquireError::from_snapshot(
            "application",
            Duration::from_secs(5),
            zc_database::PoolSnapshot {
                physical_limit: 7,
                physical_connections: 7,
                idle_connections: 0,
                partition_limit: 5,
                partition_available: 0,
                waiting_acquisitions: 1,
                pending_gets: 1,
                connections_created: 7,
                connection_failures: 0,
                acquisition_timeouts: 1,
                last_connection_failure: None,
            },
            None,
        );
        let problem = Problem::internal(anyhow::Error::new(error).context("query failed"));
        assert_eq!(problem.status, StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(problem.detail, "Service unavailable");
        assert!(problem.error_code.is_none());
    }

    #[test]
    fn other_internal_failure_stays_internal_server_error() {
        let problem = Problem::internal(anyhow::anyhow!("broken query"));
        assert_eq!(problem.status, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(problem.error_code, Some(INTERNAL.into()));
    }
}
