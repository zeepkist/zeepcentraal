pub mod http;

use anyhow::{Context, Result, ensure};
use opentelemetry::{KeyValue, global, trace::TracerProvider as _};
use opentelemetry_appender_tracing::layer::OpenTelemetryTracingBridge;
use opentelemetry_otlp::{WithExportConfig, WithTonicConfig};
use opentelemetry_sdk::{
    Resource,
    logs::{BatchLogProcessor, SdkLoggerProvider},
    metrics::{PeriodicReader, SdkMeterProvider},
    propagation::TraceContextPropagator,
    trace::SdkTracerProvider,
};
use std::time::Duration;
use tonic::transport::ClientTlsConfig;
use tracing_subscriber::{
    EnvFilter,
    filter::filter_fn,
    layer::{Layer, SubscriberExt},
    util::SubscriberInitExt,
};
use url::Url;

const EXPORT_TIMEOUT: Duration = Duration::from_secs(5);

pub struct TelemetryGuard {
    logger: Option<SdkLoggerProvider>,
    meter: Option<SdkMeterProvider>,
    tracer: Option<SdkTracerProvider>,
    canary: tokio::sync::Mutex<Option<tokio::task::JoinHandle<()>>>,
}

impl TelemetryGuard {
    pub async fn force_flush(&self) -> Result<()> {
        if let Some(canary) = self.canary.lock().await.take() {
            canary.await.context("OTLP startup canary task failed")?;
        }
        let logger = self.logger.clone();
        let meter = self.meter.clone();
        let tracer = self.tracer.clone();
        tokio::task::spawn_blocking(move || {
            flush_providers(logger.as_ref(), meter.as_ref(), tracer.as_ref())
        })
        .await
        .context("OTLP flush task failed")?
    }

    pub async fn shutdown(mut self) -> Result<()> {
        if let Err(error) = self.force_flush().await {
            tracing::warn!(target: "zc_telemetry::export", %error, "OTLP flush failed during shutdown");
        }
        let logger = self.logger.take();
        let meter = self.meter.take();
        let tracer = self.tracer.take();
        tokio::task::spawn_blocking(move || shutdown_providers(logger, meter, tracer))
            .await
            .context("OTLP shutdown task failed")?
    }
}

fn flush_providers(
    logger: Option<&SdkLoggerProvider>,
    meter: Option<&SdkMeterProvider>,
    tracer: Option<&SdkTracerProvider>,
) -> Result<()> {
    let mut failures = Vec::new();
    if let Some(provider) = logger
        && let Err(error) = provider.force_flush()
    {
        failures.push(format!("logs: {error}"));
    }
    if let Some(provider) = meter
        && let Err(error) = provider.force_flush()
    {
        failures.push(format!("metrics: {error}"));
    }
    if let Some(provider) = tracer
        && let Err(error) = provider.force_flush()
    {
        failures.push(format!("traces: {error}"));
    }
    ensure!(failures.is_empty(), "{}", failures.join("; "));
    Ok(())
}

fn shutdown_providers(
    logger: Option<SdkLoggerProvider>,
    meter: Option<SdkMeterProvider>,
    tracer: Option<SdkTracerProvider>,
) -> Result<()> {
    let mut failures = Vec::new();
    if let Some(provider) = logger
        && let Err(error) = provider.shutdown()
    {
        failures.push(format!("logs: {error}"));
    }
    if let Some(provider) = meter
        && let Err(error) = provider.shutdown()
    {
        failures.push(format!("metrics: {error}"));
    }
    if let Some(provider) = tracer
        && let Err(error) = provider.shutdown()
    {
        failures.push(format!("traces: {error}"));
    }
    ensure!(failures.is_empty(), "{}", failures.join("; "));
    Ok(())
}

pub fn initialize(package: &str) -> Result<TelemetryGuard> {
    global::set_text_map_propagator(TraceContextPropagator::new());
    let filter = tracing_filter(package)?;
    if sdk_disabled() {
        tracing_subscriber::registry()
            .with(filter)
            .with(tracing_subscriber::fmt::layer().json())
            .try_init()
            .context("Tracing subscriber is already initialized")?;
        return Ok(TelemetryGuard {
            logger: None,
            meter: None,
            tracer: None,
            canary: tokio::sync::Mutex::new(None),
        });
    }

    let endpoint = endpoint()?;
    let tls = (endpoint.scheme() == "https").then(|| ClientTlsConfig::new().with_webpki_roots());
    let endpoint_string = endpoint.to_string();
    let resource = resource(package);

    let mut span_builder = opentelemetry_otlp::SpanExporter::builder()
        .with_tonic()
        .with_endpoint(&endpoint_string)
        .with_timeout(EXPORT_TIMEOUT);
    if let Some(tls) = &tls {
        span_builder = span_builder.with_tls_config(tls.clone());
    }
    let span_exporter = span_builder
        .build()
        .context("Failed to build OTLP trace exporter")?;
    let tracer_provider = SdkTracerProvider::builder()
        .with_resource(resource.clone())
        .with_batch_exporter(span_exporter)
        .build();
    let tracer = tracer_provider.tracer(format!("zeepcentraal-{package}"));

    let mut metric_builder = opentelemetry_otlp::MetricExporter::builder()
        .with_tonic()
        .with_endpoint(&endpoint_string)
        .with_timeout(EXPORT_TIMEOUT);
    if let Some(tls) = &tls {
        metric_builder = metric_builder.with_tls_config(tls.clone());
    }
    let metric_exporter = metric_builder
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

    let mut log_builder = opentelemetry_otlp::LogExporter::builder()
        .with_tonic()
        .with_endpoint(&endpoint_string)
        .with_timeout(EXPORT_TIMEOUT);
    if let Some(tls) = &tls {
        log_builder = log_builder.with_tls_config(tls.clone());
    }
    let log_exporter = log_builder
        .build()
        .context("Failed to build OTLP log exporter")?;
    let log_processor = BatchLogProcessor::builder(log_exporter).build();
    let logger_provider = SdkLoggerProvider::builder()
        .with_resource(resource)
        .with_log_processor(log_processor)
        .build();
    let log_bridge =
        OpenTelemetryTracingBridge::new(&logger_provider).with_filter(filter_fn(|metadata| {
            metadata.level() == &tracing::Level::ERROR
                && !metadata.target().starts_with("opentelemetry")
                && metadata.target() != "zc_telemetry::export"
        }));

    tracing_subscriber::registry()
        .with(filter)
        .with(tracing_subscriber::fmt::layer().json())
        .with(tracing_opentelemetry::layer().with_tracer(tracer))
        .with(log_bridge)
        .try_init()
        .context("Tracing subscriber is already initialized")?;

    let environment = deployment_environment();
    let name = service_name(package);
    tracing::info!(
        otel.protocol = "grpc",
        otel.host = endpoint.host_str().unwrap_or_default(),
        otel.port = endpoint.port_or_known_default().unwrap_or_default(),
        service.name = name,
        deployment.environment = environment,
        "OpenTelemetry initialized"
    );
    tracing::info_span!("telemetry.startup", service.name = name).in_scope(|| {
        tracing::info!("OpenTelemetry startup canary");
    });

    let canary_logger = logger_provider.clone();
    let canary_meter = meter_provider.clone();
    let canary_tracer = tracer_provider.clone();
    let canary = tokio::runtime::Handle::try_current().ok().map(|handle| {
        handle.spawn_blocking(move || {
            if let Err(error) = flush_providers(
                Some(&canary_logger),
                Some(&canary_meter),
                Some(&canary_tracer),
            ) {
                tracing::warn!(target: "zc_telemetry::export", %error, "OTLP startup canary failed");
            }
        })
    });
    let guard = TelemetryGuard {
        logger: Some(logger_provider),
        meter: Some(meter_provider),
        tracer: Some(tracer_provider),
        canary: tokio::sync::Mutex::new(canary),
    };
    Ok(guard)
}

fn tracing_filter(package: &str) -> Result<EnvFilter> {
    if let Some(value) = nonempty_variable("RUST_LOG") {
        return EnvFilter::try_new(&value).context("RUST_LOG is invalid");
    }
    EnvFilter::try_new(default_filter(package)).context("default tracing filter is invalid")
}

fn endpoint() -> Result<Url> {
    let value = nonempty_variable("OTEL_EXPORTER_OTLP_ENDPOINT")
        .or_else(|| nonempty_variable("OPENTELEMETRY_COLLECTOR_URL"))
        .unwrap_or_else(|| "http://localhost:4317".to_owned());
    validate_endpoint(&value)
}

fn validate_endpoint(value: &str) -> Result<Url> {
    let endpoint = Url::parse(value).context("OTLP endpoint is invalid")?;
    ensure!(
        matches!(endpoint.scheme(), "http" | "https"),
        "OTLP endpoint must use HTTP or HTTPS"
    );
    ensure!(
        endpoint.host_str().is_some(),
        "OTLP endpoint requires a host"
    );
    Ok(endpoint)
}

fn resource(package: &str) -> Resource {
    let mut attributes = vec![
        KeyValue::new("service.name", service_name(package)),
        KeyValue::new("deployment.environment", deployment_environment()),
    ];
    if let Some(version) = nonempty_variable("OTEL_SERVICE_VERSION")
        .or_else(|| nonempty_variable("OPENTELEMETRY_SERVICE_VERSION"))
    {
        attributes.push(KeyValue::new("service.version", version));
    }
    Resource::builder().with_attributes(attributes).build()
}

fn deployment_environment() -> String {
    nonempty_variable("NODE_ENV").unwrap_or_else(|| "development".to_owned())
}

pub fn service_name(package: &str) -> String {
    resolve_service_name(
        package,
        nonempty_variable("OTEL_SERVICE_NAME").as_deref(),
        nonempty_variable("OPENTELEMETRY_SERVICE_NAME").as_deref(),
    )
}

fn resolve_service_name(package: &str, current: Option<&str>, legacy: Option<&str>) -> String {
    current
        .filter(|value| !value.trim().is_empty())
        .or_else(|| legacy.filter(|value| !value.trim().is_empty()))
        .map(str::trim)
        .map(str::to_owned)
        .unwrap_or_else(|| format!("zeepcentraal-{package}-dev"))
}

fn nonempty_variable(name: &str) -> Option<String> {
    zc_core::environment::var(name)
        .ok()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

fn sdk_disabled() -> bool {
    nonempty_variable("OTEL_SDK_DISABLED")
        .is_some_and(|value| matches!(value.to_ascii_lowercase().as_str(), "true" | "1"))
}

fn default_filter(package: &str) -> String {
    let target = package.replace('-', "_");
    format!("warn,zeepcentraal_{target}=info,zc_{target}=info,tower_http=info")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blank_service_name_uses_development_default() {
        assert_eq!(
            resolve_service_name("server", Some(""), Some("  ")),
            "zeepcentraal-server-dev"
        );
    }

    #[test]
    fn explicit_service_name_wins() {
        assert_eq!(
            resolve_service_name("server", Some("server-override"), Some("legacy")),
            "server-override"
        );
    }

    #[test]
    fn https_endpoint_is_valid_for_grpc_tls() {
        let endpoint = validate_endpoint("https://ingress.zeepki.st:443").unwrap();
        assert_eq!(endpoint.scheme(), "https");
        assert_eq!(endpoint.host_str(), Some("ingress.zeepki.st"));
        assert_eq!(endpoint.port_or_known_default(), Some(443));
    }

    #[test]
    fn default_filter_covers_binary_and_library_targets() {
        let filter = default_filter("server");
        assert!(filter.contains("zeepcentraal_server=info"));
        assert!(filter.contains("zc_server=info"));
        assert!(EnvFilter::try_new(filter).is_ok());
        assert!(EnvFilter::try_new("[invalid").is_err());
    }
}
