//! Workshop/UGC published files for Steam client.
//!
//! This module provides functionality for getting details about
//! Workshop items and other user-generated content.

use std::collections::HashMap;

use steamid::SteamID;

use crate::{error::SteamError, SteamClient};

/// Published file (Workshop item) details.
#[derive(Debug, Clone)]
pub struct PublishedFileDetails {
    /// The published file ID.
    pub publishedfileid: u64,
    /// Creator's SteamID.
    pub creator: Option<SteamID>,
    /// App ID this file is for.
    pub consumer_appid: u32,
    /// App ID where this was published from.
    pub creator_appid: u32,
    /// Title of the file.
    pub title: String,
    /// Description.
    pub description: String,
    /// File name.
    pub filename: String,
    /// File size in bytes.
    pub file_size: u64,
    /// Preview URL.
    pub preview_url: Option<String>,
    /// Time created (Unix timestamp).
    pub time_created: u32,
    /// Time updated (Unix timestamp).
    pub time_updated: u32,
    /// Visibility status.
    pub visibility: u32,
    /// Whether the file is banned.
    pub banned: bool,
    /// Ban reason if banned.
    pub ban_reason: Option<String>,
    /// Number of subscriptions.
    pub subscriptions: u64,
    /// Number of favorites.
    pub favorited: u64,
    /// Number of lifetime subscriptions.
    pub lifetime_subscriptions: u64,
    /// Number of lifetime favorites.
    pub lifetime_favorited: u64,
    /// Number of views.
    pub views: u64,
    /// Tags associated with the file.
    pub tags: Vec<String>,
    /// Key-value tags.
    pub kvtags: HashMap<String, String>,
    /// Vote data.
    pub vote_data: Option<VoteData>,
}

/// Vote data for a published file.
#[derive(Debug, Clone)]
pub struct VoteData {
    /// Score (0.0 to 1.0).
    pub score: f32,
    /// Number of votes up.
    pub votes_up: u32,
    /// Number of votes down.
    pub votes_down: u32,
}

impl SteamClient {
    /// Get details for Workshop/UGC files.
    ///
    /// # Arguments
    /// * `ids` - List of published file IDs to get details for
    ///
    /// # Returns
    /// A map of file ID to file details.
    pub async fn get_published_file_details(&mut self, ids: Vec<u64>) -> Result<HashMap<u64, PublishedFileDetails>, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CPublishedFileGetDetailsRequest {
            publishedfileids: ids,
            includetags: Some(true),
            includeadditionalpreviews: Some(true),
            includechildren: Some(true),
            includekvtags: Some(true),
            includevotes: Some(true),
            includeforsaledata: Some(true),
            includemetadata: Some(true),
            language: Some(0),
            ..Default::default()
        };

        let response: steam_protos::CPublishedFileGetDetailsResponse = self.send_service_method_and_wait("PublishedFile.GetDetails#1", &msg).await?;

        let mut results = HashMap::new();

        for item in response.publishedfiledetails {
            let publishedfileid = match item.publishedfileid {
                Some(id) => id,
                None => continue,
            };

            let creator = match item.creator {
                Some(id) if id > 0 => Some(SteamID::from(id)),
                _ => None,
            };

            let mut kvtags = HashMap::new();
            for tag in item.kvtags {
                if let (Some(k), Some(v)) = (tag.key, tag.value) {
                    kvtags.insert(k, v);
                }
            }

            let tags = item.tags.into_iter().filter_map(|t| t.tag).collect();

            let vote_data = item.vote_data.map(|v| VoteData { score: v.score.unwrap_or(0.0), votes_up: v.votes_up.unwrap_or(0), votes_down: v.votes_down.unwrap_or(0) });

            results.insert(
                publishedfileid,
                PublishedFileDetails {
                    publishedfileid,
                    creator,
                    consumer_appid: item.consumer_appid.unwrap_or(0),
                    creator_appid: item.creator_appid.unwrap_or(0),
                    title: item.title.unwrap_or_default(),
                    description: item.file_description.unwrap_or_default(),
                    filename: item.filename.unwrap_or_default(),
                    file_size: item.file_size.unwrap_or(0),
                    preview_url: item.preview_url,
                    time_created: item.time_created.unwrap_or(0),
                    time_updated: item.time_updated.unwrap_or(0),
                    visibility: item.visibility.unwrap_or(0),
                    banned: item.banned.unwrap_or(false),
                    ban_reason: item.ban_reason,
                    subscriptions: item.subscriptions.map(|v| v as u64).unwrap_or(0),
                    favorited: item.favorited.map(|v| v as u64).unwrap_or(0),
                    lifetime_subscriptions: item.lifetime_subscriptions.map(|v| v as u64).unwrap_or(0),
                    lifetime_favorited: item.lifetime_favorited.map(|v| v as u64).unwrap_or(0),
                    views: item.views.map(|v| v as u64).unwrap_or(0),
                    tags,
                    kvtags,
                    vote_data,
                },
            );
        }

        Ok(results)
    }

    /// Get details for a single Workshop/UGC file.
    ///
    /// # Arguments
    /// * `id` - Published file ID to get details for
    pub async fn get_published_file_detail(&mut self, id: u64) -> Result<Option<PublishedFileDetails>, SteamError> {
        let results = self.get_published_file_details(vec![id]).await?;
        Ok(results.into_values().next())
    }
}
