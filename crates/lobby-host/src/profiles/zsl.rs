//! One connection owns practice, warm-up, tournament, and retirement.
use super::{
    assets::{PracticeAssets, SubmissionAsset, SubmissionPlaylist, pinned_asset},
    messages::{HOSTNAME, escape_text},
    zsl_messages,
};
use crate::{
    config::{ManagedRoomConfig, RoomProfile},
    leaderboard::{DesiredPlayerStanding, PlayerLeaderboard},
    runtime::{LobbyProfile, ProfileSession, RoomContext},
    transfer::{TransferEvent, TransferEventKind},
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
use tokio::sync::{Mutex, Notify};
use zc_core::{
    object_storage::ObjectStorage,
    practice::PracticeBundle,
    zeepnet::{
        GameHostPacket, LeaderboardOverrides, change_lobby_name_packet,
        player_leaderboard_overrides_packet,
    },
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
        if saved.retired[slot] && (saved.completed[slot] || saved.failed[slot]) {
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
    async fn activate(
        &self,
        state: &mut SavedState,
        live: &mut LiveState,
        phase: Phase,
        slot: usize,
        index: usize,
        asset: SubmissionAsset,
        deadline: i64,
    ) -> Result<()> {
        if live.active == Some((phase, slot, index)) {
            return Ok(());
        }
        // Single transition owner; no retired profile tasks can send after generation changes.
        live.generation += 1;
        live.ready = None;
        live.records.clear();
        live.current_level_id = None;
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
        if phase == Phase::Tournament {
            let bundle = state.pinned.as_ref().context("ZSL playlist unavailable")?;
            live.current_level_id = self.scoring_level(bundle, index).await?;
            self.shared
                .database
                .open_zsl_level(
                    self.shared.round_id,
                    &self.shared.owner,
                    slot as i32 + 1,
                    index as i32,
                    live.current_level_id,
                    deadline,
                )
                .await?;
        }
        state.phase = phase;
        state.timeslot = slot;
        state.index = index;
        state.deadline = deadline;
        self.shared.save(state).await?;
        let title = if phase == Phase::Practice {
            format!("ZSL {} Practice", self.shared.event()?.name)
        } else {
            format!(
                "Zeepkist Super League: {} (Timeslot {})",
                self.shared.event()?.name,
                slot + 1
            )
        };
        self.context.send(change_lobby_name_packet(&title)?).await?;
        for player in self.context.players().await {
            if player.steam_id != self.context.local_steam_id {
                self.context
                    .send(player_leaderboard_overrides_packet(
                        player.steam_id,
                        &LeaderboardOverrides::default(),
                    )?)
                    .await?;
            }
        }
        self.context
            .activate(prepared, Some(asset.playlist.clone()))
            .await?;
        if phase == Phase::Tournament {
            self.context
                .update_playlist(
                    asset.playlist.clone(),
                    index as i32,
                    (index + 1).min(asset.playlist.levels.len() - 1) as i32,
                )
                .await?;
        }
        if let Some(remote_now) = self.context.remote_now() {
            let remaining = if phase == Phase::Practice {
                seconds
            } else {
                (deadline - jiff::Timestamp::now().as_second()).max(1) as f64
            };
            self.context
                .send(zc_core::zeepnet::change_lobby_game_properties_packet(
                    level, remaining, remote_now,
                )?)
                .await?;
        }
        live.ready = Some((level.uid.clone(), level.workshop_id));
        live.active = Some((phase, slot, index));
        live.asset = Some(asset);
        live.last_overlay = None;
        live.last_board = None;
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
        let now = jiff::Timestamp::now().as_second();
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
            self.activate(
                &mut state,
                &mut live,
                Phase::Tournament,
                slot,
                index,
                asset,
                start + (index as i64 + 1) * 420,
            )
            .await?;
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
                self.activate(
                    &mut state,
                    &mut live,
                    Phase::Warmup,
                    slot,
                    index,
                    asset,
                    (start - 1200) + (index as i64 + 1) * 300,
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
            self.activate(
                &mut state,
                &mut live,
                Phase::Practice,
                slot,
                index,
                asset,
                deadline,
            )
            .await?;
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
            self.context.chat().command(&format!("/servermessage yellow {} <size=160%><b>ZSL {} Practice</b>\nLevel {} of {entries}\nTournament handover in {}d {}h {}m</size>",self.shared.practice.as_ref().unwrap().round_time_seconds+120,escape_text(&event.name),state.index+1,remaining/86400,remaining%86400/3600,remaining%3600/60)).await
        } else if let Some(bundle) = &state.pinned {
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
                    if state.phase == Phase::Warmup {
                        "Preparing"
                    } else if live.current_level_id.is_none() {
                        "Breaktime"
                    } else {
                        "Running"
                    },
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
                    if let Err(error)=self.tick().await { if error.to_string().contains("ownership lost") { return Err(error); } tracing::warn!(%error,"ZSL lifecycle tick failed; retaining pending results"); }
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
}

#[cfg(test)]
#[path = "zsl/tests.rs"]
mod integration_tests;
