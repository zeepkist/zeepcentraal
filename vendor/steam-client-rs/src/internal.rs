//! Internal infrastructure modules.
//!
//! This module contains internal machinery for connection management.

pub mod heartbeat;
pub mod jobs;
pub mod limiter;
pub mod messaging;
pub mod reconnect;

// Re-export public types
pub use heartbeat::HeartbeatManager;
pub use jobs::{JobManager, JobResponse};
pub use messaging::{MessageSender, MockMessageSender, SentMessage, SessionInfo};
pub use reconnect::{ReconnectManager, ReconnectState};
