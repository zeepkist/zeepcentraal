#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let telemetry = zc_telemetry::initialize("lobby-host")?;
    let config = zc_core::config::required("ZEEPKIST_LOBBY_HOST_CONFIG_FILE")?;
    let contents = tokio::fs::read_to_string(config).await?;
    let config = zc_lobby_host::config::LobbyHostFileConfig::parse(&contents)?;
    tracing::info!(
        rooms = config.rooms.len(),
        "Lobby host configuration loaded"
    );
    tokio::signal::ctrl_c().await?;
    telemetry.shutdown().await
}
