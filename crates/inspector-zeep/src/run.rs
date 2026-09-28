use crate::{
    archive::{ArchiveLevel, build_archive},
    config::{InspectorConfig, InspectorOptions, Rules},
    discord::DiscordRest,
    playlist::{ValidationMember, ValidationPayload, create_submission_playlist},
    publication::deliver_notifications,
    validation::{Inspection, VALIDATOR_VERSION, inspect_level, sha256},
};
use anyhow::{Context, Result, bail, ensure};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use zc_core::object_storage::{DownloadConstraints, ObjectStorage};
use zc_database::services::inspector::{
    InspectorPlaylistMember, InspectorSubmissionRow, InspectorValidationInput,
    InspectorValidationRow,
};
use zc_workshop::{
    WorkshopDownloader, WorkshopItemMetadata, WorkshopMetadataAdapter, WorkshopPersistence,
    files::find_level_paths,
    scanner::{WorkshopScanStatus, WorkshopScanner},
    steamcmd::WorkshopDownload,
};
const MAX_LEVEL_BYTES: u64 = 64 * 1024 * 1024;
pub struct InspectorRuntime<'a> {
    pub database: &'a zc_database::Database,
    pub discord: &'a DiscordRest,
    pub downloader: &'a dyn WorkshopDownloader,
    pub metadata: &'a dyn WorkshopMetadataAdapter,
    pub storage: &'a dyn ObjectStorage,
    pub persistence: &'a dyn WorkshopPersistence,
}
pub async fn run_inspector(
    runtime: &InspectorRuntime<'_>,
    config: &InspectorConfig,
    options: InspectorOptions,
) -> Result<()> {
    zc_telemetry::observe_operation("inspector.run", async {
        runtime
            .database
            .with_inspector_lock(|| async {
                let mut failed = false;
                for configured in &config.contests {
                    if let Err(error) = run_contest(runtime, configured, options).await {
                        failed = true;
                        runtime
                            .database
                            .defer_inspector_finalization(configured.round_id)
                            .await?;
                        tracing::warn!(round_id=configured.round_id,%error,"Contest work deferred");
                    }
                }
                // Notification failure cannot prevent validation, playlists or finalization.
                if !options.dry_run
                    && let Err(error) = deliver_notifications(
                        runtime.database,
                        runtime.discord,
                        &config.notification_channel_id,
                    )
                    .await
                {
                    tracing::warn!(%error,"Validation feed unavailable");
                }
                ensure!(!failed, "Inspector has deferred work");
                Ok(())
            })
            .await?;
        Ok(())
    })
    .await
}
async fn run_contest(
    runtime: &InspectorRuntime<'_>,
    configured: &crate::config::ContestConfig,
    options: InspectorOptions,
) -> Result<()> {
    if options.dry_run {
        tracing::info!(
            round_id = configured.round_id,
            "Inspector preview; no mutations"
        );
        return Ok(());
    }
    let rules_hash = submission_digest(&configured.rules)?;
    runtime
        .database
        .configure_inspector_contest(
            configured.round_id,
            serde_json::to_value(&configured.rules)?,
            &rules_hash,
        )
        .await?;
    let contest = runtime
        .database
        .get_inspector_contest(configured.round_id)
        .await?
        .context("Contest missing")?;
    if contest.state == "frozen" {
        return Ok(());
    }
    let schedule = runtime
        .database
        .get_inspector_schedule(configured.round_id)
        .await?;
    if !schedule.as_ref().is_some_and(|s| s.started) {
        return Ok(());
    }
    let final_scan = schedule.as_ref().is_some_and(|s| s.due);
    if final_scan && !contest.finalization_due {
        return Ok(());
    }
    let selected = runtime
        .database
        .get_inspector_submissions(contest.id)
        .await?;
    let due: Vec<_> = selected
        .iter()
        .filter(|s| options.force || s.inspection_due)
        .collect();
    if due.is_empty() && !final_scan && contest.playlist_revision == contest.published_revision {
        return Ok(());
    }
    let ids: Vec<_> = due.iter().map(|s| s.workshop_id as u64).collect();
    let mut details = HashMap::new();
    for batch in ids.chunks(100) {
        match runtime.metadata.get_items(batch).await {
            Ok(items) => {
                for item in items {
                    details.insert(item.workshop_id, item);
                }
            }
            Err(error) => {
                for submission in &due {
                    if batch.contains(&(submission.workshop_id as u64)) {
                        runtime
                            .database
                            .set_inspector_submission_retry(
                                submission.id,
                                submission.revision,
                                "metadata-transient",
                            )
                            .await?;
                    }
                }
                return Err(error);
            }
        }
    }
    let mut complete = true;
    for submission in due {
        if !runtime
            .database
            .begin_inspector_validation(submission.id, submission.revision)
            .await?
        {
            continue;
        }
        if let Err(error) = validate_submission(
            runtime,
            submission,
            &details,
            &configured.rules,
            &rules_hash,
            options.force || submission.final_scan_due,
        )
        .await
        {
            complete = false;
            runtime
                .database
                .set_inspector_submission_retry(
                    submission.id,
                    submission.revision,
                    "inspection-transient",
                )
                .await?;
            tracing::warn!(submission_id=submission.id,%error,"Workshop check deferred");
        }
    }
    // Refresh after slow I/O; publication itself checks revision under contest lock.
    let contest = runtime
        .database
        .get_inspector_contest(configured.round_id)
        .await?
        .context("Contest missing")?;
    let selected = runtime
        .database
        .get_inspector_submissions(contest.id)
        .await?;
    let mut accepted = Vec::new();
    for submission in &selected {
        let validation = runtime
            .database
            .get_inspector_validation(submission.latest_validation_id)
            .await?;
        if final_scan && submission.final_scan_due {
            complete = false;
        }
        if let Some(validation) =
            validation.filter(|v| v.submission_revision == submission.revision && v.valid)
        {
            accepted.push((submission, validation));
        }
    }
    let output = create_submission_playlist(
        &contest.theme,
        &accepted
            .iter()
            .map(|(s, v)| validation_member(s, v))
            .collect::<Result<Vec<_>>>()?,
    )?;
    let object_key = format!(
        "inspector/playlists/{}/{}.zeeplist",
        contest.id, output.digest
    );
    runtime
        .storage
        .upload(
            &object_key,
            output.json.as_bytes().to_vec(),
            "application/json",
        )
        .await?;
    runtime
        .database
        .publish_inspector_playlist(
            contest.id,
            contest.playlist_revision,
            &output.digest,
            &object_key,
            &output
                .members
                .iter()
                .map(|m| InspectorPlaylistMember {
                    id_validation: m.id_validation,
                    workshop_id: m.workshop_id as i64,
                })
                .collect::<Vec<_>>(),
        )
        .await?;
    if final_scan && complete {
        let version = runtime
            .database
            .get_inspector_playlist_by_round(configured.round_id)
            .await?
            .context("Published playlist missing")?
            .playlist;
        let archive = build_final_archive(runtime, &accepted, &output.members).await?;
        let key = archive_key(contest.season_number, contest.round_number, &contest.theme);
        let digest = sha256(&archive);
        let size = archive.len();
        runtime
            .storage
            .upload(&key, archive, "application/gzip")
            .await?;
        runtime
            .storage
            .download(
                &key,
                DownloadConstraints {
                    max_bytes: size,
                    expected_bytes: Some(size),
                    expected_sha256: Some(&digest),
                },
            )
            .await?;
        ensure!(
            runtime
                .database
                .finalize_inspector_contest(contest.id, version.id, &key, &digest, size as i64)
                .await?,
            "Finalization lost current revision"
        );
    }
    ensure!(complete, "Contest has pending final checks");
    Ok(())
}
async fn validate_submission(
    runtime: &InspectorRuntime<'_>,
    submission: &InspectorSubmissionRow,
    details: &HashMap<u64, WorkshopItemMetadata>,
    rules: &Rules,
    rules_hash: &str,
    force: bool,
) -> Result<InspectorValidationRow> {
    let workshop_id =
        u64::try_from(submission.workshop_id).context("Workshop ID exceeds supported range")?;
    let item = details.get(&workshop_id);
    if item.is_none_or(|item| {
        item.permanent_failure.is_none()
            && (!item.available || item.updated_at.starts_with("1970-"))
    }) {
        bail!("workshop-metadata-unavailable");
    }
    let cached = runtime
        .database
        .get_inspector_validation(submission.latest_validation_id)
        .await?;
    if !force
        && item.is_some_and(|item| submission.authors.contains(&item.creator_id.to_string()))
        && cached
            .as_ref()
            .is_some_and(|validation| validation_cache_matches(validation, item, rules_hash))
    {
        runtime
            .database
            .finish_inspector_cache_check(submission.id, submission.revision)
            .await?;
        return Ok(cached.expect("cache checked"));
    }
    let mut inspection = None;
    let mut content_sha256 = None;
    let mut failures = Vec::new();
    if let Some(failure) = item.and_then(|item| item.permanent_failure.as_ref()) {
        failures.push(failure.clone());
    } else if item.is_some_and(|item| !submission.authors.contains(&item.creator_id.to_string())) {
        failures.push("workshop-owner-not-listed-as-author".into());
    } else {
        let download = runtime.downloader.download(&[workshop_id]).await?;
        let inspected = inspect_download(download, workshop_id, rules).await;
        let (found, raw_hash, found_failures) = inspected?;
        inspection = found;
        content_sha256 = raw_hash;
        failures = found_failures;
        let refreshed = runtime.metadata.get_items(&[workshop_id]).await?;
        let after = refreshed.first().context("workshop-revision-changed")?;
        let before = item.context("workshop-metadata-unavailable")?;
        ensure!(
            after.available
                && after.updated_at == before.updated_at
                && after.file_size == before.file_size
                && after.creator_id == before.creator_id,
            "workshop-revision-changed"
        );
        if let Some(level) = inspection.as_ref().filter(|_| failures.is_empty())
            && !runtime
                .database
                .inspector_workshop_level_link_exists(&level.level_hash, submission.workshop_id)
                .await?
        {
            let scanned =
                WorkshopScanner::new(runtime.metadata, runtime.downloader, runtime.persistence)
                    .scan_workshop_item(workshop_id)
                    .await?;
            ensure!(
                scanned.status == WorkshopScanStatus::Scanned,
                "workshop-level-scan-unavailable"
            );
            ensure!(
                runtime
                    .database
                    .inspector_workshop_level_link_exists(&level.level_hash, submission.workshop_id)
                    .await?,
                "workshop-level-hash-missing-after-scan"
            );
        }
    }
    let payload = if failures.is_empty() {
        inspection
            .as_ref()
            .map(|inspection| {
                let mut payload = serde_json::to_value(&inspection.payload)?;
                let object_key = format!("inspector/payloads/{}.gz", inspection.payload.sha256);
                payload["objectKey"] = object_key.clone().into();
                let names = submission
                    .author_names
                    .as_array()
                    .map(|a| {
                        a.iter()
                            .filter_map(serde_json::Value::as_str)
                            .collect::<Vec<_>>()
                            .join(", ")
                    })
                    .unwrap_or_default();
                payload["author"] = names.clone().into();
                payload["overrideAuthorName"] = names.into();
                payload["thumbnailUrl"] = item.map(|item| item.image_url.clone()).into();
                payload["workshopOwner"] = item.map(|item| item.creator_id.to_string()).into();
                Ok::<_, anyhow::Error>((payload, object_key))
            })
            .transpose()?
    } else {
        None
    };
    if let (Some(inspection), Some((_, object_key))) = (&inspection, &payload) {
        runtime
            .storage
            .upload(object_key, inspection.data.clone(), "application/gzip")
            .await?;
    }
    let item_updated = item.map_or("source-error", |item| item.updated_at.as_str());
    let item_size = item.map_or(0, |item| item.file_size);
    let saved = runtime
        .database
        .save_inspector_validation(&InspectorValidationInput {
            id_submission: submission.id,
            submission_revision: submission.revision,
            level_hash: inspection.as_ref().map(|value| value.level_hash.clone()),
            workshop_updated_at: item_updated.into(),
            workshop_file_size: i64::try_from(item_size).context("Workshop file exceeds bigint")?,
            content_sha256,
            validator_version: VALIDATOR_VERSION.into(),
            rules_hash: rules_hash.into(),
            id_level_item: None,
            file_uid: inspection.as_ref().map(|value| value.payload.uid.clone()),
            measurements: inspection
                .as_ref()
                .map(|value| serde_json::to_value(&value.measurements))
                .transpose()?
                .unwrap_or_else(|| serde_json::json!({})),
            failures: serde_json::to_value(&failures)?,
            valid: failures.is_empty(),
            payload: payload.map(|(payload, _)| payload).or_else(||item.map(|item|serde_json::json!({"name":inspection.as_ref().map_or(item.name.as_str(),|i|i.payload.name.as_str()),"thumbnailUrl":item.image_url,"workshopOwner":item.creator_id.to_string()}))),
        })
        .await?;
    let id = saved.context("Inspected submission revision changed")?;
    runtime
        .database
        .get_inspector_validation(Some(id))
        .await?
        .context("Saved validation disappeared")
}

async fn inspect_download(
    download: WorkshopDownload,
    workshop_id: u64,
    rules: &Rules,
) -> Result<(Option<Inspection>, Option<String>, Vec<String>)> {
    let result = async {
        let directory = download
            .items
            .iter()
            .find(|item| item.workshop_id == workshop_id)
            .map(|item| item.directory.as_path())
            .context("workshop-download-unavailable")?;
        let paths = find_level_paths(directory).await?;
        if paths.len() != 1 {
            return Ok((
                None,
                None,
                vec![
                    if paths.is_empty() {
                        "missing-level-file"
                    } else {
                        "multiple-level-files"
                    }
                    .into(),
                ],
            ));
        }
        let path = &paths[0];
        if tokio::fs::metadata(path).await?.len() > MAX_LEVEL_BYTES {
            return Ok((None, None, vec!["level-too-large".into()]));
        }
        let bytes = tokio::fs::read(path).await?;
        let raw_hash = sha256(&bytes);
        let content = match std::str::from_utf8(&bytes) {
            Ok(content) => content,
            Err(_) => return Ok((None, Some(raw_hash), vec!["malformed-level".into()])),
        };
        let name = path
            .file_stem()
            .and_then(|value| value.to_str())
            .context("malformed-level")?;
        match inspect_level(content, name, rules) {
            Ok(inspection) => {
                let failures = inspection.failures.clone();
                Ok((Some(inspection), Some(raw_hash), failures))
            }
            Err(_) => Ok((None, Some(raw_hash), vec!["malformed-level".into()])),
        }
    }
    .await;
    let cleanup = download.cleanup().await;
    match (result, cleanup) {
        (Ok(value), Ok(())) => Ok(value),
        (Err(error), _) => Err(error),
        (Ok(_), Err(error)) => Err(error.context("failed to clean workshop download")),
    }
}

fn archive_key(season: i32, round: i32, theme: &str) -> String {
    let slug = theme
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '-' })
        .collect::<String>();
    let slug = slug
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    format!("inspector/workshop/S{season}R{round}_{slug}.tar.gz")
}

async fn build_final_archive(
    runtime: &InspectorRuntime<'_>,
    accepted: &[(&InspectorSubmissionRow, InspectorValidationRow)],
    members: &[ValidationMember],
) -> Result<Vec<u8>> {
    let mut levels = Vec::with_capacity(members.len());
    for member in members {
        let (submission, validation) = accepted
            .iter()
            .find(|(submission, validation)| {
                submission.workshop_id == member.workshop_id as i64
                    && validation.id == member.id_validation
            })
            .context("Playlist member lost selected validation")?;
        let download = runtime.downloader.download(&[member.workshop_id]).await?;
        let result = async {
            let directory = download
                .items
                .iter()
                .find(|item| item.workshop_id == member.workshop_id)
                .context("Final workshop download missing item")?
                .directory
                .as_path();
            let found = zc_workshop::files::discover_levels(directory).await?;
            ensure!(
                found.len() == 1,
                "Final workshop item has changed level count"
            );
            let found = &found[0];
            let level = tokio::fs::read(&found.level_path).await?;
            ensure!(
                level.len() as u64 <= MAX_LEVEL_BYTES,
                "Final level exceeds size limit"
            );
            ensure!(
                validation.content_sha256.as_deref() == Some(sha256(&level).as_str()),
                "Final workshop item changed after validation"
            );
            let parent = found
                .level_path
                .parent()
                .context("Final level has no folder")?;
            let mut entries = tokio::fs::read_dir(parent).await?;
            let mut index_path = None;
            while let Some(entry) = entries.next_entry().await? {
                if entry.file_type().await?.is_file()
                    && entry
                        .file_name()
                        .to_string_lossy()
                        .eq_ignore_ascii_case("indexdata.zeepindex")
                {
                    index_path = Some(entry.path());
                    break;
                }
            }
            let index = match index_path {
                Some(path) => Some(tokio::fs::read(path).await?),
                None => {
                    tracing::warn!(
                        workshop_id = member.workshop_id,
                        "Final level has no indexdata.zeepindex"
                    );
                    None
                }
            };
            let thumbnail = match &found.thumbnail_path {
                Some(path) => Some(tokio::fs::read(path).await?),
                None => {
                    tracing::warn!(
                        workshop_id = member.workshop_id,
                        "Final level has no matching thumbnail"
                    );
                    None
                }
            };
            Ok::<_, anyhow::Error>(ArchiveLevel {
                workshop_id: member.workshop_id,
                name: found.name.clone(),
                level,
                index,
                thumbnail,
            })
        }
        .await;
        let cleanup = download.cleanup().await;
        levels.push(result?);
        cleanup?;
        tracing::debug!(submission_id = submission.id, "Final level archived");
    }
    build_archive(&levels)
}

fn validation_cache_matches(
    validation: &InspectorValidationRow,
    item: Option<&WorkshopItemMetadata>,
    rules_hash: &str,
) -> bool {
    validation.rules_hash == rules_hash
        && validation.validator_version == VALIDATOR_VERSION
        && item.is_some_and(|item| {
            validation.payload.as_ref().is_some_and(|p| {
                p["workshopOwner"].as_str() == Some(item.creator_id.to_string().as_str())
            }) && validation.workshop_updated_at == item.updated_at
                && validation.workshop_file_size as u64 == item.file_size
        })
}
fn validation_member(
    submission: &InspectorSubmissionRow,
    validation: &InspectorValidationRow,
) -> Result<ValidationMember> {
    Ok(ValidationMember {
        id_validation: validation.id,
        workshop_id: u64::try_from(submission.workshop_id)
            .context("Invalid persisted Workshop ID")?,
        valid: validation.valid,
        payload: validation
            .payload
            .clone()
            .map(serde_json::from_value::<ValidationPayload>)
            .transpose()?,
    })
}

fn submission_digest(rules: &Rules) -> Result<String> {
    Ok(hex::encode(Sha256::digest(serde_json::to_vec(rules)?)))
}
