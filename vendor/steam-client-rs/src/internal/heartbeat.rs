//! Heartbeat mechanism for Steam connection health.
//!
//! This module provides state tracking for periodic heartbeat sending.
//! The actual sending is handled by the SteamClient to avoid ownership issues.

use std::time::{Duration, Instant};

use steam_enums::EMsg;

use crate::protocol::{ProtobufMessageHeader, SteamMessage};

/// Heartbeat manager that tracks when to send heartbeats.
#[derive(Debug)]
pub struct HeartbeatManager {
    /// Interval between heartbeats.
    interval: Duration,
    /// Time of the last heartbeat.
    last_heartbeat: Instant,
    /// Whether heartbeat is enabled.
    enabled: bool,
}

impl HeartbeatManager {
    /// Create a new heartbeat manager.
    pub fn new(interval_secs: u64) -> Self {
        Self { interval: Duration::from_secs(interval_secs), last_heartbeat: Instant::now(), enabled: true }
    }

    /// Update the heartbeat interval.
    pub fn set_interval(&mut self, interval_secs: u64) {
        self.interval = Duration::from_secs(interval_secs);
    }

    /// Check if a heartbeat should be sent.
    pub fn should_send_heartbeat(&self, current_time: Instant) -> bool {
        if !self.enabled {
            return false;
        }
        current_time.duration_since(self.last_heartbeat) >= self.interval
    }

    /// Get time remaining until next heartbeat.
    pub fn time_until_next_heartbeat(&self, current_time: Instant) -> Option<Duration> {
        if !self.enabled {
            return None;
        }

        let elapsed = current_time.duration_since(self.last_heartbeat);
        if elapsed >= self.interval {
            Some(Duration::ZERO)
        } else {
            Some(self.interval - elapsed)
        }
    }

    /// Record that a heartbeat was sent.
    pub fn record_heartbeat(&mut self, current_time: Instant) {
        self.last_heartbeat = current_time;
    }

    /// Reset the heartbeat timer.
    pub fn reset(&mut self) {
        self.last_heartbeat = Instant::now();
    }

    /// Build a heartbeat message.
    pub fn build_heartbeat_message(session_id: i32, steam_id: u64) -> SteamMessage {
        let header = ProtobufMessageHeader {
            header_length: 0,
            session_id,
            steam_id,
            job_id_source: u64::MAX,
            job_id_target: u64::MAX,
            target_job_name: None,
            routing_appid: None,
        };

        let heartbeat = steam_protos::CMsgClientHeartBeat::default();
        SteamMessage::new_proto(EMsg::ClientHeartBeat, header, &heartbeat)
    }
}

impl Default for HeartbeatManager {
    fn default() -> Self {
        Self::new(30)
    }
}

#[cfg(test)]
mod tests {

    use super::*;
    use crate::protocol::MessageHeader;

    #[test]
    fn test_build_heartbeat_message() {
        let session_id = 12345;
        let steam_id = 76561198000000000u64;

        let msg = HeartbeatManager::build_heartbeat_message(session_id, steam_id);

        // Verify the message type
        assert_eq!(msg.msg, EMsg::ClientHeartBeat);
        assert!(msg.is_proto);

        // Verify header fields
        match &msg.header {
            MessageHeader::Protobuf(header) => {
                assert_eq!(header.session_id, session_id);
                assert_eq!(header.steam_id, steam_id);
            }
            _ => {
                panic!("Expected protobuf header, got non-protobuf header");
            }
        }
    }

    #[test]
    fn test_heartbeat_timing() {
        let mut manager = HeartbeatManager::new(1); // 1 second interval
        let start = Instant::now();

        // Initially false (just started)
        assert!(!manager.should_send_heartbeat(start));

        // After 1.1 seconds, should be true
        let later = start + Duration::from_millis(1100);
        assert!(manager.should_send_heartbeat(later));

        // After recording, should be false
        manager.record_heartbeat(later);
        assert!(!manager.should_send_heartbeat(later));

        // But true again after another second
        let even_later = later + Duration::from_millis(1100);
        assert!(manager.should_send_heartbeat(even_later));
    }
}
