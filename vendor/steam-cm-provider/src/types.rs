use std::time::Duration;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Errors that can occur when providing CM servers.
#[derive(Debug, Error)]
pub enum CmError {
    #[error("Network error: {0}")]
    Network(String),
    #[error("Steam API error (status {0}): {1}")]
    ApiError(u16, String),
    #[error("Protocol error: {0}")]
    Protocol(String),
    #[error("Invalid response from Steam API: {0}")]
    InvalidResponse(String),
    #[error("Connection error: {0}")]
    Connection(String),
    #[error("Cache error: {0}")]
    CacheError(String),
    #[error("Timeout")]
    Timeout,
    #[error("No servers available")]
    NoServers,
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("{0}")]
    Other(String),
}

/// Steam CM server information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CmServer {
    pub endpoint: String,
    #[serde(default)]
    pub legacy_endpoint: String,
    #[serde(rename = "type")]
    pub server_type: String,
    #[serde(default)]
    pub dc: String,
    pub realm: String,
    #[serde(rename = "wtd_load")]
    pub load: f64,
}

/// Trait for providing Steam CM server endpoints.
#[async_trait]
pub trait CmServerProvider: Send + Sync {
    /// Get a CM server to connect to.
    async fn get_server(&self) -> Result<CmServer, CmError>;
}

/// HTTP response from a request.
#[derive(Debug, Clone)]
pub struct HttpResponse {
    pub status: u16,
    pub body: Vec<u8>,
}

impl HttpResponse {
    pub fn is_success(&self) -> bool {
        (200..300).contains(&self.status)
    }

    pub fn json<T: serde::de::DeserializeOwned>(&self) -> Result<T, CmError> {
        serde_json::from_slice(&self.body).map_err(|e| CmError::Protocol(format!("Failed to parse JSON: {}", e)))
    }
}

/// HTTP client trait for making web requests.
#[async_trait]
pub trait HttpClient: Send + Sync {
    async fn get_with_query(&self, url: &str, query: &[(&str, &str)]) -> Result<HttpResponse, CmError>;
}

/// Random number generator trait.
pub trait CmRng: Send + Sync {
    fn gen_u32(&self) -> u32;
    fn gen_usize(&self, max: usize) -> usize;
}

/// Trait for checking server connectivity.
#[async_trait]
pub trait ConnectivityChecker: Send + Sync {
    async fn check_connection(&self, url: &str, timeout: Duration) -> Option<u128>;
}

/// Internal API response structures for Steam Directory service.
#[doc(hidden)]
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse {
    pub response: ApiInternalResponse,
}

#[doc(hidden)]
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiInternalResponse {
    pub serverlist: Vec<CmServer>,
}

/// Cached CM server list with timestamp.
#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct CachedServerList {
    pub servers: Vec<CmServer>,
    pub fetched_at: std::time::SystemTime,
}

/// Cache TTL for CM server list (Smart Server Refresh threshold: 7 days).
pub(crate) const CACHE_TTL: Duration = Duration::from_secs(7 * 24 * 60 * 60);
