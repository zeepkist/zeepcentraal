//! Client module containing core Steam client implementation.
//!
//! This module provides:
//! - [`SteamClient`] - The main Steam client struct
//! - [`SteamClientBuilder`] - Builder pattern for constructing clients
//! - [`SteamEvent`] and related event types for handling Steam messages

mod builder;
mod events;
#[cfg(feature = "static-app-list")]
pub(crate) mod static_app_list;
pub(crate) mod steam_client;

// Re-export all public types
pub use builder::{MockHandles, SteamClientBuilder};
pub use events::{AccountEvent, AppChange, AppInfoData, AppsEvent, AuthEvent, CSGOEvent, ChatEvent, ConnectionEvent, ContentEvent, CsgoClientHello, CsgoCommendation, CsgoPartyEntry, CsgoRanking, CsgoWelcome, FriendEntry, FriendsEvent, LicenseEntry, MessageHandler, NotificationsEvent, PackageChange, PackageInfoData, SteamEvent, SystemEvent};
pub use steam_client::{SteamClient, SteamEventStream, UserPersona};
