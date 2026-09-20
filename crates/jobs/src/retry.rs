use std::time::Duration;
use tokio::{sync::watch, time::Instant};

const RETRY_DELAYS: [Duration; 5] = [
    Duration::from_millis(250),
    Duration::from_millis(500),
    Duration::from_secs(1),
    Duration::from_secs(2),
    Duration::from_secs(5),
];
const WARNING_INTERVAL: Duration = Duration::from_secs(30);

#[derive(Default)]
pub struct RetryBackoff {
    attempt: usize,
    last_warning: Option<Instant>,
}

impl RetryBackoff {
    pub const fn new() -> Self {
        Self {
            attempt: 0,
            last_warning: None,
        }
    }

    pub fn failure(&mut self) -> RetryDecision {
        self.failure_at(Instant::now())
    }

    fn failure_at(&mut self, now: Instant) -> RetryDecision {
        let delay = RETRY_DELAYS[self.attempt.min(RETRY_DELAYS.len() - 1)];
        self.attempt = self.attempt.saturating_add(1);
        let warn = self
            .last_warning
            .is_none_or(|last_warning| now.duration_since(last_warning) >= WARNING_INTERVAL);
        if warn {
            self.last_warning = Some(now);
        }
        RetryDecision { delay, warn }
    }

    pub fn reset(&mut self) {
        self.attempt = 0;
        self.last_warning = None;
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RetryDecision {
    pub delay: Duration,
    pub warn: bool,
}

pub async fn wait_or_shutdown(delay: Duration, shutdown: &mut watch::Receiver<bool>) -> bool {
    if *shutdown.borrow() {
        return true;
    }
    tokio::select! {
        result = shutdown.changed() => result.is_err() || *shutdown.borrow(),
        _ = tokio::time::sleep(delay) => false,
    }
}

pub fn is_unavailable(error: &anyhow::Error) -> bool {
    error.chain().any(zc_database::is_unavailable_error)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backoff_caps_and_throttles_warnings() {
        let start = Instant::now();
        let mut retry = RetryBackoff::new();
        assert_eq!(
            retry.failure_at(start),
            RetryDecision {
                delay: Duration::from_millis(250),
                warn: true,
            }
        );
        assert_eq!(
            retry.failure_at(start + Duration::from_secs(1)).delay,
            Duration::from_millis(500)
        );
        assert!(!retry.failure_at(start + Duration::from_secs(2)).warn);
        assert_eq!(
            retry.failure_at(start + Duration::from_secs(3)).delay,
            Duration::from_secs(2)
        );
        assert_eq!(
            retry.failure_at(start + Duration::from_secs(4)).delay,
            Duration::from_secs(5)
        );
        assert_eq!(
            retry.failure_at(start + Duration::from_secs(5)).delay,
            Duration::from_secs(5)
        );
        assert!(retry.failure_at(start + Duration::from_secs(30)).warn);
        retry.reset();
        assert_eq!(
            retry.failure_at(start + Duration::from_secs(31)).delay,
            Duration::from_millis(250)
        );
    }
}
