#[tokio::main]
async fn main() -> anyhow::Result<()> {
    zc_core::environment::initialize()?;
    if !enabled("ZEEPKIST_LOBBY_HOST_ENABLED")? {
        tracing::info!("Lobby host is disabled");
        shutdown_signal().await?;
        return Ok(());
    }
    let telemetry = zc_telemetry::initialize("lobby-host")?;
    let config_path = zc_core::config::required("ZEEPKIST_LOBBY_HOST_CONFIG_FILE")?;
    let contents = tokio::fs::read_to_string(&config_path).await?;
    let config = zc_lobby_host::config::LobbyHostFileConfig::parse(&contents)?;
    let database_config = zc_core::config::DatabaseConfig::from_env(
        u32::try_from(config.rooms.len())
            .unwrap_or(32)
            .saturating_add(2),
    )?;
    let pool = zc_database::DatabasePool::connect(
        &database_config.url,
        zc_database::PoolSettings::from_database_config(
            &database_config,
            "zeepcentraal-lobby-host",
        ),
        zc_database::PoolBudget::application(database_config.pool_max),
    )
    .await?;
    let database = zc_database::Database::from_partition(pool.application());
    let storage: std::sync::Arc<dyn zc_core::object_storage::ObjectStorage> =
        std::sync::Arc::new(zc_core::object_storage::S3ObjectStorage::new(
            &zc_core::config::ObjectStorageConfig::from_env()?,
        )?);
    let broker = zc_lobby_host::broker::RoomBrokerClient::new(
        &zc_core::environment::var("ZEEPKIST_ROOM_BROKER_URL")
            .unwrap_or_else(|_| "http://localhost:3001".into()),
        zc_core::config::required("ZEEPKIST_ROOM_BROKER_TOKEN")?,
    )?;
    let mut running = std::collections::HashMap::new();
    reconcile_rooms(&mut running, config.rooms, &database, &storage, &broker).await?;
    tracing::info!(rooms = running.len(), "Lobby host started");
    let mut observed = contents;
    let mut refresh = tokio::time::interval(std::time::Duration::from_secs(5));
    refresh.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    loop {
        tokio::select! {
            result = shutdown_signal() => { result?; break; },
            _ = refresh.tick() => {
                let next = match tokio::fs::read_to_string(&config_path).await {
                    Ok(value) => value,
                    Err(error) => { tracing::warn!(%error, "Lobby config reload failed"); continue; }
                };
                if next == observed { continue; }
                observed = next.clone();
                match zc_lobby_host::config::LobbyHostFileConfig::parse(&next) {
                    Ok(parsed) => reconcile_rooms(&mut running, parsed.rooms, &database, &storage, &broker).await?,
                    Err(error) => tracing::warn!(%error, "Lobby config reload rejected"),
                }
            }
        }
    }
    tracing::info!("Lobby host stopping; making rooms private");
    for (_, room) in running.drain() {
        room.supervisor.stop().await?;
        room.task.await?;
    }
    telemetry.shutdown().await
}

struct RunningRoom {
    config: zc_lobby_host::config::ManagedRoomConfig,
    supervisor: std::sync::Arc<zc_lobby_host::supervisor::LobbyHostSupervisor>,
    task: tokio::task::JoinHandle<()>,
}

async fn reconcile_rooms(
    running: &mut std::collections::HashMap<String, RunningRoom>,
    next: Vec<zc_lobby_host::config::ManagedRoomConfig>,
    database: &zc_database::Database,
    storage: &std::sync::Arc<dyn zc_core::object_storage::ObjectStorage>,
    broker: &zc_lobby_host::broker::RoomBrokerClient,
) -> anyhow::Result<()> {
    let changed = changed_room_keys(running.values().map(|active| &active.config), &next);
    for key in changed {
        if let Some(active) = running.remove(&key) {
            active.supervisor.stop().await?;
            active.task.await?;
            tracing::info!(room = key, "Managed room stopped for config change");
        }
    }
    for room in next {
        if !room.enabled {
            continue;
        }
        if running.contains_key(&room.key) {
            continue;
        }
        let profile = zc_lobby_host::profiles::create_profile(
            room.clone(),
            database.clone(),
            storage.clone(),
        )?;
        let host: std::sync::Arc<dyn zc_lobby_host::supervisor::SupervisedRoom> =
            std::sync::Arc::new(zc_lobby_host::runtime::ManagedLobbyHost::new(
                room.clone(),
                database.clone(),
                broker.clone(),
                profile,
            ));
        let supervisor = std::sync::Arc::new(zc_lobby_host::supervisor::LobbyHostSupervisor::new(
            vec![host],
            std::time::Duration::from_secs(1),
        ));
        let task_supervisor = supervisor.clone();
        let task = tokio::spawn(async move { task_supervisor.run().await });
        running.insert(
            room.key.clone(),
            RunningRoom {
                config: room,
                supervisor,
                task,
            },
        );
    }
    Ok(())
}

fn changed_room_keys<'a>(
    current: impl Iterator<Item = &'a zc_lobby_host::config::ManagedRoomConfig>,
    next: &[zc_lobby_host::config::ManagedRoomConfig],
) -> Vec<String> {
    let mut changed = current
        .filter(|active| next.iter().find(|room| room.key == active.key) != Some(*active))
        .map(|room| room.key.clone())
        .collect::<Vec<_>>();
    changed.sort();
    changed
}

fn enabled(name: &str) -> anyhow::Result<bool> {
    match zc_core::environment::var(name)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reload_changes_only_modified_or_removed_rooms() -> anyhow::Result<()> {
        let old = zc_lobby_host::config::LobbyHostFileConfig::parse(r#"{"version":1,"rooms":[
            {"key":"weekly","profile":{"type":"track-tournament","tournamentType":"weekly"},"room":{"name":"Weekly","isPublic":true,"maxPlayers":64},"roundTimeSeconds":900,"assetPollMs":30000,"reconnectMaxMs":60000,"messageRefreshMs":60000},
            {"key":"zsl","profile":{"type":"zsl-submissions","roundId":50},"room":{"name":"ZSL","isPublic":true,"maxPlayers":64},"roundTimeSeconds":900,"assetPollMs":30000,"reconnectMaxMs":60000,"messageRefreshMs":60000}]}"#)?.rooms;
        assert!(changed_room_keys(old.iter(), &old).is_empty());
        let mut disabled = old.clone();
        disabled[1].enabled = false;
        assert_eq!(changed_room_keys(old.iter(), &disabled), ["zsl"]);
        assert!(changed_room_keys(disabled.iter(), &disabled).is_empty());
        assert_eq!(changed_room_keys(disabled.iter(), &old), ["zsl"]);
        let mut next = old.clone();
        next[1].profile = zc_lobby_host::config::RoomProfile::ZslSubmissions { round_id: 51 };
        assert_eq!(changed_room_keys(old.iter(), &next), ["zsl"]);
        assert_eq!(changed_room_keys(old.iter(), &old[..1]), ["zsl"]);
        Ok(())
    }
}
