//! Instrumentation primitives. SDK providers remain owned by zc-telemetry.
use opentelemetry::{KeyValue, global, propagation::Injector, trace::TraceContextExt};
use std::{collections::HashMap, sync::OnceLock, time::Instant};
use tracing::Instrument;
use tracing_opentelemetry::OpenTelemetrySpanExt;

pub fn trace_carrier() -> HashMap<String, String> {
    let context = tracing::Span::current().context();
    let mut carrier = HashMap::new();
    global::get_text_map_propagator(|p| p.inject_context(&context, &mut carrier));
    carrier.retain(|key, _| matches!(key.as_str(), "traceparent" | "tracestate"));
    carrier
}

pub fn remote_context(
    traceparent: Option<&str>,
    tracestate: Option<&str>,
) -> opentelemetry::Context {
    let mut carrier = HashMap::new();
    if let Some(value) = traceparent.filter(|v| v.len() <= 512) {
        carrier.insert("traceparent".into(), value.into());
    }
    if let Some(value) = tracestate.filter(|v| v.len() <= 512) {
        carrier.insert("tracestate".into(), value.into());
    }
    let context = global::get_text_map_propagator(|p| {
        p.extract_with_context(&opentelemetry::Context::new(), &carrier)
    });
    if context.span().span_context().is_valid() {
        context
    } else {
        opentelemetry::Context::new()
    }
}

struct HeaderInjector<'a>(&'a mut reqwest::header::HeaderMap);
impl Injector for HeaderInjector<'_> {
    fn set(&mut self, key: &str, value: String) {
        if matches!(key, "traceparent" | "tracestate")
            && let (Ok(key), Ok(value)) = (
                reqwest::header::HeaderName::from_bytes(key.as_bytes()),
                value.parse(),
            )
        {
            self.0.insert(key, value);
        }
    }
}

struct HttpObservation {
    span: tracing::Span,
    started: Instant,
    attributes: Vec<KeyValue>,
    completed: bool,
}
impl Drop for HttpObservation {
    fn drop(&mut self) {
        if !self.completed {
            self.span.record("otel.status_code", "ERROR");
            self.span.record("error.type", "cancelled");
            self.attributes
                .push(KeyValue::new("error.type", "cancelled"));
        }
        static DURATION: OnceLock<opentelemetry::metrics::Histogram<f64>> = OnceLock::new();
        DURATION
            .get_or_init(|| {
                global::meter("zeepcentraal-http-client")
                    .f64_histogram("http.client.request.duration")
                    .with_unit("s")
                    .build()
            })
            .record(self.started.elapsed().as_secs_f64(), &self.attributes);
    }
}

pub trait TracedRequest {
    fn send_traced(
        self,
    ) -> impl std::future::Future<Output = Result<reqwest::Response, reqwest::Error>> + Send;
}

impl TracedRequest for reqwest::RequestBuilder {
    async fn send_traced(self) -> Result<reqwest::Response, reqwest::Error> {
        let (client, request) = self.build_split();
        let mut request = request?;
        let method = request.method().to_string();
        let host = request.url().host_str().unwrap_or("unknown").to_owned();
        let port = request.url().port_or_known_default().unwrap_or(0);
        let span = tracing::info_span!("http.client.request", otel.kind = "client",
            otel.name = %format!("{} {}", method, host),
            http.request.method = %method, server.address = %host, server.port = port,
            http.response.status_code = tracing::field::Empty,
            otel.status_code = tracing::field::Empty, error.type = tracing::field::Empty);
        global::get_text_map_propagator(|p| {
            p.inject_context(&span.context(), &mut HeaderInjector(request.headers_mut()))
        });
        let mut observation = HttpObservation {
            span: span.clone(),
            started: Instant::now(),
            completed: false,
            attributes: vec![
                KeyValue::new("http.request.method", method),
                KeyValue::new("server.address", host),
            ],
        };
        let result = client.execute(request).instrument(span.clone()).await;
        observation.completed = true;
        match &result {
            Ok(response) => {
                let status = response.status().as_u16();
                span.record("http.response.status_code", status);
                observation.attributes.push(KeyValue::new(
                    "http.response.status_code",
                    i64::from(status),
                ));
                if status >= 400 {
                    span.record("otel.status_code", "ERROR");
                    span.record("error.type", "http.response");
                }
            }
            Err(error) => {
                let category = if error.is_timeout() {
                    "timeout"
                } else if error.is_connect() {
                    "connect"
                } else {
                    "transport"
                };
                span.record("otel.status_code", "ERROR");
                span.record("error.type", category);
                observation
                    .attributes
                    .push(KeyValue::new("error.type", category));
            }
        }
        result
    }
}
