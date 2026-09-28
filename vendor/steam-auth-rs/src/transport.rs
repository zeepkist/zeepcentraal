//! Transport implementations for Steam API communication.
//!
//! This module provides transport abstractions for communicating with Steam's
//! services. Two built-in transports are available:
//!
//! - [`WebApiTransport`]: HTTP-based transport using `api.steampowered.com`
//! - [`WebSocketCMTransport`]: WebSocket transport for direct CM server
//!   communication
//!
//! # Custom Transports
//!
//! The [`Transport`] enum is currently closed (not extensible) to provide a
//! simpler API. If you need custom transport behavior, you can:
//!
//! 1. Use [`WebApiTransport::with_client`] to provide a custom
//!    `reqwest::Client` with custom configuration (timeouts, proxies, etc.)
//! 2. Use [`WebSocketCMTransport::with_options`] to provide a custom CM server
//!    provider
//!
//! For more advanced customization, consider wrapping the existing transports
//! or contributing a new transport variant to the crate.

pub mod web_api;
pub mod websocket_cm;

use std::collections::HashMap;

pub use web_api::WebApiTransport;
pub use websocket_cm::WebSocketCMTransport;

use crate::error::SessionError;

/// Request to send to Steam API.
#[derive(Debug, Clone)]
pub struct ApiRequest {
    /// API interface (e.g., "Authentication").
    pub api_interface: String,
    /// API method (e.g., "GetPasswordRSAPublicKey").
    pub api_method: String,
    /// API version.
    pub api_version: u32,
    /// Access token for authenticated requests.
    pub access_token: Option<String>,
    /// Protobuf-encoded request data.
    pub request_data: Option<Vec<u8>>,
    /// HTTP headers.
    pub headers: HashMap<String, String>,
}

/// Response from Steam API.
#[derive(Debug, Clone)]
pub struct ApiResponse {
    /// EResult code.
    pub result: Option<i32>,
    /// Error message from Steam.
    pub error_message: Option<String>,
    /// Protobuf-encoded response data.
    pub response_data: Option<Vec<u8>>,
}

/// Transport type for communicating with Steam.
#[derive(Debug, Clone)]
pub enum Transport {
    /// Web API transport (HTTPS).
    WebApi(WebApiTransport),
    /// WebSocket CM transport.
    WebSocketCM(WebSocketCMTransport),
}

impl Transport {
    /// Send a request and receive a response.
    pub async fn send_request(&self, request: ApiRequest) -> Result<ApiResponse, SessionError> {
        match self {
            Transport::WebApi(t) => t.send_request(request).await,
            Transport::WebSocketCM(t) => t.send_request(request).await,
        }
    }
}
