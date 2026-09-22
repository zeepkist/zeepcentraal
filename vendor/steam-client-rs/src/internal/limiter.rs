use std::{
    num::NonZeroU32,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use governor::{Quota, RateLimiter};
use once_cell::sync::Lazy;
use tokio::sync::Semaphore;

/// Global lockout timestamp (ms since epoch).
static LOCKOUT_UNTIL: AtomicU64 = AtomicU64::new(0);

// Strict limiter for Web Auth (passwords) to avoid IP bans
static WEB_AUTH_LIMITER: Lazy<RateLimiter<governor::state::NotKeyed, governor::state::InMemoryState, governor::clock::QuantaClock, governor::middleware::NoOpMiddleware<governor::clock::QuantaInstant>>> = Lazy::new(|| RateLimiter::direct(Quota::per_minute(NonZeroU32::new(3).unwrap()).allow_burst(NonZeroU32::new(5).unwrap())));

// Lenient limiter for CM connections (tokens) to allow fast bulk reconnects
static CM_CONNECTION_LIMITER: Lazy<RateLimiter<governor::state::NotKeyed, governor::state::InMemoryState, governor::clock::QuantaClock, governor::middleware::NoOpMiddleware<governor::clock::QuantaInstant>>> = Lazy::new(|| RateLimiter::direct(Quota::per_minute(NonZeroU32::new(30).unwrap()).allow_burst(NonZeroU32::new(50).unwrap())));

/// Concurrency cap: at most 3 simultaneous password (WebAuth) logins
/// process-wide. This prevents the cron job from firing 50+ simultaneous
/// credential requests.
static WEB_AUTH_SEMAPHORE: Lazy<Arc<Semaphore>> = Lazy::new(|| Arc::new(Semaphore::new(3)));

pub enum LoginType {
    WebAuth,
    CMConnection,
}

/// RAII guard that holds a WebAuth semaphore permit.
/// Drop to release the slot for the next queued login.
pub struct WebAuthPermit {
    _permit: tokio::sync::OwnedSemaphorePermit,
}

/// Acquires a concurrency slot for a WebAuth login.
/// Callers should hold the returned `WebAuthPermit` for the duration of the
/// login attempt (including cookie fetch) and drop it when done.
pub async fn acquire_web_auth_slot() -> WebAuthPermit {
    let permit = WEB_AUTH_SEMAPHORE.clone().acquire_owned().await.expect("semaphore closed");
    WebAuthPermit { _permit: permit }
}

/// Waits until a rate-limit permit is available and adds randomized jitter.
pub async fn wait_for_permit(login_type: LoginType) {
    // 1. Check for active lockout
    loop {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64;
        let lockout = LOCKOUT_UNTIL.load(Ordering::Acquire);

        if lockout > now {
            let wait_ms = lockout - now;
            tracing::warn!("Steam login rate-limit LOCKOUT active. Waiting {}ms...", wait_ms);
            tokio::time::sleep(Duration::from_millis(wait_ms)).await;

            // 1.5 Add randomized jitter when waking up from lockout
            // to mitigate "thundering herd" CPU spikes
            let wake_jitter = rand::random::<u64>() % 1000 + 100;
            tokio::time::sleep(Duration::from_millis(wake_jitter)).await;
            continue;
        }
        break;
    }

    // 2. Wait for governor permit
    let start = std::time::Instant::now();
    match login_type {
        LoginType::WebAuth => WEB_AUTH_LIMITER.until_ready().await,
        LoginType::CMConnection => CM_CONNECTION_LIMITER.until_ready().await,
    }
    let wait_time = start.elapsed();

    if wait_time > Duration::from_secs(5) {
        tracing::warn!("Steam login throttled for {:?}", wait_time);
    } else {
        tracing::trace!("Steam login permit granted after {:?}", wait_time);
    }

    // 3. Add randomized jitter (50ms - 250ms)
    // This makes the request pattern less predictable/bot-like
    let jitter_ms = rand::random::<u64>() % 200 + 50;
    tokio::time::sleep(Duration::from_millis(jitter_ms)).await;
}

/// Penalizes the global limiter by locking it for a specific duration.
pub fn penalize_abuse(duration: Duration, reason: &str) {
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64;
    let until = now + duration.as_millis() as u64;

    // Only extend the lockout, never shorten it
    let current = LOCKOUT_UNTIL.load(Ordering::Acquire);
    if until > current {
        LOCKOUT_UNTIL.store(until, Ordering::Release);
    }
    tracing::error!("Received {reason}. Locking global Steam login limiter for {:?}", duration);
}
