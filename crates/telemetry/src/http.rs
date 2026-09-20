use axum::{
    extract::{MatchedPath, Request},
    http::{HeaderMap, Version},
    middleware::Next,
    response::Response,
};
use opentelemetry::{
    KeyValue, global,
    metrics::{Counter, Histogram, UpDownCounter},
    propagation::Extractor,
    trace::Status,
};
use std::{sync::OnceLock, time::Instant};
use tracing::{Instrument, Level};
use tracing_opentelemetry::OpenTelemetrySpanExt;

struct HttpMetrics {
    duration: Histogram<f64>,
    active: UpDownCounter<i64>,
    count: Counter<u64>,
}

static HTTP_METRICS: OnceLock<HttpMetrics> = OnceLock::new();

pub async fn track_request(request: Request, next: Next) -> Response {
    let method = request.method().to_string();
    let path = request.uri().path().to_owned();
    let route = request
        .extensions()
        .get::<MatchedPath>()
        .map(MatchedPath::as_str)
        .unwrap_or("unmatched")
        .to_owned();
    let protocol = protocol_version(request.version());
    let parent = global::get_text_map_propagator(|propagator| {
        propagator.extract(&HeaderExtractor(request.headers()))
    });
    let span = tracing::span!(
        Level::INFO,
        "http.server.request",
        otel.kind = "server",
        otel.name = tracing::field::Empty,
        otel.status_code = tracing::field::Empty,
        http.request.method = method,
        http.route = route,
        url.path = path,
        network.protocol.version = protocol,
        http.response.status_code = tracing::field::Empty,
        server.duration_ms = tracing::field::Empty,
    );
    let _ = span.set_parent(parent);
    span.record("otel.name", format_args!("{method} {route}"));

    let metrics = metrics();
    let active_attributes = [
        KeyValue::new("http.request.method", method.clone()),
        KeyValue::new("http.route", route.clone()),
    ];
    metrics.active.add(1, &active_attributes);
    let started = Instant::now();
    let response = next.run(request).instrument(span.clone()).await;
    let duration = started.elapsed();
    metrics.active.add(-1, &active_attributes);

    let status = response.status();
    let completed_attributes = [
        KeyValue::new("http.request.method", method),
        KeyValue::new("http.route", route),
        KeyValue::new(
            "http.response.status_class",
            format!("{}xx", status.as_u16() / 100),
        ),
    ];
    metrics
        .duration
        .record(duration.as_secs_f64(), &completed_attributes);
    metrics.count.add(1, &completed_attributes);
    span.record("http.response.status_code", status.as_u16());
    span.record("server.duration_ms", duration.as_secs_f64() * 1_000.0);
    if status.is_server_error() {
        span.set_status(Status::error(status.to_string()));
        span.record("otel.status_code", "ERROR");
        span.in_scope(|| {
            tracing::error!(
                http.response.status_code = status.as_u16(),
                server.duration_ms = duration.as_secs_f64() * 1_000.0,
                "HTTP request failed"
            );
        });
    } else {
        span.record("otel.status_code", "OK");
    }
    response
}

fn metrics() -> &'static HttpMetrics {
    HTTP_METRICS.get_or_init(|| {
        let meter = global::meter("zeepcentraal-http-server");
        HttpMetrics {
            duration: meter
                .f64_histogram("http.server.request.duration")
                .with_unit("s")
                .build(),
            active: meter
                .i64_up_down_counter("http.server.active_requests")
                .build(),
            count: meter.u64_counter("http.server.request.count").build(),
        }
    })
}

fn protocol_version(version: Version) -> &'static str {
    match version {
        Version::HTTP_09 => "0.9",
        Version::HTTP_10 => "1.0",
        Version::HTTP_11 => "1.1",
        Version::HTTP_2 => "2",
        Version::HTTP_3 => "3",
        _ => "unknown",
    }
}

struct HeaderExtractor<'a>(&'a HeaderMap);

impl Extractor for HeaderExtractor<'_> {
    fn get(&self, key: &str) -> Option<&str> {
        self.0.get(key).and_then(|value| value.to_str().ok())
    }

    fn keys(&self) -> Vec<&str> {
        self.0.keys().map(|key| key.as_str()).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{Router, body::Body, http::Request as HttpRequest, middleware, routing::get};
    use opentelemetry::{
        global,
        trace::{SpanId, TracerProvider as _},
    };
    use opentelemetry_sdk::{
        metrics::{InMemoryMetricExporter, PeriodicReader, SdkMeterProvider},
        propagation::TraceContextPropagator,
        trace::{InMemorySpanExporter, SdkTracerProvider},
    };
    use tower::ServiceExt;
    use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

    #[test]
    fn reports_protocol_versions() {
        assert_eq!(protocol_version(Version::HTTP_11), "1.1");
        assert_eq!(protocol_version(Version::HTTP_2), "2");
    }

    #[tokio::test]
    async fn exports_safe_success_and_failure_spans_and_metrics() {
        let span_exporter = InMemorySpanExporter::default();
        let tracer_provider = SdkTracerProvider::builder()
            .with_simple_exporter(span_exporter.clone())
            .build();
        let tracer = tracer_provider.tracer("http-test");
        let metric_exporter = InMemoryMetricExporter::default();
        let metric_provider = SdkMeterProvider::builder()
            .with_reader(PeriodicReader::builder(metric_exporter.clone()).build())
            .build();
        global::set_meter_provider(metric_provider.clone());
        global::set_text_map_propagator(TraceContextPropagator::new());
        let subscriber =
            tracing_subscriber::registry().with(tracing_opentelemetry::layer().with_tracer(tracer));
        let _subscriber = subscriber.set_default();
        let app = Router::new()
            .route("/ok/{id}", get(|| async { "ok" }))
            .route(
                "/fail",
                get(|| async { axum::http::StatusCode::INTERNAL_SERVER_ERROR }),
            )
            .layer(middleware::from_fn(track_request));

        let ok = HttpRequest::builder()
            .uri("/ok/42?token=super-secret")
            .header("authorization", "Bearer private")
            .header(
                "traceparent",
                "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
            )
            .body(Body::empty())
            .unwrap();
        assert_eq!(
            app.clone().oneshot(ok).await.unwrap().status(),
            axum::http::StatusCode::OK
        );
        assert_eq!(
            app.oneshot(
                HttpRequest::builder()
                    .uri("/fail")
                    .body(Body::empty())
                    .unwrap()
            )
            .await
            .unwrap()
            .status(),
            axum::http::StatusCode::INTERNAL_SERVER_ERROR
        );
        tracer_provider.force_flush().unwrap();
        metric_provider.force_flush().unwrap();

        let spans = span_exporter.get_finished_spans().unwrap();
        let requests = spans
            .iter()
            .filter(|span| span.name.starts_with("GET "))
            .collect::<Vec<_>>();
        assert_eq!(requests.len(), 2);
        let success = requests
            .iter()
            .find(|span| span.name == "GET /ok/{id}")
            .unwrap();
        assert_eq!(
            success.parent_span_id,
            SpanId::from_hex("00f067aa0ba902b7").unwrap()
        );
        let success_attributes = format!("{:?}", success.attributes);
        assert!(success_attributes.contains("url.path"));
        assert!(success_attributes.contains("/ok/42"));
        assert!(!success_attributes.contains("super-secret"));
        assert!(!success_attributes.contains("private"));
        let failure = requests
            .iter()
            .find(|span| span.name == "GET /fail")
            .unwrap();
        assert!(matches!(failure.status, Status::Error { .. }));

        let metrics = format!("{:?}", metric_exporter.get_finished_metrics().unwrap());
        assert!(metrics.contains("http.server.request.duration"));
        assert!(metrics.contains("http.server.active_requests"));
        assert!(metrics.contains("http.server.request.count"));
        assert!(metrics.contains("/ok/{id}"));
        assert!(metrics.contains("2xx"));
        assert!(metrics.contains("5xx"));
    }
}
