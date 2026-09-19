#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let telemetry = zc_telemetry::initialize("inspector-zeep")?;
    let path = zc_core::config::required("INSPECTOR_ZEEP_CONFIG_FILE")?;
    let value: serde_json::Value = serde_json::from_str(&tokio::fs::read_to_string(path).await?)?;
    anyhow::ensure!(
        value.is_object(),
        "Inspector configuration must be an object"
    );
    let database = zc_core::DatabaseConfig::from_env(1)?;
    zc_database::Database::connect(&database.url, database.pool_max)
        .await?
        .ping()
        .await?;
    tracing::info!("Inspector configuration and database verified");
    telemetry.shutdown().await
}
