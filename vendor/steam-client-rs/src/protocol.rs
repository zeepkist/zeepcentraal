//! Steam protocol message framing.
//!
//! This module handles the encoding and decoding of Steam protocol messages,
//! including message headers and protobuf payloads.

pub(crate) mod header;
pub mod messages;

use bytes::{Buf, BufMut, Bytes, BytesMut};
pub use header::{ExtendedMessageHeader, MessageHeader, ProtobufMessageHeader};
use prost::Message;
use steam_enums::EMsg;

use crate::error::SteamError;

/// Represents a complete Steam protocol message.
#[derive(Debug)]
pub struct SteamMessage {
    /// The message type.
    pub msg: EMsg,
    /// Whether this is a protobuf message.
    pub is_proto: bool,
    /// The message header.
    pub header: MessageHeader,
    /// The message body (protobuf or raw bytes).
    pub body: Bytes,
}

impl SteamMessage {
    /// Create a new protobuf message.
    pub fn new_proto<T: Message>(msg: EMsg, header: ProtobufMessageHeader, body: &T) -> Self {
        Self { msg, is_proto: true, header: MessageHeader::Protobuf(header), body: Bytes::from(body.encode_to_vec()) }
    }

    /// Encode the message to bytes for sending.
    pub fn encode(&self) -> Vec<u8> {
        let mut buf = BytesMut::new();

        // Write EMsg (with proto flag if needed)
        let msg_id = if self.is_proto { self.msg.proto_id() } else { self.msg.raw_id() };
        buf.put_u32_le(msg_id);

        // Write header
        match &self.header {
            MessageHeader::Protobuf(h) => {
                h.encode(&mut buf);
            }
            MessageHeader::Extended(h) => {
                h.encode(&mut buf);
            }
            MessageHeader::Minimal(h) => {
                h.encode(&mut buf);
            }
        }

        // Write body
        buf.extend_from_slice(&self.body);

        buf.to_vec()
    }

    /// Decode a message from bytes.
    pub fn decode_from_bytes(data: &[u8]) -> Result<Self, SteamError> {
        if data.len() < 4 {
            return Err(SteamError::ProtocolError("Message too short".into()));
        }

        let mut buf = data;

        // Read EMsg
        let raw_msg = buf.get_u32_le();
        let is_proto = (raw_msg & EMsg::PROTO_MASK) != 0;
        let msg = EMsg::from_i32((raw_msg & !EMsg::PROTO_MASK) as i32).unwrap_or(EMsg::Invalid);

        // Read header
        let header = if matches!(msg, EMsg::ChannelEncryptRequest | EMsg::ChannelEncryptResponse | EMsg::ChannelEncryptResult) {
            // Minimal header for encryption messages
            MessageHeader::Minimal(crate::protocol::header::MinimalMessageHeader::decode(&mut buf)?)
        } else if is_proto {
            MessageHeader::Protobuf(ProtobufMessageHeader::decode(&mut buf)?)
        } else {
            MessageHeader::Extended(ExtendedMessageHeader::decode(&mut buf)?)
        };

        // Remaining bytes are the body
        let body = Bytes::copy_from_slice(buf);

        Ok(Self { msg, is_proto, header, body })
    }

    /// Decode the body as a protobuf message.
    pub fn decode_body<T: Message + Default>(&self) -> Result<T, SteamError> {
        T::decode(&self.body[..]).map_err(|e| SteamError::ProtocolError(format!("Failed to decode protobuf: {}", e)))
    }
}
