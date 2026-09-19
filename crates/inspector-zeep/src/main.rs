#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let telemetry = zc_telemetry::initialize("inspector-zeep")?;
    let path = std::env::var("INSPECTOR_CONFIG_FILE")
        .or_else(|_| std::env::var("INSPECTOR_ZEEP_CONFIG_FILE"))?;
    let config =
        zc_inspector_zeep::config::InspectorConfig::parse(&tokio::fs::read_to_string(path).await?)?;
    let options =
        zc_inspector_zeep::config::parse_options(&std::env::args().skip(1).collect::<Vec<_>>())?;
    let database = zc_core::DatabaseConfig::from_env(1)?;
    zc_database::Database::connect(&database.url, database.pool_max)
        .await?
        .ping()
        .await?;
    tracing::info!(
        contests = config.contests.len(),
        dry_run = options.dry_run,
        force = options.force,
        "Inspector configuration and database verified"
    );
    telemetry.shutdown().await
}
