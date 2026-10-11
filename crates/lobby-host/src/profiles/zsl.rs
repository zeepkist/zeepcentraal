//! One connection owns practice, warm-up, tournament, and retirement.
use super::{
    assets::{PracticeAssets, SubmissionAsset, SubmissionPlaylist, pinned_asset},
    messages::{HOSTNAME, escape_text, server_message},
    zsl_messages,
};
use crate::{
    config::{ManagedRoomConfig, RoomProfile},
    leaderboard::{DesiredPlayerStanding, PlayerLeaderboard},
    runtime::{LobbyProfile, ProfileSession, RoomContext},
    transfer::{ActivationTimeout, TransferEvent, TransferEventKind},
};
use anyhow::{Context, Result, ensure};
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    sync::{
        Arc, RwLock,
        atomic::{AtomicBool, Ordering},
    },
    time::{Duration, Instant},
};
use tokio::sync::{Mutex, MutexGuard, Notify};
use zc_core::{
    object_storage::ObjectStorage,
    practice::PracticeBundle,
    zeepnet::{GameHostPacket, LeaderboardOverrides, change_lobby_name_packet},
};
use zc_database::{
    Database,
    services::zsl_tournament::{ZslEvent, ZslFinish},
};

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum Phase {
    #[default]
    Waiting,
    Practice,
    Warmup,
    Tournament,
    Retired,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PendingFinish {
    steam_id: u64,
    name: String,
    level_id: i32,
    timeslot: i32,
    microseconds: i64,
    received_at_ms: i64,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct SavedState {
    pinned: Option<PracticeBundle>,
    warmup: Option<PracticeBundle>,
    completed: [bool; 2],
    failed: [bool; 2],
    retired: [bool; 2],
    progress: [usize; 2],
    phase: Phase,
    timeslot: usize,
    index: usize,
    deadline: i64,
    starts: [Option<i64>; 2],
    announcements: HashSet<String>,
    pending: Vec<PendingFinish>,
}

impl SavedState {
    fn room_retired(&self, slot: usize, has_practice: bool) -> bool {
        self.retired[1]
            || (!has_practice && self.retired[slot] && (self.completed[slot] || self.failed[slot]))
    }
}
struct Shared {
    tournament: ManagedRoomConfig,
    practice: Option<ManagedRoomConfig>,
    round_id: i32,
    database: Database,
    storage: Arc<dyn ObjectStorage>,
    owner: String,
    event: RwLock<Option<ZslEvent>>,
    saved: Mutex<SavedState>,
    tournament_assets: PracticeAssets,
    warmup_assets: PracticeAssets,
    practice_assets: Option<PracticeAssets>,
    practice_asset: Mutex<Option<SubmissionAsset>>,
    pinned_asset: Mutex<Option<SubmissionAsset>>,
    warmup_asset: Mutex<Option<SubmissionAsset>>,
    stopped: AtomicBool,
    retire: AtomicBool,
}
pub struct ZslProfile {
    shared: Arc<Shared>,
}
impl ZslProfile {
    pub fn new(
        tournament: ManagedRoomConfig,
        practice: Option<ManagedRoomConfig>,
        database: Database,
        storage: Arc<dyn ObjectStorage>,
    ) -> Result<Self> {
        let RoomProfile::Zsl { round_id, playlist } = &tournament.profile else {
            anyhow::bail!("ZSL profile config required");
        };
        let round_id = *round_id;
        let practice_assets = practice.as_ref().map(|config| {
            let RoomProfile::ZslPractice { playlist, .. } = &config.profile else {
                unreachable!()
            };
            PracticeAssets::new(
                database.clone(),
                storage.clone(),
                round_id,
                playlist.clone(),
            )
        });
        Ok(Self {
            shared: Arc::new(Shared {
                tournament_assets: PracticeAssets::new(
                    database.clone(),
                    storage.clone(),
                    round_id,
                    playlist.clone(),
                ),
                warmup_assets: PracticeAssets::warmup(database.clone(), storage.clone(), round_id),
                tournament,
                practice,
                round_id,
                database,
                storage,
                owner: zc_core::generate_uid(),
                event: RwLock::new(None),
                saved: Mutex::new(SavedState::default()),
                practice_assets,
                practice_asset: Mutex::new(None),
                pinned_asset: Mutex::new(None),
                warmup_asset: Mutex::new(None),
                stopped: AtomicBool::new(false),
                retire: AtomicBool::new(false),
            }),
        })
    }
}
impl Shared {
    fn event(&self) -> Result<ZslEvent> {
        self.event
            .read()
            .unwrap()
            .clone()
            .context("ZSL schedule unavailable")
    }
    async fn save(&self, state: &SavedState) -> Result<()> {
        self.database
            .save_zsl_event(self.round_id, &self.owner, &serde_json::to_value(state)?)
            .await
    }
    async fn refresh_assets(&self, state: &mut SavedState) -> Result<()> {
        if state.pinned.is_none()
            && let SubmissionPlaylist::Ready(asset) =
                self.tournament_assets.refresh_for_event().await?
        {
            let bundle = asset
                .bundle
                .as_ref()
                .context("ZSL bundle metadata unavailable")?;
            if validate_tournament(bundle, self.tournament.round_time_seconds).is_ok() {
                preload(&asset).await?;
                state.pinned = Some((**bundle).clone());
                *self.pinned_asset.lock().await = Some(asset);
            }
        }
        if state.warmup.is_none()
            && let SubmissionPlaylist::Ready(asset) = self.warmup_assets.refresh().await?
        {
            let bundle = asset
                .bundle
                .as_ref()
                .context("Warm-up bundle metadata unavailable")?;
            ensure!(bundle.levels.len() == 4, "Warm-up must contain four levels");
            preload(&asset).await?;
            state.warmup = Some((**bundle).clone());
            *self.warmup_asset.lock().await = Some(asset);
        }
        if let Some(source) = &self.practice_assets
            && let SubmissionPlaylist::Ready(asset) = source.refresh().await?
        {
            *self.practice_asset.lock().await = Some(asset);
        }
        Ok(())
    }
    fn room_key(&self) -> &str {
        &self.practice.as_ref().unwrap_or(&self.tournament).key
    }
    async fn pinned(&self, bundle: &PracticeBundle, warmup: bool) -> Result<SubmissionAsset> {
        let mut cached = if warmup {
            self.warmup_asset.lock().await
        } else {
            self.pinned_asset.lock().await
        };
        if let Some(asset) = cached.as_ref() {
            return Ok(asset.clone());
        }
        let asset = pinned_asset(bundle.clone(), self.storage.clone())?;
        preload(&asset).await?;
        *cached = Some(asset.clone());
        Ok(asset)
    }
}
async fn preload(asset: &SubmissionAsset) -> Result<()> {
    for level in asset.playlist.levels.iter() {
        asset
            .load(&level.uid, level.workshop_id)
            .await?
            .context("ZSL payload unavailable")?;
    }
    Ok(())
}
#[async_trait::async_trait]
impl LobbyProfile for ZslProfile {
    fn name(&self) -> &str {
        "zsl"
    }
    fn kick_on_close(&self) -> bool {
        false
    }
    async fn refresh_schedule(&self) -> Result<()> {
        let mut event = self.shared.database.zsl_event(self.shared.round_id).await?;
        apply_saved_starts(&mut event, &*self.shared.saved.lock().await);
        *self.shared.event.write().unwrap() = Some(event);
        Ok(())
    }
    fn close_at(&self) -> Option<jiff::Timestamp> {
        self.shared
            .retire
            .load(Ordering::Acquire)
            .then(jiff::Timestamp::now)
    }
    async fn prepare(&self) -> Result<Option<crate::assets::PreparedLevel>> {
        let shared = &self.shared;
        if shared.stopped.load(Ordering::Acquire) {
            return Ok(None);
        }
        let mut event = shared.database.zsl_event(shared.round_id).await?;
        let Some(stored) = shared
            .database
            .claim_zsl_event(shared.round_id, &shared.owner)
            .await?
        else {
            return Ok(None);
        };
        let mut saved = shared.saved.lock().await;
        // Keep unsaved pending writes across reconnects within this process.
        let pending = std::mem::take(&mut saved.pending);
        *saved = serde_json::from_value(stored)?;
        apply_saved_starts(&mut event, &saved);
        *shared.event.write().unwrap() = Some(event.clone());
        for finish in pending {
            if !saved.pending.iter().any(|old| {
                old.steam_id == finish.steam_id
                    && old.level_id == finish.level_id
                    && old.microseconds == finish.microseconds
            }) {
                saved.pending.push(finish);
            }
        }
        if saved.retired[1] {
            return Ok(None);
        }
        if let Err(error) = shared.refresh_assets(&mut saved).await {
            tracing::warn!(%error,"ZSL asset preparation pending");
        }
        shared.save(&saved).await?;
        let now = jiff::Timestamp::now().as_second();
        let slot = if now >= event.second - 1200 { 1 } else { 0 };
        if now >= event_start(&event, slot)
            && saved.pinned.is_none()
            && saved.warmup.is_none()
            && shared.practice_asset.lock().await.is_none()
            && !saved.completed[slot]
        {
            saved.failed[slot] = true;
            saved.retired[slot] = true;
            saved.timeslot = slot;
            saved.phase = Phase::Retired;
            shared.save(&saved).await?;
            shared
                .database
                .clear_managed_lobby_join_id(shared.room_key())
                .await?;
            return Ok(None);
        }
        if saved.room_retired(slot, shared.practice.is_some()) {
            return Ok(None);
        }
        if shared.practice.is_none() && now < event.first - 1200 {
            return Ok(None);
        }
        if shared.practice.is_none() && slot == 0 && (saved.completed[0] || saved.failed[0]) {
            return Ok(None);
        }
        shared.retire.store(false, Ordering::Release);
        if let Some(bundle) = &saved.pinned
            && now >= event_start(&event, slot)
            && !(saved.completed[slot] || saved.failed[slot])
        {
            let index = scheduled_index(now, event_start(&event, slot), bundle.levels.len());
            let asset = shared.pinned(bundle, false).await?;
            let level = &asset.playlist.levels[index];
            return asset.load(&level.uid, level.workshop_id).await;
        }
        if now >= event_start(&event, slot) - 1200
            && let Some(bundle) = &saved.warmup
        {
            let asset = shared.pinned(bundle, true).await?;
            return Ok(Some(asset.first().await?));
        }
        if let Some(asset) = shared.practice_asset.lock().await.clone() {
            return Ok(Some(asset.first().await?));
        }
        Ok(None)
    }
    async fn create_session(&self, context: RoomContext) -> Result<Arc<dyn ProfileSession>> {
        Ok(Arc::new(ZslSession {
            board: Mutex::new(context.leaderboard()),
            context,
            shared: self.shared.clone(),
            live: Mutex::new(LiveState::default()),
            stopped: AtomicBool::new(false),
            wake: Notify::new(),
        }))
    }
    async fn scheduled_closed(&self) -> Result<()> {
        let mut state = self.shared.saved.lock().await;
        let slot = state.timeslot.min(1);
        self.shared
            .database
            .clear_managed_lobby_join_id(self.shared.room_key())
            .await?;
        state.retired[slot] = true;
        self.shared.save(&state).await?;
        Ok(())
    }
    async fn stop(&self) -> Result<()> {
        self.shared.stopped.store(true, Ordering::Release);
        self.shared
            .database
            .release_zsl_event(self.shared.round_id, &self.shared.owner)
            .await
    }
}
#[derive(Default)]
struct LiveState {
    active: Option<(Phase, usize, usize)>,
    asset: Option<SubmissionAsset>,
    ready: Option<(String, u64)>,
    current_level_id: Option<i32>,
    records: HashMap<u64, i64>,
    finishes: Vec<ZslFinish>,
    last_save: Option<Instant>,
    last_assets: Option<Instant>,
    last_board: Option<Instant>,
    last_overlay: Option<Instant>,
    generation: u64,
    failed_activation: Option<((Phase, usize, usize), u8)>,
}

#[derive(Debug)]
struct TransitionFailed;
impl std::fmt::Display for TransitionFailed {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("ZSL transition failed; reconnecting host")
    }
}
impl std::error::Error for TransitionFailed {}

#[derive(Debug)]
struct TransitionExpired;
impl std::fmt::Display for TransitionExpired {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("ZSL transition deadline elapsed; recomputing scheduled level")
    }
}
impl std::error::Error for TransitionExpired {}

struct PreparedTransition {
    phase: Phase,
    slot: usize,
    index: usize,
    generation: u64,
    asset: SubmissionAsset,
    level: crate::assets::PreparedLevel,
    deadline: i64,
    seconds: f64,
    scoring_level: Option<i32>,
    title: String,
}
struct ZslSession {
    shared: Arc<Shared>,
    context: RoomContext,
    live: Mutex<LiveState>,
    board: Mutex<PlayerLeaderboard>,
    stopped: AtomicBool,
    wake: Notify,
}
impl ZslSession {
    async fn announce(&self, message: &str) -> Result<()> {
        self.context.chat().target(0, message, HOSTNAME).await
    }
    async fn once(&self, state: &mut SavedState, key: String, message: &str) -> Result<()> {
        if !state.announcements.contains(&key) {
            self.announce(message).await?;
            state.announcements.insert(key);
            self.shared.save(state).await?;
        }
        Ok(())
    }
    async fn flush(&self, state: &mut SavedState) -> Result<()> {
        while let Some(finish) = state.pending.first().cloned() {
            let users = self
                .shared
                .database
                .upsert_zsl_users(&[(i64::try_from(finish.steam_id)?, finish.name)])
                .await?;
            let user_id = *users
                .get(&(finish.steam_id as i64))
                .context("ZSL player identity unavailable")?;
            self.shared
                .database
                .submit_zsl_finish(
                    self.shared.round_id,
                    &self.shared.owner,
                    finish.timeslot,
                    finish.level_id,
                    user_id,
                    finish.microseconds,
                    finish.received_at_ms,
                )
                .await?;
            state.pending.remove(0);
            self.shared.save(state).await?;
        }
        Ok(())
    }
    async fn scoring_level(&self, bundle: &PracticeBundle, index: usize) -> Result<Option<i32>> {
        let entry = &bundle.levels[index];
        if !entry.level.name.starts_with("ZSL") {
            return Ok(None);
        }
        let level = self
            .shared
            .database
            .resolve_submission_level(
                entry
                    .legacy_hash
                    .as_deref()
                    .context("ZSL legacy hash unavailable")?,
                entry
                    .xx_hash
                    .as_deref()
                    .context("ZSL canonical hash unavailable")?,
                false,
            )
            .await?;
        Ok(Some(
            self.shared
                .database
                .get_or_create_zsl_level(self.shared.round_id, level.id)
                .await?
                .id,
        ))
    }
    async fn close_elapsed(
        &self,
        state: &mut SavedState,
        event: &ZslEvent,
        slot: usize,
        now: i64,
    ) -> Result<()> {
        let bundle = state.pinned.clone().context("ZSL playlist unavailable")?;
        while state.progress[slot] < bundle.levels.len() {
            let index = state.progress[slot];
            let deadline = event_start(event, slot) + (index as i64 + 1) * 420;
            if now < deadline {
                break;
            }
            let level_id = self.scoring_level(&bundle, index).await?;
            self.shared
                .database
                .open_zsl_level(
                    self.shared.round_id,
                    &self.shared.owner,
                    slot as i32 + 1,
                    index as i32,
                    level_id,
                    deadline,
                )
                .await?;
            self.shared
                .database
                .close_zsl_level(
                    self.shared.round_id,
                    &self.shared.owner,
                    slot as i32 + 1,
                    index as i32,
                )
                .await?;
            state.progress[slot] += 1;
            self.shared.save(state).await?;
        }
        Ok(())
    }
    async fn finish(&self, state: &mut SavedState, event: &ZslEvent, slot: usize) -> Result<()> {
        if slot == 1 {
            let count = state
                .pinned
                .as_ref()
                .context("ZSL playlist unavailable")?
                .levels
                .iter()
                .filter(|entry| entry.level.name.starts_with("ZSL"))
                .count();
            self.shared
                .database
                .publish_zsl_results(self.shared.round_id, &self.shared.owner, count as i32)
                .await?;
        }
        state.completed[slot] = true;
        self.shared.save(state).await?;
        self.once(
            state,
            format!("thanks:{slot}"),
            &zsl_messages::thanks(event, slot == 1),
        )
        .await?;
        if slot == 1 || self.shared.practice.is_none() {
            self.context
                .send(change_lobby_name_packet("Post ZSL Lobby")?)
                .await?;
            state.phase = Phase::Retired;
            state.timeslot = slot;
            self.shared.save(state).await?;
            self.shared.retire.store(true, Ordering::Release);
        }
        Ok(())
    }
    #[allow(clippy::too_many_arguments)]
    async fn activate<'a>(
        &'a self,
        mut state: MutexGuard<'a, SavedState>,
        mut live: MutexGuard<'a, LiveState>,
        phase: Phase,
        slot: usize,
        index: usize,
        asset: SubmissionAsset,
        deadline: i64,
    ) -> Result<(MutexGuard<'a, SavedState>, MutexGuard<'a, LiveState>)> {
        if live.active == Some((phase, slot, index)) {
            return Ok((state, live));
        }
        // Single transition owner; no retired profile tasks can send after generation changes.
        live.generation += 1;
        live.ready = None;
        live.records.clear();
        live.current_level_id = None;
        live.asset = None;
        let seconds = if phase == Phase::Practice {
            self.shared
                .practice
                .as_ref()
                .context("Practice config unavailable")?
                .round_time_seconds as f64
        } else {
            (deadline - jiff::Timestamp::now().as_second()).max(1) as f64
        };
        self.context.set_round_time(seconds).await?;
        let level = &asset.playlist.levels[index];
        let prepared = asset
            .load(&level.uid, level.workshop_id)
            .await?
            .context("ZSL level payload unavailable")?;
        let mut scoring_level = None;
        if phase == Phase::Tournament {
            let bundle = state.pinned.as_ref().context("ZSL playlist unavailable")?;
            scoring_level = self.scoring_level(bundle, index).await?;
            self.shared
                .database
                .open_zsl_level(
                    self.shared.round_id,
                    &self.shared.owner,
                    slot as i32 + 1,
                    index as i32,
                    scoring_level,
                    deadline,
                )
                .await?;
        }
        state.phase = phase;
        state.timeslot = slot;
        state.index = index;
        state.deadline = deadline;
        self.shared.save(&state).await?;
        let title = if phase == Phase::Practice {
            format!("ZSL {} Practice", self.shared.event()?.name)
        } else {
            format!(
                "Zeepkist Super League: {} (Timeslot {})",
                self.shared.event()?.name,
                slot + 1
            )
        };
        let transition = PreparedTransition {
            phase,
            slot,
            index,
            generation: live.generation,
            asset,
            level: prepared,
            deadline,
            seconds,
            scoring_level,
            title,
        };
        self.execute_and_commit(state, live, transition).await
    }

    async fn execute_and_commit<'a>(
        &'a self,
        state: MutexGuard<'a, SavedState>,
        live: MutexGuard<'a, LiveState>,
        transition: PreparedTransition,
    ) -> Result<(MutexGuard<'a, SavedState>, MutexGuard<'a, LiveState>)> {
        let PreparedTransition {
            phase,
            slot,
            index,
            deadline,
            ..
        } = transition;
        // Packet callbacks need these locks before LevelRequest can reach transfer.
        // Never retain either guard while waiting for server confirmation.
        drop(live);
        drop(state);
        let outcome = self.execute_transition(&transition).await;
        let state = self.shared.saved.lock().await;
        let mut live = self.live.lock().await;
        ensure!(
            self.context.is_host()
                && !self.stopped.load(Ordering::Acquire)
                && live.generation == transition.generation,
            TransitionFailed
        );
        if let Err(error) = outcome {
            if error.is::<ActivationTimeout>() {
                let target = (phase, slot, index);
                let failures = live
                    .failed_activation
                    .filter(|(previous, _)| *previous == target)
                    .map_or(1, |(_, failures)| failures + 1);
                live.failed_activation = Some((target, failures));
                if failures == 1 {
                    tracing::warn!(generation = transition.generation, phase = ?phase, slot, index, %error, "ZSL activation retry scheduled");
                    return Err(error);
                }
                tracing::error!(generation = transition.generation, phase = ?phase, slot, index, failures, %error, "ZSL activation retries exhausted; reconnecting host");
            } else if error.is::<TransitionExpired>() {
                return Err(error);
            } else {
                tracing::warn!(generation = transition.generation, phase = ?phase, slot, index, %error, "ZSL transition failed; reconnecting host");
            }
            return Err(error.context(TransitionFailed));
        }
        ensure!(
            phase == Phase::Practice || jiff::Timestamp::now().as_second() < deadline,
            TransitionExpired
        );
        live.ready = Some((
            transition.level.level.uid.clone(),
            transition.level.level.workshop_id,
        ));
        live.active = Some((phase, slot, index));
        live.current_level_id = transition.scoring_level;
        live.asset = Some(transition.asset);
        live.failed_activation = None;
        live.last_overlay = None;
        live.last_board = None;
        tracing::info!(generation = transition.generation, phase = ?phase, slot, index, "ZSL transition committed");
        Ok((state, live))
    }

    async fn execute_transition(&self, transition: &PreparedTransition) -> Result<()> {
        let PreparedTransition {
            phase,
            slot,
            index,
            generation,
            asset,
            level,
            deadline,
            seconds,
            title,
            ..
        } = transition;
        ensure!(
            *phase == Phase::Practice || jiff::Timestamp::now().as_second() < *deadline,
            TransitionExpired
        );
        tracing::info!(generation, phase = ?phase, slot, index, uid = %level.level.uid, "ZSL transition executing");
        self.context.send(change_lobby_name_packet(title)?).await?;
        let packets = {
            let mut board = self.board.lock().await;
            board.clear_standings();
            board.set_ready(false);
            board.reconcile()?
        };
        for packet in packets {
            self.context.send(packet).await?;
        }
        self.context
            .activate(level.clone(), Some(asset.playlist.clone()))
            .await?;
        ensure!(
            *phase == Phase::Practice || jiff::Timestamp::now().as_second() < *deadline,
            TransitionExpired
        );
        if *phase == Phase::Practice {
            self.context.set_round_time(*seconds).await?;
        } else {
            self.context.set_level_deadline(level, *deadline).await?;
        }
        let next = if *phase == Phase::Tournament {
            (index + 1).min(asset.playlist.levels.len() - 1)
        } else {
            (index + 1) % asset.playlist.levels.len()
        };
        self.context
            .update_playlist(asset.playlist.clone(), *index as i32, next as i32)
            .await?;
        Ok(())
    }
    async fn tick(&self) -> Result<()> {
        if !self.context.is_host()
            || self.stopped.load(Ordering::Acquire)
            || self.shared.retire.load(Ordering::Acquire)
        {
            return Ok(());
        }
        let event = self.shared.event()?;
        let mut now = jiff::Timestamp::now().as_second();
        let mut state = self.shared.saved.lock().await;
        let mut live = self.live.lock().await;
        for slot in 0..2 {
            let start = event_start(&event, slot);
            if now >= start - 1200 && state.starts[slot].is_none() {
                state.starts[slot] = Some(start);
                self.shared.save(&state).await?;
            }
        }
        if live
            .last_save
            .is_none_or(|last| last.elapsed() >= Duration::from_secs(15))
        {
            self.shared.save(&state).await?;
            live.last_save = Some(Instant::now());
        }
        self.flush(&mut state).await?;
        if live.last_assets.is_none_or(|last| {
            last.elapsed() >= Duration::from_millis(self.shared.tournament.asset_poll_ms)
        }) {
            if let Err(error) = self.shared.refresh_assets(&mut state).await {
                tracing::warn!(%error,"ZSL assets still preparing");
            }
            self.shared.save(&state).await?;
            live.last_assets = Some(Instant::now());
        }
        for slot in 0..2 {
            if now >= event_start(&event, slot) && !state.completed[slot] && !state.failed[slot] {
                if state.pinned.is_none() {
                    state.failed[slot] = true;
                    state.phase = Phase::Retired;
                    state.timeslot = slot;
                    self.shared.save(&state).await?;
                    self.announce("Tournament preparation failed. This room is closing; players will not be kicked.").await?;
                    self.shared.retire.store(true, Ordering::Release);
                    return Ok(());
                }
                self.close_elapsed(&mut state, &event, slot, now).await?;
                if state.progress[slot] == state.pinned.as_ref().unwrap().levels.len() {
                    self.finish(&mut state, &event, slot).await?;
                    if self.shared.retire.load(Ordering::Acquire) {
                        return Ok(());
                    }
                }
            }
        }
        for slot in 0..2 {
            if state.completed[slot] {
                self.once(
                    &mut state,
                    format!("thanks:{slot}"),
                    &zsl_messages::thanks(&event, slot == 1),
                )
                .await?;
            }
        }
        if state.completed[1] || state.failed[1] {
            self.context
                .send(change_lobby_name_packet("Post ZSL Lobby")?)
                .await?;
            state.timeslot = 1;
            state.phase = Phase::Retired;
            self.shared.save(&state).await?;
            self.shared.retire.store(true, Ordering::Release);
            return Ok(());
        }
        let slot = if now >= event.second - 1200 || state.completed[0] || state.failed[0] {
            1
        } else {
            0
        };
        let start = event_start(&event, slot);
        if now >= start && !state.completed[slot] && !state.failed[slot] {
            let bundle = state.pinned.clone().context("ZSL playlist unavailable")?;
            let index = state.progress[slot];
            let asset = self.shared.pinned(&bundle, false).await?;
            (state, live) = self
                .activate(
                    state,
                    live,
                    Phase::Tournament,
                    slot,
                    index,
                    asset,
                    start + (index as i64 + 1) * 420,
                )
                .await?;
            now = jiff::Timestamp::now().as_second();
            self.once(
                &mut state,
                format!("started:{slot}"),
                &format!(
                    "Zeepkist Super League Season {}: {} has started! Good luck and have fun!",
                    event.season,
                    escape_text(&event.name)
                ),
            )
            .await?;
            if !bundle.levels[index].level.name.starts_with("ZSL") {
                self.once(&mut state,format!("break:{slot}:{index}"),&zsl_messages::gradient("Break Time! Refill your drink, stay hydrated, stretch your legs and get ready for the next ZSL level!",["#00aaff","#88ffff"])).await?;
            }
            let remaining = state.deadline - now;
            if let Some(author) = bundle.levels[index].author_time
                && live.current_level_id.is_some()
                && remaining as f64 <= author + 10.0
                && remaining > 5
            {
                self.once(
                    &mut state,
                    format!("reset:{slot}:{index}"),
                    "Last chance to reset to improve your time",
                )
                .await?;
            }
            if remaining <= 5
                && let Some(next) = bundle.levels.get(index + 1)
            {
                self.once(
                    &mut state,
                    format!("next:{slot}:{index}"),
                    &format!(
                        "Up next is {}",
                        escape_text(
                            next.level
                                .name
                                .strip_prefix("ZSL - ")
                                .unwrap_or(&next.level.name)
                        )
                    ),
                )
                .await?;
            }
        } else if now >= start - 1200 && !state.completed[slot] && !state.failed[slot] {
            if let (Some(warmup), Some(_)) = (state.warmup.clone(), state.pinned.as_ref()) {
                let index = ((now - (start - 1200)) / 300).clamp(0, 3) as usize;
                let asset = self.shared.pinned(&warmup, true).await?;
                (state, live) = self
                    .activate(
                        state,
                        live,
                        Phase::Warmup,
                        slot,
                        index,
                        asset,
                        (start - 1200) + (index as i64 + 1) * 300,
                    )
                    .await?;
                now = jiff::Timestamp::now().as_second();
                self.once(
                    &mut state,
                    format!("warmup:{slot}"),
                    &zsl_messages::warmup_countdown(
                        (start - jiff::Timestamp::now().as_second()).max(0) as u64,
                    ),
                )
                .await?;
                if index == 3 && !state.announcements.contains(&format!("staged:{slot}")) {
                    let tournament = self
                        .shared
                        .pinned(state.pinned.as_ref().unwrap(), false)
                        .await?;
                    self.context
                        .update_playlist(tournament.playlist, 0, 0)
                        .await?;
                    state.announcements.insert(format!("staged:{slot}"));
                    self.shared.save(&state).await?;
                }
            } else {
                self.once(&mut state,format!("delay:{slot}"),"Tournament assets are still preparing. Please stay in this room; warm-up will begin shortly.").await?;
            }
            let elapsed = (now - (start - 1200)) / 120;
            if (1..10).contains(&elapsed) {
                self.once(
                    &mut state,
                    format!("countdown:{slot}:{elapsed}"),
                    &format!(
                        "Zeepkist Super League Season {}: {} is starting in {} minutes",
                        event.season,
                        escape_text(&event.name),
                        (start - now + 59) / 60
                    ),
                )
                .await?;
            }
        } else if let Some(asset) = self.shared.practice_asset.lock().await.clone() {
            let config = self.shared.practice.as_ref().unwrap();
            let index = if live
                .active
                .is_some_and(|(phase, _, _)| phase == Phase::Practice)
            {
                state.index % asset.playlist.levels.len()
            } else {
                0
            };
            let deadline = if state.phase == Phase::Practice && state.deadline > now {
                state.deadline
            } else {
                now + config.round_time_seconds as i64
            };
            (state, live) = self
                .activate(state, live, Phase::Practice, slot, index, asset, deadline)
                .await?;
            now = jiff::Timestamp::now().as_second();
        } else if state.completed[slot] || state.failed[slot] {
            state.timeslot = slot;
            self.shared.save(&state).await?;
            self.shared.retire.store(true, Ordering::Release);
            return Ok(());
        }
        if live.last_overlay.is_none_or(|last| {
            last.elapsed()
                >= Duration::from_millis(if state.phase == Phase::Practice {
                    60_000
                } else {
                    self.shared.tournament.message_refresh_ms
                })
        }) {
            self.overlay(&state, &live, &event, now).await?;
            live.last_overlay = Some(Instant::now());
        }
        if state.phase == Phase::Tournament
            && live
                .last_board
                .is_none_or(|last| last.elapsed() >= Duration::from_secs(2))
        {
            live.finishes = self
                .shared
                .database
                .zsl_finishes(self.shared.round_id)
                .await?;
            self.standings(&state, &mut live, &event).await?;
            live.last_board = Some(Instant::now());
        }
        Ok(())
    }
    async fn overlay(
        &self,
        state: &SavedState,
        live: &LiveState,
        event: &ZslEvent,
        now: i64,
    ) -> Result<()> {
        if state.phase == Phase::Practice {
            let remaining = (event_start(event, state.timeslot) - 1200 - now).max(0);
            let entries = live
                .asset
                .as_ref()
                .map_or(0, |asset| asset.playlist.levels.len());
            let body = format!(
                "<b>ZSL {} Practice</b>\nLevel {} of {entries}\nTournament handover in {}d {}h {}m",
                escape_text(&event.name),
                state.index + 1,
                remaining / 86400,
                remaining % 86400 / 3600,
                remaining % 3600 / 60
            );
            self.context
                .chat()
                .command(&server_message(
                    "yellow",
                    self.shared.practice.as_ref().unwrap().round_time_seconds + 120,
                    &body,
                ))
                .await
        } else if let Some(bundle) = &state.pinned {
            let status = if state.phase == Phase::Warmup {
                zsl_messages::warmup_countdown(
                    (event_start(event, state.timeslot) - now).max(0) as u64
                )
            } else if live.current_level_id.is_none() {
                "Breaktime".into()
            } else {
                "Running".into()
            };
            self.context
                .chat()
                .command(&zsl_messages::overlay(
                    event,
                    bundle,
                    if state.phase == Phase::Warmup {
                        0
                    } else {
                        state.index
                    },
                    &status,
                    420,
                ))
                .await
        } else {
            Ok(())
        }
    }
    async fn standings(
        &self,
        state: &SavedState,
        live: &mut LiveState,
        event: &ZslEvent,
    ) -> Result<()> {
        let Some(level_id) = live.current_level_id else {
            return Ok(());
        };
        let mut times: HashMap<u64, i64> = live
            .finishes
            .iter()
            .filter(|finish| finish.id_level == level_id)
            .map(|finish| (finish.steam_id as u64, finish.microseconds))
            .collect();
        for (&steam, &time) in &live.records {
            times
                .entry(steam)
                .and_modify(|old| *old = (*old).min(time))
                .or_insert(time);
        }
        let mut totals: HashMap<u64, i32> = HashMap::new();
        let mut level_ids: HashSet<i32> =
            live.finishes.iter().map(|finish| finish.id_level).collect();
        level_ids.insert(level_id);
        for id in level_ids {
            let values = if id == level_id {
                times.clone()
            } else {
                live.finishes
                    .iter()
                    .filter(|finish| finish.id_level == id)
                    .map(|finish| (finish.steam_id as u64, finish.microseconds))
                    .collect()
            };
            for (steam, _, position) in ranked_times(values) {
                *totals.entry(steam).or_default() += event
                    .points
                    .get(position - 1)
                    .copied()
                    .unwrap_or(event.minimum_points);
            }
        }
        let desired = ranked_times(times)
            .into_iter()
            .map(|(steam, time, position)| DesiredPlayerStanding {
                steam_id: steam,
                time: Some(time as f32 / 1_000_000.0),
                overrides: LeaderboardOverrides {
                    position: position.to_string(),
                    points: totals.get(&steam).copied().unwrap_or_default().to_string(),
                    points_won: event
                        .points
                        .get(position - 1)
                        .copied()
                        .unwrap_or(event.minimum_points)
                        .to_string(),
                    ..Default::default()
                },
            })
            .collect();
        let mut board = self.board.lock().await;
        let uid = live.asset.as_ref().unwrap().playlist.levels[state.index]
            .uid
            .clone();
        board.set_scope(
            format!(
                "zsl:{}:{}:{}",
                self.shared.round_id, state.timeslot, state.index
            ),
            uid,
        );
        board.set_ready(true);
        board.set_desired(desired);
        for packet in board.reconcile()? {
            self.context.send(packet).await?;
        }
        Ok(())
    }
}
#[async_trait::async_trait]
impl ProfileSession for ZslSession {
    async fn start(&self) -> Result<()> {
        self.context.chat().command("/joinmessage off").await?;
        let mut tick = tokio::time::interval(Duration::from_millis(250));
        tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            tokio::select! {
                _=self.wake.notified()=>return Ok(()),
                _=tick.tick()=>{
                    if self.stopped.load(Ordering::Acquire) {return Ok(());}
                    if let Err(error)=self.tick().await {
                        if error.is::<TransitionFailed>() || !self.context.is_host() || error.to_string().contains("ownership lost") { return Err(error); }
                        if error.is::<TransitionExpired>() { continue; }
                        tracing::warn!(%error,"ZSL lifecycle tick failed; retaining pending results");
                    }
                }
            }
        }
    }
    async fn on_packet(&self, packet: &GameHostPacket) -> Result<()> {
        let received_at = jiff::Timestamp::now();
        self.board.lock().await.observe(packet);
        if self.stopped.load(Ordering::Acquire)
            || self.shared.retire.load(Ordering::Acquire)
            || !self.context.is_host()
        {
            return Ok(());
        }
        // Name updates must not replace a fresh native finish with stale DB standings.
        let packets = self.board.lock().await.reconcile_names()?;
        for packet in packets {
            self.context.send(packet).await?;
        }
        // Informational packets never need lifecycle locks. These broadcasts precede
        // LevelRequest during skips and must not block the connection receive loop.
        if !matches!(
            packet,
            GameHostPacket::PlayerConnected { .. }
                | GameHostPacket::PlaylistIndex { .. }
                | GameHostPacket::PlayerResult { .. }
        ) {
            return Ok(());
        }
        let mut state = self.shared.saved.lock().await;
        let mut live = self.live.lock().await;
        if let GameHostPacket::PlayerConnected { player, .. } = packet
            && player.steam_id != self.context.local_steam_id
        {
            let event = self.shared.event()?;
            let locked = live.finishes.iter().any(|finish| {
                Some(finish.id_level) == live.current_level_id
                    && finish.steam_id == player.steam_id as i64
                    && finish.finalised
                    && finish.timeslot == 1
            });
            let message = if state.phase == Phase::Practice {
                let remaining =
                    (event_start(&event, state.timeslot) - 1200 - received_at.as_second()).max(0);
                zsl_messages::practice_welcome(
                    &event.name,
                    player.username.as_deref().unwrap_or(&player.backup_name),
                    self.shared.practice.as_ref().unwrap().round_time_seconds,
                    remaining as u64,
                )
            } else if state.phase == Phase::Warmup {
                format!(
                    "Welcome {}, to Zeepkist Super League Season {}: {}!<br>{}",
                    escape_text(player.username.as_deref().unwrap_or(&player.backup_name)),
                    event.season,
                    escape_text(&event.name),
                    zsl_messages::warmup_countdown(
                        (event_start(&event, state.timeslot) - received_at.as_second()).max(0)
                            as u64
                    )
                )
            } else {
                format!(
                    "Welcome {}, to Zeepkist Super League Season {}: {}!<br>{}",
                    escape_text(player.username.as_deref().unwrap_or(&player.backup_name)),
                    event.season,
                    escape_text(&event.name),
                    if locked {
                        "You have already set a time in Timeslot 1 for this level.<br>You may race, but improving your time in Timeslot 2 will not replace your Timeslot 1 result."
                    } else {
                        "Good luck and have fun!"
                    }
                )
            };
            self.context
                .chat()
                .target(player.steam_id, &message, HOSTNAME)
                .await?;
            live.last_board = None;
        }
        if let GameHostPacket::PlaylistIndex {
            current_index,
            select_next,
            ..
        } = packet
            && state.phase == Phase::Practice
            && let Some(asset) = live.asset.as_ref()
        {
            if *select_next {
                let next = (state.index + 1) % asset.playlist.levels.len();
                self.context
                    .update_playlist(asset.playlist.clone(), state.index as i32, next as i32)
                    .await?;
            } else if *current_index >= 0 && (*current_index as usize) < asset.playlist.levels.len()
            {
                state.index = *current_index as usize;
                live.active = Some((Phase::Practice, state.timeslot, state.index));
                live.last_overlay = None;
            }
        }
        if let GameHostPacket::PlayerResult {
            uid,
            has_result: true,
            level_uid,
            time,
            ..
        } = packet
        {
            if state.phase != Phase::Tournament
                || received_at.as_second() >= state.deadline
                || live
                    .ready
                    .as_ref()
                    .is_none_or(|(ready, _)| ready != level_uid)
            {
                return Ok(());
            }
            let Some(level_id) = live.current_level_id else {
                return Ok(());
            };
            let Some(microseconds) = normalized_time(*time) else {
                return Ok(());
            };
            let Some(player) = self.context.players().await.into_iter().find(|player| {
                player.uid == *uid && player.steam_id != self.context.local_steam_id
            }) else {
                return Ok(());
            };
            if live
                .records
                .get(&player.steam_id)
                .is_some_and(|old| *old <= microseconds)
            {
                return Ok(());
            }
            live.records.insert(player.steam_id, microseconds);
            let timeslot = state.timeslot as i32 + 1;
            state.pending.push(PendingFinish {
                steam_id: player.steam_id,
                name: player.username.unwrap_or(player.backup_name),
                level_id,
                timeslot,
                microseconds,
                received_at_ms: received_at.as_millisecond(),
            });
            // Persist pending write before submission; retries survive process restarts.
            if let Err(error) = self.shared.save(&state).await {
                tracing::warn!(%error,"ZSL pending finish remains in memory");
                return Ok(());
            }
            if let Err(error) = self.flush(&mut state).await {
                tracing::warn!(%error,"ZSL finish queued for retry");
            }
            live.last_board = None;
        }
        Ok(())
    }
    async fn on_transfer(&self, event: &TransferEvent) -> Result<()> {
        if event.kind == TransferEventKind::Ready && !self.shared.retire.load(Ordering::Acquire) {
            let state = self.shared.saved.lock().await;
            let mut live = self.live.lock().await;
            if live
                .asset
                .as_ref()
                .and_then(|asset| asset.playlist.levels.get(state.index))
                .is_some_and(|level| {
                    level.uid == event.level.level.uid
                        && level.workshop_id == event.level.level.workshop_id
                })
            {
                live.ready = Some((event.level.level.uid.clone(), event.level.level.workshop_id));
            }
        }
        Ok(())
    }
    async fn stop(&self) {
        self.stopped.store(true, Ordering::Release);
        self.wake.notify_waiters();
    }
}
fn event_start(event: &ZslEvent, slot: usize) -> i64 {
    if slot == 0 { event.first } else { event.second }
}
fn apply_saved_starts(event: &mut ZslEvent, state: &SavedState) {
    if let Some(start) = state.starts[0] {
        event.first = start;
    }
    if let Some(start) = state.starts[1] {
        event.second = start;
    }
}
fn scheduled_index(now: i64, start: i64, len: usize) -> usize {
    (((now - start).max(0) / 420) as usize).min(len.saturating_sub(1))
}
fn normalized_time(time: f32) -> Option<i64> {
    if !time.is_finite() || time <= 0.0 || time > 36_000.0 {
        None
    } else {
        let microseconds = (f64::from(time) * 1_000_000.0).round() as i64;
        (microseconds > 0).then_some(microseconds)
    }
}
fn ranked_times(values: HashMap<u64, i64>) -> Vec<(u64, i64, usize)> {
    let mut rows: Vec<_> = values.into_iter().collect();
    rows.sort_by_key(|&(steam, time)| (time, steam));
    let mut previous = None;
    let mut position = 0;
    rows.into_iter()
        .enumerate()
        .map(|(index, (steam, time))| {
            if previous != Some(time) {
                position = index + 1;
                previous = Some(time);
            }
            (steam, time, position)
        })
        .collect()
}
fn validate_tournament(bundle: &PracticeBundle, duration: u64) -> Result<()> {
    ensure!(
        bundle.round_length == Some(duration) && duration == 420,
        "ZSL playlist roundLength must be 420"
    );
    let breaks: Vec<_> = bundle
        .levels
        .iter()
        .enumerate()
        .filter(|(_, entry)| !entry.level.name.starts_with("ZSL"))
        .map(|(index, _)| index)
        .collect();
    ensure!(
        breaks == [7] && bundle.levels.len() == 15,
        "ZSL playlist needs break after Track 7"
    );
    let mut hashes = HashSet::new();
    for entry in bundle
        .levels
        .iter()
        .filter(|entry| entry.level.name.starts_with("ZSL"))
    {
        ensure!(
            entry.xx_hash.as_ref().is_some_and(|hash| hash.len() == 32)
                && entry
                    .legacy_hash
                    .as_ref()
                    .is_some_and(|hash| !hash.is_empty())
                && entry
                    .author_time
                    .is_some_and(|time| time.is_finite() && time > 0.0),
            "ZSL level metadata incomplete"
        );
        ensure!(
            hashes.insert(entry.xx_hash.as_ref().unwrap()),
            "Duplicate canonical ZSL level"
        );
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn competition_ranks_and_six_decimal_times() {
        let rows = ranked_times(HashMap::from([(1, 12345678), (2, 12345678), (3, 12345679)]));
        assert_eq!(rows.iter().map(|row| row.2).collect::<Vec<_>>(), [1, 1, 3]);
        assert_eq!(normalized_time(0.0), None);
        assert_eq!(normalized_time(f32::NAN), None);
        assert_eq!(normalized_time(0.0000001), None);
        assert_eq!(normalized_time(1.234567_f32), Some(1234567));
    }
    #[test]
    fn recovery_uses_wall_clock_and_does_not_wrap() {
        assert_eq!(scheduled_index(1000, 1000, 15), 0);
        assert_eq!(scheduled_index(1840, 1000, 15), 2);
        assert_eq!(scheduled_index(99999, 1000, 15), 14);
    }
    #[test]
    fn default_state_keeps_dnf_eligible() {
        let state = SavedState::default();
        assert!(state.pending.is_empty());
        assert!(!state.completed[1]);
        assert!(!state.retired[1]);
    }

    #[test]
    fn first_slot_retirement_allows_paired_practice_but_final_retirement_stays_terminal() {
        for failed in [false, true] {
            let mut state = SavedState {
                completed: [!failed, false],
                failed: [failed, false],
                retired: [true, false],
                ..Default::default()
            };
            assert!(!state.room_retired(0, true));
            assert!(state.room_retired(0, false));
            assert!(!state.room_retired(1, true));
            state.retired[1] = true;
            assert!(state.room_retired(0, true));
            assert!(state.room_retired(1, true));
        }
    }
}

#[cfg(test)]
#[path = "zsl/tests.rs"]
mod integration_tests;
