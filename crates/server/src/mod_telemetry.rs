use axum::{
    extract::{MatchedPath, Request},
    http::Method,
    middleware::Next,
    response::Response,
};
use std::cell::Cell;

struct RequestContext {
    span: tracing::Span,
    gtr: Cell<bool>,
}

tokio::task_local! {
    static REQUEST_CONTEXT: RequestContext;
}

pub async fn track_request(request: Request, next: Next) -> Response {
    let gtr = request.method() == Method::POST
        && request
            .extensions()
            .get::<MatchedPath>()
            .is_some_and(|path| {
                matches!(
                    path.as_str(),
                    "/auth/login"
                        | "/auth/refresh"
                        | "/level/request"
                        | "/record/submit"
                        | "/user/updateSteamName"
                )
            });
    REQUEST_CONTEXT
        .scope(
            RequestContext {
                span: tracing::Span::current(),
                gtr: Cell::new(gtr),
            },
            next.run(request),
        )
        .await
}

pub fn mark_gtr() {
    let _ = REQUEST_CONTEXT.try_with(|context| context.gtr.set(true));
}

pub fn record_outdated(outdated: bool) {
    let _ = REQUEST_CONTEXT.try_with(|context| {
        context.span.record("mod.outdated", outdated);
    });
}

pub fn record_error_code(code: &serde_json::Value) {
    let _ = REQUEST_CONTEXT.try_with(|context| {
        if context.gtr.get() {
            if let Some(code) = code.as_i64() {
                context.span.record("mod.errorCode", code);
            } else if let Some(code) = code.as_u64() {
                context.span.record("mod.errorCode", code);
            } else if let Some(code) = code.as_f64() {
                context.span.record("mod.errorCode", code);
            } else if let Some(code) = code.as_str() {
                context.span.record("mod.errorCode", code);
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::problem::Problem;
    use axum::{
        Router, body::Body, http::StatusCode, middleware, response::IntoResponse, routing::post,
    };
    use opentelemetry::{KeyValue, trace::TracerProvider as _};
    use opentelemetry_sdk::trace::{InMemorySpanExporter, SdkTracerProvider};
    use tower::ServiceExt;
    use tracing::Instrument;
    use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

    #[tokio::test]
    async fn exports_outcomes_on_request_span_without_leaking_between_requests() {
        let exporter = InMemorySpanExporter::default();
        let provider = SdkTracerProvider::builder()
            .with_simple_exporter(exporter.clone())
            .build();
        let _subscriber = tracing_subscriber::registry()
            .with(tracing_opentelemetry::layer().with_tracer(provider.tracer("mod-test")))
            .set_default();
        let app = Router::new()
            .route(
                "/auth/login",
                post(|| async {
                    async {
                        record_outdated(false);
                        tokio::task::yield_now().await;
                        Problem {
                            status: StatusCode::BAD_REQUEST,
                            detail: "test".into(),
                            error_code: Some("test_code".into()),
                        }
                    }
                    .instrument(tracing::info_span!("child"))
                    .await
                }),
            )
            .route(
                "/auth/refresh",
                post(|| async {
                    tokio::task::yield_now().await;
                    record_outdated(true);
                    Problem::code(StatusCode::BAD_REQUEST, 9)
                }),
            )
            .route(
                "/shared",
                post(|| async {
                    tokio::task::yield_now().await;
                    Problem::code(StatusCode::BAD_REQUEST, 16)
                }),
            )
            .route(
                "/gtr-shared",
                post(|| async {
                    mark_gtr();
                    tokio::task::yield_now().await;
                    Problem::code(StatusCode::BAD_REQUEST, 16)
                }),
            )
            .route(
                "/level/request",
                post(|| async { Problem::service_unavailable() }),
            )
            .layer(middleware::from_fn(track_request))
            .layer(middleware::from_fn(zc_telemetry::http::track_request));
        let request = |path| {
            app.clone().oneshot(
                Request::builder()
                    .method("POST")
                    .uri(path)
                    .body(Body::empty())
                    .unwrap(),
            )
        };
        let (login, refresh, shared, gtr_shared, missing) = tokio::join!(
            request("/auth/login"),
            request("/auth/refresh"),
            request("/shared"),
            request("/gtr-shared"),
            request("/level/request")
        );
        assert_eq!(login.unwrap().status(), StatusCode::BAD_REQUEST);
        assert_eq!(refresh.unwrap().status(), StatusCode::BAD_REQUEST);
        assert_eq!(shared.unwrap().status(), StatusCode::BAD_REQUEST);
        assert_eq!(gtr_shared.unwrap().status(), StatusCode::BAD_REQUEST);
        assert_eq!(missing.unwrap().status(), StatusCode::SERVICE_UNAVAILABLE);
        provider.force_flush().unwrap();
        let spans = exporter.get_finished_spans().unwrap();
        let attributes = |name| {
            &spans
                .iter()
                .find(|span| span.name == name)
                .unwrap()
                .attributes
        };
        assert!(attributes("POST /auth/login").contains(&KeyValue::new("mod.outdated", false)));
        assert!(
            attributes("POST /auth/login").contains(&KeyValue::new("mod.errorCode", "test_code"))
        );
        assert!(attributes("POST /auth/refresh").contains(&KeyValue::new("mod.outdated", true)));
        assert!(attributes("POST /auth/refresh").contains(&KeyValue::new("mod.errorCode", 9_i64)));
        assert!(attributes("POST /gtr-shared").contains(&KeyValue::new("mod.errorCode", 16_i64)));
        for name in ["POST /shared", "POST /level/request", "child"] {
            assert!(
                !attributes(name)
                    .iter()
                    .any(|attribute| attribute.key.as_str().starts_with("mod."))
            );
        }
        assert!(
            !attributes("POST /gtr-shared")
                .iter()
                .any(|attribute| attribute.key.as_str() == "mod.outdated")
        );
        // Direct calls without HTTP request context remain safe.
        mark_gtr();
        record_outdated(true);
        record_error_code(&9.into());
        let _ = Problem::code(StatusCode::BAD_REQUEST, 9).into_response();
    }
}
