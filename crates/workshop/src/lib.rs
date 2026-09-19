pub mod files;
pub mod metadata;
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
