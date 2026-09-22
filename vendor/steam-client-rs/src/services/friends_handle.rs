//! `FriendsHandle` — ergonomic handle for the friends API.
//!
//! Forwards to the existing `&mut SteamClient` methods. Constructed via
//! [`SteamClient::friends`]. Same pattern as the [`CSGOClient`] handle —
//! organizes the API by topic while keeping the existing inherent methods
//! on `SteamClient` for backwards compatibility.
//!
//! This is the Phase-5 handle pattern: once Phase 4 fully lands and the
//! underlying methods take `&self`, the handle can also borrow shared instead
//! of mutable, enabling concurrent calls on different handles.
//!
//! [`CSGOClient`]: crate::services::CSGOClient

use steamid::SteamID;

use crate::client::SteamClient;
use crate::error::SteamError;
use crate::services::friends::AddFriendResult;

/// Handle for friends-related operations. Borrows the client mutably for now.
pub struct FriendsHandle<'a> {
    pub(crate) client: &'a mut SteamClient,
}

impl<'a> FriendsHandle<'a> {
    pub(crate) fn new(client: &'a mut SteamClient) -> Self {
        Self { client }
    }

    /// Request the friends list from Steam.
    pub async fn request(&mut self) -> Result<(), SteamError> {
        self.client.request_friends().await
    }

    /// Add a friend by SteamID.
    pub async fn add(&mut self, steam_id: SteamID) -> Result<AddFriendResult, SteamError> {
        self.client.add_friend(steam_id).await
    }

    /// Remove a friend by SteamID.
    pub async fn remove(&mut self, steam_id: SteamID) -> Result<(), SteamError> {
        self.client.remove_friend(steam_id).await
    }

    /// Get Steam levels for a list of SteamIDs.
    pub async fn steam_levels(&mut self, steam_ids: Vec<SteamID>) -> Result<std::collections::HashMap<SteamID, u32>, SteamError> {
        self.client.get_steam_levels(steam_ids).await
    }

    /// Set a nickname for a friend.
    pub async fn set_nickname(&mut self, steam_id: SteamID, nickname: &str) -> Result<(), SteamError> {
        self.client.set_nickname(steam_id, nickname).await
    }

    /// Get all friend nicknames.
    pub async fn nicknames(&mut self) -> Result<std::collections::HashMap<SteamID, String>, SteamError> {
        self.client.get_nicknames().await
    }
}

impl SteamClient {
    /// Friends-service handle. Provides a topic-organized view of the
    /// friends API.
    ///
    /// ```rust,no_run
    /// # use steam_client::SteamClient;
    /// # use steamid::SteamID;
    /// # async fn demo(client: &mut SteamClient) -> Result<(), Box<dyn std::error::Error>> {
    /// let friend = SteamID::from_steam_id64(76561198000000000);
    /// client.friends().add(friend).await?;
    /// let levels = client.friends().steam_levels(&[friend]).await?;
    /// # Ok(())
    /// # }
    /// ```
    pub fn friends(&mut self) -> FriendsHandle<'_> {
        FriendsHandle::new(self)
    }
}
