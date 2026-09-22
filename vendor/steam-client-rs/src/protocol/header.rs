//! Steam message headers.

use bytes::{Buf, BufMut, BytesMut};
use prost::Message;

use crate::error::SteamError;

/// Steam message header types.
#[derive(Debug, Clone)]
pub enum MessageHeader {
    /// Protobuf message header.
    Protobuf(ProtobufMessageHeader),
    /// Extended (non-protobuf) message header.
    Extended(ExtendedMessageHeader),
    /// Minimal message header (used for channel encryption).
    Minimal(MinimalMessageHeader),
}

/// Minimal message header (used for channel encryption).
#[derive(Debug, Clone, Default)]
pub struct MinimalMessageHeader {
    /// Target job ID.
    pub target_job_id: u64,
    /// Source job ID.
    pub source_job_id: u64,
}

impl MinimalMessageHeader {
    /// Size of the minimal header.
    pub const SIZE: usize = 16;

    /// Encode the header to bytes.
    pub fn encode(&self, buf: &mut BytesMut) {
        buf.put_u64_le(self.target_job_id);
        buf.put_u64_le(self.source_job_id);
    }

    /// Decode the header from bytes.
    pub fn decode(buf: &mut &[u8]) -> Result<Self, SteamError> {
        if buf.len() < Self::SIZE {
            return Err(SteamError::ProtocolError("Minimal header too short".into()));
        }

        let target_job_id = buf.get_u64_le();
        let source_job_id = buf.get_u64_le();

        Ok(Self { target_job_id, source_job_id })
    }
}

/// Protobuf message header.
#[derive(Debug, Clone, Default)]
pub struct ProtobufMessageHeader {
    /// Header length.
    pub header_length: u32,
    /// Client session ID.
    pub session_id: i32,
    /// Steam ID.
    pub steam_id: u64,
    /// Job ID source.
    pub job_id_source: u64,
    /// Job ID target.
    pub job_id_target: u64,
    /// Target job name (for service method calls).
    pub target_job_name: Option<String>,
    /// Routing App ID (for GC messages).
    pub routing_appid: Option<u32>,
}

/// CMsgProtoBufHeader protobuf message.
#[derive(Clone, PartialEq, prost::Message)]
pub struct CMsgProtoBufHeader {
    #[prost(fixed64, optional, tag = "1")]
    pub steamid: Option<u64>,
    #[prost(int32, optional, tag = "2")]
    pub client_sessionid: Option<i32>,
    #[prost(uint32, optional, tag = "3")]
    pub routing_appid: Option<u32>,
    #[prost(fixed64, optional, tag = "10")]
    pub jobid_source: Option<u64>,
    #[prost(fixed64, optional, tag = "11")]
    pub jobid_target: Option<u64>,
    #[prost(string, optional, tag = "12")]
    pub target_job_name: Option<String>,
    #[prost(int32, optional, tag = "13")]
    pub eresult: Option<i32>,
    #[prost(string, optional, tag = "14")]
    pub error_message: Option<String>,
    #[prost(uint32, optional, tag = "15")]
    pub ip: Option<u32>,
    #[prost(uint32, optional, tag = "16")]
    pub auth_account_flags: Option<u32>,
    #[prost(int32, optional, tag = "17")]
    pub transport_error: Option<i32>,
    #[prost(uint64, optional, tag = "18")]
    pub messageid: Option<u64>,
    #[prost(uint32, optional, tag = "19")]
    pub publisher_group_id: Option<u32>,
    #[prost(uint32, optional, tag = "20")]
    pub sysid: Option<u32>,
    #[prost(uint64, optional, tag = "21")]
    pub trace_tag: Option<u64>,
    #[prost(uint32, optional, tag = "22")]
    pub token_source: Option<u32>,
    #[prost(bool, optional, tag = "23")]
    pub admin_spoofing_user: Option<bool>,
    #[prost(int32, optional, tag = "24")]
    pub seq_num: Option<i32>,
    #[prost(uint32, optional, tag = "25")]
    pub webapi_key_id: Option<u32>,
    #[prost(bool, optional, tag = "26")]
    pub is_from_external_source: Option<bool>,
    #[prost(uint32, repeated, tag = "27")]
    pub forward_to_sysid: Vec<u32>,
    #[prost(uint32, optional, tag = "28")]
    pub cm_sysid: Option<u32>,
    #[prost(bytes = "vec", optional, tag = "29")]
    pub ip_v6: Option<Vec<u8>>,
    #[prost(uint32, optional, tag = "31")]
    pub launcher_type: Option<u32>,
    #[prost(uint32, optional, tag = "32")]
    pub realm: Option<u32>,
    #[prost(int32, optional, tag = "33")]
    pub timeout_ms: Option<i32>,
    #[prost(string, optional, tag = "34")]
    pub debug_source: Option<String>,
    #[prost(uint32, optional, tag = "35")]
    pub debug_source_string_index: Option<u32>,
    #[prost(uint64, optional, tag = "36")]
    pub token_id: Option<u64>,
    // routing_gc (37) requires nested type definition, skipping for now as it seems unused in core client logic
}

impl ProtobufMessageHeader {
    /// Encode the header to bytes.
    pub fn encode(&self, buf: &mut BytesMut) {
        let proto_header = CMsgProtoBufHeader {
            steamid: if self.steam_id != 0 { Some(self.steam_id) } else { None },
            client_sessionid: if self.session_id != 0 { Some(self.session_id) } else { None },
            jobid_source: if self.job_id_source != u64::MAX { Some(self.job_id_source) } else { None },
            jobid_target: if self.job_id_target != u64::MAX { Some(self.job_id_target) } else { None },
            target_job_name: self.target_job_name.clone(),
            routing_appid: self.routing_appid,
            ..Default::default()
        };

        let header_bytes = proto_header.encode_to_vec();
        buf.put_u32_le(header_bytes.len() as u32);
        buf.extend_from_slice(&header_bytes);
    }

    /// Decode the header from bytes.
    pub fn decode(buf: &mut &[u8]) -> Result<Self, SteamError> {
        if buf.len() < 4 {
            return Err(SteamError::ProtocolError("Header too short".into()));
        }

        let header_length = buf.get_u32_le();

        if buf.len() < header_length as usize {
            return Err(SteamError::ProtocolError("Header length mismatch".into()));
        }

        let header_bytes = &buf[..header_length as usize];
        *buf = &buf[header_length as usize..];

        let proto_header = CMsgProtoBufHeader::decode(header_bytes).map_err(|e| SteamError::ProtocolError(format!("Failed to decode header: {}", e)))?;

        Ok(Self {
            header_length,
            session_id: proto_header.client_sessionid.unwrap_or(0),
            steam_id: proto_header.steamid.unwrap_or(0),
            job_id_source: proto_header.jobid_source.unwrap_or(u64::MAX),
            job_id_target: proto_header.jobid_target.unwrap_or(u64::MAX),
            target_job_name: proto_header.target_job_name,
            routing_appid: proto_header.routing_appid,
        })
    }
}

/// Extended (non-protobuf) message header.
#[derive(Debug, Clone, Default)]
pub struct ExtendedMessageHeader {
    /// Header size.
    pub header_size: u8,
    /// Header version.
    pub header_version: u16,
    /// Target job ID.
    pub target_job_id: u64,
    /// Source job ID.
    pub source_job_id: u64,
    /// Header canary.
    pub header_canary: u8,
    /// Steam ID.
    pub steam_id: u64,
    /// Session ID.
    pub session_id: i32,
}

impl ExtendedMessageHeader {
    /// Size of the extended header.
    pub const SIZE: usize = 36;

    /// Encode the header to bytes.
    pub fn encode(&self, buf: &mut BytesMut) {
        buf.put_u8(Self::SIZE as u8);
        buf.put_u16_le(2); // version
        buf.put_u64_le(self.target_job_id);
        buf.put_u64_le(self.source_job_id);
        buf.put_u8(239); // canary
        buf.put_u64_le(self.steam_id);
        buf.put_i32_le(self.session_id);
    }

    /// Decode the header from bytes.
    pub fn decode(buf: &mut &[u8]) -> Result<Self, SteamError> {
        if buf.len() < Self::SIZE {
            return Err(SteamError::ProtocolError("Extended header too short".into()));
        }

        let header_size = buf.get_u8();
        let header_version = buf.get_u16_le();
        let target_job_id = buf.get_u64_le();
        let source_job_id = buf.get_u64_le();
        let header_canary = buf.get_u8();
        let steam_id = buf.get_u64_le();
        let session_id = buf.get_i32_le();

        Ok(Self { header_size, header_version, target_job_id, source_job_id, header_canary, steam_id, session_id })
    }
}
