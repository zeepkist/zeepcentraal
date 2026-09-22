//! Steam Gift redemption features.
//!
//! This module provides functionality for redeeming gifts from the Steam
//! inventory:
//! - Get gift details (validate before redeeming)
//! - Redeem a gift to your library

use serde::Deserialize;

use crate::{error::SteamError, SteamClient};

/// Gift details from validation.
#[derive(Debug, Clone)]
pub struct GiftDetails {
    /// Name of the gift/game
    pub gift_name: String,
    /// Package ID
    pub package_id: u32,
    /// Whether the gift is already owned
    pub owned: bool,
}

/// Internal response structure for gift validation.
#[derive(Debug, Deserialize)]
struct GiftValidateResponse {
    success: Option<i32>,
    gift_name: Option<String>,
    #[serde(deserialize_with = "deserialize_id")]
    packageid: Option<String>,
    owned: Option<bool>,
    message: Option<String>,
}

/// Helper to deserialize fields that could be strings or numbers.
fn deserialize_id<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::Deserialize;
    let v: serde_json::Value = Deserialize::deserialize(deserializer)?;
    match v {
        serde_json::Value::String(s) => Ok(Some(s)),
        serde_json::Value::Number(n) => Ok(Some(n.to_string())),
        serde_json::Value::Null => Ok(None),
        _ => Err(serde::de::Error::custom("expected string or number")),
    }
}

/// Internal response structure for gift redemption.
#[derive(Debug, Deserialize)]
struct GiftRedeemResponse {
    success: Option<i32>,
    message: Option<String>,
}

/// Extract session ID from cookies string.
///
/// The sessionid is typically stored as `sessionid=<value>` in the cookie
/// string.
fn extract_session_id(cookies: &str) -> Option<String> {
    for part in cookies.split(';') {
        let part = part.trim();
        if let Some(value) = part.strip_prefix("sessionid=") {
            return Some(value.to_string());
        }
    }
    None
}

impl SteamClient {
    /// Get details about a gift in your inventory.
    ///
    /// This validates the gift and returns information about it before
    /// redemption.
    ///
    /// # Arguments
    ///
    /// * `gift_id` - The gift ID from the inventory
    /// * `cookies` - Web session cookies (e.g.,
    ///   "sessionid=xxx;steamLoginSecure=yyy")
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// let details = client.get_gift_details("1234567890", &cookies).await?;
    /// tracing::info!("Gift: {} (Package {})", details.gift_name, details.package_id);
    /// if details.owned {
    ///     tracing::info!("Warning: You already own this game!");
    /// }
    /// ```
    pub async fn get_gift_details(&self, gift_id: &str, cookies: &str) -> Result<GiftDetails, SteamError> {
        let session_id = extract_session_id(cookies).ok_or_else(|| SteamError::Other("No sessionid found in cookies".to_string()))?;

        let url = format!("https://steamcommunity.com/gifts/{}/validateunpack", gift_id);

        let response = self.http_client.post_form_with_cookies(&url, &[("sessionid", session_id.as_str())], cookies).await?;

        if !response.is_success() {
            return Err(SteamError::Other(format!("HTTP error: {}", response.status)));
        }

        let body: GiftValidateResponse = response.json().map_err(|e| SteamError::ProtocolError(format!("Failed to parse response: {}", e)))?;

        // Check success (1 = OK in Steam's EResult)
        if body.success != Some(1) {
            return Err(SteamError::Other(body.message.unwrap_or_else(|| "Unknown error validating gift".to_string())));
        }

        let gift_name = body.gift_name.ok_or_else(|| SteamError::ProtocolError("Missing gift_name in response".to_string()))?;
        let package_id: u32 = body.packageid.ok_or_else(|| SteamError::ProtocolError("Missing packageid in response".to_string()))?.parse().map_err(|_| SteamError::ProtocolError("Invalid packageid".to_string()))?;

        Ok(GiftDetails { gift_name, package_id, owned: body.owned.unwrap_or(false) })
    }

    /// Redeem a gift from your inventory to your library.
    ///
    /// This unpacks the gift and adds the game to your Steam library.
    ///
    /// # Arguments
    ///
    /// * `gift_id` - The gift ID from the inventory
    /// * `cookies` - Web session cookies (e.g.,
    ///   "sessionid=xxx;steamLoginSecure=yyy")
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// // First validate the gift
    /// let details = client.get_gift_details("1234567890", &cookies).await?;
    /// if !details.owned {
    ///     client.redeem_gift("1234567890", &cookies).await?;
    ///     tracing::info!("Redeemed: {}", details.gift_name);
    /// }
    /// ```
    pub async fn redeem_gift(&self, gift_id: &str, cookies: &str) -> Result<(), SteamError> {
        let session_id = extract_session_id(cookies).ok_or_else(|| SteamError::Other("No sessionid found in cookies".to_string()))?;

        let url = format!("https://steamcommunity.com/gifts/{}/unpack", gift_id);

        let response = self.http_client.post_form_with_cookies(&url, &[("sessionid", session_id.as_str())], cookies).await?;

        if !response.is_success() {
            return Err(SteamError::Other(format!("HTTP error: {}", response.status)));
        }

        let body: GiftRedeemResponse = response.json().map_err(|e| SteamError::ProtocolError(format!("Failed to parse response: {}", e)))?;

        // Check success (1 = OK in Steam's EResult)
        if body.success != Some(1) {
            return Err(SteamError::Other(body.message.unwrap_or_else(|| "Unknown error redeeming gift".to_string())));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_session_id() {
        let cookies = "sessionid=abc123; steamLoginSecure=xyz789";
        assert_eq!(extract_session_id(cookies), Some("abc123".to_string()));

        let cookies_no_session = "steamLoginSecure=xyz789";
        assert_eq!(extract_session_id(cookies_no_session), None);

        let cookies_with_spaces = " sessionid=def456 ; other=value";
        assert_eq!(extract_session_id(cookies_with_spaces), Some("def456".to_string()));
    }

    #[test]
    fn test_gift_details_struct() {
        let details = GiftDetails { gift_name: "Test Game".to_string(), package_id: 12345, owned: false };
        assert_eq!(details.gift_name, "Test Game");
        assert_eq!(details.package_id, 12345);
        assert!(!details.owned);
    }
}
