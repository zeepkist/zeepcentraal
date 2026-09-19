use crate::{
    DownloadedWorkshopItem, WorkshopDownloader, WorkshopItemMetadata, WorkshopLevelInput,
    WorkshopMetadataAdapter, WorkshopPersistence, files::discover_levels,
};
use anyhow::{Context, Result, anyhow, ensure};
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, VecDeque},
    path::Path,
};

const MAX_LEVEL_FILE_BYTES: u64 = 64 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES: u64 = 16 * 1024 * 1024;
pub const ZSL_WORKSHOP_AUTHOR_ID: u64 = 76_561_198_031_919_228;

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum WorkshopScanStatus {
    Scanned,
    PermanentlyUnavailable,
    Inaccessible,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkshopScanResult {
    pub changed_level_ids: Vec<i32>,
    pub status: WorkshopScanStatus,
    pub workshop_id: u64,
}

#[derive(Debug)]
pub struct WorkshopScanFailure {
    pub workshop_id: u64,
    pub error: anyhow::Error,
}

#[derive(Debug)]
pub struct WorkshopBatchScanResult {
    pub results: Vec<WorkshopScanResult>,
    pub transient_failures: Vec<WorkshopScanFailure>,
}

pub struct WorkshopScanner<'a> {
    metadata: &'a dyn WorkshopMetadataAdapter,
    downloader: &'a dyn WorkshopDownloader,
    persistence: &'a dyn WorkshopPersistence,
}

impl<'a> WorkshopScanner<'a> {
    pub const fn new(
        metadata: &'a dyn WorkshopMetadataAdapter,
        downloader: &'a dyn WorkshopDownloader,
        persistence: &'a dyn WorkshopPersistence,
    ) -> Self {
        Self {
            metadata,
            downloader,
            persistence,
        }
    }

    pub async fn scan_workshop_item(&self, workshop_id: u64) -> Result<WorkshopScanResult> {
        let mut batch = self.scan_workshop_items(&[workshop_id], 1).await?;
        if let Some(failure) = batch.transient_failures.pop() {
            return Err(failure.error);
        }
        batch
            .results
            .pop()
            .with_context(|| format!("Workshop scan produced no result for {workshop_id}"))
    }

    pub async fn scan_workshop_items(
        &self,
        workshop_ids: &[u64],
        batch_size: usize,
    ) -> Result<WorkshopBatchScanResult> {
        ensure!(batch_size > 0, "Workshop batch size must be positive");
        let metadata_items = self.metadata.get_items(workshop_ids).await?;
        let mut results = Vec::new();
        let mut available = Vec::new();
        for metadata in metadata_items {
            if !metadata.available {
                results.push(WorkshopScanResult {
                    workshop_id: metadata.workshop_id,
                    status: WorkshopScanStatus::PermanentlyUnavailable,
                    changed_level_ids: self
                        .persistence
                        .mark_deleted(
                            metadata.workshop_id,
                            zc_core::steam::STEAM_VISIBILITY_HIDDEN,
                        )
                        .await?,
                });
            } else if !zc_core::steam::can_download_workshop_item(metadata.visibility) {
                results.push(WorkshopScanResult {
                    workshop_id: metadata.workshop_id,
                    status: WorkshopScanStatus::Inaccessible,
                    changed_level_ids: self
                        .persistence
                        .mark_deleted(metadata.workshop_id, metadata.visibility)
                        .await?,
                });
            } else {
                available.push(metadata);
            }
        }

        let metadata_by_id: HashMap<_, _> = available
            .iter()
            .cloned()
            .map(|item| (item.workshop_id, item))
            .collect();
        let mut pending = VecDeque::new();
        for batch in available
            .iter()
            .map(|item| item.workshop_id)
            .collect::<Vec<_>>()
            .chunks(batch_size)
        {
            pending.push_back(batch.to_vec());
        }
        let mut transient_failures = Vec::new();
        while let Some(batch) = pending.pop_front() {
            match self.scan_downloaded_batch(&batch, &metadata_by_id).await {
                Ok(mut scanned) => results.append(&mut scanned),
                Err(error) if batch.len() == 1 => transient_failures.push(WorkshopScanFailure {
                    workshop_id: batch[0],
                    error,
                }),
                Err(_) => {
                    let midpoint = batch.len().div_ceil(2);
                    pending.push_front(batch[midpoint..].to_vec());
                    pending.push_front(batch[..midpoint].to_vec());
                }
            }
        }
        Ok(WorkshopBatchScanResult {
            results,
            transient_failures,
        })
    }

    async fn scan_downloaded_batch(
        &self,
        workshop_ids: &[u64],
        metadata_by_id: &HashMap<u64, WorkshopItemMetadata>,
    ) -> Result<Vec<WorkshopScanResult>> {
        let download = self.downloader.download(workshop_ids).await?;
        let items = download.items.clone();
        let result = self
            .persist_downloaded(items, workshop_ids, metadata_by_id)
            .await;
        let cleanup = download.cleanup().await;
        match (result, cleanup) {
            (Ok(value), Ok(())) => Ok(value),
            (Err(error), _) => Err(error),
            (Ok(_), Err(error)) => Err(error.context("failed to clean workshop download")),
        }
    }

    async fn persist_downloaded(
        &self,
        items: Vec<DownloadedWorkshopItem>,
        workshop_ids: &[u64],
        metadata_by_id: &HashMap<u64, WorkshopItemMetadata>,
    ) -> Result<Vec<WorkshopScanResult>> {
        ensure!(
            items.len() == workshop_ids.len(),
            "SteamCMD download returned an incomplete workshop batch"
        );
        let mut results = Vec::with_capacity(items.len());
        for item in items {
            let metadata = metadata_by_id
                .get(&item.workshop_id)
                .with_context(|| format!("Workshop metadata {} is missing", item.workshop_id))?;
            let prepared = prepare_item(&item, metadata.creator_id).await?;
            let mut changed_level_ids = Vec::new();
            let mut hashes = Vec::with_capacity(prepared.len());
            for level in prepared {
                let level_author_id = if metadata.creator_id == ZSL_WORKSHOP_AUTHOR_ID {
                    self.persistence
                        .find_level_author_by_xx_hash(&level.parsed.hash, ZSL_WORKSHOP_AUTHOR_ID)
                        .await?
                        .unwrap_or(ZSL_WORKSHOP_AUTHOR_ID)
                } else {
                    metadata.creator_id
                };
                let image_url = if let Some(thumbnail_path) = &level.thumbnail_path {
                    let thumbnail = read_bounded(thumbnail_path, MAX_THUMBNAIL_BYTES).await?;
                    self.persistence.upload_thumbnail("jpg", thumbnail).await?
                } else {
                    String::new()
                };
                hashes.push(level.parsed.hash.clone());
                let upsert = self
                    .persistence
                    .upsert_level(WorkshopLevelInput {
                        metadata: metadata.clone(),
                        parsed: level.parsed,
                        level_author_id,
                        name: level.name,
                        image_url,
                    })
                    .await?;
                if upsert.score_changed {
                    changed_level_ids.push(upsert.id_level);
                }
            }
            changed_level_ids.extend(
                self.persistence
                    .mark_missing(item.workshop_id, &hashes)
                    .await?,
            );
            changed_level_ids.sort_unstable();
            changed_level_ids.dedup();
            results.push(WorkshopScanResult {
                changed_level_ids,
                status: WorkshopScanStatus::Scanned,
                workshop_id: item.workshop_id,
            });
        }
        Ok(results)
    }
}

struct PreparedLevel {
    name: String,
    parsed: zc_core::levels::ParsedLevel,
    thumbnail_path: Option<std::path::PathBuf>,
}

async fn prepare_item(
    item: &DownloadedWorkshopItem,
    creator_id: u64,
) -> Result<Vec<PreparedLevel>> {
    let files = discover_levels(&item.directory).await?;
    let mut prepared = Vec::with_capacity(files.len());
    for file in files {
        let content = read_bounded(&file.level_path, MAX_LEVEL_FILE_BYTES)
            .await
            .with_context(|| {
                format!(
                    "Workshop {} level {} is too large",
                    item.workshop_id, file.name
                )
            })?;
        let content = String::from_utf8(content).context("Level file is not UTF-8")?;
        let parsed =
            zc_core::levels::parse_level(&content, false, creator_id).map_err(|error| {
                anyhow!(
                    "Workshop {} level {} ({}) failed validation: {error}",
                    item.workshop_id,
                    file.name,
                    file.level_path.display()
                )
            })?;
        prepared.push(PreparedLevel {
            name: file.name,
            parsed,
            thumbnail_path: file.thumbnail_path,
        });
    }
    Ok(prepared)
}

async fn read_bounded(path: &Path, max_bytes: u64) -> Result<Vec<u8>> {
    let metadata = tokio::fs::metadata(path).await?;
    ensure!(
        metadata.len() <= max_bytes,
        "File exceeds {max_bytes} bytes"
    );
    let bytes = tokio::fs::read(path).await?;
    ensure!(
        bytes.len() as u64 <= max_bytes,
        "File exceeds {max_bytes} bytes"
    );
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        WorkshopCatalogPage, WorkshopLevelUpsertResult, WorkshopUserItemPage,
        steamcmd::WorkshopDownload,
    };
    use async_trait::async_trait;
    use std::sync::Mutex;

    struct Metadata {
        item: WorkshopItemMetadata,
    }

    #[async_trait]
    impl WorkshopMetadataAdapter for Metadata {
        async fn get_items(&self, workshop_ids: &[u64]) -> Result<Vec<WorkshopItemMetadata>> {
            Ok(workshop_ids.iter().map(|_| self.item.clone()).collect())
        }

        async fn list_items(&self, _: &str, _: u32) -> Result<WorkshopCatalogPage> {
            unreachable!()
        }

        async fn list_user_item_ids(&self, _: u64, _: u32, _: u32) -> Result<WorkshopUserItemPage> {
            unreachable!()
        }
    }

    struct Downloader {
        root: std::path::PathBuf,
    }

    #[async_trait]
    impl WorkshopDownloader for Downloader {
        async fn download(&self, workshop_ids: &[u64]) -> Result<WorkshopDownload> {
            Ok(WorkshopDownload::new(
                self.root.clone(),
                workshop_ids
                    .iter()
                    .map(|workshop_id| DownloadedWorkshopItem {
                        workshop_id: *workshop_id,
                        directory: self.root.clone(),
                    })
                    .collect(),
            ))
        }
    }

    #[derive(Default)]
    struct Persistence {
        upserts: Mutex<Vec<WorkshopLevelInput>>,
        missing: Mutex<Vec<Vec<String>>>,
    }

    #[async_trait]
    impl WorkshopPersistence for Persistence {
        async fn find_level_author_by_xx_hash(&self, _: &str, _: u64) -> Result<Option<u64>> {
            Ok(None)
        }

        async fn mark_deleted(&self, _: u64, _: i32) -> Result<Vec<i32>> {
            Ok(vec![9])
        }

        async fn mark_missing(&self, _: u64, hashes: &[String]) -> Result<Vec<i32>> {
            self.missing.lock().unwrap().push(hashes.to_vec());
            Ok(vec![7])
        }

        async fn upload_thumbnail(&self, _: &str, _: Vec<u8>) -> Result<String> {
            Ok("thumbnails/test.jpg".to_owned())
        }

        async fn upsert_level(
            &self,
            input: WorkshopLevelInput,
        ) -> Result<WorkshopLevelUpsertResult> {
            self.upserts.lock().unwrap().push(input);
            Ok(WorkshopLevelUpsertResult {
                id_level: 6,
                score_changed: true,
            })
        }
    }

    fn metadata(visibility: i32) -> WorkshopItemMetadata {
        WorkshopItemMetadata {
            available: true,
            created_at: "2026-01-01T00:00:00Z".to_owned(),
            creator_id: 76_561_198_000_000_001,
            file_size: 1,
            image_url: String::new(),
            name: "Workshop".to_owned(),
            permanent_failure: None,
            updated_at: "2026-01-01T00:00:00Z".to_owned(),
            visibility,
            workshop_id: 123,
        }
    }

    #[tokio::test]
    async fn parses_persists_reconciles_and_cleans_download() -> Result<()> {
        let root = std::env::temp_dir().join(format!("zc-scanner-{}", zc_core::generate_uid()));
        tokio::fs::create_dir_all(&root).await?;
        let level = [
            "LevelEditor2,Author,uid-1",
            "0,0,0,0,0,0,0,0",
            "12.5,20,25,30,1,-1",
            "22,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0",
        ]
        .join("\n");
        tokio::fs::write(root.join("Track.zeeplevel"), level).await?;
        tokio::fs::write(root.join("track_thumbnail.jpg"), b"jpg").await?;
        let metadata = Metadata {
            item: metadata(zc_core::steam::STEAM_VISIBILITY_PUBLIC),
        };
        let downloader = Downloader { root: root.clone() };
        let persistence = Persistence::default();
        let scanner = WorkshopScanner::new(&metadata, &downloader, &persistence);
        let result = scanner.scan_workshop_item(123).await?;
        assert_eq!(result.status, WorkshopScanStatus::Scanned);
        assert_eq!(result.changed_level_ids, vec![6, 7]);
        assert!(!tokio::fs::try_exists(&root).await?);
        let upserts = persistence.upserts.lock().unwrap();
        assert_eq!(upserts.len(), 1);
        assert_eq!(upserts[0].name, "Track");
        assert_eq!(upserts[0].image_url, "thumbnails/test.jpg");
        assert_eq!(persistence.missing.lock().unwrap()[0].len(), 1);
        Ok(())
    }

    #[tokio::test]
    async fn inaccessible_item_is_deleted_without_download() -> Result<()> {
        let metadata = Metadata {
            item: metadata(zc_core::steam::STEAM_VISIBILITY_HIDDEN),
        };
        let downloader = Downloader {
            root: std::path::PathBuf::from("must-not-be-used"),
        };
        let persistence = Persistence::default();
        let scanner = WorkshopScanner::new(&metadata, &downloader, &persistence);
        let result = scanner.scan_workshop_item(123).await?;
        assert_eq!(result.status, WorkshopScanStatus::Inaccessible);
        assert_eq!(result.changed_level_ids, vec![9]);
        assert!(persistence.upserts.lock().unwrap().is_empty());
        Ok(())
    }
}
