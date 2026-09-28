//! Clock abstraction for testability.
//!
//! This module provides a `Clock` trait that abstracts time operations.

use async_trait::async_trait;
use std::time::{Duration, Instant};

/// Clock trait for abstracting time operations.
#[async_trait]
pub trait Clock: Send + Sync {
    /// Get the current instant.
    fn now(&self) -> Instant;

    /// Sleep for the specified duration.
    async fn sleep(&self, duration: Duration);
}

/// Production clock using system time.
#[derive(Debug, Clone, Default)]
pub struct SystemClock;

impl SystemClock {
    /// Create a new system clock.
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl Clock for SystemClock {
    fn now(&self) -> Instant {
        Instant::now()
    }

    async fn sleep(&self, duration: Duration) {
        tokio::time::sleep(duration).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_system_clock_now() {
        let clock = SystemClock::new();
        let before = Instant::now();
        let clock_now = clock.now();
        let after = Instant::now();

        // The clock's now should be between before and after
        assert!(clock_now >= before);
        assert!(clock_now <= after);
    }
}
