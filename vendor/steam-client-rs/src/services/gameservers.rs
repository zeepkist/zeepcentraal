//! Game server queries for Steam client.
//!
//! This module provides functionality for querying Steam game servers.

use std::{collections::HashMap, net::Ipv4Addr};

use steamid::SteamID;

use crate::{error::SteamError, SteamClient};

/// Information about a game server.
#[derive(Debug, Clone)]
pub struct GameServer {
    /// Server IP address.
    pub ip: String,
    /// Server port.
    pub port: u16,
    /// Number of authenticated players.
    pub players: u32,
    /// Server SteamID (if available).
    pub steamid: Option<SteamID>,
    /// Server name.
    pub name: Option<String>,
    /// Current map.
    pub map: Option<String>,
    /// Game directory.
    pub gamedir: Option<String>,
    /// Game description.
    pub gamedesc: Option<String>,
    /// App ID.
    pub appid: Option<u32>,
    /// Number of bots.
    pub bots: Option<u32>,
    /// Max players.
    pub max_players: Option<u32>,
    /// Whether password protected.
    pub password: Option<bool>,
    /// Whether VAC secured.
    pub secure: Option<bool>,
    /// Game version.
    pub version: Option<String>,
}

impl SteamClient {
    /// Query the GMS for a list of game server IPs and their current player
    /// counts.
    ///
    /// # Arguments
    /// * `filter` - A filter string. See: https://developer.valvesoftware.com/wiki/Master_Server_Query_Protocol#Filter
    ///
    /// # Example filters
    /// - `\appid\730` - CS2 servers
    /// - `\gametype\competitive` - Competitive servers
    /// - `\map\de_dust2` - Servers on de_dust2
    pub async fn server_query(&mut self, filter: &str) -> Result<Vec<GameServer>, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgClientGMSServerQuery { filter_text: Some(filter.to_string()), ..Default::default() };

        let response: steam_protos::CMsgGMSClientServerQueryResponse = self.send_request_and_wait(steam_enums::EMsg::ClientGMSServerQuery, &msg).await?;

        if let Some(error) = response.error {
            return Err(SteamError::Other(error));
        }

        let mut servers = Vec::new();
        for server in response.servers {
            let ip_str = if let Some(ip_addr) = server.server_ip {
                if let Some(steam_protos::cmsg_ip_address::Ip::V4(v4)) = ip_addr.ip {
                    Ipv4Addr::from(v4).to_string()
                } else {
                    continue; // Skip IPv6 for now as per Node implementation
                }
            } else {
                continue;
            };

            servers.push(GameServer {
                ip: ip_str,
                port: server.query_port.unwrap_or(0) as u16,
                players: server.auth_players.unwrap_or(0),
                steamid: None,
                name: None,
                map: None,
                gamedir: None,
                gamedesc: None,
                appid: None,
                bots: None,
                max_players: None,
                password: None,
                secure: None,
                version: None,
            });
        }

        Ok(servers)
    }

    /// Get a list of servers including full game data.
    ///
    /// # Arguments
    /// * `filter` - A filter string
    /// * `limit` - Maximum number of servers to return (max ~20,000)
    pub async fn get_server_list(&mut self, filter: &str, limit: u32) -> Result<Vec<GameServer>, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CGameServersGetServerListRequest { filter: Some(filter.to_string()), limit: Some(limit) };

        let response: steam_protos::CGameServersGetServerListResponse = self.send_service_method_and_wait("GameServers.GetServerList#1", &msg).await?;

        let mut servers = Vec::new();
        for server in response.servers {
            let parts: Vec<&str> = server.addr.as_deref().unwrap_or("").split(':').collect();
            let ip = parts.first().unwrap_or(&"").to_string();
            let port = parts.get(1).and_then(|p| p.parse().ok()).unwrap_or(0);

            servers.push(GameServer {
                ip,
                port,
                players: server.players.unwrap_or(0) as u32,
                steamid: server.steamid.map(SteamID::from),
                name: server.name,
                map: server.map,
                gamedir: server.gamedir,
                gamedesc: server.gametype, // Using gametype as gamedesc based on proto definition
                appid: server.appid,
                bots: server.bots.map(|b| b as u32),
                max_players: server.max_players.map(|p| p as u32),
                password: None, // Not directly in response? Node implementation doesn't map it explicitly
                secure: server.secure,
                version: server.version,
            });
        }

        Ok(servers)
    }

    /// Get the associated SteamIDs for given server IPs.
    ///
    /// # Arguments
    /// * `ips` - List of server IP:port strings (e.g., "192.168.1.1:27015")
    pub async fn get_server_steam_ids_by_ip(&mut self, ips: Vec<String>) -> Result<HashMap<String, SteamID>, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CGameServersGetServerSteamIDsByIPRequest { server_ips: ips };

        let response: steam_protos::CGameServersIPsWithSteamIDsResponse = self.send_service_method_and_wait("GameServers.GetServerSteamIDsByIP#1", &msg).await?;

        let mut result = HashMap::new();
        for server in response.servers {
            if let (Some(addr), Some(steamid)) = (server.addr, server.steamid) {
                result.insert(addr, SteamID::from(steamid));
            }
        }

        Ok(result)
    }

    /// Get the associated IPs for given server SteamIDs.
    ///
    /// # Arguments
    /// * `steamids` - List of server SteamIDs
    pub async fn get_server_ips_by_steam_id(&mut self, steamids: Vec<SteamID>) -> Result<HashMap<SteamID, String>, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CGameServersGetServerIPsBySteamIDRequest { server_steamids: steamids.iter().map(|s| s.steam_id64()).collect() };

        let response: steam_protos::CGameServersIPsWithSteamIDsResponse = self.send_service_method_and_wait("GameServers.GetServerIPsBySteamID#1", &msg).await?;

        let mut result = HashMap::new();
        for server in response.servers {
            if let (Some(addr), Some(steamid)) = (server.addr, server.steamid) {
                result.insert(SteamID::from(steamid), addr);
            }
        }

        Ok(result)
    }
}
