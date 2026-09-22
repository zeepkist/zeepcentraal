//! TCP connection to Steam CM servers.
//!
//! This module implements the raw TCP connection protocol used by Steam
//! clients. TCP connections require an encryption handshake before any messages
//! can be exchanged.

#![allow(dead_code)]

use std::io::{self, ErrorKind};

use byteorder::{LittleEndian, ReadBytesExt, WriteBytesExt};
use bytes::{Buf, Bytes, BytesMut};
use steam_crypto::{calculate_key_crc, decrypt_with_hmac_iv, encrypt_with_hmac_iv, generate_session_key, SessionKey};
use steam_enums::{EMsg, EResult};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpStream,
    time::{timeout, Duration},
};
use tracing::{debug, error, info};

use crate::{connection::CmServer, error::SteamError};

/// Magic bytes for the VT01 wire protocol.
const VT01_MAGIC: &[u8; 4] = b"VT01";

/// Default TCP connection timeout.
const CONNECTION_TIMEOUT_SECS: u64 = 10;
/// Timeout for waiting for the encryption handshake to complete.
const HANDSHAKE_TIMEOUT_SECS: u64 = 5;

/// TCP connection to a Steam CM server.
pub struct TcpConnection {
    stream: TcpStream,
    server: CmServer,
    session_key: Option<SessionKey>,
    /// Buffer for incomplete messages.
    read_buffer: BytesMut,
    /// Expected message length (if we're in the middle of reading).
    expected_length: Option<u32>,
}

impl TcpConnection {
    /// Connect to a Steam CM server via TCP.
    ///
    /// This establishes the TCP connection but does NOT perform the encryption
    /// handshake. Call [`wait_for_encrypt_request`] followed by
    /// [`complete_handshake`] to set up encryption before sending any
    /// messages.
    pub async fn connect(server: CmServer) -> Result<Self, SteamError> {
        // Parse endpoint (host:port)
        let endpoint = &server.endpoint;
        info!("Connecting to TCP CM: {}", endpoint);

        let stream = timeout(Duration::from_secs(CONNECTION_TIMEOUT_SECS), TcpStream::connect(endpoint)).await.map_err(|_| SteamError::Timeout)?.map_err(|e| SteamError::ConnectionError(format!("TCP connect failed: {}", e)))?;

        debug!("TCP connection established to {}", endpoint);

        Ok(Self { stream, server, session_key: None, read_buffer: BytesMut::with_capacity(8192), expected_length: None })
    }

    /// Wait for the ChannelEncryptRequest from the server.
    ///
    /// Returns the protocol version, universe, and nonce from the request.
    pub async fn wait_for_encrypt_request(&mut self) -> Result<(u32, u32, [u8; 16]), SteamError> {
        debug!("Waiting for ChannelEncryptRequest...");

        // Read the raw message
        let msg = timeout(Duration::from_secs(HANDSHAKE_TIMEOUT_SECS), self.recv_raw()).await.map_err(|_| SteamError::Timeout)??.ok_or_else(|| SteamError::ConnectionError("Connection closed".into()))?;

        // Parse minimal header for ChannelEncryptRequest
        // Header format: EMsg (4 bytes) + targetJobID (8 bytes) + sourceJobID (8 bytes)
        if msg.len() < 20 + 16 + 8 {
            return Err(SteamError::ProtocolError("ChannelEncryptRequest too short".into()));
        }

        let mut cursor = std::io::Cursor::new(&msg);
        let raw_emsg = ReadBytesExt::read_u32::<LittleEndian>(&mut cursor).map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e.to_string()))?;
        let emsg = EMsg::from_i32((raw_emsg & !0x80000000) as i32).unwrap_or(EMsg::Invalid);

        if emsg != EMsg::ChannelEncryptRequest {
            return Err(SteamError::ProtocolError(format!("Expected ChannelEncryptRequest, got {:?}", emsg)));
        }

        // Skip job IDs (8 + 8 bytes)
        cursor.set_position(20);

        // Read protocol, universe, nonce
        let protocol = ReadBytesExt::read_u32::<LittleEndian>(&mut cursor).map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e.to_string()))?;
        let universe = ReadBytesExt::read_u32::<LittleEndian>(&mut cursor).map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e.to_string()))?;

        let mut nonce = [0u8; 16];
        std::io::Read::read_exact(&mut cursor, &mut nonce).map_err(|e| SteamError::ProtocolError(format!("Failed to read nonce: {}", e)))?;

        debug!("ChannelEncryptRequest: protocol={}, universe={}, nonce={}", protocol, universe, hex::encode(nonce));

        Ok((protocol, universe, nonce))
    }

    /// Complete the encryption handshake.
    ///
    /// Generates a session key, sends ChannelEncryptResponse, and waits for
    /// ChannelEncryptResult. After this succeeds, all messages will be
    /// encrypted.
    pub async fn complete_handshake(&mut self, protocol: u32, nonce: &[u8; 16]) -> Result<(), SteamError> {
        // Generate session key and encrypt it on a blocking thread (RSA-OAEP is CPU-bound, ~100us+).
        let nonce_owned: [u8; 16] = *nonce;
        let key_pair = tokio::task::spawn_blocking(move || generate_session_key(&nonce_owned))
            .await
            .map_err(|e| SteamError::ProtocolError(format!("Key generation task join failed: {}", e)))?
            .map_err(|e| SteamError::ProtocolError(format!("Key generation failed: {}", e)))?;

        let crc = calculate_key_crc(&key_pair.encrypted);

        debug!("Generated session key, encrypted length={}, crc=0x{:08x}", key_pair.encrypted.len(), crc);

        // Build ChannelEncryptResponse
        // Header: EMsg (4) + targetJobID (8) + sourceJobID (8) = 20 bytes
        // Body: protocol (4) + key_size (4) + encrypted_key + crc (4) + padding (4)
        let body_len = 4 + 4 + key_pair.encrypted.len() + 4 + 4;
        let mut response = Vec::with_capacity(20 + body_len);

        // Write header
        WriteBytesExt::write_u32::<LittleEndian>(&mut response, EMsg::ChannelEncryptResponse as u32)?;
        WriteBytesExt::write_u64::<LittleEndian>(&mut response, u64::MAX)?; // targetJobID = JOBID_NONE
        WriteBytesExt::write_u64::<LittleEndian>(&mut response, u64::MAX)?; // sourceJobID = JOBID_NONE

        // Write body
        WriteBytesExt::write_u32::<LittleEndian>(&mut response, protocol)?;
        WriteBytesExt::write_u32::<LittleEndian>(&mut response, key_pair.encrypted.len() as u32)?;
        response.extend_from_slice(&key_pair.encrypted);
        WriteBytesExt::write_u32::<LittleEndian>(&mut response, crc)?;
        WriteBytesExt::write_u32::<LittleEndian>(&mut response, 0)?; // padding

        // Send response (unencrypted, with VT01 framing)
        self.send_raw(&response).await?;

        // Wait for ChannelEncryptResult
        let result_msg = timeout(Duration::from_secs(HANDSHAKE_TIMEOUT_SECS), self.recv_raw()).await.map_err(|_| SteamError::Timeout)??.ok_or_else(|| SteamError::ConnectionError("Connection closed".into()))?;

        // Parse ChannelEncryptResult
        if result_msg.len() < 24 {
            return Err(SteamError::ProtocolError("ChannelEncryptResult too short".into()));
        }

        let mut cursor = std::io::Cursor::new(&result_msg);
        let raw_emsg = ReadBytesExt::read_u32::<LittleEndian>(&mut cursor).map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e.to_string()))?;
        let emsg = EMsg::from_i32((raw_emsg & !0x80000000) as i32).unwrap_or(EMsg::Invalid);

        if emsg != EMsg::ChannelEncryptResult {
            return Err(SteamError::ProtocolError(format!("Expected ChannelEncryptResult, got {:?}", emsg)));
        }

        // Skip job IDs
        cursor.set_position(20);

        let eresult = EResult::from_i32(ReadBytesExt::read_u32::<LittleEndian>(&mut cursor).map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e.to_string()))? as i32).unwrap_or(EResult::Fail);
        if eresult != EResult::OK {
            return Err(SteamError::ProtocolError(format!("ChannelEncryptResult failed with eresult={:?}", eresult)));
        }

        // Encryption is now active
        self.session_key = Some(key_pair.plain);
        info!("Encryption handshake completed successfully");

        Ok(())
    }

    /// Send a binary message.
    ///
    /// If encryption is active, the message will be encrypted on a blocking
    /// thread before sending so AES work doesn't stall the async runtime.
    pub async fn send(&mut self, data: Vec<u8>) -> Result<(), SteamError> {
        let to_send = if let Some(key) = self.session_key.clone() {
            tokio::task::spawn_blocking(move || encrypt_with_hmac_iv(&key, &data))
                .await
                .map_err(|e| SteamError::ProtocolError(format!("Encryption task join failed: {}", e)))?
                .map_err(|e| SteamError::ProtocolError(format!("Encryption failed: {}", e)))?
        } else {
            data
        };

        self.send_raw(&to_send).await
    }

    /// Send raw bytes with VT01 framing (no encryption).
    async fn send_raw(&mut self, data: &[u8]) -> Result<(), SteamError> {
        // VT01 format: length (4 LE) + "VT01" + payload
        let mut frame = Vec::with_capacity(8 + data.len());
        WriteBytesExt::write_u32::<LittleEndian>(&mut frame, data.len() as u32)?;
        frame.extend_from_slice(VT01_MAGIC);
        frame.extend_from_slice(data);

        timeout(Duration::from_secs(30), self.stream.write_all(&frame))
            .await
            .map_err(|_| SteamError::NetworkError(std::io::Error::from(std::io::ErrorKind::TimedOut)))?
            .map_err(|e| SteamError::ConnectionError(format!("Write failed: {}", e)))?;

        Ok(())
    }

    /// Receive a message.
    ///
    /// If encryption is active, the message will be decrypted.
    pub async fn recv(&mut self) -> Result<Option<Bytes>, SteamError> {
        let raw = match self.recv_raw().await {
            Ok(Some(data)) => data,
            Ok(None) => return Ok(None),
            Err(e) => return Err(e),
        };

        if let Some(key) = self.session_key.clone() {
            let raw_vec = raw.to_vec();
            let decrypted = tokio::task::spawn_blocking(move || decrypt_with_hmac_iv(&key, &raw_vec))
                .await
                .map_err(|e| SteamError::ProtocolError(format!("Decryption task join failed: {}", e)))?
                .map_err(|e| SteamError::ProtocolError(format!("Decryption failed: {}", e)))?;
            Ok(Some(Bytes::from(decrypted)))
        } else {
            Ok(Some(raw))
        }
    }

    /// Receive raw bytes with VT01 framing (no decryption).
    async fn recv_raw(&mut self) -> Result<Option<Bytes>, SteamError> {
        loop {
            // If we already know the expected length, try to read the message
            if let Some(expected) = self.expected_length {
                if self.read_buffer.len() >= expected as usize {
                    let msg = self.read_buffer.split_to(expected as usize).freeze();
                    self.expected_length = None;
                    return Ok(Some(msg));
                }
            } else if self.read_buffer.len() >= 8 {
                // Try to read the header
                // We peek at the header first without consuming it yet
                let mut header = &self.read_buffer[..8];
                let length = byteorder::ReadBytesExt::read_u32::<LittleEndian>(&mut header).map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e.to_string()))?;
                let magic = &self.read_buffer[4..8];

                if magic != VT01_MAGIC {
                    return Err(SteamError::ProtocolError("Invalid VT01 magic".into()));
                }

                // Remove the header from buffer
                self.read_buffer.advance(8);
                self.expected_length = Some(length);

                // Check if we already have the full message
                if self.read_buffer.len() >= length as usize {
                    let msg = self.read_buffer.split_to(length as usize).freeze();
                    self.expected_length = None;
                    return Ok(Some(msg));
                }
            }

            // Need more data
            // Read directly into the buffer, avoiding intermediate stack allocation
            let read_result = timeout(Duration::from_secs(30), self.stream.read_buf(&mut self.read_buffer))
                .await
                .map_err(|_| SteamError::NetworkError(std::io::Error::from(std::io::ErrorKind::TimedOut)))?;
            match read_result {
                Ok(0) => {
                    // Connection closed
                    if self.read_buffer.is_empty() {
                        return Ok(None);
                    } else {
                        return Err(SteamError::ConnectionError("Connection closed mid-message".into()));
                    }
                }
                Ok(_) => {
                    // Data was read directly into read_buffer, loop to process
                    // it
                }
                Err(ref e) if e.kind() == ErrorKind::WouldBlock => {
                    continue;
                }
                Err(e) => {
                    error!("TCP read error: {}", e);
                    return Err(SteamError::ConnectionError(format!("Read failed: {}", e)));
                }
            }
        }
    }

    /// Close the connection.
    pub async fn close(mut self) -> Result<(), SteamError> {
        timeout(Duration::from_secs(10), self.stream.shutdown())
            .await
            .map_err(|_| SteamError::NetworkError(std::io::Error::from(std::io::ErrorKind::TimedOut)))?
            .map_err(|e| SteamError::ConnectionError(format!("Shutdown failed: {}", e)))
    }

    /// Get the connected server info.
    pub fn server(&self) -> &CmServer {
        &self.server
    }

    /// Check if encryption is active.
    pub fn is_encrypted(&self) -> bool {
        self.session_key.is_some()
    }
}

use async_trait::async_trait;

use super::traits::SteamConnection;

#[async_trait]
impl SteamConnection for TcpConnection {
    async fn send(&mut self, data: Vec<u8>) -> Result<(), SteamError> {
        TcpConnection::send(self, data).await
    }

    async fn recv(&mut self) -> Result<Option<Bytes>, SteamError> {
        TcpConnection::recv(self).await
    }

    async fn close(self: Box<Self>) -> Result<(), SteamError> {
        TcpConnection::close(*self).await
    }

    fn server(&self) -> &CmServer {
        TcpConnection::server(self)
    }

    fn set_session_key(&mut self, key: Option<Vec<u8>>) {
        self.session_key = key.and_then(|k| SessionKey::from_bytes(&k));
    }
}

impl From<io::Error> for SteamError {
    fn from(e: io::Error) -> Self {
        SteamError::ConnectionError(e.to_string())
    }
}
