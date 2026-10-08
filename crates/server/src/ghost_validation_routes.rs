use crate::{AppState, auth, problem::Problem};
use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
};
use serde::Deserialize;
use serde_json::{Value, json};
use std::sync::Arc;
use zc_core::object_storage::DownloadConstraints;

static COMPARISON_SLOTS: tokio::sync::Semaphore = tokio::sync::Semaphore::const_new(2);

async fn administrator(state: &AppState, headers: &HeaderMap) -> Result<(), Problem> {
    let claims = auth::user(headers, state, false)?;
    if claims.provider == zc_core::jwt::Provider::Gtr {
        return Err(denied());
    }
    let steam = claims.steamid.parse::<i64>().map_err(|_| denied())?;
    let allowed = state
        .database
        .is_administrator(steam)
        .await
        .map_err(Problem::internal)?;
    if !allowed {
        return Err(denied());
    }
    Ok(())
}
fn denied() -> Problem {
    Problem {
        status: StatusCode::FORBIDDEN,
        detail: "Admin access required".into(),
        error_code: None,
    }
}
fn private_json(value: Value) -> Response {
    ([(header::CACHE_CONTROL, "private, no-store")], Json(value)).into_response()
}
#[derive(Deserialize)]
pub struct Filters {
    #[serde(default)]
    after: i64,
    record: Option<i32>,
    status: Option<String>,
    #[serde(default, rename = "history")]
    _history: bool,
    #[serde(flatten)]
    filter: serde_json::Map<String, Value>,
}
pub async fn list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(filter): Query<Filters>,
) -> Result<Response, Problem> {
    administrator(&state, &headers).await?;
    let mut extra = Value::Object(filter.filter);
    if let Some(value) = extra["idLevel"].as_str() {
        extra["idLevel"] = json!(value.parse::<i32>().map_err(|_| denied())?);
    }
    if !zc_jobs::TaskIdentifier::AuditRecordGhosts.validate_external_payload(&extra) {
        return Err(Problem {
            status: StatusCode::BAD_REQUEST,
            detail: "Invalid review filter".into(),
            error_code: None,
        });
    }
    let rows = state
        .database
        .admin_validations(
            filter.after.max(0),
            filter.record,
            filter.status.as_deref(),
            &extra,
        )
        .await
        .map_err(Problem::internal)?;
    Ok(private_json(json!({"attempts":rows})))
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Comparison {
    id_level: i32,
}
pub async fn compare(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<i32>,
    Json(payload): Json<Comparison>,
) -> Result<Response, Problem> {
    administrator(&state, &headers).await?;
    if headers.get(header::AUTHORIZATION).is_none()
        && !headers
            .get(header::ORIGIN)
            .and_then(|v| v.to_str().ok())
            .is_some_and(|origin| {
                state
                    .config
                    .cors_origins
                    .iter()
                    .any(|allowed| allowed == origin)
            })
    {
        return Err(denied());
    }
    let _comparison_slot = COMPARISON_SLOTS
        .acquire()
        .await
        .map_err(|e| Problem::internal(e.into()))?;
    let record = state
        .database
        .audit_record(id)
        .await
        .map_err(Problem::internal)?
        .ok_or(Problem {
            status: StatusCode::NOT_FOUND,
            detail: "Record not found".into(),
            error_code: None,
        })?;
    let candidate = state
        .database
        .validation_candidates(record.id_level)
        .await
        .map_err(Problem::internal)?
        .into_iter()
        .find(|candidate| candidate.id_level == payload.id_level);
    if candidate.is_none() && payload.id_level != record.id_level {
        return Err(Problem {
            status: StatusCode::BAD_REQUEST,
            detail: "Invalid candidate level".into(),
            error_code: None,
        });
    }
    let mut report = if record
        .ghost_url
        .as_ref()
        .is_none_or(|key| key.trim().is_empty())
    {
        zc_core::ghost_validation::ValidationReport::failed("missing_ghost")
    } else if let Some(key) = record
        .ghost_url
        .as_ref()
        .filter(|key| !key.trim().is_empty())
    {
        let candidate = candidate.filter(|candidate| candidate.verified());
        let slot = state
            .record_parser_slots
            .clone()
            .acquire_owned()
            .await
            .map_err(|e| Problem::internal(e.into()))?;
        let bytes = state
            .object_storage
            .download(
                key,
                DownloadConstraints {
                    max_bytes: zc_core::ghosts::MAX_GHOST_COMPRESSED_BYTES,
                    ..Default::default()
                },
            )
            .await
            .map_err(|_| Problem {
                status: StatusCode::SERVICE_UNAVAILABLE,
                detail: "Ghost storage unavailable".into(),
                error_code: None,
            })?;
        let manifest = state.config.validation_manifest.clone();
        tokio::task::spawn_blocking(move || {
            let _slot = slot;
            let ghost = match zc_core::ghosts::parse_ghost(&bytes) {
                Ok(ghost) => ghost,
                Err(_) => {
                    return zc_core::ghost_validation::ValidationReport::uncertain(
                        "unsupported_or_invalid_ghost",
                    );
                }
            };
            zc_core::ghost_validation::validate(
                &ghost,
                &zc_core::ghost_validation::SubmissionContext {
                    steam_id: &record.steam_id,
                    canonical_hash: &record.canonical_hash,
                    game_version: &record.game_version,
                    time: record.time.into(),
                    splits: &record.splits,
                    speeds: &record.speeds,
                },
                candidate.as_ref().map(|candidate| &candidate.blocks),
                manifest.as_ref(),
            )
        })
        .await
        .map_err(|e| Problem::internal(e.into()))?
    } else {
        zc_core::ghost_validation::ValidationReport::failed("missing_ghost")
    };
    report.comparison = true;
    Ok(private_json(json!({"report":report})))
}
pub async fn audit(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<Value>,
) -> Result<StatusCode, Problem> {
    administrator(&state, &headers).await?;
    if headers.get(header::AUTHORIZATION).is_none()
        && !headers
            .get(header::ORIGIN)
            .and_then(|v| v.to_str().ok())
            .is_some_and(|origin| {
                state
                    .config
                    .cors_origins
                    .iter()
                    .any(|allowed| allowed == origin)
            })
    {
        return Err(denied());
    }
    let task = zc_jobs::TaskIdentifier::AuditRecordGhosts;
    if !task.validate_external_payload(&payload) {
        return Err(Problem {
            status: StatusCode::BAD_REQUEST,
            detail: "Invalid audit filter".into(),
            error_code: None,
        });
    }
    state
        .queue
        .enqueue(task, payload, zc_jobs::queue::JobLane::Bulk, None)
        .await
        .map_err(Problem::internal)?;
    Ok(StatusCode::ACCEPTED)
}
pub async fn evidence(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<i32>,
) -> Result<Response, Problem> {
    administrator(&state, &headers).await?;
    let record = state
        .database
        .audit_record(id)
        .await
        .map_err(Problem::internal)?
        .ok_or(Problem {
            status: StatusCode::NOT_FOUND,
            detail: "Record not found".into(),
            error_code: None,
        })?;
    let candidates = state
        .database
        .validation_candidates(record.id_level)
        .await
        .map_err(Problem::internal)?;
    let attempts = state
        .database
        .record_validation_attempts(id)
        .await
        .map_err(Problem::internal)?;
    let snapshots:Vec<_>=candidates.iter().map(|s|json!({"snapshot":serde_json::to_value(s).map(|mut v|{v["id"]=json!(s.id.to_string());v}).unwrap_or(Value::Null),"overlays":state.config.validation_manifest.as_ref().map(|m|zc_core::ghost_validation::checkpoint_overlays(&s.blocks,m)).unwrap_or_default()})).collect();
    Ok(private_json(
        json!({"record":{"id":record.id,"levelId":record.id_level,"time":record.time,"steamId":record.steam_id,"hash":record.canonical_hash},"snapshots":snapshots,"attempts":attempts}),
    ))
}
pub async fn ghost(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<i32>,
) -> Result<Response, Problem> {
    administrator(&state, &headers).await?;
    let record = state
        .database
        .audit_record(id)
        .await
        .map_err(Problem::internal)?
        .ok_or(Problem {
            status: StatusCode::NOT_FOUND,
            detail: "Record not found".into(),
            error_code: None,
        })?;
    let key = record.ghost_url.ok_or(Problem {
        status: StatusCode::NOT_FOUND,
        detail: "Ghost missing".into(),
        error_code: None,
    })?;
    let bytes = state
        .object_storage
        .download(
            &key,
            DownloadConstraints {
                max_bytes: zc_core::ghosts::MAX_GHOST_COMPRESSED_BYTES,
                ..Default::default()
            },
        )
        .await
        .map_err(Problem::internal)?;
    // Base64 keeps existing authenticated backend refresh/proxy path; object keys stay private.
    use base64::Engine;
    Ok(private_json(
        json!({"ghost":base64::engine::general_purpose::STANDARD.encode(bytes)}),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn review_filters_preserve_identifiers_and_dates() {
        let uri = "/admin/ghost-validation?after=100&record=1&status=uncertain&idLevel=2&workshopId=3&from=2026-01-01T00%3A00%3A00Z".parse().unwrap();
        let Query(filters) = Query::<Filters>::try_from_uri(&uri).expect("review query");
        assert_eq!(filters.after, 100);
        assert_eq!(filters.record, Some(1));
        assert_eq!(filters.filter["idLevel"], "2");
        assert_eq!(filters.filter["workshopId"], "3");
    }
}
