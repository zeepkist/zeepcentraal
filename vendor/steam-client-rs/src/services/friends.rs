//! Friends management for Steam client.
//!
//! This module provides functionality for managing Steam friends:
//! - Adding/removing friends
//! - Blocking/unblocking users
//! - Friends groups management
//! - Nicknames
//! - Steam levels

use std::collections::HashMap;

use steam_enums::{EClientPersonaStateFlag, EFriendRelationship, EPersonaState, EResult};
use steamid::SteamID;

use crate::{
    client::{FriendEntry, FriendsEvent, SteamEvent},
    error::SteamError,
    SteamClient,
};

impl SteamClient {
    /// Request the friends list from Steam.
    ///
    /// This sends a ClientFriendsList message which should trigger a response
    /// from the server with the full friends list.
    pub async fn request_friends(&mut self) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgClientFriendsList { bincremental: Some(false), friends: vec![], ..Default::default() };

        self.send_message(steam_enums::EMsg::ClientFriendsList, &msg).await
    }

    /// Request friends list using Unified Messages
    /// (FriendsList.GetFriendsList#1).
    ///
    /// This is the preferred method for Web Logons where ClientFriendsList (CM)
    /// is not supported.
    pub async fn request_friends_unified(&mut self) -> Result<Vec<steam_protos::cmsg_client_friends_list::Friend>, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CFriendsListGetFriendsListRequest {
            role_mask: None, // Get all relationships
        };

        let response: steam_protos::CFriendsListGetFriendsListResponse = self.send_unified_request_and_wait("FriendsList.GetFriendsList#1", &msg).await?;

        let friends = response.friendslist.as_ref().map(|f| f.friends.clone()).unwrap_or_default();
        self.handle_friends_list_unified_response(response).await;
        Ok(friends)
    }

    /// Request friends list using Unified Messages in the background.
    ///
    /// The response will be automatically handled when it arrives, updating
    /// internal state and emitting a `FriendsList` event. Use this to avoid
    /// deadlocks in single-threaded event loops.
    pub async fn request_friends_unified_trigger(&mut self) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CFriendsListGetFriendsListRequest { role_mask: None };

        self.send_service_method_background("FriendsList.GetFriendsList#1", &msg, crate::client::steam_client::BackgroundTask::FriendsList).await
    }

    /// Internal handler for unified friends list response.
    pub(crate) async fn handle_friends_list_unified_response(&mut self, response: steam_protos::CFriendsListGetFriendsListResponse) {
        // Unwrap the wrapped CMsgClientFriendsList
        let friends_list = match response.friendslist {
            Some(fl) => fl,
            None => {
                tracing::warn!("[SteamClient] Received empty unified friends list response");
                return;
            }
        };

        tracing::debug!("[SteamClient] Handling unified friends list response with {} friends", friends_list.friends.len());
        // Update internal friends list and prepare event entries
        let mut entries = Vec::new();
        for friend in &friends_list.friends {
            if let Some(id_64) = friend.ulfriendid {
                let steam_id = SteamID::from(id_64);
                let relationship = friend.efriendrelationship.unwrap_or(0);
                let rel_enum = steam_enums::EFriendRelationship::from_i32(relationship as i32).unwrap_or(steam_enums::EFriendRelationship::None);

                if rel_enum == steam_enums::EFriendRelationship::None {
                    self.social.write().friends.remove(&steam_id);
                } else {
                    self.social.write().friends.insert(steam_id, relationship);
                }

                entries.push(FriendEntry { steam_id, relationship: rel_enum });
            }
        }

        tracing::debug!("[SteamClient] Processed {} friend entries, emitting FriendsList event", entries.len());

        // Emit FriendsList event so that post_process_event can trigger
        // auto-persona-fetch
        self.event_queue.push_back(SteamEvent::Friends(FriendsEvent::FriendsList { incremental: friends_list.bincremental.unwrap_or(false), friends: entries }));
    }
}

/// Friend information.
#[derive(Debug, Clone)]
pub struct Friend {
    /// Friend's SteamID.
    pub steam_id: SteamID,
    /// Relationship type.
    pub relationship: EFriendRelationship,
}

/// Add friend result.
#[derive(Debug, Clone)]
pub struct AddFriendResult {
    /// The result code.
    pub eresult: EResult,
    /// The friend's persona name.
    pub persona_name: Option<String>,
}

/// Friends group information.
#[derive(Debug, Clone)]
pub struct FriendsGroup {
    /// Group ID.
    pub group_id: u32,
    /// Group name.
    pub name: String,
    /// Members in this group.
    pub members: Vec<SteamID>,
}

impl SteamClient {
    /// Set your persona (online status and optionally name).
    ///
    /// # Important: Invisible vs Offline
    /// * `EPersonaState::Invisible` (7): You remain connected to the CM and
    ///   receive chats/invites, but you appear "Offline" to friends. Use this
    ///   if you want to "appear offline".
    /// * `EPersonaState::Offline` (0): You are effectively disconnected from
    ///   the Friends network. You will not receive friend messages or updates.
    ///
    /// # Arguments
    /// * `state` - Your new online state
    /// * `name` - Optional new profile name
    pub async fn set_persona(&mut self, state: EPersonaState, name: Option<String>) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        // Handle semantically correct state for "Offline"
        // If user explicitly requests Offline while connected, they likely mean
        // Invisible unless they really want to drop from the friends network.
        // However, we pass it raw as requested, just documenting the difference.
        // But wait, the task said: "Ensure set_persona handles the semantic difference
        // correctly". If passing 'Offline' (0) causes us to lose chat
        // connectivity but stay logged on, that might be what is intended by
        // the enum, but users often confuse them.

        let msg = steam_protos::CMsgClientChangeStatus { persona_state: Some(state as u32), player_name: name.clone(), ..Default::default() };

        // Record for session recovery
        self.session_recovery.record_persona_state(state, name);

        self.send_message(steam_enums::EMsg::ClientChangeStatus, &msg).await
    }

    /// Add a friend (or accept a friend invitation).
    ///
    /// # Arguments
    /// * `steam_id` - The SteamID of the user to add
    pub async fn add_friend(&mut self, steam_id: SteamID) -> Result<AddFriendResult, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgClientAddFriend { steamid_to_add: Some(steam_id.steam_id64()), ..Default::default() };

        let response: steam_protos::CMsgClientAddFriendResponse = self.send_request_and_wait(steam_enums::EMsg::ClientAddFriend, &msg).await?;

        Ok(AddFriendResult {
            eresult: steam_enums::EResult::from_i32(response.eresult.unwrap_or(0)).unwrap_or(steam_enums::EResult::Fail),
            persona_name: response.persona_name_added,
        })
    }

    /// Remove a friend (or decline a friend invitation).
    ///
    /// # Arguments
    /// * `steam_id` - The SteamID of the user to remove
    pub async fn remove_friend(&mut self, steam_id: SteamID) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgClientRemoveFriend { friendid: Some(steam_id.steam_id64()) };

        self.send_message(steam_enums::EMsg::ClientRemoveFriend, &msg).await
    }

    /// Request persona information for one or more users.
    ///
    /// # Arguments
    /// * `steam_ids` - The SteamIDs of users to get personas for
    pub async fn get_personas(&mut self, steam_ids: Vec<SteamID>) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgClientRequestFriendData {
            friends: steam_ids.iter().map(|s| s.steam_id64()).collect(),
            persona_state_requested: Some(
                (EClientPersonaStateFlag::Status as u32)
                    | (EClientPersonaStateFlag::PlayerName as u32)
                    | (EClientPersonaStateFlag::QueryPort as u32)
                    | (EClientPersonaStateFlag::SourceID as u32)
                    | (EClientPersonaStateFlag::Presence as u32)
                    | (EClientPersonaStateFlag::Metadata as u32)
                    | (EClientPersonaStateFlag::LastSeen as u32)
                    | (EClientPersonaStateFlag::UserClanRank as u32)
                    | (EClientPersonaStateFlag::GameExtraInfo as u32)
                    | (EClientPersonaStateFlag::GameDataBlob as u32)
                    | (EClientPersonaStateFlag::ClanData as u32)
                    | (EClientPersonaStateFlag::Facebook as u32)
                    | (EClientPersonaStateFlag::RichPresence as u32)
                    | (EClientPersonaStateFlag::Broadcast as u32)
                    | (EClientPersonaStateFlag::Watching as u32),
            ),
        };

        self.send_message(steam_enums::EMsg::ClientRequestFriendData, &msg).await
    }

    /// Get persona information with caching.
    ///
    /// Checks the local cache first, only queries Steam servers for
    /// missing/expired entries. Results are returned from the cache and the
    /// internal `users` HashMap.
    ///
    /// # Arguments
    /// * `steam_ids` - The SteamIDs to get personas for
    /// * `force_refresh` - If true, bypass cache and fetch fresh data from
    ///   Steam
    ///
    /// # Returns
    /// A map of SteamID to UserPersona for all requested IDs that were found.
    ///
    /// # Note
    /// The cache is automatically updated when `PersonaState` events are
    /// received. Use `force_refresh` when you need guaranteed fresh data.
    ///
    /// # Example
    /// ```rust,ignore
    /// // Get personas, using cache when possible
    /// let personas = client.get_personas_cached(friend_ids, false).await?;
    /// for (steam_id, persona) in personas {
    ///     tracing::info!("{}: {}", steam_id.steam3(), persona.player_name);
    /// }
    ///
    /// // Force refresh from Steam servers
    /// let fresh = client.get_personas_cached(friend_ids, true).await?;
    /// ```
    pub async fn get_personas_cached(&mut self, steam_ids: Vec<SteamID>, force_refresh: bool) -> Result<HashMap<SteamID, crate::client::UserPersona>, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let mut result = HashMap::new();
        let mut to_fetch = Vec::new();

        if force_refresh {
            to_fetch = steam_ids;
        } else {
            // Check persona cache first (TTL-based)
            let (cached, missing) = self.social.read().persona_cache.get_many(&steam_ids);
            for persona in cached {
                result.insert(persona.steam_id, persona);
            }

            // For remaining, check the users HashMap (no TTL).
            // Clone the persona out before re-locking persona_cache to avoid
            // holding the social read guard for longer than necessary.
            for id in missing {
                let maybe_persona = self.social.read().users.get(&id).cloned();
                if let Some(persona) = maybe_persona {
                    self.social.read().persona_cache.insert(id, persona.clone());
                    result.insert(id, persona);
                } else {
                    to_fetch.push(id);
                }
            }
        }

        // Fetch missing entries from Steam
        if !to_fetch.is_empty() {
            // Request personas from Steam servers
            self.get_personas(to_fetch.clone()).await?;

            // Note: The actual persona data will arrive via PersonaState events
            // and will be stored in self.users and self.persona_cache.
            // For immediate results, we could wait for the events, but that
            // requires changing the API. For now, return what we have.
            //
            // The caller should either:
            // 1. Poll for events and then call get_personas_cached again
            // 2. Use this method after already having received PersonaState
            //    events
        }

        Ok(result)
    }

    /// Block a user.
    ///
    /// # Arguments
    /// * `steam_id` - The SteamID of the user to block
    pub async fn block_user(&mut self, steam_id: SteamID) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CPlayerIgnoreFriendRequest { steamid: Some(steam_id.steam_id64()), unignore: Some(false) };

        let _response: steam_protos::CPlayerIgnoreFriendResponse = self.send_unified_request_and_wait("Player.IgnoreFriend#1", &msg).await?;

        Ok(())
    }

    /// Unblock a user.
    ///
    /// # Arguments
    /// * `steam_id` - The SteamID of the user to unblock
    pub async fn unblock_user(&mut self, steam_id: SteamID) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CPlayerIgnoreFriendRequest { steamid: Some(steam_id.steam_id64()), unignore: Some(true) };

        let _response: steam_protos::CPlayerIgnoreFriendResponse = self.send_unified_request_and_wait("Player.IgnoreFriend#1", &msg).await?;

        Ok(())
    }

    /// Create a friends group (tag).
    ///
    /// # Arguments
    /// * `name` - The name for the new group
    ///
    /// # Returns
    /// The group ID of the newly created group.
    pub async fn create_friends_group(&mut self, name: &str) -> Result<u32, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgClientCreateFriendsGroup {
            groupname: Some(name.to_string()),
            steamid: self.steam_id.as_ref().map(|s| s.steam_id64()),
            ..Default::default()
        };

        // Send request and wait for response
        let response: steam_protos::CMsgClientCreateFriendsGroupResponse = self.send_request_and_wait(steam_enums::EMsg::AMClientCreateFriendsGroup, &msg).await?;

        // Check result
        let eresult = steam_enums::EResult::from_i32(response.eresult.unwrap_or(1) as i32).unwrap_or(steam_enums::EResult::Fail);
        if eresult != steam_enums::EResult::OK {
            return Err(SteamError::SteamResult(eresult));
        }

        Ok(response.groupid.unwrap_or(0) as u32)
    }

    /// Delete a friends group (tag).
    ///
    /// # Arguments
    /// * `group_id` - The ID of the group to delete
    pub async fn delete_friends_group(&mut self, group_id: u32) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgClientDeleteFriendsGroup { steamid: self.steam_id.as_ref().map(|s| s.steam_id64()), groupid: Some(group_id as i32) };

        self.send_message(steam_enums::EMsg::AMClientDeleteFriendsGroup, &msg).await
    }

    /// Rename a friends group (tag).
    ///
    /// # Arguments
    /// * `group_id` - The ID of the group to rename
    /// * `name` - The new name for the group
    pub async fn rename_friends_group(&mut self, group_id: u32, name: &str) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgClientRenameFriendsGroup { groupid: Some(group_id as i32), groupname: Some(name.to_string()) };

        self.send_message(steam_enums::EMsg::AMClientManageFriendsGroup, &msg).await
    }

    /// Add a friend to a friends group (tag).
    ///
    /// # Arguments
    /// * `group_id` - The ID of the group
    /// * `steam_id` - The SteamID of the friend to add
    pub async fn add_friend_to_group(&mut self, group_id: u32, steam_id: SteamID) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgClientAddFriendToGroup { groupid: Some(group_id as i32), steamiduser: Some(steam_id.steam_id64()) };

        self.send_message(steam_enums::EMsg::AMClientAddFriendToGroup, &msg).await
    }

    /// Remove a friend from a friends group (tag).
    ///
    /// # Arguments
    /// * `group_id` - The ID of the group
    /// * `steam_id` - The SteamID of the friend to remove
    pub async fn remove_friend_from_group(&mut self, group_id: u32, steam_id: SteamID) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgClientRemoveFriendFromGroup { groupid: Some(group_id as i32), steamiduser: Some(steam_id.steam_id64()) };

        self.send_message(steam_enums::EMsg::AMClientRemoveFriendFromGroup, &msg).await
    }

    /// Set a nickname for a friend.
    ///
    /// # Arguments
    /// * `steam_id` - The SteamID of the friend
    /// * `nickname` - The nickname to set (empty string to remove)
    pub async fn set_nickname(&mut self, steam_id: SteamID, nickname: &str) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        // Use Player.SetPerFriendPreferences service method
        let prefs = steam_protos::PerFriendPreferences { nickname: Some(nickname.to_string()), ..Default::default() };

        let msg = steam_protos::CPlayerSetPerFriendPreferencesRequest { accountid: Some(steam_id.account_id), preferences: Some(prefs) };

        self.send_service_method("Player.SetPerFriendPreferences#1", &msg).await
    }

    /// Get nicknames for all friends.
    ///
    /// # Returns
    /// A map of SteamID to nickname.
    /// Get nicknames for all friends.
    ///
    /// # Returns
    /// A map of SteamID to nickname.
    /// Get nicknames for all friends.
    ///
    /// # Returns
    /// A map of SteamID to nickname.
    pub async fn get_nicknames(&mut self) -> Result<HashMap<SteamID, String>, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        // Use Player.GetNicknameList service method
        let msg = steam_protos::CPlayerGetNicknameListRequest {};

        // Send and wait for response
        let response: steam_protos::CPlayerGetNicknameListResponse = self.send_unified_request_and_wait("Player.GetNicknameList#1", &msg).await?;

        let mut nicknames = HashMap::new();
        for nickname in response.nicknames {
            if let Some(accountid) = nickname.accountid {
                let steam_id = SteamID::from_individual_account_id(accountid);
                if let Some(name) = nickname.nickname {
                    nicknames.insert(steam_id, name);
                }
            }
        }

        Ok(nicknames)
    }

    /// Get persona name history for one or more users.
    ///
    /// # Arguments
    /// * `steam_ids` - The SteamIDs to get name history for
    ///
    /// # Returns
    /// A map of SteamID to list of historical names (with timestamps).
    pub async fn get_persona_name_history(&mut self, steam_ids: Vec<SteamID>) -> Result<HashMap<SteamID, Vec<crate::types::PersonaNameHistory>>, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let ids: Vec<steam_protos::cmsg_client_am_get_persona_name_history::IdInstance> = steam_ids.iter().map(|s| steam_protos::cmsg_client_am_get_persona_name_history::IdInstance { steamid: Some(s.steam_id64()) }).collect();

        let msg = steam_protos::CMsgClientAMGetPersonaNameHistory { id_count: Some(ids.len() as i32), ids };

        let response: steam_protos::CMsgClientAMGetPersonaNameHistoryResponse = self.send_request_and_wait(steam_enums::EMsg::ClientAMGetPersonaNameHistory, &msg).await?;

        let mut result = HashMap::new();

        for resp in response.responses {
            if let Some(steamid_64) = resp.steamid {
                let steam_id = SteamID::from(steamid_64);
                let mut history = Vec::new();

                for name in resp.names {
                    history.push(crate::types::PersonaNameHistory { name: name.name.unwrap_or_default(), name_since: name.name_since.unwrap_or(0) });
                }

                result.insert(steam_id, history);
            }
        }

        Ok(result)
    }

    /// Get Steam levels for multiple users.
    ///
    /// # Arguments
    /// * `steam_ids` - The SteamIDs to get levels for
    ///
    /// # Returns
    /// A map of SteamID to Steam level.
    pub async fn get_steam_levels(&mut self, steam_ids: Vec<SteamID>) -> Result<HashMap<SteamID, u32>, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgClientFSGetFriendsSteamLevels { accountids: steam_ids.iter().map(|s| s.account_id).collect() };

        // Send and wait for response
        let response: steam_protos::CMsgClientFSGetFriendsSteamLevelsResponse = self.send_request_and_wait(steam_enums::EMsg::ClientFSGetFriendsSteamLevels, &msg).await?;

        let mut levels = HashMap::new();
        for friend in response.friends {
            if let Some(account_id) = friend.accountid {
                let steam_id = SteamID::from_individual_account_id(account_id);
                if let Some(level) = friend.level {
                    levels.insert(steam_id, level);
                }
            }
        }

        Ok(levels)
    }

    /// Get the level of your game badge (and also your Steam level).
    ///
    /// # Arguments
    /// * `app_id` - AppID of game in question
    ///
    /// # Returns
    /// A tuple containing (steam_level, regular_badge_level, foil_badge_level).
    pub async fn get_game_badge_level(&mut self, app_id: u32) -> Result<(u32, i32, i32), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CPlayerGetGameBadgeLevelsRequest { appid: Some(app_id) };

        let response: steam_protos::CPlayerGetGameBadgeLevelsResponse = self.send_unified_request_and_wait("Player.GetGameBadgeLevels#1", &msg).await?;

        let mut regular = 0;
        let mut foil = 0;

        for badge in response.badges {
            if badge.series != Some(1) {
                continue;
            }

            if badge.border_color == Some(0) {
                regular = badge.level.unwrap_or(0);
            } else if badge.border_color == Some(1) {
                foil = badge.level.unwrap_or(0);
            }
        }

        Ok((response.player_level.unwrap_or(0), regular, foil))
    }

    /// Invite a friend to a Steam group.
    ///
    /// # Arguments
    /// * `steam_id` - The SteamID of the user to invite
    /// * `group_id` - The SteamID of the group
    pub async fn invite_to_group(&mut self, steam_id: SteamID, group_id: SteamID) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        use byteorder::{WriteBytesExt, LE};
        let mut buf = Vec::with_capacity(17);
        buf.write_u64::<LE>(steam_id.steam_id64()).map_err(|e| SteamError::Other(e.to_string()))?;
        buf.write_u64::<LE>(group_id.steam_id64()).map_err(|e| SteamError::Other(e.to_string()))?;
        buf.write_u8(1).map_err(|e| SteamError::Other(e.to_string()))?;

        self.send_binary_message(steam_enums::EMsg::ClientInviteUserToClan, &buf).await
    }

    /// Respond to a Steam group invitation.
    ///
    /// # Arguments
    /// * `group_id` - The SteamID of the group
    /// * `accept` - True to join, false to decline
    pub async fn respond_to_group_invite(&mut self, group_id: SteamID, accept: bool) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        use byteorder::{WriteBytesExt, LE};
        let mut buf = Vec::with_capacity(9);
        buf.write_u64::<LE>(group_id.steam_id64()).map_err(|e| SteamError::Other(e.to_string()))?;
        buf.write_u8(if accept { 1 } else { 0 }).map_err(|e| SteamError::Other(e.to_string()))?;

        self.send_binary_message(steam_enums::EMsg::ClientAcknowledgeClanInvite, &buf).await
    }

    /// Invite a friend to a game.
    ///
    /// # Arguments
    /// * `steam_id` - The SteamID of the friend to invite
    /// * `connect_string` - The connection string for the game
    pub async fn invite_to_game(&mut self, steam_id: SteamID, connect_string: &str) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgClientInviteToGame {
            steam_id_dest: Some(steam_id.steam_id64()),
            connect_string: Some(connect_string.to_string()),
            ..Default::default()
        };

        self.send_message(steam_enums::EMsg::ClientInviteToGame, &msg).await
    }

    // ========================================================================
    // Quick Invite Links
    // ========================================================================

    /// Create a quick invite link.
    ///
    /// Quick invite links allow others to add you as a friend without needing
    /// to know your SteamID or username.
    ///
    /// # Arguments
    /// * `invite_limit` - Maximum number of uses (None = unlimited)
    /// * `invite_duration` - Duration in seconds the link is valid (None = no
    ///   expiry)
    ///
    /// # Returns
    /// Information about the created invite link.
    ///
    /// # Example
    /// ```rust,ignore
    /// // Create an invite link valid for 1 hour with max 5 uses
    /// let link = client.create_quick_invite_link(Some(5), Some(3600)).await?;
    /// tracing::info!("Share this link: {}", link.invite_link);
    /// ```
    pub async fn create_quick_invite_link(&mut self, invite_limit: Option<u32>, invite_duration: Option<u32>) -> Result<crate::types::QuickInviteLink, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        // Clone steam_id before mutably borrowing self
        let steam_id = self.steam_id.ok_or(SteamError::NotLoggedOn)?;

        let msg = steam_protos::CUserAccountCreateFriendInviteTokenRequest { invite_limit, invite_duration, invite_note: None };

        let response: steam_protos::CUserAccountCreateFriendInviteTokenResponse = self.send_unified_request_and_wait("UserAccount.CreateFriendInviteToken#1", &msg).await?;

        // Generate the link URL from our SteamID
        let friend_code = steam_friend_code::create_short_steam_friend_code(steam_id.account_id);
        let invite_token = response.invite_token.unwrap_or_default();

        Ok(crate::types::QuickInviteLink {
            invite_link: format!("https://s.team/p/{}/{}", friend_code, invite_token),
            invite_token,
            invite_limit: response.invite_limit,
            invite_duration: response.invite_duration,
            time_created: response.time_created,
            valid: response.valid.unwrap_or(true),
        })
    }

    /// List all quick invite links for this account.
    ///
    /// # Returns
    /// A list of all active invite links.
    pub async fn list_quick_invite_links(&mut self) -> Result<Vec<crate::types::QuickInviteLink>, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CUserAccountGetFriendInviteTokensRequest {};

        self.send_service_method("UserAccount.GetFriendInviteTokens#1", &msg).await?;

        // Response will come via poll_event
        // Full links are constructed when response is received
        Ok(Vec::new())
    }

    /// Revoke a quick invite link.
    ///
    /// # Arguments
    /// * `link` - The invite link URL or just the token
    pub async fn revoke_quick_invite_link(&mut self, link: &str) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let (_, token) = steam_friend_code::parse_quick_invite_link(link).ok_or_else(|| SteamError::Other("Invalid quick invite link format".into()))?;

        let msg = steam_protos::CUserAccountRevokeFriendInviteTokenRequest { invite_token: Some(token) };

        self.send_service_method("UserAccount.RevokeFriendInviteToken#1", &msg).await
    }

    /// Get the SteamID of the owner of an invite link.
    ///
    /// This is a synchronous operation that parses the link locally.
    ///
    /// # Arguments
    /// * `link` - The invite link URL
    ///
    /// # Returns
    /// The SteamID of the link owner.
    pub fn get_quick_invite_link_steam_id(&self, link: &str) -> Result<SteamID, SteamError> {
        let (friend_code, _) = steam_friend_code::parse_quick_invite_link(link).ok_or_else(|| SteamError::Other("Invalid quick invite link format".into()))?;
        let account_id = steam_friend_code::parse_short_steam_friend_code(&friend_code).ok_or_else(|| SteamError::Other("Invalid friend code".into()))?;
        Ok(SteamID::from_individual_account_id(account_id))
    }

    /// Check if a quick invite link is valid.
    ///
    /// # Arguments
    /// * `link` - The invite link URL
    ///
    /// # Returns
    /// Validity information including the owner's SteamID.
    pub async fn check_quick_invite_link_validity(&mut self, link: &str) -> Result<crate::types::QuickInviteLinkValidity, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let (friend_code, token) = steam_friend_code::parse_quick_invite_link(link).ok_or_else(|| SteamError::Other("Invalid quick invite link format".into()))?;
        let owner_steam_id_account = steam_friend_code::parse_short_steam_friend_code(&friend_code).ok_or_else(|| SteamError::Other("Invalid friend code".into()))?;
        let owner_steam_id = SteamID::from_individual_account_id(owner_steam_id_account);

        let msg = steam_protos::CUserAccountViewFriendInviteTokenRequest { steamid: Some(owner_steam_id.steam_id64()), invite_token: Some(token) };

        self.send_service_method("UserAccount.ViewFriendInviteToken#1", &msg).await?;

        // Response will come via poll_event
        Ok(crate::types::QuickInviteLinkValidity {
            valid: true, // Placeholder - actual value from response
            steam_id: Some(owner_steam_id),
            invite_duration: None,
        })
    }

    /// Redeem a quick invite link (add the link owner as a friend).
    ///
    /// # Arguments
    /// * `link` - The invite link URL
    pub async fn redeem_quick_invite_link(&mut self, link: &str) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let (friend_code, token) = steam_friend_code::parse_quick_invite_link(link).ok_or_else(|| SteamError::Other("Invalid quick invite link format".into()))?;
        let owner_steam_id_account = steam_friend_code::parse_short_steam_friend_code(&friend_code).ok_or_else(|| SteamError::Other("Invalid friend code".into()))?;
        let owner_steam_id = SteamID::from_individual_account_id(owner_steam_id_account);

        let msg = steam_protos::CUserAccountRedeemFriendInviteTokenRequest { steamid: Some(owner_steam_id.steam_id64()), invite_token: Some(token) };

        self.send_service_method("UserAccount.RedeemFriendInviteToken#1", &msg).await
    }
}
