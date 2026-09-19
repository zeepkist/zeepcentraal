pub mod steamcmd;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkshopItemMetadata {
    pub available: bool,
    pub creator_id: u64,
    pub file_size: u64,
    pub image_url: String,
    pub name: String,
    pub permanent_failure: Option<String>,
    pub visibility: i32,
    pub workshop_id: u64,
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
