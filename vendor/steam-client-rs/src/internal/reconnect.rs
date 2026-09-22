//! Auto-reconnection support for Steam client.
//!
//! This module provides the `ReconnectManager` which handles automatic
//! reconnection to Steam servers with exponential backoff and CM server
//! blacklisting.

use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, Instant},
};

use steam_enums::EResult;
use tracing::debug;

use crate::{
    connection::CmServer,
    options::ReconnectConfig,
    utils::clock::{Clock, SystemClock},
};

/// Non-fatal disconnect reasons that should trigger auto-reconnection.
/// These match the behavior of node-steam-user (Fail, NoConnection,
/// ServiceUnavailable, TryAnotherCM).
const NON_FATAL_RESULTS: &[EResult] = &[EResult::Fail, EResult::NoConnection, EResult::ServiceUnavailable, EResult::TryAnotherCM];

/// State of the reconnection process.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReconnectState {
    /// Not attempting to reconnect.
    Idle,
    /// Waiting for backoff delay before next attempt.
    Backoff,
    /// Currently attempting to reconnect.
    Attempting,
    /// Reconnection permanently failed after max attempts.
    Failed,
}

/// Entry in the CM server blacklist.
#[derive(Debug, Clone)]
struct BlacklistEntry {
    /// When this entry was added.
    added_at: Instant,
    /// How long this entry is valid.
    ttl: Duration,
}

impl BlacklistEntry {
    fn is_expired(&self, now: Instant) -> bool {
        now.duration_since(self.added_at) >= self.ttl
    }
}

/// Manages automatic reconnection to Steam servers.
///
/// Tracks reconnection attempts, calculates exponential backoff delays,
/// and maintains a blacklist of CM servers that have failed recently.
#[derive(Debug)]
pub struct ReconnectManager {
    /// Configuration for reconnection behavior.
    config: ReconnectConfig,
    /// Current reconnection state.
    state: ReconnectState,
    /// Current attempt number (1-indexed during reconnection).
    attempt: u32,
    /// Current backoff delay.
    current_delay: Duration,
    /// When the next attempt should be made.
    next_attempt_at: Option<Instant>,
    /// Blacklisted CM servers (endpoint -> entry).
    blacklist: HashMap<String, BlacklistEntry>,
    /// Last disconnect reason.
    last_disconnect_reason: Option<EResult>,
    /// Clock for time operations.
    clock: Arc<dyn Clock>,
}

impl ReconnectManager {
    /// Create a new reconnect manager with the given configuration.
    pub fn new(config: ReconnectConfig) -> Self {
        Self::with_clock(config, Arc::new(SystemClock))
    }

    /// Create a new reconnect manager with a custom clock.
    ///
    /// This is primarily useful for testing, allowing mock clocks to be
    /// injected.
    pub fn with_clock(config: ReconnectConfig, clock: Arc<dyn Clock>) -> Self {
        Self {
            config,
            state: ReconnectState::Idle,
            attempt: 0,
            current_delay: Duration::ZERO,
            next_attempt_at: None,
            blacklist: HashMap::new(),
            last_disconnect_reason: None,
            clock,
        }
    }

    /// Get the current reconnection state.
    pub fn state(&self) -> ReconnectState {
        self.state
    }

    /// Get the current attempt number.
    pub fn attempt(&self) -> u32 {
        self.attempt
    }

    /// Get the maximum attempts configured.
    pub fn max_attempts(&self) -> u32 {
        self.config.max_attempts
    }

    /// Get the last disconnect reason.
    pub fn last_disconnect_reason(&self) -> Option<EResult> {
        self.last_disconnect_reason
    }

    /// Check if reconnection is enabled.
    pub fn is_enabled(&self) -> bool {
        self.config.enabled
    }

    /// Check if the given disconnect reason should trigger auto-reconnection.
    pub fn should_reconnect(&self, reason: EResult) -> bool {
        self.config.enabled && NON_FATAL_RESULTS.contains(&reason)
    }

    /// Start a new reconnection sequence.
    ///
    /// Call this when a disconnection occurs and reconnection should be
    /// attempted.
    pub fn start_reconnection(&mut self, reason: EResult) {
        debug!("Starting reconnection sequence, reason: {:?}", reason);
        self.last_disconnect_reason = Some(reason);
        self.attempt = 0;
        self.current_delay = self.config.initial_delay;
        self.state = ReconnectState::Backoff;
        self.schedule_next_attempt();
    }

    /// Schedule the next reconnection attempt.
    fn schedule_next_attempt(&mut self) {
        let delay = if self.attempt == 0 { self.config.initial_delay } else { self.current_delay };
        self.next_attempt_at = Some(self.clock.now() + delay);
        debug!("Scheduled next reconnect attempt in {:?}", delay);
    }

    /// Check if it's time to attempt reconnection.
    ///
    /// Returns `Some(attempt_number)` if an attempt should be made now,
    /// `None` if still waiting or reconnection is not in progress.
    pub fn check_ready(&mut self) -> Option<u32> {
        if self.state != ReconnectState::Backoff {
            return None;
        }

        if let Some(next_at) = self.next_attempt_at {
            if self.clock.now() >= next_at {
                self.attempt += 1;
                self.state = ReconnectState::Attempting;
                self.next_attempt_at = None;
                debug!("Reconnect attempt {} ready", self.attempt);
                return Some(self.attempt);
            }
        }

        None
    }

    /// Get the time until the next attempt, if waiting.
    pub fn time_until_next_attempt(&self) -> Option<Duration> {
        if self.state == ReconnectState::Backoff {
            self.next_attempt_at.map(|next_at| {
                let now = self.clock.now();
                if now >= next_at {
                    Duration::ZERO
                } else {
                    next_at - now
                }
            })
        } else {
            None
        }
    }

    /// Get the current backoff delay.
    pub fn current_delay(&self) -> Duration {
        self.current_delay
    }

    /// Record a successful connection.
    ///
    /// Resets the reconnection state and backoff delay.
    pub fn record_success(&mut self) {
        debug!("Connection successful, resetting reconnect state");
        self.state = ReconnectState::Idle;
        self.attempt = 0;
        self.current_delay = self.config.initial_delay;
        self.next_attempt_at = None;
        self.last_disconnect_reason = None;
    }

    /// Record a failed connection attempt.
    ///
    /// Increments the attempt counter and calculates the next backoff delay.
    /// Returns `true` if more attempts should be made, `false` if max attempts
    /// reached.
    pub fn record_failure(&mut self, server: Option<&CmServer>) -> bool {
        debug!("Connection attempt {} failed", self.attempt);

        // Blacklist the server if provided
        if let Some(server) = server {
            self.blacklist_server(&server.endpoint);
        }

        // Check if we've exceeded max attempts
        if self.attempt >= self.config.max_attempts {
            debug!("Max reconnection attempts ({}) reached", self.config.max_attempts);
            self.state = ReconnectState::Failed;
            return false;
        }

        // Calculate next backoff delay with exponential increase
        self.current_delay = Duration::from_secs_f64((self.current_delay.as_secs_f64() * self.config.backoff_multiplier).min(self.config.max_delay.as_secs_f64()));

        self.state = ReconnectState::Backoff;
        self.schedule_next_attempt();
        true
    }

    /// Blacklist a CM server for a period of time.
    ///
    /// Blacklisted servers are not selected for connection attempts.
    pub fn blacklist_server(&mut self, endpoint: &str) {
        debug!("Blacklisting CM server: {}", endpoint);
        self.blacklist.insert(
            endpoint.to_string(),
            BlacklistEntry {
                added_at: self.clock.now(),
                ttl: Duration::from_secs(120), // 2 minutes, matching JS implementation
            },
        );
    }

    /// Check if a CM server is blacklisted.
    pub fn is_server_blacklisted(&self, endpoint: &str) -> bool {
        if let Some(entry) = self.blacklist.get(endpoint) {
            !entry.is_expired(self.clock.now())
        } else {
            false
        }
    }

    /// Remove expired entries from the blacklist.
    pub fn cleanup_blacklist(&mut self) {
        let now = self.clock.now();
        self.blacklist.retain(|_, entry| !entry.is_expired(now));
    }

    /// Clear the entire blacklist.
    pub fn clear_blacklist(&mut self) {
        self.blacklist.clear();
    }

    /// Get the number of blacklisted servers.
    pub fn blacklist_count(&self) -> usize {
        self.blacklist.len()
    }

    /// Reset the reconnection state without clearing blacklist.
    ///
    /// Use this when manually canceling reconnection or when logging off.
    pub fn reset(&mut self) {
        self.state = ReconnectState::Idle;
        self.attempt = 0;
        self.current_delay = self.config.initial_delay;
        self.next_attempt_at = None;
        self.last_disconnect_reason = None;
    }

    /// Check if reconnection is currently in progress.
    pub fn is_reconnecting(&self) -> bool {
        matches!(self.state, ReconnectState::Backoff | ReconnectState::Attempting)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_config() -> ReconnectConfig {
        ReconnectConfig {
            enabled: true,
            max_attempts: 3,
            initial_delay: Duration::from_millis(100),
            max_delay: Duration::from_secs(1),
            backoff_multiplier: 2.0,
        }
    }

    #[test]
    fn test_should_reconnect() {
        let manager = ReconnectManager::new(test_config());

        // Non-fatal results should trigger reconnection
        assert!(manager.should_reconnect(EResult::NoConnection));
        assert!(manager.should_reconnect(EResult::ServiceUnavailable));
        assert!(manager.should_reconnect(EResult::TryAnotherCM));
        assert!(manager.should_reconnect(EResult::Fail));

        // Fatal results should not trigger reconnection
        assert!(!manager.should_reconnect(EResult::InvalidPassword));
        assert!(!manager.should_reconnect(EResult::AccountNotFound));
        assert!(!manager.should_reconnect(EResult::Banned));
    }

    #[test]
    fn test_disabled_reconnection() {
        let mut config = test_config();
        config.enabled = false;
        let manager = ReconnectManager::new(config);

        assert!(!manager.should_reconnect(EResult::NoConnection));
    }

    #[test]
    fn test_start_reconnection() {
        let mut manager = ReconnectManager::new(test_config());

        manager.start_reconnection(EResult::NoConnection);

        assert_eq!(manager.state(), ReconnectState::Backoff);
        assert_eq!(manager.attempt(), 0);
        assert_eq!(manager.last_disconnect_reason(), Some(EResult::NoConnection));
    }

    #[test]
    fn test_check_ready_immediate() {
        let mut config = test_config();
        config.initial_delay = Duration::ZERO;
        let mut manager = ReconnectManager::new(config);

        manager.start_reconnection(EResult::NoConnection);

        // With zero delay, should be ready immediately
        let attempt = manager.check_ready();
        assert_eq!(attempt, Some(1));
        assert_eq!(manager.state(), ReconnectState::Attempting);
    }

    #[test]
    fn test_record_failure_increments_backoff() {
        let mut manager = ReconnectManager::new(test_config());

        manager.start_reconnection(EResult::NoConnection);
        manager.check_ready(); // Move to Attempting state

        let initial_delay = manager.current_delay();
        let should_continue = manager.record_failure(None);

        assert!(should_continue);
        assert!(manager.current_delay() > initial_delay);
        assert_eq!(manager.state(), ReconnectState::Backoff);
    }

    #[test]
    fn test_max_attempts_reached() {
        // Use zero delay so check_ready() works immediately
        let mut config = test_config();
        config.initial_delay = Duration::ZERO;
        let mut manager = ReconnectManager::new(config);

        manager.start_reconnection(EResult::NoConnection);

        // Simulate max_attempts failures
        for i in 1..=3 {
            let attempt = manager.check_ready();
            assert_eq!(attempt, Some(i), "check_ready should return attempt {}", i);

            if i < 3 {
                assert!(manager.record_failure(None), "should continue after attempt {}", i);
            } else {
                assert!(!manager.record_failure(None), "should stop after max attempts");
            }
        }

        assert_eq!(manager.state(), ReconnectState::Failed);
    }

    #[test]
    fn test_record_success_resets() {
        let mut manager = ReconnectManager::new(test_config());

        manager.start_reconnection(EResult::NoConnection);
        manager.check_ready();
        manager.record_failure(None);

        manager.record_success();

        assert_eq!(manager.state(), ReconnectState::Idle);
        assert_eq!(manager.attempt(), 0);
        assert_eq!(manager.last_disconnect_reason(), None);
    }

    #[test]
    fn test_server_blacklist() {
        let mut manager = ReconnectManager::new(test_config());

        let endpoint = "cm1.steampowered.com:27017";

        assert!(!manager.is_server_blacklisted(endpoint));

        manager.blacklist_server(endpoint);

        assert!(manager.is_server_blacklisted(endpoint));
        assert_eq!(manager.blacklist_count(), 1);

        manager.clear_blacklist();

        assert!(!manager.is_server_blacklisted(endpoint));
    }
}
