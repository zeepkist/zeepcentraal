use super::{LobbyProfile, ProfileSession, RoomContext, retry::RetryBackoff, wait_for_stop};
use crate::{
    chat::{
        PacketSender, RoomChat,
        audit::{log_chat_audit_line, resolve_chat_audit_line},
    },
    config::{ManagedRoomConfig, RoomProfile, TournamentType},
    game_connection::GameConnection,
    roster::RoomRoster,
    transfer::LevelTransfer,
};
use anyhow::{Result, bail, ensure};
use std::{
    future::pending,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};
use tokio::{
    sync::{Mutex, Notify},
    task::{JoinHandle, JoinSet},
    time::Instant,
};
use zc_core::zeepnet::{
    GameHostPacket, LobbyTiming, RemoteClock, change_lobby_master_packet, change_lobby_name_packet,
    change_lobby_visibility_packet, kick_player_packet,
};

const RECOVERY_TIMEOUT: Duration = Duration::from_secs(30);
const CHAT_DELAY: Duration = Duration::from_secs(5);
const STARTUP_SETTLE: Duration = Duration::from_millis(3_500);

#[async_trait::async_trait]
pub(super) trait RoomConnection: PacketSender {
    async fn recv(&self) -> Result<Option<GameHostPacket>>;
    async fn close(&self, reason: &str) -> Result<()>;
    fn remote_clock(&self) -> RemoteClock;
}

#[async_trait::async_trait]
impl PacketSender for GameConnection {
    async fn send(&self, packet: Vec<u8>) -> Result<()> {
        GameConnection::send(self, packet).await
    }
}

#[async_trait::async_trait]
impl RoomConnection for GameConnection {
    async fn recv(&self) -> Result<Option<GameHostPacket>> {
        GameConnection::recv(self).await
    }
    async fn close(&self, reason: &str) -> Result<()> {
        GameConnection::close(self, reason).await
    }
    fn remote_clock(&self) -> RemoteClock {
        GameConnection::remote_clock(self)
    }
}

// Each session gets its own flag. Retired sessions never regain send authority,
// including detached welcome tasks and LevelTransfer's direct sender calls.
struct HostSender {
    connection: Arc<dyn RoomConnection>,
    authority: Arc<AtomicBool>,
}

#[async_trait::async_trait]
impl PacketSender for HostSender {
    async fn send(&self, packet: Vec<u8>) -> Result<()> {
        ensure!(
            self.authority.load(Ordering::Acquire),
            "Room host authority unavailable"
        );
        self.connection.send(packet).await
    }
}

pub(super) struct ConnectedRoom<'a> {
    pub config: &'a ManagedRoomConfig,
    pub profile: &'a dyn LobbyProfile,
    pub connection: Arc<dyn RoomConnection>,
    pub local_steam_id: u64,
    pub player_uid: u32,
    pub stopped: &'a AtomicBool,
    pub wake: &'a Notify,
}

struct Recovery {
    since: Instant,
    chat_sent: bool,
}

struct ActiveSession {
    profile: Arc<dyn ProfileSession>,
    context: RoomContext,
    task: Option<JoinHandle<Result<()>>>,
}

impl ActiveSession {
    async fn stop(&mut self) {
        self.context.authority.store(false, Ordering::Release);
        if let Some(task) = self.task.take() {
            task.abort();
            let _ = task.await;
        }
        self.profile.stop().await;
        self.context.transfer.lock().await.close();
    }
}

struct RoomState {
    host: bool,
    schedule_authority: Arc<AtomicBool>,
    roster: Arc<Mutex<RoomRoster>>,
    timing: Option<LobbyTiming>,
    recovery: Option<Recovery>,
    active: Option<ActiveSession>,
    controls: JoinSet<Result<()>>,
    initial_deadline: Instant,
    settle_at: Instant,
}

impl RoomState {
    fn new() -> Self {
        let now = Instant::now();
        Self {
            host: false,
            schedule_authority: Arc::new(AtomicBool::new(false)),
            roster: Arc::new(Mutex::new(RoomRoster::default())),
            timing: None,
            recovery: None,
            active: None,
            controls: JoinSet::new(),
            initial_deadline: now + RECOVERY_TIMEOUT,
            settle_at: now + STARTUP_SETTLE,
        }
    }

    fn timeout_deadline(&self) -> Option<Instant> {
        self.recovery
            .as_ref()
            .map(|r| r.since + RECOVERY_TIMEOUT)
            .or_else(|| self.timing.is_none().then_some(self.initial_deadline))
    }

    fn chat_deadline(&self) -> Option<Instant> {
        self.recovery
            .as_ref()
            .filter(|r| !r.chat_sent)
            .map(|r| r.since + CHAT_DELAY)
    }

    fn observe_timing(&mut self, packet: &GameHostPacket) {
        match packet {
            GameHostPacket::Initial { timing, .. } => self.timing = Some(timing.clone()),
            GameHostPacket::GameState(game_state) => {
                if let Some(timing) = &mut self.timing {
                    timing.game_state = *game_state;
                }
            }
            GameHostPacket::GameProperties {
                level_loaded_at,
                round_time,
                uid,
                workshop_id,
            } if level_loaded_at.is_finite() && round_time.is_finite() && *round_time >= 0.0 => {
                if let Some(timing) = &mut self.timing {
                    timing.level_loaded_at = *level_loaded_at;
                    timing.round_time = *round_time;
                    timing.uid = uid.clone();
                    timing.workshop_id = *workshop_id;
                }
            }
            _ => {}
        }
    }
}

impl ConnectedRoom<'_> {
    pub(super) async fn run(&self, retry: &mut RetryBackoff) -> Result<()> {
        let mut state = RoomState::new();
        let authority = state.schedule_authority.clone();
        let (result, scheduled) = tokio::select! {
            biased;
            _ = wait_for_stop(self.stopped, self.wake) => (Ok(()), false),
            _ = self.watch_schedule(authority) => (Ok(()), true),
            result = self.drive(&mut state, retry) => (result, false),
        };
        retry.lost_host(Instant::now());
        state.controls.shutdown().await;
        if let Some(mut active) = state.active.take() {
            active.stop().await;
        }
        if (scheduled || self.stopped.load(Ordering::Acquire)) && !state.host {
            // Covers disable during assignment/connection and host recovery.
            state.host = self.recover_shutdown_authority(&state.roster).await;
        }
        if state.host
            && let Err(error) = self
                .connection
                .send(change_lobby_visibility_packet(false)?)
                .await
        {
            tracing::warn!(%error, "Could not make retiring room private");
        }
        if scheduled
            && state.host
            && let Err(error) = self.kick_guests(&state.roster).await
        {
            tracing::warn!(%error, "Scheduled room kicks failed");
        }
        let reason = if scheduled {
            "ZSL practice closed for tournament"
        } else if self.stopped.load(Ordering::Acquire) {
            "Managed room disabled or stopped"
        } else {
            "Managed room reconnecting"
        };
        let _ = self.connection.close(reason).await;
        if scheduled {
            self.profile.scheduled_closed().await?;
        }
        result
    }

    // Separate future remains live while session packet handling awaits assets or DB.
    async fn watch_schedule(&self, authority: Arc<AtomicBool>) {
        let mut tick = tokio::time::interval(Duration::from_millis(100));
        tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        let mut notices = crate::profiles::practice::ClosureNotices::default();
        let refresh = || async {
            tokio::time::sleep(Duration::from_secs(30)).await;
            self.profile.refresh_schedule().await
        };
        let mut pending_refresh = Box::pin(refresh());
        loop {
            tokio::select! {
                biased;
                _ = tick.tick() => {
                    if let Some(deadline) = self.profile.close_at() {
                        let now = jiff::Timestamp::now();
                        if now >= deadline { return; }
                        if notices.due(deadline, now) && authority.load(Ordering::Acquire) {
                            let result = tokio::time::timeout(Duration::from_secs(1), RoomChat::new(self.connection.clone()).target(0, crate::profiles::practice::CLOSURE_MESSAGE, crate::profiles::messages::HOSTNAME)).await;
                            if !matches!(result, Ok(Ok(()))) { tracing::warn!("Practice closure notice failed"); }
                        }
                    }
                }
                result = &mut pending_refresh => {
                    if let Err(error) = result { tracing::warn!(%error, "Practice schedule refresh failed"); }
                    pending_refresh = Box::pin(refresh());
                }
            }
        }
    }

    async fn recover_shutdown_authority(&self, roster: &Arc<Mutex<RoomRoster>>) -> bool {
        let deadline = Instant::now() + Duration::from_secs(5);
        if !matches!(
            tokio::time::timeout_at(
                deadline,
                self.connection
                    .send(change_lobby_master_packet(self.player_uid).unwrap())
            )
            .await,
            Ok(Ok(()))
        ) {
            return false;
        }
        loop {
            tokio::select! {
                _ = tokio::time::sleep_until(deadline) => return false,
                packet = self.connection.recv() => match packet {
                    Ok(Some(packet)) => {
                        roster.lock().await.observe(&packet);
                        if matches!(packet, GameHostPacket::Initial { is_host: true, .. })
                            || matches!(packet, GameHostPacket::Master(uid) if uid == self.player_uid) { return true; }
                    }
                    _ => return false,
                }
            }
        }
    }

    async fn kick_guests(&self, roster: &Arc<Mutex<RoomRoster>>) -> Result<()> {
        let mut kicked = std::collections::HashSet::new();
        let mut deadline = Instant::now() + Duration::from_secs(2);
        loop {
            let players = roster.lock().await.all();
            for player in players {
                if player.uid != self.player_uid && kicked.insert(player.uid) {
                    self.connection
                        .send(kick_player_packet(player.uid)?)
                        .await?;
                    // Drain in-flight joins after the last acknowledged kick.
                    deadline = Instant::now() + Duration::from_secs(2);
                }
            }
            tokio::select! {
                _ = tokio::time::sleep_until(deadline) => return Ok(()),
                _ = wait_for_stop(self.stopped, self.wake) => return Ok(()),
                packet = self.connection.recv() => {
                    let Some(packet) = packet? else { return Ok(()); };
                    roster.lock().await.observe(&packet);
                }
            }
        }
    }

    async fn start_session(&self, state: &mut RoomState) -> Result<()> {
        let authority = Arc::new(AtomicBool::new(true));
        let sender: Arc<dyn PacketSender> = Arc::new(HostSender {
            connection: self.connection.clone(),
            authority: authority.clone(),
        });
        let context = RoomContext {
            transfer: Arc::new(Mutex::new(LevelTransfer::new(
                sender.clone(),
                self.config.round_time_seconds as f64,
                RECOVERY_TIMEOUT,
            )?)),
            sender,
            roster: state.roster.clone(),
            authority,
            remote_clock: self.connection.remote_clock(),
            local_steam_id: self.local_steam_id,
        };
        let profile = self.profile.create_session(context.clone()).await?;
        state.active = Some(ActiveSession {
            profile: profile.clone(),
            context: context.clone(),
            task: None,
        });
        // Recovery consumed Initial/roster/timing packets before this session existed.
        let initial = GameHostPacket::Initial {
            is_host: true,
            players: state.roster.lock().await.all(),
            timing: state
                .timing
                .clone()
                .expect("session requires initial state"),
        };
        profile.on_packet(&initial).await?;
        let is_public = self.config.room.is_public;
        let room_name = self.profile.room_name();
        let task = tokio::spawn(async move {
            if let Some(name) = room_name {
                context.send(change_lobby_name_packet(&name)?).await?;
            }
            context
                .send(change_lobby_visibility_packet(is_public)?)
                .await?;
            profile.start().await
        });
        state.active.as_mut().expect("session created").task = Some(task);
        Ok(())
    }

    async fn drive(&self, state: &mut RoomState, retry: &mut RetryBackoff) -> Result<()> {
        loop {
            if state.host
                && state.timing.is_some()
                && state.active.is_none()
                && Instant::now() >= state.settle_at
            {
                self.start_session(state).await?;
            }
            let settle = (state.host && state.timing.is_some() && state.active.is_none())
                .then_some(state.settle_at);
            tokio::select! {
                biased;
                _ = sleep_until(state.timeout_deadline()) => {
                    tracing::warn!(room = %self.config.key, profile = self.profile.name(), "Managed room host recovery timed out");
                    bail!(if state.timing.is_none() { "Lobby initial state timed out" } else { "Managed account lost lobby ownership" });
                }
                _ = sleep_until(state.chat_deadline()) => {
                    state.recovery.as_mut().expect("chat requires recovery").chat_sent = true;
                    let connection = self.connection.clone();
                    let message = recovery_message(&self.config.profile);
                    state.controls.spawn(async move { RoomChat::new(connection).command(&message).await });
                }
                _ = sleep_until(retry.decay_deadline()) => retry.decay(Instant::now()),
                _ = sleep_until(settle) => {},
                result = state.controls.join_next(), if !state.controls.is_empty() => {
                    match result {
                        Some(Ok(Err(error))) => tracing::warn!(room = %self.config.key, profile = self.profile.name(), %error, "Managed room recovery packet failed"),
                        Some(Err(error)) if !error.is_cancelled() => tracing::warn!(room = %self.config.key, %error, "Managed room recovery task failed"),
                        _ => {}
                    }
                }
                result = async { state.active.as_mut().expect("active session").task.as_mut().expect("started session").await }, if state.active.is_some() => {
                    // This handle has yielded its result; cleanup must not poll it again.
                    state.active.as_mut().expect("active session").task.take();
                    return match result {
                        Ok(Ok(())) => Err(anyhow::anyhow!("Room profile stopped unexpectedly")),
                        Ok(Err(error)) => Err(error.context("Room profile start failed")),
                        Err(error) => Err(error.into()),
                    };
                }
                packet = self.connection.recv() => {
                    let packet = packet?.ok_or_else(|| anyhow::anyhow!("GameServer connection closed"))?;
                    self.on_packet(state, retry, &packet).await?;
                }
            }
        }
    }

    async fn on_packet(
        &self,
        state: &mut RoomState,
        retry: &mut RetryBackoff,
        packet: &GameHostPacket,
    ) -> Result<()> {
        let ownership = match packet {
            GameHostPacket::Initial { is_host, .. } => Some(*is_host),
            GameHostPacket::Master(uid) => Some(*uid == self.player_uid),
            // Other players' host powers (and is_host flags) are not local ownership.
            _ => None,
        };
        if ownership == Some(false)
            && let Some(active) = &state.active
        {
            active.context.authority.store(false, Ordering::Release);
        }
        let audit = {
            let mut roster = state.roster.lock().await;
            roster.observe(packet);
            if let GameHostPacket::Chat {
                message,
                sender_uid,
            } = packet
            {
                resolve_chat_audit_line(
                    &self.config.key,
                    &roster.names(),
                    *sender_uid,
                    message,
                    self.player_uid,
                )
            } else {
                None
            }
        };
        if let Some(line) = audit {
            log_chat_audit_line(&self.config.key, self.profile.name(), &line);
        }
        state.observe_timing(packet);
        if let Some(host) = ownership {
            state.host = host;
            state.schedule_authority.store(host, Ordering::Release);
            if host {
                retry.confirmed_host(Instant::now());
                if let Some(recovery) = state.recovery.take() {
                    state.controls.abort_all();
                    tracing::info!(room = %self.config.key, profile = self.profile.name(), elapsed_ms = recovery.since.elapsed().as_millis() as u64, "Managed room host ownership recovered");
                }
            } else {
                retry.lost_host(Instant::now());
                // Keep the session reachable by outer cleanup if shutdown cancels
                // this retirement while aborting the task or stopping the profile.
                if let Some(active) = state.active.as_mut() {
                    active.stop().await;
                }
                state.active = None;
                if state.timing.is_some() && state.recovery.is_none() {
                    state.recovery = Some(Recovery {
                        since: Instant::now(),
                        chat_sent: false,
                    });
                    tracing::info!(room = %self.config.key, profile = self.profile.name(), "Managed room host recovery started");
                    let connection = self.connection.clone();
                    let packet = change_lobby_master_packet(self.player_uid)?;
                    state
                        .controls
                        .spawn(async move { connection.send(packet).await });
                }
            }
        }
        if state.host
            && let Some(active) = &state.active
        {
            if matches!(packet, GameHostPacket::LevelRequest { .. }) {
                let events = {
                    let mut transfer = active.context.transfer.lock().await;
                    transfer.request(packet)?;
                    transfer.process_next().await?
                };
                if let Some(events) = events {
                    for event in &events {
                        active.profile.on_transfer(event).await?;
                    }
                }
            }
            active.profile.on_packet(packet).await?;
        }
        Ok(())
    }
}

async fn sleep_until(deadline: Option<Instant>) {
    match deadline {
        Some(deadline) => tokio::time::sleep_until(deadline).await,
        None => pending().await,
    }
}

fn recovery_message(profile: &RoomProfile) -> String {
    let label = match profile {
        RoomProfile::TrackTournament {
            tournament_type: TournamentType::Weekly,
        } => "Track of the Week",
        RoomProfile::TrackTournament {
            tournament_type: TournamentType::Monthly,
        } => "Track of the Month",
        RoomProfile::ZslSubmissions { .. } => "ZSL submissions",
        RoomProfile::ZslPractice { .. } => "ZSL practice",
    };
    format!(
        "ZeepCentraal needs host back to keep this room operating for {label}. Please return host to ZeepCentraal."
    )
}

#[cfg(test)]
mod tests;
