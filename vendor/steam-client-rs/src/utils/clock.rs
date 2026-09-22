//! Clock abstraction for testable time operations.
//!
//! This module provides a `Clock` trait that abstracts time operations,
//! enabling deterministic testing of time-dependent logic.
//!
//! # Example
//!
//! ```rust,ignore
//! use steam_client::clock::{Clock, SystemClock, MockClock};
//! use std::time::Duration;
//!
//! // Production: use SystemClock
//! let clock = SystemClock;
//! let now = clock.now();
//!
//! // Testing: use MockClock for deterministic tests
//! let mock = MockClock::new();
//! let t1 = mock.now();
//! mock.advance(Duration::from_secs(10));
//! let t2 = mock.now();
//! assert_eq!(t2 - t1, Duration::from_secs(10));
//!
//! // Async sleep - MockClock advances time instantly
//! mock.sleep(Duration::from_secs(5)).await;
//! assert_eq!(mock.current_offset(), Duration::from_secs(15));
//! ```

use std::{
    future::Future,
    pin::Pin,
    sync::{Arc, Mutex},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

/// Trait for time operations including getting current time and async sleeping.
///
/// This trait abstracts time operations, allowing mock implementations
/// for deterministic testing of time-dependent logic.
pub trait Clock: Send + Sync + std::fmt::Debug {
    /// Get the current instant in time.
    fn now(&self) -> Instant;

    /// Get the current wall clock time in seconds since the Unix epoch.
    fn timestamp(&self) -> u64;

    /// Async sleep for the given duration.
    ///
    /// For production clocks, this actually waits for the specified duration.
    /// For mock clocks, this advances the simulated time and returns
    /// immediately.
    fn sleep(&self, duration: Duration) -> Pin<Box<dyn Future<Output = ()> + Send + '_>>;
}

/// System clock implementation using the real system time.
///
/// This is the default clock used in production code.
#[derive(Debug, Clone, Copy, Default)]
pub struct SystemClock;

impl Clock for SystemClock {
    fn now(&self) -> Instant {
        Instant::now()
    }

    fn timestamp(&self) -> u64 {
        SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or(Duration::ZERO).as_secs()
    }

    fn sleep(&self, duration: Duration) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        Box::pin(tokio::time::sleep(duration))
    }
}

/// Mock clock for testing with controllable time.
///
/// Allows tests to advance time deterministically without actual delays.
///
/// # Example
///
/// ```rust
/// use std::time::Duration;
///
/// use steam_client::utils::clock::{Clock, MockClock};
///
/// let clock = MockClock::new();
///
/// let t1 = clock.now();
/// clock.advance(Duration::from_secs(5));
/// let t2 = clock.now();
///
/// assert_eq!(t2 - t1, Duration::from_secs(5));
/// ```
#[derive(Debug, Clone)]
pub struct MockClock {
    /// The current simulated time, stored as offset from base instant.
    offset: Arc<Mutex<Duration>>,
    /// Base instant (captured at creation time).
    base: Instant,
    /// Base system time (captured at creation time).
    base_system: SystemTime,
}

impl MockClock {
    /// Create a new mock clock starting at the current time.
    pub fn new() -> Self {
        Self { offset: Arc::new(Mutex::new(Duration::ZERO)), base: Instant::now(), base_system: SystemTime::now() }
    }

    /// Advance the clock by the given duration.
    ///
    /// This moves the simulated time forward without blocking.
    pub fn advance(&self, duration: Duration) {
        let mut offset = self.offset.lock().expect("mutex poisoned");
        *offset += duration;
    }

    /// Set the clock to a specific offset from the base time.
    pub fn set_offset(&self, offset: Duration) {
        let mut current = self.offset.lock().expect("mutex poisoned");
        *current = offset;
    }

    /// Get the current offset from the base time.
    pub fn current_offset(&self) -> Duration {
        *self.offset.lock().expect("mutex poisoned")
    }

    /// Reset the clock to the base time (zero offset).
    pub fn reset(&self) {
        let mut offset = self.offset.lock().expect("mutex poisoned");
        *offset = Duration::ZERO;
    }
}

impl Default for MockClock {
    fn default() -> Self {
        Self::new()
    }
}

impl Clock for MockClock {
    fn now(&self) -> Instant {
        let offset = self.offset.lock().expect("mutex poisoned");
        self.base + *offset
    }

    fn timestamp(&self) -> u64 {
        let offset = self.offset.lock().expect("mutex poisoned");
        self.base_system.checked_add(*offset).unwrap_or(self.base_system).duration_since(UNIX_EPOCH).unwrap_or(Duration::ZERO).as_secs()
    }

    fn sleep(&self, duration: Duration) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        // Advance the mock time immediately and return a completed future
        self.advance(duration);
        Box::pin(std::future::ready(()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_system_clock_advances() {
        let clock = SystemClock;
        let t1 = clock.now();
        std::thread::sleep(Duration::from_millis(10));
        let t2 = clock.now();

        assert!(t2 > t1);
    }

    #[test]
    fn test_system_clock_timestamp() {
        let clock = SystemClock;
        let t1 = clock.timestamp();
        std::thread::sleep(Duration::from_millis(1100));
        let t2 = clock.timestamp();

        assert!(t2 > t1);
    }

    #[test]
    fn test_mock_clock_initial_time() {
        let clock = MockClock::new();
        let t1 = clock.now();
        let t2 = clock.now();

        // Without advancing, time should be the same
        assert_eq!(t1, t2);
    }

    #[test]
    fn test_mock_clock_advance() {
        let clock = MockClock::new();

        let t1 = clock.now();
        clock.advance(Duration::from_secs(10));
        let t2 = clock.now();

        assert_eq!(t2 - t1, Duration::from_secs(10));
    }

    #[test]
    fn test_mock_clock_timestamp_advances() {
        let clock = MockClock::new();
        let t1 = clock.timestamp();

        clock.advance(Duration::from_secs(10));
        let t2 = clock.timestamp();

        assert_eq!(t2, t1 + 10);
    }

    #[test]
    fn test_mock_clock_multiple_advances() {
        let clock = MockClock::new();

        let t1 = clock.now();
        clock.advance(Duration::from_secs(5));
        clock.advance(Duration::from_secs(3));
        let t2 = clock.now();

        assert_eq!(t2 - t1, Duration::from_secs(8));
    }

    #[test]
    fn test_mock_clock_set_offset() {
        let clock = MockClock::new();

        clock.set_offset(Duration::from_secs(100));
        assert_eq!(clock.current_offset(), Duration::from_secs(100));
    }

    #[test]
    fn test_mock_clock_reset() {
        let clock = MockClock::new();

        clock.advance(Duration::from_secs(50));
        clock.reset();

        assert_eq!(clock.current_offset(), Duration::ZERO);
    }

    #[test]
    fn test_mock_clock_clone_shares_state() {
        let clock = MockClock::new();
        let clone = clock.clone();

        let t1 = clock.now();
        clone.advance(Duration::from_secs(20));
        let t2 = clock.now();

        // Clone should share state with original
        assert_eq!(t2 - t1, Duration::from_secs(20));
    }

    #[tokio::test]
    async fn test_system_clock_sleep() {
        let clock = SystemClock;
        let start = clock.now();

        // Sleep for a short duration
        clock.sleep(Duration::from_millis(10)).await;

        let elapsed = clock.now() - start;
        // Should have waited at least 10ms
        assert!(elapsed >= Duration::from_millis(10));
    }

    #[tokio::test]
    async fn test_mock_clock_sleep_advances_time() {
        let clock = MockClock::new();

        assert_eq!(clock.current_offset(), Duration::ZERO);

        // Sleep should advance mock time instantly
        clock.sleep(Duration::from_secs(10)).await;
        assert_eq!(clock.current_offset(), Duration::from_secs(10));

        // Multiple sleeps should accumulate
        clock.sleep(Duration::from_secs(5)).await;
        assert_eq!(clock.current_offset(), Duration::from_secs(15));
    }

    #[tokio::test]
    async fn test_mock_clock_sleep_is_instant() {
        let clock = MockClock::new();

        // Even a long mock sleep should return instantly
        let real_start = std::time::Instant::now();
        clock.sleep(Duration::from_secs(3600)).await; // 1 hour
        let real_elapsed = real_start.elapsed();

        // Should complete in well under 1 second of real time
        assert!(real_elapsed < Duration::from_secs(1));

        // But mock time should have advanced
        assert_eq!(clock.current_offset(), Duration::from_secs(3600));
    }
}
