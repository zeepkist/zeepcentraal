//! Convenience wrappers over `poll_event`: non-blocking, timeout, predicate-match, drain.
//!
//! `poll_event` itself stays in the parent module because it's tangled with
//! the connection/message-handling state machine. Everything that just *uses*
//! it lives here.

use std::time::Duration;

use super::SteamClient;
use crate::client::events::SteamEvent;
use crate::error::SteamError;

impl SteamClient {
    /// Poll for events without blocking.
    ///
    /// Returns queued events immediately without waiting for network I/O.
    /// Useful for draining the event queue in non-async contexts.
    pub fn try_poll_event(&mut self) -> Option<SteamEvent> {
        if let Some(mut event) = self.event_queue.pop_front() {
            self.handle_event(&mut event);
            Some(event)
        } else {
            None
        }
    }

    /// Poll for events with a timeout.
    ///
    /// Waits for an event up to the specified duration. Returns `None` if
    /// the timeout expires without receiving an event.
    pub async fn poll_event_timeout(&mut self, timeout: Duration) -> Result<Option<SteamEvent>, SteamError> {
        match tokio::time::timeout(timeout, self.poll_event()).await {
            Ok(result) => result,
            Err(_) => Ok(None),
        }
    }

    /// Wait for an event matching a predicate.
    ///
    /// Polls for events until one matches the given predicate, then returns it.
    /// Non-matching events are discarded.
    pub async fn wait_for<F>(&mut self, predicate: F) -> Result<SteamEvent, SteamError>
    where
        F: Fn(&SteamEvent) -> bool,
    {
        loop {
            if let Some(event) = self.poll_event().await? {
                if predicate(&event) {
                    return Ok(event);
                }
            }
        }
    }

    /// Wait for an event matching a predicate with a timeout.
    pub async fn wait_for_timeout<F>(&mut self, predicate: F, timeout: Duration) -> Result<Option<SteamEvent>, SteamError>
    where
        F: Fn(&SteamEvent) -> bool,
    {
        match tokio::time::timeout(timeout, self.wait_for(predicate)).await {
            Ok(result) => result.map(Some),
            Err(_) => Ok(None),
        }
    }

    /// Drain all currently queued events without blocking.
    pub fn drain_queued_events(&mut self) -> Vec<SteamEvent> {
        let mut events: Vec<_> = self.event_queue.drain(..).collect();
        for event in &mut events {
            self.handle_event(event);
        }
        events
    }
}
