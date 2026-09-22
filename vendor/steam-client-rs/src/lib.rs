// `SteamError` is intentionally a wide enum carrying typed payloads
// (Reqwest, WebSocket, prost::Decode, etc.). Wrapping every `Result<_, _>`
// in `Box<>` to satisfy clippy's `result_large_err` would obscure the public
// API for an internal stack-size concern. Allowed crate-wide; revisit if/when
// SteamError is restructured.
#![allow(clippy::result_large_err)]

//! Steam client for Rust.
//!
//! This crate provides a Steam client for individual and anonymous user account
//! types. Three authentication paths are supported:
//!
//! - **Refresh token** — load a previously saved token with [`TokenStore`] (recommended
//!   for long-running bots).
//! - **Password** — call [`SteamClient::log_on_with_password`]; handle the
//!   [`crate::SteamError::SteamGuardRequired`] error to supply a Steam Guard code.
//! - **Cookie** — call [`SteamClient::log_on_with_cookies`] with existing
//!   `steamcommunity.com` session cookies; the library exchanges them for a
//!   short-lived web logon token internally.
//!
//! # Example: refresh token (persistent session)
//!
//! ```rust,no_run
//! use steam_client::{AuthEvent, LogOnDetails, SteamClient, SteamEvent, TokenStore};
//!
//! #[tokio::main]
//! async fn main() {
//!     let mut client = SteamClient::new(Default::default());
//!     let token_store = TokenStore::new("steam_tokens.json");
//!
//!     // Load previous session if available, fall back to empty details on first run.
//!     let logon_details = token_store.load(None).unwrap_or_default();
//!     client.log_on(logon_details).await.unwrap();
//!
//!     // In your event loop, persist the token whenever it is refreshed.
//!     // while let Some(event) = client.poll_event_timeout(Duration::from_secs(30)).await.unwrap() {
//!     //     if let SteamEvent::Auth(AuthEvent::RefreshToken { token, account_name }) = event {
//!     //         token_store.save(account_name, token, 0).unwrap();
//!     //     }
//!     // }
//! }
//! ```
//!
//! # Example: cookie login
//!
//! ```rust,no_run
//! use steam_client::SteamClient;
//!
//! #[tokio::main]
//! async fn main() {
//!     let mut client = SteamClient::new(Default::default());
//!
//!     // Cookies must include at least `steamLoginSecure` for the target account.
//!     let cookies = "sessionid=abc123; steamLoginSecure=76561198000000000%7C%7Ctoken";
//!     let response = client.log_on_with_cookies(cookies).await.unwrap();
//!     println!("Logged in as {}", response.steam_id.steam3());
//! }
//! ```

// Core modules (at root level)
mod connection;
mod error;
mod options;
mod protocol;
mod types;

// Organized submodules
pub mod cache;
pub mod client;
pub mod internal;
pub mod persistence;
pub mod services;
pub mod utils;

// ============================================================================
// Public Re-exports
// ============================================================================

// Core types
// Client
pub use client::{AccountEvent, AppChange, AppInfoData, AppsEvent, AuthEvent, CSGOEvent, ChatEvent, ConnectionEvent, ContentEvent, CsgoClientHello, CsgoCommendation, CsgoPartyEntry, CsgoRanking, CsgoWelcome, FriendEntry, FriendsEvent, LicenseEntry, MessageHandler, MockHandles, NotificationsEvent, PackageChange, PackageInfoData, SteamClient, SteamClientBuilder, SteamEvent, SteamEventStream, SystemEvent, UserPersona};
pub use error::SteamError;
// Internal (exposed for testing)
pub use internal::{HeartbeatManager, JobManager, JobResponse, MessageSender, MockMessageSender, ReconnectManager, ReconnectState, SentMessage, SessionInfo};
pub use options::{HeartbeatOptions, ReconnectConfig, SteamOptions};
pub use persistence::TokenStore;
// Services
pub use services::{
    // Account
    AccountInfo,
    AccountLimitations,
    // Friends
    AddFriendResult,
    // Apps
    AppInfo,
    AppInfoRequest,
    // Economy
    AssetClass,
    AssetClassInfo,
    // App auth
    AuthSessionResult,
    AuthSessionTicket,
    // Family sharing
    AuthorizedBorrower,
    AuthorizedDevice,
    // CDN
    CdnAuthToken,
    // Chat
    ChatMessage,
    // Chat room
    ChatRole,
    ChatRoom,
    ChatRoomGroup,
    ChatRoomMember,
    ChatRoomMessage,
    ContentServer,
    DepotManifest,
    EmailInfo,
    Emoticon,
    EquippedProfileItems,
    FileChunk,
    Friend,
    FriendMessageSession,
    FriendsGroup,
    // GC
    GCMessage,
    GCProtoHeader,
    GCSendOptions,
    // Game servers
    GameServer,
    HistoryMessage,
    // Idler
    IdlerHandle,
    InviteLinkInfo,
    ManifestFile,
    // Notifications
    Notification,
    NotificationType,
    OwnedApp,
    OwnedProfileItems,
    PackageInfo,
    PackageInfoRequest,
    PrivacySettings,
    ProfileItem,
    // Published files
    PublishedFileDetails,
    // Rich presence
    RichPresenceData,
    RolePermissions,
    SendMessageResult,
    SteamGuardDetails,
    // Trading
    TradeRestrictions,
    TradeUrl,
    // Two-factor
    TwoFactorSecrets,
    VacBans,
    VoteData,
    WalletInfo,
};
// Re-export commonly used types from other crates
pub use steam_enums::{EAccountType, EAppType, EChatEntryType, EClanRelationship, ECurrencyCode, EFriendRelationship, ELicenseType, EPaymentMethod, EPersonaState, EPlatformType, EResult, EServerType, EUniverse};
pub use steamid::SteamID;
pub use types::{LogOnDetails, LogOnResponse};
// Utils (exposed for advanced usage)
pub use utils::{Clock, HttpClient, HttpResponse, MockClock, MockHttpClient, MockRequest, MockRng, ReqwestHttpClient, Rng, SystemClock, ThreadRng};
