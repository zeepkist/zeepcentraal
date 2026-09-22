//! WebSocket connection to Steam CM servers.

use async_trait::async_trait;
use bytes::Bytes;
use futures::{SinkExt, StreamExt};
/// Steam CM server information.
pub use steam_cm_provider::CmServer;
use tokio::net::TcpStream;
use tokio_tungstenite::{connect_async, tungstenite::Message, MaybeTlsStream, WebSocketStream};
use tracing::{debug, error, info};

use super::traits::SteamConnection;
use crate::error::SteamError;

/// WebSocket connection to a Steam CM server.
pub struct WebSocketConnection {
    stream: WebSocketStream<MaybeTlsStream<TcpStream>>,
    #[allow(dead_code)]
    server: CmServer,
}

impl WebSocketConnection {
    /// Connect to a Steam CM server.
    pub async fn connect(server: CmServer) -> Result<Self, SteamError> {
        let url = format!("wss://{}/cmsocket/", server.endpoint);
        info!("Connecting to Steam CM: {}", url);

        let (stream, _response) = tokio::time::timeout(std::time::Duration::from_secs(30), connect_async(&url)).await.map_err(|_| SteamError::ConnectionError("Connection timed out".to_string()))?.map_err(|e| SteamError::ConnectionError(e.to_string()))?;

        debug!("WebSocket connection established to {}", server.endpoint);

        Ok(Self { stream, server })
    }
}

#[async_trait]
impl SteamConnection for WebSocketConnection {
    async fn send(&mut self, data: Vec<u8>) -> Result<(), SteamError> {
        self.stream.send(Message::Binary(data)).await.map_err(|e| SteamError::ConnectionError(e.to_string()))
    }

    async fn recv(&mut self) -> Result<Option<Bytes>, SteamError> {
        loop {
            match tokio::time::timeout(std::time::Duration::from_secs(30), self.stream.next()).await {
                Ok(Some(Ok(Message::Binary(data)))) => return Ok(Some(Bytes::from(data))),
                Ok(Some(Ok(Message::Close(frame)))) => {
                    if let Some(frame) = frame {
                        debug!("WebSocket closed by server: code={}, reason={}", frame.code, frame.reason);
                    } else {
                        debug!("WebSocket closed by server");
                    }
                    return Ok(None);
                }
                Ok(Some(Ok(_))) => {
                    // Skip non-binary messages (Text, Ping, Pong) and continue reading
                    continue;
                }
                Ok(Some(Err(e))) => {
                    error!("WebSocket error: {}", e);
                    return Err(SteamError::ConnectionError(e.to_string()));
                }
                Ok(None) => return Ok(None),
                Err(_) => {
                    // Timeout occurred, send keepalive Ping
                    debug!("Sending WebSocket Ping");
                    self.stream.send(Message::Ping(vec![])).await.map_err(|e| SteamError::ConnectionError(e.to_string()))?;
                    continue;
                }
            }
        }
    }

    async fn close(mut self: Box<Self>) -> Result<(), SteamError> {
        self.stream.close(None).await.map_err(|e| SteamError::ConnectionError(e.to_string()))
    }

    fn server(&self) -> &CmServer {
        &self.server
    }

    fn set_session_key(&mut self, _key: Option<Vec<u8>>) {
        // WebSocket connections over WSS are already encrypted.
        // Steam does not use application-layer encryption for WebSocket
        // connections. This is a no-op.
    }
}
