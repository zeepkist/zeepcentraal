use crate::{
    WorkshopCatalogPage, WorkshopItemMetadata, WorkshopMetadataAdapter, WorkshopUserItemPage,
};
use anyhow::{Context, Result, ensure};
use async_trait::async_trait;
use serde::Deserialize;
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
struct SteamEnvelope {
    #[serde(default)]
    response: SteamResponse,
}

#[derive(Default, Debug, Deserialize)]
struct SteamResponse {
    next_cursor: Option<String>,
    #[serde(default)]
    publishedfiledetails: Vec<SteamPublishedFile>,
    startindex: Option<u64>,
    total: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct SteamPublishedFile {
    #[serde(default)]
    banned: bool,
    creator: Option<String>,
    file_size: Option<serde_json::Value>,
    preview_url: Option<String>,
    publishedfileid: Option<String>,
    #[serde(default)]
    result: i32,
    #[serde(default)]
    time_created: i64,
    #[serde(default)]
    time_updated: i64,
    title: Option<String>,
    #[serde(default)]
    visibility: i32,
}

pub struct SteamWebApiMetadata {
    api_key: String,
    app_id: String,
    client: reqwest::Client,
    endpoint: String,
}

impl SteamWebApiMetadata {
    pub fn new(api_key: impl Into<String>, app_id: impl Into<String>) -> Result<Self> {
        Self::with_endpoint(api_key, app_id, "https://api.steampowered.com")
    }

    pub fn with_endpoint(
        api_key: impl Into<String>,
        app_id: impl Into<String>,
        endpoint: impl Into<String>,
    ) -> Result<Self> {
        let api_key = api_key.into();
        ensure!(
            !api_key.is_empty(),
            "STEAM_API_KEY is required for workshop metadata"
        );
        Ok(Self {
            api_key,
            app_id: app_id.into(),
            client: reqwest::Client::builder().build()?,
            endpoint: endpoint.into(),
        })
    }

    async fn get_json(&self, url: reqwest::Url) -> Result<SteamResponse> {
        Ok(self
            .client
            .get(url)
            .send()
            .await
            .context("Steam Web API request failed")?
            .error_for_status()
            .context("Steam Web API request failed")?
            .json::<SteamEnvelope>()
            .await
            .context("Steam Web API response was invalid")?
            .response)
    }

    fn url(&self, path: &str) -> Result<reqwest::Url> {
        Ok(reqwest::Url::parse(&self.endpoint)?.join(path)?)
    }
}

#[async_trait]
impl WorkshopMetadataAdapter for SteamWebApiMetadata {
    async fn get_items(&self, workshop_ids: &[u64]) -> Result<Vec<WorkshopItemMetadata>> {
        if workshop_ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut url = self.url("/IPublishedFileService/GetDetails/v1/")?;
        {
            let mut query = url.query_pairs_mut();
            query.append_pair("key", &self.api_key);
            query.append_pair("admin_query", "true");
            for (index, workshop_id) in workshop_ids.iter().enumerate() {
                query.append_pair(
                    &format!("publishedfileids[{index}]"),
                    &workshop_id.to_string(),
                );
            }
        }
        let parsed: Vec<_> = self
            .get_json(url)
            .await?
            .publishedfiledetails
            .into_iter()
            .map(parse_item)
            .collect();
        let by_id: HashMap<_, _> = parsed
            .into_iter()
            .map(|item| (item.workshop_id, item))
            .collect();
        Ok(workshop_ids
            .iter()
            .map(|workshop_id| {
                by_id
                    .get(workshop_id)
                    .cloned()
                    .unwrap_or_else(|| missing_item(*workshop_id))
            })
            .collect())
    }

    async fn list_items(&self, cursor: &str, limit: u32) -> Result<WorkshopCatalogPage> {
        ensure!(limit > 0, "Workshop page limit must be positive");
        let mut url = self.url("/IPublishedFileService/QueryFiles/v1/")?;
        url.query_pairs_mut()
            .append_pair("key", &self.api_key)
            .append_pair("query_type", "1")
            .append_pair("cursor", cursor)
            .append_pair("numperpage", &limit.to_string())
            .append_pair("creator_appid", &self.app_id)
            .append_pair("appid", &self.app_id)
            .append_pair("return_metadata", "true")
            .append_pair("admin_query", "true");
        let response = self.get_json(url).await?;
        Ok(WorkshopCatalogPage {
            items: response
                .publishedfiledetails
                .into_iter()
                .map(parse_item)
                .collect(),
            next_cursor: response.next_cursor.filter(|next| next != cursor),
        })
    }

    async fn list_user_item_ids(
        &self,
        uploader_id: u64,
        page: u32,
        limit: u32,
    ) -> Result<WorkshopUserItemPage> {
        ensure!(
            page > 0 && limit > 0,
            "Workshop page and limit must be positive"
        );
        let mut url = self.url("/IPublishedFileService/GetUserFiles/v1/")?;
        url.query_pairs_mut()
            .append_pair("key", &self.api_key)
            .append_pair("steamid", &uploader_id.to_string())
            .append_pair("appid", &self.app_id)
            .append_pair("creator_appid", &self.app_id)
            .append_pair("page", &page.to_string())
            .append_pair("numperpage", &limit.to_string())
            .append_pair("type", "myfiles")
            .append_pair("admin_query", "true");
        let response = self.get_json(url).await?;
        let workshop_ids: Vec<u64> = response
            .publishedfiledetails
            .iter()
            .filter_map(|item| item.publishedfileid.as_deref()?.parse().ok())
            .collect();
        let start = response
            .startindex
            .unwrap_or(u64::from(page.saturating_sub(1)) * u64::from(limit) + 1);
        let has_next = response
            .total
            .map_or(workshop_ids.len() == limit as usize, |total| {
                start.saturating_sub(1) + (workshop_ids.len() as u64) < total
            });
        Ok(WorkshopUserItemPage {
            workshop_ids,
            next_page: has_next.then_some(page + 1),
        })
    }
}

fn parse_item(item: SteamPublishedFile) -> WorkshopItemMetadata {
    let workshop_id = item
        .publishedfileid
        .as_deref()
        .and_then(|value| value.parse().ok())
        .unwrap_or(0);
    let available = item.result == 1 && !item.banned;
    WorkshopItemMetadata {
        available,
        created_at: timestamp(item.time_created),
        creator_id: item
            .creator
            .as_deref()
            .and_then(|value| value.parse().ok())
            .unwrap_or(0),
        file_size: json_u64(item.file_size.as_ref()),
        image_url: item.preview_url.unwrap_or_default(),
        name: item.title.unwrap_or_default(),
        permanent_failure: (!available).then(|| {
            if item.banned {
                "banned".to_owned()
            } else {
                format!("steam-result-{}", item.result)
            }
        }),
        updated_at: timestamp(item.time_updated),
        visibility: item.visibility,
        workshop_id,
    }
}

fn missing_item(workshop_id: u64) -> WorkshopItemMetadata {
    WorkshopItemMetadata {
        available: false,
        created_at: "1970-01-01T00:00:00.000Z".to_owned(),
        creator_id: 0,
        file_size: 0,
        image_url: String::new(),
        name: String::new(),
        permanent_failure: Some("missing".to_owned()),
        updated_at: "1970-01-01T00:00:00.000Z".to_owned(),
        visibility: zc_core::steam::STEAM_VISIBILITY_PUBLIC,
        workshop_id,
    }
}

fn json_u64(value: Option<&serde_json::Value>) -> u64 {
    value
        .and_then(|value| value.as_u64().or_else(|| value.as_str()?.parse().ok()))
        .unwrap_or(0)
}

fn timestamp(seconds: i64) -> String {
    jiff::Timestamp::new(seconds, 0)
        .map(|timestamp| format!("{timestamp:.3}"))
        .unwrap_or_else(|_| "1970-01-01T00:00:00.000Z".to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_visibility_sizes_and_failures() {
        let item = parse_item(SteamPublishedFile {
            banned: true,
            creator: Some("76561198041027402".into()),
            file_size: Some(serde_json::json!("12345")),
            preview_url: None,
            publishedfileid: Some("3507841441".into()),
            result: 1,
            time_created: 0,
            time_updated: 0,
            title: Some("Hidden Level".into()),
            visibility: zc_core::steam::STEAM_VISIBILITY_FRIENDS_ONLY,
        });
        assert!(!item.available);
        assert_eq!(item.file_size, 12_345);
        assert_eq!(item.permanent_failure.as_deref(), Some("banned"));
        assert_eq!(item.created_at, "1970-01-01T00:00:00.000Z");
    }
}
