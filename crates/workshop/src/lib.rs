pub mod files;
pub mod metadata;
pub mod persistence;
pub mod scanner;
pub mod steamcmd;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkshopItemMetadata {
    pub available: bool,
    pub created_at: String,
    pub creator_id: u64,
    pub file_size: u64,
    pub image_url: String,
    pub name: String,
    pub permanent_failure: Option<String>,
    pub updated_at: String,
    pub visibility: i32,
    pub workshop_id: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkshopCatalogPage {
    pub items: Vec<WorkshopItemMetadata>,
    pub next_cursor: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkshopUserItemPage {
    pub next_page: Option<u32>,
    pub workshop_ids: Vec<u64>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DownloadedWorkshopItem {
    pub directory: PathBuf,
    pub workshop_id: u64,
}

#[async_trait]
pub trait WorkshopDownloader: Send + Sync {
    async fn download(&self, workshop_ids: &[u64]) -> anyhow::Result<steamcmd::WorkshopDownload>;
}

#[async_trait]
pub trait WorkshopMetadataAdapter: Send + Sync {
    async fn get_items(&self, workshop_ids: &[u64]) -> anyhow::Result<Vec<WorkshopItemMetadata>>;
    async fn list_items(&self, cursor: &str, limit: u32) -> anyhow::Result<WorkshopCatalogPage>;
    async fn list_user_item_ids(
        &self,
        uploader_id: u64,
        page: u32,
        limit: u32,
    ) -> anyhow::Result<WorkshopUserItemPage>;
}

#[derive(Clone, Debug)]
pub struct WorkshopLevelInput {
    pub metadata: WorkshopItemMetadata,
    pub parsed: zc_core::levels::ParsedLevel,
    pub level_author_id: u64,
    pub name: String,
    pub image_url: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct WorkshopLevelUpsertResult {
    pub id_level: i32,
    pub score_changed: bool,
}

#[async_trait]
pub trait WorkshopPersistence: Send + Sync {
    async fn find_level_author_by_xx_hash(
        &self,
        xx_hash: &str,
        excluded_uploader_id: u64,
    ) -> anyhow::Result<Option<u64>>;
    async fn mark_deleted(&self, workshop_id: u64, visibility: i32) -> anyhow::Result<Vec<i32>>;
    async fn mark_missing(
        &self,
        workshop_id: u64,
        active_xx_hashes: &[String],
    ) -> anyhow::Result<Vec<i32>>;
    async fn upload_thumbnail(&self, extension: &str, contents: Vec<u8>) -> anyhow::Result<String>;
    async fn upsert_level(
        &self,
        input: WorkshopLevelInput,
    ) -> anyhow::Result<WorkshopLevelUpsertResult>;
}
