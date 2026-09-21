use crate::assets::{LevelLoader, PreparedLevel, PreparedPlaylist};
use anyhow::{Context, Result, ensure};
use serde::Deserialize;
use std::sync::Arc;
use zc_core::{
    object_storage::{DownloadConstraints, ObjectStorage},
    zeepnet::OnlineLevel,
};
use zc_database::{Database, services::lobby_assets::TournamentLobbyAsset};

const MAX_LEVEL_BYTES: usize = 64 * 1024 * 1024;

#[derive(Clone)]
pub struct TournamentAsset {
    pub level: PreparedLevel,
    pub id_tournament: i32,
    pub tournament_slug: String,
    pub tournament_end_at: String,
}

pub struct TournamentAssets {
    database: Database,
    storage: Arc<dyn ObjectStorage>,
    tournament_type: i32,
    current: tokio::sync::RwLock<Option<TournamentAsset>>,
}

impl TournamentAssets {
    pub fn new(
        database: Database,
        storage: Arc<dyn ObjectStorage>,
        tournament_type: i32,
    ) -> Result<Self> {
        ensure!(matches!(tournament_type, 0 | 1), "Invalid tournament type");
        Ok(Self {
            database,
            storage,
            tournament_type,
            current: tokio::sync::RwLock::new(None),
        })
    }

    pub async fn current(&self) -> Option<TournamentAsset> {
        self.current.read().await.clone()
    }

    pub async fn refresh(&self) -> Result<Option<TournamentAsset>> {
        let Some(metadata) = self
            .database
            .preferred_tournament_lobby_asset(self.tournament_type)
            .await?
        else {
            return Ok(self.current().await);
        };
        if self
            .current
            .read()
            .await
            .as_ref()
            .is_some_and(|asset| asset.level.content_sha256.as_ref() == metadata.content_sha256)
        {
            return Ok(self.current().await);
        }
        let level = download_tournament_asset(self.storage.as_ref(), &metadata).await?;
        let asset = TournamentAsset {
            level,
            id_tournament: metadata.id_tournament,
            tournament_slug: metadata.tournament_slug,
            tournament_end_at: metadata.tournament_end_at,
        };
        *self.current.write().await = Some(asset.clone());
        Ok(Some(asset))
    }
}

async fn download_tournament_asset(
    storage: &dyn ObjectStorage,
    metadata: &TournamentLobbyAsset,
) -> Result<PreparedLevel> {
    let byte_size = usize::try_from(metadata.byte_size).context("Invalid tournament asset size")?;
    ensure!(
        (1..=MAX_LEVEL_BYTES).contains(&byte_size),
        "Prepared tournament asset size is invalid"
    );
    let workshop_id =
        u64::try_from(metadata.workshop_id).context("Invalid tournament workshop ID")?;
    let data = storage
        .download(
            &metadata.object_key,
            DownloadConstraints {
                max_bytes: MAX_LEVEL_BYTES,
                expected_bytes: Some(byte_size),
                expected_sha256: Some(&metadata.content_sha256),
            },
        )
        .await?;
    Ok(PreparedLevel {
        compressed_data: data.into(),
        content_sha256: metadata.content_sha256.clone().into(),
        level: OnlineLevel {
            author: metadata.author.clone(),
            collaborators: metadata.collaborators.clone(),
            name: metadata.level_name.clone(),
            override_author_name: metadata.override_author_name.clone(),
            uid: metadata.file_uid.clone(),
            workshop_id,
        },
    })
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SubmissionPayload {
    sha256: String,
    byte_size: usize,
    uid: String,
    name: String,
    author: String,
    #[serde(default)]
    collaborators: String,
    #[serde(default)]
    override_author_name: String,
    object_key: String,
}

#[derive(Clone)]
struct SubmissionEntry {
    workshop_id: u64,
    payload: SubmissionPayload,
}

pub struct SubmissionAssets {
    database: Database,
    storage: Arc<dyn ObjectStorage>,
    thread_id: String,
}

#[derive(Clone)]
pub struct SubmissionAsset {
    pub digest: String,
    pub first: PreparedLevel,
    pub playlist: PreparedPlaylist,
}

impl SubmissionAssets {
    pub fn new(database: Database, storage: Arc<dyn ObjectStorage>, thread_id: String) -> Self {
        Self {
            database,
            storage,
            thread_id,
        }
    }

    pub async fn refresh(self: &Arc<Self>) -> Result<Option<SubmissionAsset>> {
        let Some(bundle) = self
            .database
            .get_inspector_playlist(&self.thread_id)
            .await?
        else {
            return Ok(None);
        };
        let entries = bundle
            .members
            .into_iter()
            .filter(|member| member.valid)
            .map(|member| {
                let workshop_id =
                    u64::try_from(member.workshop_id).context("Invalid submission workshop ID")?;
                let payload = serde_json::from_value::<SubmissionPayload>(
                    member.payload.context("Submission payload missing")?,
                )?;
                validate_submission_payload(&payload)?;
                Ok(SubmissionEntry {
                    workshop_id,
                    payload,
                })
            })
            .collect::<Result<Vec<_>>>()?;
        if entries.is_empty() {
            return Ok(None);
        }
        ensure!(
            entries.len() <= 1_001,
            "Submission playlist exceeds protocol capacity"
        );
        let levels = entries
            .iter()
            .map(|entry| online_level(entry.workshop_id, &entry.payload))
            .collect();
        let loader: Arc<dyn LevelLoader> = Arc::new(SubmissionLoader {
            entries: entries.clone().into(),
            storage: self.storage.clone(),
        });
        let playlist = PreparedPlaylist::new(levels, loader.clone())?;
        let first = loader
            .load(&entries[0].payload.uid, entries[0].workshop_id)
            .await?
            .context("Submission playlist first level unavailable")?;
        Ok(Some(SubmissionAsset {
            digest: bundle.playlist.digest,
            first,
            playlist,
        }))
    }
}

struct SubmissionLoader {
    entries: Arc<[SubmissionEntry]>,
    storage: Arc<dyn ObjectStorage>,
}

#[async_trait::async_trait]
impl LevelLoader for SubmissionLoader {
    async fn load(&self, uid: &str, workshop_id: u64) -> Result<Option<PreparedLevel>> {
        let Some(entry) = self
            .entries
            .iter()
            .find(|entry| entry.workshop_id == workshop_id && entry.payload.uid == uid)
        else {
            return Ok(None);
        };
        let payload = &entry.payload;
        let data = self
            .storage
            .download(
                &payload.object_key,
                DownloadConstraints {
                    max_bytes: MAX_LEVEL_BYTES,
                    expected_bytes: Some(payload.byte_size),
                    expected_sha256: Some(&payload.sha256),
                },
            )
            .await?;
        Ok(Some(PreparedLevel {
            compressed_data: data.into(),
            content_sha256: payload.sha256.clone().into(),
            level: online_level(workshop_id, payload),
        }))
    }
}

fn online_level(workshop_id: u64, payload: &SubmissionPayload) -> OnlineLevel {
    OnlineLevel {
        author: payload.author.clone(),
        collaborators: payload.collaborators.clone(),
        name: payload.name.clone(),
        override_author_name: payload.override_author_name.clone(),
        uid: payload.uid.clone(),
        workshop_id,
    }
}

fn validate_submission_payload(payload: &SubmissionPayload) -> Result<()> {
    ensure!(
        (1..=MAX_LEVEL_BYTES).contains(&payload.byte_size),
        "Invalid inspector payload metadata"
    );
    ensure!(
        payload.object_key.starts_with("inspector/"),
        "Invalid inspector payload metadata"
    );
    ensure!(
        payload.sha256.len() == 64 && payload.sha256.bytes().all(|byte| byte.is_ascii_hexdigit()),
        "Invalid inspector payload metadata"
    );
    Ok(())
}
