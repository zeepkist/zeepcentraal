use anyhow::Result;
use opentelemetry_proto::tonic::{
    collector::{
        logs::v1::{
            ExportLogsServiceRequest, ExportLogsServiceResponse,
            logs_service_server::{LogsService, LogsServiceServer},
        },
        metrics::v1::{
            ExportMetricsServiceRequest, ExportMetricsServiceResponse,
            metrics_service_server::{MetricsService, MetricsServiceServer},
        },
        trace::v1::{
            ExportTraceServiceRequest, ExportTraceServiceResponse,
            trace_service_server::{TraceService, TraceServiceServer},
        },
    },
    common::v1::any_value::Value,
    resource::v1::Resource,
};
use std::sync::{
    Arc, Mutex,
    atomic::{AtomicBool, Ordering},
};
use tokio_stream::wrappers::TcpListenerStream;
use tonic::{Request, Response, Status, transport::Server};

#[derive(Default)]
struct Captured {
    traces: Vec<ExportTraceServiceRequest>,
    metrics: Vec<ExportMetricsServiceRequest>,
    logs: Vec<ExportLogsServiceRequest>,
}

#[derive(Clone, Default)]
struct Collector {
    captured: Arc<Mutex<Captured>>,
    reject_traces: Arc<AtomicBool>,
}

#[tonic::async_trait]
impl TraceService for Collector {
    async fn export(
        &self,
        request: Request<ExportTraceServiceRequest>,
    ) -> Result<Response<ExportTraceServiceResponse>, Status> {
        if self.reject_traces.load(Ordering::Relaxed) {
            return Err(Status::unavailable("test trace receiver unavailable"));
        }
        self.captured
            .lock()
            .unwrap()
            .traces
            .push(request.into_inner());
        Ok(Response::new(ExportTraceServiceResponse::default()))
    }
}

#[tonic::async_trait]
impl MetricsService for Collector {
    async fn export(
        &self,
        request: Request<ExportMetricsServiceRequest>,
    ) -> Result<Response<ExportMetricsServiceResponse>, Status> {
        self.captured
            .lock()
            .unwrap()
            .metrics
            .push(request.into_inner());
        Ok(Response::new(ExportMetricsServiceResponse::default()))
    }
}

#[tonic::async_trait]
impl LogsService for Collector {
    async fn export(
        &self,
        request: Request<ExportLogsServiceRequest>,
    ) -> Result<Response<ExportLogsServiceResponse>, Status> {
        self.captured
            .lock()
            .unwrap()
            .logs
            .push(request.into_inner());
        Ok(Response::new(ExportLogsServiceResponse::default()))
    }
}

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
    let telemetry = zc_telemetry::initialize("server")?;
    zc_telemetry::observe_operation("test.operation", async { Ok::<(), anyhow::Error>(()) })
        .await?;
    tracing::error!("OTLP receiver test error event");
    telemetry.force_flush().await?;

    {
        let captured = collector.captured.lock().unwrap();
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
        assert!(metric_names.contains(&"zc.service.startups"));
        assert!(metric_names.contains(&"zc.service.operation.count"));
        let severities = captured
            .logs
            .iter()
            .flat_map(|request| &request.resource_logs)
            .filter(|resource| has_service_name(resource.resource.as_ref()))
            .flat_map(|resource| &resource.scope_logs)
            .flat_map(|scope| &scope.log_records)
            .map(|log| log.severity_text.as_str())
            .collect::<Vec<_>>();
        assert!(severities.contains(&"INFO"), "{severities:?}");
        assert!(severities.contains(&"ERROR"), "{severities:?}");
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
