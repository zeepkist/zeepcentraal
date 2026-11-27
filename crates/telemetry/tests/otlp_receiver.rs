use anyhow::Result;
use opentelemetry_proto::tonic::{
    collector::{
        logs::v1::logs_service_server::LogsServiceServer,
        metrics::v1::metrics_service_server::MetricsServiceServer,
        trace::v1::trace_service_server::TraceServiceServer,
    },
    common::v1::any_value::Value,
    resource::v1::Resource,
    trace::v1::status::StatusCode,
};
use std::future::IntoFuture;
use std::sync::atomic::Ordering;
use tokio_stream::wrappers::TcpListenerStream;
use tonic::transport::Server;
#[path = "support/collector.rs"]
mod collector;
use collector::Collector;

fn has_service_name(resource: Option<&Resource>) -> bool {
    resource.is_some_and(|resource| {
        resource.attributes.iter().any(|attribute| {
            attribute.key == "service.name"
                && matches!(
                    attribute.value.as_ref().and_then(|value| value.value.as_ref()),
                    Some(Value::StringValue(value)) if value == "zc-telemetry-test"
                )
        })
    })
}

#[tokio::test]
async fn exports_nonempty_signals_and_reports_receiver_failures() -> Result<()> {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
    let endpoint = format!("http://{}", listener.local_addr()?);
    let collector = Collector::default();
    let server = tokio::spawn(
        Server::builder()
            .add_service(TraceServiceServer::new(collector.clone()))
            .add_service(MetricsServiceServer::new(collector.clone()))
            .add_service(LogsServiceServer::new(collector.clone()))
            .serve_with_incoming(TcpListenerStream::new(listener)),
    );

    // This integration test has its own process, so these values cannot affect other test binaries.
    unsafe {
        std::env::set_var("OTEL_EXPORTER_OTLP_ENDPOINT", endpoint);
        std::env::set_var("OTEL_SERVICE_NAME", "zc-telemetry-test");
        std::env::set_var("OTEL_SDK_DISABLED", "false");
        std::env::remove_var("RUST_LOG");
    }
    zc_core::environment::initialize()?;
    let telemetry = zc_telemetry::initialize("lobby-host")?;
    zc_telemetry::observe_operation("test.operation", async { Ok::<(), anyhow::Error>(()) })
        .await?;
    zc_telemetry::observe_operation("prepareZslWarmupPlaylist", async {
        Ok::<(), anyhow::Error>(())
    })
    .await?;
    let error = zc_telemetry::observe_operation("test.error", async {
        Err::<(), _>(anyhow::anyhow!("test operation failed"))
    })
    .await
    .unwrap_err();
    assert_eq!(error.to_string(), "test operation failed");
    // Exercise actual HTTP transport and middleware, including timeout and cancellation.
    use zc_core::telemetry::TracedRequest;
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
    let destination = format!("http://{}", listener.local_addr()?);
    let http = tokio::spawn(
        axum::serve(
            listener,
            axum::Router::new()
                .route("/ok", axum::routing::get(|| async { "ok" }))
                .route(
                    "/error",
                    axum::routing::get(|| async { axum::http::StatusCode::INTERNAL_SERVER_ERROR }),
                )
                .route(
                    "/slow",
                    axum::routing::get(|| async {
                        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
                        "ok"
                    }),
                )
                .route(
                    "/redirect",
                    axum::routing::get(|| async { axum::response::Redirect::temporary("/ok") }),
                )
                .layer(axum::middleware::from_fn(zc_telemetry::http::track_request)),
        )
        .into_future(),
    );
    let client = reqwest::Client::new();
    zc_telemetry::observe_operation("test.http.parent", async {
        let response = client
            .get(format!("{destination}/ok?token=private-token"))
            .send_traced()
            .await?;
        assert_eq!(response.text().await?, "ok");
        assert_eq!(
            client
                .get(format!("{destination}/error"))
                .send_traced()
                .await?
                .status()
                .as_u16(),
            500
        );
        assert_eq!(
            client
                .get(format!("{destination}/redirect"))
                .send_traced()
                .await?
                .text()
                .await?,
            "ok"
        );
        assert!(
            client
                .get(format!("{destination}/slow"))
                .timeout(std::time::Duration::from_millis(10))
                .send_traced()
                .await
                .unwrap_err()
                .is_timeout()
        );
        assert!(
            tokio::time::timeout(
                std::time::Duration::from_millis(10),
                client.get(format!("{destination}/slow")).send_traced()
            )
            .await
            .is_err()
        );
        Ok::<_, anyhow::Error>(())
    })
    .await?;
    http.abort();
    tracing::info!(target: "zc_telemetry::test", "Local routine log");
    tracing::info!(target: "zc_lobby_host::runtime", "Local lobby runtime log");
    tracing::info!(
        target: "zc_lobby_host::chat::audit",
        { room.key = "totw", room.profile = "track-tournament.weekly" },
        "[chat] [totw] Player: hello"
    );
    tracing::error!("OTLP receiver test error event");
    telemetry.force_flush().await?;

    {
        let captured = collector.captured.lock().unwrap();
        let spans = captured
            .traces
            .iter()
            .flat_map(|request| &request.resource_spans)
            .filter(|resource| has_service_name(resource.resource.as_ref()))
            .flat_map(|resource| &resource.scope_spans)
            .flat_map(|scope| &scope.spans)
            .collect::<Vec<_>>();
        for name in ["test.operation", "prepareZslWarmupPlaylist", "test.error"] {
            let matching = spans
                .iter()
                .filter(|span| span.name == name)
                .collect::<Vec<_>>();
            assert_eq!(matching.len(), 1, "expected one span named {name}");
            let span = matching[0];
            assert!(span.attributes.iter().any(|attribute| {
                attribute.key == "operation"
                    && matches!(
                        attribute.value.as_ref().and_then(|value| value.value.as_ref()),
                        Some(Value::StringValue(value)) if value == name
                    )
            }));
            if name == "test.error" {
                assert_eq!(span.status.as_ref().unwrap().code, StatusCode::Error as i32);
            }
        }
        let client_spans: Vec<_> = spans.iter().filter(|s| s.kind == 3).collect();
        assert_eq!(client_spans.len(), 5);
        let parent = spans.iter().find(|s| s.name == "test.http.parent").unwrap();
        assert!(
            client_spans
                .iter()
                .all(|s| s.trace_id == parent.trace_id && s.parent_span_id == parent.span_id)
        );
        let successful_server = spans.iter().find(|s| s.name == "GET /ok").unwrap();
        assert!(
            client_spans
                .iter()
                .any(|s| s.span_id == successful_server.parent_span_id
                    && s.trace_id == successful_server.trace_id)
        );
        for error in ["timeout", "cancelled"] {
            assert!(client_spans.iter().any(|s| s.attributes.iter().any(|a|a.key == "error.type" && matches!(a.value.as_ref().and_then(|v|v.value.as_ref()),Some(Value::StringValue(value)) if value == error))));
        }
        assert!(!format!("{client_spans:?}").contains("private-token"));
        assert!(spans.iter().all(|span| span.name != "service.operation"));
        assert!(
            captured
                .traces
                .iter()
                .any(|request| request
                    .resource_spans
                    .iter()
                    .any(|resource| has_service_name(resource.resource.as_ref())
                        && resource
                            .scope_spans
                            .iter()
                            .any(|scope| !scope.spans.is_empty())))
        );
        let metric_names = captured
            .metrics
            .iter()
            .flat_map(|request| &request.resource_metrics)
            .filter(|resource| has_service_name(resource.resource.as_ref()))
            .flat_map(|resource| &resource.scope_metrics)
            .flat_map(|scope| &scope.metrics)
            .map(|metric| metric.name.as_str())
            .collect::<Vec<_>>();
        assert!(metric_names.contains(&"http.client.request.duration"));
        assert!(metric_names.contains(&"zc.service.startups"));
        assert!(metric_names.contains(&"zc.service.operation.count"));
        let logs = captured
            .logs
            .iter()
            .flat_map(|request| &request.resource_logs)
            .filter(|resource| has_service_name(resource.resource.as_ref()))
            .flat_map(|resource| &resource.scope_logs)
            .flat_map(|scope| &scope.log_records)
            .collect::<Vec<_>>();
        let info_logs: Vec<_> = logs
            .iter()
            .filter(|log| log.severity_text == "INFO")
            .filter_map(|log| match log.body.as_ref()?.value.as_ref()? {
                Value::StringValue(body) => Some((body.as_str(), &log.attributes)),
                _ => None,
            })
            .collect();
        assert_eq!(info_logs.len(), 2);
        assert!(
            info_logs
                .iter()
                .any(|(body, _)| *body == "OpenTelemetry startup canary")
        );
        let (_, attributes) = info_logs
            .iter()
            .find(|(body, _)| *body == "[chat] [totw] Player: hello")
            .expect("lobby chat audit reaches OTLP");
        for (key, value) in [
            ("room.key", "totw"),
            ("room.profile", "track-tournament.weekly"),
        ] {
            assert!(attributes.iter().any(|attribute| {
                attribute.key == key
                    && matches!(
                        attribute.value.as_ref().and_then(|value| value.value.as_ref()),
                        Some(Value::StringValue(actual)) if actual == value
                    )
            }));
        }
        for span in &spans {
            assert!(!span.attributes.iter().any(|attribute| {
                let key = attribute.key.as_str();
                key.starts_with("code.")
                    || key.starts_with("thread.")
                    || matches!(key, "busy_ns" | "idle_ns" | "url.path")
            }));
            assert!(span.events.len() <= 1);
        }
        assert!(logs.iter().any(|log| log.severity_text == "ERROR"));
    }

    collector.reject_traces.store(true, Ordering::Relaxed);
    zc_telemetry::observe_operation("test.failure", async { Ok::<(), anyhow::Error>(()) }).await?;
    let error = telemetry.force_flush().await.unwrap_err();
    assert!(error.to_string().contains("traces:"), "{error}");
    zc_telemetry::observe_operation("test.shutdown", async { Ok::<(), anyhow::Error>(()) }).await?;
    // Collector outages remain observable locally but never fail service shutdown.
    telemetry.shutdown().await?;
    server.abort();
    Ok(())
}
