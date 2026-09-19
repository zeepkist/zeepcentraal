use crate::{WorkshopLevelInput, WorkshopLevelUpsertResult, WorkshopPersistence};
use anyhow::{Context, Result, ensure};
use async_trait::async_trait;
use std::sync::Arc;
use zc_core::object_storage::ObjectStorage;
use zc_database::{Database, services::workshop::WorkshopLevelInput as DatabaseInput};

const MAX_THUMBNAIL_BYTES: usize = 16 * 1024 * 1024;

pub struct DatabaseWorkshopPersistence {
    database: Database,
    storage: Arc<dyn ObjectStorage>,
    thumbnail_folder: String,
    http: reqwest::Client,
}

impl DatabaseWorkshopPersistence {
    pub fn new(
        database: Database,
        storage: Arc<dyn ObjectStorage>,
        thumbnail_folder: impl Into<String>,
    ) -> Result<Self> {
        let thumbnail_folder = thumbnail_folder.into().trim_matches('/').to_owned();
        ensure!(!thumbnail_folder.is_empty(), "Thumbnail folder is empty");
        Ok(Self {
            database,
            storage,
            thumbnail_folder,
            http: reqwest::Client::builder().build()?,
        })
    }

    async fn upload_steam_thumbnail(&self, workshop_id: u64, url: &str) -> Result<String> {
        if url.is_empty() {
            return Ok(String::new());
        }
        let mut response = self
            .http
            .get(url)
            .send()
            .await
            .context("Steam workshop thumbnail request failed")?
            .error_for_status()
            .context("Steam workshop thumbnail request failed")?;
        if let Some(length) = response.content_length() {
            ensure!(
                length <= MAX_THUMBNAIL_BYTES as u64,
                "Steam workshop thumbnail is too large"
            );
        }
        let content_type = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or_default()
            .split(';')
            .next()
            .unwrap_or_default()
            .trim()
            .to_ascii_lowercase();
        let extension = image_extension(&content_type)
            .context("Steam workshop thumbnail content type is unsupported")?;
        let mut bytes = Vec::new();
        while let Some(chunk) = response.chunk().await? {
            ensure!(
                bytes.len().saturating_add(chunk.len()) <= MAX_THUMBNAIL_BYTES,
                "Steam workshop thumbnail is too large"
            );
            bytes.extend_from_slice(&chunk);
        }
        let key = format!("{}/{workshop_id}.{extension}", self.thumbnail_folder);
        self.storage.upload(&key, bytes, &content_type).await?;
        Ok(key)
    }
}

#[async_trait]
impl WorkshopPersistence for DatabaseWorkshopPersistence {
    async fn find_level_author_by_xx_hash(
        &self,
        xx_hash: &str,
        excluded_uploader_id: u64,
    ) -> Result<Option<u64>> {
        let excluded =
            i64::try_from(excluded_uploader_id).context("Steam ID exceeds PostgreSQL bigint")?;
        self.database
            .find_workshop_level_author(xx_hash, excluded)
            .await?
            .map(|value| u64::try_from(value).context("negative Steam ID in database"))
            .transpose()
    }

    async fn mark_deleted(&self, workshop_id: u64, visibility: i32) -> Result<Vec<i32>> {
        self.database
            .mark_workshop_deleted(
                i64::try_from(workshop_id).context("Workshop ID exceeds PostgreSQL bigint")?,
                i16::try_from(visibility).context("Workshop visibility exceeds smallint")?,
            )
            .await
    }

    async fn mark_missing(
        &self,
        workshop_id: u64,
        active_xx_hashes: &[String],
    ) -> Result<Vec<i32>> {
        self.database
            .mark_missing_workshop_levels_deleted(
                i64::try_from(workshop_id).context("Workshop ID exceeds PostgreSQL bigint")?,
                active_xx_hashes,
            )
            .await
    }

    async fn upload_thumbnail(&self, extension: &str, contents: Vec<u8>) -> Result<String> {
        ensure!(
            contents.len() <= MAX_THUMBNAIL_BYTES,
            "Workshop thumbnail is too large"
        );
        let normalized: String = extension
            .to_ascii_lowercase()
            .chars()
            .filter(char::is_ascii_alphanumeric)
            .collect();
        ensure!(
            !normalized.is_empty(),
            "Workshop thumbnail extension is invalid"
        );
        let key = format!(
            "{}/{}.{}",
            self.thumbnail_folder,
            zc_core::generate_uid(),
            normalized
        );
        self.storage
            .upload(&key, contents, &format!("image/{normalized}"))
            .await?;
        Ok(key)
    }

    async fn upsert_level(&self, input: WorkshopLevelInput) -> Result<WorkshopLevelUpsertResult> {
        let workshop_image_url = self
            .upload_steam_thumbnail(input.metadata.workshop_id, &input.metadata.image_url)
            .await?;
        let blocks = serde_json::to_value(&input.parsed.blocks)?;
        let database_input = DatabaseInput {
            hash: input.parsed.zeep_hash,
            xx_hash: input.parsed.hash,
            workshop_id: i64::try_from(input.metadata.workshop_id)?,
            workshop_name: input.metadata.name,
            workshop_image_url,
            workshop_visibility: i16::try_from(input.metadata.visibility)?,
            workshop_file_size: i32::try_from(input.metadata.file_size)?,
            author_id: i64::try_from(input.metadata.creator_id)?,
            level_author_id: i64::try_from(input.level_author_id)?,
            name: input.name,
            image_url: input.image_url,
            file_author: input.parsed.file_author,
            file_uid: input.parsed.uid,
            validation_time_author: input.parsed.validation_time_author as f32,
            validation_time_gold: input.parsed.validation_time_gold as f32,
            validation_time_silver: input.parsed.validation_time_silver as f32,
            validation_time_bronze: input.parsed.validation_time_bronze as f32,
            created_at: input.metadata.created_at,
            updated_at: input.metadata.updated_at,
            format: input.parsed.format.database_value(),
            amount_checkpoints: i32::try_from(input.parsed.amount_checkpoints)?,
            amount_finishes: i32::try_from(input.parsed.amount_finishes)?,
            amount_blocks: i32::try_from(input.parsed.amount_blocks)?,
            type_ground: i32::try_from(input.parsed.type_ground)?,
            type_skybox: i32::try_from(input.parsed.type_skybox)?,
            blocks,
        };
        let result = self.database.upsert_workshop_level(&database_input).await?;
        Ok(WorkshopLevelUpsertResult {
            id_level: result.id_level,
            score_changed: result.score_changed,
        })
    }
}

fn image_extension(content_type: &str) -> Option<&'static str> {
    match content_type {
        "image/jpeg" | "image/jpg" => Some("jpg"),
        "image/png" => Some("png"),
        "image/webp" => Some("webp"),
        "image/avif" => Some("avif"),
        _ => None,
    }
}
