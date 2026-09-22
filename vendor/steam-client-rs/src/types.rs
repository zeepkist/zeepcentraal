//! Type definitions for Steam client.

use steam_enums::EResult;
use steamid::SteamID;

/// Details for logging on to Steam.
#[derive(Clone, Default)]
pub struct LogOnDetails {
    /// Anonymous login (no credentials required).
    pub anonymous: bool,

    /// Refresh token for authentication.
    pub refresh_token: Option<String>,

    /// Account name (for password auth).
    pub account_name: Option<String>,

    /// Password (for password auth).
    pub password: Option<String>,

    /// Steam Guard email code.
    pub auth_code: Option<String>,

    /// Two-factor authentication code.
    pub two_factor_code: Option<String>,

    /// Machine auth token for Steam Guard.
    pub machine_auth_token: Option<String>,

    /// Logon ID (for avoiding "logged in elsewhere" errors).
    pub logon_id: Option<u32>,

    /// Machine name to report to Steam.
    pub machine_name: Option<String>,

    /// Machine ID (binary blob) for Steam Guard.
    pub machine_id: Option<Vec<u8>>,

    /// Web logon token from /chat/clientjstoken endpoint.
    /// Used with steam_id for cookie-based authentication.
    pub web_logon_token: Option<String>,

    /// SteamID for web logon token authentication.
    /// Required when using web_logon_token.
    pub steam_id: Option<SteamID>,

    /// Client OS type.
    pub client_os_type: Option<u32>,
}

impl std::fmt::Debug for LogOnDetails {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("LogOnDetails")
            .field("anonymous", &self.anonymous)
            .field("account_name", &self.account_name)
            .field("steam_id", &self.steam_id)
            .field("logon_id", &self.logon_id)
            .field("machine_name", &self.machine_name)
            .field("client_os_type", &self.client_os_type)
            .field("machine_id", &self.machine_id.as_ref().map(|v| format!("<{} bytes>", v.len())))
            // Sensitive fields — redacted
            .field("refresh_token", &self.refresh_token.as_ref().map(|_| "<redacted>"))
            .field("password", &self.password.as_ref().map(|_| "<redacted>"))
            .field("auth_code", &self.auth_code.as_ref().map(|_| "<redacted>"))
            .field("two_factor_code", &self.two_factor_code.as_ref().map(|_| "<redacted>"))
            .field("machine_auth_token", &self.machine_auth_token.as_ref().map(|_| "<redacted>"))
            .field("web_logon_token", &self.web_logon_token.as_ref().map(|_| "<redacted>"))
            .finish()
    }
}

/// Response from a successful login.
#[derive(Debug, Clone)]
pub struct LogOnResponse {
    /// The result code.
    pub eresult: EResult,

    /// The logged-in SteamID.
    pub steam_id: SteamID,

    /// Public IP address as seen by Steam.
    pub public_ip: Option<String>,

    /// Cell ID for content servers.
    pub cell_id: u32,

    /// Vanity URL.
    pub vanity_url: Option<String>,

    /// Email domain for the account (if any).
    pub email_domain: Option<String>,

    /// Whether Steam Guard is enabled.
    pub steam_guard_required: bool,

    /// Heartbeat interval in seconds (for keep-alive).
    pub heartbeat_seconds: Option<i32>,

    /// Server time as Unix timestamp.
    pub server_time: Option<u32>,

    /// Account flags bitfield.
    pub account_flags: Option<u32>,

    /// User's country code.
    pub user_country: Option<String>,

    /// Country code based on IP address.
    pub ip_country_code: Option<String>,

    /// Client instance ID.
    pub client_instance_id: Option<u64>,

    /// Token ID for the session.
    pub token_id: Option<u64>,

    /// Family group ID (if in a family group).
    pub family_group_id: Option<u64>,

    /// Extended result code (for more detailed error info).
    pub eresult_extended: Option<i32>,

    /// Cell ID ping threshold.
    pub cell_id_ping_threshold: Option<u32>,

    /// Whether a client update check is required.
    pub force_client_update_check: Option<bool>,

    /// Agreement session URL (if user needs to accept agreements).
    pub agreement_session_url: Option<String>,

    /// Legacy out-of-game heartbeat interval.
    pub legacy_out_of_game_heartbeat_seconds: Option<i32>,

    /// Parental settings (serialized protobuf).
    pub parental_settings: Option<Vec<u8>>,

    /// Parental setting signature.
    pub parental_setting_signature: Option<Vec<u8>>,

    /// Count of login failures to migrate.
    pub count_loginfailures_to_migrate: Option<i32>,

    /// Count of disconnects to migrate.
    pub count_disconnects_to_migrate: Option<i32>,

    /// OGS data report time window.
    pub ogs_data_report_time_window: Option<i32>,

    /// Steam2 ticket (legacy).
    pub steam2_ticket: Option<Vec<u8>>,
}

/// Account information received after login.
#[derive(Debug, Clone)]
pub struct AccountInfo {
    /// Account name.
    pub name: String,

    /// Country code.
    pub country: String,

    /// Number of authenticated machines.
    pub authed_machines: u32,

    /// Account flags.
    pub flags: u32,

    /// Facebook ID (if linked).
    pub facebook_id: Option<String>,

    /// Facebook name (if linked).
    pub facebook_name: Option<String>,
}

/// Email information for the account.
#[derive(Debug, Clone)]
pub struct EmailInfo {
    /// Email address.
    pub address: String,

    /// Whether the email is validated.
    pub validated: bool,
}

/// Account limitations.
#[derive(Debug, Clone)]
pub struct Limitations {
    /// Whether this is a limited account.
    pub limited: bool,

    /// Whether the account is community banned.
    pub community_banned: bool,

    /// Whether the account is locked.
    pub locked: bool,

    /// Whether the account can invite friends.
    pub can_invite_friends: bool,
}

/// VAC ban status.
#[derive(Debug, Clone)]
pub struct VacStatus {
    /// Number of VAC bans.
    pub num_bans: u32,

    /// App IDs with VAC bans.
    pub appids: Vec<u32>,

    /// VAC ban ranges.
    pub ranges: Vec<(u32, u32)>,
}

/// Wallet information.
#[derive(Debug, Clone)]
pub struct WalletInfo {
    /// Whether the account has a wallet.
    pub has_wallet: bool,

    /// Currency code.
    pub currency: u32,

    /// Balance in cents.
    pub balance: i64,
}

/// Quick invite link information.
#[derive(Debug, Clone)]
pub struct QuickInviteLink {
    /// The full invite link URL.
    pub invite_link: String,

    /// The invite token (extracted from link).
    pub invite_token: String,

    /// Maximum number of times this link can be used.
    pub invite_limit: Option<u64>,

    /// Duration in seconds that the link is valid.
    pub invite_duration: Option<u64>,

    /// Unix timestamp when the link was created.
    pub time_created: Option<u32>,

    /// Whether the link is currently valid.
    pub valid: bool,
}

/// Quick invite link validity check result.
#[derive(Debug, Clone)]
pub struct QuickInviteLinkValidity {
    /// Whether the link is valid.
    pub valid: bool,

    /// The SteamID of the link owner (if valid).
    pub steam_id: Option<SteamID>,

    /// Duration in seconds that the link is valid for.
    pub invite_duration: Option<u64>,
}

/// Persona name history entry.
#[derive(Debug, Clone)]
pub struct PersonaNameHistory {
    /// The persona name.
    pub name: String,
    /// Timestamp when this name was used (Unix timestamp).
    pub name_since: u32,
}
