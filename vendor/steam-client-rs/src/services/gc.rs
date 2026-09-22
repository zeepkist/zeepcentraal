//! Game Coordinator functionality for Steam client.
//!
//! This module provides communication with game-specific Game Coordinator
//! servers. Each game (like CS:GO, Dota 2, TF2) has its own GC that handles
//! game-specific functionality like matchmaking, inventories, and more.

use prost::Message;
use steam_enums::{ECsgoGCMsg, EMsg};

use crate::{error::SteamError, protocol::header::CMsgProtoBufHeader, SteamClient};

/// Proto mask for identifying protobuf GC messages.
const PROTO_MASK: u32 = 0x80000000;

/// A received Game Coordinator message.
#[derive(Debug, Clone)]
pub struct GCMessage {
    /// The app ID this GC message is for.
    pub appid: u32,
    /// The GC message type (without proto mask).
    pub msg_type: u32,
    /// Whether this is a protobuf message.
    pub is_protobuf: bool,
    /// The message payload.
    pub payload: Vec<u8>,
    /// The target job ID (if available).
    pub target_job_id: Option<u64>,
    /// The source job ID (if available).
    pub source_job_id: Option<u64>,
}

/// Options for sending a GC message.
#[derive(Debug, Clone, Default)]
pub struct GCSendOptions {
    /// The protobuf header (if protobuf message).
    pub proto_header: Option<GCProtoHeader>,
    /// The legacy header (if non-protobuf message).
    pub legacy_header: Option<GCLegacyHeader>,
}

/// Protobuf header for GC messages.
#[derive(Debug, Clone)]
pub struct GCProtoHeader {
    /// Job ID source.
    pub job_id_source: u64,
    /// Job ID target.
    pub job_id_target: u64,
    /// Target job name.
    pub target_job_name: Option<String>,
}

impl Default for GCProtoHeader {
    fn default() -> Self {
        Self { job_id_source: u64::MAX, job_id_target: u64::MAX, target_job_name: None }
    }
}

/// Legacy header for GC messages.
#[derive(Debug, Clone)]
pub struct GCLegacyHeader {
    /// Job ID source.
    pub job_id_source: u64,
    /// Job ID target.
    pub job_id_target: u64,
}

impl Default for GCLegacyHeader {
    fn default() -> Self {
        Self { job_id_source: u64::MAX, job_id_target: u64::MAX }
    }
}

impl SteamClient {
    /// Send a message to a Game Coordinator.
    ///
    /// You should be currently "in-game" for the specified app for the message
    /// to make it to the GC.
    ///
    /// # Arguments
    /// * `appid` - The app ID to send the GC message to (e.g., 730 for CS:GO)
    /// * `msg_type` - The GC-specific message type ID
    /// * `payload` - The message payload bytes
    ///
    /// # Example
    /// ```rust,ignore
    /// // Send a CS:GO GC message
    /// client.send_to_gc(730, 4006, &payload).await?;
    /// ```
    pub async fn send_to_gc(&mut self, appid: u32, msg_type: u32, payload: &[u8]) -> Result<(), SteamError> {
        self.send_to_gc_with_options(appid, msg_type, payload, GCSendOptions::default()).await
    }

    /// Send a protobuf message to a Game Coordinator.
    ///
    /// # Arguments
    /// * `appid` - The app ID to send the GC message to
    /// * `msg_type` - The GC-specific message type ID
    /// * `payload` - The message payload bytes
    /// * `header` - The protobuf header
    pub async fn send_to_gc_proto(&mut self, appid: u32, msg_type: u32, payload: &[u8], header: GCProtoHeader) -> Result<(), SteamError> {
        self.send_to_gc_with_options(appid, msg_type, payload, GCSendOptions { proto_header: Some(header), legacy_header: None }).await
    }

    /// Send a message to a Game Coordinator with options.
    pub async fn send_to_gc_with_options(&mut self, appid: u32, msg_type: u32, payload: &[u8], options: GCSendOptions) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        // Check if this is a protobuf message BEFORE consuming the option
        let is_protobuf = options.proto_header.is_some();

        let gc_payload = if let Some(proto_header) = options.proto_header {
            // Protobuf message
            let msg_type_with_proto = msg_type | PROTO_MASK;

            // Encode proto header
            let proto_header_bytes = encode_gc_proto_header(&proto_header);

            // Build header: msg_type (4 bytes) + header_len (4 bytes) + proto_header
            let mut header = Vec::with_capacity(8 + proto_header_bytes.len());
            header.extend_from_slice(&msg_type_with_proto.to_le_bytes());
            header.extend_from_slice(&(proto_header_bytes.len() as i32).to_le_bytes());
            header.extend_from_slice(&proto_header_bytes);
            header.extend_from_slice(payload);
            header
        } else {
            // Non-protobuf message with simple header
            let (job_id_source, job_id_target) = if let Some(header) = options.legacy_header { (header.job_id_source, header.job_id_target) } else { (u64::MAX, u64::MAX) };

            let mut header = Vec::with_capacity(18 + payload.len());
            header.extend_from_slice(&1u16.to_le_bytes()); // header version
            header.extend_from_slice(&job_id_target.to_le_bytes()); // target job
            header.extend_from_slice(&job_id_source.to_le_bytes()); // source job
            header.extend_from_slice(payload);
            header
        };

        // Build the ClientToGC message
        // For protobuf messages, the msgtype in CMsgGCClient must include the
        // PROTO_MASK
        let final_msg_type = if is_protobuf { msg_type | PROTO_MASK } else { msg_type };

        let gc_msg = steam_protos::CMsgGCClient { appid: Some(appid), msgtype: Some(final_msg_type), payload: Some(gc_payload), ..Default::default() };

        self.send_message_with_routing(EMsg::ClientToGC, appid, &gc_msg).await
    }

    /// Request CS:GO player profile.
    ///
    /// Sends a `ClientRequestPlayersProfile` message to the GC.
    /// The response will be emitting via `AppsEvent::PlayersProfile`.
    pub async fn request_players_profile(&mut self, steam_id: steamid::SteamID) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgGccStrike15V2ClientRequestPlayersProfile {
            account_id: Some(steam_id.account_id),
            request_level: Some(32), // Default request level (32 = all info?)
        };

        // ClientRequestPlayersProfile = 9127
        self.send_to_gc_proto(crate::services::csgo::APP_ID, ECsgoGCMsg::ClientRequestPlayersProfile as u32, &msg.encode_to_vec(), GCProtoHeader::default()).await
    }
}

/// Encode a GC protobuf header.
fn encode_gc_proto_header(header: &GCProtoHeader) -> Vec<u8> {
    let msg = CMsgProtoBufHeader {
        jobid_source: Some(header.job_id_source),
        jobid_target: Some(header.job_id_target),
        target_job_name: header.target_job_name.clone(),
        ..Default::default()
    };
    msg.encode_to_vec()
}

/// Parse a received GC message from ClientFromGC.
pub fn parse_gc_message(body: &steam_protos::CMsgGCClient) -> Option<GCMessage> {
    let appid = body.appid?;
    let raw_msg_type = body.msgtype?;
    let payload_bytes = body.payload.as_ref()?;

    let is_protobuf = (raw_msg_type & PROTO_MASK) != 0;
    let msg_type = raw_msg_type & !PROTO_MASK;

    let (payload, target_job_id, source_job_id) = if is_protobuf {
        // Protobuf: skip 8 bytes header + proto header length
        if payload_bytes.len() < 8 {
            return None;
        }
        let header_len = i32::from_le_bytes([payload_bytes[4], payload_bytes[5], payload_bytes[6], payload_bytes[7]]) as usize;

        if payload_bytes.len() < 8 + header_len {
            return None;
        }

        // Decode proto header to get job IDs
        let proto_header_bytes = &payload_bytes[8..8 + header_len];
        let proto_header = match CMsgProtoBufHeader::decode(proto_header_bytes) {
            Ok(header) => header,
            Err(_) => return None,
        };

        (payload_bytes[8 + header_len..].to_vec(), proto_header.jobid_target, proto_header.jobid_source)
    } else {
        // Non-protobuf: skip 18 byte header
        // Header format: [HeaderVersion: 2][TargetJob: 8][SourceJob: 8]
        if payload_bytes.len() < 18 {
            return None;
        }

        let target_job_id = u64::from_le_bytes([payload_bytes[2], payload_bytes[3], payload_bytes[4], payload_bytes[5], payload_bytes[6], payload_bytes[7], payload_bytes[8], payload_bytes[9]]);

        let source_job_id = u64::from_le_bytes([payload_bytes[10], payload_bytes[11], payload_bytes[12], payload_bytes[13], payload_bytes[14], payload_bytes[15], payload_bytes[16], payload_bytes[17]]);

        (payload_bytes[18..].to_vec(), Some(target_job_id), Some(source_job_id))
    };

    Some(GCMessage { appid, msg_type, is_protobuf, payload, target_job_id, source_job_id })
}

//=============================================================================
// GC Job Manager - Request/Response Correlation for GC Messages
//=============================================================================

use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use tokio::sync::oneshot;
use tracing::{debug, warn};

/// Response from a completed GC job.
#[derive(Debug)]
pub enum GCJobResponse {
    /// Successful response with raw payload bytes.
    Success(Vec<u8>),
    /// Job timed out waiting for response.
    Timeout,
}

/// A pending GC request awaiting response.
pub struct PendingGCJob {
    /// When the job was created.
    pub created_at: Instant,
    /// Timeout duration for this job.
    pub timeout: Duration,
    /// Channel to send the response.
    pub response_tx: oneshot::Sender<GCJobResponse>,
}

/// Key for identifying a pending GC job.
#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub struct GCJobKey {
    /// The app ID (e.g., 730 for CS:GO).
    pub appid: u32,
    /// The expected response message type.
    pub response_msg_type: u32,
}

/// Job manager for tracking pending GC requests.
#[derive(Clone)]
pub struct GCJobManager {
    inner: Arc<GCJobManagerInner>,
}

struct GCJobManagerInner {
    /// Pending jobs awaiting responses, keyed by (appid, response_msg_type).
    pending_jobs: Mutex<HashMap<GCJobKey, PendingGCJob>>,
    /// Default timeout for jobs.
    default_timeout: Duration,
}

impl GCJobManager {
    /// Create a new GC job manager.
    pub fn new() -> Self {
        Self::with_timeout(Duration::from_secs(30))
    }

    /// Create a new GC job manager with a custom default timeout.
    pub fn with_timeout(default_timeout: Duration) -> Self {
        Self { inner: Arc::new(GCJobManagerInner { pending_jobs: Mutex::new(HashMap::new()), default_timeout }) }
    }

    /// Create a new job and return the response receiver.
    ///
    /// The job is keyed by `(appid, response_msg_type)`. When a GC message
    /// matching this key arrives, the job will be completed.
    pub fn create_job(&self, appid: u32, response_msg_type: u32) -> oneshot::Receiver<GCJobResponse> {
        self.create_job_with_timeout(appid, response_msg_type, self.inner.default_timeout)
    }

    /// Create a new job with a custom timeout.
    pub fn create_job_with_timeout(&self, appid: u32, response_msg_type: u32, timeout: Duration) -> oneshot::Receiver<GCJobResponse> {
        let (tx, rx) = oneshot::channel();
        let key = GCJobKey { appid, response_msg_type };

        let job = PendingGCJob { created_at: Instant::now(), timeout, response_tx: tx };

        self.inner.pending_jobs.lock().expect("mutex poisoned").insert(key.clone(), job);
        debug!("Created GC job for appid={}, response_msg_type={}", appid, response_msg_type);

        rx
    }

    /// Try to complete a job with a GC message.
    ///
    /// Returns `true` if a matching job was found and completed.
    pub fn try_complete(&self, appid: u32, msg_type: u32, payload: Vec<u8>) -> bool {
        let key = GCJobKey { appid, response_msg_type: msg_type };

        if let Some(job) = self.inner.pending_jobs.lock().expect("mutex poisoned").remove(&key) {
            debug!("Completing GC job for appid={}, msg_type={}", appid, msg_type);
            let _ = job.response_tx.send(GCJobResponse::Success(payload));
            true
        } else {
            false
        }
    }

    /// Clean up expired jobs.
    pub fn cleanup_expired(&self) {
        let now = Instant::now();
        let mut pending = self.inner.pending_jobs.lock().expect("mutex poisoned");
        let expired_keys: Vec<GCJobKey> = pending.iter().filter(|(_, job)| now.duration_since(job.created_at) > job.timeout).map(|(key, _)| key.clone()).collect();

        for key in expired_keys {
            if let Some(job) = pending.remove(&key) {
                warn!("GC job expired for appid={}, response_msg_type={}", key.appid, key.response_msg_type);
                let _ = job.response_tx.send(GCJobResponse::Timeout);
            }
        }
    }

    /// Get the number of pending jobs.
    pub fn pending_count(&self) -> usize {
        self.inner.pending_jobs.lock().expect("mutex poisoned").len()
    }
}

impl Default for GCJobManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use steam_protos::CMsgGCClient;

    use super::*;
    use crate::protocol::header::CMsgProtoBufHeader;

    #[test]
    fn test_parse_gc_message_protobuf() -> Result<(), Box<dyn std::error::Error>> {
        // Construct a mock protobuf GC message payload
        // Format: [MsgType: 4][HeaderLen: 4][HeaderBytes][BodyBytes]
        let mut payload = Vec::new();
        let msg_type_raw: u32 = 1000 | PROTO_MASK;
        payload.extend_from_slice(&msg_type_raw.to_le_bytes());

        let header = CMsgProtoBufHeader { jobid_source: Some(1), jobid_target: Some(2), ..Default::default() };
        let header_bytes = header.encode_to_vec();

        payload.extend_from_slice(&(header_bytes.len() as i32).to_le_bytes());
        payload.extend_from_slice(&header_bytes);

        let body_content = vec![0x01, 0x02, 0x03];
        payload.extend_from_slice(&body_content);

        let input = CMsgGCClient {
            appid: Some(crate::services::csgo::APP_ID),
            msgtype: Some(msg_type_raw),
            payload: Some(payload),
            ..Default::default()
        };

        let result = parse_gc_message(&input).ok_or_else(|| std::io::Error::new(std::io::ErrorKind::InvalidData, "Invalid data"))?;

        assert_eq!(result.appid, crate::services::csgo::APP_ID);
        assert_eq!(result.msg_type, 1000);
        assert!(result.is_protobuf);
        assert_eq!(result.payload, body_content);
        assert_eq!(result.target_job_id, Some(2));
        assert_eq!(result.source_job_id, Some(1));
        Ok(())
    }

    #[test]
    fn test_parse_gc_message_legacy() -> Result<(), Box<dyn std::error::Error>> {
        // Construct a mock legacy GC message payload
        // Format: [HeaderVersion: 2][TargetJob: 8][SourceJob: 8][BodyBytes]
        let mut payload = Vec::new();
        payload.extend_from_slice(&1u16.to_le_bytes()); // Version
        payload.extend_from_slice(&u64::MAX.to_le_bytes()); // Target
        payload.extend_from_slice(&u64::MAX.to_le_bytes()); // Source

        let body_content = vec![0xAA, 0xBB, 0xCC];
        payload.extend_from_slice(&body_content);

        let input = CMsgGCClient {
            appid: Some(440),
            msgtype: Some(2000), // No proto mask
            payload: Some(payload),
            ..Default::default()
        };

        let result = parse_gc_message(&input).ok_or_else(|| std::io::Error::new(std::io::ErrorKind::InvalidData, "Invalid data"))?;

        assert_eq!(result.appid, 440);
        assert_eq!(result.msg_type, 2000);
        assert!(!result.is_protobuf);
        assert_eq!(result.payload, body_content);
        assert_eq!(result.target_job_id, Some(u64::MAX));
        assert_eq!(result.source_job_id, Some(u64::MAX));
        Ok(())
    }

    #[test]
    fn test_parse_gc_message_truncated() {
        // Test with truncated payload
        let input = CMsgGCClient {
            appid: Some(730),
            msgtype: Some(1000 | PROTO_MASK),
            payload: Some(vec![0x00]), // Too short
            ..Default::default()
        };

        let result = parse_gc_message(&input);
        assert!(result.is_none());
    }
}
