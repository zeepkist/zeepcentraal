use crate::{AppState, problem};
use axum::{
    extract::{ConnectInfo, Request, State},
    http::{HeaderMap, StatusCode, header},
    middleware::Next,
    response::{IntoResponse, Response},
};
use std::{
    collections::{HashMap, HashSet},
    net::SocketAddr,
    sync::Mutex,
    time::{Duration, Instant},
};

const WINDOW: Duration = Duration::from_secs(60);
const MAX_IDENTITIES: usize = 10_000;

#[derive(Clone, Copy)]
struct Counter {
    count: u32,
    reset_second: u64,
}

pub struct RateLimitStore {
    origin: Instant,
    inner: Mutex<RateLimitInner>,
}

struct RateLimitInner {
    counters: HashMap<String, Counter>,
    expiry_buckets: Vec<HashSet<String>>,
    current_second: u64,
}

impl Default for RateLimitStore {
    fn default() -> Self {
        Self {
            origin: Instant::now(),
            inner: Mutex::new(RateLimitInner {
                counters: HashMap::new(),
                expiry_buckets: (0..WINDOW.as_secs()).map(|_| HashSet::new()).collect(),
                current_second: 0,
            }),
        }
    }
}

impl RateLimitStore {
    fn take(&self, key: String, limit: u32, now: Instant) -> RateLimitResult {
        let now = now.saturating_duration_since(self.origin).as_secs();
        let mut inner = self.inner.lock().expect("rate limiter mutex poisoned");
        inner.advance(now);
        if !inner.counters.contains_key(&key) && inner.counters.len() >= MAX_IDENTITIES {
            return RateLimitResult {
                allowed: false,
                retry_after: 1,
            };
        }
        if !inner.counters.contains_key(&key) {
            let reset_second = now + WINDOW.as_secs();
            inner.counters.insert(
                key.clone(),
                Counter {
                    count: 0,
                    reset_second,
                },
            );
            let index = (reset_second % WINDOW.as_secs()) as usize;
            inner.expiry_buckets[index].insert(key.clone());
        }
        let counter = inner.counters.get_mut(&key).expect("counter was inserted");
        counter.count = counter.count.saturating_add(1);
        RateLimitResult {
            allowed: counter.count <= limit,
            retry_after: counter.reset_second.saturating_sub(now).max(1),
        }
    }
}

impl RateLimitInner {
    fn advance(&mut self, now: u64) {
        if now <= self.current_second {
            return;
        }
        let start = (self.current_second + 1).max(now.saturating_sub(WINDOW.as_secs()));
        for second in start..=now {
            let index = (second % WINDOW.as_secs()) as usize;
            for key in std::mem::take(&mut self.expiry_buckets[index]) {
                if self
                    .counters
                    .get(&key)
                    .is_some_and(|counter| counter.reset_second <= second)
                {
                    self.counters.remove(&key);
                }
            }
        }
        self.current_second = now;
    }
}

struct RateLimitResult {
    allowed: bool,
    retry_after: u64,
}

pub async fn middleware(
    State(state): State<std::sync::Arc<AppState>>,
    request: Request,
    next: Next,
) -> Response {
    let Some((bucket, limit)) = bucket(request.uri().path(), state.config.rate_limits) else {
        return next.run(request).await;
    };
    let identity = authenticated_id(request.headers(), &state)
        .unwrap_or_else(|| client_ip(&request, state.config.trust_proxy));
    let result = state
        .rate_limits
        .take(format!("{bucket}:{identity}"), limit, Instant::now());
    if result.allowed {
        return next.run(request).await;
    }
    let mut response =
        problem::Problem::code(StatusCode::TOO_MANY_REQUESTS, problem::INVALID_REQUEST)
            .into_response();
    response.headers_mut().insert(
        header::RETRY_AFTER,
        result
            .retry_after
            .to_string()
            .parse()
            .expect("valid retry-after"),
    );
    response
}

fn bucket(path: &str, limits: crate::config::RateLimits) -> Option<(&'static str, u32)> {
    if path.starts_with("/auth/") {
        Some(("auth", limits.auth))
    } else if path.starts_with("/record/") {
        Some(("record", limits.record))
    } else if path.starts_with("/job/") {
        Some(("job", limits.job))
    } else if ["/favourite/", "/vote/", "/level/", "/user/", "/turnstile/"]
        .iter()
        .any(|prefix| path.starts_with(prefix))
    {
        Some(("mutation", limits.mutation))
    } else {
        None
    }
}

fn authenticated_id(headers: &HeaderMap, state: &AppState) -> Option<String> {
    let token = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .map(str::to_owned)
        .or_else(|| {
            zc_core::cookies::get_cookie(
                headers
                    .get(header::COOKIE)
                    .and_then(|value| value.to_str().ok()),
                zc_core::cookies::ACCESS_TOKEN,
            )
        })?;
    state
        .config
        .jwt
        .verify(&token)
        .ok()
        .map(|claims| claims.steamid)
}

pub(crate) fn client_ip(request: &Request, trust_proxy: bool) -> String {
    if trust_proxy {
        if let Some(forwarded) = request
            .headers()
            .get("x-forwarded-for")
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.split(',').next())
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            return forwarded.to_owned();
        }
        if let Some(real) = request
            .headers()
            .get("x-real-ip")
            .and_then(|value| value.to_str().ok())
        {
            return real.to_owned();
        }
    }
    request
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map_or_else(
            || "unknown".to_owned(),
            |address| address.0.ip().to_string(),
        )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expires_fixed_window_and_caps_identities() {
        let store = RateLimitStore::default();
        let now = Instant::now();
        assert!(store.take("record:one".into(), 1, now).allowed);
        assert!(!store.take("record:one".into(), 1, now).allowed);
        assert!(store.take("record:one".into(), 1, now + WINDOW).allowed);
        for index in 0..MAX_IDENTITIES - 1 {
            assert!(
                store
                    .take(format!("record:{index}"), 1, now + WINDOW)
                    .allowed
            );
        }
        assert!(
            !store
                .take("record:overflow".into(), 1, now + WINDOW)
                .allowed
        );
    }

    #[test]
    fn assigns_existing_route_buckets() {
        let limits = crate::config::RateLimits {
            auth: 1,
            record: 2,
            mutation: 3,
            job: 4,
        };
        assert_eq!(bucket("/auth/login", limits), Some(("auth", 1)));
        assert_eq!(bucket("/record/submit", limits), Some(("record", 2)));
        assert_eq!(bucket("/level/request", limits), Some(("mutation", 3)));
        assert_eq!(bucket("/job/trigger", limits), Some(("job", 4)));
        assert_eq!(bucket("/healthz", limits), None);
        assert_eq!(bucket("/readyz", limits), None);
    }
}
