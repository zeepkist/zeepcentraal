use crate::{
    TaskIdentifier,
    queue::{JobLane, Queue},
};
use anyhow::{Context, Result};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use zc_core::object_storage::{DownloadConstraints, ObjectStorage};
use zc_core::{
    ghost_validation::{self, SubmissionContext, ValidationReport},
    ghosts::{MAX_GHOST_COMPRESSED_BYTES, parse_ghost},
};
use zc_database::Database;

pub struct GhostAuditService {
    database: Database,
    queue: Queue,
    storage: Arc<dyn ObjectStorage>,
}
impl GhostAuditService {
    pub fn new(database: Database, queue: Queue, storage: Arc<dyn ObjectStorage>) -> Self {
        Self {
            database,
            queue,
            storage,
        }
    }
    pub async fn validate_record_ghost(&self, payload: &serde_json::Value) -> Result<()> {
        static SLOTS: std::sync::OnceLock<tokio::sync::Semaphore> = std::sync::OnceLock::new();
        let _slot = SLOTS
            .get_or_init(|| tokio::sync::Semaphore::new(2))
            .acquire()
            .await?;
        let id = i32::try_from(payload["idRecord"].as_i64().context("idRecord missing")?)?;
        let Some(record) = self.database.audit_record(id).await? else {
            return Ok(());
        };
        let snapshot = self
            .database
            .validation_snapshot(&record.canonical_hash)
            .await?;
        let Some(url) = record
            .ghost_url
            .as_ref()
            .filter(|url| !url.trim().is_empty())
        else {
            self.database
                .save_record_validation(id, None, &ValidationReport::failed("missing_ghost"))
                .await?;
            return Ok(());
        };
        let bytes = match self
            .storage
            .download(
                url,
                DownloadConstraints {
                    max_bytes: MAX_GHOST_COMPRESSED_BYTES,
                    ..Default::default()
                },
            )
            .await
        {
            Ok(bytes) => bytes,
            Err(error) => {
                self.database
                    .save_record_validation(
                        id,
                        None,
                        &ValidationReport::uncertain("ghost_storage_unavailable"),
                    )
                    .await?;
                return Err(error);
            }
        };
        let digest = hex::encode(Sha256::digest(&bytes));
        let manifest = ghost_validation::load_manifest_from_env()?;
        let report = tokio::task::spawn_blocking(move || {
            let ghost = match parse_ghost(&bytes) {
                Ok(ghost) => ghost,
                Err(_) => return ValidationReport::uncertain("unsupported_or_invalid_ghost"),
            };
            ghost_validation::validate(
                &ghost,
                &SubmissionContext {
                    steam_id: &record.steam_id,
                    canonical_hash: &record.canonical_hash,
                    game_version: &record.game_version,
                    time: f64::from(record.time),
                    splits: &record.splits,
                    speeds: &record.speeds,
                },
                snapshot.as_ref().map(|s| &s.blocks),
                manifest.as_ref(),
            )
        })
        .await?;
        self.database
            .save_record_validation(id, Some(&digest), &report)
            .await?;
        Ok(())
    }

    pub async fn audit_record_ghosts(&self, payload: &serde_json::Value) -> Result<()> {
        let ids = self.database.audit_record_ids(payload).await?;
        let page = audit_page(payload, &ids);
        for id in page.records {
            self.queue
                .enqueue(
                    TaskIdentifier::ValidateRecordGhost,
                    serde_json::json!({"idRecord":id}),
                    JobLane::Bulk,
                    Some(&format!("validate-record-ghost:{id}")),
                )
                .await?;
        }
        if let Some(next) = page.continuation {
            self.queue
                .enqueue(TaskIdentifier::AuditRecordGhosts, next, JobLane::Bulk, None)
                .await?;
        }
        Ok(())
    }
}

struct AuditPage {
    records: Vec<i32>,
    continuation: Option<serde_json::Value>,
}

fn audit_page(payload: &serde_json::Value, ids: &[i32]) -> AuditPage {
    let continuation = (ids.len() == 100).then(|| {
        let mut next = payload.clone();
        next["afterId"] = serde_json::json!(ids.last().expect("full page"));
        next
    });
    AuditPage {
        records: ids.to_vec(),
        continuation,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn full_page_preserves_filters_and_resumes_after_last_record() {
        let payload = json!({"idLevel":7,"workshopId":"123","from":"2026-01-01T00:00:00Z","to":"2026-02-01T00:00:00Z","afterId":20,"reasons":["invalid_splits","missing_ghost"]});
        let ids: Vec<_> = (21..=120).collect();
        let page = audit_page(&payload, &ids);
        assert_eq!(page.records, ids);
        let mut expected = payload.clone();
        expected["afterId"] = json!(120);
        assert_eq!(page.continuation, Some(expected));
        assert_eq!(payload["afterId"], 20);
    }

    #[test]
    fn partial_and_empty_pages_stop_without_skipping_records() {
        for ids in [vec![], vec![121], (121..220).collect()] {
            let page = audit_page(&json!({"afterId":120}), &ids);
            assert_eq!(page.records, ids);
            assert!(page.continuation.is_none());
        }
    }
}
