//! Store service functionality.
//!
//! This module handles interactions with the Steam Store, such as retrieving
//! tag information and store item details.

use crate::{error::SteamError, SteamClient};

/// Store tag information.
#[derive(Debug, Clone)]
pub struct StoreTag {
    /// The tag ID.
    pub tagid: u32,
    /// English name of the tag.
    pub english_name: Option<String>,
    /// Localized name of the tag.
    pub name: Option<String>,
    /// Normalized name.
    pub normalized_name: Option<String>,
}

impl SteamClient {
    /// Get localized names for store tags.
    ///
    /// # Arguments
    /// * `language` - The language to get names for (e.g., "english").
    /// * `tag_ids` - The tag IDs to request.
    ///
    /// # Returns
    ///
    /// Returns a list of store tags with localized names.
    pub async fn get_store_tag_names(&mut self, language: &str, tag_ids: &[u32]) -> Result<Vec<StoreTag>, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let request = steam_protos::CStoreGetLocalizedNameForTagsRequest { language: Some(language.to_string()), tagids: tag_ids.to_vec() };

        let response: steam_protos::CStoreGetLocalizedNameForTagsResponse = self.send_unified_request_and_wait("Store.GetLocalizedNameForTags#1", &request).await?;

        let mut tags = Vec::new();
        for tag in response.tags {
            tags.push(StoreTag {
                tagid: tag.tagid.unwrap_or(0),
                english_name: tag.english_name,
                name: tag.name,
                normalized_name: tag.normalized_name,
            });
        }

        Ok(tags)
    }
}
