//! Read-only accessors on `SteamClient`.
//!
//! Split out of the main client impl so it's easy to scan the publicly
//! readable state in one place. Mutation is exposed via the corresponding
//! async methods (`set_persona`, `games_played`, …) defined elsewhere.

use steamid::SteamID;

use super::{SteamClient, UserPersona};
use crate::client::events::LicenseEntry;
use crate::types::{AccountInfo, EmailInfo, Limitations, VacStatus, WalletInfo};

impl SteamClient {
    /// Check if logged in.
    #[must_use]
    pub fn is_logged_in(&self) -> bool {
        self.steam_id.is_some()
    }

    /// The logged-in SteamID, or `None` if not logged in.
    #[must_use]
    pub fn steam_id(&self) -> Option<SteamID> {
        self.steam_id
    }

    /// Public IP address as seen by Steam, or `None` if not logged in.
    #[must_use]
    pub fn public_ip(&self) -> Option<String> {
        self.account.read().public_ip.clone()
    }

    /// Cell ID assigned for content servers, or `None` if not logged in.
    #[must_use]
    pub fn cell_id(&self) -> Option<u32> {
        self.account.read().cell_id
    }

    /// Vanity URL slug, if the account has one.
    #[must_use]
    pub fn vanity_url(&self) -> Option<String> {
        self.account.read().vanity_url.clone()
    }

    /// Account info as received from Steam, or `None` if not yet received.
    #[must_use]
    pub fn account_info(&self) -> Option<AccountInfo> {
        self.account.read().info.clone()
    }

    /// Email info for the logged-in account, or `None` if not yet received.
    #[must_use]
    pub fn email_info(&self) -> Option<EmailInfo> {
        self.account.read().email.clone()
    }

    /// Account limitations (limited / community-banned / locked).
    #[must_use]
    pub fn limitations(&self) -> Option<Limitations> {
        self.account.read().limitations.clone()
    }

    /// VAC ban status for the logged-in account.
    #[must_use]
    pub fn vac_status(&self) -> Option<VacStatus> {
        self.account.read().vac.clone()
    }

    /// Wallet information for the logged-in account.
    #[must_use]
    pub fn wallet(&self) -> Option<WalletInfo> {
        self.account.read().wallet.clone()
    }

    /// Owned licenses (apps and packages). Populated after `LicenseList` event.
    /// Returns a clone — the licenses Vec sits behind a `RwLock`.
    #[must_use]
    pub fn licenses(&self) -> Vec<LicenseEntry> {
        self.apps.read().licenses.clone()
    }

    /// App IDs currently set via `games_played` (the "Playing" status).
    #[must_use]
    pub fn playing_app_ids(&self) -> Vec<u32> {
        self.apps.read().playing_app_ids.clone()
    }

    /// Whether Steam has blocked this client from setting a Playing status.
    #[must_use]
    pub fn playing_blocked(&self) -> bool {
        self.apps.read().playing_blocked
    }

    /// Friend relationship for a given SteamID, if any.
    #[must_use]
    pub fn friend_relationship(&self, steam_id: SteamID) -> Option<u32> {
        self.social.read().friends.get(&steam_id).copied()
    }

    /// Snapshot of `(SteamID, relationship)` pairs for every known friend.
    ///
    /// Returns a `Vec` rather than an iterator because the underlying friends
    /// map sits behind a `RwLock` — the read guard can't outlive the function.
    /// Renamed from `friends()` to make room for the `friends()` service-handle
    /// constructor (see [`SteamClient::friends`]).
    #[must_use]
    pub fn friend_list(&self) -> Vec<(SteamID, u32)> {
        self.social.read().friends.iter().map(|(sid, rel)| (*sid, *rel)).collect()
    }

    /// Look up a cached persona by SteamID. Returns a clone — the persona map
    /// sits behind a `RwLock` and we cannot hand out an internal reference.
    #[must_use]
    pub fn persona(&self, steam_id: SteamID) -> Option<UserPersona> {
        self.social.read().users.get(&steam_id).cloned()
    }

    /// Number of successful (re)connects in this client's lifetime.
    #[must_use]
    pub fn connection_count(&self) -> u32 {
        self.connection_count
    }
}
