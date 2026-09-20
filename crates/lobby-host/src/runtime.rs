use crate::{
    assets::{PreparedLevel, PreparedPlaylist},
    broker::RoomBrokerClient,
    chat::{PacketSender, RoomChat},
    config::ManagedRoomConfig,
    game_connection::GameConnection,
    leaderboard::PlayerLeaderboard,
    roster::RoomRoster,
    supervisor::SupervisedRoom,
    transfer::{LevelTransfer, TransferEvent},
};
use anyhow::{Context, Result};
use std::{
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};
use tokio::sync::{Mutex, Notify};
use zc_core::zeepnet::{GameHostPacket, change_lobby_visibility_packet};

#[async_trait::async_trait]
pub trait LobbyProfile: Send + Sync + 'static {
    fn name(&self) -> &str;
    async fn prepare(&self) -> Result<Option<PreparedLevel>>;
    async fn create_session(&self, context: RoomContext) -> Result<Arc<dyn ProfileSession>>;
    async fn stop(&self) -> Result<()>;
}

#[async_trait::async_trait]
pub trait ProfileSession: Send + Sync + 'static {
    async fn start(&self) -> Result<()>;
    async fn on_packet(&self, packet: &GameHostPacket) -> Result<()>;
    async fn on_transfer(&self, event: &TransferEvent) -> Result<()>;
    async fn stop(&self);
}

struct ConnectionSender {
    connection: Arc<GameConnection>,
}

#[async_trait::async_trait]
impl PacketSender for ConnectionSender {
    async fn send(&self, packet: Vec<u8>) -> Result<()> {
        self.connection.send(packet).await
    }
}

#[derive(Clone)]
pub struct RoomContext {
    sender: Arc<dyn PacketSender>,
    transfer: Arc<Mutex<LevelTransfer>>,
    roster: Arc<Mutex<RoomRoster>>,
    authority: Arc<AtomicBool>,
    pub local_steam_id: u64,
}

impl RoomContext {
    pub fn chat(&self) -> RoomChat {
        RoomChat::new(self.sender.clone())
    }

    pub fn is_host(&self) -> bool {
        self.authority.load(Ordering::Acquire)
    }

    pub async fn players(&self) -> Vec<zc_core::zeepnet::GameHostPlayer> {
        self.roster.lock().await.all()
    }

    pub async fn send(&self, packet: Vec<u8>) -> Result<()> {
        anyhow::ensure!(self.is_host(), "Room host authority unavailable");
        self.sender.send(packet).await
    }

    pub async fn activate(
        &self,
        level: PreparedLevel,
        playlist: Option<PreparedPlaylist>,
    ) -> Result<()> {
        let (timeout, ready) = {
            let mut transfer = self.transfer.lock().await;
            let timeout = transfer.timeout();
            let ready = transfer.begin_activation(level, playlist).await?;
            (timeout, ready)
        };
        let completed = tokio::time::timeout(timeout, ready)
            .await
            .context("Lobby level-data request timed out")?;
        completed.context("Lobby activation channel closed")??;
        Ok(())
    }

    pub async fn update_playlist(
        &self,
        playlist: PreparedPlaylist,
        current: i32,
        next: i32,
    ) -> Result<()> {
        self.transfer
            .lock()
            .await
            .update_playlist(playlist, current, next)
            .await
    }

    pub fn leaderboard(&self) -> PlayerLeaderboard {
        PlayerLeaderboard::new(self.local_steam_id)
    }
}

pub struct ManagedLobbyHost {
    config: ManagedRoomConfig,
    database: zc_database::Database,
    broker: RoomBrokerClient,
    profile: Arc<dyn LobbyProfile>,
    stopped: AtomicBool,
    wake: Notify,
}

impl ManagedLobbyHost {
    pub fn new(
        config: ManagedRoomConfig,
        database: zc_database::Database,
        broker: RoomBrokerClient,
        profile: Arc<dyn LobbyProfile>,
    ) -> Self {
        Self {
            config,
            database,
            broker,
            profile,
            stopped: AtomicBool::new(false),
            wake: Notify::new(),
        }
    }

    async fn run_loop(&self) -> Result<()> {
        let mut retry = Duration::from_secs(1);
        while !self.stopped.load(Ordering::Acquire) {
            let mut backoff = true;
            match self.profile.prepare().await {
                Ok(Some(_)) => match self.connect_once().await {
                    Ok(()) => retry = Duration::from_secs(1),
                    Err(error) => {
                        tracing::warn!(room = %self.config.key, profile = self.profile.name(), %error, "Managed room attempt failed")
                    }
                },
                Ok(None) => {
                    retry = Duration::from_millis(self.config.asset_poll_ms);
                    backoff = false;
                }
                Err(error) => {
                    tracing::warn!(room = %self.config.key, %error, "Managed room asset preparation failed")
                }
            }
            if self.stopped.load(Ordering::Acquire) {
                break;
            }
            tokio::select! {
                _ = tokio::time::sleep(retry) => {},
                _ = self.wake.notified() => {},
            }
            if backoff {
                retry = (retry * 2).min(Duration::from_millis(self.config.reconnect_max_ms));
            }
        }
        Ok(())
    }

    async fn connect_once(&self) -> Result<()> {
        let join_id = self
            .database
            .managed_lobby_join_id(&self.config.key)
            .await?;
        let assignment = self.broker.assign(&self.config, join_id.as_deref()).await?;
        if join_id.as_deref() != Some(&assignment.join_id) {
            self.database
                .set_managed_lobby_join_id(&self.config.key, &assignment.join_id)
                .await?;
        }
        if self.stopped.load(Ordering::Acquire) {
            return Ok(());
        }
        let connection = Arc::new(GameConnection::connect(&assignment).await?);
        let sender: Arc<dyn PacketSender> = Arc::new(ConnectionSender {
            connection: connection.clone(),
        });
        let transfer = Arc::new(Mutex::new(LevelTransfer::new(
            sender.clone(),
            self.config.round_time_seconds as f64,
            Duration::from_secs(30),
        )?));
        let roster = Arc::new(Mutex::new(RoomRoster::default()));
        let authority = Arc::new(AtomicBool::new(true));
        let context = RoomContext {
            sender: sender.clone(),
            transfer: transfer.clone(),
            roster: roster.clone(),
            authority: authority.clone(),
            local_steam_id: assignment.steam_id()?,
        };
        let session = self.profile.create_session(context).await?;
        sender
            .send(change_lobby_visibility_packet(self.config.room.is_public)?)
            .await?;
        tokio::time::sleep(Duration::from_millis(3_500)).await;
        let mut started = {
            let session = session.clone();
            tokio::spawn(async move { session.start().await })
        };
        let result = loop {
            tokio::select! {
                _ = self.wake.notified() => break Ok(()),
                start_result = &mut started => {
                    break match start_result {
                        Ok(Ok(())) => Err(anyhow::anyhow!("Room profile stopped unexpectedly")),
                        Ok(Err(error)) => Err(error.context("Room profile start failed")),
                        Err(error) => Err(error.into()),
                    };
                }
                result = connection.recv() => {
                    let Some(packet) = result? else {
                        break Err(anyhow::anyhow!("GameServer connection closed"));
                    };
                    roster.lock().await.observe(&packet);
                    match &packet {
                        GameHostPacket::Initial { is_host, .. } => authority.store(*is_host, Ordering::Release),
                        GameHostPacket::Master(uid) => authority.store(*uid == assignment.player_uid, Ordering::Release),
                        _ => {}
                    }
                    if !authority.load(Ordering::Acquire) {
                        break Err(anyhow::anyhow!("Managed account lost lobby ownership"));
                    }
                    if matches!(packet, GameHostPacket::LevelRequest { .. }) {
                        let events = {
                            let mut transfer = transfer.lock().await;
                            transfer.request(&packet)?;
                            transfer.process_next().await?
                        };
                        if let Some(events) = events {
                            for event in &events {
                                session.on_transfer(event).await?;
                            }
                        }
                    }
                    session.on_packet(&packet).await?;
                }
            }
        };
        session.stop().await;
        started.abort();
        transfer.lock().await.close();
        let _ = sender.send(change_lobby_visibility_packet(false)?).await;
        let _ = connection.close("Managed room reconnecting").await;
        result
    }
}

#[async_trait::async_trait]
impl SupervisedRoom for ManagedLobbyHost {
    fn key(&self) -> &str {
        &self.config.key
    }

    async fn run(&self) -> Result<()> {
        self.run_loop().await
    }

    async fn stop(&self) -> Result<()> {
        if self.stopped.swap(true, Ordering::AcqRel) {
            return Ok(());
        }
        self.wake.notify_waiters();
        self.profile.stop().await
    }
}
