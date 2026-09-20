use anyhow::Result;
use axum::{Router, body::Body, http::Request, middleware, routing::get};
use tower::ServiceExt;

#[tokio::test]
#[ignore = "exports live telemetry to configured OTLP collector"]
async fn exports_success_failure_and_metrics_to_live_collector() -> Result<()> {
    zc_core::environment::initialize()?;
    let telemetry = zc_telemetry::initialize("server")?;
    let app = Router::new()
        .route("/telemetry/success", get(|| async { "ok" }))
        .route(
            "/telemetry/failure",
            get(|| async { axum::http::StatusCode::INTERNAL_SERVER_ERROR }),
        )
        .layer(middleware::from_fn(zc_telemetry::http::track_request));
    for path in ["/telemetry/success", "/telemetry/failure"] {
        let _ = app
            .clone()
            .oneshot(Request::builder().uri(path).body(Body::empty())?)
            .await?;
    }
    telemetry.force_flush().await?;
    telemetry.shutdown().await
}
