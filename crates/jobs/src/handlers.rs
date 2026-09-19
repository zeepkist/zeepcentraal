use crate::{
    TaskIdentifier,
    queue::{JobLane, Queue},
    runtime::JobHandler,
};
use anyhow::{Context, Result, ensure};
use async_trait::async_trait;
use sha2::{Digest, Sha256};
use std::{collections::BTreeSet, sync::Arc};
use zc_core::object_storage::{DownloadConstraints, ObjectStorage};
use zc_database::Database;
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

    async fn update_level_score(&self, payload: &serde_json::Value) -> Result<()> {
        let id_level = i32::try_from(payload["idLevel"].as_i64().context("idLevel is missing")?)?;
        let report_only = payload["reportOnly"].as_bool() == Some(true);
        let users = self
            .database
            .update_level_scores(&[id_level], report_only)
            .await?;
        if !report_only {
            for id_user in users {
                self.queue
                    .enqueue(
                        TaskIdentifier::UpdatePlayerScore,
                        serde_json::json!({"idUser":id_user}),
                        JobLane::Bulk,
                        Some(&format!("update-player-score:{id_user}")),
                    )
                    .await?;
            }
        }
        Ok(())
    }

    async fn update_level_scores(&self, payload: &serde_json::Value) -> Result<()> {
        let all = payload["all"].as_bool() == Some(true);
        let report_only = payload["reportOnly"].as_bool() == Some(true);
        if all {
            let rebuilt = self.database.rebuild_player_skill_aggregates().await?;
            tracing::info!(rebuilt, "Player skill aggregates rebuilt");
        }
        let mut after_id = 0;
        loop {
            let page = self.database.level_ids_page(after_id, !all).await?;
            if page.is_empty() {
                break;
            }
            for ids in page.chunks(50) {
                self.database.update_level_scores(ids, report_only).await?;
            }
            after_id = *page.last().context("level page is empty")?;
            if page.len() < 200 {
                break;
            }
        }
        if !report_only {
            self.queue
                .enqueue(
                    TaskIdentifier::UpdatePlayerScores,
                    serde_json::json!({}),
                    JobLane::Bulk,
                    Some("update-player-scores"),
                )
                .await?;
        }
        Ok(())
    }
}

#[async_trait]
impl JobHandler for ServiceJobHandler {
    async fn handle(&self, task: TaskIdentifier, payload: serde_json::Value) -> Result<()> {
        match task {
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
            TaskIdentifier::UpdatePlayerScore => {
                let id = i32::try_from(payload["idUser"].as_i64().context("idUser is missing")?)?;
                self.database.recalculate_player_score(id).await
            }
            TaskIdentifier::UpdatePlayerScores => {
                self.database.recalculate_all_player_scores().await
            }
            TaskIdentifier::PrepareTrackTournamentLobbyAsset => {
                self.prepare_tournament_lobby_asset(&payload).await
            }
            TaskIdentifier::RotateTrackTournament => self.rotate_tournament(&payload).await,
            TaskIdentifier::PrunePointsHistory => self.prune_points_history().await,
            TaskIdentifier::UpdateLevelScore => self.update_level_score(&payload).await,
            TaskIdentifier::UpdateLevelScores => self.update_level_scores(&payload).await,
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
