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
use std::time::Duration;
use tokio::sync::{Mutex, Notify};
use zc_core::zeepnet::GameHostPacket;

mod connection;
mod publication;
mod receipt;
mod retry;
mod round;
pub use receipt::ReceivedPacket;
pub(crate) use round::{RoundKey, ServerRound};

use connection::ConnectedRoom;
use retry::RetryBackoff;

#[async_trait::async_trait]
pub trait LobbyProfile: Send + Sync + 'static {
    fn kick_on_close(&self) -> bool {
        true
    }
    fn publish_on_connect(&self) -> bool {
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
    round_clock: Arc<std::sync::Mutex<round::RoundClock>>,
    round_changed: Arc<Notify>,
    overlay_send: Arc<Mutex<()>>,
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
            round_clock: Arc::default(),
            round_changed: Arc::default(),
            overlay_send: Arc::default(),
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
        self.observe_round(
            &GameHostPacket::GameProperties {
                uid: level.level.uid.clone(),
                workshop_id: level.level.workshop_id,
                level_loaded_at: self.remote_now().unwrap_or(1000.0),
                round_time: transfer.round_time(),
            },
            jiff::Timestamp::now(),
        );
        self.observe_round(&GameHostPacket::GameState(0), jiff::Timestamp::now());
        Ok(())
    }

    pub fn remote_now(&self) -> Option<f64> {
        self.remote_clock.now()
    }

    pub(crate) fn server_round(&self) -> Option<ServerRound> {
        self.round_clock.lock().unwrap().round.clone()
    }

    pub(crate) fn server_round_for(&self, key: &RoundKey) -> Option<ServerRound> {
        let clock = self.round_clock.lock().unwrap();
        [&clock.round, &clock.previous]
            .into_iter()
            .find_map(|round| round.as_ref().filter(|round| round.key == *key))
            .cloned()
    }

    fn observe_round(&self, packet: &GameHostPacket, received_at: jiff::Timestamp) {
        if self
            .round_clock
            .lock()
            .unwrap()
            .observe(packet, received_at, self.remote_now())
        {
            self.round_changed.notify_one();
        }
    }

    pub(crate) fn round_message_due(&self, interval: Duration) -> Option<RoundKey> {
        if !self.is_host() {
            return None;
        }
        let clock = self.round_clock.lock().unwrap();
        clock
            .message_deadline(interval)
            .filter(|deadline| *deadline <= tokio::time::Instant::now())?;
        Some(clock.round.as_ref()?.key.clone())
    }

    pub(crate) async fn wait_for_round_message(&self, interval: Duration) {
        loop {
            let deadline = self.round_clock.lock().unwrap().message_deadline(interval);
            if let Some(deadline) = deadline {
                tokio::select! {
                    _ = tokio::time::sleep_until(deadline) => return,
                    _ = self.round_changed.notified() => {},
                }
            } else {
                self.round_changed.notified().await;
            }
        }
    }

    pub(crate) async fn run_round_messages<F: std::future::Future<Output = Result<()>>>(
        &self,
        interval: Duration,
        send: impl Fn() -> F,
    ) -> Result<()> {
        loop {
            self.wait_for_round_message(interval).await;
            send().await?;
            if self.round_message_due(interval).is_some() {
                // The profile may still be reconciling the new playlist position.
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
        }
    }

    pub(crate) async fn send_round_message(
        &self,
        key: &RoundKey,
        interval: Duration,
        message: &str,
    ) -> Result<()> {
        anyhow::ensure!(self.is_host(), "Room host authority unavailable");
        {
            let mut clock = self.round_clock.lock().unwrap();
            if !clock.round.as_ref().is_some_and(|round| round.key == *key)
                || !clock
                    .message_deadline(interval)
                    .is_some_and(|deadline| deadline <= tokio::time::Instant::now())
            {
                return Ok(());
            }
            clock.last_message = Some(tokio::time::Instant::now());
        }
        self.chat().command(message).await
    }

    pub(crate) async fn send_tournament_overlay(
        &self,
        key: &RoundKey,
        interval: Duration,
        duration: Duration,
        message: &str,
    ) -> Result<()> {
        let Ok(_pending) = self.overlay_send.try_lock() else {
            return Ok(());
        };
        let now = tokio::time::Instant::now();
        let generation = self.generation.load(Ordering::Acquire);
        let (joins, revision) = {
            let mut clock = self.round_clock.lock().unwrap();
            if !self.is_host()
                || !clock.round.as_ref().is_some_and(|round| round.key == *key)
                || !clock
                    .message_deadline(interval)
                    .is_some_and(|deadline| deadline <= now)
            {
                return Ok(());
            }
            clock.overlay.evaluated = Some(now);
            if let Some(sent) = &clock.overlay.submitted {
                let unchanged = sent.content == message;
                if unchanged && now < sent.refresh && clock.overlay.joins == sent.joins {
                    tracing::debug!("Duplicate tournament overlay suppressed");
                    return Ok(());
                }
                tracing::debug!(
                    expiry = now >= sent.refresh,
                    player_joined = clock.overlay.joins != sent.joins,
                    content_changed = !unchanged,
                    "Tournament overlay evaluated"
                );
            }
            (clock.overlay.joins, clock.overlay.revision)
        };
        let packet = zc_core::zeepnet::chat_message_packet(message)?;
        let bytes = packet.len();
        let written = if let Some(publisher) = &self.publisher {
            let clock = self.round_clock.clone();
            let key = key.clone();
            let Some(written) = publisher
                .send_confirmed(packet, move || {
                    let clock = clock.lock().unwrap();
                    clock.overlay.revision == revision
                        && clock.round.as_ref().is_some_and(|round| round.key == key)
                })
                .await?
            else {
                return Ok(());
            };
            written
        } else {
            self.sender.send_timed(packet).await?
        };
        let mut clock = self.round_clock.lock().unwrap();
        if self.is_host()
            && self.generation.load(Ordering::Acquire) == generation
            && clock.overlay.revision == revision
            && clock.round.as_ref().is_some_and(|round| round.key == *key)
        {
            clock.overlay.submitted = Some(round::OverlaySubmission {
                content: message.to_owned(),
                written,
                refresh: written + duration - (duration / 10).min(Duration::from_secs(30)),
                joins,
            });
        }
        tracing::debug!(
            bytes,
            fragmented = bytes > zc_core::zeepnet::lidgren::DEFAULT_UNFRAGMENTED_PAYLOAD_BYTES,
            "Tournament overlay acknowledged"
        );
        Ok(())
    }

    pub(crate) fn invalidate_tournament_overlay(&self) {
        let mut clock = self.round_clock.lock().unwrap();
        clock.overlay.revision = clock.overlay.revision.wrapping_add(1);
        clock.overlay.evaluated = None;
        clock.overlay.submitted = None;
        self.round_changed.notify_one();
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

    pub(crate) async fn observe_received(
        &self,
        packet: &GameHostPacket,
    ) -> Result<Vec<TransferEvent>> {
        self.transfer.lock().await.observe_received(packet)
    }
    async fn execute_transfer(
        &self,
        work: &crate::transfer::TransferWork,
    ) -> Result<Vec<TransferEvent>> {
        if !self.transfer.lock().await.work_current(work) {
            return Ok(Vec::new());
        }
        let level = match work.load().await {
            Ok(level) => level,
            Err(error) => {
                self.transfer
                    .lock()
                    .await
                    .fail_activation_work(work, error)?;
                return Ok(Vec::new());
            }
        };
        if !self.transfer.lock().await.work_current(work) {
            return Ok(Vec::new());
        }
        let packet = match work.packet(&level) {
            Ok(packet) => packet,
            Err(error) => {
                self.transfer
                    .lock()
                    .await
                    .fail_activation_work(work, error)?;
                return Ok(Vec::new());
            }
        };
        if let Some(packet) = packet {
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

    pub(crate) async fn adopt_level(&self, level: PreparedLevel) {
        self.transfer.lock().await.active = Some(level);
    }

    pub(crate) async fn select_round(
        &self,
        playlist: PreparedPlaylist,
        current: usize,
        next: usize,
        seconds: f64,
    ) -> Result<()> {
        anyhow::ensure!(self.is_host(), "Room host authority unavailable");
        let packet = {
            let mut transfer = self.transfer.lock().await;
            transfer.set_round_time(seconds)?;
            let (revision, packet) = transfer.prepare_playlist(
                &playlist,
                i32::try_from(current)?,
                i32::try_from(next)?,
            )?;
            transfer.commit_playlist(revision, playlist);
            packet
        };
        self.send(packet).await
    }

    pub fn leaderboard(&self) -> PlayerLeaderboard {
        PlayerLeaderboard::new(self.local_steam_id)
    }
    pub async fn set_round_time(&self, seconds: f64) -> Result<()> {
        anyhow::ensure!(self.is_host(), "Room host authority unavailable");
        self.transfer.lock().await.set_round_time(seconds)
    }

    pub(crate) async fn adopt_current_level(&self, level: PreparedLevel) -> Result<bool> {
        let mut transfer = self.transfer.lock().await;
        anyhow::ensure!(self.is_host(), "Room host authority unavailable");
        transfer.adopt_current_level(level)
    }

    pub(crate) async fn set_visibility(&self, public: bool) -> Result<()> {
        self.send(zc_core::zeepnet::change_lobby_visibility_packet(public)?)
            .await
    }
}

#[derive(Debug)]
pub(crate) enum ConnectionFailure {
    InitialStateTimeout,
    HostAuthorityLost,
}

impl std::fmt::Display for ConnectionFailure {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(match self {
            Self::InitialStateTimeout => "Lobby initial state timed out",
            Self::HostAuthorityLost => "Managed account lost lobby ownership",
        })
    }
}

impl std::error::Error for ConnectionFailure {}

struct ConnectionTermination {
    connection: Arc<GameConnection>,
    lobby: String,
    result: Result<()>,
}

pub struct ManagedLobbyHost {
    config: ManagedRoomConfig,
    database: zc_database::Database,
    broker: RoomBrokerClient,
    profile: Arc<dyn LobbyProfile>,
    stopped: AtomicBool,
    owner: Mutex<()>,
    last_packet_dump: Mutex<Option<tokio::time::Instant>>,
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
            owner: Mutex::new(()),
            last_packet_dump: Mutex::new(None),
            wake: Notify::new(),
        }
    }

    async fn run_loop(&self) -> Result<()> {
        if !self.config.enabled {
            return Ok(());
        }
        let Ok(_owner) = self.owner.try_lock() else {
            return Ok(());
        };
        let mut retry = RetryBackoff::new(self.config.reconnect_max_ms);
        while !self.stopped.load(Ordering::Acquire) {
            let prepared = tokio::select! {
                biased;
                _ = wait_for_stop(&self.stopped, &self.wake) => break,
                prepared = self.profile.prepare() => prepared,
            };
            let mut termination = None;
            let poll_only = match prepared {
                Ok(Some(_)) => {
                    match self.connect_once(&mut retry).await {
                        Ok(ended) => termination = ended,
                        Err(error) => {
                            tracing::warn!(room = %self.config.key, profile = self.profile.name(), error = %zc_core::zeepnet::sanitize_lidgren_disconnect_reason(&format!("{error:#}")), "Managed room setup failed")
                        }
                    }
                    false
                }
                Ok(None) => true,
                Err(error) => {
                    tracing::warn!(room = %self.config.key, %error, "Managed room asset preparation failed");
                    false
                }
            };
            let stopping = self.stopped.load(Ordering::Acquire);
            let mut delay = retry.wait_delay(poll_only.then_some(self.config.asset_poll_ms));
            if !poll_only {
                delay = retry.jitter(delay, uuid::Uuid::new_v4().as_u128() as u64);
            }
            if let Some(ConnectionTermination {
                connection,
                lobby,
                result,
            }) = termination
            {
                let now = tokio::time::Instant::now();
                let mut last = self.last_packet_dump.lock().await;
                let dump = result.is_err()
                    && last.is_none_or(|last| now - last >= Duration::from_secs(60));
                if dump {
                    *last = Some(now);
                }
                connection.log_termination(
                    &lobby,
                    self.profile.name(),
                    &result,
                    dump,
                    (!stopping).then_some(delay),
                );
            }
            if stopping {
                break;
            }
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

    async fn connect_once(
        &self,
        retry: &mut RetryBackoff,
    ) -> Result<Option<ConnectionTermination>> {
        let mut join = tokio::select! {
            lock = self.broker.join.lock() => lock,
            _ = wait_for_stop(&self.stopped, &self.wake) => return Ok(None),
        };
        if let Some(deadline) = *join {
            tokio::select! {
                _ = tokio::time::sleep_until(deadline) => {},
                _ = wait_for_stop(&self.stopped, &self.wake) => return Ok(None),
            }
        }
        // An incomplete handoff can leave membership stale for the next room.
        *join = Some(tokio::time::Instant::now() + Duration::from_secs(30));
        let join_id = self
            .database
            .managed_lobby_join_id(&self.config.key)
            .await?;
        let mut resolved_config = self.config.clone();
        if self.stopped.load(Ordering::Acquire) {
            return Ok(None);
        }
        if let Some(name) = self.profile.room_name() {
            resolved_config.room.name = name;
        }
        resolved_config.room.is_public = false;
        // Assignment may already have created a room. Complete the handoff even
        // after disable, then retire that room through the normal connection path.
        tracing::debug!(room = %self.config.key, "Requesting master room assignment");
        let assignment = self
            .broker
            .assign(&resolved_config, join_id.as_deref())
            .await;
        *join = Some(tokio::time::Instant::now() + Duration::from_secs(30));
        let assignment = assignment?;
        let persistence = if join_id.as_deref() != Some(&assignment.join_id) {
            self.database
                .set_managed_lobby_join_id(&self.config.key, &assignment.join_id)
                .await
        } else {
            Ok(())
        };
        let connection = GameConnection::connect(&assignment).await;
        if let Err(error) = persistence {
            if let Ok(connection) = connection {
                let _ = tokio::time::timeout(
                    Duration::from_secs(2),
                    connection.close("Managed room join ID could not be stored"),
                )
                .await;
            }
            *join = Some(tokio::time::Instant::now() + Duration::from_secs(30));
            return Err(error.context("Store managed room join ID"));
        }
        *join = Some(tokio::time::Instant::now() + Duration::from_secs(30));
        let connection = Arc::new(connection?);
        *join = None;
        drop(join);
        let room = ConnectedRoom {
            config: &self.config,
            profile: self.profile.as_ref(),
            connection: connection.clone(),
            local_steam_id: assignment.steam_id()?,
            player_uid: assignment.player_uid,
            stopped: &self.stopped,
            wake: &self.wake,
        };
        let result = zc_telemetry::observe_operation("lobby.connect", room.run(retry)).await;
        Ok(Some(ConnectionTermination {
            connection,
            lobby: assignment.join_id,
            result,
        }))
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
            async fn load(&self, uid: &str, _: u64) -> Result<Option<PreparedLevel>> {
                self.started.add_permits(1);
                self.release.acquire().await?.forget();
                let mut prepared = level();
                prepared.level.uid = uid.into();
                Ok(Some(prepared))
            }
        }
        let (context, mut packets) = activation_context()?;
        let started = Arc::new(tokio::sync::Semaphore::new(0));
        let release = Arc::new(tokio::sync::Semaphore::new(0));
        let mut rotation = level().level;
        rotation.uid = "rotation".into();
        let playlist = PreparedPlaylist::new(
            vec![level().level, rotation],
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
                uid: "rotation".into(),
                workshop_id: 1,
                name: "Test".into(),
            })?
            .unwrap();
        let loading = tokio::spawn({
            let context = context.clone();
            async move { context.execute_transfer(&work).await }
        });
        tokio::time::timeout(std::time::Duration::from_secs(1), started.acquire())
            .await??
            .forget();
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
