use anyhow::Result;
use opentelemetry_proto::tonic::collector::{
    logs::v1::{
        ExportLogsServiceRequest, ExportLogsServiceResponse, logs_service_server::LogsService,
    },
    metrics::v1::{
        ExportMetricsServiceRequest, ExportMetricsServiceResponse,
        metrics_service_server::MetricsService,
    },
    trace::v1::{
        ExportTraceServiceRequest, ExportTraceServiceResponse, trace_service_server::TraceService,
    },
};
use std::sync::{
    Arc, Mutex,
    atomic::{AtomicBool, Ordering},
};
use tonic::{Request, Response, Status};

#[derive(Default)]
pub struct Captured {
    pub traces: Vec<ExportTraceServiceRequest>,
    pub metrics: Vec<ExportMetricsServiceRequest>,
    pub logs: Vec<ExportLogsServiceRequest>,
}

#[derive(Clone, Default)]
pub struct Collector {
    pub captured: Arc<Mutex<Captured>>,
    pub reject_traces: Arc<AtomicBool>,
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
