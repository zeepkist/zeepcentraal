//! Connection handling for Steam client.
//!
//! This module provides connection implementations for communicating with Steam
//! CM servers. It supports both WebSocket (default) and TCP connections.

mod tcp;
mod traits;
mod websocket;

// Traits for dependency injection
// Default implementations
pub use steam_cm_provider::HttpCmServerProvider;
pub use traits::{CmServerProvider, SteamConnection};
pub use websocket::{CmServer, WebSocketConnection};
