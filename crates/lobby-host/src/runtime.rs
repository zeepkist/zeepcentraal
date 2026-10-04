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
use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};
#[cfg(test)]
use std::time::Duration;
use tokio::sync::{Mutex, Notify};
use zc_core::zeepnet::GameHostPacket;

mod connection;
mod retry;

use connection::ConnectedRoom;
use retry::RetryBackoff;

#[async_trait::async_trait]
pub trait LobbyProfile: Send + Sync + 'static {
    fn name(&self) -> &str;
    fn room_name(&self) -> Option<String> {
        None
    }
    fn close_at(&self) -> Option<jiff::Timestamp> {
        None
    }
    async fn refresh_schedule(&self) -> Result<()> {
        Ok(())
    }
    async fn scheduled_closed(&self) -> Result<()> {
        Ok(())
    }
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

#[derive(Clone)]
pub struct RoomContext {
    sender: Arc<dyn PacketSender>,
    transfer: Arc<Mutex<LevelTransfer>>,
    roster: Arc<Mutex<RoomRoster>>,
    authority: Arc<AtomicBool>,
    remote_clock: zc_core::zeepnet::RemoteClock,
    pub local_steam_id: u64,
}

impl RoomContext {
    #[cfg(test)]
    pub(crate) fn for_test(sender: Arc<dyn PacketSender>, local_steam_id: u64) -> Result<Self> {
        Ok(Self {
            transfer: Arc::new(Mutex::new(LevelTransfer::new(
                sender.clone(),
                900.0,
                Duration::from_secs(30),
            )?)),
            sender,
            roster: Arc::new(Mutex::new(RoomRoster::default())),
            authority: Arc::new(AtomicBool::new(true)),
            remote_clock: zc_core::zeepnet::RemoteClock::default(),
            local_steam_id,
        })
    }

    #[cfg(test)]
    pub(crate) fn test_remote_time(&mut self, time: f64) {
        self.remote_clock = zc_core::zeepnet::RemoteClock::from_sample(time, Duration::ZERO);
    }
    #[cfg(test)]
    pub(crate) fn test_authority(&self, value: bool) {
        self.authority.store(value, Ordering::Release);
    }

    #[cfg(test)]
    pub(crate) async fn observe_test_packet(&self, packet: &GameHostPacket) {
        self.roster.lock().await.observe(packet);
    }

    #[cfg(test)]
    pub(crate) async fn complete_test_level_request(&self, level: &PreparedLevel) -> Result<()> {
        let mut transfer = self.transfer.lock().await;
        transfer.request(&GameHostPacket::LevelRequest {
            name: level.level.name.clone(),
            uid: level.level.uid.clone(),
            workshop_id: level.level.workshop_id,
        })?;
        transfer.process_next().await?;
        Ok(())
    }

    pub fn remote_now(&self) -> Option<f64> {
        self.remote_clock.now()
    }

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
        anyhow::ensure!(self.is_host(), "Room host authority unavailable");
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
        anyhow::ensure!(self.is_host(), "Room host authority unavailable");
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
        if !self.config.enabled {
            return Ok(());
        }
        let mut retry = RetryBackoff::new(self.config.reconnect_max_ms);
        while !self.stopped.load(Ordering::Acquire) {
            let prepared = tokio::select! {
                biased;
                _ = wait_for_stop(&self.stopped, &self.wake) => break,
                prepared = self.profile.prepare() => prepared,
            };
            let poll_only = match prepared {
                Ok(Some(_)) => {
                    if let Err(error) = zc_telemetry::observe_operation(
                        "lobby.connect",
                        self.connect_once(&mut retry),
                    )
                    .await
                    {
                        tracing::warn!(room = %self.config.key, profile = self.profile.name(), %error, "Managed room attempt failed");
                    }
                    false
                }
                Ok(None) => true,
                Err(error) => {
                    tracing::warn!(room = %self.config.key, %error, "Managed room asset preparation failed");
                    false
                }
            };
            if self.stopped.load(Ordering::Acquire) {
                break;
            }
            let delay = retry.wait_delay(poll_only.then_some(self.config.asset_poll_ms));
            if !poll_only {
                tracing::info!(room = %self.config.key, profile = self.profile.name(), delay_ms = delay.as_millis() as u64, "Managed room reconnect scheduled");
            }
            tokio::select! {
                _ = tokio::time::sleep(delay) => {},
                _ = wait_for_stop(&self.stopped, &self.wake) => break,
            }
        }
        Ok(())
    }

    async fn connect_once(&self, retry: &mut RetryBackoff) -> Result<()> {
        let join_id = self
            .database
            .managed_lobby_join_id(&self.config.key)
            .await?;
        let mut resolved_config = self.config.clone();
        if self.stopped.load(Ordering::Acquire) {
            return Ok(());
        }
        if let Some(name) = self.profile.room_name() {
            resolved_config.room.name = name;
        }
        resolved_config.room.is_public = false;
        // Assignment may already have created a room. Complete the handoff even
        // after disable, then retire that room through the normal connection path.
        let assignment = self
            .broker
            .assign(&resolved_config, join_id.as_deref())
            .await?;
        if join_id.as_deref() != Some(&assignment.join_id) {
            self.database
                .set_managed_lobby_join_id(&self.config.key, &assignment.join_id)
                .await?;
        }
        let connection = Arc::new(GameConnection::connect(&assignment).await?);
        ConnectedRoom {
            config: &self.config,
            profile: self.profile.as_ref(),
            connection,
            local_steam_id: assignment.steam_id()?,
            player_uid: assignment.player_uid,
            stopped: &self.stopped,
            wake: &self.wake,
        }
        .run(retry)
        .await
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

// Register before checking the flag so notify_waiters cannot be lost between
// checking stopped and awaiting notification (including during startup).
async fn wait_for_stop(stopped: &AtomicBool, wake: &Notify) {
    loop {
        let notified = wake.notified();
        tokio::pin!(notified);
        notified.as_mut().enable();
        if stopped.load(Ordering::Acquire) {
            return;
        }
        notified.await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test(start_paused = true)]
    async fn shutdown_interrupts_backoff_without_waiting_for_retry() {
        let stopped = Arc::new(AtomicBool::new(false));
        let wake = Arc::new(Notify::new());
        let task = {
            let stopped = stopped.clone();
            let wake = wake.clone();
            tokio::spawn(async move {
                tokio::select! {
                    _ = tokio::time::sleep(Duration::from_secs(600)) => panic!("retry elapsed"),
                    _ = wait_for_stop(&stopped, &wake) => {},
                }
            })
        };
        tokio::task::yield_now().await;
        let before = tokio::time::Instant::now();
        stopped.store(true, Ordering::Release);
        wake.notify_waiters();
        task.await.unwrap();
        assert_eq!(tokio::time::Instant::now(), before);
    }
}
