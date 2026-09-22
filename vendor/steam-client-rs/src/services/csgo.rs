//! CS:GO specific service functionality.

use std::collections::HashMap;

use prost::Message;
use steam_enums::{ECsgoGCMsg, EMsg, EResult};
use steamid::SteamID;

use crate::{error::SteamError, services::gc::GCProtoHeader, SteamClient};

/// CS:GO App ID
pub const APP_ID: u32 = 730;

/// CS:GO Service for interacting with the Game Coordinator and Matchmaking
/// Service.
pub struct CSGOClient<'a> {
    pub(crate) client: &'a mut SteamClient,
}

impl<'a> CSGOClient<'a> {
    pub fn new(client: &'a mut SteamClient) -> Self {
        Self { client }
    }

    /// Send a hello message to the CS:GO Game Coordinator.
    ///
    /// This is required to start a session with the CS:GO GC.
    pub async fn send_hello(&mut self) -> Result<(), SteamError> {
        let msg = steam_protos::CMsgGccStrike15V2MatchmakingClient2GcHello {};

        self.client.send_to_gc_proto(APP_ID, ECsgoGCMsg::MatchmakingClient2GCHello as u32, &msg.encode_to_vec(), GCProtoHeader::default()).await
    }

    /// Request a player's CS:GO profile and await the response.
    ///
    /// Sends a `ClientRequestPlayersProfile` message to the GC and waits for
    /// the `PlayersProfile` response (usually takes 400-800ms).
    /// Returns the parsed profile(s).
    pub async fn get_player_profile(&mut self, steam_id: SteamID) -> Result<Vec<crate::CsgoClientHello>, SteamError> {
        use crate::services::gc::GCJobResponse;

        // PlayersProfile response = 9128, 5s timeout matching Node.js
        let rx = self.client.gc_jobs.create_job_with_timeout(APP_ID, ECsgoGCMsg::PlayersProfile as u32, std::time::Duration::from_secs(5));

        // Send the request
        self.client.request_players_profile(steam_id).await?;

        // Wait for the response
        let response = rx.await.map_err(|_| SteamError::ResponseTimeout)?;

        match response {
            GCJobResponse::Success(payload) => {
                let profile_msg = steam_protos::CMsgGccStrike15V2PlayersProfile::decode(&payload[..]).map_err(|e| SteamError::bad_response(format!("Failed to decode PlayersProfile: {}", e)))?;

                Ok(profile_msg.account_profiles.iter().map(crate::client::MessageHandler::build_csgo_client_hello).collect())
            }
            GCJobResponse::Timeout => Err(SteamError::ResponseTimeout),
        }
    }

    /// Initiate a party search and return the results.
    ///
    /// Sends a Party_Search request to the CS:GO GC and waits for the
    /// Party_SearchResults response.
    pub async fn party_search(&mut self, prime: bool, game_type: u32) -> Result<Vec<crate::CsgoPartyEntry>, SteamError> {
        use crate::services::gc::GCJobResponse;

        let msg = steam_protos::CMsgGccStrike15V2PartySearch {
            ver: Some(1), // Version?
            apr: Some(if prime { 1 } else { 0 }),
            ark: Some(0),
            grps: vec![],
            launcher: Some(0),
            game_type: Some(game_type),
        };

        // Party_Search = 9191
        // Register a job to wait for the response
        let rx = self.client.gc_jobs.create_job(APP_ID, ECsgoGCMsg::Party_Search as u32);

        // Send the request
        self.client.send_to_gc_proto(APP_ID, ECsgoGCMsg::Party_Search as u32, &msg.encode_to_vec(), GCProtoHeader::default()).await?;

        // Wait for the response
        let response = rx.await.map_err(|_| SteamError::ResponseTimeout)?;

        match response {
            GCJobResponse::Success(payload) => {
                // Parse the response
                let results = steam_protos::CMsgGccStrike15V2PartySearchResults::decode(&payload[..]).map_err(|e| SteamError::bad_response(format!("Failed to decode PartySearchResults: {}", e)))?;

                Ok(results
                    .entries
                    .into_iter()
                    .map(|e| crate::CsgoPartyEntry {
                        account_id: e.accountid.unwrap_or(0),
                        lobby_id: e.id.unwrap_or(0),
                        game_type: e.game_type.unwrap_or(0),
                        loc: e.loc.unwrap_or(0),
                    })
                    .collect())
            }
            GCJobResponse::Timeout => Err(SteamError::ResponseTimeout),
        }
    }

    /// Create a lobby via Matchmaking Service (MMS).
    pub async fn create_lobby(&mut self, max_members: i32, lobby_type: i32) -> Result<u64, SteamError> {
        let msg = steam_protos::CMsgClientMmsCreateLobby {
            app_id: Some(APP_ID),
            max_members: Some(max_members),
            lobby_type: Some(lobby_type),
            lobby_flags: Some(0),
            cell_id: self.client.account.read().cell_id,
            ..Default::default()
        };

        let response: steam_protos::CMsgClientMmsCreateLobbyResponse = self.client.send_request_and_wait(EMsg::ClientMMSCreateLobby, &msg).await?;

        let eresult = EResult::from_i32(response.eresult.unwrap_or(2)).unwrap_or(EResult::Fail);
        if eresult != EResult::OK {
            return Err(SteamError::SteamResult(eresult));
        }

        Ok(response.steam_id_lobby.unwrap_or(0))
    }

    /// Invite a user to a lobby.
    pub async fn invite_to_lobby(&mut self, lobby_id: u64, user_id: SteamID) -> Result<(), SteamError> {
        let msg = steam_protos::CMsgClientMmsInviteToLobby { app_id: Some(APP_ID), steam_id_lobby: Some(lobby_id), steam_id_user_invited: Some(user_id.steam_id64()) };

        self.client.send_message(EMsg::ClientMMSInviteToLobby, &msg).await
    }

    /// Set CS:GO Rich Presence (Fake Score).
    ///
    /// This allows setting competitive rank, wins, and other status information
    /// that appears on the friends list.
    pub async fn set_rich_presence(&mut self, rp: &CsgoRichPresence) -> Result<(), SteamError> {
        self.client.upload_rich_presence(APP_ID, &rp.to_map()).await
    }

    /// Join an existing lobby.
    ///
    /// Returns detailed information about the lobby including current members.
    pub async fn join_lobby(&mut self, lobby_id: u64) -> Result<JoinLobbyResult, SteamError> {
        let persona_name = self.client.account.read().info.as_ref().map(|a| a.name.clone()).unwrap_or_default();

        let msg = steam_protos::CMsgClientMmsJoinLobby { app_id: Some(APP_ID), steam_id_lobby: Some(lobby_id), persona_name: Some(persona_name) };

        let response: steam_protos::CMsgClientMmsJoinLobbyResponse = self.client.send_request_and_wait(EMsg::ClientMMSJoinLobby, &msg).await?;

        Ok(JoinLobbyResult {
            lobby_id: response.steam_id_lobby.unwrap_or(0),
            owner_id: response.steam_id_owner.unwrap_or(0),
            chat_room_enter_response: response.chat_room_enter_response.unwrap_or(0),
            max_members: response.max_members.unwrap_or(0),
            lobby_type: response.lobby_type.unwrap_or(0),
            lobby_flags: response.lobby_flags.unwrap_or(0),
            members: response
                .members
                .into_iter()
                .map(|m| LobbyMember {
                    steam_id: m.steam_id.unwrap_or(0),
                    persona_name: m.persona_name.unwrap_or_default(),
                    metadata: m.metadata.unwrap_or_default(),
                })
                .collect(),
            metadata: response.metadata,
        })
    }

    /// Leave a lobby.
    pub async fn leave_lobby(&mut self, lobby_id: u64) -> Result<(), SteamError> {
        let msg = steam_protos::CMsgClientMmsLeaveLobby { app_id: Some(APP_ID), steam_id_lobby: Some(lobby_id) };

        let response: steam_protos::CMsgClientMmsLeaveLobbyResponse = self.client.send_request_and_wait(EMsg::ClientMMSLeaveLobby, &msg).await?;

        let eresult = EResult::from_i32(response.eresult.unwrap_or(2)).unwrap_or(EResult::Fail);
        if eresult != EResult::OK {
            return Err(SteamError::SteamResult(eresult));
        }

        Ok(())
    }

    /// Update lobby settings and metadata.
    ///
    /// Use this to change lobby configuration after creation.
    pub async fn update_lobby(&mut self, lobby_id: u64, config: &LobbyConfig) -> Result<u64, SteamError> {
        let msg = steam_protos::CMsgClientMmsSetLobbyData {
            app_id: Some(APP_ID),
            steam_id_lobby: Some(lobby_id),
            steam_id_member: Some(0),
            max_members: config.max_members,
            lobby_type: config.lobby_type,
            lobby_flags: config.lobby_flags,
            metadata: config.metadata.clone(),
        };

        let response: steam_protos::CMsgClientMmsSetLobbyDataResponse = self.client.send_request_and_wait(EMsg::ClientMMSSetLobbyData, &msg).await?;

        let eresult = EResult::from_i32(response.eresult.unwrap_or(2)).unwrap_or(EResult::Fail);
        if eresult != EResult::OK {
            return Err(SteamError::SteamResult(eresult));
        }

        Ok(response.steam_id_lobby.unwrap_or(0))
    }

    /// Get data about a specific lobby.
    ///
    /// Returns lobby details including members, settings, and metadata.
    pub async fn get_lobby_data(&mut self, lobby_id: u64) -> Result<LobbyData, SteamError> {
        let msg = steam_protos::CMsgClientMmsGetLobbyData { app_id: Some(APP_ID), steam_id_lobby: Some(lobby_id) };

        let response: steam_protos::CMsgClientMmsLobbyData = self.client.send_request_and_wait(EMsg::ClientMMSGetLobbyData, &msg).await?;

        Ok(LobbyData {
            lobby_id: response.steam_id_lobby.unwrap_or(0),
            owner_id: response.steam_id_owner.unwrap_or(0),
            num_members: response.num_members.unwrap_or(0),
            max_members: response.max_members.unwrap_or(0),
            lobby_type: response.lobby_type.unwrap_or(0),
            lobby_flags: response.lobby_flags.unwrap_or(0),
            members: response
                .members
                .into_iter()
                .map(|m| LobbyMember {
                    steam_id: m.steam_id.unwrap_or(0),
                    persona_name: m.persona_name.unwrap_or_default(),
                    metadata: m.metadata.unwrap_or_default(),
                })
                .collect(),
            metadata: response.metadata,
        })
    }

    /// Create a lobby, update its settings, then invite users.
    ///
    /// This is a convenience method that combines create_lobby, update_lobby,
    /// and invite_to_lobby into a single workflow.
    pub async fn create_and_invite(&mut self, config: &LobbyConfig, users: &[SteamID]) -> Result<u64, SteamError> {
        // Create the lobby
        let lobby_id = self.create_lobby(config.max_members.unwrap_or(10), config.lobby_type.unwrap_or(1)).await?;

        // Update with full config if we have metadata or other settings
        if config.metadata.is_some() || config.lobby_flags.is_some() {
            self.update_lobby(lobby_id, config).await?;
        }

        // Invite all users
        for user in users {
            self.invite_to_lobby(lobby_id, *user).await?;
        }

        Ok(lobby_id)
    }

    /// Register a party (L2P advertisement) with the CS:GO GC.
    ///
    /// This makes the account visible in the "Looking to Play" dashboard.
    pub async fn party_register(&mut self, prime: bool, game_type: u32) -> Result<(), SteamError> {
        let msg = steam_protos::CMsgGccStrike15V2PartyRegister {
            id: Some(0),
            ver: Some(13960), // CSGO_VER
            apr: Some(if prime { 1 } else { 0 }),
            ark: Some(if prime { 180 } else { 0 }),
            nby: Some(0),
            grp: Some(0),
            slots: Some(0),
            launcher: Some(0),
            game_type: Some(game_type),
        };

        let res = self.client.send_to_gc_proto(APP_ID, ECsgoGCMsg::Party_Register as u32, &msg.encode_to_vec(), GCProtoHeader::default()).await;

        if res.is_ok() {
            self.client.last_time_party_register = Some(chrono::Utc::now().timestamp_millis());
        }

        res
    }

    /// Acknowledge a competitive cooldown/penalty with the CS:GO GC.
    ///
    /// This is equivalent to clicking the "Acknowledge" button in the CS:GO UI
    /// to clear the penalty banner after a cooldown has expired.
    pub async fn acknowledge_penalty(&mut self) -> Result<(), SteamError> {
        let msg = steam_protos::CMsgGccStrike15V2AcknowledgePenalty { acknowledged: Some(1) };

        self.client.send_to_gc_proto(APP_ID, ECsgoGCMsg::AcknowledgePenalty as u32, &msg.encode_to_vec(), GCProtoHeader::default()).await
    }
}

/// Result of joining a lobby.
#[derive(Debug, Clone)]
pub struct JoinLobbyResult {
    /// Steam ID of the lobby.
    pub lobby_id: u64,
    /// Steam ID of the lobby owner.
    pub owner_id: u64,
    /// Response code indicating success/failure of entering the chat room.
    pub chat_room_enter_response: i32,
    /// Maximum number of members allowed in the lobby.
    pub max_members: i32,
    /// Type of lobby (public, friends-only, private, etc.).
    pub lobby_type: i32,
    /// Lobby flags.
    pub lobby_flags: i32,
    /// Current members in the lobby.
    pub members: Vec<LobbyMember>,
    /// Raw lobby metadata bytes (CS:GO-specific format).
    pub metadata: Option<Vec<u8>>,
}

/// A member in a lobby.
#[derive(Debug, Clone)]
pub struct LobbyMember {
    /// Steam ID of the member.
    pub steam_id: u64,
    /// Display name of the member.
    pub persona_name: String,
    /// Member-specific metadata.
    pub metadata: Vec<u8>,
}

/// Configuration for creating or updating a lobby.
#[derive(Debug, Clone, Default)]
pub struct LobbyConfig {
    /// Maximum number of members.
    pub max_members: Option<i32>,
    /// Lobby type (1 = private, 2 = friends only, 3 = public).
    pub lobby_type: Option<i32>,
    /// Lobby flags.
    pub lobby_flags: Option<i32>,
    /// Raw metadata bytes.
    pub metadata: Option<Vec<u8>>,
}

impl LobbyConfig {
    /// Create a new empty lobby config.
    pub fn new() -> Self {
        Self::default()
    }

    /// Set maximum members.
    pub fn max_members(mut self, max: i32) -> Self {
        self.max_members = Some(max);
        self
    }

    /// Set lobby type.
    pub fn lobby_type(mut self, t: i32) -> Self {
        self.lobby_type = Some(t);
        self
    }

    /// Set lobby flags.
    pub fn lobby_flags(mut self, flags: i32) -> Self {
        self.lobby_flags = Some(flags);
        self
    }

    /// Set raw metadata.
    pub fn metadata(mut self, data: Vec<u8>) -> Self {
        self.metadata = Some(data);
        self
    }
}

/// Data about a lobby.
#[derive(Debug, Clone)]
pub struct LobbyData {
    /// Steam ID of the lobby.
    pub lobby_id: u64,
    /// Steam ID of the lobby owner.
    pub owner_id: u64,
    /// Current number of members.
    pub num_members: i32,
    /// Maximum number of members.
    pub max_members: i32,
    /// Lobby type.
    pub lobby_type: i32,
    /// Lobby flags.
    pub lobby_flags: i32,
    /// Current members.
    pub members: Vec<LobbyMember>,
    /// Raw metadata bytes.
    pub metadata: Option<Vec<u8>>,
}

impl LobbyData {
    /// Parse the raw metadata bytes into a structured `LobbyMetadata`.
    pub fn parse_metadata(&self) -> Option<LobbyMetadata> {
        self.metadata.as_ref().and_then(|data| LobbyMetadata::decode(data).ok())
    }
}

impl JoinLobbyResult {
    /// Parse the raw metadata bytes into a structured `LobbyMetadata`.
    pub fn parse_metadata(&self) -> Option<LobbyMetadata> {
        self.metadata.as_ref().and_then(|data| LobbyMetadata::decode(data).ok())
    }
}

//=============================================================================
// Lobby Metadata Encoding/Decoding
//=============================================================================

/// Binary KV type markers used in CS:GO lobby metadata.
mod kv_type {
    pub const NONE: u8 = 0; // Nested object start
    pub const STRING: u8 = 1; // String value (also used for numbers as strings)
    pub const END: u8 = 8; // End marker
}

/// CS:GO lobby metadata (parsed from binary format).
///
/// This represents the game settings stored in lobby metadata blobs.
#[derive(Debug, Clone, Default)]
pub struct LobbyMetadata {
    /// Game rank ("game:ark").
    pub rank: Option<String>,
    /// Location/country message ("game:loc").
    pub location: Option<String>,
    /// Map group name ("game:mapgroupname"), e.g., "mg_de_mirage".
    pub map_group_name: Option<String>,
    /// Game mode ("game:mode"), e.g., "competitive".
    pub game_mode: Option<String>,
    /// Prime status ("game:prime"), "1" for prime, "0" for non-prime.
    pub prime: Option<String>,
    /// Game type ("game:type"), e.g., "classic".
    pub game_type: Option<String>,
    /// Number of players ("members:numPlayers").
    pub num_players: Option<String>,
    /// Action ("options:action"), e.g., "custommatch".
    pub action: Option<String>,
    /// Any type mode ("options:anytypemode").
    pub any_type_mode: Option<String>,
    /// Access level ("system:access"), e.g., "private".
    pub access: Option<String>,
    /// Network ("system:network"), e.g., "LIVE".
    pub network: Option<String>,
    /// Member Steam IDs (account IDs, varint encoded in binary).
    pub uids: Vec<u32>,
    /// Additional key-value pairs not explicitly parsed.
    pub extra: HashMap<String, String>,
}

impl LobbyMetadata {
    /// Create a new empty lobby metadata.
    pub fn new() -> Self {
        Self::default()
    }

    /// Set map group name.
    pub fn map_group(mut self, name: impl Into<String>) -> Self {
        self.map_group_name = Some(name.into());
        self
    }

    /// Set game mode (e.g., "competitive", "casual", "deathmatch").
    pub fn mode(mut self, mode: impl Into<String>) -> Self {
        self.game_mode = Some(mode.into());
        self
    }

    /// Set prime status.
    pub fn prime(mut self, is_prime: bool) -> Self {
        self.prime = Some(if is_prime { "1".to_string() } else { "0".to_string() });
        self
    }

    /// Set game type (e.g., "classic").
    pub fn game_type(mut self, t: impl Into<String>) -> Self {
        self.game_type = Some(t.into());
        self
    }

    /// Set number of players.
    pub fn num_players(mut self, count: u32) -> Self {
        self.num_players = Some(count.to_string());
        self
    }

    /// Set action (e.g., "custommatch").
    pub fn action(mut self, action: impl Into<String>) -> Self {
        self.action = Some(action.into());
        self
    }

    /// Set access level (e.g., "private", "public").
    pub fn access(mut self, access: impl Into<String>) -> Self {
        self.access = Some(access.into());
        self
    }

    /// Set network (e.g., "LIVE").
    pub fn network(mut self, network: impl Into<String>) -> Self {
        self.network = Some(network.into());
        self
    }

    /// Add member Steam IDs (as account IDs, the lower 32 bits of SteamID64).
    pub fn uids(mut self, ids: Vec<u32>) -> Self {
        self.uids = ids;
        self
    }

    /// Encode the metadata to binary format.
    ///
    /// The format is:
    /// - 2 prefix bytes (0x00, 0x00)
    /// - Key-value pairs as: [type byte][key C-string][value C-string or
    ///   nested]
    /// - Suffix byte (0x08)
    /// - End marker (0x08)
    pub fn encode(&self) -> Vec<u8> {
        let mut buf = Vec::new();

        // Prefix bytes
        buf.push(0x00);
        buf.push(0x00);

        // Encode string fields
        if let Some(v) = &self.rank {
            Self::encode_string(&mut buf, "game:ark", v);
        }
        if let Some(v) = &self.location {
            Self::encode_string(&mut buf, "game:loc", v);
        }
        if let Some(v) = &self.map_group_name {
            Self::encode_string(&mut buf, "game:mapgroupname", v);
        }
        if let Some(v) = &self.game_mode {
            Self::encode_string(&mut buf, "game:mode", v);
        }
        if let Some(v) = &self.prime {
            Self::encode_string(&mut buf, "game:prime", v);
        }
        if let Some(v) = &self.game_type {
            Self::encode_string(&mut buf, "game:type", v);
        }
        if let Some(v) = &self.num_players {
            Self::encode_string(&mut buf, "members:numPlayers", v);
        }
        if let Some(v) = &self.action {
            Self::encode_string(&mut buf, "options:action", v);
        }
        if let Some(v) = &self.any_type_mode {
            Self::encode_string(&mut buf, "options:anytypemode", v);
        }
        if let Some(v) = &self.access {
            Self::encode_string(&mut buf, "system:access", v);
        }
        if let Some(v) = &self.network {
            Self::encode_string(&mut buf, "system:network", v);
        }

        // Encode extra fields
        for (k, v) in &self.extra {
            Self::encode_string(&mut buf, k, v);
        }

        // Encode uids as nested binary blob
        if !self.uids.is_empty() {
            buf.push(kv_type::STRING);
            Self::write_cstring(&mut buf, "uids");
            // Encode UIDs using varint
            let uid_bytes = Self::encode_uids(&self.uids);
            buf.extend_from_slice(&uid_bytes);
        }

        // Suffix byte
        buf.push(0x08);

        // End marker
        buf.push(kv_type::END);

        buf
    }

    /// Decode binary metadata into a structured LobbyMetadata.
    pub fn decode(data: &[u8]) -> Result<Self, crate::error::SteamError> {
        let mut meta = LobbyMetadata::default();
        let mut pos = 0;

        // Skip prefix bytes (usually 0x00, 0x00)
        if data.len() >= 2 {
            pos = 2;
        }

        while pos < data.len() {
            let type_byte = data[pos];
            pos += 1;

            match type_byte {
                kv_type::STRING => {
                    // Read key
                    let key = Self::read_cstring(data, &mut pos)?;

                    // Check if this might be a binary blob (uids)
                    if key == "uids" {
                        // Read varint-encoded account IDs until null terminator
                        let uids = Self::decode_uids(data, &mut pos)?;
                        meta.uids = uids;
                    } else {
                        // Read string value
                        let value = Self::read_cstring(data, &mut pos)?;
                        meta.set_field(&key, value);
                    }
                }
                kv_type::NONE => {
                    // Nested object - read name and skip for now
                    let _name = Self::read_cstring(data, &mut pos)?;
                    // Skip nested content until END
                    while pos < data.len() && data[pos] != kv_type::END {
                        pos += 1;
                    }
                    pos += 1; // Skip END byte
                }
                kv_type::END => {
                    break;
                }
                _ => {
                    // Unknown type, try to skip
                    continue;
                }
            }
        }

        Ok(meta)
    }

    fn set_field(&mut self, key: &str, value: String) {
        match key {
            "game:ark" => self.rank = Some(value),
            "game:loc" => self.location = Some(value),
            "game:mapgroupname" => self.map_group_name = Some(value),
            "game:mode" => self.game_mode = Some(value),
            "game:prime" => self.prime = Some(value),
            "game:type" => self.game_type = Some(value),
            "members:numPlayers" => self.num_players = Some(value),
            "options:action" => self.action = Some(value),
            "options:anytypemode" => self.any_type_mode = Some(value),
            "system:access" => self.access = Some(value),
            "system:network" => self.network = Some(value),
            _ => {
                self.extra.insert(key.to_string(), value);
            }
        }
    }

    fn encode_string(buf: &mut Vec<u8>, key: &str, value: &str) {
        buf.push(kv_type::STRING);
        Self::write_cstring(buf, key);
        Self::write_cstring(buf, value);
    }

    fn write_cstring(buf: &mut Vec<u8>, s: &str) {
        buf.extend_from_slice(s.as_bytes());
        buf.push(0x00); // Null terminator
    }

    fn read_cstring(data: &[u8], pos: &mut usize) -> Result<String, crate::error::SteamError> {
        let start = *pos;
        while *pos < data.len() && data[*pos] != 0x00 {
            *pos += 1;
        }
        let s = String::from_utf8_lossy(&data[start..*pos]).to_string();
        *pos += 1; // Skip null terminator
        Ok(s)
    }

    /// Encode account IDs using varint encoding.
    fn encode_uids(uids: &[u32]) -> Vec<u8> {
        let mut buf = Vec::new();
        for &id in uids {
            let mut val = id;
            while val > 0x7f {
                buf.push(((val | 0x80) & 0xff) as u8);
                val >>= 7;
            }
            buf.push(val as u8);
        }
        buf.push(0x00); // Null terminator
        buf
    }

    /// Decode varint-encoded account IDs.
    fn decode_uids(data: &[u8], pos: &mut usize) -> Result<Vec<u32>, crate::error::SteamError> {
        let mut uids = Vec::new();
        let mut current: u32 = 0;
        let mut shift = 0;

        while *pos < data.len() {
            let byte = data[*pos];
            *pos += 1;

            if byte == 0x00 {
                // Null terminator - push last value if any
                if current > 0 || shift > 0 {
                    uids.push(current);
                }
                break;
            }

            current |= ((byte & 0x7f) as u32) << shift;
            shift += 7;

            if byte & 0x80 == 0 {
                // This byte is the last one for this value
                uids.push(current);
                current = 0;
                shift = 0;
            }
        }

        Ok(uids)
    }
}

/// CS:GO Competitive Ranks.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CsgoRank {
    Unranked = 0,
    SilverI = 1,
    SilverII = 2,
    SilverIII = 3,
    SilverIV = 4,
    SilverElite = 5,
    SilverEliteMaster = 6,
    GoldNovaI = 7,
    GoldNovaII = 8,
    GoldNovaIII = 9,
    GoldNovaMaster = 10,
    MasterGuardianI = 11,
    MasterGuardianII = 12,
    MasterGuardianElite = 13,
    DistinguishedMasterGuardian = 14,
    LegendaryEagle = 15,
    LegendaryEagleMaster = 16,
    SupremeMasterFirstClass = 17,
    TheGlobalElite = 18,
}

/// CS:GO Game Modes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CsgoGameMode {
    Casual,
    Competitive,
    Wingman,
    Deathmatch,
    ArmsRace,
    Demolition,
    FlyingScoutsman,
    DangerZone,
}

impl CsgoGameMode {
    fn as_str(&self) -> &'static str {
        match self {
            CsgoGameMode::Casual => "casual",
            CsgoGameMode::Competitive => "competitive",
            CsgoGameMode::Wingman => "scrimcomp2v2",
            CsgoGameMode::Deathmatch => "deathmatch",
            CsgoGameMode::ArmsRace => "gungameprogressive",
            CsgoGameMode::Demolition => "gungametrbomb",
            CsgoGameMode::FlyingScoutsman => "flyingscoutsman",
            CsgoGameMode::DangerZone => "survival",
        }
    }
}

/// Builder for CS:GO Rich Presence data.
#[derive(Debug, Clone, Default)]
pub struct CsgoRichPresence {
    rank: Option<CsgoRank>,
    wins: Option<u32>,
    level: Option<u32>,
    score: Option<u32>,
    #[allow(dead_code)]
    leaderboard_time: Option<u32>,
    status: Option<String>,
    game_mode: Option<CsgoGameMode>,
    map_group: Option<String>,
}

impl CsgoRichPresence {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn rank(mut self, rank: CsgoRank) -> Self {
        self.rank = Some(rank);
        self
    }

    pub fn wins(mut self, wins: u32) -> Self {
        self.wins = Some(wins);
        self
    }

    pub fn level(mut self, level: u32) -> Self {
        self.level = Some(level);
        self
    }

    pub fn score(mut self, score: u32) -> Self {
        self.score = Some(score);
        self
    }

    pub fn status(mut self, status: impl Into<String>) -> Self {
        self.status = Some(status.into());
        self
    }

    pub fn game_mode(mut self, mode: CsgoGameMode) -> Self {
        self.game_mode = Some(mode);
        self
    }

    pub fn map_group(mut self, group: impl Into<String>) -> Self {
        self.map_group = Some(group.into());
        self
    }

    pub fn to_map(&self) -> HashMap<String, String> {
        let mut map = HashMap::new();

        map.insert("version".to_string(), "1".to_string());

        if let Some(rank) = self.rank {
            map.insert("competitive_ranking".to_string(), (rank as u32).to_string());
        }

        if let Some(wins) = self.wins {
            map.insert("competitive_wins".to_string(), wins.to_string());
        }

        if let Some(level) = self.level {
            map.insert("level".to_string(), level.to_string());
        }

        if let Some(score) = self.score {
            map.insert("score".to_string(), score.to_string());
        }

        if let Some(status) = &self.status {
            map.insert("game:state".to_string(), status.clone());
        }

        if let Some(mode) = self.game_mode {
            map.insert("game:mode".to_string(), mode.as_str().to_string());
        }

        if let Some(group) = &self.map_group {
            map.insert("game:mapgroupname".to_string(), group.clone());
        }

        // If we have a rank, we usually want to show it using the competitive display
        if self.rank.is_some() {
            map.insert("steam_display".to_string(), "#RP_Status_Competitive".to_string());
        } else if self.status.is_some() {
            // If manual status is set but no rank, generic display
            map.insert("steam_display".to_string(), "#RP_Status_Command".to_string());
        }

        map
    }
}
