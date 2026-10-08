use crate::{
    TaskIdentifier,
    queue::{EnqueueRequest, JobLane, Queue},
};
use anyhow::{Context, Result};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex, OnceLock},
    time::{Duration, SystemTime},
};
use zc_core::{
    ghost_validation::{self, SubmissionContext, ValidationManifest, ValidationReport},
    ghosts::{MAX_GHOST_COMPRESSED_BYTES, parse_ghost},
    object_storage::{DownloadConstraints, ObjectStorage},
};
use zc_database::{
    Database,
    services::ghost_validation::{AUDIT_WINDOW_SIZE, AuditWindowRecord},
};

pub const MAX_PENDING_GHOST_CHECKS: usize = 1_000;
const SATURATION_DELAY: Duration = Duration::from_secs(10);

struct CachedManifest {
    path: String,
    modified: SystemTime,
    size: u64,
    value: Option<Arc<ValidationManifest>>,
}
fn cached_manifest() -> Result<Option<Arc<ValidationManifest>>> {
    static CACHE: OnceLock<Mutex<Option<CachedManifest>>> = OnceLock::new();
    let Ok(path) = zc_core::environment::var("GHOST_VALIDATION_MANIFEST") else {
        return Ok(None);
    };
    let metadata = std::fs::metadata(&path)?;
    let modified = metadata.modified()?;
    let mut cache = CACHE
        .get_or_init(|| Mutex::new(None))
        .lock()
        .map_err(|_| anyhow::anyhow!("manifest cache unavailable"))?;
    if let Some(cached) = cache.as_ref().filter(|entry| {
        entry.path == path && entry.modified == modified && entry.size == metadata.len()
    }) {
        return Ok(cached.value.clone());
    }
    let value = ghost_validation::load_manifest_from_env()?.map(Arc::new);
    *cache = Some(CachedManifest {
        path,
        modified,
        size: metadata.len(),
        value: value.clone(),
    });
    Ok(value)
}

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
        self.validate_record_ghost_attempt(payload, 1).await
    }
    pub async fn validate_record_ghost_attempt(
        &self,
        payload: &serde_json::Value,
        attempts: i32,
    ) -> Result<()> {
        static SLOTS: OnceLock<tokio::sync::Semaphore> = OnceLock::new();
        let _slot = SLOTS
            .get_or_init(|| tokio::sync::Semaphore::new(2))
            .acquire()
            .await?;
        let id = i32::try_from(payload["idRecord"].as_i64().context("idRecord missing")?)?;
        let rows = self
            .database
            .audit_record_window(&serde_json::json!({"idRecord":id}), id)
            .await?;
        let Some(input) = rows.first() else {
            return Ok(());
        };
        if !input.needs_check && !(attempts > 1 && input.retryable) {
            tracing::info!(skipped = 1, "Ghost audit skipped unchanged inputs");
            return Ok(());
        }
        let checked_at = &input.checked_at;
        if !input.has_ghost {
            self.database
                .save_checked_record_validations(
                    &[id],
                    None,
                    &ValidationReport::failed("missing_ghost"),
                    checked_at,
                )
                .await?;
            return Ok(());
        }
        let Some(snapshot) = self
            .database
            .validation_snapshot(&input.canonical_hash)
            .await?
        else {
            self.database
                .save_checked_record_validations(
                    &[id],
                    None,
                    &ValidationReport::uncertain("missing_snapshot"),
                    checked_at,
                )
                .await?;
            return Ok(());
        };
        let Some(record) = self.database.audit_record(id).await? else {
            return Ok(());
        };
        let Some(url) = record
            .ghost_url
            .as_ref()
            .filter(|url| !url.trim().is_empty())
        else {
            self.database
                .save_checked_record_validations(
                    &[id],
                    None,
                    &ValidationReport::failed("missing_ghost"),
                    checked_at,
                )
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
                    .save_checked_record_validations(
                        &[id],
                        None,
                        &ValidationReport::uncertain("ghost_storage_unavailable"),
                        checked_at,
                    )
                    .await?;
                tracing::info!(attempt = attempts, retries = 1, "Ghost audit storage retry");
                return Err(error);
            }
        };
        let digest = hex::encode(Sha256::digest(&bytes));
        let report = tokio::task::spawn_blocking(move || {
            let manifest = cached_manifest()?;
            let ghost = match parse_ghost(&bytes) {
                Ok(ghost) => ghost,
                Err(_) => return Ok(ValidationReport::uncertain("unsupported_or_invalid_ghost")),
            };
            Ok::<_, anyhow::Error>(ghost_validation::validate(
                &ghost,
                &SubmissionContext {
                    steam_id: &record.steam_id,
                    canonical_hash: &record.canonical_hash,
                    game_version: &record.game_version,
                    time: f64::from(record.time),
                    splits: &record.splits,
                    speeds: &record.speeds,
                },
                Some(&snapshot.blocks),
                manifest.as_deref(),
            ))
        })
        .await??;
        self.database
            .save_checked_record_validations(&[id], Some(&digest), &report, checked_at)
            .await?;
        tracing::info!(checked = 1, "Ghost audit completed");
        Ok(())
    }
    pub async fn audit_record_ghosts(&self, payload: &serde_json::Value) -> Result<()> {
        let through_id = match payload["throughId"].as_i64() {
            Some(id) => i32::try_from(id)?,
            None => self.database.audit_upper_record_id().await?,
        };
        let window = self
            .database
            .audit_record_window(payload, through_id)
            .await?;
        let Some(_) = window.first() else {
            return Ok(());
        };
        let capacity =
            MAX_PENDING_GHOST_CHECKS.saturating_sub(self.queue.pending_ghost_checks().await?);
        let mut usable = HashMap::new();
        // Verify each level once per bounded window, without downloading ghosts.
        let mut geometry_count = 0;
        for row in window.iter().filter(|row| row.needs_check && row.has_ghost) {
            if let std::collections::hash_map::Entry::Vacant(entry) = usable.entry(row.id_level) {
                entry.insert(
                    self.database
                        .validation_snapshot(&row.canonical_hash)
                        .await?
                        .is_some(),
                );
            }
            if usable[&row.id_level] {
                if geometry_count == capacity {
                    break;
                }
                geometry_count += 1;
            }
        }
        let plan = plan_window(payload, &window, &usable, capacity);
        for (ids, report) in [
            (
                &plan.missing_ghost,
                ValidationReport::failed("missing_ghost"),
            ),
            (
                &plan.missing_snapshot,
                ValidationReport::uncertain("missing_snapshot"),
            ),
        ] {
            if !ids.is_empty() {
                let mut groups = std::collections::BTreeMap::<&str, Vec<i32>>::new();
                for row in window
                    .iter()
                    .filter(|row| ids.binary_search(&row.id).is_ok())
                {
                    groups.entry(&row.checked_at).or_default().push(row.id);
                }
                for (stamp, ids) in groups {
                    self.database
                        .save_checked_record_validations(&ids, None, &report, stamp)
                        .await?;
                }
            }
        }
        for chunk in plan.geometry.chunks(100) {
            self.queue
                .enqueue_many(
                    chunk
                        .iter()
                        .map(|id| EnqueueRequest {
                            task: TaskIdentifier::ValidateRecordGhost,
                            payload: serde_json::json!({"idRecord":id}),
                            lane: JobLane::Bulk,
                            key: Some(format!("validate-record-ghost:{id}")),
                            delay: Duration::ZERO,
                        })
                        .collect(),
                )
                .await?;
        }
        if plan.continues {
            let mut next = payload.clone();
            next["afterId"] = serde_json::json!(plan.after_id);
            next["throughId"] = serde_json::json!(through_id);
            self.queue
                .enqueue_after(
                    TaskIdentifier::AuditRecordGhosts,
                    next,
                    JobLane::Bulk,
                    None,
                    if plan.delayed {
                        SATURATION_DELAY
                    } else {
                        Duration::ZERO
                    },
                )
                .await?;
        }
        tracing::info!(
            scanned = window.len(),
            skipped = plan.skipped,
            missing_ghost = plan.missing_ghost.len(),
            missing_snapshot = plan.missing_snapshot.len(),
            queued = plan.geometry.len(),
            cursor = plan.after_id,
            through_id,
            delayed = plan.delayed,
            "Ghost audit window completed"
        );
        Ok(())
    }
}

#[derive(Debug)]
struct WindowPlan {
    missing_ghost: Vec<i32>,
    missing_snapshot: Vec<i32>,
    geometry: Vec<i32>,
    after_id: i32,
    continues: bool,
    delayed: bool,
    skipped: usize,
}
fn plan_window(
    payload: &serde_json::Value,
    rows: &[AuditWindowRecord],
    usable: &HashMap<i32, bool>,
    capacity: usize,
) -> WindowPlan {
    let mut plan = WindowPlan {
        missing_ghost: vec![],
        missing_snapshot: vec![],
        geometry: vec![],
        after_id: payload["afterId"].as_i64().unwrap_or(0) as i32,
        continues: rows.len() == AUDIT_WINDOW_SIZE,
        delayed: false,
        skipped: 0,
    };
    for row in rows {
        if !row.needs_check {
            plan.skipped += 1;
        } else if !row.has_ghost {
            plan.missing_ghost.push(row.id);
        } else if !usable.get(&row.id_level).copied().unwrap_or(false) {
            plan.missing_snapshot.push(row.id);
        } else if plan.geometry.len() < capacity {
            plan.geometry.push(row.id);
        } else {
            plan.delayed = true;
            plan.continues = true;
            break;
        }
        plan.after_id = row.id;
    }
    plan
}

#[cfg(test)]
mod tests {
    use super::*;
    fn row(id: i32, needs_check: bool, has_ghost: bool) -> AuditWindowRecord {
        AuditWindowRecord {
            id,
            id_level: 1,
            canonical_hash: "A".repeat(32),
            checked_at: "2026-01-01".into(),
            needs_check,
            has_ghost,
            retryable: false,
        }
    }
    #[test]
    fn skipped_windows_continue_and_partial_windows_stop() {
        let rows: Vec<_> = (1..=1000).map(|id| row(id, false, true)).collect();
        let plan = plan_window(&serde_json::json!({}), &rows, &HashMap::new(), 0);
        assert!(plan.continues);
        assert_eq!(plan.after_id, 1000);
        assert_eq!(plan.skipped, 1000);
        assert!(!plan_window(&serde_json::json!({}), &rows[..999], &HashMap::new(), 0).continues);
    }
    #[test]
    fn saturation_never_advances_past_unqueued_work() {
        let rows = vec![
            row(1, false, true),
            row(2, true, false),
            row(3, true, true),
            row(4, true, true),
        ];
        let plan = plan_window(
            &serde_json::json!({}),
            &rows,
            &HashMap::from([(1, true)]),
            1,
        );
        assert_eq!(plan.geometry, vec![3]);
        assert_eq!(plan.missing_ghost, vec![2]);
        assert_eq!(plan.after_id, 3);
        assert!(plan.delayed && plan.continues);
        let resumed = plan_window(
            &serde_json::json!({"afterId":3}),
            &rows[3..],
            &HashMap::from([(1, true)]),
            1,
        );
        assert_eq!(resumed.geometry, vec![4]);
        assert!(!resumed.continues);
    }
    #[test]
    fn cheap_classifications_need_no_queue_capacity() {
        let rows = vec![row(1, true, false), row(2, true, true)];
        let plan = plan_window(&serde_json::json!({}), &rows, &HashMap::new(), 0);
        assert_eq!(plan.missing_ghost, vec![1]);
        assert_eq!(plan.missing_snapshot, vec![2]);
        assert_eq!(plan.after_id, 2);
        assert!(!plan.delayed);
    }
}
