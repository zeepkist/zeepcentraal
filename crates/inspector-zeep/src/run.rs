use crate::{
    config::{InspectorConfig, InspectorOptions, Rules},
    contests::parse_contest_title,
    discord::{DiscordRest, ForumThread},
    playlist::{ValidationMember, ValidationPayload, create_submission_playlist},
    publication::{
        PlaylistVersion, PublicationContest, PublicationState, publish_discord_playlist,
    },
    submissions::{SourceMessage, SourceSubmission, SubmissionState, reconcile_sources},
    validation::{Inspection, VALIDATOR_VERSION, inspect_level, sha256},
};
use anyhow::{Context, Result, bail, ensure};
use reqwest::Method;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use zc_core::object_storage::ObjectStorage;
use zc_database::services::inspector::{
    InspectorContestInput, InspectorContestRow, InspectorPlaylistMember, InspectorPlaylistRow,
    InspectorSubmissionInput, InspectorSubmissionRow, InspectorValidationInput,
    InspectorValidationRow,
};
use zc_workshop::{
    WorkshopDownloader, WorkshopItemMetadata, WorkshopMetadataAdapter, files::find_level_paths,
    steamcmd::WorkshopDownload,
};

const MAX_LEVEL_BYTES: u64 = 64 * 1024 * 1024;

pub struct InspectorRuntime<'a> {
    pub database: &'a zc_database::Database,
    pub discord: &'a DiscordRest,
    pub downloader: &'a dyn WorkshopDownloader,
    pub metadata: &'a dyn WorkshopMetadataAdapter,
    pub storage: &'a dyn ObjectStorage,
}

#[derive(Deserialize)]
struct DiscordUser {
    id: String,
}

pub async fn run_inspector(
    runtime: &InspectorRuntime<'_>,
    config: &InspectorConfig,
    options: InspectorOptions,
) -> Result<()> {
    let result = runtime
        .database
        .with_inspector_lock(|| run_locked(runtime, config, options))
        .await?;
    if result.is_none() {
        tracing::info!("Inspector run skipped because another instance holds the lock");
    }
    Ok(())
}

async fn run_locked(
    runtime: &InspectorRuntime<'_>,
    config: &InspectorConfig,
    options: InspectorOptions,
) -> Result<()> {
    let bot: DiscordUser = runtime.discord.request("users/@me", Method::GET).await?;
    let mut discovered = HashMap::new();
    for forum in &config.forums {
        for thread in runtime
            .discord
            .discover(&forum.guild_id, &forum.forum_id)
            .await?
        {
            discovered.insert(thread.id.clone(), thread);
        }
    }
    let mut failed = false;
    for configured in &config.contests {
        let result = run_contest(runtime, config, configured, options, &bot.id, &discovered).await;
        if let Err(error) = result {
            failed = true;
            tracing::warn!(
                thread_id = configured.thread_id,
                error = %error,
                "Inspector contest failed; publication deferred"
            );
        }
    }
    ensure!(!failed, "Inspector run completed with deferred work");
    Ok(())
}

async fn run_contest(
    runtime: &InspectorRuntime<'_>,
    config: &InspectorConfig,
    configured: &crate::config::ContestConfig,
    options: InspectorOptions,
    bot_id: &str,
    discovered: &HashMap<String, ForumThread>,
) -> Result<()> {
    let thread = match discovered.get(&configured.thread_id) {
        Some(thread) => thread.clone(),
        None => {
            runtime
                .discord
                .request(&format!("channels/{}", configured.thread_id), Method::GET)
                .await?
        }
    };
    ensure!(
        config.forums.iter().any(|forum| {
            forum.guild_id == thread.guild_id && forum.forum_id == thread.parent_id
        }),
        "Thread outside configured forum"
    );
    let parsed = parse_contest_title(&thread.name).context("Unrecognized contest title")?;
    let season_number = i32::try_from(parsed.season).context("Contest season exceeds integer")?;
    let round_number = i32::try_from(parsed.round).context("Contest round exceeds integer")?;
    let mut contest = runtime.database.get_inspector_contest(&thread.id).await?;
    let matched_round = runtime
        .database
        .find_inspector_round(
            config.seasons.get(&parsed.season.to_string()).copied(),
            round_number,
            configured.round_id,
        )
        .await?;
    if contest.as_ref().is_some_and(|contest| {
        contest.season_number != season_number || contest.round_number != round_number
    }) && configured.round_id.is_none()
    {
        bail!("Contest title changed round identity; explicit mapping required");
    }
    let rules_hash = submission_digest(&configured.rules)?;
    if options.dry_run {
        let messages = runtime.discord.messages(&thread.id).await?;
        tracing::info!(
            thread_id = thread.id,
            source_messages = messages.len(),
            round_matched = matched_round.is_some(),
            rules_changed = contest
                .as_ref()
                .is_none_or(|row| row.rules_hash != rules_hash),
            "Inspector preview"
        );
        return Ok(());
    }
    if let (Some(contest), Some(round)) = (&contest, matched_round)
        && (contest.id_zsl_round.is_none() || configured.round_id.is_some())
    {
        runtime
            .database
            .link_inspector_round(contest.id, round, configured.round_id.is_some())
            .await?;
    }
    if let Some(existing) = &contest
        && (configured.closed
            || thread.thread_metadata.locked
            || (existing.state == "frozen" && !configured.reopen))
    {
        runtime
            .database
            .freeze_inspector_contest(existing.id, true)
            .await?;
        publish_frozen(runtime, bot_id, existing, &thread.id).await?;
        return Ok(());
    }
    if configured.closed || thread.thread_metadata.locked {
        return Ok(());
    }
    let preserved_round = contest.as_ref().and_then(|row| row.id_zsl_round);
    runtime
        .database
        .save_inspector_contest(&InspectorContestInput {
            thread_id: thread.id.clone(),
            guild_id: thread.guild_id.clone(),
            forum_id: thread.parent_id.clone(),
            title: thread.name.clone(),
            theme: parsed.theme.clone(),
            season_number,
            round_number,
            id_zsl_round: if configured.round_id.is_some() {
                matched_round.or(preserved_round)
            } else {
                preserved_round.or(matched_round)
            },
            mapping_source: if configured.round_id.is_some() {
                "explicit"
            } else if matched_round.is_some() {
                "title"
            } else {
                "unlinked"
            }
            .into(),
            rules: serde_json::to_value(&configured.rules)?,
            rules_hash: rules_hash.clone(),
            state: "open".into(),
            frozen_at: None,
        })
        .await?;
    contest = runtime.database.get_inspector_contest(&thread.id).await?;
    let contest = contest.context("Inspector contest disappeared after save")?;
    let messages = runtime.discord.messages(&thread.id).await?;
    let previous = runtime
        .database
        .get_inspector_submissions(contest.id)
        .await?;
    let previous_sources = previous
        .iter()
        .map(source_from_row)
        .collect::<Result<Vec<_>>>()?;
    let sources = reconcile_sources(&messages, &previous_sources);
    let last_seen = jiff::Timestamp::now().to_string();
    let selected = runtime
        .database
        .reconcile_inspector_submissions(
            contest.id,
            &sources
                .iter()
                .map(|source| submission_input(source, &last_seen))
                .collect::<Result<Vec<_>>>()?,
        )
        .await?;
    let ids: Vec<_> = selected
        .iter()
        .filter(|row| row.source_error.is_none())
        .filter_map(|row| u64::try_from(row.workshop_id).ok())
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();
    let mut details = HashMap::new();
    for batch in ids.chunks(100) {
        for item in runtime.metadata.get_items(batch).await? {
            details.insert(item.workshop_id, item);
        }
    }
    let mut accepted = Vec::new();
    let mut complete = true;
    let mut results = HashMap::<String, bool>::new();
    for submission in &selected {
        match validate_submission(
            runtime,
            submission,
            &details,
            &configured.rules,
            &rules_hash,
            options.force,
        )
        .await
        {
            Ok(validation) => {
                results
                    .entry(submission.message_id.clone())
                    .and_modify(|valid| *valid &= validation.valid)
                    .or_insert(validation.valid);
                if validation.valid {
                    accepted.push((submission, validation));
                }
            }
            Err(error) => {
                complete = false;
                runtime
                    .database
                    .set_inspector_submission_retry(submission.id, "inspection-transient")
                    .await?;
                tracing::warn!(submission_id = submission.id, error = %error, "Inspector submission deferred");
            }
        }
    }
    update_reactions(
        runtime.discord,
        &thread.id,
        &messages,
        &sources,
        &previous,
        &results,
    )
    .await?;
    if !complete {
        bail!("Inspector contest has deferred submissions");
    }
    accepted.sort_by(|(left, _), (right, _)| {
        left.message_created_at
            .cmp(&right.message_created_at)
            .then(left.id.cmp(&right.id))
    });
    let output = create_submission_playlist(
        &parsed.theme,
        &accepted
            .iter()
            .map(|(submission, validation)| validation_member(submission, validation))
            .collect::<Result<Vec<_>>>()?,
    )?;
    let current = runtime.database.get_inspector_playlist(&thread.id).await?;
    if current
        .as_ref()
        .map(|bundle| bundle.playlist.digest.as_str())
        != Some(&output.digest)
    {
        let object_key = format!(
            "inspector/playlists/{}/{}.zeeplist",
            thread.id, output.digest
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
                &output.digest,
                &object_key,
                &output
                    .members
                    .iter()
                    .map(|member| {
                        Ok(InspectorPlaylistMember {
                            id_validation: member.id_validation,
                            workshop_id: i64::try_from(member.workshop_id)
                                .context("Workshop ID exceeds PostgreSQL bigint")?,
                        })
                    })
                    .collect::<Result<Vec<_>>>()?,
            )
            .await?;
    }
    let version = runtime
        .database
        .get_inspector_playlist(&thread.id)
        .await?
        .context("Inspector playlist disappeared after publish")?
        .playlist;
    publish(runtime, bot_id, &contest, &version, &output.json, &messages).await?;
    tracing::info!(
        thread_id = thread.id,
        valid = output.members.len(),
        "Inspector contest complete"
    );
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
    if submission.source_error.is_none()
        && item.is_none_or(|item| !item.available || item.updated_at.starts_with("1970-"))
    {
        bail!("workshop-metadata-unavailable");
    }
    let cached = runtime
        .database
        .get_inspector_validation(submission.latest_validation_id)
        .await?;
    if !force
        && cached.as_ref().is_some_and(|validation| {
            validation_cache_matches(
                validation,
                submission.source_error.as_deref(),
                item,
                rules_hash,
            )
        })
    {
        return Ok(cached.expect("cache checked"));
    }
    let mut inspection = None;
    let mut content_sha256 = None;
    let mut failures = submission.source_error.iter().cloned().collect::<Vec<_>>();
    if submission.source_error.is_none() {
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
                && after.file_size == before.file_size,
            "workshop-revision-changed"
        );
    }
    let payload = if failures.is_empty() {
        inspection
            .as_ref()
            .map(|inspection| {
                let mut payload = serde_json::to_value(&inspection.payload)?;
                let object_key = format!("inspector/payloads/{}.gz", inspection.payload.sha256);
                payload["objectKey"] = object_key.clone().into();
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
            payload: payload.map(|(payload, _)| payload),
        })
        .await?;
    let id = saved["id"]
        .as_i64()
        .context("Saved validation omitted ID")?;
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

async fn publish_frozen(
    runtime: &InspectorRuntime<'_>,
    bot_id: &str,
    contest: &InspectorContestRow,
    thread_id: &str,
) -> Result<()> {
    let Some(bundle) = runtime.database.get_inspector_playlist(thread_id).await? else {
        return Ok(());
    };
    let output = create_submission_playlist(
        &contest.theme,
        &bundle
            .members
            .iter()
            .map(|member| {
                Ok(ValidationMember {
                    id_validation: member.id_validation,
                    workshop_id: u64::try_from(member.workshop_id)
                        .context("Invalid persisted Workshop ID")?,
                    valid: member.valid,
                    payload: member
                        .payload
                        .clone()
                        .map(serde_json::from_value)
                        .transpose()?,
                })
            })
            .collect::<Result<Vec<_>>>()?,
    )?;
    let messages = runtime.discord.messages(thread_id).await?;
    publish(
        runtime,
        bot_id,
        contest,
        &bundle.playlist,
        &output.json,
        &messages,
    )
    .await?;
    Ok(())
}

async fn publish(
    runtime: &InspectorRuntime<'_>,
    bot_id: &str,
    contest: &InspectorContestRow,
    playlist: &InspectorPlaylistRow,
    json: &str,
    messages: &[SourceMessage],
) -> Result<()> {
    publish_discord_playlist(
        runtime.discord,
        runtime.database,
        bot_id,
        &PublicationContest {
            id: contest.id,
            thread_id: contest.thread_id.clone(),
            publication: serde_json::from_value::<PublicationState>(contest.publication.clone())?,
        },
        &PlaylistVersion {
            digest: playlist.digest.clone(),
            valid_count: usize::try_from(playlist.valid_count)
                .context("Invalid playlist valid count")?,
            date_created_epoch: playlist.date_created_epoch,
        },
        json,
        messages,
    )
    .await?;
    Ok(())
}

async fn update_reactions(
    discord: &DiscordRest,
    thread_id: &str,
    messages: &[SourceMessage],
    sources: &[SourceSubmission],
    previous: &[InspectorSubmissionRow],
    results: &HashMap<String, bool>,
) -> Result<()> {
    for message in messages.iter().filter(|message| !message.author.bot) {
        let current: Vec<_> = sources
            .iter()
            .filter(|source| source.message_id == message.id)
            .collect();
        if !current
            .iter()
            .any(|source| source.state == SubmissionState::Selected)
            && (!current.is_empty() || previous.iter().any(|row| row.message_id == message.id))
        {
            discord.reaction(thread_id, message, None).await?;
        } else if let Some(valid) = results.get(&message.id) {
            discord.reaction(thread_id, message, Some(*valid)).await?;
        }
    }
    Ok(())
}

fn source_from_row(row: &InspectorSubmissionRow) -> Result<SourceSubmission> {
    Ok(SourceSubmission {
        author_id: row.author_id.clone(),
        message_created_at: row.message_created_at.clone(),
        message_edited_at: row.message_edited_at.clone(),
        message_id: row.message_id.clone(),
        source_error: row.source_error.clone(),
        state: match row.state.as_str() {
            "selected" => SubmissionState::Selected,
            "superseded" => SubmissionState::Superseded,
            "withdrawn" => SubmissionState::Withdrawn,
            _ => bail!("Invalid persisted submission state"),
        },
        workshop_id: u64::try_from(row.workshop_id).context("Invalid persisted Workshop ID")?,
    })
}

fn submission_input(
    source: &SourceSubmission,
    last_seen: &str,
) -> Result<InspectorSubmissionInput> {
    Ok(InspectorSubmissionInput {
        message_id: source.message_id.clone(),
        author_id: source.author_id.clone(),
        workshop_id: i64::try_from(source.workshop_id)
            .context("Workshop ID exceeds PostgreSQL bigint")?,
        message_created_at: source.message_created_at.clone(),
        message_edited_at: source.message_edited_at.clone(),
        state: match source.state {
            SubmissionState::Selected => "selected",
            SubmissionState::Superseded => "superseded",
            SubmissionState::Withdrawn => "withdrawn",
        }
        .into(),
        source_error: source.source_error.clone(),
        last_seen: last_seen.into(),
    })
}

fn validation_cache_matches(
    validation: &InspectorValidationRow,
    source_error: Option<&str>,
    item: Option<&WorkshopItemMetadata>,
    rules_hash: &str,
) -> bool {
    let failures = validation.failures.as_array().is_some_and(|failures| {
        failures
            .iter()
            .any(|failure| failure == "multiple-workshop-links")
    });
    failures == source_error.is_some()
        && validation.rules_hash == rules_hash
        && validation.validator_version == VALIDATOR_VERSION
        && validation.workshop_updated_at
            == item.map_or("source-error", |item| item.updated_at.as_str())
        && u64::try_from(validation.workshop_file_size).ok()
            == Some(item.map_or(0, |item| item.file_size))
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
    Ok(format!("{:x}", Sha256::digest(serde_json::to_vec(rules)?)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn cache_key_includes_source_error_rules_version_and_revision() {
        let validation = InspectorValidationRow {
            id: 1,
            id_submission: 2,
            workshop_updated_at: "source-error".into(),
            workshop_file_size: 0,
            validator_version: VALIDATOR_VERSION.into(),
            rules_hash: "rules".into(),
            failures: json!(["multiple-workshop-links"]),
            valid: false,
            payload: None,
        };
        assert!(validation_cache_matches(
            &validation,
            Some("multiple-workshop-links"),
            None,
            "rules"
        ));
        assert!(!validation_cache_matches(&validation, None, None, "rules"));
        assert!(!validation_cache_matches(
            &validation,
            Some("multiple-workshop-links"),
            None,
            "changed"
        ));
    }
}
