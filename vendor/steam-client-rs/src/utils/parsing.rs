//! Pure parsing functions for Steam protocol messages.
//!
//! This module extracts parsing logic from `MessageHandler` into standalone
//! pure functions, making them easier to unit test without event emission
//! concerns.
//!
//! # Example
//!
//! ```rust,ignore
//! use steam_client::parsing::{parse_logon_response, LogonData};
//!
//! let bytes = /* protobuf bytes */;
//! match parse_logon_response(&bytes) {
//!     Ok(data) => tracing::info!("Logged in as {}", data.steam_id.steam3()),
//!     Err(e) => tracing::info!("Parse error: {:?}", e),
//! }
//! ```

use std::collections::HashMap;

use prost::Message;
use steam_enums::{EChatEntryType, EFriendRelationship, EPersonaState, EResult};
use steamid::SteamID;

use super::{
    binary_kv::{parse_binary_kv, BinaryKvValue},
    vdf::{parse_vdf, VdfValue},
};

/// Error type for parsing operations.
#[derive(Debug, Clone, PartialEq)]
pub enum ParseError {
    /// Failed to decode protobuf message.
    DecodeError(String),
    /// Missing required field.
    MissingField(String),
    /// Invalid data.
    InvalidData(String),
}

impl std::fmt::Display for ParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ParseError::DecodeError(msg) => write!(f, "Decode error: {}", msg),
            ParseError::MissingField(field) => write!(f, "Missing field: {}", field),
            ParseError::InvalidData(msg) => write!(f, "Invalid data: {}", msg),
        }
    }
}

impl std::error::Error for ParseError {}

//=============================================================================
// Parsed Data Structures
//=============================================================================

/// Parsed logon response data.
#[derive(Debug, Clone)]
pub struct LogonData {
    pub steam_id: SteamID,
    pub eresult: EResult,
    pub heartbeat_seconds: i32,
    pub public_ip: Option<std::net::Ipv4Addr>,
    pub vanity_url: Option<String>,
    pub cell_id: Option<u32>,
    pub client_instance_id: Option<u64>,
}

/// Parsed friends list data.
#[derive(Debug, Clone)]
pub struct FriendsListData {
    pub incremental: bool,
    pub friends: Vec<FriendData>,
}

/// Parsed friend entry.
#[derive(Debug, Clone)]
pub struct FriendData {
    pub steam_id: SteamID,
    pub relationship: EFriendRelationship,
}

/// Parsed persona state data.
#[derive(Debug, Clone)]
pub struct PersonaData {
    pub steam_id: SteamID,
    pub player_name: String,
    pub persona_state: EPersonaState,
    pub avatar_hash: Option<String>,
    pub game_name: Option<String>,
    pub game_id: Option<u64>,
    pub last_logoff: Option<u32>,
    pub last_logon: Option<u32>,
    pub last_seen_online: Option<u32>,
    pub game_server_ip: Option<u32>,
    pub game_server_port: Option<u32>,
    pub rich_presence: HashMap<String, String>,
}

/// Parsed license entry.
#[derive(Debug, Clone)]
pub struct LicenseData {
    pub package_id: u32,
    pub time_created: u32,
    pub license_type: u32,
    pub flags: u32,
    pub access_token: u64,
}

/// Parsed chat message data.
#[derive(Debug, Clone)]
pub enum ChatData {
    Message { sender: SteamID, message: String, chat_entry_type: EChatEntryType, timestamp: u32, ordinal: u32 },
    Typing { sender: SteamID },
}

/// Parsed PICS product info.
#[derive(Debug, Clone)]
pub struct ProductInfoData {
    pub apps: HashMap<u32, AppInfoData>,
    pub packages: HashMap<u32, PackageInfoData>,
    pub unknown_apps: Vec<u32>,
    pub unknown_packages: Vec<u32>,
}

/// Parsed app info.
#[derive(Debug, Clone)]
pub struct AppInfoData {
    pub app_id: u32,
    pub change_number: u32,
    pub missing_token: bool,
    pub app_info: Option<VdfValue>,
}

/// Parsed package info.
#[derive(Debug, Clone)]
pub struct PackageInfoData {
    pub package_id: u32,
    pub change_number: u32,
    pub missing_token: bool,
    pub package_info: Option<BinaryKvValue>,
}

/// Parsed access tokens response.
#[derive(Debug, Clone)]
pub struct AccessTokensData {
    pub app_tokens: HashMap<u32, u64>,
    pub package_tokens: HashMap<u32, u64>,
    pub app_denied: Vec<u32>,
    pub package_denied: Vec<u32>,
}

/// Parsed PICS changes response.
#[derive(Debug, Clone)]
pub struct ChangesData {
    pub current_change_number: u32,
    pub app_changes: Vec<AppChange>,
    pub package_changes: Vec<PackageChange>,
}

/// Parsed app change entry.
#[derive(Debug, Clone)]
pub struct AppChange {
    pub app_id: u32,
    pub change_number: u32,
    pub needs_token: bool,
}

/// Parsed package change entry.
#[derive(Debug, Clone)]
pub struct PackageChange {
    pub package_id: u32,
    pub change_number: u32,
    pub needs_token: bool,
}

//=============================================================================
// Pure Parsing Functions
//=============================================================================

/// Parse a logon response message.
///
/// # Returns
/// - `Ok(LogonData)` with the steam ID and result on success
/// - `Err(ParseError)` if decoding fails
pub fn parse_logon_response(body: &[u8]) -> Result<LogonData, ParseError> {
    let msg = steam_protos::CMsgClientLogonResponse::decode(body).map_err(|e| ParseError::DecodeError(e.to_string()))?;

    let eresult = EResult::from_i32(msg.eresult.unwrap_or(2)).unwrap_or(EResult::Fail);
    let steam_id = SteamID::from_steam_id64(msg.client_supplied_steamid.unwrap_or(0));

    let public_ip = msg.public_ip.and_then(|ip_msg| match ip_msg.ip {
        Some(steam_protos::cmsg_ip_address::Ip::V4(addr)) => Some(std::net::Ipv4Addr::from(addr.to_be_bytes())),
        _ => None,
    });

    Ok(LogonData {
        steam_id,
        eresult,
        heartbeat_seconds: msg.heartbeat_seconds.unwrap_or(0),
        public_ip,
        vanity_url: msg.vanity_url,
        cell_id: msg.cell_id,
        client_instance_id: msg.client_instance_id,
    })
}

/// Parse a logged off message.
///
/// # Returns
/// - `Ok(EResult)` with the result code
/// - `Err(ParseError)` if decoding fails
pub fn parse_logged_off(body: &[u8]) -> Result<EResult, ParseError> {
    let msg = steam_protos::CMsgClientLoggedOff::decode(body).map_err(|e| ParseError::DecodeError(e.to_string()))?;

    Ok(EResult::from_i32(msg.eresult.unwrap_or(2)).unwrap_or(EResult::Fail))
}

/// Parse a friends list message.
///
/// # Returns
/// - `Ok(FriendsListData)` with the friends list
/// - `Err(ParseError)` if decoding fails
pub fn parse_friends_list(body: &[u8]) -> Result<FriendsListData, ParseError> {
    let msg = steam_protos::CMsgClientFriendsList::decode(body).map_err(|e| ParseError::DecodeError(e.to_string()))?;

    let friends = msg
        .friends
        .iter()
        .map(|f| FriendData {
            steam_id: SteamID::from_steam_id64(f.ulfriendid.unwrap_or(0)),
            relationship: EFriendRelationship::from_i32(f.efriendrelationship.unwrap_or(0) as i32).unwrap_or(EFriendRelationship::None),
        })
        .collect();

    Ok(FriendsListData { incremental: msg.bincremental.unwrap_or(false), friends })
}

/// Parse a persona state message.
///
/// # Returns
/// - `Ok(PersonaData)` with the persona info
/// - `Err(ParseError)` if decoding fails or no persona data present
pub fn parse_persona_state(body: &[u8]) -> Result<PersonaData, ParseError> {
    let msg = steam_protos::CMsgClientPersonaState::decode(body).map_err(|e| ParseError::DecodeError(e.to_string()))?;

    let friend = msg.friends.first().ok_or_else(|| ParseError::MissingField("friends".to_string()))?;

    let rich_presence = friend.rich_presence.iter().map(|rp| (rp.key.clone().unwrap_or_default(), rp.value.clone().unwrap_or_default())).collect();

    Ok(PersonaData {
        steam_id: SteamID::from_steam_id64(friend.friendid.unwrap_or(0)),
        player_name: friend.player_name.clone().unwrap_or_default(),
        persona_state: EPersonaState::from_i32(friend.persona_state.unwrap_or(0) as i32).unwrap_or(EPersonaState::Offline),
        avatar_hash: friend.avatar_hash.as_ref().map(hex::encode),
        game_name: friend.game_name.clone(),
        game_id: friend.gameid,
        last_logoff: friend.last_logoff,
        last_logon: friend.last_logon,
        last_seen_online: friend.last_seen_online,
        game_server_ip: friend.game_server_ip,
        game_server_port: friend.game_server_port,
        rich_presence,
    })
}

/// Parse a license list message.
///
/// # Returns
/// - `Ok(Vec<LicenseData>)` with the license list
/// - `Err(ParseError)` if decoding fails
pub fn parse_license_list(body: &[u8]) -> Result<Vec<LicenseData>, ParseError> {
    let msg = steam_protos::CMsgClientLicenseList::decode(body).map_err(|e| ParseError::DecodeError(e.to_string()))?;

    Ok(msg
        .licenses
        .iter()
        .map(|l| LicenseData {
            package_id: l.package_id.unwrap_or(0),
            time_created: l.time_created.unwrap_or(0),
            license_type: l.license_type.unwrap_or(0),
            flags: l.flags.unwrap_or(0),
            access_token: l.access_token.unwrap_or(0),
        })
        .collect())
}

/// Parse a CM list message.
///
/// # Returns
/// - `Ok(Vec<String>)` with the server addresses
/// - `Err(ParseError)` if decoding fails
pub fn parse_cm_list(body: &[u8]) -> Result<Vec<String>, ParseError> {
    let msg = steam_protos::CMsgClientCMList::decode(body).map_err(|e| ParseError::DecodeError(e.to_string()))?;

    Ok(msg.cm_websocket_addresses)
}

/// Parse a service method message (friend messages/typing).
///
/// # Returns
/// - `Ok(ChatData)` with the chat data
/// - `Err(ParseError)` if decoding fails
pub fn parse_service_method(body: &[u8]) -> Result<ChatData, ParseError> {
    let msg = steam_protos::CFriendMessagesIncomingMessageNotification::decode(body).map_err(|e| ParseError::DecodeError(e.to_string()))?;

    let sender = SteamID::from_steam_id64(msg.steamid_friend.unwrap_or(0));

    if msg.chat_entry_type == Some(EChatEntryType::Typing as i32) {
        Ok(ChatData::Typing { sender })
    } else {
        Ok(ChatData::Message {
            sender,
            message: msg.message.unwrap_or_default(),
            chat_entry_type: EChatEntryType::from_i32(msg.chat_entry_type.unwrap_or(1)).unwrap_or(EChatEntryType::ChatMsg),
            timestamp: msg.rtime32_server_timestamp.unwrap_or(0),
            ordinal: msg.ordinal.unwrap_or(0),
        })
    }
}

/// Parse a PICS product info response.
///
/// # Returns
/// - `Ok(ProductInfoData)` with apps and packages info
/// - `Err(ParseError)` if decoding fails
pub fn parse_pics_product_info(body: &[u8]) -> Result<ProductInfoData, ParseError> {
    let msg = steam_protos::CMsgClientPICSProductInfoResponse::decode(body).map_err(|e| ParseError::DecodeError(e.to_string()))?;

    let mut apps = HashMap::new();
    let mut packages = HashMap::new();

    for app in &msg.apps {
        let app_id = app.appid.unwrap_or(0);
        let app_info = app.buffer.as_ref().and_then(|buf| {
            let text = String::from_utf8_lossy(buf);
            let text = text.trim_end_matches('\0');
            parse_vdf(text).ok().and_then(|v| match v {
                VdfValue::Object(mut map) => map.remove("appinfo").or(Some(VdfValue::Object(map))),
                _ => Some(v),
            })
        });

        apps.insert(
            app_id,
            AppInfoData {
                app_id,
                change_number: app.change_number.unwrap_or(0),
                missing_token: app.missing_token.unwrap_or(false),
                app_info,
            },
        );
    }

    for pkg in &msg.packages {
        let package_id = pkg.packageid.unwrap_or(0);
        let package_info = pkg.buffer.as_ref().and_then(|buf| {
            parse_binary_kv(buf).ok().and_then(|v| match v {
                BinaryKvValue::Object(mut map) => {
                    let pkg_id_str = package_id.to_string();
                    map.remove(&pkg_id_str).or(Some(BinaryKvValue::Object(map)))
                }
                _ => Some(v),
            })
        });

        packages.insert(
            package_id,
            PackageInfoData {
                package_id,
                change_number: pkg.change_number.unwrap_or(0),
                missing_token: pkg.missing_token.unwrap_or(false),
                package_info,
            },
        );
    }

    Ok(ProductInfoData { apps, packages, unknown_apps: msg.unknown_appids.clone(), unknown_packages: msg.unknown_packageids.clone() })
}

/// Parse a PICS access tokens response.
///
/// # Returns
/// - `Ok(AccessTokensData)` with token mappings
/// - `Err(ParseError)` if decoding fails
pub fn parse_pics_access_tokens(body: &[u8]) -> Result<AccessTokensData, ParseError> {
    let msg = steam_protos::CMsgClientPICSAccessTokenResponse::decode(body).map_err(|e| ParseError::DecodeError(e.to_string()))?;

    let mut app_tokens = HashMap::new();
    let mut package_tokens = HashMap::new();

    for token in &msg.app_access_tokens {
        app_tokens.insert(token.appid.unwrap_or(0), token.access_token.unwrap_or(0));
    }

    for token in &msg.package_access_tokens {
        package_tokens.insert(token.packageid.unwrap_or(0), token.access_token.unwrap_or(0));
    }

    Ok(AccessTokensData {
        app_tokens,
        package_tokens,
        app_denied: msg.app_denied_tokens.clone(),
        package_denied: msg.package_denied_tokens.clone(),
    })
}

/// Parse a PICS changes since response.
///
/// # Returns
/// - `Ok(ChangesData)` with change information
/// - `Err(ParseError)` if decoding fails
pub fn parse_pics_changes(body: &[u8]) -> Result<ChangesData, ParseError> {
    let msg = steam_protos::CMsgClientPICSChangesSinceResponse::decode(body).map_err(|e| ParseError::DecodeError(e.to_string()))?;

    let app_changes = msg
        .app_changes
        .iter()
        .map(|c| AppChange {
            app_id: c.appid.unwrap_or(0),
            change_number: c.change_number.unwrap_or(0),
            needs_token: c.needs_token.unwrap_or(false),
        })
        .collect();

    let package_changes = msg
        .package_changes
        .iter()
        .map(|c| PackageChange {
            package_id: c.packageid.unwrap_or(0),
            change_number: c.change_number.unwrap_or(0),
            needs_token: c.needs_token.unwrap_or(false),
        })
        .collect();

    Ok(ChangesData { current_change_number: msg.current_change_number.unwrap_or(0), app_changes, package_changes })
}

#[cfg(test)]
mod tests {
    use super::*;

    //=========================================================================
    // LogonResponse Tests
    //=========================================================================

    #[test]
    fn test_parse_logon_response_success() {
        let msg = steam_protos::CMsgClientLogonResponse {
            eresult: Some(1), // OK
            client_supplied_steamid: Some(76561198000000000),
            ..Default::default()
        };
        let bytes = msg.encode_to_vec();

        let result = parse_logon_response(&bytes).expect("parse failed");
        assert_eq!(result.eresult, EResult::OK);
        assert_eq!(result.steam_id.steam_id64(), 76561198000000000);
    }

    #[test]
    fn test_parse_logon_response_failure() {
        let msg = steam_protos::CMsgClientLogonResponse {
            eresult: Some(5), // InvalidPassword
            ..Default::default()
        };
        let bytes = msg.encode_to_vec();

        let result = parse_logon_response(&bytes).expect("parse failed");
        assert_eq!(result.eresult, EResult::InvalidPassword);
    }

    #[test]
    fn test_parse_logon_response_invalid_bytes() {
        let bytes = vec![0xFF, 0xFF, 0xFF];
        let result = parse_logon_response(&bytes);
        assert!(matches!(result, Err(ParseError::DecodeError(_))));
    }

    //=========================================================================
    // LoggedOff Tests
    //=========================================================================

    #[test]
    fn test_parse_logged_off() {
        let msg = steam_protos::CMsgClientLoggedOff {
            eresult: Some(6), // LoggedInElsewhere
        };
        let bytes = msg.encode_to_vec();

        let result = parse_logged_off(&bytes).expect("parse failed");
        assert_eq!(result, EResult::LoggedInElsewhere);
    }

    //=========================================================================
    // FriendsList Tests
    //=========================================================================

    #[test]
    fn test_parse_friends_list_empty() {
        let msg = steam_protos::CMsgClientFriendsList { bincremental: Some(false), friends: vec![], ..Default::default() };
        let bytes = msg.encode_to_vec();

        let result = parse_friends_list(&bytes).expect("parse failed");
        assert!(!result.incremental);
        assert!(result.friends.is_empty());
    }

    #[test]
    fn test_parse_friends_list_with_friends() {
        let msg = steam_protos::CMsgClientFriendsList {
            bincremental: Some(true),
            friends: vec![
                steam_protos::cmsg_client_friends_list::Friend {
                    ulfriendid: Some(76561198000000001),
                    efriendrelationship: Some(3), // Friend
                },
                steam_protos::cmsg_client_friends_list::Friend {
                    ulfriendid: Some(76561198000000002),
                    efriendrelationship: Some(2), // RequestRecipient
                },
            ],
            ..Default::default()
        };
        let bytes = msg.encode_to_vec();

        let result = parse_friends_list(&bytes).expect("parse failed");
        assert!(result.incremental);
        assert_eq!(result.friends.len(), 2);
        assert_eq!(result.friends[0].steam_id.steam_id64(), 76561198000000001);
    }

    //=========================================================================
    // PersonaState Tests
    //=========================================================================

    #[test]
    fn test_parse_persona_state() {
        let msg = steam_protos::CMsgClientPersonaState {
            friends: vec![steam_protos::cmsg_client_persona_state::Friend {
                friendid: Some(76561198000000000),
                player_name: Some("TestPlayer".to_string()),
                persona_state: Some(1), // Online
                ..Default::default()
            }],
            ..Default::default()
        };
        let bytes = msg.encode_to_vec();

        let result = parse_persona_state(&bytes).expect("parse failed");
        assert_eq!(result.player_name, "TestPlayer");
        assert_eq!(result.persona_state, EPersonaState::Online);
    }

    #[test]
    fn test_parse_persona_state_no_friends() {
        let msg = steam_protos::CMsgClientPersonaState { friends: vec![], ..Default::default() };
        let bytes = msg.encode_to_vec();

        let result = parse_persona_state(&bytes);
        assert!(matches!(result, Err(ParseError::MissingField(_))));
    }

    //=========================================================================
    // LicenseList Tests
    //=========================================================================

    #[test]
    fn test_parse_license_list() {
        let msg = steam_protos::CMsgClientLicenseList {
            licenses: vec![steam_protos::cmsg_client_license_list::License {
                package_id: Some(12345),
                time_created: Some(1600000000),
                license_type: Some(1),
                flags: Some(0),
                access_token: Some(999),
                ..Default::default()
            }],
            ..Default::default()
        };
        let bytes = msg.encode_to_vec();

        let result = parse_license_list(&bytes).expect("parse failed");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].package_id, 12345);
        assert_eq!(result[0].access_token, 999);
    }

    //=========================================================================
    // CMList Tests
    //=========================================================================

    #[test]
    fn test_parse_cm_list() {
        let msg = steam_protos::CMsgClientCMList {
            cm_websocket_addresses: vec!["wss://cm1.steampowered.com".to_string(), "wss://cm2.steampowered.com".to_string()],
            ..Default::default()
        };
        let bytes = msg.encode_to_vec();

        let result = parse_cm_list(&bytes).expect("parse failed");
        assert_eq!(result.len(), 2);
        assert!(result[0].starts_with("wss://"));
    }

    //=========================================================================
    // ServiceMethod (Chat) Tests
    //=========================================================================

    #[test]
    fn test_parse_service_method_message() {
        let msg = steam_protos::CFriendMessagesIncomingMessageNotification {
            steamid_friend: Some(76561198000000000),
            message: Some("Hello!".to_string()),
            chat_entry_type: Some(1), // ChatMsg
            rtime32_server_timestamp: Some(1600000000),
            ordinal: Some(5),
            ..Default::default()
        };
        let bytes = msg.encode_to_vec();

        let result = parse_service_method(&bytes).expect("parse failed");
        match result {
            ChatData::Message { sender, message, timestamp, .. } => {
                assert_eq!(sender.steam_id64(), 76561198000000000);
                assert_eq!(message, "Hello!");
                assert_eq!(timestamp, 1600000000);
            }
            _ => panic!("Expected Message variant"),
        }
    }

    #[test]
    fn test_parse_service_method_typing() {
        let msg = steam_protos::CFriendMessagesIncomingMessageNotification {
            steamid_friend: Some(76561198000000000),
            chat_entry_type: Some(EChatEntryType::Typing as i32),
            ..Default::default()
        };
        let bytes = msg.encode_to_vec();

        let result = parse_service_method(&bytes).expect("parse failed");
        assert!(matches!(result, ChatData::Typing { .. }));
    }

    //=========================================================================
    // PICS Tests
    //=========================================================================

    #[test]
    fn test_parse_pics_access_tokens() {
        let msg = steam_protos::CMsgClientPICSAccessTokenResponse {
            app_access_tokens: vec![steam_protos::cmsg_client_pics_access_token_response::AppToken { appid: Some(440), access_token: Some(123456789) }],
            package_access_tokens: vec![steam_protos::cmsg_client_pics_access_token_response::PackageToken { packageid: Some(550), access_token: Some(987654321) }],
            app_denied_tokens: vec![10],
            package_denied_tokens: vec![20],
        };
        let bytes = msg.encode_to_vec();

        let result = parse_pics_access_tokens(&bytes).expect("parse failed");

        assert_eq!(result.app_tokens.get(&440), Some(&123456789));
        assert_eq!(result.package_tokens.get(&550), Some(&987654321));
        assert_eq!(result.app_denied, vec![10]);
        assert_eq!(result.package_denied, vec![20]);
    }

    #[test]
    fn test_parse_pics_changes() {
        let msg = steam_protos::CMsgClientPICSChangesSinceResponse {
            current_change_number: Some(100),
            app_changes: vec![steam_protos::cmsg_client_pics_changes_since_response::AppChange { appid: Some(440), change_number: Some(99), needs_token: Some(true) }],
            package_changes: vec![steam_protos::cmsg_client_pics_changes_since_response::PackageChange { packageid: Some(550), change_number: Some(98), needs_token: Some(false) }],
            ..Default::default()
        };
        let bytes = msg.encode_to_vec();

        let result = parse_pics_changes(&bytes).expect("parse failed");

        assert_eq!(result.current_change_number, 100);
        assert_eq!(result.app_changes.len(), 1);
        assert_eq!(result.app_changes[0].app_id, 440);
        assert!(result.app_changes[0].needs_token);

        assert_eq!(result.package_changes.len(), 1);
        assert_eq!(result.package_changes[0].package_id, 550);
        assert!(!result.package_changes[0].needs_token);
    }
}
