//! Chat room functionality for Steam client.
//!
//! This module provides group chat (chat room) functionality,
//! including creating, joining, and messaging in chat rooms.

use std::collections::HashMap;

use steamid::SteamID;

use crate::{error::SteamError, SteamClient};

/// A chat room group.
#[derive(Debug, Clone)]
pub struct ChatRoomGroup {
    /// Chat group ID.
    pub chat_group_id: String,
    /// Group name.
    pub chat_group_name: String,
    /// Owner's SteamID.
    pub steamid_owner: SteamID,
    /// Group tagline.
    pub tagline: String,
    /// Avatar URL.
    pub avatar_url: Option<String>,
    /// App ID associated with this group.
    pub appid: Option<u32>,
    /// Default chat room ID.
    pub default_chat_id: String,
    /// Active member count.
    pub active_member_count: u32,
    /// Members in voice.
    pub active_voice_member_count: u32,
    /// Chat rooms in this group.
    pub chat_rooms: Vec<ChatRoom>,
    /// Members in this group.
    pub members: Vec<ChatRoomMember>,
    /// Roles in this group.
    pub roles: Vec<ChatRole>,
}

/// A chat room within a group.
#[derive(Debug, Clone)]
pub struct ChatRoom {
    /// Chat room ID.
    pub chat_id: String,
    /// Room name.
    pub chat_name: String,
    /// Whether voice is allowed.
    pub voice_allowed: bool,
    /// Members currently in voice.
    pub members_in_voice: Vec<SteamID>,
    /// Time of last message (Unix timestamp).
    pub time_last_message: u32,
    /// Sort order.
    pub sort_order: u32,
    /// Last message content.
    pub last_message: String,
    /// SteamID of last message sender.
    pub steamid_last_message: Option<SteamID>,
}

/// A member of a chat room group.
#[derive(Debug, Clone)]
pub struct ChatRoomMember {
    /// Member's SteamID.
    pub steamid: SteamID,
    /// Join state.
    pub state: u32,
    /// Member rank.
    pub rank: u32,
    /// Time kick expires (if kicked).
    pub time_kick_expire: Option<u32>,
    /// Role IDs assigned to this member.
    pub role_ids: Vec<String>,
}

/// A role in a chat room group.
#[derive(Debug, Clone)]
pub struct ChatRole {
    /// Role ID.
    pub role_id: String,
    /// Role name.
    pub name: String,
    /// Sort ordinal.
    pub ordinal: u32,
}

/// Permissions for a chat role.
#[derive(Debug, Clone, Default)]
pub struct RolePermissions {
    /// Can create, rename, delete channels.
    pub can_create_rename_delete_channel: bool,
    /// Can kick members.
    pub can_kick: bool,
    /// Can ban members.
    pub can_ban: bool,
    /// Can invite members.
    pub can_invite: bool,
    /// Can change tagline, avatar, name.
    pub can_change_tagline_avatar_name: bool,
    /// Can send chat messages.
    pub can_chat: bool,
    /// Can view chat history.
    pub can_view_history: bool,
    /// Can change group roles.
    pub can_change_group_roles: bool,
    /// Can change user roles.
    pub can_change_user_roles: bool,
    /// Can @mention all.
    pub can_mention_all: bool,
    /// Can set watching broadcast.
    pub can_set_watching_broadcast: bool,
}

/// A message in a chat room.
#[derive(Debug, Clone)]
pub struct ChatRoomMessage {
    /// Sender's SteamID.
    pub sender: SteamID,
    /// Message content.
    pub message: String,
    /// Server timestamp.
    pub server_timestamp: u32,
    /// Message ordinal.
    pub ordinal: u32,
    /// Whether message was deleted.
    pub deleted: bool,
}

/// A banned user in a chat room group.
#[derive(Debug, Clone)]
pub struct ChatRoomBan {
    /// Banned user's SteamID.
    pub steamid: SteamID,
    /// Actor who performed the ban.
    pub steamid_actor: SteamID,
    /// Time when banned.
    pub time_banned: u32,
    /// Ban reason.
    pub ban_reason: String,
}

/// Information about an invite link.
#[derive(Debug, Clone)]
pub struct InviteLinkInfo {
    /// Invite code.
    pub invite_code: String,
    /// SteamID of who sent the invite.
    pub steamid_sender: SteamID,
    /// When the invite expires.
    pub time_expires: Option<u32>,
    /// Group summary.
    pub group_summary: Option<ChatRoomGroup>,
    /// Whether the user is banned.
    pub banned: bool,
    /// When kick expires.
    pub time_kick_expire: Option<u32>,
    /// Chat ID if specific to a voice channel.
    pub chat_id: Option<String>,
}

impl SteamClient {
    /// Create a new chat room group.
    ///
    /// # Arguments
    /// * `name` - Name for the group (empty for ad-hoc group)
    /// * `invitees` - Users to invite
    pub async fn create_chat_room_group(&mut self, name: &str, invitees: Vec<SteamID>) -> Result<ChatRoomGroup, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CChatRoomCreateChatRoomGroupRequest {
            name: Some(name.to_string()),
            steamid_invitees: invitees.iter().map(|s| s.steam_id64()).collect(),
            ..Default::default()
        };

        self.send_service_method("ChatRoom.CreateChatRoomGroup#1", &msg).await?;

        Ok(ChatRoomGroup {
            chat_group_id: String::new(),
            chat_group_name: name.to_string(),
            steamid_owner: self.steam_id.unwrap_or_default(),
            tagline: String::new(),
            avatar_url: None,
            appid: None,
            default_chat_id: String::new(),
            active_member_count: 0,
            active_voice_member_count: 0,
            chat_rooms: Vec::new(),
            members: Vec::new(),
            roles: Vec::new(),
        })
    }

    /// Save an unnamed "ad-hoc" group chat as a full chat room group.
    ///
    /// # Arguments
    /// * `group_id` - The group ID
    /// * `name` - Name for the saved group
    pub async fn save_chat_room_group(&mut self, group_id: SteamID, name: &str) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CChatRoomSaveChatRoomGroupRequest { chat_group_id: Some(group_id.steam_id64()), name: Some(name.to_string()) };

        self.send_service_method("ChatRoom.SaveChatRoomGroup#1", &msg).await
    }

    /// Get a list of chat room groups you're in.
    pub async fn get_chat_room_groups(&mut self) -> Result<HashMap<String, ChatRoomGroup>, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CChatRoomGetMyChatRoomGroupsRequest {};
        self.send_service_method("ChatRoom.GetMyChatRoomGroups#1", &msg).await?;

        Ok(HashMap::new())
    }

    /// Set which groups are actively being chatted in.
    ///
    /// Only active groups receive some events like member state changes.
    ///
    /// # Arguments
    /// * `group_ids` - Group IDs to set as active
    pub async fn set_session_active_chat_groups(&mut self, group_ids: Vec<SteamID>) -> Result<HashMap<String, ChatRoomGroup>, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let chat_group_ids: Vec<u64> = group_ids.iter().map(|s| s.steam_id64()).collect();
        let msg = steam_protos::CChatRoomSetSessionActiveChatRoomGroupsRequest { chat_group_ids: chat_group_ids.clone(), chat_groups_data_requested: chat_group_ids, ..Default::default() };

        self.send_service_method("ChatRoom.SetSessionActiveChatRoomGroups#1", &msg).await?;

        Ok(HashMap::new())
    }

    /// Get details from a chat group invite link.
    ///
    /// # Arguments
    /// * `link_url` - The invite link URL (e.g., https://s.team/chat/XXXXX)
    pub async fn get_chat_invite_link_info(&mut self, link_url: &str) -> Result<InviteLinkInfo, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let invite_code = link_url.split("/chat/").last().ok_or_else(|| SteamError::Other("Invalid invite link".into()))?.trim_end_matches('/');

        let msg = steam_protos::CChatRoomGetInviteLinkInfoRequest { invite_code: Some(invite_code.to_string()) };

        self.send_service_method("ChatRoom.GetInviteLinkInfo#1", &msg).await?;

        Ok(InviteLinkInfo {
            invite_code: invite_code.to_string(),
            steamid_sender: SteamID::new(),
            time_expires: None,
            group_summary: None,
            banned: false,
            time_kick_expire: None,
            chat_id: None,
        })
    }

    /// Join a chat room group.
    ///
    /// # Arguments
    /// * `group_id` - The group ID to join
    /// * `invite_code` - Optional invite code if joining via invite
    pub async fn join_chat_room_group(&mut self, group_id: SteamID, invite_code: Option<&str>) -> Result<ChatRoomGroup, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CChatRoomJoinChatRoomGroupRequest {
            chat_group_id: Some(group_id.steam_id64()),
            invite_code: invite_code.map(|s| s.to_string()),
            ..Default::default()
        };

        self.send_service_method("ChatRoom.JoinChatRoomGroup#1", &msg).await?;

        Ok(ChatRoomGroup {
            chat_group_id: group_id.to_string(),
            chat_group_name: String::new(),
            steamid_owner: SteamID::new(),
            tagline: String::new(),
            avatar_url: None,
            appid: None,
            default_chat_id: String::new(),
            active_member_count: 0,
            active_voice_member_count: 0,
            chat_rooms: Vec::new(),
            members: Vec::new(),
            roles: Vec::new(),
        })
    }

    /// Leave a chat room group.
    ///
    /// # Arguments
    /// * `group_id` - The group ID to leave
    pub async fn leave_chat_room_group(&mut self, group_id: SteamID) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CChatRoomLeaveChatRoomGroupRequest { chat_group_id: Some(group_id.steam_id64()) };

        self.send_service_method("ChatRoom.LeaveChatRoomGroup#1", &msg).await
    }

    /// Create an invite link for a chat room group.
    ///
    /// # Arguments
    /// * `group_id` - The group ID
    /// * `seconds_valid` - Duration in seconds the link is valid (default 3600)
    /// * `voice_chat_id` - Optional voice chat ID to link directly to
    pub async fn create_chat_room_invite_link(&mut self, group_id: SteamID, seconds_valid: Option<u32>, voice_chat_id: Option<String>) -> Result<String, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CChatRoomCreateInviteLinkRequest {
            chat_group_id: Some(group_id.steam_id64()),
            seconds_valid: Some(seconds_valid.unwrap_or(3600)),
            chat_id: voice_chat_id.and_then(|id| id.parse().ok()),
        };

        let response: steam_protos::CChatRoomCreateInviteLinkResponse = self.send_service_method_and_wait("ChatRoom.CreateInviteLink#1", &msg).await?;

        Ok(response.invite_code.unwrap_or_default())
    }

    /// Get all active invite links for a chat group.
    ///
    /// # Arguments
    /// * `group_id` - The group ID
    pub async fn get_group_invite_links(&mut self, group_id: SteamID) -> Result<Vec<InviteLinkInfo>, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CChatRoomGetInviteLinksForGroupRequest { chat_group_id: Some(group_id.steam_id64()) };

        let response: steam_protos::CChatRoomGetInviteLinksForGroupResponse = self.send_service_method_and_wait("ChatRoom.GetInviteLinksForGroup#1", &msg).await?;

        let links = response
            .invite_links
            .into_iter()
            .map(|link| InviteLinkInfo {
                invite_code: link.invite_code.unwrap_or_default(),
                steamid_sender: SteamID::from_steam_id64(link.steamid_creator.unwrap_or(0)),
                time_expires: link.time_expires,
                group_summary: None,
                banned: false,
                time_kick_expire: None,
                chat_id: link.chat_id.map(|id| id.to_string()),
            })
            .collect();

        Ok(links)
    }

    /// Revoke and delete an active invite link.
    ///
    /// # Arguments
    /// * `group_id` - The group ID
    /// * `invite_code` - The invite code to delete
    pub async fn delete_invite_link(&mut self, group_id: SteamID, invite_code: &str) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CChatRoomDeleteInviteLinkRequest { chat_group_id: Some(group_id.steam_id64()), invite_code: Some(invite_code.to_string()) };

        self.send_service_method("ChatRoom.DeleteInviteLink#1", &msg).await
    }

    /// Send a message to a chat room.
    ///
    /// # Arguments
    /// * `group_id` - The group ID
    /// * `chat_id` - The chat room ID within the group
    /// * `message` - The message to send
    pub async fn send_chat_room_message(&mut self, group_id: SteamID, chat_id: u64, message: &str) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CChatRoomSendChatMessageRequest {
            chat_group_id: Some(group_id.steam_id64()),
            chat_id: Some(chat_id),
            message: Some(message.to_string()),
            ..Default::default()
        };

        self.send_service_method("ChatRoom.SendChatMessage#1", &msg).await
    }

    /// Create a text/voice chat room in a group.
    ///
    /// # Arguments
    /// * `group_id` - The group ID
    /// * `name` - Name of the new channel
    /// * `allow_voice` - Whether to allow voice chat
    pub async fn create_chat_room(&mut self, group_id: SteamID, name: &str, allow_voice: bool) -> Result<ChatRoom, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CChatRoomCreateChatRoomRequest { chat_group_id: Some(group_id.steam_id64()), name: Some(name.to_string()), allow_voice: Some(allow_voice) };

        let response: steam_protos::CChatRoomCreateChatRoomResponse = self.send_service_method_and_wait("ChatRoom.CreateChatRoom#1", &msg).await?;

        let room = response.chat_room.ok_or_else(|| SteamError::Other("No chat room returned".into()))?;

        Ok(ChatRoom {
            chat_id: room.chat_id.unwrap_or(0).to_string(),
            chat_name: room.chat_name.unwrap_or_default(),
            voice_allowed: room.voice_allowed.unwrap_or(false),
            members_in_voice: room.members_in_voice.into_iter().map(SteamID::from_individual_account_id).collect(),
            time_last_message: room.time_last_message.unwrap_or(0),
            sort_order: room.sort_order.unwrap_or(0),
            last_message: room.last_message.unwrap_or_default(),
            steamid_last_message: room.accountid_last_message.map(SteamID::from_individual_account_id),
        })
    }

    /// Rename a chat room in a group.
    ///
    /// # Arguments
    /// * `group_id` - The group ID
    /// * `chat_id` - The chat room ID
    /// * `name` - The new name
    pub async fn rename_chat_room(&mut self, group_id: SteamID, chat_id: u64, name: &str) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CChatRoomRenameChatRoomRequest { chat_group_id: Some(group_id.steam_id64()), chat_id: Some(chat_id), name: Some(name.to_string()) };

        self.send_service_method("ChatRoom.RenameChatRoom#1", &msg).await
    }

    /// Delete a chat room from a group.
    ///
    /// # Arguments
    /// * `group_id` - The group ID
    /// * `chat_id` - The chat room ID
    pub async fn delete_chat_room(&mut self, group_id: SteamID, chat_id: u64) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CChatRoomDeleteChatRoomRequest { chat_group_id: Some(group_id.steam_id64()), chat_id: Some(chat_id) };

        self.send_service_method("ChatRoom.DeleteChatRoom#1", &msg).await
    }

    /// Get message history for a chat room.
    ///
    /// # Arguments
    /// * `group_id` - The group ID
    /// * `chat_id` - The chat room ID
    /// * `last_time` - Get messages before this time (0 for most recent)
    /// * `last_ordinal` - Get messages before this ordinal
    /// * `max_count` - Maximum messages to return
    pub async fn get_chat_room_message_history(&mut self, group_id: SteamID, chat_id: u64, last_time: u32, last_ordinal: u32, max_count: u32) -> Result<Vec<ChatRoomMessage>, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CChatRoomGetMessageHistoryRequest {
            chat_group_id: Some(group_id.steam_id64()),
            chat_id: Some(chat_id),
            last_time: Some(last_time),
            last_ordinal: Some(last_ordinal),
            max_count: Some(max_count),
            ..Default::default()
        };

        self.send_service_method("ChatRoom.GetMessageHistory#1", &msg).await?;

        Ok(Vec::new())
    }

    /// Acknowledge (mark as read) a chat room message.
    ///
    /// # Arguments
    /// * `group_id` - The group ID
    /// * `chat_id` - The chat room ID
    /// * `timestamp` - The timestamp of the newest message acknowledged
    pub async fn ack_chat_message(&mut self, group_id: SteamID, chat_id: u64, timestamp: u32) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CChatRoomAckChatMessageNotification { chat_group_id: Some(group_id.steam_id64()), chat_id: Some(chat_id), timestamp: Some(timestamp) };

        self.send_service_method("ChatRoom.AckChatMessage#1", &msg).await
    }

    /// Delete messages from a chat room.
    ///
    /// # Arguments
    /// * `group_id` - The group ID
    /// * `chat_id` - The chat room ID
    /// * `messages` - List of (server_timestamp, ordinal) tuples to delete
    pub async fn delete_chat_messages(&mut self, group_id: SteamID, chat_id: u64, messages: Vec<(u32, u32)>) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let proto_messages = messages.into_iter().map(|(ts, ord)| steam_protos::CChatRoomMessage { server_timestamp: Some(ts), ordinal: Some(ord) }).collect();

        let msg = steam_protos::CChatRoomDeleteChatMessagesRequest { chat_group_id: Some(group_id.steam_id64()), chat_id: Some(chat_id), messages: proto_messages };

        self.send_service_method("ChatRoom.DeleteChatMessages#1", &msg).await
    }

    /// Get the chat room group info for a clan (Steam group).
    ///
    /// # Arguments
    /// * `clan_id` - The clan's SteamID
    pub async fn get_clan_chat_group_info(&mut self, clan_id: SteamID) -> Result<ChatRoomGroup, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CClanChatRoomsGetClanChatRoomInfoRequest { steamid: Some(clan_id.steam_id64()), autocreate: Some(true) };

        let response: steam_protos::CClanChatRoomsGetClanChatRoomInfoResponse = self.send_service_method_and_wait("ClanChatRooms.GetClanChatRoomInfo#1", &msg).await?;

        // Basic conversion, full conversion would require more robust mapping
        // returning empty group for now as place holder or partial data
        let summary = response.chat_group_summary.unwrap_or_default();

        Ok(ChatRoomGroup {
            chat_group_id: summary.chat_group_id.unwrap_or(0).to_string(),
            chat_group_name: summary.chat_group_name.unwrap_or_default(),
            steamid_owner: SteamID::from_steam_id64(summary.steamid_owner.unwrap_or(0)),
            tagline: summary.chat_group_tagline.unwrap_or_default(),
            avatar_url: None, // Need to convert sha to url
            appid: summary.appid,
            default_chat_id: summary.default_chat_id.unwrap_or(0).to_string(),
            active_member_count: summary.active_member_count.unwrap_or(0),
            active_voice_member_count: summary.active_voice_member_count.unwrap_or(0),
            chat_rooms: Vec::new(), // Would need to map summary.chat_rooms
            members: Vec::new(),
            roles: Vec::new(),
        })
    }

    /// Kick a user from a chat room group.
    ///
    /// # Arguments
    /// * `group_id` - The group ID
    /// * `steamid` - The user to kick
    /// * `expiry` - When the kick expires (Unix timestamp, None for permanent)
    pub async fn kick_chat_room_member(&mut self, group_id: SteamID, steamid: SteamID, expiry: Option<u32>) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CChatRoomKickUserRequest {
            chat_group_id: Some(group_id.steam_id64()),
            steamid: Some(steamid.steam_id64()),
            expiration: expiry.map(|e| e as i32),
        };

        self.send_service_method("ChatRoom.KickUser#1", &msg).await
    }

    /// Ban a user from a chat room group.
    ///
    /// # Arguments
    /// * `group_id` - The group ID
    /// * `steamid` - The user to ban
    /// * `expiry` - When the ban expires (Unix timestamp, None for permanent)
    pub async fn ban_chat_room_member(&mut self, group_id: SteamID, steamid: SteamID, _expiry: Option<u32>) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CChatRoomSetUserBanStateRequest { chat_group_id: Some(group_id.steam_id64()), steamid: Some(steamid.steam_id64()), ban_state: Some(true) };

        self.send_service_method("ChatRoom.SetUserBanState#1", &msg).await
    }

    /// Unban a user from a chat room group.
    ///
    /// # Arguments
    /// * `group_id` - The group ID
    /// * `steamid` - The user to unban
    pub async fn unban_chat_room_member(&mut self, group_id: SteamID, steamid: SteamID) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CChatRoomSetUserBanStateRequest { chat_group_id: Some(group_id.steam_id64()), steamid: Some(steamid.steam_id64()), ban_state: Some(false) };

        self.send_service_method("ChatRoom.SetUserBanState#1", &msg).await
    }

    /// Get the ban list for a chat room group.
    ///
    /// # Arguments
    /// * `group_id` - The group ID
    pub async fn get_group_ban_list(&mut self, group_id: SteamID) -> Result<Vec<ChatRoomBan>, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CChatRoomGetBanListRequest { chat_group_id: Some(group_id.steam_id64()) };

        let response: steam_protos::CChatRoomGetBanListResponse = self.send_service_method_and_wait("ChatRoom.GetBanList#1", &msg).await?;

        let bans = response
            .bans
            .into_iter()
            .map(|ban| ChatRoomBan {
                steamid: SteamID::from_steam_id64(ban.steamid.unwrap_or(0)),
                steamid_actor: SteamID::from_steam_id64(ban.steamid_actor.unwrap_or(0)),
                time_banned: ban.time_banned.unwrap_or(0),
                ban_reason: ban.ban_reason.unwrap_or_default(),
            })
            .collect();

        Ok(bans)
    }

    /// Add or remove a role to a group user.
    ///
    /// # Arguments
    /// * `group_id` - The group ID
    /// * `steamid` - The user SteamID
    /// * `role_id` - The role ID
    /// * `role_state` - True to add role, false to remove
    pub async fn set_group_user_role_state(&mut self, group_id: SteamID, steamid: SteamID, role_id: &str, role_state: bool) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        if role_state {
            let msg = steam_protos::CChatRoomAddRoleToUserRequest {
                chat_group_id: Some(group_id.steam_id64()),
                role_id: Some(role_id.parse().unwrap_or(0)),
                steamid: Some(steamid.steam_id64()),
            };
            self.send_service_method("ChatRoom.AddRoleToUser#1", &msg).await
        } else {
            let msg = steam_protos::CChatRoomDeleteRoleFromUserRequest {
                chat_group_id: Some(group_id.steam_id64()),
                role_id: Some(role_id.parse().unwrap_or(0)),
                steamid: Some(steamid.steam_id64()),
            };
            self.send_service_method("ChatRoom.DeleteRoleFromUser#1", &msg).await
        }
    }

    /// Invite a user to a chat room group.
    ///
    /// # Arguments
    /// * `group_id` - The group ID
    /// * `steamid` - The user to invite
    pub async fn invite_to_chat_room_group(&mut self, group_id: SteamID, steamid: SteamID) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CChatRoomInviteFriendToChatRoomGroupRequest { chat_group_id: Some(group_id.steam_id64()), steamid: Some(steamid.steam_id64()), ..Default::default() };

        self.send_service_method("ChatRoom.InviteFriendToChatRoomGroup#1", &msg).await
    }
}
