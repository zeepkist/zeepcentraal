use anyhow::Result;
use axum::{
    extract::{Request, State},
    response::{IntoResponse, Response},
};
use std::{
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};
use tokio::sync::watch;

use crate::problem::Problem;

const HEALTH_INTERVAL: Duration = Duration::from_secs(5);

#[derive(Clone, Default)]
pub struct DatabaseReadiness(Arc<AtomicBool>);

impl DatabaseReadiness {
    pub fn is_ready(&self) -> bool {
        self.0.load(Ordering::Acquire)
    }

    pub fn set(&self, ready: bool) -> bool {
        self.0.swap(ready, Ordering::AcqRel) != ready
    }
}

pub async fn supervise(
    database: zc_database::Database,
    queue: zc_jobs::queue::Queue,
    readiness: DatabaseReadiness,
    mut shutdown: watch::Receiver<bool>,
) -> Result<()> {
    let mut retry = zc_jobs::retry::RetryBackoff::new();
    let mut verify_queue = true;
    loop {
        if *shutdown.borrow() {
            return Ok(());
        }
        let result = match database.ping().await {
            Ok(()) if verify_queue => queue.verify_contract().await,
            Ok(()) => Ok(()),
            Err(error) => Err(error),
        };
        match result {
            Ok(()) => {
                verify_queue = false;
                retry.reset();
                if readiness.set(true) {
                    tracing::info!("Server database ready");
                }
                if zc_jobs::retry::wait_or_shutdown(HEALTH_INTERVAL, &mut shutdown).await {
                    return Ok(());
                }
            }
            Err(error) if zc_jobs::retry::is_unavailable(&error) => {
                verify_queue = true;
                if readiness.set(false) {
                    tracing::warn!("Server database became unavailable");
                }
                let decision = retry.failure();
                if decision.warn {
                    log_retry(&error, decision.delay);
                }
                if zc_jobs::retry::wait_or_shutdown(decision.delay, &mut shutdown).await {
                    return Ok(());
                }
            }
            Err(error) => return Err(error),
        }
    }
}

fn log_retry(error: &anyhow::Error, delay: Duration) {
    if let Some(pool) = error
        .chain()
        .find_map(|error| error.downcast_ref::<zc_database::PoolAcquireError>())
    {
        tracing::warn!(
            retry_ms = delay.as_millis(),
            stage = ?pool.last_connection_failure,
            category = ?pool.last_failure_category,
            host = pool.endpoint_host.as_deref().unwrap_or("unknown"),
            port = pool.endpoint_port.unwrap_or(0),
            "Server database unavailable; readiness will retry"
        );
    } else {
        tracing::warn!(
            retry_ms = delay.as_millis(),
            "Server database unavailable; readiness will retry"
        );
    }
}

pub async fn gate(
    State(readiness): State<DatabaseReadiness>,
    request: Request,
    next: axum::middleware::Next,
) -> Response {
    if readiness.is_ready() || available_while_degraded(request.uri().path()) {
        return next.run(request).await;
    }
    Problem::service_unavailable().into_response()
}

fn available_while_degraded(path: &str) -> bool {
    matches!(
        path,
        "/favicon.ico"
            | "/healthz"
            | "/readyz"
            | "/lobby"
            | "/lobby/events"
            | "/openapi"
            | "/openapi/json"
            | "/openapi/scalar.js"
            | "/turnstile/verify"
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        Router,
        body::{Body, to_bytes},
        http::{Request, StatusCode},
        middleware,
        routing::{get, post},
    };
    use tower::ServiceExt;

    #[test]
    fn degraded_allowlist_excludes_database_routes() {
        assert!(available_while_degraded("/healthz"));
        assert!(available_while_degraded("/readyz"));
        assert!(available_while_degraded("/openapi"));
        assert!(available_while_degraded("/lobby/events"));
        assert!(available_while_degraded("/turnstile/verify"));
        assert!(!available_while_degraded("/record/submit"));
        assert!(!available_while_degraded("/auth/login"));
        assert!(!available_while_degraded(
            "/discord-bot/guild-feeds/enabled"
        ));
    }

    #[test]
    fn readiness_reports_transitions() {
        let readiness = DatabaseReadiness::default();
        assert!(!readiness.is_ready());
        assert!(readiness.set(true));
        assert!(readiness.is_ready());
        assert!(!readiness.set(true));
        assert!(readiness.set(false));
    }

    #[tokio::test]
    async fn degraded_router_keeps_health_and_rejects_database_routes() {
        let readiness = DatabaseReadiness::default();
        let router = Router::new()
            .route("/healthz", get(|| async { StatusCode::OK }))
            .route("/record/submit", post(|| async { StatusCode::NO_CONTENT }))
            .layer(middleware::from_fn_with_state(readiness, gate));

        let health = router
            .clone()
            .oneshot(Request::get("/healthz").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(health.status(), StatusCode::OK);

        let database = router
            .oneshot(Request::post("/record/submit").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(database.status(), StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(
            database.headers()[axum::http::header::CONTENT_TYPE],
            "application/problem+json"
        );
        let body = to_bytes(database.into_body(), 64 * 1024).await.unwrap();
        assert_eq!(
            serde_json::from_slice::<serde_json::Value>(&body).unwrap(),
            serde_json::json!({
                "type": "about:blank",
                "title": "Service Unavailable",
                "status": 503,
                "detail": "Service unavailable"
            })
        );
    }
}
