//! Pure functions for building Steam protocol messages.
//!
//! This module provides standalone, pure functions for constructing Steam
//! protocol messages. These functions enable unit testing of message
//! construction logic without requiring a full `SteamClient` instance or
//! network connection.

#![allow(dead_code)]
//! # Example
//!
//! ```rust,ignore
//! use steam_client::protocol::messages::{build_client_logon, LogonConfig};
//! use steam_client::LogOnDetails;
//!
//! let config = LogonConfig {
//!     protocol_version: 65580,
//!     cell_id: None,
//!     logon_id: None,
//! };
//!
//! let details = LogOnDetails::default();
//! let logon_msg = build_client_logon(&config, &details, true);
//!
//! assert_eq!(logon_msg.anon_user_target_account_name, Some("anonymous".to_string()));
//! ```

use prost::Message;
use steam_enums::EMsg;
use steam_protos::{CMsgClientLogon, CMsgIPAddress, PRIVATE_IP_OBFUSCATION_MASK, PROTOCOL_VERSION};

use super::{ProtobufMessageHeader, SteamMessage};
use crate::types::LogOnDetails;

/// Configuration for building a ClientLogon message.
///
/// This struct captures the state needed from `SteamClient` to build a logon
/// message, allowing the actual message construction to be a pure function.
#[derive(Debug, Clone, Default)]
pub struct LogonConfig {
    /// Protocol version to use.
    pub protocol_version: u32,
    /// Cell ID for content servers (if known).
    pub cell_id: Option<u32>,
    /// Logon ID for obfuscated IP.
    pub logon_id: Option<u32>,
    /// Machine name to use.
    pub machine_name: Option<String>,
    /// Account identifier for machine ID generation (account name or steam ID).
    pub identifier: Option<String>,
}

impl LogonConfig {
    /// Create a new LogonConfig with default protocol version.
    pub fn new() -> Self {
        Self { protocol_version: PROTOCOL_VERSION, ..Default::default() }
    }

    /// Create a LogonConfig with a specific cell ID.
    pub fn with_cell_id(mut self, cell_id: Option<u32>) -> Self {
        self.cell_id = cell_id;
        self
    }

    /// Create a LogonConfig with a specific logon ID.
    pub fn with_logon_id(mut self, logon_id: Option<u32>) -> Self {
        self.logon_id = logon_id;
        self
    }

    /// Create a LogonConfig with a specific machine name.
    pub fn with_machine_name(mut self, name: Option<String>) -> Self {
        self.machine_name = name;
        self
    }

    /// Create a LogonConfig with a specific identifier.
    pub fn with_identifier(mut self, identifier: Option<String>) -> Self {
        self.identifier = identifier;
        self
    }
}

/// Build a CMsgClientLogon protobuf message.
///
/// This is a pure function that constructs a logon message without any side
/// effects. It can be easily unit tested with different configurations.
///
/// # Arguments
///
/// * `config` - Configuration extracted from SteamClient state
/// * `details` - Login details provided by the caller
/// * `is_anonymous` - Whether this is an anonymous login
///
/// # Example
///
/// ```rust,ignore
/// let config = LogonConfig::new();
/// let details = LogOnDetails { anonymous: true, ..Default::default() };
/// let msg = build_client_logon(&config, &details, true);
/// assert_eq!(msg.anon_user_target_account_name, Some("anonymous".to_string()));
/// ```
pub fn build_client_logon(config: &LogonConfig, details: &LogOnDetails, is_anonymous: bool) -> CMsgClientLogon {
    let mut logon = CMsgClientLogon::default();

    // Check if this is a web logon token login
    let is_web_logon = details.web_logon_token.is_some() && details.steam_id.is_some();

    logon.protocol_version = Some(config.protocol_version);
    logon.chat_mode = Some(2); // Enable new chat

    if is_web_logon {
        // Web logon token login (from clientjstoken)
        // Based on Node.js steam-user implementation:
        // - Uses special client_os_type and ui_mode
        // - Sets web_logon_nonce instead of access_token
        // - Omits many fields that are used for normal logins
        logon.client_os_type = Some(4294966596); // Special value for web logon
        logon.ui_mode = Some(4);
        logon.web_logon_nonce = details.web_logon_token.clone();
        // Note: steam_id is set in the message header, not in the logon body
        // Account name can be included for web logon
        logon.account_name = details.account_name.clone();
        // Don't set these for web logon:
        // - obfuscated_private_ip
        // - cell_id
        // - client_language
        // - should_remember_password
        // - ping_ms_from_cell_search
        // - machine_id
        // - password
        // - auth_code
        // - machine_name
        // - two_factor_code
        // - supports_rate_limit_response
    } else {
        // Normal login flow
        logon.client_os_type = Some(16); // Windows
        logon.cell_id = config.cell_id;

        // Set obfuscated private IP
        if let Some(logon_id) = details.logon_id.or(config.logon_id) {
            logon.obfuscated_private_ip = Some(CMsgIPAddress { ip: Some(steam_protos::cmsg_ip_address::Ip::V4(logon_id ^ PRIVATE_IP_OBFUSCATION_MASK)) });
        } else {
            logon.obfuscated_private_ip = Some(CMsgIPAddress { ip: Some(steam_protos::cmsg_ip_address::Ip::V4(0)) });
        }

        if is_anonymous {
            logon.anon_user_target_account_name = Some("anonymous".to_string());
            // Node.js sets these to empty/zero for anonymous
            logon.client_language = Some(String::new());
            logon.ping_ms_from_cell_search = Some(0);
            logon.machine_name = Some(String::new());
        } else {
            logon.client_language = Some("english".to_string());
            logon.ping_ms_from_cell_search = Some(4 + 16); // Simulate ping

            if let Some(ref token) = details.refresh_token {
                // Refresh token login
                logon.access_token = Some(token.clone());
                logon.should_remember_password = Some(true);
            } else {
                // Password login (requires steam-session for actual auth)
                logon.account_name = details.account_name.clone();
                logon.password = details.password.clone();
                logon.auth_code = details.auth_code.clone();
                logon.two_factor_code = details.two_factor_code.clone();
            }

            // Set machine name
            if let Some(ref name) = details.machine_name.as_ref().or(config.machine_name.as_ref()) {
                logon.machine_name = Some(name.to_string());
            }

            // Set machine ID
            if let Some(ref mid) = details.machine_id {
                logon.machine_id = Some(mid.clone());
            } else if let Some(ref identifier) = config.identifier {
                logon.machine_id = Some(steam_auth::helpers::create_machine_id(identifier));
            }
        }

        logon.supports_rate_limit_response = Some(!is_anonymous);
    }

    logon
}

/// Build a ProtobufMessageHeader for sending messages.
///
/// This is a pure function that constructs a header with the given parameters.
///
/// # Arguments
///
/// * `session_id` - The client session ID
/// * `steam_id` - The Steam ID (as u64)
/// * `job_id_source` - Source job ID for request-response correlation (use
///   `u64::MAX` for no job)
/// * `job_id_target` - Target job ID (use `u64::MAX` for no target)
///
/// # Example
///
/// ```rust,ignore
/// let header = build_proto_header(12345, 76561198012345678, u64::MAX, u64::MAX);
/// assert_eq!(header.session_id, 12345);
/// ```
pub fn build_proto_header(session_id: i32, steam_id: u64, job_id_source: u64, job_id_target: u64) -> ProtobufMessageHeader {
    ProtobufMessageHeader {
        header_length: 0, // Will be calculated during encode
        session_id,
        steam_id,
        job_id_source,
        job_id_target,
        target_job_name: None,
        routing_appid: None,
    }
}

/// Build a ProtobufMessageHeader with a target job name.
///
/// Used for service method calls where the target job name specifies the RPC
/// method.
///
/// # Arguments
///
/// * `session_id` - The client session ID
/// * `steam_id` - The Steam ID (as u64)
/// * `job_id_source` - Source job ID for request-response correlation
/// * `target_job_name` - The RPC method name (e.g.,
///   "FriendsList.GetFriendsList#1")
pub fn build_proto_header_with_job_name(session_id: i32, steam_id: u64, job_id_source: u64, target_job_name: String) -> ProtobufMessageHeader {
    ProtobufMessageHeader {
        header_length: 0,
        session_id,
        steam_id,
        job_id_source,
        job_id_target: u64::MAX,
        target_job_name: Some(target_job_name),
        routing_appid: None,
    }
}

/// Create a complete SteamMessage from components.
///
/// This is a pure function that assembles a complete message ready for
/// encoding.
///
/// # Arguments
///
/// * `msg` - The message type (EMsg)
/// * `header` - The protobuf message header
/// * `body` - The message body (any protobuf message type)
///
/// # Example
///
/// ```rust,ignore
/// use steam_protos::CMsgClientHello;
/// use steam_enums::EMsg;
///
/// let header = build_proto_header(12345, 0, u64::MAX, u64::MAX);
/// let body = CMsgClientHello { protocol_version: Some(65580) };
/// let msg = create_steam_message(EMsg::ClientHello, header, &body);
///
/// // Message is ready to be encoded and sent
/// let bytes = msg.encode();
/// ```
pub fn create_steam_message<T: Message>(msg: EMsg, header: ProtobufMessageHeader, body: &T) -> SteamMessage {
    SteamMessage::new_proto(msg, header, body)
}

/// Parsed logon response with extracted fields.
///
/// This struct provides a convenient way to access the most commonly used
/// fields from a logon response.
#[derive(Debug, Clone, Default)]
pub struct ParsedLogonResponse {
    /// The result code.
    pub eresult: i32,
    /// The Steam ID (if successful).
    pub steam_id: Option<u64>,
    /// The public IP address (if returned).
    pub public_ip: Option<String>,
    /// Cell ID for content servers.
    pub cell_id: Option<u32>,
    /// Vanity URL.
    pub vanity_url: Option<String>,
    /// Email domain (if applicable).
    pub email_domain: Option<String>,
}

/// Parse a CMsgClientLogonResponse and extract key fields.
///
/// This pure function extracts commonly used fields from the logon response
/// into a more convenient structure.
///
/// # Arguments
///
/// * `response` - The raw protobuf logon response
///
/// # Example
///
/// ```rust,ignore
/// let response = CMsgClientLogonResponse { eresult: Some(1), .. };
/// let parsed = parse_logon_response(&response);
/// assert_eq!(parsed.eresult, 1);
/// ```
pub fn parse_logon_response(response: &steam_protos::CMsgClientLogonResponse) -> ParsedLogonResponse {
    let public_ip = response.public_ip.as_ref().and_then(|ip| if let Some(steam_protos::cmsg_ip_address::Ip::V4(v4)) = &ip.ip { Some(format!("{}.{}.{}.{}", (v4 >> 24) & 0xFF, (v4 >> 16) & 0xFF, (v4 >> 8) & 0xFF, v4 & 0xFF)) } else { None });

    ParsedLogonResponse {
        eresult: response.eresult.unwrap_or(2),
        steam_id: response.client_supplied_steamid,
        public_ip,
        cell_id: response.cell_id,
        vanity_url: response.vanity_url.clone(),
        email_domain: response.email_domain.clone(),
    }
}

// ============================================================================
// Friends List Parsing
// ============================================================================

/// Parsed friend entry from the friends list response.
#[derive(Debug, Clone, Default)]
pub struct ParsedFriendEntry {
    /// The friend's Steam ID (as u64).
    pub steam_id: u64,
    /// The relationship type (friend, blocked, etc.).
    pub relationship: i32,
}

/// Parse a CMsgClientFriendsList response.
///
/// Extracts friend entries from the friends list message.
///
/// # Example
///
/// ```rust,ignore
/// let response = CMsgClientFriendsList { ... };
/// let friends = parse_friends_list(&response);
/// for friend in friends {
///     println!("Friend {} has relationship {}", friend.steam_id, friend.relationship);
/// }
/// ```
pub fn parse_friends_list(response: &steam_protos::CMsgClientFriendsList) -> Vec<ParsedFriendEntry> {
    response.friends.iter().map(|f| ParsedFriendEntry { steam_id: f.ulfriendid.unwrap_or(0), relationship: f.efriendrelationship.unwrap_or(0) as i32 }).collect()
}

// ============================================================================
// Persona State Parsing
// ============================================================================

/// Parsed persona/player information.
#[derive(Debug, Clone, Default)]
pub struct ParsedPersonaState {
    /// The player's Steam ID (as u64).
    pub steam_id: u64,
    /// The player's display name.
    pub player_name: Option<String>,
    /// The persona state (online, away, etc.).
    pub persona_state: i32,
    /// Avatar hash for constructing avatar URL.
    pub avatar_hash: Option<Vec<u8>>,
    /// Game currently being played (name).
    pub game_name: Option<String>,
    /// Game ID currently being played.
    pub game_id: Option<u64>,
    /// Last time this user was online (unix timestamp).
    pub last_logoff: Option<u32>,
    /// Last time this user logged on (unix timestamp).
    pub last_logon: Option<u32>,
}

/// Parse a CMsgClientPersonaState response.
///
/// Extracts persona information for one or more users.
///
/// # Example
///
/// ```rust,ignore
/// let response = CMsgClientPersonaState { ... };
/// let personas = parse_persona_state(&response);
/// for persona in personas {
///     println!("{} is {:?}", persona.player_name.unwrap_or_default(), persona.persona_state);
/// }
/// ```
pub fn parse_persona_state(response: &steam_protos::CMsgClientPersonaState) -> Vec<ParsedPersonaState> {
    response
        .friends
        .iter()
        .map(|f| ParsedPersonaState {
            steam_id: f.friendid.unwrap_or(0),
            player_name: f.player_name.clone(),
            persona_state: f.persona_state.unwrap_or(0) as i32,
            avatar_hash: f.avatar_hash.clone(),
            game_name: f.game_name.clone(),
            game_id: f.gameid,
            last_logoff: f.last_logoff,
            last_logon: f.last_logon,
        })
        .collect()
}

// ============================================================================
// Account Info Parsing
// ============================================================================

/// Parsed account information.
#[derive(Debug, Clone, Default)]
pub struct ParsedAccountInfo {
    /// The persona (display) name.
    pub persona_name: Option<String>,
    /// The country code (e.g., "US", "GB").
    pub country: Option<String>,
    /// Whether phone is verified for this account.
    pub is_phone_verified: bool,
    /// Two-factor authentication state.
    pub two_factor_state: u32,
    /// Account flags (bitfield).
    pub account_flags: u32,
}

/// Parse a CMsgClientAccountInfo response.
///
/// Extracts account details from the account info message.
pub fn parse_account_info(response: &steam_protos::CMsgClientAccountInfo) -> ParsedAccountInfo {
    ParsedAccountInfo {
        persona_name: response.persona_name.clone(),
        country: response.ip_country.clone(),
        is_phone_verified: response.is_phone_verified.unwrap_or(false),
        two_factor_state: response.two_factor_state.unwrap_or(0),
        account_flags: response.account_flags.unwrap_or(0),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_client_logon_anonymous() {
        let config = LogonConfig::new();
        let details = LogOnDetails { anonymous: true, ..Default::default() };

        let logon = build_client_logon(&config, &details, true);

        assert_eq!(logon.anon_user_target_account_name, Some("anonymous".to_string()));
        assert_eq!(logon.protocol_version, Some(PROTOCOL_VERSION));
        assert_eq!(logon.client_os_type, Some(16));
        assert_eq!(logon.chat_mode, Some(2));
        assert_eq!(logon.supports_rate_limit_response, Some(false));
        assert!(logon.access_token.is_none());
        assert!(logon.account_name.is_none());
    }

    #[test]
    fn test_build_client_logon_with_token() {
        let config = LogonConfig::new();
        let details = LogOnDetails { refresh_token: Some("test_token_12345".to_string()), ..Default::default() };

        let logon = build_client_logon(&config, &details, false);

        assert_eq!(logon.access_token, Some("test_token_12345".to_string()));
        assert_eq!(logon.should_remember_password, Some(true));
        assert_eq!(logon.supports_rate_limit_response, Some(true));
        assert!(logon.anon_user_target_account_name.is_none());
    }

    #[test]
    fn test_build_client_logon_with_password() {
        let config = LogonConfig::new();
        let details = LogOnDetails {
            account_name: Some("testuser".to_string()),
            password: Some("testpass".to_string()),
            auth_code: Some("ABC123".to_string()),
            ..Default::default()
        };

        let logon = build_client_logon(&config, &details, false);

        assert_eq!(logon.account_name, Some("testuser".to_string()));
        assert_eq!(logon.password, Some("testpass".to_string()));
        assert_eq!(logon.auth_code, Some("ABC123".to_string()));
        assert!(logon.access_token.is_none());
    }

    #[test]
    fn test_build_client_logon_with_cell_id() {
        let config = LogonConfig::new().with_cell_id(Some(42));
        let details = LogOnDetails::default();

        let logon = build_client_logon(&config, &details, true);

        assert_eq!(logon.cell_id, Some(42));
    }

    #[test]
    fn test_build_client_logon_with_logon_id() {
        let config = LogonConfig::new().with_logon_id(Some(0x12345678));
        let details = LogOnDetails::default();

        let logon = build_client_logon(&config, &details, true);

        // Verify obfuscated IP is set (XOR with mask)
        assert!(logon.obfuscated_private_ip.is_some());
        if let Some(ip) = &logon.obfuscated_private_ip {
            if let Some(steam_protos::cmsg_ip_address::Ip::V4(v4)) = &ip.ip {
                assert_eq!(*v4, 0x12345678 ^ PRIVATE_IP_OBFUSCATION_MASK);
            } else {
                panic!("Expected V4 IP");
            }
        }
    }

    #[test]
    fn test_build_proto_header() {
        let header = build_proto_header(12345, 76561198012345678, u64::MAX, u64::MAX);

        assert_eq!(header.session_id, 12345);
        assert_eq!(header.steam_id, 76561198012345678);
        assert_eq!(header.job_id_source, u64::MAX);
        assert_eq!(header.job_id_target, u64::MAX);
        assert!(header.target_job_name.is_none());
    }

    #[test]
    fn test_build_proto_header_with_job_id() {
        let header = build_proto_header(999, 76561198000000000, 42, u64::MAX);

        assert_eq!(header.session_id, 999);
        assert_eq!(header.job_id_source, 42);
        assert_eq!(header.job_id_target, u64::MAX);
    }

    #[test]
    fn test_build_proto_header_with_job_name() {
        let header = build_proto_header_with_job_name(12345, 76561198012345678, 42, "FriendsList.GetFriendsList#1".to_string());

        assert_eq!(header.session_id, 12345);
        assert_eq!(header.job_id_source, 42);
        assert_eq!(header.target_job_name, Some("FriendsList.GetFriendsList#1".to_string()));
    }

    #[test]
    fn test_create_steam_message() {
        use steam_protos::CMsgClientHello;

        let header = build_proto_header(12345, 0, u64::MAX, u64::MAX);
        let body = CMsgClientHello { protocol_version: Some(PROTOCOL_VERSION) };

        let msg = create_steam_message(EMsg::ClientHello, header, &body);

        assert_eq!(msg.msg, EMsg::ClientHello);
        assert!(msg.is_proto);
        assert!(!msg.body.is_empty());
    }

    #[test]
    fn test_create_steam_message_roundtrip() {
        use steam_protos::CMsgClientHello;

        let header = build_proto_header(12345, 76561198012345678, 42, 99);
        let body = CMsgClientHello { protocol_version: Some(65580) };

        let msg = create_steam_message(EMsg::ClientHello, header, &body);
        let encoded = msg.encode();

        // Decode it back
        let decoded = SteamMessage::decode_from_bytes(&encoded).expect("Failed to decode");

        assert_eq!(decoded.msg, EMsg::ClientHello);
        assert!(decoded.is_proto);

        // Decode the body
        let decoded_body: CMsgClientHello = decoded.decode_body().expect("Failed to decode body");
        assert_eq!(decoded_body.protocol_version, Some(65580));
    }

    #[test]
    fn test_parse_logon_response() {
        let response = steam_protos::CMsgClientLogonResponse {
            eresult: Some(1),
            client_supplied_steamid: Some(76561198012345678),
            cell_id: Some(42),
            vanity_url: Some("testuser".to_string()),
            email_domain: Some("example.com".to_string()),
            ..Default::default()
        };

        let parsed = parse_logon_response(&response);

        assert_eq!(parsed.eresult, 1);
        assert_eq!(parsed.steam_id, Some(76561198012345678));
        assert_eq!(parsed.cell_id, Some(42));
        assert_eq!(parsed.vanity_url, Some("testuser".to_string()));
        assert_eq!(parsed.email_domain, Some("example.com".to_string()));
    }

    #[test]
    fn test_parse_logon_response_with_public_ip() {
        let response = steam_protos::CMsgClientLogonResponse {
            eresult: Some(1),
            public_ip: Some(CMsgIPAddress {
                ip: Some(steam_protos::cmsg_ip_address::Ip::V4(0xC0A80001)), // 192.168.0.1
            }),
            ..Default::default()
        };

        let parsed = parse_logon_response(&response);

        assert_eq!(parsed.public_ip, Some("192.168.0.1".to_string()));
    }

    #[test]
    fn test_parse_logon_response_defaults() {
        let response = steam_protos::CMsgClientLogonResponse::default();

        let parsed = parse_logon_response(&response);

        assert_eq!(parsed.eresult, 2); // Default to Fail
        assert!(parsed.steam_id.is_none());
        assert!(parsed.public_ip.is_none());
    }

    #[test]
    fn test_logon_config_builder() {
        let config = LogonConfig::new().with_cell_id(Some(42)).with_logon_id(Some(12345)).with_machine_name(Some("TEST-PC".to_string()));

        assert_eq!(config.protocol_version, PROTOCOL_VERSION);
        assert_eq!(config.cell_id, Some(42));
        assert_eq!(config.logon_id, Some(12345));
        assert_eq!(config.machine_name, Some("TEST-PC".to_string()));
    }

    // ========================================================================
    // Friends List Parsing Tests
    // ========================================================================

    #[test]
    fn test_parse_friends_list() {
        use steam_protos::cmsg_client_friends_list::Friend;
        let response = steam_protos::CMsgClientFriendsList {
            friends: vec![
                Friend {
                    ulfriendid: Some(76561198012345678),
                    efriendrelationship: Some(3), // Friend
                },
                Friend {
                    ulfriendid: Some(76561198087654321),
                    efriendrelationship: Some(4), // Blocked
                },
            ],
            ..Default::default()
        };

        let friends = parse_friends_list(&response);

        assert_eq!(friends.len(), 2);
        assert_eq!(friends[0].steam_id, 76561198012345678);
        assert_eq!(friends[0].relationship, 3);
        assert_eq!(friends[1].steam_id, 76561198087654321);
        assert_eq!(friends[1].relationship, 4);
    }

    #[test]
    fn test_parse_friends_list_empty() {
        let response = steam_protos::CMsgClientFriendsList::default();
        let friends = parse_friends_list(&response);
        assert!(friends.is_empty());
    }

    // ========================================================================
    // Persona State Parsing Tests
    // ========================================================================

    #[test]
    fn test_parse_persona_state() {
        use steam_protos::cmsg_client_persona_state::Friend;
        let response = steam_protos::CMsgClientPersonaState {
            friends: vec![Friend {
                friendid: Some(76561198012345678),
                player_name: Some("TestPlayer".to_string()),
                persona_state: Some(1), // Online
                game_name: Some("Dota 2".to_string()),
                gameid: Some(570),
                last_logoff: Some(1700000000),
                ..Default::default()
            }],
            ..Default::default()
        };

        let personas = parse_persona_state(&response);

        assert_eq!(personas.len(), 1);
        assert_eq!(personas[0].steam_id, 76561198012345678);
        assert_eq!(personas[0].player_name, Some("TestPlayer".to_string()));
        assert_eq!(personas[0].persona_state, 1);
        assert_eq!(personas[0].game_name, Some("Dota 2".to_string()));
        assert_eq!(personas[0].game_id, Some(570));
        assert_eq!(personas[0].last_logoff, Some(1700000000));
    }

    #[test]
    fn test_parse_persona_state_empty() {
        let response = steam_protos::CMsgClientPersonaState::default();
        let personas = parse_persona_state(&response);
        assert!(personas.is_empty());
    }

    // ========================================================================
    // Account Info Parsing Tests
    // ========================================================================

    #[test]
    fn test_parse_account_info() {
        let response = steam_protos::CMsgClientAccountInfo {
            persona_name: Some("MyName".to_string()),
            ip_country: Some("US".to_string()),
            is_phone_verified: Some(true),
            two_factor_state: Some(2),
            account_flags: Some(0x0001),
            ..Default::default()
        };

        let account = parse_account_info(&response);

        assert_eq!(account.persona_name, Some("MyName".to_string()));
        assert_eq!(account.country, Some("US".to_string()));
        assert!(account.is_phone_verified);
        assert_eq!(account.two_factor_state, 2);
        assert_eq!(account.account_flags, 0x0001);
    }

    #[test]
    fn test_parse_account_info_defaults() {
        let response = steam_protos::CMsgClientAccountInfo::default();
        let account = parse_account_info(&response);

        assert!(account.persona_name.is_none());
        assert!(account.country.is_none());
        assert!(!account.is_phone_verified);
        assert_eq!(account.two_factor_state, 0);
        assert_eq!(account.account_flags, 0);
    }
}
