//! Public types and interfaces for Steam session management.

use steam_protos::{EAuthSessionGuardType, EAuthTokenPlatformType, ESessionPersistence};

/// Options for creating a LoginSession.
#[derive(Debug, Clone, Default)]
pub struct LoginSessionOptions {
    /// Custom user-agent string.
    pub user_agent: Option<String>,
    /// Machine ID for SteamClient platform.
    pub machine_id: Option<Vec<u8>>,
    /// Friendly name for the machine.
    pub machine_friendly_name: Option<String>,
}

/// Details for starting a login with credentials.
#[derive(Debug, Clone)]
pub struct CredentialsDetails {
    /// Steam account name.
    pub account_name: String,
    /// Steam account password.
    pub password: String,
    /// Session persistence type.
    pub persistence: Option<ESessionPersistence>,
    /// Steam Guard machine token for bypassing email code.
    pub steam_guard_machine_token: Option<String>,
    /// Pre-supplied Steam Guard code (email or TOTP).
    pub steam_guard_code: Option<String>,
}

/// Response from starting a login session.
#[derive(Debug, Clone)]
pub struct StartSessionResponse {
    /// Whether action is required from the user.
    pub action_required: bool,
    /// Valid actions the user can take.
    pub valid_actions: Option<Vec<ValidAction>>,
    /// QR code challenge URL (for QR login).
    pub qr_challenge_url: Option<String>,
}

/// A valid action for completing authentication.
#[derive(Debug, Clone)]
pub struct ValidAction {
    /// Type of guard required.
    pub guard_type: EAuthSessionGuardType,
    /// Additional details (e.g., email domain).
    pub detail: Option<String>,
}

/// Result of a successful poll.
#[derive(Debug, Clone)]
pub struct PollResult {
    /// Account name.
    pub account_name: String,
    /// Refresh token.
    pub refresh_token: String,
    /// Access token (may be None).
    pub access_token: Option<String>,
    /// New Steam Guard machine token (if issued).
    pub new_guard_data: Option<String>,
}

/// Request to approve an auth session.
#[derive(Debug, Clone)]
pub struct ApproveAuthSessionRequest {
    /// QR challenge URL.
    pub qr_challenge_url: String,
    /// Whether to approve (true) or deny (false).
    pub approve: bool,
    /// Session persistence.
    pub persistence: Option<ESessionPersistence>,
}

/// Session state from begin auth.
///
/// Contains the client ID, request ID, and other information needed to complete
/// the authentication flow (polling, Steam Guard code submission, etc.).
#[derive(Debug, Clone)]
pub struct StartAuthSessionResponse {
    pub client_id: u64,
    pub request_id: Vec<u8>,
    pub poll_interval: f32,
    pub allowed_confirmations: Vec<AllowedConfirmation>,
    pub steam_id: Option<u64>,
    pub weak_token: Option<String>,
    pub challenge_url: Option<String>,
    pub version: Option<i32>,
}

/// An allowed confirmation type.
#[derive(Debug, Clone, PartialEq)]
pub struct AllowedConfirmation {
    pub confirmation_type: EAuthSessionGuardType,
    pub message: Option<String>,
}

/// Platform-specific data for requests.
#[derive(Debug, Clone)]
pub(crate) struct PlatformData {
    pub website_id: String,
    pub headers: std::collections::HashMap<String, String>,
    pub device_details: DeviceDetails,
}

/// Device details for authentication.
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub(crate) struct DeviceDetails {
    pub device_friendly_name: String,
    pub platform_type: EAuthTokenPlatformType,
    pub os_type: Option<i32>,
    pub gaming_device_type: Option<u32>,
    pub machine_id: Option<Vec<u8>>,
}
