use anyhow::{Context, Result};
use opentelemetry::{KeyValue, global, trace::TracerProvider as _};
use opentelemetry_appender_tracing::layer::OpenTelemetryTracingBridge;
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::{
    Resource,
    logs::{BatchLogProcessor, SdkLoggerProvider},
    metrics::{PeriodicReader, SdkMeterProvider},
    trace::SdkTracerProvider,
};
use std::time::Duration;
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};

pub struct TelemetryGuard {
    logger: Option<SdkLoggerProvider>,
    meter: Option<SdkMeterProvider>,
    tracer: Option<SdkTracerProvider>,
}

impl TelemetryGuard {
    pub async fn shutdown(mut self) -> Result<()> {
        if let Some(provider) = self.logger.take() {
            provider
                .shutdown()
                .context("Failed to shut down OTLP logs")?;
        }
        if let Some(provider) = self.meter.take() {
            provider
                .shutdown()
                .context("Failed to shut down OTLP metrics")?;
        }
        if let Some(provider) = self.tracer.take() {
            provider
                .shutdown()
                .context("Failed to shut down OTLP traces")?;
        }
        Ok(())
    }
}

pub fn initialize(package: &str) -> Result<TelemetryGuard> {
    let default = format!("zeepcentraal_{package}=info,tower_http=info");
    let filter = zc_core::environment::var("RUST_LOG")
        .ok()
        .and_then(|value| EnvFilter::try_new(value).ok())
        .unwrap_or_else(|| EnvFilter::new(default));
    let endpoint = zc_core::environment::var("OTEL_EXPORTER_OTLP_ENDPOINT")
        .or_else(|_| zc_core::environment::var("OPENTELEMETRY_COLLECTOR_URL"))
        .unwrap_or_else(|_| "http://localhost:4317".to_owned());
    let resource = resource(package);

    let span_exporter = opentelemetry_otlp::SpanExporter::builder()
        .with_tonic()
        .with_endpoint(&endpoint)
        .with_timeout(Duration::from_secs(5))
        .build()
        .context("Failed to build OTLP trace exporter")?;
    let tracer_provider = SdkTracerProvider::builder()
        .with_resource(resource.clone())
        .with_batch_exporter(span_exporter)
        .build();
    let tracer = tracer_provider.tracer(format!("zeepcentraal-{package}"));

    let metric_exporter = opentelemetry_otlp::MetricExporter::builder()
        .with_tonic()
        .with_endpoint(&endpoint)
        .with_timeout(Duration::from_secs(5))
        .build()
        .context("Failed to build OTLP metric exporter")?;
    let reader = PeriodicReader::builder(metric_exporter)
        .with_interval(Duration::from_secs(10))
        .build();
    let meter_provider = SdkMeterProvider::builder()
        .with_resource(resource.clone())
        .with_reader(reader)
        .build();
    global::set_meter_provider(meter_provider.clone());

    let log_exporter = opentelemetry_otlp::LogExporter::builder()
        .with_tonic()
        .with_endpoint(&endpoint)
        .with_timeout(Duration::from_secs(5))
        .build()
        .context("Failed to build OTLP log exporter")?;
    let log_processor = BatchLogProcessor::builder(log_exporter).build();
    let logger_provider = SdkLoggerProvider::builder()
        .with_resource(resource)
        .with_log_processor(log_processor)
        .build();

    tracing_subscriber::registry()
        .with(filter)
        .with(tracing_subscriber::fmt::layer().json())
        .with(tracing_opentelemetry::layer().with_tracer(tracer))
        .with(OpenTelemetryTracingBridge::new(&logger_provider))
        .try_init()
        .context("Tracing subscriber is already initialized")?;

    Ok(TelemetryGuard {
        logger: Some(logger_provider),
        meter: Some(meter_provider),
        tracer: Some(tracer_provider),
    })
}

fn resource(package: &str) -> Resource {
    let environment =
        zc_core::environment::var("NODE_ENV").unwrap_or_else(|_| "development".to_owned());
    let mut attributes = vec![
        KeyValue::new("service.name", service_name(package)),
        KeyValue::new("deployment.environment", environment),
    ];
    if let Ok(version) = zc_core::environment::var("OTEL_SERVICE_VERSION")
        .or_else(|_| zc_core::environment::var("OPENTELEMETRY_SERVICE_VERSION"))
        && !version.is_empty()
    {
        attributes.push(KeyValue::new("service.version", version));
    }
    Resource::builder().with_attributes(attributes).build()
}

pub fn service_name(package: &str) -> String {
    zc_core::environment::var("OTEL_SERVICE_NAME")
        .or_else(|_| zc_core::environment::var("OPENTELEMETRY_SERVICE_NAME"))
        .unwrap_or_else(|_| format!("zeepcentraal-{package}-dev"))
}

#[cfg(test)]
mod tests {
    #[test]
    fn default_service_name_matches_node_runtime() {
        assert_eq!(super::service_name("jobs"), "zeepcentraal-jobs-dev");
    }
}
