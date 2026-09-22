//! Two-factor authentication (2FA) management.
//!
//! This module provides functionality to enable and finalize TOTP
//! two-factor authentication on Steam accounts.

use crate::{error::SteamError, SteamClient};

/// Two-factor authentication secrets returned when enabling 2FA.
#[derive(Debug, Clone)]
pub struct TwoFactorSecrets {
    /// The shared secret used to generate TOTP codes (base64 encoded).
    pub shared_secret: String,
    /// The identity secret used for trade confirmations (base64 encoded).
    pub identity_secret: String,
    /// Secret 1 (base64 encoded).
    pub secret_1: String,
    /// The revocation code to disable 2FA.
    pub revocation_code: String,
    /// Serial number of the authenticator.
    pub serial_number: u64,
    /// URI for adding to authenticator apps.
    pub uri: Option<String>,
    /// Steam server time when 2FA was enabled.
    pub server_time: u64,
    /// Account name.
    pub account_name: Option<String>,
    /// Phone number hint (last digits).
    pub phone_number_hint: Option<String>,
    /// Status code from Steam.
    pub status: i32,
}

impl SteamClient {
    /// Enable TOTP two-factor authentication on this account.
    ///
    /// This begins the 2FA setup process. Steam will send an SMS with
    /// an activation code that must be passed to [`finalize_two_factor`].
    ///
    /// # Returns
    ///
    /// Returns [`TwoFactorSecrets`] containing the shared secret and other
    /// data needed to generate TOTP codes. **Save these securely!**
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// let secrets = client.enable_two_factor().await?;
    /// tracing::info!("Shared secret: {}", secrets.shared_secret);
    /// tracing::info!("Revocation code: {}", secrets.revocation_code);
    /// // Wait for SMS, then call finalize_two_factor
    /// ```
    pub async fn enable_two_factor(&mut self) -> Result<TwoFactorSecrets, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let steam_id = self.steam_id.as_ref().ok_or(SteamError::NotLoggedOn)?.steam_id64();

        // Generate device identifier (similar to steam-totp getDeviceID)
        let device_id = format!("android:{}", uuid::Uuid::new_v4());

        let request = steam_protos::CTwoFactorAddAuthenticatorRequest {
            steamid: Some(steam_id),
            authenticator_type: Some(1), // TOTP
            device_identifier: Some(device_id),
            sms_phone_id: Some("1".to_string()),
            version: Some(2),
            http_headers: vec![],
            ..Default::default()
        };

        // Send unified message - this would need the unified message infrastructure
        // For now, we'll use the service method pattern
        let response: steam_protos::CTwoFactorAddAuthenticatorResponse = self.send_unified_message("TwoFactor.AddAuthenticator#1", &request).await?;

        use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};

        Ok(TwoFactorSecrets {
            shared_secret: BASE64_STANDARD.encode(response.shared_secret.ok_or_else(|| SteamError::Other("Missing shared_secret".into()))?),
            identity_secret: BASE64_STANDARD.encode(response.identity_secret.ok_or_else(|| SteamError::Other("Missing identity_secret".into()))?),
            secret_1: BASE64_STANDARD.encode(response.secret_1.ok_or_else(|| SteamError::Other("Missing secret_1".into()))?),
            revocation_code: response.revocation_code.ok_or_else(|| SteamError::Other("Missing revocation_code".into()))?,
            serial_number: response.serial_number.unwrap_or_default(),
            uri: response.uri,
            server_time: response.server_time.unwrap_or_default(),
            account_name: response.account_name,
            phone_number_hint: response.phone_number_hint,
            status: response.status.unwrap_or_default(),
        })
    }

    /// Finalize the two-factor authentication setup.
    ///
    /// After calling [`enable_two_factor`], Steam sends an SMS with an
    /// activation code. Call this method with that code to complete the 2FA
    /// setup.
    ///
    /// # Arguments
    ///
    /// * `shared_secret` - The shared secret returned from
    ///   [`enable_two_factor`]
    /// * `activation_code` - The SMS activation code from Steam
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// // After receiving SMS code
    /// client.finalize_two_factor(&secrets.shared_secret, "ABC123").await?;
    /// tracing::info!("2FA enabled successfully!");
    /// ```
    pub async fn finalize_two_factor(&mut self, shared_secret: &str, activation_code: &str) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let steam_id = self.steam_id.as_ref().ok_or(SteamError::NotLoggedOn)?.steam_id64();

        let mut diff: i64 = 0;
        let mut attempts_left = 30;

        loop {
            // Get current time
            let current_time = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|e| SteamError::Other(e.to_string()))?.as_secs();

            // Generate TOTP code from shared secret with time offset
            let time_for_code = (current_time as i64) + diff;
            let auth_code = generate_totp_code(shared_secret, time_for_code)?;

            let request = steam_protos::CTwoFactorFinalizeAddAuthenticatorRequest {
                steamid: Some(steam_id),
                authenticator_code: Some(auth_code),
                authenticator_time: Some(current_time),
                activation_code: Some(activation_code.to_string()),
                http_headers: vec![],
                validate_sms_code: None,
            };

            let response: steam_protos::CTwoFactorFinalizeAddAuthenticatorResponse = self.send_unified_message("TwoFactor.FinalizeAddAuthenticator#1", &request).await?;

            if let Some(server_time) = response.server_time {
                diff = (server_time as i64) - (current_time as i64);
            }

            if response.status == Some(89) {
                return Err(SteamError::Other("Invalid activation code".into()));
            }

            if response.success == Some(true) {
                return Ok(());
            }

            if response.want_more == Some(true) {
                attempts_left -= 1;
                diff += 30;

                if attempts_left <= 0 {
                    return Err(SteamError::Other("Failed to finalize adding authenticator after 30 attempts".into()));
                }
                continue;
            }

            return Err(SteamError::Other(format!("Error {}", response.status.unwrap_or(0))));
        }
    }

    /// Send a unified service message (internal helper).
    #[allow(dead_code)]
    async fn send_unified_message<Req: prost::Message, Res: prost::Message + Default>(&mut self, method: &str, body: &Req) -> Result<Res, SteamError> {
        // Unified messages use a special job-based format
        // For now, return not implemented
        tracing::debug!("Would send unified message: {}", method);
        let _ = body.encode_to_vec();
        Err(SteamError::NotImplemented(format!("Unified message {} not yet implemented", method)))
    }
}

/// Generate a TOTP code from a shared secret.
///
/// This uses the `steam-totp` crate for proper Steam TOTP generation.
fn generate_totp_code(shared_secret: &str, time: i64) -> Result<String, SteamError> {
    let secret = steam_totp::Secret::from_string(shared_secret).map_err(|e| SteamError::Other(format!("Invalid shared secret: {}", e)))?;
    steam_totp::generate_auth_code_for_time(&secret, time).map_err(|e| SteamError::Other(format!("TOTP generation failed: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_totp_generation() {
        // Test with a known secret (this is just a test, not a real secret)
        let secret = "SGVsbG9Xb3JsZDEyMzQ1Njc4OTA="; // Base64 encoded test data
        let result = generate_totp_code(secret, 1609459200); // 2021-01-01 00:00:00 UTC
        assert!(result.is_ok());
        let code = result.unwrap();
        assert_eq!(code.len(), 5);
        // All characters should be from Steam's alphabet
        for c in code.chars() {
            assert!("23456789BCDFGHJKMNPQRTVWXY".contains(c));
        }
    }
}
