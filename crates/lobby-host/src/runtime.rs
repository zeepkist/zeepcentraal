use crate::{
    assets::{PreparedLevel, PreparedPlaylist},
    broker::RoomBrokerClient,
    chat::{PacketSender, RoomChat},
    config::ManagedRoomConfig,
    game_connection::GameConnection,
    leaderboard::PlayerLeaderboard,
    roster::RoomRoster,
    supervisor::SupervisedRoom,
    transfer::{ActivationTimeout, LevelTransfer, TransferEvent},
};
use anyhow::{Context, Result};
use std::sync::{
    Arc,
    atomic::{AtomicBool, AtomicU64, Ordering},
};
#[cfg(test)]
use std::time::Duration;
use tokio::sync::{Mutex, Notify};
use zc_core::zeepnet::GameHostPacket;

mod connection;
mod publication;
mod receipt;
mod retry;
pub use receipt::ReceivedPacket;

use connection::ConnectedRoom;
use retry::RetryBackoff;

#[async_trait::async_trait]
pub trait LobbyProfile: Send + Sync + 'static {
    fn kick_on_close(&self) -> bool {
        true
    }
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
    fn capture_receipt(
        &self,
        _packet: &GameHostPacket,
        _received_at: jiff::Timestamp,
        _players: &[zc_core::zeepnet::GameHostPlayer],
    ) -> Option<Arc<dyn std::any::Any + Send + Sync>> {
        None
    }
    fn confirm_receipt(&self, _event: &TransferEvent) {}
    fn preserve_native_finish(
        &self,
        _packet: &GameHostPacket,
        _steam_id: u64,
        _received_at: jiff::Timestamp,
    ) -> bool {
        true
    }
    async fn on_received(&self, received: &ReceivedPacket) -> Result<()> {
        self.on_packet(&received.packet).await
    }
}

#[derive(Clone)]
pub struct RoomContext {
    sender: Arc<dyn PacketSender>,
    transfer: Arc<Mutex<LevelTransfer>>,
    roster: Arc<Mutex<RoomRoster>>,
    authority: Arc<AtomicBool>,
    generation: Arc<AtomicU64>,
    session_generation: u64,
    publisher: Option<Arc<publication::Publisher>>,
    remote_clock: zc_core::zeepnet::RemoteClock,
    pub local_steam_id: u64,
}

// Cancellation must retire only its own attempt, including aborted profile tasks.
struct ActivationLease {
    transfer: Arc<Mutex<LevelTransfer>>,
    id: u64,
}

impl Drop for ActivationLease {
    fn drop(&mut self) {
        if let Ok(mut transfer) = self.transfer.try_lock() {
            transfer.cancel_activation(self.id);
        } else {
            let transfer = self.transfer.clone();
            let id = self.id;
            tokio::spawn(async move {
                transfer.lock().await.cancel_activation(id);
            });
        }
    }
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
            generation: Arc::new(AtomicU64::new(0)),
            session_generation: 0,
            publisher: None,
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
    pub(crate) async fn test_ownership_loss(&self) {
        self.authority.store(false, Ordering::Release);
        self.transfer.lock().await.close();
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
        transfer
            .observe(&GameHostPacket::GameProperties {
                uid: level.level.uid.clone(),
                workshop_id: level.level.workshop_id,
                level_loaded_at: self.remote_now().unwrap_or(1000.0),
                round_time: 900.0,
            })
            .await?;
        transfer.observe(&GameHostPacket::GameState(0)).await?;
        Ok(())
    }

    pub fn remote_now(&self) -> Option<f64> {
        self.remote_clock.now()
    }

    pub fn chat(&self) -> RoomChat {
        RoomChat::new(match &self.publisher {
            Some(publisher) => Arc::new(publication::PublishingSender(publisher.clone())),
            None => self.sender.clone(),
        })
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

    pub fn generation(&self) -> u64 {
        self.generation.load(Ordering::Acquire)
    }
    pub fn advance_generation(&self) {
        self.generation.fetch_add(1, Ordering::AcqRel);
    }
    pub async fn publish(&self, packets: Vec<Vec<u8>>) -> Result<()> {
        self.publish_batch(packets, false).await
    }
    pub async fn publish_standings(&self, packets: Vec<Vec<u8>>) -> Result<()> {
        self.publish_batch(packets, true).await
    }
    async fn publish_batch(&self, packets: Vec<Vec<u8>>, standings: bool) -> Result<()> {
        anyhow::ensure!(self.is_host(), "Room host authority unavailable");
        if let Some(publisher) = &self.publisher {
            publisher.enqueue(packets, standings)
        } else {
            for packet in packets {
                self.send(packet).await?;
            }
            Ok(())
        }
    }

    pub async fn activate(
        &self,
        level: PreparedLevel,
        playlist: Option<PreparedPlaylist>,
    ) -> Result<()> {
        self.activate_inner(level, playlist, true).await
    }
    pub(crate) async fn activate_current_generation(
        &self,
        level: PreparedLevel,
        playlist: Option<PreparedPlaylist>,
    ) -> Result<()> {
        self.activate_inner(level, playlist, false).await
    }
    async fn activate_inner(
        &self,
        level: PreparedLevel,
        playlist: Option<PreparedPlaylist>,
        advance: bool,
    ) -> Result<()> {
        anyhow::ensure!(self.is_host(), "Room host authority unavailable");
        let (timeout, attempt) = {
            let mut transfer = self.transfer.lock().await;
            let timeout = transfer.timeout();
            let attempt = transfer.prepare_activation(level, playlist)?;
            if advance {
                self.advance_generation();
            }
            (timeout, attempt)
        };
        let lease = ActivationLease {
            transfer: self.transfer.clone(),
            id: attempt.id,
        };
        let result = tokio::time::timeout(timeout, async {
            for packet in attempt.packets {
                self.send(packet).await?;
            }
            attempt
                .ready
                .await
                .context("Lobby activation channel closed")??;
            anyhow::ensure!(self.is_host(), "Room host authority unavailable");
            Ok(())
        })
        .await;
        // Clear synchronously on normal errors; Drop covers cancellation at any await.
        if !matches!(&result, Ok(Ok(()))) {
            self.transfer.lock().await.cancel_activation(lease.id);
        }
        drop(lease);
        result.map_err(|_| anyhow::Error::new(ActivationTimeout))?
    }

    #[cfg(test)]
    pub(crate) async fn dispatch(
        &self,
        profile: &dyn ProfileSession,
        packet: &GameHostPacket,
    ) -> Result<()> {
        let mut received = self
            .receive_for_test(profile, packet.clone(), jiff::Timestamp::now())
            .await?;
        self.dispatch_received(profile, &mut received).await
    }
    #[cfg(test)]
    pub(crate) async fn receive_for_test(
        &self,
        profile: &dyn ProfileSession,
        packet: GameHostPacket,
        received_at: jiff::Timestamp,
    ) -> Result<ReceivedPacket> {
        self.roster.lock().await.observe(&packet);
        let mut received = ReceivedPacket::new(packet, received_at, 1, 1);
        received.capture(profile, self).await?;
        Ok(received)
    }

    async fn observe_received(&self, packet: &GameHostPacket) -> Result<Vec<TransferEvent>> {
        self.transfer.lock().await.observe_received(packet)
    }
    async fn execute_transfer(
        &self,
        work: &crate::transfer::TransferWork,
    ) -> Result<Vec<TransferEvent>> {
        if !self.transfer.lock().await.work_current(work) {
            return Ok(Vec::new());
        }
        let level = work.load().await?;
        if !self.transfer.lock().await.work_current(work) {
            return Ok(Vec::new());
        }
        if let Some(packet) = work.packet(&level)? {
            let started = tokio::time::Instant::now();
            tracing::info!(generation=self.generation(),uid=%level.level.uid,workshop_id=level.level.workshop_id,"Lobby level upload started");
            self.send(packet).await?;
            tracing::info!(generation=self.generation(),uid=%level.level.uid,workshop_id=level.level.workshop_id,elapsed_ms=started.elapsed().as_millis() as u64,"Lobby level uploaded; awaiting server confirmation");
        }
        Ok(self.transfer.lock().await.commit_work(work, level))
    }
    async fn dispatch_received(
        &self,
        profile: &dyn ProfileSession,
        received: &mut ReceivedPacket,
    ) -> Result<()> {
        let events = if let Some(complete) = received.transfer_complete.take() {
            complete
                .await
                .context("Room level transfer worker closed")?
        } else {
            match &received.transfer {
                Some(work) => self.execute_transfer(work).await?,
                None => Vec::new(),
            }
        };
        for event in &received.events {
            profile.on_transfer(event).await?;
        }
        for event in events {
            profile.on_transfer(&event).await?;
        }
        profile.on_received(received).await
    }

    pub async fn update_playlist(
        &self,
        playlist: PreparedPlaylist,
        current: i32,
        next: i32,
    ) -> Result<()> {
        anyhow::ensure!(self.is_host(), "Room host authority unavailable");
        let (generation, packet) = self
            .transfer
            .lock()
            .await
            .prepare_playlist(&playlist, current, next)?;
        self.send(packet).await?;
        self.transfer
            .lock()
            .await
            .commit_playlist(generation, playlist);
        Ok(())
    }

    pub fn leaderboard(&self) -> PlayerLeaderboard {
        PlayerLeaderboard::new(self.local_steam_id)
    }
    pub async fn set_round_time(&self, seconds: f64) -> Result<()> {
        anyhow::ensure!(self.is_host(), "Room host authority unavailable");
        self.transfer.lock().await.set_round_time(seconds)
    }

    pub(crate) async fn set_level_deadline(
        &self,
        level: &PreparedLevel,
        deadline: i64,
    ) -> Result<()> {
        anyhow::ensure!(self.is_host(), "Room host authority unavailable");
        let mut transfer = self.transfer.lock().await;
        let elapsed = self
            .remote_now()
            .zip(transfer.level_loaded_at(level))
            .map_or(0.0, |(now, loaded_at)| (now - loaded_at).max(0.0));
        let remaining = (deadline - jiff::Timestamp::now().as_second()).max(1) as f64;
        // Playlist NewTime is total round duration, measured from the confirmed
        // server load timestamp. Never send a server game-properties broadcast.
        transfer.set_round_time(remaining + elapsed)
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

    fn level() -> PreparedLevel {
        PreparedLevel {
            compressed_data: Arc::from([1_u8, 2, 3]),
            content_sha256: "test".into(),
            level: zc_core::zeepnet::OnlineLevel {
                uid: "test".into(),
                workshop_id: 1,
                name: "Test".into(),
                author: "Test".into(),
                collaborators: String::new(),
                override_author_name: String::new(),
            },
        }
    }

    fn activation_context() -> Result<(RoomContext, tokio::sync::mpsc::UnboundedReceiver<Vec<u8>>)>
    {
        let (signal, packets) = tokio::sync::mpsc::unbounded_channel();
        let sender = Arc::new(crate::chat::FnPacketSender(move |packet| {
            let signal = signal.clone();
            async move {
                signal.send(packet)?;
                Ok(())
            }
        }));
        Ok((RoomContext::for_test(sender, 1)?, packets))
    }

    #[tokio::test]
    async fn slow_asset_load_releases_transfer_lock_and_obsolete_work_cannot_commit() -> Result<()>
    {
        struct SlowLoader {
            started: Arc<tokio::sync::Semaphore>,
            release: Arc<tokio::sync::Semaphore>,
        }
        #[async_trait::async_trait]
        impl crate::assets::LevelLoader for SlowLoader {
            async fn load(&self, _: &str, _: u64) -> Result<Option<PreparedLevel>> {
                self.started.add_permits(1);
                self.release.acquire().await?.forget();
                Ok(Some(level()))
            }
        }
        let (context, mut packets) = activation_context()?;
        let started = Arc::new(tokio::sync::Semaphore::new(0));
        let release = Arc::new(tokio::sync::Semaphore::new(0));
        let playlist = PreparedPlaylist::new(
            vec![level().level],
            Arc::new(SlowLoader {
                started: started.clone(),
                release: release.clone(),
            }),
        )?;
        let attempt = context
            .transfer
            .lock()
            .await
            .prepare_activation(level(), Some(playlist))?;
        let work = context
            .transfer
            .lock()
            .await
            .prepare_work(&GameHostPacket::LevelRequest {
                uid: "test".into(),
                workshop_id: 1,
                name: "Test".into(),
            })?
            .unwrap();
        let loading = tokio::spawn({
            let context = context.clone();
            async move { context.execute_transfer(&work).await }
        });
        started.acquire().await?.forget();
        assert!(context.transfer.try_lock().is_ok());
        context
            .observe_received(&GameHostPacket::GameProperties {
                uid: "test".into(),
                workshop_id: 1,
                round_time: 900.0,
                level_loaded_at: 10.0,
            })
            .await?;
        context
            .observe_received(&GameHostPacket::GameState(0))
            .await?;
        attempt.ready.await??;
        let mut next = level();
        next.level.uid = "next".into();
        let next_attempt = context
            .transfer
            .lock()
            .await
            .prepare_activation(next.clone(), None)?;
        release.add_permits(1);
        assert!(loading.await??.is_empty());
        assert_eq!(
            context
                .transfer
                .lock()
                .await
                .pending
                .as_ref()
                .unwrap()
                .level
                .uid,
            "next"
        );
        assert!(packets.try_recv().is_err());
        context
            .transfer
            .lock()
            .await
            .cancel_activation(next_attempt.id);
        Ok(())
    }

    #[tokio::test(start_paused = true)]
    async fn activation_timeout_clears_pending_before_retry() -> Result<()> {
        let (context, mut packets) = activation_context()?;
        let task = tokio::spawn({
            let context = context.clone();
            async move { context.activate(level(), None).await }
        });
        packets.recv().await.unwrap();
        packets.recv().await.unwrap();
        tokio::time::advance(Duration::from_secs(30)).await;
        assert!(task.await?.unwrap_err().is::<ActivationTimeout>());
        let mut transfer = context.transfer.lock().await;
        assert!(transfer.pending.is_none());
        let next = transfer.prepare_activation(level(), None)?;
        transfer.cancel_activation(next.id);
        Ok(())
    }

    #[tokio::test]
    async fn abort_cleanup_cannot_cancel_newer_attempt_even_when_transfer_locked() -> Result<()> {
        let (context, mut packets) = activation_context()?;
        let task = tokio::spawn({
            let context = context.clone();
            async move { context.activate(level(), None).await }
        });
        packets.recv().await.unwrap();
        packets.recv().await.unwrap();
        let mut transfer = context.transfer.lock().await;
        task.abort();
        assert!(task.await.unwrap_err().is_cancelled());
        let next = transfer.prepare_activation(level(), None)?;
        drop(transfer);
        tokio::task::yield_now().await;
        let mut transfer = context.transfer.lock().await;
        transfer
            .observe(&GameHostPacket::GameProperties {
                uid: "test".into(),
                workshop_id: 1,
                round_time: 900.0,
                level_loaded_at: 10.0,
            })
            .await?;
        transfer.observe(&GameHostPacket::GameState(0)).await?;
        next.ready.await??;
        Ok(())
    }

    #[tokio::test]
    async fn activation_send_failure_clears_pending() -> Result<()> {
        let sender = Arc::new(crate::chat::FnPacketSender(|_| async {
            anyhow::bail!("fake send failure")
        }));
        let context = RoomContext::for_test(sender, 1)?;
        assert_eq!(
            context
                .activate(level(), None)
                .await
                .unwrap_err()
                .to_string(),
            "fake send failure"
        );
        let mut transfer = context.transfer.lock().await;
        assert!(transfer.pending.is_none());
        let next = transfer.prepare_activation(level(), None)?;
        transfer.cancel_activation(next.id);
        Ok(())
    }

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
