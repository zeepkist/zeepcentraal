#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let telemetry = zc_telemetry::initialize("import-zsl")?;
    let result = zc_import_zsl::run().await;
    telemetry.shutdown().await?;
    result
}
