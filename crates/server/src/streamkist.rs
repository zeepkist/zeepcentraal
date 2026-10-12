use crate::{AppState, problem::Problem};
use axum::{
    Json,
    extract::State,
    http::{HeaderValue, header},
    response::{IntoResponse, Response},
};
use std::{future::Future, sync::Arc, time::Duration};
use tokio::{sync::Mutex, time::Instant};
use zc_database::services::streamkist::StreamkistStats;

const CACHE_TTL: Duration = Duration::from_secs(3_600);

#[derive(Default)]
pub struct StatsCache {
    snapshot: Mutex<Option<(Instant, StreamkistStats)>>,
}

impl StatsCache {
    async fn get_or_fetch<F, Fut, E>(&self, fetch: F) -> Result<StreamkistStats, E>
    where
        F: FnOnce() -> Fut,
        Fut: Future<Output = Result<StreamkistStats, E>>,
    {
        // Keep the lock through refresh: concurrent requests reuse its completed snapshot.
        let mut snapshot = self.snapshot.lock().await;
        if let Some((fetched_at, stats)) = *snapshot
            && fetched_at.elapsed() < CACHE_TTL
        {
            return Ok(stats);
        }
        let stats = fetch().await?;
        *snapshot = Some((Instant::now(), stats));
        Ok(stats)
    }
}

#[utoipa::path(get, path = "/streamkist/stats", responses(
    (status = 200, body = StreamkistStats), (status = 500), (status = 503)
))]
pub async fn stats(State(state): State<Arc<AppState>>) -> Response {
    let result = state
        .streamkist_stats
        .get_or_fetch(|| async {
            if !state.database_readiness.is_ready() {
                return Err(Problem::service_unavailable());
            }
            state
                .database
                .streamkist_stats()
                .await
                .map_err(Problem::internal)
        })
        .await;
    let mut response = match result {
        Ok(stats) => Json(stats).into_response(),
        Err(error) => error.into_response(),
    };
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        Router,
        body::{Body, to_bytes},
        http::{Request, StatusCode},
    };
    use std::sync::atomic::{AtomicUsize, Ordering};
    use tower::ServiceExt;

    mod support {
        use crate as zc_server;
        include!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/tests/support/ghost_validation.rs"
        ));
    }

    struct UnusedStorage;
    #[async_trait::async_trait]
    impl zc_core::object_storage::ObjectStorage for UnusedStorage {
        async fn upload(&self, _: &str, _: Vec<u8>, _: &str) -> anyhow::Result<()> {
            unreachable!("Stats must not use object storage")
        }
        async fn download(
            &self,
            _: &str,
            _: zc_core::object_storage::DownloadConstraints<'_>,
        ) -> anyhow::Result<Vec<u8>> {
            unreachable!("Stats must not use object storage")
        }
        async fn delete(&self, _: &str) -> anyhow::Result<()> {
            unreachable!("Stats must not use object storage")
        }
    }

    async fn router(cached: bool) -> Router {
        let state = support::state(
            "postgres://fixture:fixture@127.0.0.1:1/stats_test",
            Arc::new(UnusedStorage),
            false,
        )
        .unwrap();
        state.database_readiness.set(false);
        if cached {
            *state.streamkist_stats.snapshot.lock().await = Some((Instant::now(), FIRST));
        }
        crate::app::router(state).unwrap()
    }

    #[tokio::test(start_paused = true)]
    async fn anonymous_http_cache_survives_readiness_outage_but_expired_cache_does_not() {
        let app = router(true).await;
        let response = app
            .clone()
            .oneshot(
                Request::get("/streamkist/stats")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.headers()[header::CACHE_CONTROL], "no-store");
        let body: serde_json::Value =
            serde_json::from_slice(&to_bytes(response.into_body(), 4096).await.unwrap()).unwrap();
        assert_eq!(
            body,
            serde_json::json!({"streams":10,"streamers":3,"categories":2,"guilds":4})
        );
        tokio::time::advance(CACHE_TTL).await;
        let response = app
            .oneshot(
                Request::get("/streamkist/stats")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(response.headers()[header::CACHE_CONTROL], "no-store");
        let response = router(false)
            .await
            .oneshot(
                Request::get("/streamkist/stats")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(
            response.headers()[header::CONTENT_TYPE],
            "application/problem+json"
        );
    }

    #[tokio::test]
    async fn cors_allows_streamkist_only_for_stats_and_preserves_configured_origins() {
        let app = router(true).await;
        for (path, origin, allowed) in [
            ("/streamkist/stats", "https://streamkist.zeepki.st", true),
            ("/healthz", "https://streamkist.zeepki.st", false),
            ("/streamkist/stats", "https://other.example", false),
            ("/healthz", "http://localhost:4000", true),
        ] {
            for method in ["GET", "OPTIONS"] {
                let response = app
                    .clone()
                    .oneshot(
                        Request::builder()
                            .method(method)
                            .uri(path)
                            .header(header::ORIGIN, origin)
                            .header(header::ACCESS_CONTROL_REQUEST_METHOD, "GET")
                            .body(Body::empty())
                            .unwrap(),
                    )
                    .await
                    .unwrap();
                assert_eq!(
                    response
                        .headers()
                        .get(header::ACCESS_CONTROL_ALLOW_ORIGIN)
                        .map(|value| value.to_str().unwrap()),
                    allowed.then_some(origin)
                );
            }
        }
    }

    const FIRST: StreamkistStats = StreamkistStats {
        streams: 10,
        streamers: 3,
        categories: 2,
        guilds: 4,
    };
    const SECOND: StreamkistStats = StreamkistStats {
        streams: 20,
        streamers: 6,
        categories: 3,
        guilds: 5,
    };

    #[tokio::test(start_paused = true)]
    async fn cold_reuse_exact_expiry_and_fetch_completion_timestamp() {
        let cache = StatsCache::default();
        let first = cache
            .get_or_fetch(|| async {
                tokio::time::sleep(Duration::from_secs(10)).await;
                Ok::<_, ()>(FIRST)
            })
            .await
            .unwrap();
        assert_eq!(first, FIRST);
        tokio::time::advance(CACHE_TTL - Duration::from_secs(1)).await;
        assert_eq!(
            cache
                .get_or_fetch(|| async { Err::<StreamkistStats, _>(()) })
                .await
                .unwrap(),
            FIRST
        );
        tokio::time::advance(Duration::from_secs(1)).await;
        assert_eq!(
            cache
                .get_or_fetch(|| async { Ok::<_, ()>(SECOND) })
                .await
                .unwrap(),
            SECOND
        );
    }

    #[tokio::test(start_paused = true)]
    async fn concurrent_requests_share_cold_and_expired_refresh() {
        let cache = Arc::new(StatsCache::default());
        let calls = Arc::new(AtomicUsize::new(0));
        for expected in [1, 2] {
            let mut tasks = Vec::new();
            for _ in 0..12 {
                let cache = cache.clone();
                let calls = calls.clone();
                tasks.push(tokio::spawn(async move {
                    cache
                        .get_or_fetch(|| async {
                            calls.fetch_add(1, Ordering::SeqCst);
                            tokio::time::sleep(Duration::from_secs(1)).await;
                            Ok::<_, ()>(FIRST)
                        })
                        .await
                        .unwrap()
                }));
            }
            for task in tasks {
                assert_eq!(task.await.unwrap(), FIRST);
            }
            assert_eq!(calls.load(Ordering::SeqCst), expected);
            tokio::time::advance(CACHE_TTL).await;
        }
    }

    #[tokio::test(start_paused = true)]
    async fn failed_refresh_never_serves_stale_or_resets_ttl() {
        let cache = StatsCache::default();
        assert!(
            cache
                .get_or_fetch(|| async { Err::<StreamkistStats, _>("offline") })
                .await
                .is_err()
        );
        assert!(cache.snapshot.lock().await.is_none());
        cache
            .get_or_fetch(|| async { Ok::<_, &str>(FIRST) })
            .await
            .unwrap();
        let timestamp = cache.snapshot.lock().await.unwrap().0;
        tokio::time::advance(CACHE_TTL).await;
        assert_eq!(
            cache
                .get_or_fetch(|| async { Err::<StreamkistStats, _>("offline") })
                .await,
            Err("offline")
        );
        assert_eq!(cache.snapshot.lock().await.unwrap().0, timestamp);
        assert_eq!(
            cache
                .get_or_fetch(|| async { Ok::<_, &str>(SECOND) })
                .await
                .unwrap(),
            SECOND
        );
    }
}
