use std::time::Duration;
use tokio::time::Instant;

const RETRY_FLOOR: Duration = Duration::from_secs(30);
const DECAY_INTERVAL: Duration = Duration::from_secs(300);

pub(super) struct RetryBackoff {
    delay: Duration,
    cap: Duration,
    next_decay: Option<Instant>,
}

impl RetryBackoff {
    pub(super) fn new(cap_ms: u64) -> Self {
        Self {
            delay: RETRY_FLOOR,
            cap: Duration::from_millis(cap_ms).max(RETRY_FLOOR),
            next_decay: None,
        }
    }

    pub(super) fn next_delay(&mut self) -> Duration {
        let delay = self.delay;
        self.delay = (self.delay * 2).min(self.cap);
        delay
    }

    pub(super) fn wait_delay(&mut self, asset_poll_ms: Option<u64>) -> Duration {
        asset_poll_ms
            .map(Duration::from_millis)
            .unwrap_or_else(|| self.next_delay())
    }

    pub(super) fn confirmed_host(&mut self, now: Instant) {
        self.next_decay.get_or_insert(now + DECAY_INTERVAL);
    }

    pub(super) fn decay_deadline(&self) -> Option<Instant> {
        (self.delay > RETRY_FLOOR)
            .then_some(self.next_decay)
            .flatten()
    }

    pub(super) fn decay(&mut self, now: Instant) {
        if let Some(mut next) = self.next_decay {
            while next <= now {
                self.delay = (self.delay / 2).max(RETRY_FLOOR);
                next += DECAY_INTERVAL;
            }
            self.next_decay = Some(next);
        }
    }

    pub(super) fn lost_host(&mut self, now: Instant) {
        self.decay(now);
        self.next_decay = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn retries_double_to_cap_and_cap_cannot_breach_floor() {
        let mut retry = RetryBackoff::new(240_000);
        let delays: Vec<_> = (0..5).map(|_| retry.next_delay().as_secs()).collect();
        assert_eq!(delays, [30, 60, 120, 240, 240]);
        let mut low_cap = RetryBackoff::new(5_000);
        assert_eq!(low_cap.next_delay(), RETRY_FLOOR);
        assert_eq!(low_cap.next_delay(), RETRY_FLOOR);
    }

    #[test]
    fn stable_hosting_decays_gradually_and_recovery_time_does_not_count() {
        let mut retry = RetryBackoff::new(240_000);
        for _ in 0..3 {
            retry.next_delay();
        }
        let start = Instant::now();
        retry.confirmed_host(start);
        retry.decay(start + Duration::from_secs(299));
        assert_eq!(retry.delay.as_secs(), 240);
        // Duplicate confirmations do not restart the stability interval.
        retry.confirmed_host(start + Duration::from_secs(299));
        retry.decay(start + Duration::from_secs(300));
        assert_eq!(retry.delay.as_secs(), 120);
        retry.decay(start + Duration::from_secs(600));
        assert_eq!(retry.delay.as_secs(), 60);
        retry.lost_host(start + Duration::from_secs(899));
        retry.decay(start + Duration::from_secs(2_000));
        assert_eq!(retry.delay.as_secs(), 60);
        retry.confirmed_host(start + Duration::from_secs(2_000));
        retry.decay(start + Duration::from_secs(2_299));
        assert_eq!(retry.delay.as_secs(), 60);
        retry.decay(start + Duration::from_secs(2_300));
        assert_eq!(retry.delay, RETRY_FLOOR);
        assert_eq!(retry.decay_deadline(), None);
    }

    #[test]
    fn connection_exit_accounts_for_elapsed_healthy_intervals() {
        let mut retry = RetryBackoff::new(240_000);
        for _ in 0..3 {
            retry.next_delay();
        }
        let start = Instant::now();
        retry.confirmed_host(start);
        retry.lost_host(start + Duration::from_secs(900));
        assert_eq!(retry.delay, RETRY_FLOOR);
        assert_eq!(retry.next_decay, None);
    }

    #[test]
    fn missing_assets_poll_without_resetting_or_increasing_reconnect_delay() {
        let mut retry = RetryBackoff::new(600_000);
        assert_eq!(retry.wait_delay(None).as_secs(), 30);
        assert_eq!(retry.wait_delay(None).as_secs(), 60);
        assert_eq!(retry.wait_delay(Some(5_000)).as_secs(), 5);
        assert_eq!(retry.wait_delay(Some(30_000)).as_secs(), 30);
        assert_eq!(retry.wait_delay(None).as_secs(), 120);
    }
}
