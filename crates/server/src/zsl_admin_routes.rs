use crate::{AppState, cdn, ghost_validation_routes::administrator, problem::Problem};
use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
};
use serde::Deserialize;
use serde_json::{Value, json};
use std::sync::Arc;
use zc_core::practice::{MAX_PLAYLIST_BYTES, PracticePlaylist};
use zc_database::services::zsl_admin::{AdminSave, ZslAdminConflict, ZslAdminValidation};

fn private(value: Value) -> Response {
    ([(header::CACHE_CONTROL, "private, no-store")], Json(value)).into_response()
}

fn problem(status: StatusCode, detail: impl Into<String>) -> Problem {
    Problem {
        status,
        detail: detail.into(),
        error_code: None,
    }
}

fn mutation_error(error: anyhow::Error) -> Problem {
    if let Some(error) = error.downcast_ref::<ZslAdminValidation>() {
        problem(StatusCode::UNPROCESSABLE_ENTITY, error.to_string())
    } else if error.is::<ZslAdminConflict>() {
        problem(StatusCode::CONFLICT, error.to_string())
    } else {
        Problem::internal(error)
    }
}

pub async fn dashboard(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Response, Problem> {
    administrator(&state, &headers).await?;
    Ok(private(
        state
            .database
            .zsl_admin_dashboard()
            .await
            .map_err(Problem::internal)?,
    ))
}

pub async fn save(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<AdminSave>,
) -> Result<Response, Problem> {
    let actor = administrator(&state, &headers).await?;
    let id = state
        .database
        .save_zsl_admin(actor, input)
        .await
        .map_err(mutation_error)?;
    Ok(private(json!({"id":id})))
}

pub async fn status(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(round_id): Path<i32>,
) -> Result<Response, Problem> {
    administrator(&state, &headers).await?;
    let mut status = state
        .database
        .zsl_playlist_status(round_id)
        .await
        .map_err(Problem::internal)?;
    if let Some(base) = &state.config.cdn_base_url {
        cdn::resolve_image_urls(&mut status, base);
    }
    Ok(private(status))
}

#[derive(Deserialize)]
#[serde(tag = "action", rename_all = "camelCase", deny_unknown_fields)]
pub enum PlaylistAction {
    Upload { source: String },
    UploadPractice { source: String },
    Regenerate,
    Retry { revision: i32 },
}

pub async fn playlist(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(round_id): Path<i32>,
    Json(action): Json<PlaylistAction>,
) -> Result<Response, Problem> {
    let actor = administrator(&state, &headers).await?;
    let practice = matches!(&action, PlaylistAction::UploadPractice { .. });
    let (kind, source, retry) = match action {
        PlaylistAction::Upload { source } | PlaylistAction::UploadPractice { source } => {
            if source.len() > MAX_PLAYLIST_BYTES {
                return Err(problem(
                    StatusCode::PAYLOAD_TOO_LARGE,
                    "Playlist exceeds 1 MiB",
                ));
            }
            let playlist = PracticePlaylist::parse(source.as_bytes())
                .map_err(|error| problem(StatusCode::UNPROCESSABLE_ENTITY, error.to_string()))?;
            let (kind, validation) = if practice {
                let tournament = state
                    .database
                    .zsl_tournament_source(round_id)
                    .await
                    .map_err(Problem::internal)?
                    .and_then(|source| PracticePlaylist::parse(source.as_bytes()).ok());
                ("practice", playlist.validate_practice(tournament.as_ref()))
            } else {
                ("tournament", playlist.validate_tournament())
            };
            validation
                .map_err(|error| problem(StatusCode::UNPROCESSABLE_ENTITY, error.to_string()))?;
            (kind, Some(source), None)
        }
        PlaylistAction::Regenerate => ("warmup", None, None),
        PlaylistAction::Retry { revision } => ("", None, Some(revision)),
    };
    let revision = state
        .database
        .request_zsl_playlist(actor, round_id, kind, source, retry)
        .await
        .map_err(mutation_error)?;
    // The scheduler recovers committed requests if immediate enqueue is unavailable.
    if let Err(error) = state
        .queue
        .enqueue(
            zc_jobs::TaskIdentifier::PrepareZslPlaylistRevision,
            json!({"revision":revision}),
            zc_jobs::queue::JobLane::Bulk,
            Some(&format!("zsl-playlist-revision:{revision}")),
        )
        .await
    {
        tracing::warn!(revision, %error, "ZSL playlist enqueue deferred to scheduler");
    }
    Ok(private(json!({"revision":revision})))
}
