//! Login approver for QR code authentication.
//!
//! This module provides the ability to approve login sessions from another
//! device, typically used for approving QR code logins from the Steam mobile
//! app.

use hmac::{Hmac, Mac};
use sha2::Sha256;
use steam_protos::{CAuthenticationGetAuthSessionInfoResponse, EAuthTokenPlatformType, ESessionPersistence};
use steamid::SteamID;

use crate::{
    auth_client::AuthenticationClient,
    error::SessionError,
    helpers::decode_jwt,
    transport::{Transport, WebApiTransport},
};

type HmacSha256 = Hmac<Sha256>;

/// Options for creating a LoginApprover.
#[derive(Debug, Clone, Default)]
pub struct ApproverOptions {
    /// Machine ID for authentication.
    pub machine_id: Option<Vec<u8>>,
    /// Friendly name for the device.
    pub device_friendly_name: Option<String>,
}

/// Login approver for approving/denying login sessions from another device.
///
/// This is typically used to approve QR code logins from the Steam mobile app.
pub struct LoginApprover {
    access_token: String,
    shared_secret: Vec<u8>,
    handler: AuthenticationClient,
    steam_id: Option<SteamID>,
}

/// Builder for creating `LoginApprover` instances.
pub struct LoginApproverBuilder {
    access_token: String,
    shared_secret: Vec<u8>,
    options: ApproverOptions,
    transport: Option<Transport>,
    auth_client: Option<AuthenticationClient>,
}

impl LoginApproverBuilder {
    /// Create a new builder for the specified access token and shared secret.
    pub fn new(access_token: &str, shared_secret: impl AsRef<[u8]>) -> Self {
        Self {
            access_token: access_token.to_string(),
            shared_secret: shared_secret.as_ref().to_vec(),
            options: ApproverOptions::default(),
            transport: None,
            auth_client: None,
        }
    }

    /// Set a custom transport for Steam API communication.
    pub fn with_transport(mut self, transport: Transport) -> Self {
        self.transport = Some(transport);
        self
    }

    /// Set a custom authentication client.
    pub fn with_auth_client(mut self, client: AuthenticationClient) -> Self {
        self.auth_client = Some(client);
        self
    }

    /// Set login approver options.
    pub fn with_options(mut self, options: ApproverOptions) -> Self {
        self.options = options;
        self
    }

    /// Build the `LoginApprover`.
    pub fn build(self) -> Result<LoginApprover, SessionError> {
        let decoded = decode_jwt(&self.access_token)?;

        // Parse SteamID from token
        let steam_id64: u64 = decoded.sub.parse().map_err(|_| SessionError::TokenError("Invalid SteamID in token".into()))?;

        let handler = if let Some(auth_client) = self.auth_client {
            auth_client
        } else {
            let transport = self.transport.unwrap_or_else(|| Transport::WebApi(WebApiTransport::default()));
            AuthenticationClient::new(transport, EAuthTokenPlatformType::KEAuthTokenPlatformTypeMobileApp, self.options.machine_id, self.options.device_friendly_name)
        };

        Ok(LoginApprover {
            access_token: self.access_token,
            shared_secret: self.shared_secret,
            handler,
            steam_id: Some(SteamID::from(steam_id64)),
        })
    }
}

impl LoginApprover {
    /// Create a new login approver.
    ///
    /// # Arguments
    ///
    /// * `access_token` - A valid Steam access token with mobile app audience
    /// * `shared_secret` - The shared secret from the Steam Guard mobile
    ///   authenticator
    /// * `options` - Optional configuration options
    pub fn new(access_token: &str, shared_secret: impl AsRef<[u8]>, options: Option<ApproverOptions>) -> Result<Self, SessionError> {
        LoginApproverBuilder::new(access_token, shared_secret).with_options(options.unwrap_or_default()).build()
    }

    /// Create a builder for customizing the login approver.
    ///
    /// Use this when you need to inject custom dependencies for testing.
    pub fn builder(access_token: &str, shared_secret: impl AsRef<[u8]>) -> LoginApproverBuilder {
        LoginApproverBuilder::new(access_token, shared_secret)
    }

    /// Get the SteamID from the access token.
    pub fn steam_id(&self) -> Option<&SteamID> {
        self.steam_id.as_ref()
    }

    /// Get information about an auth session from a QR challenge URL.
    ///
    /// # Arguments
    ///
    /// * `qr_challenge_url` - The QR challenge URL (e.g., "https://s.team/q/1/1234567890")
    pub async fn get_auth_session_info(&self, qr_challenge_url: &str) -> Result<CAuthenticationGetAuthSessionInfoResponse, SessionError> {
        let (client_id, version) = decode_qr_url(qr_challenge_url)?;

        let mut response = self.handler.get_auth_session_info(&self.access_token, client_id).await?;

        // Ensure version from URL is in the response if not already present
        if response.version.is_none() {
            response.version = Some(version);
        }

        Ok(response)
    }

    /// Approve or deny an auth session.
    ///
    /// # Arguments
    ///
    /// * `qr_challenge_url` - The QR challenge URL
    /// * `approve` - `true` to approve, `false` to deny
    /// * `persistence` - Session persistence level (defaults to Persistent)
    pub async fn approve_auth_session(&self, qr_challenge_url: &str, approve: bool, persistence: Option<ESessionPersistence>) -> Result<(), SessionError> {
        let (client_id, version) = decode_qr_url(qr_challenge_url)?;

        let steam_id = self.steam_id.as_ref().ok_or(SessionError::InvalidState)?.steam_id64();

        // Generate HMAC signature
        let signature = self.create_signature(version, client_id, steam_id)?;

        self.handler.submit_mobile_confirmation(&self.access_token, version, client_id, steam_id, &signature, approve, persistence.unwrap_or(ESessionPersistence::KESessionPersistencePersistent)).await
    }

    /// Create the HMAC-SHA256 signature for mobile confirmation.
    fn create_signature(&self, version: i32, client_id: u64, steam_id: u64) -> Result<Vec<u8>, SessionError> {
        let mut mac = HmacSha256::new_from_slice(&self.shared_secret).map_err(|e| SessionError::CryptoError(e.to_string()))?;

        // Build the message to sign
        let mut data = Vec::new();
        data.extend_from_slice(&(version as u16).to_le_bytes());
        data.extend_from_slice(&client_id.to_le_bytes());
        data.extend_from_slice(&steam_id.to_le_bytes());

        mac.update(&data);
        let result = mac.finalize();

        Ok(result.into_bytes().to_vec())
    }
}

/// Decode a QR challenge URL into client_id and version.
///
/// Format: `https://s.team/q/{version}/{client_id}`
fn decode_qr_url(url: &str) -> Result<(u64, i32), SessionError> {
    // Parse URL like https://s.team/q/1/1234567890
    let parts: Vec<&str> = url.trim_end_matches('/').split('/').collect();

    if parts.len() < 2 {
        return Err(SessionError::InvalidQrUrl(url.to_string()));
    }

    // Get the last two segments
    let client_id_str = parts.last().ok_or(SessionError::InvalidQrUrl(url.to_string()))?;
    let version_str = parts.get(parts.len() - 2).ok_or(SessionError::InvalidQrUrl(url.to_string()))?;

    let client_id: u64 = client_id_str.parse().map_err(|_| SessionError::InvalidQrUrl(url.to_string()))?;

    let version: i32 = version_str.parse().map_err(|_| SessionError::InvalidQrUrl(url.to_string()))?;

    Ok((client_id, version))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_qr_url() {
        let url = "https://s.team/q/1/1234567890";
        let (client_id, version) = decode_qr_url(url).unwrap();
        assert_eq!(client_id, 1234567890);
        assert_eq!(version, 1);
    }

    #[test]
    fn test_decode_qr_url_with_trailing_slash() {
        let url = "https://s.team/q/2/9876543210/";
        let (client_id, version) = decode_qr_url(url).unwrap();
        assert_eq!(client_id, 9876543210);
        assert_eq!(version, 2);
    }

    #[test]
    fn test_decode_qr_url_invalid() {
        let url = "https://invalid.url/";
        assert!(decode_qr_url(url).is_err());
    }

    #[test]
    fn test_builder_rejects_invalid_token() {
        // An invalid JWT should fail
        let result = LoginApproverBuilder::new("invalid_token", b"secret").build();

        assert!(result.is_err());
    }
}
