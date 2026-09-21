use crate::{
    TaskIdentifier,
    queue::{EnqueueRequest, JobLane, Queue},
    runtime::{JobHandler, JobOutcome},
};
use anyhow::{Context, Result, ensure};
use async_trait::async_trait;
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeSet, VecDeque},
    sync::Arc,
    time::{Duration, Instant},
};
use zc_core::object_storage::{DownloadConstraints, ObjectStorage};
use zc_database::{Database, services::jobs::MaintenanceOutcome};
use zc_workshop::{
    WorkshopDownloader, WorkshopMetadataAdapter, WorkshopPersistence, scanner::WorkshopScanner,
};

pub struct ServiceJobHandler {
    database: Database,
    queue: Queue,
    metadata: Arc<dyn WorkshopMetadataAdapter>,
    downloader: Arc<dyn WorkshopDownloader>,
    persistence: Arc<dyn WorkshopPersistence>,
    storage: Arc<dyn ObjectStorage>,
}

impl ServiceJobHandler {
    pub fn new(
        database: Database,
        queue: Queue,
        metadata: Arc<dyn WorkshopMetadataAdapter>,
        downloader: Arc<dyn WorkshopDownloader>,
        persistence: Arc<dyn WorkshopPersistence>,
        storage: Arc<dyn ObjectStorage>,
    ) -> Self {
        Self {
            database,
            queue,
            metadata,
            downloader,
            persistence,
            storage,
        }
    }

    fn scanner(&self) -> WorkshopScanner<'_> {
        WorkshopScanner::new(
            self.metadata.as_ref(),
            self.downloader.as_ref(),
            self.persistence.as_ref(),
        )
    }

    async fn scan_item(&self, payload: &serde_json::Value) -> Result<()> {
        let workshop_id = payload["workshopId"]
            .as_str()
            .context("workshopId is missing")?
            .parse::<u64>()?;
        let result = self.scanner().scan_workshop_item(workshop_id).await?;
        self.database
            .release_level_request(i64::try_from(workshop_id)?)
            .await?;
        self.enqueue_level_scores(&result.changed_level_ids).await
    }

    async fn scan_batch(&self, payload: &serde_json::Value) -> Result<()> {
        let workshop_ids: Vec<u64> = payload["workshopIds"]
            .as_array()
            .context("workshopIds are missing")?
            .iter()
            .map(|value| {
                value
                    .as_str()
                    .context("workshopId is not a string")?
                    .parse()
                    .map_err(Into::into)
            })
            .collect::<Result<_>>()?;
        let batch = self
            .scanner()
            .scan_workshop_items(&workshop_ids, 10)
            .await?;
        let mut changed = BTreeSet::new();
        for result in batch.results {
            self.database
                .release_level_request(i64::try_from(result.workshop_id)?)
                .await?;
            changed.extend(result.changed_level_ids);
        }
        self.enqueue_level_scores(&changed.into_iter().collect::<Vec<_>>())
            .await?;
        for failure in batch.transient_failures {
            self.queue
                .enqueue(
                    TaskIdentifier::ScanWorkshopItem,
                    serde_json::json!({"workshopId": failure.workshop_id.to_string()}),
                    JobLane::Bulk,
                    Some(&format!("scan-workshop-item:{}", failure.workshop_id)),
                )
                .await?;
        }
        Ok(())
    }

    async fn enqueue_level_scores(&self, ids: &[i32]) -> Result<()> {
        for id_level in ids {
            self.queue
                .enqueue(
                    TaskIdentifier::UpdateLevelScore,
                    serde_json::json!({"idLevel": id_level}),
                    JobLane::Bulk,
                    Some(&format!("update-level-score:{id_level}")),
                )
                .await?;
        }
        Ok(())
    }

    async fn recover_level_requests(&self) -> Result<()> {
        for workshop_id in self.database.pending_level_request_workshop_ids().await? {
            self.queue
                .enqueue(
                    TaskIdentifier::ScanWorkshopItem,
                    serde_json::json!({"workshopId": workshop_id.to_string()}),
                    JobLane::Bulk,
                    Some(&format!("scan-workshop-item:{workshop_id}")),
                )
                .await?;
        }
        Ok(())
    }

    async fn sync_workshop_catalog(&self, payload: &serde_json::Value) -> Result<()> {
        let force_all = payload["all"].as_bool() == Some(true);
        let repair_zsl = payload["repairZslAuthors"].as_bool() == Some(true);
        let stored = self.database.workshop_sync_state().await?;
        let mut queued = BTreeSet::new();
        let mut seen = BTreeSet::new();
        if repair_zsl {
            let mut page = 1;
            loop {
                let result = self
                    .metadata
                    .list_user_item_ids(zc_workshop::scanner::ZSL_WORKSHOP_AUTHOR_ID, page, 100)
                    .await?;
                seen.extend(result.workshop_ids.iter().copied());
                queued.extend(result.workshop_ids);
                let Some(next) = result.next_page else { break };
                page = next;
            }
        } else {
            let mut cursor = "*".to_owned();
            loop {
                let result = self.metadata.list_items(&cursor, 100).await?;
                for item in result.items {
                    seen.insert(item.workshop_id);
                    let stored_item = i64::try_from(item.workshop_id)
                        .ok()
                        .and_then(|id| stored.get(&id));
                    let updated_epoch = parse_epoch(&item.updated_at)?;
                    if force_all
                        || stored_item.is_none()
                        || stored_item.is_some_and(|state| {
                            state.active_item_count == 0 || updated_epoch > state.updated_epoch
                        })
                    {
                        queued.insert(item.workshop_id);
                    }
                }
                let Some(next) = result.next_cursor else {
                    break;
                };
                cursor = next;
            }
            for (workshop_id, state) in stored {
                if state.active_item_count > 0
                    && !seen.contains(&u64::try_from(workshop_id).unwrap_or_default())
                {
                    queued.insert(u64::try_from(workshop_id)?);
                }
            }
        }
        let ids: Vec<_> = queued.into_iter().collect();
        for chunk in ids.chunks(20) {
            let first = chunk.first().context("empty workshop chunk")?;
            let last = chunk.last().context("empty workshop chunk")?;
            self.queue
                .enqueue(
                    TaskIdentifier::ScanWorkshopBatch,
                    serde_json::json!({
                        "workshopIds": chunk.iter().map(u64::to_string).collect::<Vec<_>>(),
                        "fixZeepSDKExponentHashes": force_all && payload["fixZeepSDKExponentHashes"].as_bool() == Some(true),
                    }),
                    JobLane::Bulk,
                    Some(&format!("scan-workshop-batch:{first}:{last}")),
                )
                .await?;
        }
        Ok(())
    }

    async fn backfill_record_statistics(&self, payload: &serde_json::Value) -> Result<()> {
        let limit = payload["limit"].as_i64().unwrap_or(500).min(500);
        if let Some(values) = payload["ids"].as_array() {
            let ids = values
                .iter()
                .filter_map(serde_json::Value::as_i64)
                .map(i32::try_from)
                .collect::<std::result::Result<Vec<_>, _>>()?;
            for chunk in ids.chunks(500) {
                let media = self
                    .database
                    .record_media_for_statistics(Some(chunk), None, None, 500)
                    .await?;
                self.enqueue_statistic_batch(
                    &media.iter().map(|item| item.id_record).collect::<Vec<_>>(),
                )
                .await?;
            }
            return Ok(());
        }
        let version = payload["reparseGhostVersion"]
            .as_i64()
            .map(i32::try_from)
            .transpose()?;
        let mut before = None;
        loop {
            let media = self
                .database
                .record_media_for_statistics(None, before, version, limit)
                .await?;
            if media.is_empty() {
                break;
            }
            let ids = media.iter().map(|item| item.id_record).collect::<Vec<_>>();
            self.enqueue_statistic_batch(&ids).await?;
            before = ids.last().copied();
            if media.len() < usize::try_from(limit)? {
                break;
            }
        }
        Ok(())
    }

    async fn enqueue_statistic_batch(&self, ids: &[i32]) -> Result<()> {
        if ids.is_empty() {
            return Ok(());
        }
        self.queue
            .enqueue(
                TaskIdentifier::BackfillRecordGhostStatisticsBatch,
                serde_json::json!({"ids": ids}),
                JobLane::Bulk,
                Some(&format!(
                    "backfill-record-ghost-statistics:{}-{}",
                    ids[0],
                    ids[ids.len() - 1]
                )),
            )
            .await?;
        Ok(())
    }

    async fn backfill_record_statistics_batch(&self, payload: &serde_json::Value) -> Result<()> {
        let ids = integer_ids(payload, "ids")?;
        let media = self
            .database
            .record_media_for_statistics(Some(&ids), None, None, 500)
            .await?;
        let mut failed = 0_usize;
        for item in &media {
            let result = async {
                let bytes = self
                    .storage
                    .download(
                        &item.ghost_url,
                        DownloadConstraints {
                            max_bytes: 24 * 1024 * 1024,
                            expected_bytes: None,
                            expected_sha256: None,
                        },
                    )
                    .await?;
                let statistics = zc_core::ghosts::parse_ghost_statistics(&bytes)?;
                self.database
                    .upsert_record_statistics(item.id_record, &statistics)
                    .await
            }
            .await;
            if let Err(error) = result {
                failed += 1;
                tracing::warn!(id_record = item.id_record, error = %error, "Ghost statistic backfill failed");
            }
        }
        tracing::info!(
            records = media.len(),
            failed,
            "Ghost statistic backfill completed"
        );
        Ok(())
    }

    async fn update_level_point_history(&self) -> Result<()> {
        for ids in self.database.changed_level_point_ids().await?.chunks(200) {
            self.queue
                .enqueue(
                    TaskIdentifier::UpdateLevelPointsHistoryBatch,
                    serde_json::json!({"ids":ids}),
                    JobLane::Bulk,
                    Some(&format!(
                        "level-points-history:{}-{}",
                        ids[0],
                        ids[ids.len() - 1]
                    )),
                )
                .await?;
        }
        Ok(())
    }

    async fn update_user_point_history(&self) -> Result<()> {
        for ids in self.database.all_user_point_ids().await?.chunks(200) {
            self.queue
                .enqueue(
                    TaskIdentifier::UpdateUserPointsHistoryBatch,
                    serde_json::json!({"ids":ids}),
                    JobLane::Bulk,
                    Some(&format!(
                        "user-points-history:{}-{}",
                        ids[0],
                        ids[ids.len() - 1]
                    )),
                )
                .await?;
        }
        Ok(())
    }

    async fn prepare_tournament_lobby_asset(&self, payload: &serde_json::Value) -> Result<()> {
        let id_tournament = i32::try_from(
            payload["idTournament"]
                .as_i64()
                .context("idTournament is missing")?,
        )?;
        let sources = self
            .database
            .tournament_lobby_sources(id_tournament)
            .await?;
        ensure!(
            !sources.is_empty(),
            "Tournament has no downloadable level item"
        );
        let mut last_error = None;
        for source in sources {
            let result: Result<()> = async {
                let workshop_id = u64::try_from(source.workshop_id)?;
                let download = self.downloader.download(&[workshop_id]).await?;
                let item = download
                    .items
                    .first()
                    .context("SteamCMD returned no workshop item")?;
                let selected =
                    zc_workshop::files::find_workshop_level_file(&item.directory, &source.file_uid)
                        .await?
                        .context("Workshop item omitted selected level UID")?;
                let bytes = zc_core::zeepnet::encode_zeepkist_level_payload(
                    &selected.content,
                    source.format == 1,
                )?;
                ensure!(
                    !zc_core::zeepnet::decode_zeepkist_level_payload(&bytes)?.is_empty(),
                    "Prepared level payload is empty"
                );
                let digest = format!("{:x}", Sha256::digest(&bytes));
                let key = format!("track-tournament-lobby/{id_tournament}/{digest}.gz");
                self.storage
                    .upload(&key, bytes.clone(), "application/gzip")
                    .await?;
                let level_name = if source.level_name.is_empty() {
                    &selected.name
                } else {
                    &source.level_name
                };
                let published = self
                    .database
                    .publish_tournament_lobby_asset(
                        id_tournament,
                        source.workshop_id,
                        &source.file_uid,
                        level_name,
                        &source.file_author,
                        &key,
                        &digest,
                        i32::try_from(bytes.len())?,
                    )
                    .await;
                if let Err(error) = published {
                    let _ = self.storage.delete(&key).await;
                    return Err(error);
                }
                download.cleanup().await?;
                Ok(())
            }
            .await;
            match result {
                Ok(()) => return Ok(()),
                Err(error) => last_error = Some(error),
            }
        }
        Err(last_error.context("Unable to prepare tournament lobby asset")?)
    }

    async fn rotate_tournament(&self, payload: &serde_json::Value) -> Result<()> {
        let tournament_type = i32::try_from(payload["type"].as_i64().context("type is missing")?)?;
        let rotation = self
            .database
            .rotate_track_tournament(tournament_type)
            .await?;
        if let Some(id) = rotation.id_tournament {
            self.queue
                .enqueue(
                    TaskIdentifier::PrepareTrackTournamentLobbyAsset,
                    serde_json::json!({"idTournament":id}),
                    JobLane::Bulk,
                    Some(&format!("prepare-track-tournament-lobby-asset:{id}")),
                )
                .await?;
        }
        Ok(())
    }

    async fn prune_points_history(&self) -> Result<()> {
        for level_history in [true, false] {
            let mut deleted = 0_i64;
            loop {
                let count = self
                    .database
                    .prune_points_history_batch(level_history)
                    .await?;
                deleted += count;
                if count == 0 || deleted >= 250_000 {
                    break;
                }
            }
            tracing::info!(
                history = if level_history {
                    "level_points_history"
                } else {
                    "user_points_history"
                },
                deleted,
                "Points history pruning completed"
            );
        }
        Ok(())
    }

    async fn update_level_score(
        &self,
        payload: &serde_json::Value,
        lane: JobLane,
    ) -> Result<JobOutcome> {
        let started = Instant::now();
        let id_level = i32::try_from(payload["idLevel"].as_i64().context("idLevel is missing")?)?;
        let report_only = payload["reportOnly"].as_bool() == Some(true);
        let outcome = self
            .database
            .update_level_scores(&[id_level], report_only)
            .await?;
        match outcome {
            MaintenanceOutcome::Applied(update) => {
                if update.projection_needed {
                    self.enqueue_level_contribution_cursor(id_level).await?;
                }
                tracing::info!(
                    id_level,
                    lane = lane.as_str(),
                    report_only,
                    points_changed = update.points_changed,
                    projection_needed = update.projection_needed,
                    elapsed_ms = started.elapsed().as_millis(),
                    "Level score committed"
                );
                Ok(JobOutcome::Completed)
            }
            MaintenanceOutcome::Contended | MaintenanceOutcome::SnapshotChanged => {
                Ok(JobOutcome::Deferred)
            }
        }
    }

    async fn enqueue_level_contribution_cursor(&self, id_level: i32) -> Result<()> {
        self.queue.enqueue_level_projection(id_level, 0).await?;
        Ok(())
    }

    async fn update_level_contributions(
        &self,
        payload: &serde_json::Value,
        lane: JobLane,
        attempts: i32,
    ) -> Result<JobOutcome> {
        let started = Instant::now();
        let id_level = i32::try_from(payload["idLevel"].as_i64().context("idLevel is missing")?)?;
        if let Some(id_user) = payload["idUser"].as_i64() {
            let id_user = i32::try_from(id_user)?;
            let projection_token = payload["projectionToken"]
                .as_str()
                .context("projectionToken is missing")?;
            if lane == JobLane::Fast && self.queue.has_fast_level_score(id_level).await? {
                return Ok(JobOutcome::Deferred);
            }
            return self
                .reconcile_level_contribution_repair(id_level, id_user, projection_token, lane)
                .await;
        }

        ensure!(
            lane == JobLane::Bulk,
            "contribution cursor requires bulk lane"
        );
        if payload.get("projectionToken").is_some() {
            self.enqueue_level_contribution_cursor(id_level).await?;
            return Ok(JobOutcome::Completed);
        }

        let after_user_id = i32::try_from(
            payload["afterUserId"]
                .as_i64()
                .context("afterUserId is missing")?,
        )?;
        let page = self
            .database
            .level_contribution_user_page(id_level, after_user_id, 50)
            .await?;
        let page_users = page.user_ids;
        let (mut applied, busy) = self
            .reconcile_level_contribution_batch(id_level, page_users.clone())
            .await?;
        if attempts > 1 {
            applied.extend(
                page_users
                    .into_iter()
                    .filter(|id_user| !busy.contains(id_user)),
            );
            applied.sort_unstable();
            applied.dedup();
        }
        let applied_count = applied.len();
        let busy_count = busy.len();
        let mut requests = player_score_requests(&applied);
        requests.extend(busy.into_iter().map(|id_user| EnqueueRequest {
            task: TaskIdentifier::UpdateLevelContributions,
            payload: serde_json::json!({
                "idLevel": id_level,
                "idUser": id_user,
                "projectionToken": format!("bulk:{id_level}:{id_user}"),
                "deferCount": 1,
            }),
            lane: JobLane::Bulk,
            key: None,
            delay: contribution_backoff(0),
        }));
        if !requests.is_empty() {
            self.queue.enqueue_many(requests).await?;
        }
        if let Some(next_after_user_id) = page.next_after_user_id {
            self.queue
                .enqueue_level_projection(id_level, next_after_user_id)
                .await?;
        }
        tracing::info!(
            id_level,
            after_user_id,
            applied = applied_count,
            deferred = busy_count,
            has_next = page.next_after_user_id.is_some(),
            elapsed_ms = started.elapsed().as_millis(),
            "Level contribution page completed"
        );
        Ok(JobOutcome::Completed)
    }

    async fn reconcile_level_contribution_repair(
        &self,
        id_level: i32,
        id_user: i32,
        projection_token: &str,
        lane: JobLane,
    ) -> Result<JobOutcome> {
        let started = Instant::now();
        match self
            .database
            .reconcile_level_contribution_users(id_level, &[id_user])
            .await?
        {
            MaintenanceOutcome::Applied(users) => {
                if lane == JobLane::Fast {
                    self.queue
                        .enqueue(
                            TaskIdentifier::UpdatePlayerScore,
                            serde_json::json!({
                                "idUser": id_user,
                                "projectionToken": projection_token,
                            }),
                            JobLane::Fast,
                            Some(&format!(
                                "update-player-score-submit:{id_user}:{projection_token}"
                            )),
                        )
                        .await?;
                    tracing::info!(
                        id_level,
                        id_user,
                        elapsed_ms = started.elapsed().as_millis(),
                        "Fast contribution repair completed"
                    );
                    Ok(JobOutcome::Completed)
                } else {
                    self.enqueue_player_repairs(&users).await?;
                    Ok(JobOutcome::Completed)
                }
            }
            MaintenanceOutcome::Contended | MaintenanceOutcome::SnapshotChanged => {
                Ok(JobOutcome::Deferred)
            }
        }
    }

    async fn reconcile_level_contribution_batch(
        &self,
        id_level: i32,
        user_ids: Vec<i32>,
    ) -> Result<(Vec<i32>, Vec<i32>)> {
        const CONCURRENCY: usize = 4;
        let mut pending = VecDeque::from([user_ids]);
        let mut tasks = tokio::task::JoinSet::new();
        let mut applied = Vec::new();
        let mut busy = Vec::new();
        loop {
            while tasks.len() < CONCURRENCY {
                let Some(batch) = pending.pop_front() else {
                    break;
                };
                if batch.is_empty() {
                    continue;
                }
                let database = self.database.clone();
                tasks.spawn(async move {
                    let outcome = database
                        .reconcile_level_contribution_users(id_level, &batch)
                        .await;
                    (batch, outcome)
                });
            }
            let Some(result) = tasks.join_next().await else {
                break;
            };
            let (batch, outcome) = result?;
            collect_reconciliation_outcome(batch, outcome?, &mut pending, &mut applied, &mut busy);
        }
        applied.sort_unstable();
        busy.sort_unstable();
        Ok((applied, busy))
    }

    async fn update_level_scores(&self, payload: &serde_json::Value) -> Result<()> {
        let all = payload["all"].as_bool() == Some(true);
        let report_only = payload["reportOnly"].as_bool() == Some(true);
        if all {
            let rebuilt = self.database.rebuild_player_skill_aggregates().await?;
            tracing::info!(rebuilt, "Player skill aggregates rebuilt");
        }
        let mut after_id = 0;
        let mut applied = 0usize;
        let mut deferred = 0usize;
        loop {
            let page = self.database.level_ids_page(after_id, !all).await?;
            if page.is_empty() {
                break;
            }
            for id_level in &page {
                match self
                    .database
                    .update_level_scores(&[*id_level], report_only)
                    .await?
                {
                    MaintenanceOutcome::Applied(update) => {
                        applied += 1;
                        if update.projection_needed {
                            self.enqueue_level_contribution_cursor(*id_level).await?;
                        }
                    }
                    MaintenanceOutcome::Contended | MaintenanceOutcome::SnapshotChanged => {
                        deferred += 1;
                        self.queue
                            .enqueue_after(
                                TaskIdentifier::UpdateLevelScore,
                                serde_json::json!({"idLevel": id_level, "reportOnly": report_only}),
                                JobLane::Bulk,
                                None,
                                contribution_backoff(0),
                            )
                            .await?;
                    }
                }
            }
            after_id = *page.last().context("level page is empty")?;
            if page.len() < 200 {
                break;
            }
        }
        if all && !report_only {
            self.queue
                .enqueue(
                    TaskIdentifier::UpdatePlayerScores,
                    serde_json::json!({}),
                    JobLane::Bulk,
                    Some("update-player-scores"),
                )
                .await?;
        }
        tracing::info!(
            applied,
            deferred,
            report_only,
            "updateLevelScores completed"
        );
        Ok(())
    }

    async fn update_player_scores(&self) -> Result<()> {
        const PAGE_SIZE: i64 = 200;
        const READ_BATCH_SIZE: usize = 50;
        const CONCURRENCY: usize = 4;
        const RANK_BATCH_SIZE: usize = 50;

        let started = Instant::now();
        let mut after_id = 0;
        let mut processed = 0usize;
        let mut deferred = 0usize;
        loop {
            let page = self
                .database
                .user_activity_page(after_id, PAGE_SIZE)
                .await?;
            if page.is_empty() {
                break;
            }
            let active = page
                .iter()
                .filter(|user| user.active)
                .map(|user| user.id_user)
                .collect::<Vec<_>>();
            let inactive = page
                .iter()
                .filter(|user| !user.active)
                .map(|user| user.id_user)
                .collect::<Vec<_>>();
            for ids in inactive.chunks(READ_BATCH_SIZE) {
                if !matches!(
                    self.database.reset_inactive_user_scores(ids).await?,
                    MaintenanceOutcome::Applied(())
                ) {
                    deferred += ids.len();
                    self.enqueue_player_repairs(ids).await?;
                }
            }
            for ids in active.chunks(READ_BATCH_SIZE) {
                let mut sources = self.database.user_score_sources(ids).await?.into_iter();
                let mut tasks = tokio::task::JoinSet::new();
                loop {
                    while tasks.len() < CONCURRENCY {
                        let Some(source) = sources.next() else { break };
                        let database = self.database.clone();
                        tasks.spawn(async move {
                            let id_user = source.id_user;
                            (
                                id_user,
                                database.recalculate_player_score_from(source).await,
                            )
                        });
                    }
                    let Some(result) = tasks.join_next().await else {
                        break;
                    };
                    let (id_user, outcome) = result?;
                    match outcome? {
                        MaintenanceOutcome::Applied(()) => processed += 1,
                        MaintenanceOutcome::Contended | MaintenanceOutcome::SnapshotChanged => {
                            deferred += 1;
                            self.enqueue_player_repairs(&[id_user]).await?;
                        }
                    }
                }
            }
            after_id = page.last().context("user activity page is empty")?.id_user;
            tracing::info!(
                after_id,
                processed,
                deferred,
                elapsed_ms = started.elapsed().as_millis(),
                "Player score page completed"
            );
            if page.len() < PAGE_SIZE as usize {
                break;
            }
        }

        let mut rank_changes = 0usize;
        let mut rank_stable = false;
        for pass in 1..=3 {
            let snapshot = self.database.player_rank_snapshot().await?;
            let mut pass_stable = true;
            for batch in snapshot.chunks(RANK_BATCH_SIZE) {
                match self.database.persist_player_rank_batch(batch).await? {
                    MaintenanceOutcome::Applied(changes) => rank_changes += changes,
                    MaintenanceOutcome::Contended | MaintenanceOutcome::SnapshotChanged => {
                        pass_stable = false;
                    }
                }
            }
            if pass_stable {
                rank_stable = true;
                break;
            }
            tracing::warn!(pass, "Player rank snapshot changed; retrying");
        }
        if !rank_stable {
            tracing::warn!("Player ranks remained busy; next scheduled run will reconcile");
        }
        tracing::info!(
            processed,
            deferred,
            rank_changes,
            rank_stable,
            elapsed_ms = started.elapsed().as_millis(),
            "updatePlayerScores completed"
        );
        Ok(())
    }

    async fn enqueue_player_repairs(&self, ids: &[i32]) -> Result<()> {
        if !ids.is_empty() {
            self.queue.enqueue_many(player_score_requests(ids)).await?;
        }
        Ok(())
    }
}

#[async_trait]
impl JobHandler for ServiceJobHandler {
    async fn handle(
        &self,
        task: TaskIdentifier,
        payload: serde_json::Value,
        lane: JobLane,
        attempts: i32,
    ) -> Result<JobOutcome> {
        if task == TaskIdentifier::UpdateLevelScore {
            return self.update_level_score(&payload, lane).await;
        }
        if task == TaskIdentifier::UpdateLevelContributions {
            return self
                .update_level_contributions(&payload, lane, attempts)
                .await;
        }
        if task == TaskIdentifier::UpdatePlayerScore {
            let started = Instant::now();
            let id = i32::try_from(payload["idUser"].as_i64().context("idUser is missing")?)?;
            return match self.database.recalculate_player_score(id).await? {
                MaintenanceOutcome::Applied(()) => {
                    if lane == JobLane::Fast {
                        tracing::info!(
                            id_user = id,
                            elapsed_ms = started.elapsed().as_millis(),
                            "Fast player score completed"
                        );
                    }
                    Ok(JobOutcome::Completed)
                }
                MaintenanceOutcome::Contended | MaintenanceOutcome::SnapshotChanged => {
                    Ok(JobOutcome::Deferred)
                }
            };
        }
        let result = match task {
            TaskIdentifier::BackfillRecordGhostStatistics => {
                self.backfill_record_statistics(&payload).await
            }
            TaskIdentifier::BackfillRecordGhostStatisticsBatch => {
                self.backfill_record_statistics_batch(&payload).await
            }
            TaskIdentifier::ScanWorkshopItem => self.scan_item(&payload).await,
            TaskIdentifier::ScanWorkshopBatch => self.scan_batch(&payload).await,
            TaskIdentifier::RecoverLevelRequests => self.recover_level_requests().await,
            TaskIdentifier::SyncWorkshopCatalog => self.sync_workshop_catalog(&payload).await,
            TaskIdentifier::SyncPersonalBests => Ok(()),
            TaskIdentifier::UpdateLevelPointsHistory => self.update_level_point_history().await,
            TaskIdentifier::UpdateLevelPointsHistoryBatch => self
                .database
                .insert_level_point_histories(&integer_ids(&payload, "ids")?)
                .await
                .map(|_| ()),
            TaskIdentifier::UpdateUserPointsHistory => self.update_user_point_history().await,
            TaskIdentifier::UpdateUserPointsHistoryBatch => self
                .database
                .insert_user_point_histories(&integer_ids(&payload, "ids")?)
                .await
                .map(|_| ()),
            TaskIdentifier::UpdatePlayerScore => unreachable!(),
            TaskIdentifier::UpdatePlayerScores => self.update_player_scores().await,
            TaskIdentifier::PrepareTrackTournamentLobbyAsset => {
                self.prepare_tournament_lobby_asset(&payload).await
            }
            TaskIdentifier::RotateTrackTournament => self.rotate_tournament(&payload).await,
            TaskIdentifier::PrunePointsHistory => self.prune_points_history().await,
            TaskIdentifier::UpdateLevelScore | TaskIdentifier::UpdateLevelContributions => {
                unreachable!()
            }
            TaskIdentifier::UpdateLevelScores => self.update_level_scores(&payload).await,
        };
        result?;
        Ok(JobOutcome::Completed)
    }
}

fn player_score_requests(ids: &[i32]) -> Vec<EnqueueRequest> {
    ids.iter()
        .map(|id_user| EnqueueRequest {
            task: TaskIdentifier::UpdatePlayerScore,
            payload: serde_json::json!({"idUser": id_user}),
            lane: JobLane::Bulk,
            key: Some(format!("update-player-score:{id_user}")),
            delay: Duration::ZERO,
        })
        .collect()
}

fn contribution_backoff(defer_count: u32) -> Duration {
    const DELAYS_MS: [u64; 5] = [250, 500, 1_000, 2_000, 5_000];
    Duration::from_millis(
        DELAYS_MS[usize::try_from(defer_count)
            .unwrap_or(usize::MAX)
            .min(DELAYS_MS.len() - 1)],
    )
}

fn collect_reconciliation_outcome(
    batch: Vec<i32>,
    outcome: MaintenanceOutcome<Vec<i32>>,
    pending: &mut VecDeque<Vec<i32>>,
    applied: &mut Vec<i32>,
    busy: &mut Vec<i32>,
) {
    match outcome {
        MaintenanceOutcome::Applied(users) => applied.extend(users),
        MaintenanceOutcome::Contended | MaintenanceOutcome::SnapshotChanged => {
            if batch.len() == 1 {
                busy.extend(batch);
            } else {
                let middle = batch.len() / 2;
                pending.push_back(batch[..middle].to_vec());
                pending.push_back(batch[middle..].to_vec());
            }
        }
    }
}

fn integer_ids(payload: &serde_json::Value, name: &str) -> Result<Vec<i32>> {
    payload[name]
        .as_array()
        .with_context(|| format!("{name} is missing"))?
        .iter()
        .map(|value| {
            i32::try_from(
                value
                    .as_i64()
                    .with_context(|| format!("{name} contains a non-integer"))?,
            )
            .map_err(Into::into)
        })
        .collect()
}

fn parse_epoch(value: &str) -> Result<i64> {
    Ok(value
        .parse::<jiff::Timestamp>()
        .with_context(|| format!("invalid Steam timestamp {value}"))?
        .as_second())
}

#[cfg(test)]
mod contribution_tests {
    use super::{collect_reconciliation_outcome, contribution_backoff};
    use std::{collections::VecDeque, time::Duration};
    use zc_database::services::jobs::MaintenanceOutcome;

    #[test]
    fn contribution_backoff_caps_at_five_seconds() {
        assert_eq!(contribution_backoff(0), Duration::from_millis(250));
        assert_eq!(contribution_backoff(1), Duration::from_millis(500));
        assert_eq!(contribution_backoff(2), Duration::from_secs(1));
        assert_eq!(contribution_backoff(3), Duration::from_secs(2));
        assert_eq!(contribution_backoff(4), Duration::from_secs(5));
        assert_eq!(contribution_backoff(100), Duration::from_secs(5));
    }

    #[test]
    fn recursive_splitting_defers_only_busy_singletons() {
        let mut pending = VecDeque::from([vec![1, 2, 3, 4, 5, 6, 7, 8]]);
        let mut applied = Vec::new();
        let mut busy = Vec::new();
        while let Some(batch) = pending.pop_front() {
            let contended = batch.iter().any(|id| matches!(id, 3 | 7));
            let outcome = if contended {
                MaintenanceOutcome::Contended
            } else {
                MaintenanceOutcome::Applied(batch.clone())
            };
            collect_reconciliation_outcome(batch, outcome, &mut pending, &mut applied, &mut busy);
        }
        applied.sort_unstable();
        busy.sort_unstable();
        assert_eq!(applied, vec![1, 2, 4, 5, 6, 8]);
        assert_eq!(busy, vec![3, 7]);
    }
}
