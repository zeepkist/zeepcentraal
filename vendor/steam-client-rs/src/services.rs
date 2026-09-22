//! Steam service handlers.
//!
//! This module contains implementations for various Steam platform services.

pub mod account;
pub mod appauth;
pub mod apps;
pub mod cdn;
pub mod chat;
pub mod chatroom;
pub mod csgo;
pub mod econ;
pub mod familysharing;
pub mod friends;
pub mod friends_handle;
pub mod gameservers;
pub mod gc;
pub mod gifts;
pub mod idler;
pub mod notifications;
pub mod pubfiles;
pub mod rich_presence;
pub mod session_recovery;
pub mod store;
pub mod trading;
pub mod twofactor;

// Re-export public types
pub use account::{AccountInfo, AccountLimitations, EmailInfo, PrivacySettings, SteamGuardDetails, VacBans, WalletInfo};
pub use appauth::{AuthSessionResult, AuthSessionTicket};
pub use apps::{AppInfo, AppInfoRequest, OwnedApp, PackageInfo, PackageInfoRequest};
pub use cdn::{CdnAuthToken, ContentServer, DepotManifest, FileChunk, ManifestFile};
pub use chat::{ChatMessage, FriendMessageSession, HistoryMessage, SendMessageResult};
pub use chatroom::{ChatRole, ChatRoom, ChatRoomGroup, ChatRoomMember, ChatRoomMessage, InviteLinkInfo, RolePermissions};
pub use csgo::{CSGOClient, CsgoGameMode, CsgoRank, CsgoRichPresence, JoinLobbyResult, LobbyConfig, LobbyData, LobbyMember, LobbyMetadata};
pub use econ::{AssetClass, AssetClassInfo, Emoticon, EquippedProfileItems, OwnedProfileItems, ProfileItem, TradeUrl};
pub use familysharing::{AuthorizedBorrower, AuthorizedDevice};
pub use friends::{AddFriendResult, Friend, FriendsGroup};
pub use friends_handle::FriendsHandle;
pub use gameservers::GameServer;
pub use gc::{GCMessage, GCProtoHeader, GCSendOptions};
pub use gifts::GiftDetails;
pub use idler::IdlerHandle;
pub use notifications::{Notification, NotificationType};
pub use pubfiles::{PublishedFileDetails, VoteData};
pub use rich_presence::RichPresenceData;
pub use session_recovery::SessionRecovery;
pub use store::StoreTag;
pub use trading::TradeRestrictions;
pub use twofactor::TwoFactorSecrets;
