//! Event system for Steam client.
//!
//! This module provides the event loop for receiving and dispatching Steam
//! messages.
//!
//! Events are categorized by domain for better type safety and cleaner pattern
//! matching:
//! - [`AuthEvent`] - Authentication and login events
//! - [`ConnectionEvent`] - Connection lifecycle events
//! - [`FriendsEvent`] - Friends and social events
//! - [`ChatEvent`] - Chat and messaging events
//! - [`AppsEvent`] - App and game events
//! - [`ContentEvent`] - Content delivery events
//! - [`AccountEvent`] - Account info, limitations, wallet, VAC bans
//! - [`NotificationsEvent`] - Trade offers, offline messages, items, comments
//! - [`SystemEvent`] - Debug and error events

use std::{collections::HashMap, io::Read, sync::Mutex, time::Duration};

use bytes::Bytes;
use chrono::{TimeZone, Utc};
use flate2::read::GzDecoder;
use once_cell::sync::Lazy;
use prost::Message;
use steam_enums::{EChatEntryType, ECsgoGCMsg, EFriendRelationship, EGCBaseClientMsg, EMsg, EPersonaState, EResult};
use steamid::SteamID;
use tracing::{error, info};

use super::steam_client::UserPersona;
pub use crate::utils::parsing::{AppChange, AppInfoData, PackageChange, PackageInfoData};
use crate::{services::gc::GCMessage, utils::parsing};
#[cfg(feature = "static-app-list")]
use crate::client::static_app_list::APP_LIST;

//=============================================================================
// Event Category Enums
//=============================================================================

/// Authentication events.
#[derive(Debug, Clone)]
pub enum AuthEvent {
    /// Client logged on successfully.
    LoggedOn { steam_id: SteamID },

    /// Client was logged off.
    LoggedOff { result: EResult },

    /// Received a new refresh token (from password authentication).
    /// This can be saved and used for future logins without password.
    RefreshToken {
        /// The refresh token.
        token: String,
        /// The account name.
        account_name: String,
    },

    /// Web session established.
    ///
    /// Emitted after successful login when web cookies are available.
    /// These cookies can be used to authenticate with Steam web APIs
    /// (e.g., steamcommunity.com, store.steampowered.com).
    ///
    /// This event is emitted when:
    /// - Login is successful and we have a refresh token that can generate web
    ///   cookies
    /// - The `get_web_session()` method is called explicitly after login
    WebSession {
        /// The session ID cookie value.
        session_id: String,
        /// Cookies in "name=value" format, suitable for HTTP Cookie headers.
        cookies: Vec<String>,
    },

    /// Received game connect tokens.
    GameConnectTokens {
        /// The tokens.
        tokens: Vec<Vec<u8>>,
    },
}

/// Connection lifecycle events.
#[derive(Debug, Clone)]
pub enum ConnectionEvent {
    /// WebSocket connection established.
    Connected,

    /// WebSocket connection closed.
    Disconnected {
        /// The result code indicating why disconnected.
        /// `None` if the connection was closed cleanly without an error.
        reason: Option<EResult>,
        /// Whether reconnection will be attempted.
        will_reconnect: bool,
    },

    /// Client is attempting to reconnect after a disconnection.
    ReconnectAttempt {
        /// Current attempt number (1-indexed).
        attempt: u32,
        /// Maximum attempts configured.
        max_attempts: u32,
        /// Delay before this attempt was made.
        delay: Duration,
    },

    /// Reconnection has permanently failed after max attempts.
    ReconnectFailed {
        /// Original disconnect reason.
        reason: Option<EResult>,
        /// Number of attempts made.
        attempts: u32,
    },

    /// Received CM server list.
    CMList { servers: Vec<String> },
}

/// Friends and social events.
#[derive(Debug, Clone)]
pub enum FriendsEvent {
    /// Received friend list.
    FriendsList { incremental: bool, friends: Vec<FriendEntry> },

    /// A friend's persona state changed.
    PersonaState(Box<UserPersona>),

    /// Friend relationship changed.
    FriendRelationship { steam_id: SteamID, relationship: EFriendRelationship },

    /// A friend's nickname was changed.
    NicknameChanged { steam_id: SteamID, nickname: Option<String> },
}

/// Chat and messaging events.
#[derive(Debug, Clone)]
pub enum ChatEvent {
    /// Received a friend message.
    FriendMessage {
        sender: SteamID,
        message: String,
        chat_entry_type: EChatEntryType,
        timestamp: u32,
        ordinal: u32,
        /// Whether the message is from a limited account.
        from_limited_account: bool,
        /// Whether this is a low priority message.
        low_priority: bool,
    },

    /// Echo of a message we sent (received when local_echo is true).
    FriendMessageEcho { receiver: SteamID, message: String, timestamp: u32, ordinal: u32 },

    /// Friend typing indicator.
    FriendTyping { sender: SteamID },

    /// Echo of our own typing indicator.
    FriendTypingEcho { receiver: SteamID },

    /// Friend left the conversation.
    FriendLeftConversation { sender: SteamID },

    /// Echo of us leaving the conversation.
    FriendLeftConversationEcho { receiver: SteamID },

    /// Received a group chat message.
    ChatMessage {
        chat_group_id: u64,
        chat_id: u64,
        sender: SteamID,
        message: String,
        timestamp: u32,
        ordinal: u32,
        // Mentions and server messages could be added here in the future
    },

    /// A member's state in a chat room group changed.
    ChatMemberStateChange {
        chat_group_id: u64,
        steam_id: SteamID,
        change: i32, // EChatRoomMemberStateChange
    },

    /// Rooms in a chat room group changed.
    ChatRoomGroupRoomsChange { chat_group_id: u64, default_chat_id: u64, chat_rooms: Vec<ChatRoomState> },

    /// Chat messages in a room were modified (e.g. deleted).
    ChatMessagesModified { chat_group_id: u64, chat_id: u64, messages: Vec<ModifiedChatMessage> },

    /// A chat room group's header state changed.
    ChatRoomGroupHeaderStateChange { chat_group_id: u64, header_state: ChatRoomGroupHeaderState },

    /// Fetched offline messages history.
    OfflineMessagesFetched { friend_id: SteamID, messages: Vec<crate::services::chat::HistoryMessage> },
}

/// App and game events.
#[derive(Debug, Clone)]
pub enum AppsEvent {
    /// Received licenses list.
    LicenseList { licenses: Vec<LicenseEntry> },

    /// PICS product info response.
    ProductInfoResponse {
        /// App info data keyed by app ID.
        apps: HashMap<u32, AppInfoData>,
        /// Package info data keyed by package ID.
        packages: HashMap<u32, PackageInfoData>,
        /// Unknown/unavailable app IDs.
        unknown_apps: Vec<u32>,
        /// Unknown/unavailable package IDs.
        unknown_packages: Vec<u32>,
    },

    /// PICS access tokens response.
    AccessTokensResponse {
        /// App access tokens keyed by app ID.
        app_tokens: HashMap<u32, u64>,
        /// Package access tokens keyed by package ID.
        package_tokens: HashMap<u32, u64>,
        /// App IDs for which tokens were denied.
        app_denied: Vec<u32>,
        /// Package IDs for which tokens were denied.
        package_denied: Vec<u32>,
    },

    /// PICS product changes response.
    ProductChangesResponse {
        /// Current change number.
        current_change_number: u32,
        /// App IDs that have changed.
        app_changes: Vec<AppChange>,
        /// Package IDs that have changed.
        package_changes: Vec<PackageChange>,
    },

    /// Received a Game Coordinator message.
    GCReceived(GCMessage),

    /// Playing session state changed.
    ///
    /// Emitted when:
    /// - Right after logon, only if a game is being played elsewhere (blocked
    ///   is true)
    /// - Whenever a game starts/stops being played on another session
    /// - Whenever you start/stop playing a game on this session
    PlayingState {
        /// True if playing is blocked because this account is playing a game in
        /// another location
        blocked: bool,
        /// The app ID currently being played (elsewhere if blocked, or by this
        /// session if not)
        playing_app: u32,
    },
}

/// CS:GO specific events.
#[derive(Debug, Clone)]
pub enum CSGOEvent {
    /// CS:GO/CS2 Online event (Welcome message).
    ///
    /// Emitted when the CS:GO Game Coordinator sends a welcome message,
    /// indicating the client is "online" in CS:GO/CS2.
    Online(CsgoWelcome),

    /// CS:GO/CS2 Client Hello event.
    ///
    /// Emitted when the CS:GO Game Coordinator sends a client hello response,
    /// containing player profile data (rank, level, commendations, etc.).
    ClientHello(CsgoClientHello),

    /// CS:GO/CS2 Players Profile event.
    ///
    /// Emitted when the CS:GO Game Coordinator sends a players profile
    /// response, usually after a `ClientRequestPlayersProfile` message.
    PlayersProfile(Vec<CsgoClientHello>),

    /// Received a party invite.
    PartyInvite { inviter: SteamID, lobby_id: u64 },
    /// Received party search results.
    PartySearchResults(Vec<CsgoPartyEntry>),
}

#[derive(Debug, Clone)]
pub struct CsgoPartyEntry {
    pub account_id: u32,
    pub lobby_id: u32,
    pub game_type: u32,
    pub loc: u32,
}

/// Content delivery events.
#[derive(Debug, Clone)]
pub enum ContentEvent {
    /// Received rich presence info for users.
    RichPresence {
        /// The app ID.
        appid: u32,
        /// Rich presence data for each user.
        users: Vec<crate::services::rich_presence::RichPresenceData>,
    },
}

/// System/debug events.
#[derive(Debug, Clone)]
pub enum SystemEvent {
    /// Debug/log message.
    Debug(String),

    /// Error occurred.
    Error(String),
}

/// Account events (email, limitations, wallet, VAC).
#[derive(Debug, Clone)]
pub enum AccountEvent {
    /// Email address information.
    EmailInfo {
        /// The email address associated with this account.
        address: String,
        /// Whether the email has been validated.
        validated: bool,
    },

    /// Account limitations status.
    AccountLimitations {
        /// Whether this is a limited account.
        limited: bool,
        /// Whether the account is community banned.
        community_banned: bool,
        /// Whether the account is locked.
        locked: bool,
        /// Whether the account can invite friends.
        can_invite_friends: bool,
    },

    /// Wallet balance update.
    Wallet {
        /// Whether the account has a wallet.
        has_wallet: bool,
        /// Currency code.
        currency: i32,
        /// Balance in cents.
        balance: i64,
    },

    /// VAC ban status.
    VacBans {
        /// Number of VAC bans.
        num_bans: u32,
        /// App IDs from which the account is banned.
        appids: Vec<u32>,
    },

    /// Account info update.
    AccountInfo {
        /// Persona name.
        name: String,
        /// Country code.
        country: String,
        /// Number of authorized machines.
        authed_machines: u32,
        /// Account flags.
        flags: u32,
    },
}

/// Notification events (trade offers, messages, items, comments).
#[derive(Debug, Clone)]
pub enum NotificationsEvent {
    /// Trade offers notification.
    TradeOffers {
        /// Number of pending trade offers.
        count: u32,
    },

    /// Offline messages notification.
    OfflineMessages {
        /// Number of offline messages.
        count: u32,
        /// Friends who have sent offline messages.
        friends: Vec<SteamID>,
    },

    /// New items notification.
    NewItems {
        /// Number of new items.
        count: u32,
    },

    /// New comments notification.
    NewComments {
        /// Total new comments.
        count: u32,
        /// Comments on your items.
        owner_comments: u32,
        /// Comments in subscribed discussions.
        subscription_comments: u32,
    },

    /// Community messages (moderator messages).
    CommunityMessages {
        /// Number of unread community messages.
        count: u32,
    },

    /// Notifications received.
    NotificationsReceived(Vec<NotificationData>),
}

//=============================================================================
// Top-Level Event Enum
//=============================================================================

/// Steam client events, categorized by domain.
///
/// # Example
/// ```rust,ignore
/// match event {
///     SteamEvent::Auth(auth) => match auth {
///         AuthEvent::LoggedOn { steam_id } => println!("Logged in as {}", steam_id),
///         AuthEvent::LoggedOff { result } => println!("Logged off: {:?}", result),
///         _ => {}
///     },
///     SteamEvent::Chat(chat) => match chat {
///         ChatEvent::FriendMessage { sender, message, .. } => {
///             println!("{}: {}", sender, message);
///         }
///         _ => {}
///     },
///     // Ignore other categories
///     _ => {}
/// }
/// ```
#[derive(Debug, Clone)]
pub enum SteamEvent {
    /// Authentication events (login, logout, tokens).
    Auth(AuthEvent),

    /// Connection lifecycle (connect, disconnect, reconnect).
    Connection(ConnectionEvent),

    /// Friends and social (friends list, personas).
    Friends(FriendsEvent),

    /// Chat and messaging (friend messages, typing).
    Chat(ChatEvent),

    /// Apps and games (licenses, product info, GC).
    Apps(AppsEvent),

    /// CS:GO specific events.
    CSGO(CSGOEvent),

    /// Content delivery (rich presence).
    Content(ContentEvent),

    /// Account events (email, limitations, wallet, VAC).
    Account(AccountEvent),

    /// Notification events (trade offers, messages, items).
    Notifications(NotificationsEvent),

    /// System events (debug, errors).
    System(SystemEvent),
}

//=============================================================================
// Helper Methods for SteamEvent
//=============================================================================

impl SteamEvent {
    /// Check if this is an authentication event.
    pub fn is_auth(&self) -> bool {
        matches!(self, SteamEvent::Auth(_))
    }

    /// Check if this is a connection event.
    pub fn is_connection(&self) -> bool {
        matches!(self, SteamEvent::Connection(_))
    }

    /// Check if this is a friends event.
    pub fn is_friends(&self) -> bool {
        matches!(self, SteamEvent::Friends(_))
    }

    /// Check if this is a chat event.
    pub fn is_chat(&self) -> bool {
        matches!(self, SteamEvent::Chat(_))
    }

    /// Check if this is an apps event.
    pub fn is_apps(&self) -> bool {
        matches!(self, SteamEvent::Apps(_))
    }

    /// Check if this is a content event.
    pub fn is_content(&self) -> bool {
        matches!(self, SteamEvent::Content(_))
    }

    /// Check if this is a system event.
    pub fn is_system(&self) -> bool {
        matches!(self, SteamEvent::System(_))
    }

    /// Check if this is an account event.
    pub fn is_account(&self) -> bool {
        matches!(self, SteamEvent::Account(_))
    }

    /// Check if this is a notifications event.
    pub fn is_notifications(&self) -> bool {
        matches!(self, SteamEvent::Notifications(_))
    }

    /// Check if this is a CS:GO event.
    pub fn is_csgo(&self) -> bool {
        matches!(self, SteamEvent::CSGO(_))
    }

    /// Get the sender SteamID if this is a chat message.
    pub fn chat_sender(&self) -> Option<SteamID> {
        match self {
            SteamEvent::Chat(ChatEvent::FriendMessage { sender, .. }) => Some(*sender),
            SteamEvent::Chat(ChatEvent::FriendTyping { sender }) => Some(*sender),
            _ => None,
        }
    }
}

//=============================================================================
// Data Structures
//=============================================================================

/// Friend entry from friends list.
#[derive(Debug, Clone)]
pub struct FriendEntry {
    pub steam_id: SteamID,
    pub relationship: EFriendRelationship,
}

/// License entry.
#[derive(Debug, Clone, Default)]
pub struct LicenseEntry {
    pub package_id: u32,
    pub time_created: u32,
    pub time_next_process: u32,
    pub minute_limit: i32,
    pub minutes_used: i32,
    pub payment_method: u32,
    pub flags: u32,
    pub purchase_country_code: String,
    pub license_type: u32,
    pub territory_code: i32,
    pub change_number: i32,
    pub owner_id: u32,
    pub initial_period: u32,
    pub initial_time_unit: u32,
    pub renewal_period: u32,
    pub renewal_time_unit: u32,
    pub access_token: u64,
    pub master_package_id: u32,
}

/// CS:GO Welcome data.
#[derive(Debug, Clone)]
pub struct CsgoWelcome {
    /// Whether the account has Prime status.
    pub prime: bool,
    /// Elevated state (5 = bought prime).
    pub elevated_state: u32,
    /// Bonus XP used flags (16 = prestige earned/prime).
    pub bonus_xp_usedflags: u32,
    /// Inventory items.
    pub items: Vec<steam_protos::CSOEconItem>,
}

/// CS:GO Client Hello data (GC message 9110 response).
#[derive(Debug, Clone)]
pub struct CsgoClientHello {
    /// The account ID.
    pub account_id: u32,
    /// Whether the account is VAC banned (0 = not banned).
    pub vac_banned: i32,
    /// Penalty cooldown seconds remaining.
    pub penalty_seconds: u32,
    /// Penalty reason code.
    pub penalty_reason: u32,
    /// Player CS:GO profile level.
    pub player_level: i32,
    /// Player current XP (subtract 327680000 for actual XP).
    pub player_cur_xp: i32,
    /// Player XP bonus flags.
    pub player_xp_bonus_flags: i32,
    /// Competitive ranking info.
    pub ranking: Option<CsgoRanking>,
    /// Player commendation counts.
    pub commendation: Option<CsgoCommendation>,
    /// Global statistics (players online, servers online, etc.).
    pub players_online: u32,
    pub servers_online: u32,
    pub ongoing_matches: u32,
}

/// CS:GO player ranking information.
#[derive(Debug, Clone)]
pub struct CsgoRanking {
    /// Rank ID (1-18 for competitive, higher for Premier).
    pub rank_id: u32,
    /// Number of competitive wins.
    pub wins: u32,
    /// Rank type (6 = competitive, 7 = wingman, 10 = danger zone, 11 =
    /// premier).
    pub rank_type_id: u32,
}

/// CS:GO player commendation counts.
#[derive(Debug, Clone)]
pub struct CsgoCommendation {
    /// Friendly commendations.
    pub cmd_friendly: u32,
    /// Teaching commendations.
    pub cmd_teaching: u32,
    /// Leader commendations.
    pub cmd_leader: u32,
}

/// Chat room state.
#[derive(Debug, Clone)]
pub struct ChatRoomState {
    pub chat_id: u64,
    pub chat_name: String,
    pub voice_allowed: bool,
    pub members_in_voice: Vec<SteamID>,
    pub time_last_message: u32,
    pub last_message: String,
    pub steamid_last_message: SteamID,
}

/// A modified chat message.
#[derive(Debug, Clone)]
pub struct ModifiedChatMessage {
    pub server_timestamp: u32,
    pub ordinal: u32,
    pub deleted: bool,
}

/// Chat room group header state.
#[derive(Debug, Clone)]
pub struct ChatRoomGroupHeaderState {
    pub name: String,
    pub steamid_owner: SteamID,
    pub appid: Option<u32>,
    pub steamid_clan: Option<SteamID>,
    pub avatar_sha: Vec<u8>,
    pub default_chat_id: u64,
}

/// Notification data.
#[derive(Debug, Clone)]
pub struct NotificationData {
    pub id: u64,
    pub notification_type: i32,
    pub body_data: String,
    pub read: bool,
    pub timestamp: u32,
    pub hidden: bool,
    pub expiry: Option<u32>,
    pub viewed: Option<u32>,
}

//=============================================================================
// Message Handler
//=============================================================================

/// Message handler that decodes and dispatches Steam messages.
pub struct MessageHandler;

/// Decoded message with job information for request-response correlation.
#[derive(Debug)]
pub struct DecodedMessage {
    /// Event(s) decoded from the message.
    pub events: Vec<SteamEvent>,
    /// Job ID target from the header (if this is a response to a tracked
    /// request).
    pub job_id_target: Option<u64>,
    /// Raw body bytes for job completion (zero-copy).
    pub body: Bytes,
}

impl MessageHandler {
    /// Decode a raw message and return events.
    ///
    /// For Multi messages, this returns multiple events from the contained
    /// sub-messages.
    pub fn decode_message(data: &[u8]) -> Vec<SteamEvent> {
        Self::decode_packet(data).into_iter().flat_map(|m| m.events).collect()
    }

    /// Decode a raw packet and return a list of decoded messages.
    ///
    /// This handles both single messages and Multi messages (which expand into
    /// multiple messages). Each returned `DecodedMessage` preserves its own
    /// events and job ID target.
    pub fn decode_packet(data: &[u8]) -> Vec<DecodedMessage> {
        if data.len() < 8 {
            return vec![];
        }

        // Read raw EMsg (first 4 bytes, little-endian)
        let raw_emsg = u32::from_le_bytes([data[0], data[1], data[2], data[3]]);
        let is_protobuf = (raw_emsg & 0x80000000) != 0;
        let emsg = raw_emsg & !0x80000000;
        let emsg_type = EMsg::from_i32((raw_emsg & !0x80000000) as i32).unwrap_or(EMsg::Invalid);

        if is_protobuf {
            Self::decode_protobuf_message_with_job(emsg_type, emsg, &data[4..])
        } else {
            vec![DecodedMessage { events: Self::decode_extended_message(emsg_type, &data[4..]), job_id_target: None, body: Bytes::new() }]
        }
    }

    /// Legacy alias for decode_packet, kept for compatibility if needed but
    /// returns single struct (incorrect for Multi).
    ///
    /// Deprecated: Use `decode_packet` instead.
    pub fn decode_message_with_job(data: &[u8]) -> DecodedMessage {
        // This is lossy for Multi messages as it flattens everything into one
        // DecodedMessage and loses sub-message job IDs. It's kept temporarily.
        let mut messages = Self::decode_packet(data);
        if messages.is_empty() {
            return DecodedMessage { events: vec![], job_id_target: None, body: Bytes::new() };
        }

        if messages.len() == 1 {
            return messages.pop().expect("Messages should not be empty if pop returned None here");
        }

        // Flatten multiple messages into one
        let mut all_events = Vec::new();
        for msg in messages {
            all_events.extend(msg.events);
        }

        DecodedMessage {
            events: all_events,
            job_id_target: None, // Lost for Multi
            body: Bytes::new(),
        }
    }

    /// Decode a single message and return a single event (legacy API).
    pub fn decode_single(data: &[u8]) -> Option<SteamEvent> {
        Self::decode_message(data).into_iter().next()
    }

    /// Decode a protobuf message.
    #[allow(dead_code)]
    fn decode_protobuf_message(emsg: EMsg, raw_emsg: u32, data: &[u8]) -> Vec<SteamEvent> {
        Self::decode_packet_protobuf(emsg, raw_emsg, data).into_iter().flat_map(|m| m.events).collect()
    }

    /// Decode a protobuf packet (internal helper).
    fn decode_protobuf_message_with_job(emsg: EMsg, raw_emsg: u32, data: &[u8]) -> Vec<DecodedMessage> {
        Self::decode_packet_protobuf(emsg, raw_emsg, data)
    }

    /// Decode a protobuf packet.
    fn decode_packet_protobuf(emsg: EMsg, raw_emsg: u32, data: &[u8]) -> Vec<DecodedMessage> {
        use prost::Message as _;

        use crate::protocol::header::CMsgProtoBufHeader;

        if data.len() < 4 {
            return vec![];
        }

        // Read header length
        let header_len = u32::from_le_bytes([data[0], data[1], data[2], data[3]]) as usize;

        if data.len() < 4 + header_len {
            return vec![];
        }

        // Parse header to extract job_id_target and target_job_name
        let header_bytes = &data[4..4 + header_len];
        let parsed_header = CMsgProtoBufHeader::decode(header_bytes).ok();

        let job_id_target = parsed_header.as_ref().and_then(|h| h.jobid_target).filter(|&id| id != u64::MAX);

        // Extract target_job_name for ServiceMethod routing
        let target_job_name = parsed_header.as_ref().and_then(|h| h.target_job_name.clone());

        // Get body
        let body_slice = &data[4 + header_len..];

        // Handle Multi specially as it returns multiple messages
        if emsg == EMsg::Multi {
            return Self::handle_multi(body_slice);
        }

        let body_bytes = Bytes::copy_from_slice(body_slice);

        let events = match emsg {
            EMsg::ClientLogOnResponse => Self::handle_logon_response(body_slice).into_iter().collect(),
            EMsg::ClientLoggedOff => Self::handle_logged_off(body_slice).into_iter().collect(),
            EMsg::ClientFriendsList => {
                info!("[MessageHandler] Received EMsg::ClientFriendsList packet, body size: {} bytes", body_slice.len());
                Self::handle_friends_list(body_slice).into_iter().collect()
            }
            EMsg::ClientPersonaState => Self::handle_persona_state(body_slice),
            EMsg::ClientLicenseList => Self::handle_license_list(body_slice).into_iter().collect(),
            EMsg::ClientCMList => Self::handle_cm_list(body_slice).into_iter().collect(),
            EMsg::ClientFromGC => Self::handle_from_gc(body_slice).into_iter().collect(),
            EMsg::ServiceMethod => {
                // Route by target_job_name for proper service method handling
                if let Some(ref job_name) = target_job_name {
                    Self::handle_service_method_by_name(job_name, body_slice).into_iter().collect()
                } else {
                    // Fallback to legacy handling if no job name
                    Self::handle_service_method_legacy(body_slice).into_iter().collect()
                }
            }
            EMsg::ClientPICSProductInfoResponse => Self::handle_pics_product_info(body_slice).into_iter().collect(),
            EMsg::ClientPICSAccessTokenResponse => Self::handle_pics_access_tokens(body_slice).into_iter().collect(),
            EMsg::ClientPICSChangesSinceResponse => Self::handle_pics_changes(body_slice).into_iter().collect(),
            // Account events
            EMsg::ClientEmailAddrInfo => Self::handle_email_info(body_slice).into_iter().collect(),
            EMsg::ClientIsLimitedAccount => Self::handle_account_limitations(body_slice).into_iter().collect(),
            EMsg::ClientWalletInfoUpdate => Self::handle_wallet_info(body_slice).into_iter().collect(),
            EMsg::ClientAccountInfo => Self::handle_account_info(body_slice).into_iter().collect(),
            EMsg::ClientGameConnectTokens => Self::handle_game_connect_tokens(body_slice).into_iter().collect(),
            // Notification events
            EMsg::ClientUserNotifications => Self::handle_user_notifications(body_slice).into_iter().collect(),
            EMsg::ClientChatOfflineMessageNotification => Self::handle_offline_messages(body_slice).into_iter().collect(),
            EMsg::ClientItemAnnouncements => Self::handle_item_announcements(body_slice).into_iter().collect(),
            EMsg::ClientCommentNotifications => Self::handle_comment_notifications(body_slice).into_iter().collect(),
            EMsg::ClientMMSInviteToLobby => Self::handle_mms_invite(body_slice).into_iter().collect(),
            // Playing session state (blocked by another session)
            EMsg::ClientPlayingSessionState => Self::handle_playing_session_state(body_slice).into_iter().collect(),
            // Messages that are handled internally or can be safely ignored
            // These are common messages that don't need to emit events
            EMsg::ClientFriendsGroupsList | EMsg::ClientVACBanStatus | EMsg::ClientSessionToken | EMsg::ClientServerList | EMsg::ServiceMethodResponse | EMsg::ClientMarketingMessageUpdate2 => {
                // Silently ignore - these are either handled internally or not needed
                vec![]
            }
            // Response messages complete jobs via job_id_target - no event needed
            // For truly unknown messages, log them for debugging
            _ => {
                if emsg == EMsg::Invalid {
                    // Unknown message ID - worth logging for debugging
                    vec![SteamEvent::System(SystemEvent::Debug(format!("Unknown EMsg ID: {}", raw_emsg)))]
                } else {
                    // Known message type but unhandled - silently ignore in production
                    // Uncomment the following for debugging new message types:
                    // vec![SteamEvent::System(SystemEvent::Debug(format!(
                    //     "Unhandled message: {:?}",
                    //     emsg
                    // )))]
                    vec![]
                }
            }
        };

        vec![DecodedMessage { events, job_id_target, body: body_bytes }]
    }

    /// Decode an extended (non-protobuf) message.
    fn decode_extended_message(emsg: EMsg, _data: &[u8]) -> Vec<SteamEvent> {
        vec![SteamEvent::System(SystemEvent::Debug(format!("Unhandled extended message: {:?}", emsg)))]
    }

    /// Handle Multi message - contains multiple sub-messages, optionally gzip
    /// compressed.
    ///
    /// For better performance, sub-messages are processed in parallel using
    /// rayon when there are 4 or more sub-messages.
    fn handle_multi(body: &[u8]) -> Vec<DecodedMessage> {
        use rayon::prelude::*;

        if let Ok(msg) = steam_protos::CMsgMulti::decode(body) {
            let message_body = match msg.message_body {
                Some(body) => body,
                None => return vec![],
            };

            let payload = if msg.size_unzipped.unwrap_or(0) > 0 {
                // Gzip compressed - decompress with pre-allocated buffer
                match Self::decompress_gzip(&message_body, msg.size_unzipped.unwrap_or(4096) as usize) {
                    Ok(decompressed) => decompressed,
                    Err(e) => {
                        // Return error event wrapped in DecodedMessage
                        return vec![DecodedMessage {
                            events: vec![SteamEvent::System(SystemEvent::Error(format!("Failed to decompress Multi: {}", e)))],
                            job_id_target: None,
                            body: Bytes::new(),
                        }];
                    }
                }
            } else {
                // Not compressed
                message_body
            };

            // Extract sub-message positions first (offset, size)
            let mut sub_messages: Vec<(usize, usize)> = Vec::new();
            let mut offset = 0;

            while offset + 4 <= payload.len() {
                let sub_size = u32::from_le_bytes([payload[offset], payload[offset + 1], payload[offset + 2], payload[offset + 3]]) as usize;
                offset += 4;

                if offset + sub_size > payload.len() {
                    break;
                }

                sub_messages.push((offset, sub_size));
                offset += sub_size;
            }

            // Process sub-messages: use parallel processing for 4+ messages
            if sub_messages.len() >= 4 {
                // Parallel processing with rayon
                return sub_messages
                    .par_iter()
                    .flat_map(|&(start, size)| {
                        let sub_msg = &payload[start..start + size];
                        Self::decode_packet(sub_msg)
                    })
                    .collect();
            } else {
                // Sequential processing for small batches
                return sub_messages
                    .iter()
                    .flat_map(|&(start, size)| {
                        let sub_msg = &payload[start..start + size];
                        Self::decode_packet(sub_msg)
                    })
                    .collect();
            }
        }
        vec![]
    }

    /// Decompress gzip data with optional capacity hint for pre-allocation.
    fn decompress_gzip(data: &[u8], capacity_hint: usize) -> Result<Vec<u8>, std::io::Error> {
        let mut decoder = GzDecoder::new(data);
        let mut decompressed = Vec::with_capacity(capacity_hint);
        decoder.read_to_end(&mut decompressed)?;
        Ok(decompressed)
    }

    fn handle_logon_response(body: &[u8]) -> Option<SteamEvent> {
        use crate::utils::parsing::parse_logon_response;

        match parse_logon_response(body) {
            Ok(data) => {
                if data.eresult == EResult::OK {
                    Some(SteamEvent::Auth(AuthEvent::LoggedOn { steam_id: data.steam_id }))
                } else {
                    // Login failed
                    Some(SteamEvent::Auth(AuthEvent::LoggedOff { result: data.eresult }))
                }
            }
            Err(e) => Some(SteamEvent::System(SystemEvent::Error(format!("Failed to parse logon response: {}", e)))),
        }
    }

    fn handle_logged_off(body: &[u8]) -> Option<SteamEvent> {
        use crate::utils::parsing::parse_logged_off;

        match parse_logged_off(body) {
            Ok(result) => Some(SteamEvent::Auth(AuthEvent::LoggedOff { result })),
            Err(e) => Some(SteamEvent::System(SystemEvent::Error(format!("Failed to parse logged off message: {}", e)))),
        }
    }

    fn handle_friends_list(body: &[u8]) -> Option<SteamEvent> {
        use crate::utils::parsing::parse_friends_list;

        match parse_friends_list(body) {
            Ok(data) => {
                info!("Received FriendsList event: incremental={}, count={}", data.incremental, data.friends.len());
                Some(SteamEvent::Friends(FriendsEvent::FriendsList {
                    incremental: data.incremental,
                    friends: data.friends.into_iter().map(|f| FriendEntry { steam_id: f.steam_id, relationship: f.relationship }).collect(),
                }))
            }
            Err(e) => {
                error!("Failed to parse friends list: {}", e);
                Some(SteamEvent::System(SystemEvent::Error(format!("Failed to parse friends list: {}", e))))
            }
        }
    }

    fn resolve_game_name(game_id: Option<u64>) -> Option<String> {
        // Static cache for game names to avoid repeated binary searches
        static GAME_NAME_CACHE: Lazy<Mutex<HashMap<u32, String>>> = Lazy::new(|| Mutex::new(HashMap::new()));

        // Try to resolve game name from static list if possible
        // The network often returns empty game_name even when gameid is present
        if let Some(game_id) = game_id {
            if game_id > 0 {
                // AppIDs are u32, safely cast
                let id_u32 = game_id as u32;

                // Check cache first
                if let Ok(cache) = GAME_NAME_CACHE.lock() {
                    if let Some(name) = cache.get(&id_u32) {
                        return Some(name.clone());
                    }
                }

                // Not in cache, lookup in bundled static list (feature-gated).
                #[cfg(feature = "static-app-list")]
                {
                    if let Ok(idx) = APP_LIST.binary_search_by_key(&id_u32, |&(id, _)| id) {
                        let name = APP_LIST[idx].1.to_string();

                        // Update cache
                        if let Ok(mut cache) = GAME_NAME_CACHE.lock() {
                            cache.insert(id_u32, name.clone());
                        }

                        return Some(name);
                    }
                }
                // Reference `id_u32` so the binding isn't unused without the feature.
                let _ = id_u32;
            }
        }
        None
    }

    fn handle_persona_state(body: &[u8]) -> Vec<SteamEvent> {
        if let Ok(msg) = steam_protos::CMsgClientPersonaState::decode(body) {
            return msg
                .friends
                .into_iter()
                .map(|friend| {
                    let mut avatar_hash = friend.avatar_hash.as_ref().map(hex::encode);

                    // Handle default/empty avatar hash (all zeros)
                    if let Some(ref hash) = avatar_hash {
                        if hash == "0000000000000000000000000000000000000000" {
                            avatar_hash = Some("fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb".to_string());
                        }
                    }

                    let rich_presence: HashMap<String, String> = friend
                        .rich_presence
                        .into_iter()
                        .filter_map(|kv| {
                            let key = kv.key?;
                            let value = kv.value?;
                            Some((key, value))
                        })
                        .collect();

                    // Extract steam_player_group from rich presence (lobby/party ID)
                    let steam_player_group = rich_presence.get("steam_player_group").filter(|s| s.as_str() != "0").cloned();
                    // Extract status from rich presence
                    let rich_presence_status = rich_presence.get("status").cloned();
                    // Extract match map from rich presence
                    let game_map = rich_presence.get("game:map").cloned();
                    // Extract game score from rich presence
                    let game_score = rich_presence.get("game:score").cloned();
                    // Extract num_players from rich presence
                    let num_players = rich_presence.get("members:numPlayers").and_then(|s| s.parse::<u32>().ok());

                    SteamEvent::Friends(FriendsEvent::PersonaState(Box::new(UserPersona {
                        steam_id: SteamID::from(friend.friendid.unwrap_or(0)),
                        player_name: friend.player_name.clone().unwrap_or_default(),
                        persona_state: EPersonaState::from_i32(friend.persona_state.unwrap_or(0) as i32).unwrap_or(EPersonaState::Offline),
                        persona_state_flags: friend.persona_state_flags.unwrap_or(0),
                        avatar_hash,
                        // Prefer gameid (64-bit), fall back to game_played_app_id (32-bit)
                        // Steam may send either depending on the game type
                        game_id: friend.gameid.or_else(|| friend.game_played_app_id.map(|id| id as u64)),
                        game_name: Self::resolve_game_name(friend.gameid.or_else(|| friend.game_played_app_id.map(|id| id as u64))),
                        last_logon: friend.last_logon.and_then(|ts| Utc.timestamp_opt(ts as i64, 0).single()),
                        last_logoff: friend.last_logoff.and_then(|ts| Utc.timestamp_opt(ts as i64, 0).single()),
                        last_seen_online: friend.last_seen_online.and_then(|ts| Utc.timestamp_opt(ts as i64, 0).single()),
                        rich_presence,
                        steam_player_group,
                        rich_presence_status,
                        game_map,
                        game_score,
                        num_players,
                        unread_count: 0,
                        last_message_time: 0,
                    })))
                })
                .collect();
        }
        vec![]
    }

    fn handle_license_list(body: &[u8]) -> Option<SteamEvent> {
        if let Ok(msg) = steam_protos::CMsgClientLicenseList::decode(body) {
            let licenses: Vec<LicenseEntry> = msg
                .licenses
                .iter()
                .map(|l| LicenseEntry {
                    package_id: l.package_id.unwrap_or(0),
                    time_created: l.time_created.unwrap_or(0),
                    time_next_process: l.time_next_process.unwrap_or(0),
                    minute_limit: l.minute_limit.unwrap_or(0),
                    minutes_used: l.minutes_used.unwrap_or(0),
                    payment_method: l.payment_method.unwrap_or(0),
                    flags: l.flags.unwrap_or(0),
                    purchase_country_code: l.purchase_country_code.clone().unwrap_or_default(),
                    license_type: l.license_type.unwrap_or(0),
                    territory_code: l.territory_code.unwrap_or(0),
                    change_number: l.change_number.unwrap_or(0),
                    owner_id: l.owner_id.unwrap_or(0),
                    initial_period: l.initial_period.unwrap_or(0),
                    initial_time_unit: l.initial_time_unit.unwrap_or(0),
                    renewal_period: l.renewal_period.unwrap_or(0),
                    renewal_time_unit: l.renewal_time_unit.unwrap_or(0),
                    access_token: l.access_token.unwrap_or(0),
                    master_package_id: l.master_package_id.unwrap_or(0),
                })
                .collect();

            return Some(SteamEvent::Apps(AppsEvent::LicenseList { licenses }));
        }
        None
    }

    /// Echo of our own typing indicator.
    fn handle_friend_typing_echo(body: &[u8]) -> Option<SteamEvent> {
        if let Ok(msg) = steam_protos::CFriendMessagesAckMessageNotification::decode(body) {
            if let Some(steamid) = msg.steamid_partner {
                return Some(SteamEvent::Chat(ChatEvent::FriendTypingEcho { receiver: SteamID::from(steamid) }));
            }
        }
        None
    }

    fn handle_chatroom_notification(job_name: &str, body: &[u8]) -> Option<SteamEvent> {
        match job_name {
            "ChatRoomClient.NotifyIncomingChatMessage#1" => {
                if let Ok(msg) = steam_protos::CChatRoomIncomingChatMessageNotification::decode(body) {
                    return Some(SteamEvent::Chat(ChatEvent::ChatMessage {
                        chat_group_id: msg.chat_group_id.unwrap_or(0),
                        chat_id: msg.chat_id.unwrap_or(0),
                        sender: SteamID::from(msg.steamid_sender.unwrap_or(0)),
                        message: msg.message.unwrap_or_default(),
                        timestamp: msg.timestamp.unwrap_or(0),
                        ordinal: msg.ordinal.unwrap_or(0),
                    }));
                }
            }
            "ChatRoomClient.NotifyMemberStateChange#1" => {
                if let Ok(msg) = steam_protos::CChatRoomMemberStateChangeNotification::decode(body) {
                    let steamid = msg.member.as_ref().and_then(|m| m.accountid).map(SteamID::from_individual_account_id).unwrap_or_default();
                    return Some(SteamEvent::Chat(ChatEvent::ChatMemberStateChange { chat_group_id: msg.chat_group_id.unwrap_or(0), steam_id: steamid, change: msg.change.unwrap_or(0) }));
                }
            }
            "ChatRoomClient.NotifyChatRoomGroupRoomsChange#1" => {
                if let Ok(msg) = steam_protos::CChatRoomChatRoomGroupRoomsChangeNotification::decode(body) {
                    let chat_rooms = msg
                        .chat_rooms
                        .into_iter()
                        .map(|room| {
                            let members_in_voice = room.members_in_voice.into_iter().map(SteamID::from_individual_account_id).collect();
                            ChatRoomState {
                                chat_id: room.chat_id.unwrap_or(0),
                                chat_name: room.chat_name.unwrap_or_default(),
                                voice_allowed: room.voice_allowed.unwrap_or(false),
                                members_in_voice,
                                time_last_message: room.time_last_message.unwrap_or(0),
                                last_message: room.last_message.unwrap_or_default(),
                                steamid_last_message: SteamID::from_individual_account_id(room.accountid_last_message.unwrap_or(0)),
                            }
                        })
                        .collect();
                    return Some(SteamEvent::Chat(ChatEvent::ChatRoomGroupRoomsChange { chat_group_id: msg.chat_group_id.unwrap_or(0), default_chat_id: msg.default_chat_id.unwrap_or(0), chat_rooms }));
                }
            }
            "ChatRoomClient.NotifyChatMessageModified#1" => {
                if let Ok(msg) = steam_protos::CChatRoomChatMessageModifiedNotification::decode(body) {
                    let messages = msg
                        .messages
                        .into_iter()
                        .map(|m| ModifiedChatMessage {
                            server_timestamp: m.server_timestamp.unwrap_or(0),
                            ordinal: m.ordinal.unwrap_or(0),
                            deleted: m.deleted.unwrap_or(false),
                        })
                        .collect();
                    return Some(SteamEvent::Chat(ChatEvent::ChatMessagesModified { chat_group_id: msg.chat_group_id.unwrap_or(0), chat_id: msg.chat_id.unwrap_or(0), messages }));
                }
            }
            "ChatRoomClient.NotifyChatRoomHeaderStateChange#1" => {
                if let Ok(msg) = steam_protos::CChatRoomChatRoomHeaderStateNotification::decode(body) {
                    if let Some(header) = msg.header_state {
                        return Some(SteamEvent::Chat(ChatEvent::ChatRoomGroupHeaderStateChange {
                            chat_group_id: header.chat_group_id.unwrap_or(0),
                            header_state: ChatRoomGroupHeaderState {
                                name: header.chat_name.unwrap_or_default(),
                                steamid_owner: SteamID::from(header.steamid_owner.unwrap_or(0)),
                                appid: header.appid,
                                steamid_clan: header.steamid_clan.map(SteamID::from),
                                avatar_sha: header.avatar_sha.unwrap_or_default(),
                                default_chat_id: header.default_chat_id.unwrap_or(0) as u64,
                            },
                        }));
                    }
                }
            }
            _ => {}
        }
        None
    }

    fn handle_player_notification(job_name: &str, body: &[u8]) -> Option<SteamEvent> {
        if job_name == "PlayerClient.NotifyFriendNicknameChanged#1" {
            if let Ok(msg) = steam_protos::CPlayerFriendNicknameChangedNotification::decode(body) {
                return Some(SteamEvent::Friends(FriendsEvent::NicknameChanged { steam_id: SteamID::from_individual_account_id(msg.accountid.unwrap_or(0)), nickname: msg.nickname }));
            }
        }
        None
    }

    fn handle_steam_notification(body: &[u8]) -> Option<SteamEvent> {
        if let Ok(msg) = steam_protos::CSteamNotificationNotificationsReceivedNotification::decode(body) {
            let notifications = msg
                .notifications
                .into_iter()
                .map(|n| NotificationData {
                    id: n.notification_id.unwrap_or(0),
                    notification_type: n.notification_type.unwrap_or(0),
                    body_data: n.body_data.unwrap_or_default(),
                    read: n.read.unwrap_or(false),
                    timestamp: n.timestamp.unwrap_or(0),
                    hidden: n.hidden.unwrap_or(false),
                    expiry: n.expiry,
                    viewed: n.viewed,
                })
                .collect();
            return Some(SteamEvent::Notifications(NotificationsEvent::NotificationsReceived(notifications)));
        }
        None
    }

    fn handle_cm_list(body: &[u8]) -> Option<SteamEvent> {
        if let Ok(msg) = steam_protos::CMsgClientCMList::decode(body) {
            return Some(SteamEvent::Connection(ConnectionEvent::CMList { servers: msg.cm_websocket_addresses }));
        }
        None
    }

    /// Route service methods by their target_job_name (matches Node.js
    /// behavior).
    ///
    /// This enables dynamic routing of service method calls based on the RPC
    /// name from the protobuf header, just like the Node.js steam-user
    /// library.
    fn handle_service_method_by_name(job_name: &str, body: &[u8]) -> Option<SteamEvent> {
        match job_name {
            // Friend message notifications
            "FriendMessagesClient.IncomingMessage#1" => Self::handle_friend_message_notification(body),

            // Message acknowledgment echo
            "FriendMessagesClient.NotifyAckMessageEcho#1" => Self::handle_friend_typing_echo(body),

            // Steam notifications
            "SteamNotificationClient.NotificationsReceived#1" => Self::handle_steam_notification(body),

            // Chat room notifications
            name if name.starts_with("ChatRoomClient.") => Self::handle_chatroom_notification(name, body),

            // Player notifications
            name if name.starts_with("PlayerClient.") => Self::handle_player_notification(name, body),

            // Unknown service methods - silently ignore
            _ => None,
        }
    }

    /// Legacy fallback for service methods without target_job_name.
    fn handle_service_method_legacy(body: &[u8]) -> Option<SteamEvent> {
        // Try to decode as incoming friend message (legacy behavior)
        Self::handle_friend_message_notification(body)
    }

    /// Handle friend message notifications
    /// (FriendMessagesClient.IncomingMessage#1).
    ///
    /// This handles:
    /// - Regular friend messages
    /// - Typing indicators
    /// - Left conversation notifications
    /// - Local echo of sent messages
    fn handle_friend_message_notification(body: &[u8]) -> Option<SteamEvent> {
        if let Ok(msg) = steam_protos::CFriendMessagesIncomingMessageNotification::decode(body) {
            // Check if this is actually a friend message (must have a valid sender)
            let steamid_friend = msg.steamid_friend.unwrap_or(0);
            if steamid_friend == 0 {
                // Not a valid friend message, skip
                return None;
            }

            let steam_id = SteamID::from_steam_id64(steamid_friend);
            let local_echo = msg.local_echo.unwrap_or(false);
            let chat_entry_type = msg.chat_entry_type.unwrap_or(1);

            // Prioritize message_no_bbcode if available, similar to node-steam-user
            let message = msg.message_no_bbcode.clone().filter(|s| !s.is_empty()).or_else(|| msg.message.clone()).unwrap_or_default();

            // Determine the event type based on chat_entry_type and local_echo
            match chat_entry_type {
                // Typing (EChatEntryType::Typing = 2)
                val if val == EChatEntryType::Typing as i32 => {
                    if local_echo {
                        return Some(SteamEvent::Chat(ChatEvent::FriendTypingEcho { receiver: steam_id }));
                    } else {
                        return Some(SteamEvent::Chat(ChatEvent::FriendTyping { sender: steam_id }));
                    }
                }

                // Left Conversation (EChatEntryType::LeftConversation = 6)
                val if val == EChatEntryType::LeftConversation as i32 => {
                    if local_echo {
                        return Some(SteamEvent::Chat(ChatEvent::FriendLeftConversationEcho { receiver: steam_id }));
                    } else {
                        return Some(SteamEvent::Chat(ChatEvent::FriendLeftConversation { sender: steam_id }));
                    }
                }

                // Regular message (EChatEntryType::ChatMsg = 1) or other types
                _ => {
                    if local_echo {
                        return Some(SteamEvent::Chat(ChatEvent::FriendMessageEcho {
                            receiver: steam_id,
                            message,
                            timestamp: msg.rtime32_server_timestamp.unwrap_or(0),
                            ordinal: msg.ordinal.unwrap_or(0),
                        }));
                    } else {
                        return Some(SteamEvent::Chat(ChatEvent::FriendMessage {
                            sender: steam_id,
                            message,
                            chat_entry_type: EChatEntryType::from_i32(chat_entry_type).unwrap_or(EChatEntryType::ChatMsg),
                            timestamp: msg.rtime32_server_timestamp.unwrap_or(0),
                            ordinal: msg.ordinal.unwrap_or(0),
                            from_limited_account: msg.from_limited_account.unwrap_or(false),
                            low_priority: msg.low_priority.unwrap_or(false),
                        }));
                    }
                }
            }
        }
        None
    }

    fn handle_from_gc(body: &[u8]) -> Vec<SteamEvent> {
        let msg = match steam_protos::CMsgGCClient::decode(body) {
            Ok(m) => m,
            Err(_) => return vec![],
        };

        let gc_msg = match crate::services::gc::parse_gc_message(&msg) {
            Some(m) => m,
            None => return vec![],
        };

        let mut events = vec![SteamEvent::Apps(AppsEvent::GCReceived(gc_msg.clone()))];

        // Only process CS:GO messages (appid 730)
        if gc_msg.appid == 730 {
            if let Some(event) = Self::handle_csgo_gc_message(gc_msg.msg_type, &gc_msg.payload) {
                events.push(event);
            }
        }

        events
    }

    /// Route CS:GO GC messages to their respective handlers.
    fn handle_csgo_gc_message(msg_type: u32, payload: &[u8]) -> Option<SteamEvent> {
        let msg_i32 = msg_type as i32;

        if let Some(msg) = ECsgoGCMsg::from_i32(msg_i32) {
            match msg {
                ECsgoGCMsg::MatchmakingGC2ClientHello => return Self::handle_csgo_client_hello(payload),
                ECsgoGCMsg::PlayersProfile => return Self::handle_csgo_players_profile(payload),
                ECsgoGCMsg::Party_Search => return Self::handle_csgo_party_search_results(payload),
                ECsgoGCMsg::Party_Invite => return Self::handle_csgo_party_invite(payload),
                _ => {}
            }
        }

        if let Some(msg) = EGCBaseClientMsg::from_i32(msg_i32) {
            if msg == EGCBaseClientMsg::ClientConnectionStatus {
                return Self::handle_csgo_welcome(payload);
            }
        }

        None
    }

    /// Handle CS:GO Connection Status message (ClientConnectionStatus = 4009).
    fn handle_csgo_welcome(payload: &[u8]) -> Option<SteamEvent> {
        let welcome = steam_protos::CMsgClientWelcome::decode(payload).ok()?;

        let mut prime = false;
        let mut elevated_state = 0;
        let mut bonus_xp_usedflags = 0;
        let mut items = Vec::new();

        for cache in welcome.outofdate_subscribed_caches {
            for object in cache.objects {
                match object.type_id {
                    // Type 1 is CSOEconItem
                    Some(1) => {
                        for data in &object.object_data {
                            if let Ok(item) = steam_protos::CSOEconItem::decode(&**data) {
                                items.push(item);
                            }
                        }
                    }
                    // Type 7 is CSOEconGameAccountClient
                    Some(7) => {
                        for data in &object.object_data {
                            if let Ok(account) = steam_protos::CSOEconGameAccountClient::decode(&**data) {
                                elevated_state = account.elevated_state.unwrap_or(0);
                                bonus_xp_usedflags = account.bonus_xp_usedflags.unwrap_or(0);

                                // Prime detection logic from Node.js
                                if (bonus_xp_usedflags & 16) != 0 || elevated_state == 5 {
                                    prime = true;
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
        }

        Some(SteamEvent::CSGO(CSGOEvent::Online(CsgoWelcome { prime, elevated_state, bonus_xp_usedflags, items })))
    }

    /// Handle CS:GO Client Hello message (MatchmakingGC2ClientHello = 9110).
    fn handle_csgo_client_hello(payload: &[u8]) -> Option<SteamEvent> {
        let hello = steam_protos::CMsgGccStrike15V2MatchmakingGc2ClientHello::decode(payload).ok()?;
        Some(SteamEvent::CSGO(CSGOEvent::ClientHello(Self::build_csgo_client_hello(&hello))))
    }

    /// Handle CS:GO Players Profile message (PlayersProfile = 9128).
    fn handle_csgo_players_profile(payload: &[u8]) -> Option<SteamEvent> {
        let profile_msg = steam_protos::CMsgGccStrike15V2PlayersProfile::decode(payload).ok()?;

        let profiles: Vec<CsgoClientHello> = profile_msg.account_profiles.iter().map(Self::build_csgo_client_hello).collect();

        Some(SteamEvent::CSGO(CSGOEvent::PlayersProfile(profiles)))
    }

    /// Handle CS:GO Party Invite message (Party_Invite = 9192).
    fn handle_csgo_party_invite(payload: &[u8]) -> Option<SteamEvent> {
        let invite = steam_protos::CMsgGccStrike15V2PartyInvite::decode(payload).ok()?;

        Some(SteamEvent::CSGO(CSGOEvent::PartyInvite {
            inviter: SteamID::from_individual_account_id(invite.accountid.unwrap_or(0)),
            lobby_id: invite.lobbyid.unwrap_or(0) as u64,
        }))
    }

    /// Handle CS:GO Party Search Results (Party_Search = 9191).
    fn handle_csgo_party_search_results(payload: &[u8]) -> Option<SteamEvent> {
        let results = steam_protos::CMsgGccStrike15V2PartySearchResults::decode(payload).ok()?;

        let entries: Vec<CsgoPartyEntry> = results
            .entries
            .into_iter()
            .map(|e| CsgoPartyEntry {
                account_id: e.accountid.unwrap_or(0),
                lobby_id: e.id.unwrap_or(0),
                game_type: e.game_type.unwrap_or(0),
                loc: e.loc.unwrap_or(0),
            })
            .collect();

        Some(SteamEvent::CSGO(CSGOEvent::PartySearchResults(entries)))
    }

    /// Build a CsgoClientHello from a matchmaking hello message.
    /// Used by both handle_csgo_client_hello and handle_csgo_players_profile.
    pub(crate) fn build_csgo_client_hello(hello: &steam_protos::CMsgGccStrike15V2MatchmakingGc2ClientHello) -> CsgoClientHello {
        let ranking = hello.ranking.as_ref().map(|r| CsgoRanking { rank_id: r.rank_id.unwrap_or(0), wins: r.wins.unwrap_or(0), rank_type_id: r.rank_type_id.unwrap_or(0) });

        let commendation = hello.commendation.as_ref().map(|c| CsgoCommendation {
            cmd_friendly: c.cmd_friendly.unwrap_or(0),
            cmd_teaching: c.cmd_teaching.unwrap_or(0),
            cmd_leader: c.cmd_leader.unwrap_or(0),
        });

        let global_stats = hello.global_stats.as_ref();

        CsgoClientHello {
            account_id: hello.account_id.unwrap_or(0),
            vac_banned: hello.vac_banned.unwrap_or(0),
            penalty_seconds: hello.penalty_seconds.unwrap_or(0),
            penalty_reason: hello.penalty_reason.unwrap_or(0),
            player_level: hello.player_level.unwrap_or(0),
            player_cur_xp: hello.player_cur_xp.unwrap_or(0),
            player_xp_bonus_flags: hello.player_xp_bonus_flags.unwrap_or(0),
            ranking,
            commendation,
            players_online: global_stats.and_then(|s| s.players_online).unwrap_or(0),
            servers_online: global_stats.and_then(|s| s.servers_online).unwrap_or(0),
            ongoing_matches: global_stats.and_then(|s| s.ongoing_matches).unwrap_or(0),
        }
    }

    fn handle_pics_product_info(body: &[u8]) -> Option<SteamEvent> {
        parsing::parse_pics_product_info(body).ok().map(|data| {
            SteamEvent::Apps(AppsEvent::ProductInfoResponse {
                apps: data.apps,
                packages: data.packages,
                unknown_apps: data.unknown_apps,
                unknown_packages: data.unknown_packages,
            })
        })
    }

    fn handle_pics_access_tokens(body: &[u8]) -> Option<SteamEvent> {
        parsing::parse_pics_access_tokens(body).ok().map(|data| {
            SteamEvent::Apps(AppsEvent::AccessTokensResponse {
                app_tokens: data.app_tokens,
                package_tokens: data.package_tokens,
                app_denied: data.app_denied,
                package_denied: data.package_denied,
            })
        })
    }

    fn handle_pics_changes(body: &[u8]) -> Option<SteamEvent> {
        parsing::parse_pics_changes(body).ok().map(|data| {
            SteamEvent::Apps(AppsEvent::ProductChangesResponse {
                current_change_number: data.current_change_number,
                app_changes: data.app_changes,
                package_changes: data.package_changes,
            })
        })
    }

    //=========================================================================
    // Account Event Handlers
    //=========================================================================

    fn handle_mms_invite(body: &[u8]) -> Option<SteamEvent> {
        if let Ok(msg) = steam_protos::CMsgClientMmsInviteToLobby::decode(body) {
            return Some(SteamEvent::CSGO(CSGOEvent::PartyInvite {
                inviter: SteamID::from(0), // MMS invite doesn't seem to have inviter ID in this message?
                lobby_id: msg.steam_id_lobby.unwrap_or(0),
            }));
        }
        None
    }

    fn handle_email_info(body: &[u8]) -> Option<SteamEvent> {
        if let Ok(msg) = steam_protos::CMsgClientEmailAddrInfo::decode(body) {
            return Some(SteamEvent::Account(AccountEvent::EmailInfo { address: msg.email_address.unwrap_or_default(), validated: msg.email_is_validated.unwrap_or(false) }));
        }
        None
    }

    fn handle_account_limitations(body: &[u8]) -> Option<SteamEvent> {
        if let Ok(msg) = steam_protos::CMsgClientIsLimitedAccount::decode(body) {
            return Some(SteamEvent::Account(AccountEvent::AccountLimitations {
                limited: msg.bis_limited_account.unwrap_or(false),
                community_banned: msg.bis_community_banned.unwrap_or(false),
                locked: msg.bis_locked_account.unwrap_or(false),
                can_invite_friends: msg.bis_limited_account_allowed_to_invite_friends.unwrap_or(true),
            }));
        }
        None
    }

    fn handle_wallet_info(body: &[u8]) -> Option<SteamEvent> {
        if let Ok(msg) = steam_protos::CMsgClientWalletInfoUpdate::decode(body) {
            return Some(SteamEvent::Account(AccountEvent::Wallet {
                has_wallet: msg.has_wallet.unwrap_or(false),
                currency: msg.currency.unwrap_or(0),
                balance: msg.balance64.unwrap_or(msg.balance.unwrap_or(0) as i64),
            }));
        }
        None
    }

    fn handle_account_info(body: &[u8]) -> Option<SteamEvent> {
        if let Ok(msg) = steam_protos::CMsgClientAccountInfo::decode(body) {
            return Some(SteamEvent::Account(AccountEvent::AccountInfo {
                name: msg.persona_name.unwrap_or_default(),
                country: msg.ip_country.unwrap_or_default(),
                authed_machines: msg.count_authed_computers.unwrap_or(0) as u32,
                flags: msg.account_flags.unwrap_or(0),
            }));
        }
        None
    }

    fn handle_game_connect_tokens(body: &[u8]) -> Option<SteamEvent> {
        if let Ok(msg) = steam_protos::CMsgClientGameConnectTokens::decode(body) {
            return Some(SteamEvent::Auth(AuthEvent::GameConnectTokens { tokens: msg.tokens }));
        }
        None
    }

    fn handle_playing_session_state(body: &[u8]) -> Option<SteamEvent> {
        if let Ok(msg) = steam_protos::CMsgClientPlayingSessionState::decode(body) {
            return Some(SteamEvent::Apps(AppsEvent::PlayingState { blocked: msg.playing_blocked.unwrap_or(false), playing_app: msg.playing_app.unwrap_or(0) }));
        }
        None
    }

    //=========================================================================
    // Notification Event Handlers
    //=========================================================================

    fn handle_user_notifications(body: &[u8]) -> Option<SteamEvent> {
        if let Ok(msg) = steam_protos::CMsgClientUserNotifications::decode(body) {
            // Check the notification types
            // Type 1 = tradeOffers, Type 3 = communityMessages
            for notif in &msg.notifications {
                let notif_type = notif.user_notification_type.unwrap_or(0);
                let count = notif.count.unwrap_or(0);

                match notif_type {
                    1 => {
                        return Some(SteamEvent::Notifications(NotificationsEvent::TradeOffers { count }));
                    }
                    3 => {
                        return Some(SteamEvent::Notifications(NotificationsEvent::CommunityMessages { count }));
                    }
                    _ => {}
                }
            }
        }
        None
    }

    fn handle_offline_messages(body: &[u8]) -> Option<SteamEvent> {
        if let Ok(msg) = steam_protos::CMsgClientOfflineMessageNotification::decode(body) {
            let friends: Vec<SteamID> = msg
                .friends_with_offline_messages
                .iter()
                .map(|&account_id| {
                    // Convert account ID to SteamID
                    SteamID::from_individual_account_id(account_id)
                })
                .collect();

            return Some(SteamEvent::Notifications(NotificationsEvent::OfflineMessages { count: msg.offline_messages.unwrap_or(0), friends }));
        }
        None
    }

    fn handle_item_announcements(body: &[u8]) -> Option<SteamEvent> {
        if let Ok(msg) = steam_protos::CMsgClientItemAnnouncements::decode(body) {
            return Some(SteamEvent::Notifications(NotificationsEvent::NewItems { count: msg.count_new_items.unwrap_or(0) }));
        }
        None
    }

    fn handle_comment_notifications(body: &[u8]) -> Option<SteamEvent> {
        if let Ok(msg) = steam_protos::CMsgClientCommentNotifications::decode(body) {
            return Some(SteamEvent::Notifications(NotificationsEvent::NewComments {
                count: msg.count_new_comments.unwrap_or(0),
                owner_comments: msg.count_new_comments_owner.unwrap_or(0),
                subscription_comments: msg.count_new_comments_subscriptions.unwrap_or(0),
            }));
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::*;

    //=========================================================================
    // Helper function to create test SteamIDs
    //=========================================================================

    fn test_steam_id() -> SteamID {
        SteamID::from_steam_id64(76561198000000000)
    }

    //=========================================================================
    // AuthEvent Tests
    //=========================================================================

    #[test]
    fn test_auth_event_logged_on() {
        let steam_id = test_steam_id();
        let event = SteamEvent::Auth(AuthEvent::LoggedOn { steam_id });

        assert!(event.is_auth());
        assert!(!event.is_connection());
        assert!(!event.is_chat());

        // Pattern matching
        match event {
            SteamEvent::Auth(AuthEvent::LoggedOn { steam_id: sid }) => {
                assert_eq!(sid.steam_id64(), 76561198000000000);
            }
            _ => panic!("Expected LoggedOn event"),
        }
    }

    #[test]
    fn test_auth_event_logged_off() {
        let event = SteamEvent::Auth(AuthEvent::LoggedOff { result: EResult::LoggedInElsewhere });

        assert!(event.is_auth());

        match event {
            SteamEvent::Auth(AuthEvent::LoggedOff { result }) => {
                assert_eq!(result, EResult::LoggedInElsewhere);
            }
            _ => panic!("Expected LoggedOff event"),
        }
    }

    #[test]
    fn test_auth_event_refresh_token() {
        let event = SteamEvent::Auth(AuthEvent::RefreshToken { token: "test_token_123".to_string(), account_name: "test_user".to_string() });

        assert!(event.is_auth());

        match event {
            SteamEvent::Auth(AuthEvent::RefreshToken { token, account_name }) => {
                assert_eq!(token, "test_token_123");
                assert_eq!(account_name, "test_user");
            }
            _ => panic!("Expected RefreshToken event"),
        }
    }

    //=========================================================================
    // ConnectionEvent Tests
    //=========================================================================

    #[test]
    fn test_connection_event_connected() {
        let event = SteamEvent::Connection(ConnectionEvent::Connected);

        assert!(event.is_connection());
        assert!(!event.is_auth());

        assert!(matches!(event, SteamEvent::Connection(ConnectionEvent::Connected)));
    }

    #[test]
    fn test_connection_event_disconnected() {
        let event = SteamEvent::Connection(ConnectionEvent::Disconnected { reason: Some(EResult::NoConnection), will_reconnect: true });

        assert!(event.is_connection());

        match event {
            SteamEvent::Connection(ConnectionEvent::Disconnected { reason, will_reconnect }) => {
                assert_eq!(reason, Some(EResult::NoConnection));
                assert!(will_reconnect);
            }
            _ => panic!("Expected Disconnected event"),
        }
    }

    #[test]
    fn test_connection_event_reconnect_attempt() {
        let event = SteamEvent::Connection(ConnectionEvent::ReconnectAttempt { attempt: 3, max_attempts: 10, delay: Duration::from_secs(5) });

        assert!(event.is_connection());

        match event {
            SteamEvent::Connection(ConnectionEvent::ReconnectAttempt { attempt, max_attempts, delay }) => {
                assert_eq!(attempt, 3);
                assert_eq!(max_attempts, 10);
                assert_eq!(delay, Duration::from_secs(5));
            }
            _ => panic!("Expected ReconnectAttempt event"),
        }
    }

    #[test]
    fn test_connection_event_reconnect_failed() {
        let event = SteamEvent::Connection(ConnectionEvent::ReconnectFailed { reason: Some(EResult::ServiceUnavailable), attempts: 10 });

        match event {
            SteamEvent::Connection(ConnectionEvent::ReconnectFailed { reason, attempts }) => {
                assert_eq!(reason, Some(EResult::ServiceUnavailable));
                assert_eq!(attempts, 10);
            }
            _ => panic!("Expected ReconnectFailed event"),
        }
    }

    #[test]
    fn test_connection_event_cm_list() {
        let servers = vec!["cm1.steampowered.com:443".to_string(), "cm2.steampowered.com:443".to_string()];
        let event = SteamEvent::Connection(ConnectionEvent::CMList { servers: servers.clone() });

        match event {
            SteamEvent::Connection(ConnectionEvent::CMList { servers: s }) => {
                assert_eq!(s.len(), 2);
                assert_eq!(s[0], "cm1.steampowered.com:443");
            }
            _ => panic!("Expected CMList event"),
        }
    }

    //=========================================================================
    // FriendsEvent Tests
    //=========================================================================

    #[test]
    fn test_friends_event_friends_list() {
        let friends = vec![FriendEntry { steam_id: test_steam_id(), relationship: EFriendRelationship::Friend }];

        let event = SteamEvent::Friends(FriendsEvent::FriendsList { incremental: false, friends });

        assert!(event.is_friends());
        assert!(!event.is_chat());

        match event {
            SteamEvent::Friends(FriendsEvent::FriendsList { incremental, friends }) => {
                assert!(!incremental);
                assert_eq!(friends.len(), 1);
                assert_eq!(friends[0].relationship, EFriendRelationship::Friend);
            }
            _ => panic!("Expected FriendsList event"),
        }
    }

    #[test]
    fn test_friends_event_persona_state() {
        let persona = UserPersona {
            steam_id: test_steam_id(),
            player_name: "TestPlayer".to_string(),
            persona_state: EPersonaState::Online,
            avatar_hash: Some("abc123".to_string()),
            game_name: Some("Counter-Strike 2".to_string()),
            game_id: Some(730),
            ..Default::default()
        };

        let event = SteamEvent::Friends(FriendsEvent::PersonaState(Box::new(persona)));

        assert!(event.is_friends());

        match event {
            SteamEvent::Friends(FriendsEvent::PersonaState(p)) => {
                assert_eq!(p.player_name, "TestPlayer");
                assert_eq!(p.persona_state, EPersonaState::Online);
                assert_eq!(p.game_id, Some(730));
            }
            _ => panic!("Expected PersonaState event"),
        }
    }

    #[test]
    fn test_friends_event_relationship() {
        let event = SteamEvent::Friends(FriendsEvent::FriendRelationship { steam_id: test_steam_id(), relationship: EFriendRelationship::Blocked });

        match event {
            SteamEvent::Friends(FriendsEvent::FriendRelationship { steam_id, relationship }) => {
                assert_eq!(steam_id.steam_id64(), 76561198000000000);
                assert_eq!(relationship, EFriendRelationship::Blocked);
            }
            _ => panic!("Expected FriendRelationship event"),
        }
    }

    //=========================================================================
    // ChatEvent Tests
    //=========================================================================

    #[test]
    fn test_chat_event_friend_message() {
        let event = SteamEvent::Chat(ChatEvent::FriendMessage {
            sender: test_steam_id(),
            message: "Hello, World!".to_string(),
            chat_entry_type: EChatEntryType::ChatMsg,
            timestamp: 1702000000,
            ordinal: 1,
            from_limited_account: false,
            low_priority: false,
        });

        assert!(event.is_chat());
        assert!(!event.is_friends());

        // Test chat_sender helper
        assert!(event.chat_sender().is_some());
        assert_eq!(event.chat_sender().unwrap_or_default().steam_id64(), 76561198000000000);

        match event {
            SteamEvent::Chat(ChatEvent::FriendMessage { sender, message, chat_entry_type, timestamp, ordinal, from_limited_account, low_priority }) => {
                assert_eq!(sender.steam_id64(), 76561198000000000);
                assert_eq!(message, "Hello, World!");
                assert_eq!(chat_entry_type, EChatEntryType::ChatMsg);
                assert_eq!(timestamp, 1702000000);
                assert_eq!(ordinal, 1);
                assert!(!from_limited_account);
                assert!(!low_priority);
            }
            _ => panic!("Expected FriendMessage event"),
        }
    }

    #[test]
    fn test_chat_event_friend_typing() {
        let event = SteamEvent::Chat(ChatEvent::FriendTyping { sender: test_steam_id() });

        assert!(event.is_chat());
        assert!(event.chat_sender().is_some());

        match event {
            SteamEvent::Chat(ChatEvent::FriendTyping { sender }) => {
                assert_eq!(sender.steam_id64(), 76561198000000000);
            }
            _ => panic!("Expected FriendTyping event"),
        }
    }

    //=========================================================================
    // AppsEvent Tests
    //=========================================================================

    #[test]
    fn test_apps_event_license_list() {
        let licenses = vec![LicenseEntry {
            package_id: 12345,
            time_created: 1600000000,
            license_type: 1,
            flags: 0,
            access_token: 0,
            ..Default::default()
        }];

        let event = SteamEvent::Apps(AppsEvent::LicenseList { licenses });

        assert!(event.is_apps());

        match event {
            SteamEvent::Apps(AppsEvent::LicenseList { licenses }) => {
                assert_eq!(licenses.len(), 1);
                assert_eq!(licenses[0].package_id, 12345);
            }
            _ => panic!("Expected LicenseList event"),
        }
    }

    #[test]
    fn test_apps_event_product_info_response() {
        let mut apps = HashMap::new();
        apps.insert(730, AppInfoData { app_id: 730, change_number: 12345, missing_token: false, app_info: None });

        let event = SteamEvent::Apps(AppsEvent::ProductInfoResponse { apps, packages: HashMap::new(), unknown_apps: vec![99999], unknown_packages: vec![] });

        assert!(event.is_apps());

        match event {
            SteamEvent::Apps(AppsEvent::ProductInfoResponse { apps, packages, unknown_apps, unknown_packages }) => {
                assert_eq!(apps.len(), 1);
                assert!(apps.contains_key(&730));
                assert_eq!(apps[&730].change_number, 12345);
                assert!(packages.is_empty());
                assert_eq!(unknown_apps, vec![99999]);
                assert!(unknown_packages.is_empty());
            }
            _ => panic!("Expected ProductInfoResponse event"),
        }
    }

    #[test]
    fn test_apps_event_access_tokens_response() {
        let mut app_tokens = HashMap::new();
        app_tokens.insert(730, 123456789);

        let event = SteamEvent::Apps(AppsEvent::AccessTokensResponse { app_tokens, package_tokens: HashMap::new(), app_denied: vec![440], package_denied: vec![] });

        match event {
            SteamEvent::Apps(AppsEvent::AccessTokensResponse { app_tokens, package_tokens, app_denied, package_denied }) => {
                assert_eq!(app_tokens[&730], 123456789);
                assert!(package_tokens.is_empty());
                assert_eq!(app_denied, vec![440]);
                assert!(package_denied.is_empty());
            }
            _ => panic!("Expected AccessTokensResponse event"),
        }
    }

    #[test]
    fn test_apps_event_product_changes_response() {
        let app_changes = vec![AppChange { app_id: 730, change_number: 99999, needs_token: false }];

        let event = SteamEvent::Apps(AppsEvent::ProductChangesResponse { current_change_number: 100000, app_changes, package_changes: vec![] });

        match event {
            SteamEvent::Apps(AppsEvent::ProductChangesResponse { current_change_number, app_changes, package_changes }) => {
                assert_eq!(current_change_number, 100000);
                assert_eq!(app_changes.len(), 1);
                assert_eq!(app_changes[0].app_id, 730);
                assert!(package_changes.is_empty());
            }
            _ => panic!("Expected ProductChangesResponse event"),
        }
    }

    //=========================================================================
    // ContentEvent Tests
    //=========================================================================

    #[test]
    fn test_content_event_rich_presence() {
        let users = vec![crate::services::rich_presence::RichPresenceData {
            steam_id: test_steam_id(),
            appid: 730,
            data: {
                let mut map = HashMap::new();
                map.insert("status".to_string(), "In Game".to_string());
                map
            },
        }];

        let event = SteamEvent::Content(ContentEvent::RichPresence { appid: 730, users });

        assert!(event.is_content());

        match event {
            SteamEvent::Content(ContentEvent::RichPresence { appid, users }) => {
                assert_eq!(appid, 730);
                assert_eq!(users.len(), 1);
                assert_eq!(users[0].data.get("status"), Some(&"In Game".to_string()));
            }
            _ => panic!("Expected RichPresence event"),
        }
    }

    //=========================================================================
    // SystemEvent Tests
    //=========================================================================

    #[test]
    fn test_system_event_debug() {
        let event = SteamEvent::System(SystemEvent::Debug("Test debug message".to_string()));

        assert!(event.is_system());
        assert!(!event.is_auth());

        match event {
            SteamEvent::System(SystemEvent::Debug(msg)) => {
                assert_eq!(msg, "Test debug message");
            }
            _ => panic!("Expected Debug event"),
        }
    }

    #[test]
    fn test_system_event_error() {
        let event = SteamEvent::System(SystemEvent::Error("Something went wrong".to_string()));

        assert!(event.is_system());

        match event {
            SteamEvent::System(SystemEvent::Error(msg)) => {
                assert_eq!(msg, "Something went wrong");
            }
            _ => panic!("Expected Error event"),
        }
    }

    //=========================================================================
    // Helper Method Tests
    //=========================================================================

    #[test]
    fn test_all_is_category_methods() {
        let events = vec![
            (SteamEvent::Auth(AuthEvent::LoggedOn { steam_id: SteamID::new() }), "auth"),
            (SteamEvent::Connection(ConnectionEvent::Connected), "connection"),
            (SteamEvent::Friends(FriendsEvent::FriendsList { incremental: false, friends: vec![] }), "friends"),
            (SteamEvent::Chat(ChatEvent::FriendTyping { sender: SteamID::new() }), "chat"),
            (SteamEvent::Apps(AppsEvent::LicenseList { licenses: vec![] }), "apps"),
            (SteamEvent::Content(ContentEvent::RichPresence { appid: 0, users: vec![] }), "content"),
            (SteamEvent::System(SystemEvent::Debug("".to_string())), "system"),
        ];

        for (event, expected_category) in events {
            match expected_category {
                "auth" => {
                    assert!(event.is_auth());
                    assert!(!event.is_connection());
                    assert!(!event.is_friends());
                    assert!(!event.is_chat());
                    assert!(!event.is_apps());
                    assert!(!event.is_content());
                    assert!(!event.is_system());
                }
                "connection" => {
                    assert!(!event.is_auth());
                    assert!(event.is_connection());
                    assert!(!event.is_friends());
                    assert!(!event.is_chat());
                    assert!(!event.is_apps());
                    assert!(!event.is_content());
                    assert!(!event.is_system());
                }
                "friends" => {
                    assert!(!event.is_auth());
                    assert!(!event.is_connection());
                    assert!(event.is_friends());
                    assert!(!event.is_chat());
                    assert!(!event.is_apps());
                    assert!(!event.is_content());
                    assert!(!event.is_system());
                }
                "chat" => {
                    assert!(!event.is_auth());
                    assert!(!event.is_connection());
                    assert!(!event.is_friends());
                    assert!(event.is_chat());
                    assert!(!event.is_apps());
                    assert!(!event.is_content());
                    assert!(!event.is_system());
                }
                "apps" => {
                    assert!(!event.is_auth());
                    assert!(!event.is_connection());
                    assert!(!event.is_friends());
                    assert!(!event.is_chat());
                    assert!(event.is_apps());
                    assert!(!event.is_content());
                    assert!(!event.is_system());
                }
                "content" => {
                    assert!(!event.is_auth());
                    assert!(!event.is_connection());
                    assert!(!event.is_friends());
                    assert!(!event.is_chat());
                    assert!(!event.is_apps());
                    assert!(event.is_content());
                    assert!(!event.is_system());
                }
                "system" => {
                    assert!(!event.is_auth());
                    assert!(!event.is_connection());
                    assert!(!event.is_friends());
                    assert!(!event.is_chat());
                    assert!(!event.is_apps());
                    assert!(!event.is_content());
                    assert!(event.is_system());
                }
                _ => panic!("Unknown category"),
            }
        }
    }

    #[test]
    fn test_chat_sender_helper() {
        // FriendMessage has a sender
        let msg_event = SteamEvent::Chat(ChatEvent::FriendMessage {
            sender: test_steam_id(),
            message: "test".to_string(),
            chat_entry_type: EChatEntryType::ChatMsg,
            timestamp: 0,
            ordinal: 0,
            from_limited_account: false,
            low_priority: false,
        });
        assert!(msg_event.chat_sender().is_some());
        assert_eq!(msg_event.chat_sender().unwrap_or_default().steam_id64(), 76561198000000000);

        // FriendTyping has a sender
        let typing_event = SteamEvent::Chat(ChatEvent::FriendTyping { sender: test_steam_id() });
        assert!(typing_event.chat_sender().is_some());

        // Non-chat events don't have a sender
        let auth_event = SteamEvent::Auth(AuthEvent::LoggedOn { steam_id: SteamID::new() });
        assert!(auth_event.chat_sender().is_none());

        let conn_event = SteamEvent::Connection(ConnectionEvent::Connected);
        assert!(conn_event.chat_sender().is_none());
    }

    //=========================================================================
    // Clone and Debug Tests
    //=========================================================================

    #[test]
    fn test_events_are_cloneable() {
        let original = SteamEvent::Chat(ChatEvent::FriendMessage {
            sender: test_steam_id(),
            message: "Clone me!".to_string(),
            chat_entry_type: EChatEntryType::ChatMsg,
            timestamp: 123,
            ordinal: 1,
            from_limited_account: false,
            low_priority: false,
        });

        let cloned = original.clone();

        match (original, cloned) {
            (SteamEvent::Chat(ChatEvent::FriendMessage { message: m1, .. }), SteamEvent::Chat(ChatEvent::FriendMessage { message: m2, .. })) => {
                assert_eq!(m1, m2);
                assert_eq!(m1, "Clone me!");
            }
            _ => panic!("Clone failed"),
        }
    }

    #[test]
    fn test_events_are_debuggable() {
        let event = SteamEvent::Auth(AuthEvent::LoggedOn { steam_id: test_steam_id() });

        let debug_str = format!("{:?}", event);
        assert!(debug_str.contains("Auth"));
        assert!(debug_str.contains("LoggedOn"));
    }

    //=========================================================================
    // MessageHandler Tests
    //=========================================================================

    #[test]
    fn test_decompress_gzip() {
        use std::io::Write;

        use flate2::{write::GzEncoder, Compression};

        let original = b"Hello, Steam Multi Message!";

        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(original).unwrap_or_default();
        let compressed = encoder.finish().unwrap_or_default();

        let decompressed = MessageHandler::decompress_gzip(&compressed, original.len()).unwrap_or_default();
        assert_eq!(decompressed, original);
    }

    #[test]
    fn test_decode_message_too_short() {
        // Message shorter than 8 bytes should return empty events
        let events = MessageHandler::decode_message(&[0, 1, 2, 3]);
        assert!(events.is_empty());
    }

    //=========================================================================
    // Pattern Matching Example Tests
    //=========================================================================

    #[test]
    fn test_exhaustive_category_matching() {
        let events = vec![
            SteamEvent::Auth(AuthEvent::LoggedOn { steam_id: SteamID::new() }),
            SteamEvent::Connection(ConnectionEvent::Connected),
            SteamEvent::Friends(FriendsEvent::FriendsList { incremental: false, friends: vec![] }),
            SteamEvent::Chat(ChatEvent::FriendTyping { sender: SteamID::new() }),
            SteamEvent::Apps(AppsEvent::LicenseList { licenses: vec![] }),
            SteamEvent::Content(ContentEvent::RichPresence { appid: 0, users: vec![] }),
            SteamEvent::System(SystemEvent::Debug("test".to_string())),
        ];

        for event in events {
            // This test ensures all categories can be matched
            let category = match event {
                SteamEvent::Auth(_) => "auth",
                SteamEvent::Connection(_) => "connection",
                SteamEvent::Friends(_) => "friends",
                SteamEvent::Chat(_) => "chat",
                SteamEvent::Apps(_) => "apps",
                SteamEvent::Content(_) => "content",
                SteamEvent::System(_) => "system",
                SteamEvent::Account(_) => "account",
                SteamEvent::Notifications(_) => "notifications",
                SteamEvent::CSGO(_) => "csgo",
            };
            assert!(!category.is_empty());
        }
    }

    #[test]
    fn test_selective_category_matching() {
        // Test that you can ignore categories easily
        let event = SteamEvent::Chat(ChatEvent::FriendMessage {
            sender: test_steam_id(),
            message: "Hello".to_string(),
            chat_entry_type: EChatEntryType::ChatMsg,
            timestamp: 0,
            ordinal: 0,
            from_limited_account: false,
            low_priority: false,
        });

        let mut handled = false;

        if let SteamEvent::Chat(ChatEvent::FriendMessage { message, .. }) = event {
            assert_eq!(message, "Hello");
            handled = true;
        }

        assert!(handled);
    }
}
