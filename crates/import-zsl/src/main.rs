#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let telemetry = zc_telemetry::initialize("import-zsl")?;
    let root =
        std::env::var("SUPER_LEAGUE_DATA_PATH").unwrap_or_else(|_| "super_league_data".to_owned());
    let metadata =
        tokio::fs::read_to_string(std::path::Path::new(&root).join("metadata.json")).await?;
    let _: serde_json::Value = serde_json::from_str(&metadata)?;
    let database = zc_core::DatabaseConfig::from_env(1)?;
    zc_database::Database::connect(&database.url, database.pool_max)
        .await?
        .ping()
        .await?;
    tracing::info!(path = root, "Super League source and database verified");
    telemetry.shutdown().await
}
