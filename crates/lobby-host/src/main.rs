#[tokio::main]
async fn main() -> anyhow::Result<()> {
    if !enabled("ZEEPKIST_LOBBY_HOST_ENABLED")? {
        tracing::info!("Lobby host is disabled");
        shutdown_signal().await?;
        return Ok(());
    }
    let telemetry = zc_telemetry::initialize("lobby-host")?;
    let config = zc_core::config::required("ZEEPKIST_LOBBY_HOST_CONFIG_FILE")?;
    let contents = tokio::fs::read_to_string(config).await?;
    let config = zc_lobby_host::config::LobbyHostFileConfig::parse(&contents)?;
    let database_config = zc_core::config::DatabaseConfig::from_env(
        u32::try_from(config.rooms.len())
            .unwrap_or(32)
            .saturating_add(2),
    )?;
    let database =
        zc_database::Database::connect(&database_config.url, database_config.pool_max).await?;
    let storage: std::sync::Arc<dyn zc_core::object_storage::ObjectStorage> =
        std::sync::Arc::new(zc_core::object_storage::S3ObjectStorage::new(
            &zc_core::config::ObjectStorageConfig::from_env()?,
        )?);
    let broker = zc_lobby_host::broker::RoomBrokerClient::new(
        &std::env::var("ZEEPKIST_ROOM_BROKER_URL")
            .unwrap_or_else(|_| "http://localhost:3001".into()),
        zc_core::config::required("ZEEPKIST_ROOM_BROKER_TOKEN")?,
    )?;
    let room_count = config.rooms.len();
    let mut rooms: Vec<std::sync::Arc<dyn zc_lobby_host::supervisor::SupervisedRoom>> = Vec::new();
    for room in config.rooms {
        let profile = zc_lobby_host::profiles::create_profile(
            room.clone(),
            database.clone(),
            storage.clone(),
        )?;
        rooms.push(std::sync::Arc::new(
            zc_lobby_host::runtime::ManagedLobbyHost::new(
                room,
                database.clone(),
                broker.clone(),
                profile,
            ),
        ));
    }
    let supervisor = zc_lobby_host::supervisor::LobbyHostSupervisor::new(
        rooms,
        std::time::Duration::from_secs(1),
    );
    tracing::info!(rooms = room_count, "Lobby host started");
    let running = supervisor.run();
    tokio::pin!(running);
    tokio::select! {
        result = shutdown_signal() => result?,
        _ = &mut running => anyhow::bail!("Lobby host supervisor stopped unexpectedly"),
    }
    tracing::info!("Lobby host stopping; making rooms private");
    supervisor.stop().await?;
    running.await;
    telemetry.shutdown().await
}

fn enabled(name: &str) -> anyhow::Result<bool> {
    match std::env::var(name)
        .unwrap_or_else(|_| "false".into())
        .to_ascii_lowercase()
        .as_str()
    {
        "1" | "true" | "yes" | "on" => Ok(true),
        "0" | "false" | "no" | "off" => Ok(false),
        _ => anyhow::bail!("{name} must be a boolean"),
    }
}

async fn shutdown_signal() -> anyhow::Result<()> {
    #[cfg(unix)]
    {
        let mut terminate =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())?;
        tokio::select! {
            result = tokio::signal::ctrl_c() => result?,
            _ = terminate.recv() => {},
        }
    }
    #[cfg(not(unix))]
    tokio::signal::ctrl_c().await?;
    Ok(())
}
