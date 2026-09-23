use crate::assets::{LevelLoader, PreparedLevel, PreparedPlaylist};
use anyhow::{Context, Result, ensure};
use serde::Deserialize;
use std::{collections::HashMap, sync::Arc};
use tokio::sync::Mutex;
use zc_core::{
    object_storage::{DownloadConstraints, ObjectStorage},
    zeepnet::OnlineLevel,
};
use zc_database::{
    Database,
    services::{inspector::InspectorPlaylistBundle, lobby_assets::TournamentLobbyAsset},
};

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
    loaded: Arc<Mutex<HashMap<String, Arc<[u8]>>>>,
}

pub(super) enum SubmissionPlaylist {
    Missing,
    Empty,
    Ready(SubmissionAsset),
}

#[derive(Clone)]
pub struct SubmissionAsset {
    pub digest: String,
    pub playlist: PreparedPlaylist,
}

impl SubmissionAsset {
    pub async fn load(&self, uid: &str, workshop_id: u64) -> Result<Option<PreparedLevel>> {
        self.playlist.load(uid, workshop_id).await
    }

    pub async fn first(&self) -> Result<PreparedLevel> {
        let level = &self.playlist.levels[0];
        self.load(&level.uid, level.workshop_id)
            .await?
            .context("Submission playlist first level unavailable")
    }
}

impl SubmissionAssets {
    pub fn new(database: Database, storage: Arc<dyn ObjectStorage>, thread_id: String) -> Self {
        Self {
            database,
            storage,
            thread_id,
            loaded: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub(super) async fn refresh(&self) -> Result<SubmissionPlaylist> {
        let Some(bundle) = self
            .database
            .get_inspector_playlist(&self.thread_id)
            .await?
        else {
            return Ok(SubmissionPlaylist::Missing);
        };
        Self::from_bundle(bundle, self.storage.clone(), self.loaded.clone())
    }

    fn from_bundle(
        bundle: InspectorPlaylistBundle,
        storage: Arc<dyn ObjectStorage>,
        loaded: Arc<Mutex<HashMap<String, Arc<[u8]>>>>,
    ) -> Result<SubmissionPlaylist> {
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
            return Ok(SubmissionPlaylist::Empty);
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
            storage,
            loaded,
        });
        let playlist = PreparedPlaylist::new(levels, loader)?;
        Ok(SubmissionPlaylist::Ready(SubmissionAsset {
            digest: bundle.playlist.digest,
            playlist,
        }))
    }
}

struct SubmissionLoader {
    entries: Arc<[SubmissionEntry]>,
    storage: Arc<dyn ObjectStorage>,
    loaded: Arc<Mutex<HashMap<String, Arc<[u8]>>>>,
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
        let cached = self.loaded.lock().await.get(&payload.sha256).cloned();
        let data = if let Some(cached) = cached.filter(|data| data.len() == payload.byte_size) {
            cached
        } else {
            let downloaded: Arc<[u8]> = self
                .storage
                .download(
                    &payload.object_key,
                    DownloadConstraints {
                        max_bytes: MAX_LEVEL_BYTES,
                        expected_bytes: Some(payload.byte_size),
                        expected_sha256: Some(&payload.sha256),
                    },
                )
                .await?
                .into();
            self.loaded
                .lock()
                .await
                .insert(payload.sha256.clone(), downloaded.clone());
            downloaded
        };
        Ok(Some(PreparedLevel {
            compressed_data: data,
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use zc_database::services::inspector::{InspectorPlaylistMemberRow, InspectorPlaylistRow};

    #[derive(Default)]
    struct TestStorage {
        downloads: AtomicUsize,
    }

    #[async_trait::async_trait]
    impl ObjectStorage for TestStorage {
        async fn upload(&self, _: &str, _: Vec<u8>, _: &str) -> Result<()> {
            unreachable!()
        }

        async fn download(&self, _: &str, _: DownloadConstraints<'_>) -> Result<Vec<u8>> {
            self.downloads.fetch_add(1, Ordering::Relaxed);
            Ok(vec![1, 2, 3])
        }

        async fn delete(&self, _: &str) -> Result<()> {
            unreachable!()
        }
    }

    fn bundle(digest: &str) -> InspectorPlaylistBundle {
        InspectorPlaylistBundle {
            playlist: InspectorPlaylistRow {
                id: 1,
                digest: digest.into(),
                valid_count: 1,
                object_key: "inspector/playlist".into(),
                date_created_epoch: 0,
            },
            members: vec![InspectorPlaylistMemberRow {
                id_validation: 1,
                workshop_id: 42,
                valid: true,
                payload: Some(serde_json::json!({
                    "sha256": "0".repeat(64),
                    "byteSize": 3,
                    "uid": "level-42",
                    "name": "Level",
                    "author": "Author",
                    "objectKey": "inspector/level"
                })),
            }],
        }
    }

    #[tokio::test]
    async fn refresh_builds_metadata_without_downloading_and_reuses_loaded_level() -> Result<()> {
        let storage = Arc::new(TestStorage::default());
        let loaded = Arc::new(Mutex::new(HashMap::new()));
        let SubmissionPlaylist::Ready(asset) =
            SubmissionAssets::from_bundle(bundle("a"), storage.clone(), loaded.clone())?
        else {
            panic!("expected playlist");
        };
        assert_eq!(storage.downloads.load(Ordering::Relaxed), 0);
        assert_eq!(asset.first().await?.level.uid, "level-42");
        assert_eq!(asset.first().await?.level.uid, "level-42");
        let SubmissionPlaylist::Ready(republished) =
            SubmissionAssets::from_bundle(bundle("b"), storage.clone(), loaded)?
        else {
            panic!("expected republished playlist");
        };
        assert_eq!(republished.first().await?.level.uid, "level-42");
        assert_eq!(storage.downloads.load(Ordering::Relaxed), 1);
        Ok(())
    }

    #[test]
    fn empty_published_playlist_is_distinct_from_missing_playlist() -> Result<()> {
        let mut bundle = bundle("empty");
        bundle.members.clear();
        assert!(matches!(
            SubmissionAssets::from_bundle(
                bundle,
                Arc::new(TestStorage::default()),
                Arc::new(Mutex::new(HashMap::new()))
            )?,
            SubmissionPlaylist::Empty
        ));
        Ok(())
    }
}
