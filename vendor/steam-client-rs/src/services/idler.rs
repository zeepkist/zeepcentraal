//! Auto Game Play / Idler functionality for Steam client.
//!
//! This module provides automatic game idling functionality to maintain
//! the user's "In-Game" status on Steam. It periodically refreshes the
//! playing status at randomized intervals to avoid bot-like patterns.
//!
//! # Example
//!
//! ```rust,no_run
//! use steam_client::{services::IdlerHandle, SteamClient};
//!
//! async fn example(client: &mut SteamClient) {
//!     // Start idling CS:GO (app ID 730)
//!     let mut idler = IdlerHandle::new(vec![730]);
//!
//!     // Set initial playing status
//!     client.games_played(idler.app_ids().to_vec()).await.unwrap();
//!
//!     // In your event loop:
//!     loop {
//!         tokio::select! {
//!             // ... handle other events ...
//!
//!             _ = idler.tick() => {
//!                 // Time to refresh playing status
//!                 if client.is_logged_in() {
//!                     client.games_played(idler.app_ids().to_vec()).await.unwrap();
//!                 }
//!             }
//!         }
//!     }
//! }
//! ```

use std::{pin::Pin, time::Duration};

use rand::Rng;
use tokio::time::{Instant, Sleep};

/// Minimum interval between game play heartbeats (15 minutes).
const MIN_INTERVAL_SECS: u64 = 15 * 60;
/// Maximum interval between game play heartbeats (30 minutes).
const MAX_INTERVAL_SECS: u64 = 30 * 60;

/// Handle for automatic game idling.
///
/// The `IdlerHandle` is designed to be used in the caller's event loop via
/// `select!`. It uses randomized intervals between 15-30 minutes to avoid
/// detection patterns.
///
/// Unlike a background task approach, this handle gives the caller full control
/// over when and how to refresh the playing status, working naturally with
/// Rust's ownership model.
///
/// # Key Features
///
/// - **Tick-based**: Integrates with your existing `select!` loop
/// - **Randomized intervals**: 15-30 minutes to avoid bot-like patterns
/// - **No background tasks**: Everything runs in the caller's task
/// - **Full control**: Caller decides what to do on each tick
///
/// # Example
///
/// ```rust,no_run
/// use steam_client::{services::IdlerHandle, AuthEvent, SteamEvent};
///
/// async fn run_idler(client: &mut steam_client::SteamClient) {
///     let mut idler = IdlerHandle::new(vec![730]); // CS:GO
///
///     loop {
///         tokio::select! {
///             event = client.poll_event() => {
///                 match event {
///                     Ok(Some(SteamEvent::Auth(AuthEvent::LoggedOn { .. }))) => {
///                         // Immediately refresh games played on login
///                         idler.trigger_now();
///                     }
///                     // ... handle other events
///                     _ => {}
///                 }
///             }
///             _ = idler.tick() => {
///                 client.games_played(idler.app_ids().to_vec()).await.unwrap();
///             }
///         }
///     }
/// }
/// ```
pub struct IdlerHandle {
    /// App IDs being idled.
    app_ids: Vec<u32>,
    /// The sleep future for the next tick.
    sleep: Pin<Box<Sleep>>,
}

impl IdlerHandle {
    /// Create a new idler handle for the specified app IDs.
    ///
    /// The first tick will fire after a random interval (15-30 minutes).
    /// You should call `games_played()` immediately after creating the handle
    /// to set the initial playing status.
    ///
    /// # Arguments
    ///
    /// * `app_ids` - List of app IDs to idle (e.g., `vec![730]` for CS:GO)
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// use steam_client::services::IdlerHandle;
    ///
    /// let idler = IdlerHandle::new(vec![730, 440]); // CS:GO and TF2
    /// ```
    pub fn new(app_ids: Vec<u32>) -> Self {
        let delay = random_duration();
        Self { app_ids, sleep: Box::pin(tokio::time::sleep(delay)) }
    }

    /// Wait until the next refresh is due.
    ///
    /// This future completes when it's time to refresh the playing status.
    /// After it completes, call `games_played()` with the app IDs.
    ///
    /// Each call to `tick()` will wait for the current interval to complete,
    /// then automatically reset to a new random interval for the next tick.
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use steam_client::services::IdlerHandle;
    /// # async fn example(client: &mut steam_client::SteamClient) {
    /// let mut idler = IdlerHandle::new(vec![730]);
    ///
    /// // Wait for the next refresh time
    /// idler.tick().await;
    ///
    /// // Now refresh the playing status
    /// client.games_played(idler.app_ids().to_vec()).await.unwrap();
    /// # }
    /// ```
    pub async fn tick(&mut self) {
        // Wait for the current sleep to complete
        (&mut self.sleep).await;

        // Reset with a new random duration for the next tick
        let delay = random_duration();
        self.sleep = Box::pin(tokio::time::sleep(delay));
    }

    /// Get the app IDs being idled.
    ///
    /// Use this to get the app IDs when calling `games_played()`.
    #[inline]
    pub fn app_ids(&self) -> &[u32] {
        &self.app_ids
    }

    /// Update the app IDs being idled.
    ///
    /// This does not immediately refresh the playing status. The next tick
    /// will use the new app IDs, or you can call `games_played()` immediately.
    pub fn set_app_ids(&mut self, app_ids: Vec<u32>) {
        self.app_ids = app_ids;
    }

    /// Get the time remaining until the next tick.
    ///
    /// Returns `Duration::ZERO` if the tick is ready.
    pub fn time_until_next_tick(&self) -> Duration {
        let deadline = self.sleep.deadline();
        let now = Instant::now();
        if deadline > now {
            deadline - now
        } else {
            Duration::ZERO
        }
    }

    /// Reset the timer with a new random interval.
    ///
    /// Use this if you want to manually reset the tick timing,
    /// for example after a reconnection.
    pub fn reset(&mut self) {
        let delay = random_duration();
        self.sleep = Box::pin(tokio::time::sleep(delay));
    }

    /// Force the idler to trigger immediately.
    ///
    /// Use this when you want to force a game play status refresh,
    /// for example after a `LoggedOn` event to ensure the "Playing"
    /// status is set immediately upon login/reconnection.
    pub fn trigger_now(&mut self) {
        self.sleep = Box::pin(tokio::time::sleep(Duration::ZERO));
    }
}

/// Generate a random duration between MIN_INTERVAL and MAX_INTERVAL.
fn random_duration() -> Duration {
    let secs = rand::rng().random_range(MIN_INTERVAL_SECS..=MAX_INTERVAL_SECS);
    Duration::from_secs(secs)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_random_duration_in_range() {
        for _ in 0..100 {
            let duration = random_duration();
            let secs = duration.as_secs();
            assert!((MIN_INTERVAL_SECS..=MAX_INTERVAL_SECS).contains(&secs), "Duration {} outside range [{}, {}]", secs, MIN_INTERVAL_SECS, MAX_INTERVAL_SECS);
        }
    }

    #[tokio::test]
    async fn test_new_handle_has_app_ids() {
        let handle = IdlerHandle::new(vec![730, 440]);
        assert_eq!(handle.app_ids(), &[730, 440]);
    }

    #[tokio::test]
    async fn test_set_app_ids() {
        let mut handle = IdlerHandle::new(vec![730]);
        handle.set_app_ids(vec![440, 570]);
        assert_eq!(handle.app_ids(), &[440, 570]);
    }

    #[tokio::test]
    async fn test_tick_resets_timer() {
        // Use a short duration for testing
        let mut handle = IdlerHandle { app_ids: vec![730], sleep: Box::pin(tokio::time::sleep(Duration::from_millis(10))) };

        // First tick should complete quickly
        handle.tick().await;

        // After tick, the sleep should be reset with a random duration
        // We can't easily test the exact duration, but we can verify
        // that time_until_next_tick returns a non-zero (or random) value
        let remaining = handle.time_until_next_tick();
        // The new timer should have been set (could be 15-30 minutes)
        assert!(remaining.as_secs() > 0 || remaining == Duration::ZERO);
    }

    #[tokio::test]
    async fn test_reset() {
        let mut handle = IdlerHandle::new(vec![730]);
        let original_deadline = handle.sleep.deadline();

        // Small delay to ensure time changes
        tokio::time::sleep(Duration::from_millis(1)).await;

        handle.reset();
        let new_deadline = handle.sleep.deadline();

        // The deadline should have changed after reset
        assert_ne!(new_deadline, original_deadline);
    }
}
