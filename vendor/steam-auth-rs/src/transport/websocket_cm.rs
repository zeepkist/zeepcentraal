//! WebSocket CM transport for SteamClient platform authentication.
//!
//! This transport connects to Steam's Connection Manager (CM) servers via
//! WebSocket and is required for authenticating with the SteamClient platform
//! type.

use std::{
    collections::HashMap,
    io::Read,
    sync::{
        atomic::{AtomicI32, Ordering},
        Arc,
    },
};

use flate2::read::GzDecoder;
use futures_util::{SinkExt, StreamExt};
use prost::Message;
use steam_cm_provider::{CmServerProvider, HttpCmServerProvider};
use steam_protos::{CMsgClientHello, CMsgClientServiceMethodLegacy, CMsgClientServiceMethodLegacyResponse, CMsgMulti, CMsgProtoBufHeader};
use tokio::sync::{oneshot, Mutex};
use tokio_tungstenite::{connect_async, tungstenite::Message as WsMessage};

use crate::{
    error::SessionError,
    transport::{ApiRequest, ApiResponse},
};

/// Steam message IDs (EMsg)
mod emsg {
    pub const MULTI: u32 = 1;
    pub const SERVICE_METHOD: u32 = 146;
    pub const SERVICE_METHOD_RESPONSE: u32 = 147;
    pub const CLIENT_HELLO: u32 = 4006;
}

struct MsgHdrProtoBuf {
    pub msg: u32,
    pub proto: CMsgProtoBufHeader,
}

impl MsgHdrProtoBuf {
    fn encode(&self) -> Vec<u8> {
        let proto_bytes = self.proto.encode_to_vec();
        let mut result = Vec::new();

        // EMsg with protobuf flag
        result.extend_from_slice(&(self.msg | 0x80000000).to_le_bytes());
        // Header length
        result.extend_from_slice(&(proto_bytes.len() as u32).to_le_bytes());
        // Proto header
        result.extend_from_slice(&proto_bytes);

        result
    }

    fn decode(data: &[u8]) -> Result<(Self, usize), SessionError> {
        if data.len() < 8 {
            return Err(SessionError::ProtocolError("Header too short".into()));
        }

        let msg = u32::from_le_bytes([data[0], data[1], data[2], data[3]]) & 0x7FFFFFFF;
        let header_length = u32::from_le_bytes([data[4], data[5], data[6], data[7]]) as usize;

        if data.len() < 8 + header_length {
            return Err(SessionError::ProtocolError("Header incomplete".into()));
        }

        let proto = CMsgProtoBufHeader::decode(&data[8..8 + header_length])?;

        Ok((Self { msg, proto }, 8 + header_length))
    }
}

/// Internal connection state.
struct ConnectionState {
    session_id: AtomicI32,
    job_id_counter: AtomicI32,
    pending_jobs: Mutex<HashMap<u64, oneshot::Sender<ApiResponse>>>,
}

/// WebSocket CM transport for SteamClient authentication.
#[allow(clippy::type_complexity)]
pub struct WebSocketCMTransport {
    ws_sender: Arc<Mutex<Option<futures_util::stream::SplitSink<tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>, WsMessage>>>>,
    state: Arc<ConnectionState>,
    connected: Arc<Mutex<bool>>,
    cm_provider: Arc<dyn CmServerProvider>,
}

impl std::fmt::Debug for WebSocketCMTransport {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("WebSocketCMTransport").field("connected", &self.connected).finish()
    }
}

impl Clone for WebSocketCMTransport {
    fn clone(&self) -> Self {
        Self {
            ws_sender: Arc::clone(&self.ws_sender),
            state: Arc::clone(&self.state),
            connected: Arc::clone(&self.connected),
            cm_provider: Arc::clone(&self.cm_provider),
        }
    }
}

impl WebSocketCMTransport {
    /// Create a new WebSocket CM transport and connect to Steam.
    pub async fn new() -> Result<Self, SessionError> {
        Self::with_options(None).await
    }

    /// Create a new WebSocket CM transport with optional provider
    /// configuration.
    pub async fn with_options(cm_provider: Option<Arc<dyn CmServerProvider>>) -> Result<Self, SessionError> {
        let cm_provider = cm_provider.unwrap_or_else(|| Arc::new(HttpCmServerProvider::new_default()));

        let transport = Self {
            ws_sender: Arc::new(Mutex::new(None)),
            state: Arc::new(ConnectionState { session_id: AtomicI32::new(0), job_id_counter: AtomicI32::new(0), pending_jobs: Mutex::new(HashMap::new()) }),
            connected: Arc::new(Mutex::new(false)),
            cm_provider,
        };

        transport.connect().await?;

        Ok(transport)
    }

    /// Connect to a Steam CM server.
    async fn connect(&self) -> Result<(), SessionError> {
        // Get CM server
        let server = self.cm_provider.get_server().await.map_err(|e| SessionError::NetworkError(format!("Failed to get CM server: {}", e)))?;

        let url = format!("wss://{}/cmsocket/", server.endpoint);

        tracing::debug!("Connecting to CM server: {}", url);

        let (ws_stream, _) = connect_async(&url).await?;

        let (write, mut read) = ws_stream.split();

        *self.ws_sender.lock().await = Some(write);

        // Send hello message
        self.send_hello().await?;

        // Spawn message receiver
        let state = self.state.clone();
        let connected = self.connected.clone();

        tokio::spawn(async move {
            while let Some(msg) = read.next().await {
                match msg {
                    Ok(WsMessage::Binary(data)) => {
                        if let Err(e) = Self::handle_message(&state, &data, 0).await {
                            tracing::error!("Error handling message: {}", e);
                        }
                    }
                    Ok(WsMessage::Close(_)) => {
                        *connected.lock().await = false;
                        break;
                    }
                    Err(e) => {
                        tracing::error!("WebSocket error: {}", e);
                        *connected.lock().await = false;
                        break;
                    }
                    _ => {}
                }
            }
        });

        *self.connected.lock().await = true;

        Ok(())
    }

    /// Send the client hello message.
    async fn send_hello(&self) -> Result<(), SessionError> {
        let header = MsgHdrProtoBuf { msg: emsg::CLIENT_HELLO, proto: CMsgProtoBufHeader { client_sessionid: Some(0), ..Default::default() } };

        let body = CMsgClientHello { protocol_version: Some(65580) };

        let mut data = header.encode();
        data.extend_from_slice(&body.encode_to_vec());

        self.send_raw(&data).await
    }

    /// Send raw data over WebSocket.
    async fn send_raw(&self, data: &[u8]) -> Result<(), SessionError> {
        let mut sender = self.ws_sender.lock().await;
        if let Some(ref mut ws) = *sender {
            ws.send(WsMessage::Binary(data.to_vec())).await?;
        } else {
            return Err(SessionError::ProtocolError("Not connected".into()));
        }
        Ok(())
    }

    /// Handle an incoming message.
    async fn handle_message(state: &ConnectionState, data: &[u8], depth: usize) -> Result<(), SessionError> {
        if depth > 5 {
            return Err(SessionError::ProtocolError("Message recursion depth exceeded".into()));
        }

        let (header, body_offset) = MsgHdrProtoBuf::decode(data)?;

        match header.msg {
            emsg::MULTI => {
                // Handle CMsgMulti - decompress and process nested messages
                let body = &data[body_offset..];
                let multi = CMsgMulti::decode(body)?;

                if let Some(message_body) = multi.message_body {
                    let decompressed = if multi.size_unzipped.is_some() {
                        // Decompress gzip
                        let mut decoder = GzDecoder::new(message_body.as_slice());
                        let mut result = Vec::new();
                        decoder.read_to_end(&mut result).map_err(|e| SessionError::ProtocolError(format!("Gzip decompression failed: {}", e)))?;
                        result
                    } else {
                        message_body
                    };

                    // Process nested messages
                    let mut offset = 0;
                    while offset < decompressed.len() {
                        if offset + 4 > decompressed.len() {
                            break;
                        }
                        let size = u32::from_le_bytes([decompressed[offset], decompressed[offset + 1], decompressed[offset + 2], decompressed[offset + 3]]) as usize;
                        offset += 4;

                        if offset + size > decompressed.len() {
                            break;
                        }

                        let nested = &decompressed[offset..offset + size];
                        Box::pin(Self::handle_message(state, nested, depth + 1)).await?;
                        offset += size;
                    }
                }
            }
            emsg::SERVICE_METHOD_RESPONSE => {
                let body = &data[body_offset..];
                let response = CMsgClientServiceMethodLegacyResponse::decode(body)?;

                if let Some(job_id) = header.proto.jobid_target {
                    let mut pending = state.pending_jobs.lock().await;
                    if let Some(sender) = pending.remove(&job_id) {
                        let api_response = ApiResponse {
                            result: header.proto.eresult,
                            error_message: header.proto.error_message,
                            response_data: response.serialized_method_response,
                        };
                        let _ = sender.send(api_response);
                    }
                }
            }
            _ => {
                tracing::trace!("Unhandled message type: {}", header.msg);
            }
        }

        Ok(())
    }

    /// Send a service method call.
    async fn send_service_method(&self, method_name: &str, body: &[u8], access_token: Option<&str>) -> Result<ApiResponse, SessionError> {
        let job_id = self.state.job_id_counter.fetch_add(1, Ordering::SeqCst) as u64 + 1;
        let session_id = self.state.session_id.load(Ordering::SeqCst);

        // Create header
        let header_proto = CMsgProtoBufHeader {
            client_sessionid: Some(session_id),
            jobid_source: Some(job_id),
            target_job_name: Some(method_name.to_string()),
            realm: Some(1),
            ..Default::default()
        };

        // Add auth token if provided
        if let Some(_token) = access_token {
            // Note: For WebSocket transport, tokens are typically set
            // differently This is a simplified implementation
        }

        let header = MsgHdrProtoBuf { msg: emsg::SERVICE_METHOD, proto: header_proto };

        let service_method = CMsgClientServiceMethodLegacy {
            method_name: Some(method_name.to_string()),
            serialized_method: Some(body.to_vec()),
            is_notification: Some(false),
        };

        let mut data = header.encode();
        data.extend_from_slice(&service_method.encode_to_vec());

        // Create response channel
        let (tx, rx) = oneshot::channel();
        {
            let mut pending = self.state.pending_jobs.lock().await;
            pending.insert(job_id, tx);
        }

        // Send request
        self.send_raw(&data).await?;

        // Wait for response with timeout
        let response = tokio::time::timeout(std::time::Duration::from_secs(30), rx).await.map_err(|_| SessionError::Timeout)?.map_err(|_| SessionError::ProtocolError("Response channel closed".into()))?;

        Ok(response)
    }
}

impl WebSocketCMTransport {
    /// Send a request and receive a response.
    pub async fn send_request(&self, request: ApiRequest) -> Result<ApiResponse, SessionError> {
        let method_name = format!("I{}Service.{}/v{}", request.api_interface, request.api_method, request.api_version);

        let body = request.request_data.unwrap_or_default();

        self.send_service_method(&method_name, &body, request.access_token.as_deref()).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_msg_hdr_encode_decode() {
        let header = MsgHdrProtoBuf {
            msg: emsg::SERVICE_METHOD,
            proto: CMsgProtoBufHeader { client_sessionid: Some(12345), jobid_source: Some(1), ..Default::default() },
        };

        let encoded = header.encode();
        let (decoded, _) = MsgHdrProtoBuf::decode(&encoded).unwrap();

        assert_eq!(decoded.msg, emsg::SERVICE_METHOD);
        assert_eq!(decoded.proto.client_sessionid, Some(12345));
        assert_eq!(decoded.proto.jobid_source, Some(1));
    }
}
