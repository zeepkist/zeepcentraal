//! App authentication for Steam client.
//!
//! This module provides functionality for creating app tickets and
//! auth session tickets used for game authentication/DRM.

use std::io::Write;

use byteorder::{LittleEndian, WriteBytesExt};
use prost::Message;
use steamid::SteamID;

use crate::{error::SteamError, SteamClient};

/// An auth session ticket for game authentication.
#[derive(Debug, Clone)]
pub struct AuthSessionTicket {
    /// The raw ticket data.
    pub ticket: Vec<u8>,
    /// Handle for this ticket (used to cancel).
    pub handle: u32,
    /// App ID this ticket is for.
    pub appid: u32,
    /// SteamID of the ticket owner (0 for self).
    pub steam_id: u64,
    /// CRC32 of the ticket.
    pub ticket_crc: u32,
    /// State of the ticket.
    pub estate: u32,
}

/// Result of activating an auth session ticket.
#[derive(Debug, Clone)]
pub struct AuthSessionResult {
    /// The SteamID of the ticket owner.
    pub steamid: SteamID,
    /// Auth session response code.
    pub auth_session_response: u32,
}

impl SteamClient {
    /// Request an encrypted app ticket for a particular app.
    ///
    /// The app must be set up on the Steam backend for encrypted app tickets.
    ///
    /// # Arguments
    /// * `appid` - The Steam AppID of the app you want a ticket for
    /// * `user_data` - Optional user data if the app expects it
    ///
    /// # Returns
    /// The complete protobuf-encoded encrypted app ticket, suitable for sending
    /// to a game server for validation.
    pub async fn create_encrypted_app_ticket(&mut self, appid: u32, user_data: Option<&[u8]>) -> Result<Vec<u8>, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgClientRequestEncryptedAppTicket { app_id: Some(appid), userdata: user_data.map(|d| d.to_vec()) };

        // Send request and wait for response
        let response: steam_protos::CMsgClientEncryptedAppTicketResponse = self.send_request_and_wait(steam_enums::EMsg::ClientRequestEncryptedAppTicket, &msg).await?;

        if response.eresult.unwrap_or(2) != 1 {
            return Err(SteamError::SteamResult(steam_enums::EResult::from_i32(response.eresult.unwrap_or(2)).unwrap_or(steam_enums::EResult::Fail)));
        }

        if response.app_id != Some(appid) {
            return Err(SteamError::ProtocolError("Steam returned an encrypted app ticket for a different app".into()));
        }

        let ticket = response.encrypted_ticket.ok_or_else(|| SteamError::ProtocolError("Steam returned no encrypted app ticket".into()))?;
        if !matches!(ticket.encrypted_ticket.as_ref(), Some(bytes) if !bytes.is_empty()) {
            return Err(SteamError::ProtocolError("Steam returned an empty encrypted app ticket".into()));
        }

        Ok(ticket.encode_to_vec())
    }

    /// Request an app ownership ticket for a particular app.
    ///
    /// # Arguments
    /// * `appid` - The Steam AppID of the app you want a ticket for
    ///
    /// # Returns
    /// The ownership ticket as raw bytes.
    pub async fn get_app_ownership_ticket(&mut self, appid: u32) -> Result<Vec<u8>, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgClientGetAppOwnershipTicket { app_id: Some(appid) };

        // Send request and wait for response
        let response: steam_protos::CMsgClientGetAppOwnershipTicketResponse = self.send_request_and_wait(steam_enums::EMsg::ClientGetAppOwnershipTicket, &msg).await?;

        if response.eresult.unwrap_or(1) != 1 {
            return Err(SteamError::SteamResult(steam_enums::EResult::from_i32(response.eresult.unwrap_or(2) as i32).unwrap_or(steam_enums::EResult::Fail)));
        }

        Ok(response.ticket.unwrap_or_default())
    }

    /// Create an auth session ticket for game server authentication.
    ///
    /// This ticket can be sent to a game server which will validate it
    /// with Steam to verify your identity and ownership.
    ///
    /// # Arguments
    /// * `appid` - The Steam AppID of the game
    ///
    /// # Returns
    /// An AuthSessionTicket that can be used for authentication.
    pub async fn create_auth_session_ticket(&mut self, appid: u32) -> Result<AuthSessionTicket, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        if self.gc_tokens.is_empty() {
            return Err(SteamError::Other("No GC tokens available. Wait for connection to establish fully.".to_string()));
        }

        // Get an ownership ticket first
        // Note: In a real implementation this would wait for the ticket response
        // For now we'll assume we can get one or fail
        // Since we can't properly wait for the ticket in this structure without a large
        // refactor, we'll proceed but acknowledge this is incomplete.
        // In node-steam-user, this gets a ticket from cache or requests one.
        let ownership_ticket = self.get_app_ownership_ticket(appid).await?;

        // Consume a GC token
        let gc_token = self.gc_tokens.remove(0);

        // Construct the session ticket buffer
        let mut buffer = Vec::new();

        // 1. Length-prefixed GC Token
        buffer.write_u32::<LittleEndian>(gc_token.len() as u32)?;
        buffer.write_all(&gc_token)?;

        // 2. Length-prefixed Session Header (24 bytes)
        buffer.write_u32::<LittleEndian>(24)?;
        buffer.write_u32::<LittleEndian>(1)?; // unknown 1
        buffer.write_u32::<LittleEndian>(2)?; // unknown 2

        // Convert IP string to int
        let ip_int = if let Some(ip_str) = self.account.read().public_ip.clone() {
            match ip_str.parse::<std::net::Ipv4Addr>() {
                Ok(ip) => u32::from(ip).swap_bytes(), // Network byte order
                Err(_) => 0,
            }
        } else {
            0
        };
        buffer.write_u32::<LittleEndian>(ip_int)?;

        buffer.write_u32::<LittleEndian>(0)?; // filler

        let timestamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64;
        let connect_time_ms = self.connect_time; // Assuming this is ms
        let session_time = (timestamp.saturating_sub(connect_time_ms)) as u32;
        buffer.write_u32::<LittleEndian>(session_time)?;

        self.connection_count += 1;
        buffer.write_u32::<LittleEndian>(self.connection_count)?;

        // 3. Length-prefixed Ownership Ticket
        buffer.write_u32::<LittleEndian>(ownership_ticket.len() as u32)?;
        buffer.write_all(&ownership_ticket)?;

        // Calculate CRC32
        let mut crc = flate2::Crc::new();
        crc.update(&buffer);
        let crc32 = crc.sum();

        // Create the ticket object
        let ticket = AuthSessionTicket {
            ticket: buffer,
            handle: 0,
            appid,
            steam_id: 0, // 0 indicates "self" / our own ticket
            ticket_crc: crc32,
            estate: 0,
        };

        // Activate the ticket
        self.activate_auth_session_tickets(appid, vec![ticket.clone()]).await?;

        Ok(ticket)
    }

    /// Cancel an auth session ticket.
    ///
    /// Call this when you're done using a ticket to free resources.
    ///
    /// # Arguments
    /// * `ticket` - The ticket to cancel
    pub async fn cancel_auth_session_ticket(&mut self, ticket: AuthSessionTicket) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        // Remove from active tickets
        if let Some(pos) = self.active_tickets.iter().position(|t| t.steam_id == ticket.steam_id && t.appid == ticket.appid && t.ticket_crc == ticket.ticket_crc) {
            self.active_tickets.remove(pos);
        }

        // Update the auth list to remove this ticket
        self.send_auth_list(Some(ticket.appid)).await
    }

    /// Activate auth session tickets to validate players.
    ///
    /// This is typically used by game servers to validate connecting players.
    ///
    /// # Arguments
    /// * `appid` - The app ID
    /// * `tickets` - Tickets to activate
    pub async fn activate_auth_session_tickets(&mut self, appid: u32, tickets: Vec<AuthSessionTicket>) -> Result<Vec<AuthSessionResult>, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        for mut ticket in tickets {
            // Check if already active
            if self.active_tickets.iter().any(|t| t.steam_id == ticket.steam_id && t.appid == ticket.appid && t.ticket_crc == ticket.ticket_crc) {
                continue;
            }

            // If we have an active ticket for this user/app, remove it (unless it's our
            // own)
            if ticket.steam_id != 0 {
                if let Some(pos) = self.active_tickets.iter().position(|t| t.steam_id == ticket.steam_id && t.appid == ticket.appid) {
                    self.active_tickets.remove(pos);
                }
            }

            // Add to active list
            ticket.estate = if ticket.steam_id == 0 { 0 } else { 1 };
            self.active_tickets.push(ticket);
        }

        self.send_auth_list(Some(appid)).await?;

        // Return empty for now - proper implementation would wait for response
        Ok(Vec::new())
    }

    /// End auth sessions for specific users.
    ///
    /// # Arguments
    /// * `appid` - The app ID
    /// * `steamids` - SteamIDs of users to end sessions for
    pub async fn end_auth_sessions(&mut self, appid: u32, steamids: Vec<SteamID>) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        // Remove from active tickets
        let steamids_u64: Vec<u64> = steamids.iter().map(|s| s.steam_id64()).collect();
        self.active_tickets.retain(|t| !(t.appid == appid && steamids_u64.contains(&t.steam_id)));

        self.send_auth_list(Some(appid)).await
    }

    /// Send the ClientAuthList message with current active tickets.
    async fn send_auth_list(&mut self, force_appid: Option<u32>) -> Result<(), SteamError> {
        let mut app_ids: Vec<u32> = self.active_tickets.iter().map(|t| t.appid).collect();
        app_ids.sort();
        app_ids.dedup();

        if let Some(aid) = force_appid {
            if !app_ids.contains(&aid) {
                app_ids.push(aid);
            }
        }

        let mut msg = steam_protos::CMsgClientAuthList {
            tokens_left: Some(self.gc_tokens.len() as u32),
            last_request_seq: Some(self.auth.read().auth_seq_me),
            last_request_seq_from_server: Some(self.auth.read().auth_seq_them),
            app_ids: app_ids.clone(),
            message_sequence: Some(self.auth.read().auth_seq_me + 1),
            ..Default::default()
        };

        for ticket in &self.active_tickets {
            let ticket_msg = steam_protos::CMsgAuthTicket {
                gameid: Some(ticket.appid as u64),
                ticket: Some(ticket.ticket.clone()),
                h_steam_pipe: Some(self.h_steam_pipe),
                ticket_crc: Some(ticket.ticket_crc),
                steamid: Some(ticket.steam_id),
                ..Default::default()
            };
            msg.tickets.push(ticket_msg);
        }

        self.auth.write().auth_seq_me += 1;

        self.send_message(steam_enums::EMsg::ClientAuthList, &msg).await
    }
}
