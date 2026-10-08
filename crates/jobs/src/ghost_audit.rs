use crate::{
    TaskIdentifier,
    queue::{JobLane, Queue},
};
use anyhow::{Context, Result};
use sha2::{Digest, Sha256};
use std::{
    sync::{
        Arc, Mutex, OnceLock,
        atomic::{AtomicUsize, Ordering},
    },
    time::SystemTime,
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

static SLOTS: OnceLock<tokio::sync::Semaphore> = OnceLock::new();
const MAX_SCANNED_RECORDS: usize = 100_000;
#[derive(Default)]
pub struct AuditCounters {
    pub snapshot_loads: AtomicUsize,
    pub geometry_preparations: AtomicUsize,
    pub downloads: AtomicUsize,
}
pub struct GhostAuditService {
    database: Database,
    queue: Queue,
    storage: Arc<dyn ObjectStorage>,
    pub counters: Arc<AuditCounters>,
}
impl GhostAuditService {
    pub fn new(database: Database, queue: Queue, storage: Arc<dyn ObjectStorage>) -> Self {
        Self {
            database,
            queue,
            storage,
            counters: Arc::default(),
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
        let _slot = SLOTS
            .get_or_init(|| tokio::sync::Semaphore::new(2))
            .acquire()
            .await?;
        let id = i32::try_from(payload["idRecord"].as_i64().context("idRecord missing")?)?;
        if self.process_ids(&[id], attempts).await? {
            anyhow::bail!("ghost storage unavailable")
        }
        Ok(())
    }
    /// Retained direct maintenance interface. Runtime uses lease-checkpointed entrypoint.
    pub async fn audit_record_ghosts(&self, payload: &serde_json::Value) -> Result<()> {
        let _slots = SLOTS
            .get_or_init(|| tokio::sync::Semaphore::new(2))
            .acquire_many(2)
            .await?;
        let (ids, next) = self.select_batch(payload).await?;
        if self.process_ids(&ids, 1).await? {
            anyhow::bail!("ghost storage unavailable")
        }
        self.continue_audit(
            next.as_ref(),
            payload["auditRunId"].as_str().unwrap_or("manual"),
        )
        .await
    }
    pub async fn audit_claimed(
        &self,
        job: &crate::queue::ClaimedJob,
    ) -> Result<crate::runtime::JobOutcome> {
        let Ok(_slots) = SLOTS
            .get_or_init(|| tokio::sync::Semaphore::new(2))
            .try_acquire_many(2)
        else {
            return Ok(crate::runtime::JobOutcome::Deferred);
        };
        let mut payload = job.payload.clone();
        if payload.get("work").is_none() {
            payload["auditRunId"] =
                serde_json::json!(payload["auditRunId"].as_str().unwrap_or(&job.id));
            let (ids, next) = self.select_batch(&payload).await?;
            payload["work"] = serde_json::json!({"recordIds":ids,"next":next});
            anyhow::ensure!(
                self.queue.checkpoint(job, &payload).await?,
                "ghost audit lease lost before checkpoint"
            );
        }
        let ids: Vec<_> = payload["work"]["recordIds"]
            .as_array()
            .context("invalid audit checkpoint")?
            .iter()
            .map(|v| {
                v.as_i64()
                    .and_then(|n| i32::try_from(n).ok())
                    .context("invalid record ID")
            })
            .collect::<Result<_>>()?;
        let storage_failed = self.process_ids(&ids, job.attempts).await?;
        if storage_failed && job.attempts < TaskIdentifier::AuditRecordGhosts.max_attempts() {
            anyhow::bail!("ghost storage unavailable")
        }
        anyhow::ensure!(
            self.queue.checkpoint(job, &payload).await?,
            "ghost audit lease lost before continuation"
        );
        let next = &payload["work"]["next"];
        self.continue_audit(
            (!next.is_null()).then_some(next),
            payload["auditRunId"]
                .as_str()
                .context("audit run missing")?,
        )
        .await?;
        tracing::info!(
            records = ids.len(),
            storage_failed,
            attempt = job.attempts,
            "Ghost audit batch completed"
        );
        Ok(crate::runtime::JobOutcome::Completed)
    }
    async fn continue_audit(&self, next: Option<&serde_json::Value>, run: &str) -> Result<()> {
        if let Some(next) = next {
            let key = format!(
                "ghost-audit:{run}:{}:{}",
                next["afterLevelId"], next["afterLevelRecordId"]
            );
            self.queue
                .enqueue(
                    TaskIdentifier::AuditRecordGhosts,
                    next.clone(),
                    JobLane::Bulk,
                    Some(&key),
                )
                .await?;
        }
        Ok(())
    }
    async fn select_batch(
        &self,
        payload: &serde_json::Value,
    ) -> Result<(Vec<i32>, Option<serde_json::Value>)> {
        let through = match payload["throughId"].as_i64() {
            Some(id) => i32::try_from(id)?,
            None => self.database.audit_upper_record_id().await?,
        };
        let mut cursor = payload.clone();
        cursor["throughId"] = serde_json::json!(through);
        cursor
            .as_object_mut()
            .context("invalid audit payload")?
            .remove("deferCount");
        let mut ids = vec![];
        let mut scanned = 0;
        loop {
            let rows = self.database.audit_level_window(&cursor, through).await?;
            if rows.is_empty() {
                return Ok((ids, None));
            }
            for row in &rows {
                scanned += 1;
                cursor["afterLevelId"] = serde_json::json!(row.id_level);
                cursor["afterLevelRecordId"] = serde_json::json!(row.id);
                if row.needs_check {
                    ids.push(row.id);
                }
                if ids.len() == AUDIT_WINDOW_SIZE || scanned == MAX_SCANNED_RECORDS {
                    tracing::info!(scanned, selected = ids.len(), "Ghost audit batch selected");
                    return Ok((ids, Some(cursor)));
                }
            }
            if rows.len() < AUDIT_WINDOW_SIZE {
                return Ok((ids, None));
            }
        }
    }
    async fn process_ids(&self, ids: &[i32], attempts: i32) -> Result<bool> {
        if ids.is_empty() {
            return Ok(false);
        }
        let rows = self
            .database
            .audit_level_window(
                &serde_json::json!({"recordIds":ids}),
                *ids.iter().max().context("empty batch")?,
            )
            .await?;
        let mut manifest = None;
        let mut manifest_loaded = false;
        let mut storage_failed = false;
        let mut start = 0;
        let mut loaded = 0;
        let mut prepared_count = 0;
        while start < rows.len() {
            let end =
                start + rows[start..].partition_point(|row| row.id_level == rows[start].id_level);
            let eligible: Vec<_> = rows[start..end]
                .iter()
                .filter(|row| row.needs_check || (attempts > 1 && row.retryable))
                .collect();
            start = end;
            let Some(first) = eligible.first().copied() else {
                continue;
            };
            let missing: Vec<_> = eligible
                .iter()
                .filter(|row| !row.has_ghost)
                .map(|row| row.id)
                .collect();
            if !missing.is_empty() {
                self.database
                    .save_checked_record_validations(
                        &missing,
                        None,
                        &ValidationReport::failed("missing_ghost"),
                        &first.checked_at,
                    )
                    .await?;
            }
            let ghosts: Vec<_> = eligible.into_iter().filter(|row| row.has_ghost).collect();
            if ghosts.is_empty() {
                continue;
            }
            loaded += 1;
            self.counters.snapshot_loads.fetch_add(1, Ordering::Relaxed);
            let snapshot = self
                .database
                .validation_snapshot(&first.canonical_hash)
                .await?;
            let Some(snapshot) = snapshot else {
                self.database
                    .save_checked_record_validations(
                        &ghosts.iter().map(|row| row.id).collect::<Vec<_>>(),
                        None,
                        &ValidationReport::uncertain("missing_snapshot"),
                        &first.checked_at,
                    )
                    .await?;
                continue;
            };
            if !manifest_loaded {
                manifest = tokio::task::spawn_blocking(cached_manifest).await??;
                manifest_loaded = true;
            }
            let profile = manifest.clone();
            let prepared = Arc::new(
                tokio::task::spawn_blocking(move || {
                    ghost_validation::prepare_level(&snapshot.blocks, profile.as_deref())
                })
                .await?,
            );
            prepared_count += 1;
            self.counters
                .geometry_preparations
                .fetch_add(1, Ordering::Relaxed);
            for pair in ghosts.chunks(2) {
                let left = self.validate_one(pair[0], prepared.clone(), manifest.clone());
                if pair.len() == 2 {
                    let (left, right) = tokio::join!(
                        left,
                        self.validate_one(pair[1], prepared.clone(), manifest.clone())
                    );
                    storage_failed |= left? | right?;
                } else {
                    storage_failed |= left.await?;
                }
            }
        }
        tracing::info!(
            records = ids.len(),
            snapshot_loads = loaded,
            geometry_preparations = prepared_count,
            "Ghost audit geometry reused"
        );
        Ok(storage_failed)
    }
    async fn validate_one(
        &self,
        input: &AuditWindowRecord,
        prepared: Arc<ghost_validation::PreparedLevel>,
        manifest: Option<Arc<ValidationManifest>>,
    ) -> Result<bool> {
        let Some(record) = self.database.audit_record(input.id).await? else {
            return Ok(false);
        };
        let Some(url) = record
            .ghost_url
            .as_ref()
            .filter(|url| !url.trim().is_empty())
        else {
            self.database
                .save_checked_record_validations(
                    &[input.id],
                    None,
                    &ValidationReport::failed("missing_ghost"),
                    &input.checked_at,
                )
                .await?;
            return Ok(false);
        };
        self.counters.downloads.fetch_add(1, Ordering::Relaxed);
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
            Err(_) => {
                self.database
                    .save_checked_record_validations(
                        &[input.id],
                        None,
                        &ValidationReport::uncertain("ghost_storage_unavailable"),
                        &input.checked_at,
                    )
                    .await?;
                return Ok(true);
            }
        };
        let digest = hex::encode(Sha256::digest(&bytes));
        let report = tokio::task::spawn_blocking(move || {
            let ghost = match parse_ghost(&bytes) {
                Ok(ghost) => ghost,
                Err(_) => return ValidationReport::uncertain("unsupported_or_invalid_ghost"),
            };
            ghost_validation::validate_prepared(
                &ghost,
                &SubmissionContext {
                    steam_id: &record.steam_id,
                    canonical_hash: &record.canonical_hash,
                    game_version: &record.game_version,
                    time: f64::from(record.time),
                    splits: &record.splits,
                    speeds: &record.speeds,
                },
                Some(&prepared),
                manifest.as_deref(),
            )
        })
        .await?;
        self.database
            .save_checked_record_validations(&[input.id], Some(&digest), &report, &input.checked_at)
            .await?;
        Ok(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    struct NoStorage;
    #[async_trait::async_trait]
    impl ObjectStorage for NoStorage {
        async fn upload(&self, _: &str, _: Vec<u8>, _: &str) -> Result<()> {
            anyhow::bail!("no storage during selection")
        }
        async fn delete(&self, _: &str) -> Result<()> {
            anyhow::bail!("no storage during selection")
        }
        async fn download(&self, _: &str, _: DownloadConstraints<'_>) -> Result<Vec<u8>> {
            anyhow::bail!("no storage during selection")
        }
    }
    #[tokio::test]
    #[ignore = "requires existing local ghost_validation_incremental_benchmark_test database"]
    async fn sparse_selection_yields_at_scan_budget_and_keeps_bounds() -> Result<()> {
        zc_core::environment::initialize()?;
        let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
        anyhow::ensure!(
            url.contains("@127.0.0.1:55441/ghost_validation_incremental_benchmark_test"),
            "Dedicated local benchmark required"
        );
        let db = Database::connect(&url, 2).await?;
        let queue = Queue::deferred(db.pool_partition());
        let storage = NoStorage;
        let service = GhostAuditService::new(db, queue, Arc::new(storage));
        let (ids, next) = service
            .select_batch(&serde_json::json!({"throughId":3000001}))
            .await?;
        assert!(ids.is_empty());
        let next = next.context("skipped windows must continue")?;
        assert_eq!(next["afterLevelId"], 1);
        assert_eq!(next["afterLevelRecordId"], 200000);
        let (ids,next)=service.select_batch(&serde_json::json!({"idLevel":2,"afterId":2500000,"throughId":2500500,"from":"2020-01-01T00:00:00Z","to":"2090-01-01T00:00:00Z"})).await?;
        assert_eq!(ids, vec![2500001]);
        assert!(next.is_none());
        let (ids, next) = service
            .select_batch(&serde_json::json!({"idRecord":3000001}))
            .await?;
        assert_eq!(ids, vec![3000001]);
        assert!(next.is_none());
        let _held = SLOTS
            .get_or_init(|| tokio::sync::Semaphore::new(2))
            .try_acquire_many(2)?;
        let job = crate::queue::ClaimedJob {
            lane: "bulk".into(),
            id: "9".into(),
            task: "auditRecordGhosts".into(),
            payload: serde_json::json!({}),
            attempts: 1,
            max_attempts: 3,
            generation: "0".into(),
        };
        assert!(matches!(
            service.audit_claimed(&job).await?,
            crate::runtime::JobOutcome::Deferred
        ));
        Ok(())
    }
}
