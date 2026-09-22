//! Content delivery network (CDN) functionality for Steam client.
//!
//! This module provides functionality for downloading game content
//! from Steam's CDN, including manifest parsing and file downloads.

use sha1::{Digest, Sha1};

use crate::{error::SteamError, SteamClient};

/// A Steam content server.
#[derive(Debug, Clone)]
pub struct ContentServer {
    /// Server type (e.g., "CDN", "SteamCache").
    pub server_type: String,
    /// Source ID.
    pub source_id: u32,
    /// Cell ID.
    pub cell_id: u32,
    /// Server load (lower is better).
    pub load: f32,
    /// Weighted load.
    pub weighted_load: f32,
    /// Host address.
    pub host: String,
    /// Virtual host.
    pub vhost: String,
    /// Whether HTTPS is supported.
    pub https_support: bool,
    /// Allowed app IDs (if restricted).
    pub allowed_app_ids: Option<Vec<u32>>,
}

/// A CDN auth token for downloading content.
#[derive(Debug, Clone)]
pub struct CdnAuthToken {
    /// The auth token.
    pub token: String,
    /// Expiration time (Unix timestamp).
    pub expires: u64,
    /// Hostname this token is valid for.
    pub hostname: String,
}

/// A depot manifest describing game content.
#[derive(Debug, Clone)]
pub struct DepotManifest {
    /// Depot ID.
    pub depot_id: u32,
    /// Manifest ID (GID).
    pub manifest_id: u64,
    /// Creation time (Unix timestamp).
    pub creation_time: u32,
    /// Total uncompressed size in bytes.
    pub total_uncompressed_size: u64,
    /// Total compressed size in bytes.
    pub total_compressed_size: u64,
    /// Unique chunk count.
    pub unique_chunks: u32,
    /// Number of files.
    pub file_count: u32,
    /// Files in this manifest.
    pub files: Vec<ManifestFile>,
}

/// A file in a depot manifest.
#[derive(Debug, Clone)]
pub struct ManifestFile {
    /// File path (relative).
    pub filename: String,
    /// File size in bytes.
    pub size: u64,
    /// File flags.
    pub flags: u32,
    /// SHA1 hash of content.
    pub sha_content: Vec<u8>,
    /// SHA1 hash of filename.
    pub sha_filename: Vec<u8>,
    /// Chunks that make up this file.
    pub chunks: Vec<FileChunk>,
}

/// A chunk of a file.
#[derive(Debug, Clone)]
pub struct FileChunk {
    /// SHA1 hash of the chunk (also used as chunk ID).
    pub sha: Vec<u8>,
    /// CRC32 of the chunk.
    pub crc: u32,
    /// Offset within the file.
    pub offset: u64,
    /// Compressed size.
    pub compressed_size: u32,
    /// Uncompressed size.
    pub uncompressed_size: u32,
}

/// File flags for manifest files.
#[allow(dead_code)]
pub mod file_flags {
    /// File is a directory.
    pub const DIRECTORY: u32 = 0x40;
    /// File is encrypted.
    pub const EXECUTABLE: u32 = 0x80;
    /// File is hidden.
    pub const HIDDEN: u32 = 0x100;
}

impl SteamClient {
    /// Get a list of currently available content servers.
    ///
    /// # Arguments
    /// * `appid` - Optional app ID to filter servers that serve specific games
    pub async fn get_content_servers(&mut self, appid: Option<u32>) -> Result<Vec<ContentServer>, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        // Use the Web API to get content servers
        let cell_id = self.account.read().cell_id.unwrap_or(0);
        let cell_id_str = cell_id.to_string();

        let resp = self.http_client.get_with_query("https://api.steampowered.com/IContentServerDirectoryService/GetServersForSteamPipe/v1/", &[("cell_id", cell_id_str.as_str())]).await?;

        let json: serde_json::Value = resp.json()?;

        let mut servers = Vec::new();

        if let Some(server_list) = json["response"]["servers"].as_array() {
            for server in server_list {
                // Filter by app ID if specified
                if let Some(app) = appid {
                    if let Some(allowed) = server["allowed_app_ids"].as_array() {
                        let allowed_ids: Vec<u32> = allowed.iter().filter_map(|v| v.as_u64().map(|n| n as u32)).collect();
                        if !allowed_ids.is_empty() && !allowed_ids.contains(&app) {
                            continue;
                        }
                    }
                }

                let server_type = server["type"].as_str().unwrap_or("").to_string();
                if server_type != "CDN" && server_type != "SteamCache" {
                    continue;
                }

                servers.push(ContentServer {
                    server_type,
                    source_id: server["source_id"].as_u64().unwrap_or(0) as u32,
                    cell_id: server["cell_id"].as_u64().unwrap_or(0) as u32,
                    load: server["load"].as_f64().unwrap_or(1.0) as f32,
                    weighted_load: server["weighted_load"].as_f64().unwrap_or(1.0) as f32,
                    host: server["host"].as_str().unwrap_or("").to_string(),
                    vhost: server["vhost"].as_str().unwrap_or("").to_string(),
                    https_support: server["https_support"].as_str() == Some("mandatory"),
                    allowed_app_ids: server["allowed_app_ids"].as_array().map(|arr| arr.iter().filter_map(|v| v.as_u64().map(|n| n as u32)).collect()),
                });
            }
        }

        Ok(servers)
    }

    /// Request the decryption key for a particular depot.
    ///
    /// # Arguments
    /// * `appid` - The app ID
    /// * `depotid` - The depot ID
    ///
    /// # Returns
    /// The depot decryption key (32 bytes).
    pub async fn get_depot_decryption_key(&mut self, appid: u32, depotid: u32) -> Result<Vec<u8>, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgClientGetDepotDecryptionKey { depot_id: Some(depotid), app_id: Some(appid) };

        self.send_message(steam_enums::EMsg::ClientGetDepotDecryptionKey, &msg).await?;

        // Return empty for now - proper implementation would wait for response
        Ok(Vec::new())
    }

    /// Request decryption keys for a beta branch of an app from its beta
    /// password.
    ///
    /// # Arguments
    /// * `appid` - The app ID
    /// * `password` - The beta password
    pub async fn get_app_beta_decryption_keys(&mut self, appid: u32, password: &str) -> Result<std::collections::HashMap<String, Vec<u8>>, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgClientCheckAppBetaPassword { app_id: Some(appid), betapassword: Some(password.to_string()) };

        let resp: steam_protos::CMsgClientCheckAppBetaPasswordResponse = self.send_request_and_wait(steam_enums::EMsg::ClientCheckAppBetaPassword, &msg).await?;

        if resp.eresult != Some(1) {
            return Err(SteamError::SteamResult(steam_enums::EResult::from_i32(resp.eresult.unwrap_or(2)).unwrap_or(steam_enums::EResult::Fail)));
        }

        let mut branches = std::collections::HashMap::new();
        for beta in resp.betapasswords {
            if let (Some(name), Some(key)) = (beta.betaname, beta.betapassword) {
                branches.insert(name, key);
            }
        }

        Ok(branches)
    }

    /// Get a manifest request code for downloading a manifest.
    ///
    /// # Arguments
    /// * `appid` - The app ID
    /// * `depotid` - The depot ID
    /// * `manifest_id` - The manifest ID
    /// * `branch_name` - The branch name (default: "public")
    /// * `branch_password` - Optional branch password
    pub async fn get_manifest_request_code(&mut self, appid: u32, depotid: u32, manifest_id: u64, branch_name: Option<String>, branch_password: Option<String>) -> Result<u64, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let branch = branch_name.unwrap_or_else(|| "public".to_string());
        let password_hash = branch_password.map(|p| {
            let mut hasher = Sha1::new();
            hasher.update(p.as_bytes());
            hex::encode(hasher.finalize())
        });

        let req = steam_protos::CContentServerDirectoryGetManifestRequestCodeRequest {
            app_id: Some(appid),
            depot_id: Some(depotid),
            manifest_id: Some(manifest_id),
            app_branch: Some(branch),
            branch_password_hash: password_hash,
        };

        let resp: steam_protos::CContentServerDirectoryGetManifestRequestCodeResponse = self.send_unified_request_and_wait("ContentServerDirectory.GetManifestRequestCode#1", &req).await?;

        Ok(resp.manifest_request_code.unwrap_or(0))
    }

    /// Get an auth token for a particular CDN server.
    ///
    /// # Arguments
    /// * `appid` - The app ID
    /// * `depotid` - The depot ID
    /// * `hostname` - The hostname of the CDN server
    pub async fn get_cdn_auth_token(&mut self, appid: u32, depotid: u32, hostname: &str) -> Result<CdnAuthToken, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgClientGetCdnAuthToken { depot_id: Some(depotid), host_name: Some(hostname.to_string()), app_id: Some(appid) };

        self.send_message(steam_enums::EMsg::ClientGetCDNAuthToken, &msg).await?;

        // Return placeholder for now - proper implementation would wait for response
        Ok(CdnAuthToken { token: String::new(), expires: 0, hostname: hostname.to_string() })
    }

    /// Get a manifest for a depot.
    ///
    /// # Arguments
    /// * `appid` - The app ID
    /// * `depotid` - The depot ID
    /// * `manifest_id` - The manifest ID
    /// * `branch_name` - The branch name (default: "public")
    /// * `branch_password` - Optional branch password
    /// * `server` - Content server to download from
    /// * `depot_key` - Depot decryption key
    #[allow(clippy::too_many_arguments)]
    pub async fn get_manifest(&mut self, appid: u32, depotid: u32, manifest_id: u64, branch_name: Option<String>, branch_password: Option<String>, server: &ContentServer, _depot_key: &[u8]) -> Result<DepotManifest, SteamError> {
        // Build the manifest URL
        let scheme = if server.https_support { "https" } else { "http" };
        let host = if !server.vhost.is_empty() { &server.vhost } else { &server.host };

        // Get manifest request code
        let request_code = self.get_manifest_request_code(appid, depotid, manifest_id, branch_name, branch_password).await?;

        let url = format!("{}://{}/depot/{}/manifest/{}/5/{}", scheme, host, depotid, manifest_id, request_code);

        // Get CDN auth token
        let auth_token = self.get_cdn_auth_token(appid, depotid, host).await?;

        // Download the manifest
        let resp = self.http_client.get_with_query(&url, &[("t", auth_token.token.as_str())]).await?;

        if !resp.is_success() {
            return Err(SteamError::Other(format!("Failed to download manifest: {}", resp.status)));
        }

        // Parse the manifest (would need manifest parsing code)
        // For now return a placeholder
        Ok(DepotManifest {
            depot_id: depotid,
            manifest_id,
            creation_time: 0,
            total_uncompressed_size: 0,
            total_compressed_size: 0,
            unique_chunks: 0,
            file_count: 0,
            files: Vec::new(),
        })
    }

    /// Download a raw (encrypted/compressed) chunk from a content server.
    ///
    /// # Warning
    /// This returns raw chunk data that is still **encrypted** and
    /// **compressed**. To use this data, you must:
    /// 1. Decrypt using the depot key (AES-256-ECB, first 16 bytes are IV)
    /// 2. Decompress (LZMA or ZIP depending on format)
    /// 3. Verify CRC32 matches the chunk's `crc` field
    ///
    /// # Arguments
    /// * `appid` - The app ID (for CDN authentication)
    /// * `depotid` - The depot ID
    /// * `chunk` - The chunk to download
    /// * `server` - Content server to download from
    /// * `_depot_key` - Depot decryption key (not used yet, for future
    ///   decryption)
    pub async fn download_chunk_raw(&mut self, appid: u32, depotid: u32, chunk: &FileChunk, server: &ContentServer, _depot_key: &[u8]) -> Result<Vec<u8>, SteamError> {
        let scheme = if server.https_support { "https" } else { "http" };
        let host = if !server.vhost.is_empty() { &server.vhost } else { &server.host };
        let chunk_id = hex::encode(&chunk.sha);
        let url = format!("{}://{}/depot/{}/chunk/{}", scheme, host, depotid, chunk_id);

        // Get CDN auth token for this server
        let auth_token = self.get_cdn_auth_token(appid, depotid, host).await?;

        let resp = self.http_client.get_with_query(&url, &[("t", auth_token.token.as_str())]).await?;

        if !resp.is_success() {
            return Err(SteamError::Other(format!("Failed to download chunk: {}", resp.status)));
        }

        Ok(resp.body)
    }
}
