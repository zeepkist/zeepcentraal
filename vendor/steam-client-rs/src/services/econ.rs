//! Steam Economy features.
//!
//! This module provides access to Steam's economy system including:
//! - Trade URL management
//! - Asset class information lookup
//! - Emoticon lists
//! - Profile item management (backgrounds, avatar frames, etc.)

use std::collections::HashMap;

use steamid::SteamID;

use crate::{error::SteamError, SteamClient};

/// Asset class information for an item.
#[derive(Debug, Clone)]
pub struct AssetClassInfo {
    /// App ID
    pub appid: i32,
    /// Class ID
    pub classid: u64,
    /// Instance ID
    pub instanceid: u64,
    /// Display name
    pub name: String,
    /// Market hash name for trading
    pub market_hash_name: Option<String>,
    /// Market display name
    pub market_name: Option<String>,
    /// Name color (hex)
    pub name_color: Option<String>,
    /// Background color (hex)
    pub background_color: Option<String>,
    /// Item type description
    pub item_type: Option<String>,
    /// Icon URL (append to Steam CDN base URL)
    pub icon_url: Option<String>,
    /// Large icon URL
    pub icon_url_large: Option<String>,
    /// Is item tradable
    pub tradable: bool,
    /// Is item marketable
    pub marketable: bool,
    /// Is item a commodity (stackable on market)
    pub commodity: bool,
}

/// A class to look up asset info for.
#[derive(Debug, Clone)]
pub struct AssetClass {
    /// Class ID of the asset
    pub classid: u64,
    /// Instance ID (optional, defaults to 0)
    pub instanceid: Option<u64>,
}

/// Trade URL information.
#[derive(Debug, Clone)]
pub struct TradeUrl {
    /// The trade offer access token
    pub token: String,
    /// Full trade URL
    pub url: String,
}

/// Emoticon information.
#[derive(Debug, Clone)]
pub struct Emoticon {
    /// Emoticon name (e.g., "steamhappy")
    pub name: String,
    /// Number of times used
    pub use_count: u32,
    /// Timestamp last used
    pub time_last_used: Option<u32>,
    /// Timestamp received
    pub time_received: Option<u32>,
    /// App ID that granted this emoticon
    pub appid: Option<u32>,
}

/// Profile item information.
#[derive(Debug, Clone)]
pub struct ProfileItem {
    /// Community item ID
    pub communityitemid: u64,
    /// Large image URL
    pub image_large: Option<String>,
    /// Small image URL
    pub image_small: Option<String>,
    /// Item name
    pub name: Option<String>,
    /// Item title
    pub item_title: Option<String>,
    /// Item description
    pub item_description: Option<String>,
    /// App ID that granted this item
    pub appid: Option<u32>,
    /// Item type
    pub item_type: Option<u32>,
    /// Item class
    pub item_class: Option<u32>,
    /// Movie WebM URL
    pub movie_webm: Option<String>,
    /// Movie MP4 URL
    pub movie_mp4: Option<String>,
}

/// Owned profile items organized by category.
#[derive(Debug, Clone, Default)]
pub struct OwnedProfileItems {
    /// Profile backgrounds
    pub profile_backgrounds: Vec<ProfileItem>,
    /// Mini profile backgrounds
    pub mini_profile_backgrounds: Vec<ProfileItem>,
    /// Avatar frames
    pub avatar_frames: Vec<ProfileItem>,
    /// Animated avatars
    pub animated_avatars: Vec<ProfileItem>,
    /// Profile modifiers
    pub profile_modifiers: Vec<ProfileItem>,
}

/// Equipped profile items.
#[derive(Debug, Clone, Default)]
pub struct EquippedProfileItems {
    /// Profile background
    pub profile_background: Option<ProfileItem>,
    /// Mini profile background
    pub mini_profile_background: Option<ProfileItem>,
    /// Avatar frame
    pub avatar_frame: Option<ProfileItem>,
    /// Animated avatar
    pub animated_avatar: Option<ProfileItem>,
    /// Profile modifier
    pub profile_modifier: Option<ProfileItem>,
}

const STEAM_CDN_BASE: &str = "https://steamcdn-a.akamaihd.net/steamcommunity/public/images/";

impl SteamClient {
    /// Get asset class information for items in a specific app.
    ///
    /// This fetches detailed information about items based on their class IDs.
    ///
    /// # Arguments
    ///
    /// * `language` - Language code for descriptions (e.g., "english",
    ///   "german")
    /// * `appid` - App ID the items belong to
    /// * `classes` - List of asset classes to look up
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// let classes = vec![
    ///     AssetClass { classid: 123456789, instanceid: None },
    ///     AssetClass { classid: 987654321, instanceid: Some(0) },
    /// ];
    /// let info = client.get_asset_class_info("english", 730, classes).await?;
    /// for (classid, item) in info {
    ///     tracing::info!("{}: {}", classid, item.name);
    /// }
    /// ```
    pub async fn get_asset_class_info(&mut self, language: &str, appid: u32, classes: Vec<AssetClass>) -> Result<HashMap<u64, AssetClassInfo>, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let request_classes: Vec<_> = classes.iter().map(|c| steam_protos::c_econ_get_asset_class_info_request::Class { classid: Some(c.classid), instanceid: c.instanceid }).collect();

        let request = steam_protos::CEconGetAssetClassInfoRequest { language: Some(language.to_string()), appid: Some(appid), classes: request_classes };

        let response: steam_protos::CEconGetAssetClassInfoResponse = self.send_unified_request_and_wait("Econ.GetAssetClassInfo#1", &request).await?;

        let mut result = HashMap::new();
        for description in response.descriptions {
            if let Some(classid) = description.classid {
                result.insert(
                    classid,
                    AssetClassInfo {
                        appid: description.appid.unwrap_or(0),
                        classid,
                        instanceid: description.instanceid.unwrap_or(0),
                        name: description.name.unwrap_or_default(),
                        market_hash_name: description.market_hash_name,
                        market_name: description.market_name,
                        name_color: description.name_color,
                        background_color: description.background_color,
                        item_type: description.r#type,
                        icon_url: description.icon_url.map(|s| format!("{}{}", STEAM_CDN_BASE, s)),
                        icon_url_large: description.icon_url_large.map(|s| format!("{}{}", STEAM_CDN_BASE, s)),
                        tradable: description.tradable.unwrap_or(false),
                        marketable: description.marketable.unwrap_or(false),
                        commodity: description.commodity.unwrap_or(false),
                    },
                );
            }
        }

        Ok(result)
    }

    /// Get your account's trade URL.
    ///
    /// The trade URL can be shared with others to initiate trade offers.
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// let trade_url = client.get_trade_url().await?;
    /// tracing::info!("Trade URL: {}", trade_url.url);
    /// tracing::info!("Token: {}", trade_url.token);
    /// ```
    pub async fn get_trade_url(&mut self) -> Result<TradeUrl, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let request = steam_protos::CEconGetTradeOfferAccessTokenRequest { generate_new_token: Some(false) };

        // Send and wait for response
        let response: steam_protos::CEconGetTradeOfferAccessTokenResponse = self.send_unified_request_and_wait("Econ.GetTradeOfferAccessToken#1", &request).await?;

        let token = response.trade_offer_access_token.unwrap_or_default();
        let account_id = self.steam_id.map(|id| id.account_id).unwrap_or(0);

        Ok(TradeUrl {
            token: token.clone(),
            url: format!("https://steamcommunity.com/tradeoffer/new/?partner={}&token={}", account_id, token),
        })
    }

    /// Generate a new trade URL for your account.
    ///
    /// This invalidates the old trade URL and creates a new one.
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// let new_url = client.change_trade_url().await?;
    /// tracing::info!("New trade URL: {}", new_url.url);
    /// ```
    pub async fn change_trade_url(&mut self) -> Result<TradeUrl, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let request = steam_protos::CEconGetTradeOfferAccessTokenRequest { generate_new_token: Some(true) };

        // Send and wait for response
        let response: steam_protos::CEconGetTradeOfferAccessTokenResponse = self.send_unified_request_and_wait("Econ.GetTradeOfferAccessToken#1", &request).await?;

        let token = response.trade_offer_access_token.unwrap_or_default();
        let account_id = self.steam_id.map(|id| id.account_id).unwrap_or(0);

        Ok(TradeUrl {
            token: token.clone(),
            url: format!("https://steamcommunity.com/tradeoffer/new/?partner={}&token={}", account_id, token),
        })
    }

    /// Get the list of emoticons your account can use.
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// let emoticons = client.get_emoticon_list().await?;
    /// for (name, emoticon) in emoticons {
    ///     tracing::info!(":{}: - used {} times", name, emoticon.use_count);
    /// }
    /// ```
    pub async fn get_emoticon_list(&mut self) -> Result<HashMap<String, Emoticon>, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let request = steam_protos::CPlayerGetEmoticonListRequest {};

        // Send and wait for response
        let response: steam_protos::CPlayerGetEmoticonListResponse = self.send_unified_request_and_wait("Player.GetEmoticonList#1", &request).await?;

        let mut emoticons = HashMap::new();
        for emoticon in response.emoticons {
            if let Some(name) = emoticon.name {
                let name_clone = name.clone();
                emoticons.insert(
                    name_clone.clone(),
                    Emoticon {
                        name: name_clone,
                        use_count: emoticon.use_count.unwrap_or(0),
                        time_last_used: emoticon.time_last_used,
                        time_received: emoticon.time_received,
                        appid: emoticon.appid,
                    },
                );
            }
        }

        Ok(emoticons)
    }

    /// Get a listing of profile items you own.
    ///
    /// This returns all profile customization items you own, organized by
    /// category.
    ///
    /// # Arguments
    ///
    /// * `language` - Language code for item descriptions (defaults to
    ///   "english")
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// let items = client.get_owned_profile_items(Some("english")).await?;
    /// tracing::info!("You own {} profile backgrounds", items.profile_backgrounds.len());
    /// tracing::info!("You own {} avatar frames", items.avatar_frames.len());
    /// ```
    pub async fn get_owned_profile_items(&mut self, language: Option<&str>) -> Result<OwnedProfileItems, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let request = steam_protos::CPlayerGetProfileItemsOwnedRequest { language: Some(language.unwrap_or("english").to_string()) };

        // Send and wait for response
        let response: steam_protos::CPlayerGetProfileItemsOwnedResponse = self.send_unified_request_and_wait("Player.GetProfileItemsOwned#1", &request).await?;

        Ok(OwnedProfileItems {
            profile_backgrounds: response.profile_backgrounds.iter().filter_map(process_profile_item).collect(),
            mini_profile_backgrounds: response.mini_profile_backgrounds.iter().filter_map(process_profile_item).collect(),
            avatar_frames: response.avatar_frames.iter().filter_map(process_profile_item).collect(),
            animated_avatars: response.animated_avatars.iter().filter_map(process_profile_item).collect(),
            profile_modifiers: response.profile_modifiers.iter().filter_map(process_profile_item).collect(),
        })
    }

    /// Get a user's equipped profile items.
    ///
    /// This returns the profile customization items currently equipped by a
    /// user.
    ///
    /// # Arguments
    ///
    /// * `steam_id` - The Steam ID of the user to look up
    /// * `language` - Language code for item descriptions (defaults to
    ///   "english")
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// let items = client.get_equipped_profile_items(friend_id, Some("english")).await?;
    /// if let Some(bg) = items.profile_background {
    ///     tracing::info!("Profile background: {}", bg.name.unwrap_or_default());
    /// }
    /// ```
    pub async fn get_equipped_profile_items(&mut self, steam_id: SteamID, language: Option<&str>) -> Result<EquippedProfileItems, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let request = steam_protos::CPlayerGetProfileItemsEquippedRequest { steamid: Some(steam_id.steam_id64()), language: Some(language.unwrap_or("english").to_string()) };

        // Send and wait for response
        let response: steam_protos::CPlayerGetProfileItemsEquippedResponse = self.send_unified_request_and_wait("Player.GetProfileItemsEquipped#1", &request).await?;

        Ok(EquippedProfileItems {
            profile_background: response.profile_background.as_ref().and_then(process_profile_item),
            mini_profile_background: response.mini_profile_background.as_ref().and_then(process_profile_item),
            avatar_frame: response.avatar_frame.as_ref().and_then(process_profile_item),
            animated_avatar: response.animated_avatar.as_ref().and_then(process_profile_item),
            profile_modifier: response.profile_modifier.as_ref().and_then(process_profile_item),
        })
    }

    /// Set your current profile background.
    ///
    /// # Arguments
    ///
    /// * `background_asset_id` - The community item ID of the background to set
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// // Get owned items first
    /// let items = client.get_owned_profile_items(None).await?;
    /// if let Some(bg) = items.profile_backgrounds.first() {
    ///     client.set_profile_background(bg.communityitemid).await?;
    /// }
    /// ```
    pub async fn set_profile_background(&mut self, background_asset_id: u64) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let request = steam_protos::CPlayerSetProfileBackgroundRequest { communityitemid: Some(background_asset_id) };

        self.send_service_method("Player.SetProfileBackground#1", &request).await
    }
}

/// Helper to process profile item URLs by prepending the Steam CDN base.
///
/// This function will be used when job-based response handling is implemented
/// to convert protobuf profile items to the public ProfileItem type.
fn process_profile_item(item: &steam_protos::CPlayerProfileItem) -> Option<ProfileItem> {
    // Check if item has any data
    item.communityitemid?;

    Some(ProfileItem {
        communityitemid: item.communityitemid.unwrap_or(0),
        image_large: item.image_large.as_ref().map(|s| format!("{}{}", STEAM_CDN_BASE, s)),
        image_small: item.image_small.as_ref().map(|s| format!("{}{}", STEAM_CDN_BASE, s)),
        name: item.name.clone(),
        item_title: item.item_title.clone(),
        item_description: item.item_description.clone(),
        appid: item.appid,
        item_type: item.item_type,
        item_class: item.item_class,
        movie_webm: item.movie_webm.as_ref().map(|s| format!("{}{}", STEAM_CDN_BASE, s)),
        movie_mp4: item.movie_mp4.as_ref().map(|s| format!("{}{}", STEAM_CDN_BASE, s)),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_trade_url_format() {
        let url = TradeUrl {
            token: "abc123".to_string(),
            url: "https://steamcommunity.com/tradeoffer/new/?partner=12345&token=abc123".to_string(),
        };
        assert!(url.url.contains("partner=12345"));
        assert!(url.url.contains("token=abc123"));
    }
}
