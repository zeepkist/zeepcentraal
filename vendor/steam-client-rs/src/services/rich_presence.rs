//! Rich Presence functionality for Steam client.
//!
//! Rich Presence allows games to display custom status information
//! that other users can see when viewing a friend's profile or the
//! friends list.

use std::collections::HashMap;

use steam_enums::EMsg;
use steamid::SteamID;

use crate::{error::SteamError, SteamClient};

/// Rich Presence data for a user.
#[derive(Debug, Clone, Default)]
pub struct RichPresenceData {
    /// The SteamID of the user.
    pub steam_id: SteamID,
    /// The app ID the rich presence is for.
    pub appid: u32,
    /// Key-value pairs of rich presence data.
    pub data: HashMap<String, String>,
}

impl SteamClient {
    /// Upload rich presence data for an app.
    ///
    /// Rich presence is displayed to friends and on your profile.
    /// The data is a key-value map of strings.
    ///
    /// # Arguments
    /// * `appid` - The app ID to set rich presence for
    /// * `data` - Key-value pairs of rich presence data
    ///
    /// # Example
    /// ```rust,ignore
    /// use std::collections::HashMap;
    ///
    /// let mut presence = HashMap::new();
    /// presence.insert("status".to_string(), "In Main Menu".to_string());
    /// presence.insert("connect".to_string(), "+connect localhost:27015".to_string());
    ///
    /// client.upload_rich_presence(730, &presence).await?;
    /// ```
    pub async fn upload_rich_presence(&mut self, appid: u32, data: &HashMap<String, String>) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        // Encode rich presence as binary KeyValues
        let kv_bytes = encode_rich_presence_kv(data);

        // Record for session recovery
        self.session_recovery.record_rich_presence(appid, data.clone());

        let msg = steam_protos::CMsgClientRichPresenceUpload { rich_presence_kv: Some(kv_bytes), ..Default::default() };

        // Send with routing_appid in header
        self.send_message_with_routing(EMsg::ClientRichPresenceUpload, appid, &msg).await
    }

    /// Request rich presence data for users.
    ///
    /// # Arguments
    /// * `appid` - The app ID to get rich presence for
    /// * `steam_ids` - SteamIDs of users to request rich presence for
    ///
    /// # Example
    /// ```rust,ignore
    /// let steam_ids = vec![steam_id_1, steam_id_2];
    /// client.request_rich_presence(730, &steam_ids).await?;
    /// // Rich presence data will arrive as SteamEvent::RichPresence events
    /// ```
    pub async fn request_rich_presence(&mut self, appid: u32, steam_ids: &[SteamID]) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        if steam_ids.is_empty() {
            return Ok(());
        }

        let msg = steam_protos::CMsgClientRichPresenceRequest { steamid_request: steam_ids.iter().map(|sid| sid.steam_id64()).collect() };

        self.send_message_with_routing(EMsg::ClientRichPresenceRequest, appid, &msg).await
    }

    /// Get rich presence localization tokens for an app.
    ///
    /// # Arguments
    /// * `appid` - The app ID to get localizations for
    /// * `language` - The language to get localizations for (e.g., "english")
    pub async fn get_app_rich_presence_localization(&mut self, appid: i32, language: &str) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let request = steam_protos::CCommunityGetAppRichPresenceLocalizationRequest { appid: Some(appid), language: Some(language.to_string()) };

        self.send_service_method("Community.GetAppRichPresenceLocalization#1", &request).await
    }

    /// Clear rich presence for an app.
    ///
    /// This removes all rich presence data for the specified app.
    pub async fn clear_rich_presence(&mut self, appid: u32) -> Result<(), SteamError> {
        self.upload_rich_presence(appid, &HashMap::new()).await
    }
}

/// Encode rich presence data as binary KeyValues format.
///
/// Format:
/// - 0x00 byte (start)
/// - "RP\0" (null-terminated string)
/// - For each key-value:
///   - 0x01 (type: string)
///   - key\0 (null-terminated)
///   - value\0 (null-terminated)
/// - 0x08 (end)
/// - 0x08 (end again)
fn encode_rich_presence_kv(data: &HashMap<String, String>) -> Vec<u8> {
    let mut buf = Vec::with_capacity(1024);

    // Start marker
    buf.push(0x00);

    // "RP" section name (null-terminated)
    buf.extend_from_slice(b"RP\0");

    // Key-value pairs
    for (key, value) in data {
        buf.push(0x01); // type: string
        buf.extend_from_slice(key.as_bytes());
        buf.push(0x00); // null terminator
        buf.extend_from_slice(value.as_bytes());
        buf.push(0x00); // null terminator
    }

    // End markers
    buf.push(0x08);
    buf.push(0x08);

    buf
}

/// Parse binary KeyValues rich presence data.
pub fn parse_rich_presence_kv(data: &[u8]) -> HashMap<String, String> {
    let mut result = HashMap::new();

    if data.is_empty() {
        return result;
    }

    let mut i = 0;

    // Skip start marker
    if i < data.len() && data[i] == 0x00 {
        i += 1;
    }

    // Skip section name (e.g., "RP\0")
    while i < data.len() && data[i] != 0x00 {
        i += 1;
    }
    if i < data.len() {
        i += 1; // skip null terminator
    }

    // Parse key-value pairs
    while i < data.len() {
        let type_byte = data[i];
        i += 1;

        if type_byte == 0x08 {
            // End marker
            break;
        }

        if type_byte != 0x01 {
            // Not a string type, skip
            continue;
        }

        // Read key (null-terminated)
        let key_start = i;
        while i < data.len() && data[i] != 0x00 {
            i += 1;
        }
        let key = String::from_utf8_lossy(&data[key_start..i]).to_string();
        if i < data.len() {
            i += 1; // skip null
        }

        // Read value (null-terminated)
        let value_start = i;
        while i < data.len() && data[i] != 0x00 {
            i += 1;
        }
        let value = String::from_utf8_lossy(&data[value_start..i]).to_string();
        if i < data.len() {
            i += 1; // skip null
        }

        result.insert(key, value);
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_decode_rich_presence() {
        let mut data = HashMap::new();
        data.insert("status".to_string(), "In Menu".to_string());
        data.insert("connect".to_string(), "+connect 1.2.3.4:27015".to_string());

        let encoded = encode_rich_presence_kv(&data);
        let decoded = parse_rich_presence_kv(&encoded);

        assert_eq!(decoded.get("status"), Some(&"In Menu".to_string()));
        assert_eq!(decoded.get("connect"), Some(&"+connect 1.2.3.4:27015".to_string()));
    }

    #[test]
    fn test_empty_rich_presence() {
        let data = HashMap::new();
        let encoded = encode_rich_presence_kv(&data);
        let decoded = parse_rich_presence_kv(&encoded);

        assert!(decoded.is_empty());
    }
}
