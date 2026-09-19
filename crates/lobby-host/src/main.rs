#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let telemetry = zc_telemetry::initialize("lobby-host")?;
    let config = zc_core::config::required("ZEEPKIST_LOBBY_HOST_CONFIG_FILE")?;
    let contents = tokio::fs::read_to_string(config).await?;
    let _: serde_json::Value = serde_json::from_str(&contents)?;
    tracing::info!("Lobby host configuration loaded");
    tokio::signal::ctrl_c().await?;
    telemetry.shutdown().await
}
