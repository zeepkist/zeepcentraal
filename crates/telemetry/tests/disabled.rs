use anyhow::Result;

#[tokio::test]
async fn disabled_sdk_keeps_local_subscriber_without_exporters() -> Result<()> {
    unsafe {
        std::env::set_var("OTEL_SDK_DISABLED", "true");
        std::env::set_var("OTEL_EXPORTER_OTLP_ENDPOINT", "invalid endpoint");
        std::env::remove_var("RUST_LOG");
    }
    let telemetry = zc_telemetry::initialize("server")?;
    tracing::info!("Local structured logging remains active");
    telemetry.force_flush().await?;
    telemetry.shutdown().await
}
