use anyhow::{Context, Result};
use serde_json::{Value, json};
use std::collections::BTreeSet;
use zc_core::{
    object_storage::ObjectStorage,
    practice::{
        PracticeBundle, PracticeLevel, PracticePlaylist, practice_playlist_key,
        tournament_playlist_key, warmup_playlist_key,
    },
};
use zc_database::Database;
use zc_workshop::WorkshopDownloader;

fn entry(index: usize, level: &PracticeLevel, state: &str, stage: &str) -> Value {
    json!({"position":index + 1,"name":level.name,"uid":level.uid,
        "workshopId":level.workshop_id.to_string(),"state":state,"stage":stage})
}

pub async fn prepare(
    database: &Database,
    downloader: &dyn WorkshopDownloader,
    storage: &dyn ObjectStorage,
    revision: i32,
) -> Result<()> {
    let Some(job) = database.claim_zsl_playlist(revision).await? else {
        return Ok(());
    };
    let warmup = job.kind == "warmup";
    let tournament = job.kind == "tournament";
    let mut diagnostics = Vec::new();
    let result = async {
        let playlist = if warmup {
            crate::zsl_warmup::fetch_candidates()
                .await
                .context("Automatic warmup selection failed")?
        } else {
            let source = job
                .source
                .as_deref()
                .context("Playlist upload is missing")?;
            let playlist =
                PracticePlaylist::parse(source.as_bytes()).context("Invalid uploaded playlist")?;
            if tournament {
                playlist.validate_tournament()?;
            } else {
                let official = database
                    .zsl_tournament_source(job.round_id)
                    .await?
                    .and_then(|source| PracticePlaylist::parse(source.as_bytes()).ok());
                playlist.validate_practice(official.as_ref())?;
            }
            playlist
        };
        let ids = playlist
            .levels
            .iter()
            .map(|level| level.workshop_id)
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect::<Vec<_>>();
        database
            .zsl_playlist_progress(
                &job,
                json!(
                    playlist
                        .levels
                        .iter()
                        .enumerate()
                        .map(|(index, level)| entry(index, level, "pending", "Workshop download"))
                        .collect::<Vec<_>>()
                ),
            )
            .await?;
        let download = match downloader.download_available(&ids).await {
            Ok(download) => download,
            Err(error) => {
                let stage = error.to_string();
                diagnostics.extend(
                    playlist
                        .levels
                        .iter()
                        .enumerate()
                        .map(|(index, level)| entry(index, level, "failed", &stage)),
                );
                return Err(error.context("Workshop batch download failed"));
            }
        };
        let expected_count = if warmup { 4 } else { playlist.levels.len() };
        let mut bundle = PracticeBundle {
            round_length: playlist.round_length,
            round_id: job.round_id,
            playlist: match job.kind.as_str() {
                "warmup" => warmup_playlist_key(job.round_id),
                "tournament" => tournament_playlist_key(job.round_id),
                _ => practice_playlist_key(job.round_id),
            },
            levels: Vec::new(),
        };
        let mut hashes = BTreeSet::new();
        for (index, level) in playlist.levels.into_iter().enumerate() {
            let prepared = async {
                let payload =
                    crate::practice::prepare_level(level.clone(), &download.items, storage).await?;
                if tournament && index != 7 {
                    let hash = payload
                        .xx_hash
                        .as_deref()
                        .context("Canonical hash missing")?;
                    let legacy = payload
                        .legacy_hash
                        .as_deref()
                        .context("Legacy hash missing")?;
                    anyhow::ensure!(
                        payload
                            .author_time
                            .is_some_and(|time| time.is_finite() && time > 0.0),
                        "Author time is invalid"
                    );
                    anyhow::ensure!(hashes.insert(hash.to_owned()), "Duplicate scored track");
                    database
                        .resolve_submission_level(legacy, hash, false)
                        .await
                        .context("Scoring level lookup failed")?
                        .context("Scoring level unavailable")?;
                }
                Ok::<_, anyhow::Error>(payload)
            }
            .await;
            match prepared {
                Ok(payload) => {
                    diagnostics.push(entry(
                        if warmup { bundle.levels.len() } else { index },
                        &level,
                        "prepared",
                        "Payload uploaded",
                    ));
                    bundle.levels.push(payload);
                    if warmup && bundle.levels.len() == 4 {
                        break;
                    }
                }
                Err(error) => {
                    diagnostics.push(entry(index, &level, "failed", &error.to_string()));
                }
            }
        }
        if let Err(error) = download.cleanup().await {
            tracing::warn!(%error, round_id = job.round_id, "ZSL Workshop cleanup failed");
        }
        anyhow::ensure!(
            bundle.levels.len() == expected_count,
            "Too few playable levels"
        );
        bundle.validate()?;
        if tournament {
            bundle.validate_tournament()?;
        }
        Ok::<_, anyhow::Error>(bundle)
    }
    .await;
    match result {
        Ok(bundle) => {
            database
                .finish_zsl_playlist(&job, Some(&bundle), json!(diagnostics))
                .await
        }
        Err(error) => {
            diagnostics.push(json!({"state":"failed","stage":error.to_string()}));
            tracing::warn!(revision, round_id = job.round_id, %error, "ZSL playlist preparation failed");
            database
                .finish_zsl_playlist(&job, None, json!(diagnostics))
                .await
        }
    }
}
