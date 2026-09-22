//! Steam client options.

use std::time::Duration;
/// Connection protocol to use.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EConnectionProtocol {
    Auto,
    Tcp,
    WebSocket,
}

/// Options for the Steam client.
#[derive(Debug, Clone)]
pub struct SteamOptions {
    /// Connection protocol to use.
    pub protocol: EConnectionProtocol,

    /// Whether to automatically reconnect on disconnect.
    pub auto_relogin: bool,

    /// Whether to enable web compatibility mode (WebSocket only, port 443).
    pub web_compatibility_mode: bool,

    /// HTTP proxy URL.
    pub http_proxy: Option<String>,

    /// SOCKS proxy URL.
    pub socks_proxy: Option<String>,

    /// Whether to renew refresh tokens automatically.
    pub renew_refresh_tokens: bool,

    /// Machine name to report to Steam.
    pub machine_name: Option<String>,

    /// Language to use for Steam messages.
    pub language: String,

    /// Local address to bind to.
    pub local_address: Option<String>,

    /// Local port to bind to.
    pub local_port: Option<u16>,

    /// Additional headers to send with WebSocket handshake.
    pub additional_headers: std::collections::HashMap<String, String>,

    /// Whether to enable PICS cache.
    pub enable_pics_cache: bool,

    /// Whether to cache all PICS data.
    pub pics_cache_all: bool,

    /// Interval between changelist updates (in milliseconds).
    pub changelist_update_interval: u64,

    /// Whether to save app tickets.
    pub save_app_tickets: bool,

    /// Reconnection configuration.
    pub reconnect: ReconnectConfig,

    /// Heartbeat configuration.
    pub heartbeat: HeartbeatOptions,
}

/// Reconnection configuration.
#[derive(Debug, Clone)]
pub struct ReconnectConfig {
    /// Whether auto reconnection is enabled.
    pub enabled: bool,
    /// Maximum number of reconnection attempts.
    pub max_attempts: u32,
    /// Initial delay before first reconnection attempt.
    pub initial_delay: Duration,
    /// Maximum delay between reconnection attempts.
    pub max_delay: Duration,
    /// Delay multiplier for exponential backoff.
    pub backoff_multiplier: f64,
}

impl Default for ReconnectConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            max_attempts: 10,
            initial_delay: Duration::from_secs(2),
            max_delay: Duration::from_secs(60),
            backoff_multiplier: 2.0,
        }
    }
}

/// Heartbeat configuration options.
#[derive(Debug, Clone)]
pub struct HeartbeatOptions {
    /// Whether heartbeat is enabled.
    pub enabled: bool,
    /// Interval between heartbeats.
    pub interval: Duration,
}

impl Default for HeartbeatOptions {
    fn default() -> Self {
        Self { enabled: true, interval: Duration::from_secs(30) }
    }
}

impl Default for SteamOptions {
    fn default() -> Self {
        Self {
            protocol: EConnectionProtocol::Auto,
            auto_relogin: true,
            web_compatibility_mode: false,
            http_proxy: None,
            socks_proxy: None,
            renew_refresh_tokens: false,
            machine_name: None,
            language: "english".to_string(),
            local_address: None,
            local_port: None,
            additional_headers: std::collections::HashMap::new(),
            enable_pics_cache: false,
            pics_cache_all: false,
            changelist_update_interval: 60000,
            save_app_tickets: true,
            reconnect: ReconnectConfig::default(),
            heartbeat: HeartbeatOptions::default(),
        }
    }
}
