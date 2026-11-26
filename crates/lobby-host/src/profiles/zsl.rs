//! One connection owns practice, warm-up, tournament, and retirement.
use super::{
    assets::{
        ManagedPracticeAssets, PracticeAssets, SubmissionAsset, SubmissionPlaylist, pinned_asset,
    },
    messages::{HOSTNAME, chat_message, chat_notice, escape_text, server_message, server_row},
    zsl_messages,
};
use crate::{
    config::{ManagedRoomConfig, RoomProfile},
    leaderboard::{DesiredPlayerStanding, PlayerLeaderboard},
    runtime::{LobbyProfile, ProfileSession, ReceivedPacket, RoomContext, RoundKey, ServerRound},
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
    zeepnet::{GameHostPacket, LeaderboardOverrides, change_lobby_name_packet},
};
use zc_database::{
    Database,
    services::zsl_tournament::{ZslEvent, ZslFinish},
};

mod native;

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
type ActivationTarget = (Phase, usize, usize);

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PendingFinish {
    steam_id: u64,
    name: String,
    level_id: i32,
    timeslot: i32,
    microseconds: i64,
    received_at_ms: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    index: Option<usize>,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct SavedState {
    pinned: Option<PracticeBundle>,
    warmup: Option<PracticeBundle>,
    warmups: [Option<PracticeBundle>; 2],
    started: [bool; 2],
    scored_through: [Option<usize>; 2],
    completed: [bool; 2],
    failed: [bool; 2],
    retired: [bool; 2],
    progress: [usize; 2],
    phase: Phase,
    timeslot: usize,
    index: usize,
    deadline: i64,
    deadline_ms: Option<i64>,
    loaded_at: Option<f64>,
    next: Option<ActivationTarget>,
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
    lifecycle: Mutex<()>,
    persistence: Mutex<()>,
    incoming: std::sync::Mutex<Vec<PendingFinish>>,
    tournament_assets: Option<PracticeAssets>,
    selections: Mutex<AssetSelections>,
    last_playable: Mutex<Option<crate::assets::PreparedLevel>>,
    recovery: Mutex<Option<(ActivationTarget, u8)>>,
    warmup_assets: PracticeAssets,
    practice_assets: Option<ManagedPracticeAssets>,
    practice_asset: Mutex<Option<SubmissionAsset>>,
    pinned_asset: Mutex<Option<SubmissionAsset>>,
    warmup_asset: Mutex<Option<SubmissionAsset>>,
    stopped: AtomicBool,
    retire: AtomicBool,
}
#[derive(Default)]
struct AssetSelections {
    tournament: Option<SubmissionAsset>,
    warmup: Option<SubmissionAsset>,
    tournament_revision: Option<i32>,
    warmup_revision: Option<i32>,
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
            ManagedPracticeAssets::new(
                database.clone(),
                storage.clone(),
                round_id,
                playlist.clone(),
            )
        });
        Ok(Self {
            shared: Arc::new(Shared {
                tournament_assets: playlist.as_ref().map(|playlist| {
                    PracticeAssets::new(
                        database.clone(),
                        storage.clone(),
                        round_id,
                        playlist.clone(),
                    )
                }),
                selections: Mutex::new(AssetSelections::default()),
                last_playable: Mutex::new(None),
                recovery: Mutex::new(None),
                warmup_assets: PracticeAssets::warmup(database.clone(), storage.clone(), round_id),
                tournament,
                practice,
                round_id,
                database,
                storage,
                owner: zc_core::generate_uid(),
                event: RwLock::new(None),
                saved: Mutex::new(SavedState::default()),
                lifecycle: Mutex::new(()),
                persistence: Mutex::new(()),
                incoming: std::sync::Mutex::new(Vec::new()),
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
    async fn remember_playable(
        &self,
        phase: Phase,
        index: usize,
        level: &crate::assets::PreparedLevel,
    ) {
        // Recovery must never replay the tournament break outside the event.
        if phase != Phase::Tournament || index != 7 {
            *self.last_playable.lock().await = Some(level.clone());
        }
    }

    fn event(&self) -> Result<ZslEvent> {
        self.event
            .read()
            .unwrap()
            .clone()
            .context("ZSL schedule unavailable")
    }
    async fn save(&self, state: &SavedState) -> Result<()> {
        let _persistence = self.persistence.lock().await;
        let mut snapshot = state.clone();
        self.merge_incoming(&mut snapshot, false);
        *self.saved.lock().await = snapshot.clone();
        self.database
            .save_zsl_event(self.round_id, &self.owner, &serde_json::to_value(snapshot)?)
            .await
    }
    fn merge_incoming(&self, state: &mut SavedState, drain: bool) {
        let mut incoming = self.incoming.lock().unwrap();
        for finish in incoming.iter() {
            if !state.pending.contains(finish) {
                state.pending.push(finish.clone());
            }
        }
        if drain {
            incoming.clear();
        }
    }
    async fn retain(&self, state: &SavedState) {
        let mut snapshot = state.clone();
        self.merge_incoming(&mut snapshot, false);
        *self.saved.lock().await = snapshot;
    }
    async fn refresh_assets(&self) {
        let (managed, tournament, warmup, practice) = tokio::join!(
            self.refresh_managed_assets(),
            async {
                if let Some(source) = &self.tournament_assets
                    && let SubmissionPlaylist::Ready(asset) = source.refresh_for_event().await?
                {
                    let bundle = asset
                        .bundle
                        .as_ref()
                        .context("ZSL bundle metadata unavailable")?;
                    bundle.validate_tournament()?;
                    let needs_load = {
                        let selections = self.selections.lock().await;
                        selections.tournament_revision.is_none()
                            && selections
                                .tournament
                                .as_ref()
                                .is_none_or(|previous| previous.digest != asset.digest)
                    };
                    if needs_load {
                        preload(&asset).await?;
                        let mut selections = self.selections.lock().await;
                        if selections.tournament_revision.is_none() {
                            selections.tournament = Some(asset);
                        }
                    }
                }
                Ok::<_, anyhow::Error>(())
            },
            async {
                let legacy = self.selections.lock().await.warmup_revision.is_none();
                if legacy
                    && let SubmissionPlaylist::Ready(asset) = self.warmup_assets.refresh().await?
                {
                    ensure!(
                        asset.playlist.levels.len() == 4,
                        "Warmup must contain four levels"
                    );
                    let needs_load = self
                        .selections
                        .lock()
                        .await
                        .warmup
                        .as_ref()
                        .is_none_or(|previous| previous.digest != asset.digest);
                    if needs_load {
                        preload(&asset).await?;
                        let mut selections = self.selections.lock().await;
                        if selections.warmup_revision.is_none() {
                            selections.warmup = Some(asset);
                        }
                    }
                }
                Ok::<_, anyhow::Error>(())
            },
            async {
                if let Some(source) = &self.practice_assets
                    && let SubmissionPlaylist::Ready(asset) = source.refresh().await?
                {
                    let needs_load = self
                        .practice_asset
                        .lock()
                        .await
                        .as_ref()
                        .is_none_or(|previous| previous.digest != asset.digest);
                    if needs_load {
                        asset.first().await?;
                        *self.practice_asset.lock().await = Some(asset);
                    }
                }
                Ok::<_, anyhow::Error>(())
            },
        );
        for (kind, result) in [
            ("admin", managed),
            ("tournament", tournament),
            ("warmup", warmup),
            ("practice", practice),
        ] {
            if let Err(error) = result {
                tracing::warn!(round_id = self.round_id, kind, %error, "ZSL asset preparation pending");
            }
        }
    }

    async fn refresh_managed_assets(&self) -> Result<()> {
        use zc_database::services::zsl_admin::HostPlaylist;

        let mut tournament = None;
        let mut warmup = None;
        for row in self
            .database
            .host_zsl_playlists(self.round_id, true)
            .await?
        {
            if row.kind == "warmup" {
                warmup = Some(row);
            } else {
                tournament = Some(row);
            }
        }
        let refresh = |row: Option<HostPlaylist>| async move {
            if let Some(row) = row {
                let revision = row.id;
                if let Err(error) = self.refresh_managed_playlist(row).await {
                    tracing::warn!(round_id = self.round_id, revision, %error, "ZSL revision verification pending");
                }
            }
        };
        tokio::join!(refresh(tournament), async {
            refresh(warmup).await;
            // A replacement warmup may be queued or failed when the host restarts.
            let needs_previous_warmup = self.selections.lock().await.warmup_revision.is_none();
            if needs_previous_warmup {
                match self.database.host_zsl_playlists(self.round_id, false).await {
                    Ok(rows) => refresh(rows.into_iter().find(|row| row.kind == "warmup")).await,
                    Err(error) => {
                        tracing::warn!(round_id = self.round_id, %error, "ZSL verified warmup unavailable")
                    }
                }
            }
        });
        Ok(())
    }

    async fn refresh_managed_playlist(
        &self,
        row: zc_database::services::zsl_admin::HostPlaylist,
    ) -> Result<()> {
        if !matches!(row.state.as_str(), "prepared" | "verified") {
            return Ok(());
        }
        let warmup = row.kind == "warmup";
        {
            let selections = self.selections.lock().await;
            if Some(row.id)
                == if warmup {
                    selections.warmup_revision
                } else {
                    selections.tournament_revision
                }
            {
                return Ok(());
            }
        }
        let validation = async {
            let bundle: PracticeBundle =
                serde_json::from_value(row.value.context("ZSL bundle metadata unavailable")?)?;
            ensure!(
                bundle.round_id == self.round_id,
                "ZSL bundle round mismatch"
            );
            if warmup {
                ensure!(
                    bundle.levels.len() == 4 && bundle.round_length == Some(300),
                    "Warmup needs four 300-second levels"
                );
            } else {
                bundle.validate_tournament()?;
            }
            let asset = pinned_asset(bundle, self.storage.clone())?;
            let failures = verify_payloads(&asset).await;
            Ok::<_, anyhow::Error>((asset, failures))
        }
        .await;
        let (asset, failures) = match validation {
            Ok(result) => result,
            Err(error) => {
                self.database
                    .verify_zsl_playlist(
                        row.id,
                        Some(serde_json::json!([
                            {"state":"failed","stage":"Host rejected playlist manifest"}
                        ])),
                    )
                    .await?;
                return Err(error);
            }
        };
        if !failures.is_empty() {
            self.database
                .verify_zsl_playlist(row.id, Some(serde_json::json!(failures)))
                .await?;
            return Ok(());
        }
        if row.state == "prepared" && !self.database.verify_zsl_playlist(row.id, None).await? {
            return Ok(());
        }
        let mut selections = self.selections.lock().await;
        if warmup {
            selections.warmup_revision = Some(row.id);
            selections.warmup = Some(asset);
        } else {
            selections.tournament_revision = Some(row.id);
            selections.tournament = Some(asset);
        }
        Ok(())
    }

    async fn tournament_candidate(&self, start: i64) -> Result<Option<SubmissionAsset>> {
        let revision = self
            .database
            .host_zsl_playlists(self.round_id, true)
            .await?
            .into_iter()
            .find(|row| row.kind == "tournament");
        let selections = self.selections.lock().await;
        if let Some(revision) = revision
            && (revision.state != "verified"
                || revision.updated_epoch > start
                || selections.tournament_revision != Some(revision.id))
        {
            return Ok(None);
        }
        Ok(selections.tournament.clone())
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
        let digest = zc_core::identifiers::xxh128_hex(&serde_json::to_vec(bundle)?);
        if let Some(asset) = cached.as_ref().filter(|asset| asset.digest == digest) {
            return Ok(asset.clone());
        }
        let selections = self.selections.lock().await;
        let selected = if warmup {
            &selections.warmup
        } else {
            &selections.tournament
        };
        if let Some(asset) = selected.as_ref().filter(|asset| asset.digest == digest) {
            *cached = Some(asset.clone());
            return Ok(asset.clone());
        }
        drop(selections);
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
            .with_context(|| {
                format!(
                    "ZSL payload unavailable for Workshop {} UID {}",
                    level.workshop_id, level.uid
                )
            })?;
    }
    Ok(())
}

async fn verify_payloads(asset: &SubmissionAsset) -> Vec<serde_json::Value> {
    let mut failures = Vec::new();
    for (index, level) in asset.playlist.levels.iter().enumerate() {
        let result = async {
            let loaded = asset
                .load(&level.uid, level.workshop_id)
                .await?
                .context("Level missing")?;
            let decoded = zc_core::zeepnet::decode_zeepkist_level_payload(&loaded.compressed_data)?;
            ensure!(!decoded.is_empty(), "Level payload is empty");
            Ok::<_, anyhow::Error>(())
        }
        .await;
        if let Err(error) = result {
            tracing::warn!(uid = %level.uid, workshop_id = level.workshop_id, %error, "ZSL host payload verification failed");
            failures.push(serde_json::json!({"position":index + 1,"name":level.name,"uid":level.uid,
                "workshopId":level.workshop_id.to_string(),"state":"failed","stage":"Host could not read or decode payload"}));
        }
    }
    failures
}
#[async_trait::async_trait]
impl LobbyProfile for ZslProfile {
    fn name(&self) -> &str {
        "zsl"
    }
    fn kick_on_close(&self) -> bool {
        false
    }
    fn publish_on_connect(&self) -> bool {
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
        if shared.last_playable.lock().await.is_none() {
            shared.refresh_assets().await;
        }
        let Some(stored) = shared
            .database
            .claim_zsl_event(shared.round_id, &shared.owner)
            .await?
        else {
            return Ok(None);
        };
        let _lifecycle = shared.lifecycle.lock().await;
        let mut saved = shared.saved.lock().await.clone();
        // Keep unsaved pending writes across reconnects within this process.
        let pending = std::mem::take(&mut saved.pending);
        saved = serde_json::from_value(stored)?;
        // Older snapshots persisted the active phase and progress before adding started flags.
        if saved.pinned.is_some() {
            for slot in 0..2 {
                saved.started[slot] |= saved.progress[slot] > 0
                    || (saved.phase == Phase::Tournament && saved.timeslot == slot);
                if saved.scored_through[slot].is_none()
                    && saved.phase == Phase::Tournament
                    && saved.timeslot == slot
                {
                    saved.scored_through[slot] = Some(saved.index);
                }
            }
            if !saved.started.contains(&true) {
                let legacy = saved.pinned.take().expect("legacy tournament candidate");
                let needs_candidate = shared.selections.lock().await.tournament.is_none();
                if needs_candidate {
                    let candidate = shared.pinned(&legacy, false).await?;
                    shared.selections.lock().await.tournament = Some(candidate);
                }
            }
        }
        shared.merge_incoming(&mut saved, false);
        apply_saved_starts(&mut event, &saved);
        *shared.event.write().unwrap() = Some(event.clone());
        for finish in pending {
            if !saved.pending.contains(&finish) {
                saved.pending.push(finish);
            }
        }
        if saved.retired[1] {
            return Ok(None);
        }
        shared.save(&saved).await?;
        let now = jiff::Timestamp::now().as_second();
        let slot = ZslSession::eligible_slot(&saved, &event, now);
        if saved.room_retired(slot, shared.practice.is_some()) {
            return Ok(None);
        }
        if shared.practice.is_none() && now < event.first - 1200 {
            return Ok(None);
        }
        shared.retire.store(false, Ordering::Release);
        if let Some(bundle) = &saved.pinned
            && now >= event_start(&event, slot)
            && !(saved.completed[slot] || saved.failed[slot])
        {
            let index = saved.progress[slot].min(bundle.levels.len() - 1);
            let asset = shared.pinned(bundle, false).await?;
            let level = &asset.playlist.levels[index];
            return asset.load(&level.uid, level.workshop_id).await;
        }
        if now >= event_start(&event, slot)
            && !saved.failed[slot]
            && !saved.completed[slot]
            && let Some(asset) = shared
                .tournament_candidate(event_start(&event, slot))
                .await?
        {
            return Ok(Some(asset.first().await?));
        }
        if now >= event_start(&event, slot) - 1200 {
            if let Some(bundle) = saved.warmups[slot].as_ref().or(saved.warmup.as_ref()) {
                let asset = shared.pinned(bundle, true).await?;
                return Ok(Some(asset.first().await?));
            }
            if let Some(asset) = shared.selections.lock().await.warmup.clone() {
                return Ok(Some(asset.first().await?));
            }
        }
        if let Some(asset) = shared.practice_asset.lock().await.clone() {
            return Ok(Some(asset.first().await?));
        }
        if let Some(level) = shared.last_playable.lock().await.clone() {
            return Ok(Some(level));
        }
        Ok(None)
    }
    async fn create_session(&self, context: RoomContext) -> Result<Arc<dyn ProfileSession>> {
        Ok(Arc::new(ZslSession {
            board: Mutex::new(context.leaderboard()),
            context,
            shared: self.shared.clone(),
            live: Mutex::new(LiveState::default()),
            scoring: RwLock::new(None),
            next_scoring: RwLock::new(None),
            stopped: AtomicBool::new(false),
            wake: Notify::new(),
        }))
    }
    async fn scheduled_closed(&self) -> Result<()> {
        let _lifecycle = self.shared.lifecycle.lock().await;
        let mut state = self.shared.saved.lock().await.clone();
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
#[derive(Clone, Default)]
struct LiveState {
    active: Option<ActivationTarget>,
    asset: Option<SubmissionAsset>,
    ready: Option<(String, u64)>,
    current_level_id: Option<i32>,
    records: HashMap<u64, i64>,
    finishes: Vec<ZslFinish>,
    last_save: Option<Instant>,
    last_board: Option<Instant>,
    round: Option<RoundKey>,
    next: Option<native::NativeTarget>,
    generation: u64,
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
struct TransitionUnavailable;
impl std::fmt::Display for TransitionUnavailable {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("ZSL scheduled level unavailable after reconnect")
    }
}
impl std::error::Error for TransitionUnavailable {}

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
    scoring: RwLock<Option<ScoringScope>>,
    next_scoring: RwLock<Option<ScoringScope>>,
    stopped: AtomicBool,
    wake: Notify,
}
#[derive(Clone)]
struct ScoringScope {
    phase: Phase,
    timeslot: usize,
    level_id: Option<i32>,
    identity: Option<(String, u64)>,
    generation: u64,
    ready: bool,
    deadline: i64,
    locked_players: HashSet<u64>,
    index: Option<usize>,
    round: Option<RoundKey>,
}
impl ZslSession {
    fn scoring_scope(&self, state: &SavedState, live: &LiveState) {
        *self.scoring.write().unwrap() = Some(ScoringScope {
            phase: state.phase,
            timeslot: state.timeslot,
            level_id: live.current_level_id,
            identity: live.ready.clone(),
            generation: live.generation,
            ready: live.ready.is_some(),
            index: Some(state.index),
            round: live.round.clone(),
            deadline: state.deadline_ms.unwrap_or(state.deadline * 1000),
            locked_players: live
                .finishes
                .iter()
                .filter(|finish| {
                    Some(finish.id_level) == live.current_level_id
                        && finish.finalised
                        && finish.timeslot == 1
                })
                .map(|finish| finish.steam_id as u64)
                .collect(),
        });
    }
    fn receipt_scope(&self) -> Option<ScoringScope> {
        let current = self.scoring.read().unwrap().clone();
        let Some(round) = self.context.server_round() else {
            return current;
        };
        let matches = |scope: &ScoringScope| {
            scope.identity.as_ref().is_some_and(|(uid, workshop)| {
                *uid == round.key.uid && *workshop == round.key.workshop_id
            })
        };
        if round.state != 0 {
            return current.map(|mut scope| {
                scope.ready = false;
                scope
            });
        }
        let mut scope = if current.as_ref().is_some_and(|scope| {
            matches(scope) && scope.round.as_ref().is_none_or(|key| *key == round.key)
        }) {
            current?
        } else {
            self.next_scoring.read().unwrap().clone().filter(|scope| {
                matches(scope)
                    && scope
                        .round
                        .as_ref()
                        .is_some_and(|key| key.loaded_at < round.key.loaded_at)
            })?
        };
        if scope.phase == Phase::Tournament {
            scope.deadline = round.deadline_ms?;
        }
        Some(scope)
    }

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
        loop {
            self.shared.merge_incoming(state, true);
            // Retain admitted finishes before any DB await, including cancellation.
            self.shared.retain(state).await;
            let Some(position) = state.pending.iter().position(|finish| {
                finish.index.is_none_or(|index| {
                    state
                        .scored_through
                        .get((finish.timeslot - 1) as usize)
                        .copied()
                        .flatten()
                        .is_some_and(|open| index <= open)
                })
            }) else {
                break;
            };
            let finish = state.pending[position].clone();
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
            state.pending.remove(position);
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
            .await?
            .context("ZSL scoring level unavailable")?;
        Ok(Some(
            self.shared
                .database
                .get_or_create_zsl_level(self.shared.round_id, level.id)
                .await?
                .id,
        ))
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
        if slot == 1 {
            self.context
                .publish(vec![change_lobby_name_packet("Post ZSL Lobby")?])
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
        if live.active == Some((phase, slot, index))
            && (phase != Phase::Practice
                || live
                    .asset
                    .as_ref()
                    .is_some_and(|active| active.digest == asset.digest))
        {
            return Ok(());
        }
        // Single transition owner; no retired profile tasks can send after generation changes.
        live.generation += 1;
        live.round = None;
        live.next = None;
        live.ready = None;
        live.records.clear();
        live.current_level_id = None;
        *self.scoring.write().unwrap() = None;
        *self.live.lock().await = live.clone();
        let seconds = self.phase_seconds(phase);
        let level = &asset.playlist.levels[index];
        let prepared = asset
            .load(&level.uid, level.workshop_id)
            .await?
            .context("ZSL level payload unavailable")?;
        let mut scoring_level = None;
        if phase == Phase::Tournament {
            let bundle = asset.bundle.as_ref().context("ZSL playlist unavailable")?;
            scoring_level = self.scoring_level(bundle, index).await?;
            live.finishes = self
                .shared
                .database
                .zsl_finishes(self.shared.round_id)
                .await?;
        }
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
        *self.scoring.write().unwrap() = Some(ScoringScope {
            phase,
            timeslot: slot,
            level_id: scoring_level,
            identity: Some((
                transition.level.level.uid.clone(),
                transition.level.level.workshop_id,
            )),
            generation: transition.generation,
            ready: false,
            index: Some(index),
            round: None,
            deadline: deadline * 1000,
            locked_players: live
                .finishes
                .iter()
                .filter(|finish| {
                    Some(finish.id_level) == scoring_level
                        && finish.finalised
                        && finish.timeslot == 1
                })
                .map(|finish| finish.steam_id as u64)
                .collect(),
        });
        self.execute_and_commit(state, live, transition, true)
            .await?;
        self.shared.save(state).await
    }

    async fn execute_and_commit(
        &self,
        state: &mut SavedState,
        live: &mut LiveState,
        transition: PreparedTransition,
        open_scoring: bool,
    ) -> Result<()> {
        let PreparedTransition {
            phase,
            slot,
            index,
            deadline,
            ..
        } = transition;
        // Packet callbacks need these locks before LevelRequest can reach transfer.
        // Never retain either guard while waiting for server confirmation.
        let outcome = self.execute_transition(&transition).await;
        ensure!(
            self.context.is_host()
                && !self.stopped.load(Ordering::Acquire)
                && self.live.lock().await.generation == transition.generation,
            TransitionFailed
        );
        if let Err(error) = outcome {
            *self.scoring.write().unwrap() = None;
            if error.is::<TransitionExpired>() {
                return Err(error);
            }
            let target = (phase, slot, index);
            let mut recovery = self.shared.recovery.lock().await;
            let failures = recovery
                .filter(|(previous, _)| *previous == target)
                .map_or(1, |(_, failures)| failures + 1);
            *recovery = Some((target, failures));
            tracing::warn!(room = self.shared.room_key(), ?phase, slot, index, failures, %error, "ZSL activation failed");
            return match failures {
                1 => Err(error),
                2 => Err(error.context(TransitionFailed)),
                _ => Err(error.context(TransitionUnavailable)),
            };
        }
        ensure!(
            phase == Phase::Practice || jiff::Timestamp::now().as_second() < deadline,
            TransitionExpired
        );
        let server_round = self.context.server_round().filter(|round| {
            round.key.uid == transition.level.level.uid
                && round.key.workshop_id == transition.level.level.workshop_id
                && round.state == 0
        });
        let server_deadline_ms = server_round.as_ref().and_then(|round| round.deadline_ms);
        if phase == Phase::Tournament && open_scoring {
            self.shared
                .database
                .open_zsl_level_at_ms(
                    self.shared.round_id,
                    &self.shared.owner,
                    slot as i32 + 1,
                    index as i32,
                    transition.scoring_level,
                    server_deadline_ms
                        .context("ZSL server round deadline unavailable")
                        .context(TransitionFailed)?,
                )
                .await?;
        }
        let deadline_ms = server_deadline_ms.unwrap_or(deadline * 1000);
        state.loaded_at = server_round.as_ref().map(|round| round.key.loaded_at);
        live.round = server_round.map(|round| round.key);
        live.next = None;
        state.next = None;
        state.deadline_ms = Some(deadline_ms);
        state.phase = phase;
        state.timeslot = slot;
        state.index = index;
        state.deadline = deadline_ms.div_euclid(1000);
        if phase == Phase::Tournament {
            if state.pinned.is_none() {
                let bundle = transition
                    .asset
                    .bundle
                    .as_ref()
                    .context("ZSL playlist unavailable")?;
                state.pinned = Some((**bundle).clone());
            }
            state.started[slot] = true;
            state.scored_through[slot] = Some(index);
        }
        self.shared
            .remember_playable(phase, index, &transition.level)
            .await;
        live.ready = Some((
            transition.level.level.uid.clone(),
            transition.level.level.workshop_id,
        ));
        live.active = Some((phase, slot, index));
        live.current_level_id = transition.scoring_level;
        live.asset = Some(transition.asset);
        *self.shared.recovery.lock().await = None;
        live.last_board = None;
        self.scoring_scope(state, live);
        tracing::info!(generation = transition.generation, phase = ?phase, slot, index, "ZSL transition committed");
        Ok(())
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
        self.context.advance_generation();
        let packets = {
            let mut board = self.board.lock().await;
            board.clear_standings();
            board.set_ready(false);
            board.reconcile()?
        };
        if let Err(error) = self.context.publish(packets).await {
            tracing::warn!(%error, "ZSL standings reset failed");
        }
        let adopted = self.context.server_round().is_some_and(|round| {
            round.state == 0
                && round.key.uid == level.level.uid
                && round.key.workshop_id == level.level.workshop_id
                && self
                    .context
                    .remote_now()
                    .is_some_and(|now| round.remaining(now) > 0.0)
        });
        if adopted {
            self.context.adopt_level(level.clone()).await;
            let round = self
                .context
                .server_round()
                .context("ZSL server round unavailable")?;
            self.context
                .select_round(
                    asset.playlist.clone(),
                    transition.index,
                    (transition.index + 1).min(asset.playlist.levels.len() - 1),
                    round.seconds,
                )
                .await?;
        } else {
            self.context.set_round_time(*seconds).await?;
            self.context
                .activate_current_generation(level.clone(), Some(asset.playlist.clone()))
                .await?;
        }
        // Presentation can fail independently after the GameServer has started play.
        if let Err(error) = self
            .context
            .publish(vec![change_lobby_name_packet(title)?])
            .await
        {
            tracing::warn!(%error, "ZSL room name update failed");
        }
        if let Err(error) = self
            .context
            .publish(vec![zc_core::zeepnet::change_lobby_visibility_packet(
                self.shared.tournament.room.is_public,
            )?])
            .await
        {
            tracing::warn!(%error, "ZSL room visibility update failed");
        }
        Ok(())
    }
    async fn tick(&self) -> Result<()> {
        let _lifecycle = self.shared.lifecycle.lock().await;
        let mut state = self.shared.saved.lock().await.clone();
        let mut live = self.live.lock().await.clone();
        let outcome = self.tick_state(&mut state, &mut live).await;
        self.shared.retain(&state).await;
        self.scoring_scope(&state, &live);
        *self.live.lock().await = live;
        outcome
    }
    async fn tick_state(&self, state: &mut SavedState, live: &mut LiveState) -> Result<()> {
        if !self.context.is_host()
            || self.stopped.load(Ordering::Acquire)
            || self.shared.retire.load(Ordering::Acquire)
        {
            return Ok(());
        }
        let event = self.shared.event()?;
        let now = jiff::Timestamp::now().as_second();
        self.drive_round(state, live, &event, false).await?;
        if self.shared.retire.load(Ordering::Acquire) {
            return Ok(());
        }
        let slot = Self::eligible_slot(state, &event, now);
        let start = event_start(&event, slot);
        if now >= start - 1200 && state.starts[slot].is_none() {
            state.starts[slot] = Some(start);
            if state.warmups[slot].is_none()
                && let Some(asset) = self.shared.selections.lock().await.warmup.as_ref()
            {
                state.warmups[slot] = asset.bundle.as_deref().cloned();
            }
            self.shared.save(state).await?;
        }
        if live
            .last_save
            .is_none_or(|last| last.elapsed() >= Duration::from_secs(15))
        {
            self.shared.save(state).await?;
            live.last_save = Some(Instant::now());
        }
        if let Err(error) = self.flush(state).await {
            tracing::warn!(%error, "ZSL accepted finishes waiting for persistence");
        }
        self.round_announcements(state, live, &event).await?;
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
            self.standings(state, live, &event).await?;
            live.last_board = Some(Instant::now());
        }
        Ok(())
    }

    async fn fail_slot(
        &self,
        state: &mut SavedState,
        live: &mut LiveState,
        slot: usize,
    ) -> Result<()> {
        live.ready = None;
        *self.scoring.write().unwrap() = None;
        self.mark_slot_failed(state, slot).await?;
        self.restore_playable(state, live, slot).await
    }

    async fn mark_slot_failed(&self, state: &mut SavedState, slot: usize) -> Result<()> {
        state.failed[slot] = true;
        self.shared.save(state).await?;
        self.once(
            state,
            format!("unscored:{slot}"),
            // Reference command: `/cm18`
            &chat_notice(
                "Unscored Timeslot",
                "Tournament levels are unavailable. You can stay and play.",
            ),
        )
        .await
    }

    async fn restore_playable(
        &self,
        state: &mut SavedState,
        live: &mut LiveState,
        slot: usize,
    ) -> Result<()> {
        if live.active == Some((Phase::Waiting, slot, 0)) {
            return Ok(());
        }
        *self.scoring.write().unwrap() = None;
        state.phase = Phase::Waiting;
        state.timeslot = slot;
        let retained = self.shared.last_playable.lock().await.clone();
        let level = if let Some(level) = retained {
            Some(level)
        } else if let Some(asset) = self.shared.selections.lock().await.warmup.clone() {
            Some(asset.first().await?)
        } else {
            None
        };
        if let Some(level) = level {
            self.context.set_round_time(300.0).await?;
            self.context
                .activate(level.clone(), None)
                .await
                .context(TransitionFailed)?;
            *self.shared.last_playable.lock().await = Some(level);
            live.active = Some((Phase::Waiting, slot, 0));
            live.ready = None;
            live.current_level_id = None;
            live.asset = None;
            self.context
                .set_visibility(self.shared.tournament.room.is_public)
                .await?;
        }
        self.shared.save(state).await
    }

    fn overlay_interval(&self, phase: Phase) -> Duration {
        let config = if phase == Phase::Practice {
            self.shared
                .practice
                .as_ref()
                .unwrap_or(&self.shared.tournament)
        } else {
            &self.shared.tournament
        };
        Duration::from_millis(config.message_refresh_ms)
    }

    async fn overlay(
        &self,
        state: &SavedState,
        live: &LiveState,
        event: &ZslEvent,
        now: i64,
    ) -> Result<()> {
        let interval = self.overlay_interval(state.phase);
        let Some(key) = self.context.round_message_due(interval) else {
            return Ok(());
        };
        if live.round.as_ref() != Some(&key) {
            return Ok(());
        }
        if state.phase == Phase::Practice {
            let remaining = (event_start(event, state.timeslot) - 1200 - now).max(0);
            let entries = live
                .asset
                .as_ref()
                .map_or(0, |asset| asset.playlist.levels.len());
            // Reference command: `/sm8`
            let body = format!(
                "{}<br>{}<br>{}",
                server_row("Round", escape_text(&event.name)),
                server_row("Level", format_args!("{} of {entries}", state.index + 1)),
                server_row(
                    "Handover in",
                    format_args!(
                        "{}d {}h {}m",
                        remaining / 86400,
                        remaining % 86400 / 3600,
                        remaining % 3600 / 60
                    )
                )
            );
            self.context
                .send_round_message(
                    &key,
                    interval,
                    &server_message(
                        self.shared.practice.as_ref().unwrap().round_time_seconds + 120,
                        "ZSL Practice",
                        &body,
                    ),
                )
                .await
        } else if let Some(bundle) = state
            .pinned
            .as_ref()
            .or_else(|| live.asset.as_ref()?.bundle.as_deref())
        {
            // Reference commands: `/sm9`, `/sm12`
            let status = if state.phase == Phase::Warmup {
                zsl_messages::warmup_status((event_start(event, state.timeslot) - now).max(0) as u64)
            } else if live.current_level_id.is_none() {
                // Reference command: `/sm11`
                "Breaktime".into()
            } else {
                // Reference command: `/sm10`
                "Running".into()
            };
            self.context
                .send_round_message(
                    &key,
                    interval,
                    &zsl_messages::overlay(
                        event,
                        bundle,
                        if state.phase == Phase::Warmup {
                            0
                        } else {
                            state.index
                        },
                        &status,
                        state.phase == Phase::Warmup,
                        self.phase_seconds(state.phase) as u64,
                    ),
                )
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
        let Some(level) = live
            .asset
            .as_ref()
            .and_then(|asset| asset.playlist.levels.get(state.index))
        else {
            return Ok(());
        };
        let level_id = live.current_level_id;
        let mut times: HashMap<u64, i64> = live
            .finishes
            .iter()
            .filter(|finish| Some(finish.id_level) == level_id)
            .map(|finish| (finish.steam_id as u64, finish.microseconds))
            .collect();
        for (&steam, &time) in live.records.iter().filter(|_| level_id.is_some()) {
            if state.timeslot == 1
                && live.finishes.iter().any(|finish| {
                    Some(finish.id_level) == level_id
                        && finish.steam_id == steam as i64
                        && finish.timeslot == 1
                        && finish.finalised
                })
            {
                continue;
            }
            times
                .entry(steam)
                .and_modify(|old| *old = (*old).min(time))
                .or_insert(time);
        }
        let mut totals: HashMap<u64, i32> = HashMap::new();
        // Timeslot 1 can already have results for the entire playlist.
        let previous_level_ids = self
            .shared
            .database
            .zsl_previous_scoring_level_ids(
                self.shared.round_id,
                state.timeslot as i32 + 1,
                state.index as i32,
            )
            .await?;
        let points_for_rank = |position: usize| {
            event
                .points
                .get(position - 1)
                .copied()
                .unwrap_or(event.minimum_points)
        };
        for id in previous_level_ids
            .into_iter()
            .filter(|&id| Some(id) != level_id)
        {
            let values = live
                .finishes
                .iter()
                .filter(|finish| finish.id_level == id)
                .map(|finish| (finish.steam_id as u64, finish.microseconds))
                .collect();
            for (steam, _, position) in ranked_times(values) {
                *totals.entry(steam).or_default() += points_for_rank(position);
            }
        }
        let current: HashMap<_, _> = ranked_times(times)
            .into_iter()
            .map(|(steam, time, position)| {
                let points = points_for_rank(position);
                *totals.entry(steam).or_default() += points;
                (steam, (time, position, points))
            })
            .collect();
        let mut board = self.board.lock().await;
        let desired = board
            .roster_steam_ids()
            .into_iter()
            .map(|steam_id| {
                let result = current.get(&steam_id);
                DesiredPlayerStanding {
                    steam_id,
                    time: result.map(|&(time, _, _)| time as f32 / 1_000_000.0),
                    overrides: LeaderboardOverrides {
                        position: result
                            .map_or_else(String::new, |&(_, position, _)| position.to_string()),
                        points: totals
                            .get(&steam_id)
                            .copied()
                            .unwrap_or_default()
                            .to_string(),
                        points_won: result
                            .map_or_else(|| " ".into(), |&(_, _, points)| points.to_string()),
                        ..Default::default()
                    },
                }
            })
            .collect();
        board.set_scope(
            format!(
                "zsl:{}:{}:{}",
                self.shared.round_id, state.timeslot, state.index
            ),
            level.uid.clone(),
        );
        board.set_ready(true);
        board.set_desired(desired);
        let packets = board.reconcile()?;
        drop(board);
        self.context.publish_standings(packets).await?;
        Ok(())
    }
    async fn process_packet(
        &self,
        packet: &GameHostPacket,
        received_at: jiff::Timestamp,
        admitted: bool,
    ) -> Result<()> {
        self.board.lock().await.observe(packet);
        if self.stopped.load(Ordering::Acquire)
            || self.shared.retire.load(Ordering::Acquire)
            || !self.context.is_host()
        {
            return Ok(());
        }
        // Name updates must not replace a fresh native finish with stale DB standings.
        let packets = self.board.lock().await.reconcile_names()?;
        self.context.publish(packets).await?;
        // Receipt and upload stay independent of lifecycle callbacks.
        if !matches!(
            packet,
            GameHostPacket::PlayerConnected { .. }
                | GameHostPacket::PlaylistIndex { .. }
                | GameHostPacket::GameState(2)
        ) && !admitted
        {
            return Ok(());
        }
        if matches!(packet, GameHostPacket::GameState(2)) && self.live.lock().await.round.is_none()
        {
            return Ok(());
        }
        let _lifecycle = self.shared.lifecycle.lock().await;
        let mut state = self.shared.saved.lock().await.clone();
        let mut live = self.live.lock().await.clone();
        let outcome = self
            .process_packet_state(packet, received_at, &mut state, &mut live)
            .await;
        self.shared.retain(&state).await;
        *self.live.lock().await = live.clone();
        self.scoring_scope(&state, &live);
        outcome
    }
    async fn process_packet_state(
        &self,
        packet: &GameHostPacket,
        received_at: jiff::Timestamp,
        state: &mut SavedState,
        live: &mut LiveState,
    ) -> Result<()> {
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
                let warmup = (state.phase == Phase::Warmup).then(|| {
                    (event_start(&event, state.timeslot) - received_at.as_second()).max(0) as u64
                });
                zsl_messages::welcome(
                    &event,
                    player.username.as_deref().unwrap_or(&player.backup_name),
                    warmup,
                    locked,
                )
            };
            self.context
                .chat()
                .target(player.steam_id, &message, HOSTNAME)
                .await?;
            live.last_board = None;
        }
        if live.round.is_some()
            && matches!(
                packet,
                GameHostPacket::PlaylistIndex {
                    select_next: true,
                    ..
                } | GameHostPacket::GameState(2)
            )
        {
            let select_requested = matches!(packet, GameHostPacket::PlaylistIndex { .. });
            self.drive_round(state, live, &self.shared.event()?, select_requested)
                .await?;
        }
        if matches!(packet, GameHostPacket::PlayerResult { .. }) {
            self.shared.merge_incoming(state, true);
            if state.pending.is_empty() {
                return Ok(());
            }
            for finish in &state.pending {
                if Some(finish.level_id) == live.current_level_id
                    && finish.timeslot == state.timeslot as i32 + 1
                {
                    live.records
                        .entry(finish.steam_id)
                        .and_modify(|old| *old = (*old).min(finish.microseconds))
                        .or_insert(finish.microseconds);
                }
            }
            self.shared.retain(state).await;
            if let Err(error) = self.shared.save(state).await {
                tracing::warn!(%error, "ZSL pending finish remains in memory");
                return Ok(());
            }
            if let Err(error) = self.sync_scoring_clock(state, live).await {
                tracing::warn!(%error, "ZSL finish queued until scoring clock correction persists");
                return Ok(());
            }
            if let Err(error) = self.flush(state).await {
                tracing::warn!(%error, "ZSL finish queued for retry");
            }
            live.last_board = None;
        }
        Ok(())
    }
}
#[async_trait::async_trait]
impl ProfileSession for ZslSession {
    fn preserve_native_finish(
        &self,
        packet: &GameHostPacket,
        steam_id: u64,
        received_at: jiff::Timestamp,
    ) -> bool {
        let tournament = self
            .scoring
            .read()
            .unwrap()
            .as_ref()
            .is_some_and(|scope| scope.phase == Phase::Tournament);
        let Some(scope) = self.receipt_scope() else {
            return !tournament;
        };
        scope.phase != Phase::Tournament
            || (scope.ready
                && received_at.as_millisecond() < scope.deadline
                && (scope.timeslot == 0 || !scope.locked_players.contains(&steam_id))
                && matches!(packet, GameHostPacket::PlayerResult { level_uid, .. }
                if scope.identity.as_ref().is_some_and(|(uid, _)| uid == level_uid)))
    }
    fn confirm_receipt(&self, event: &TransferEvent) {
        if event.kind != TransferEventKind::Ready || !self.context.is_host() {
            return;
        }
        let mut scope = self.scoring.write().unwrap();
        if let Some(scope) = scope.as_mut()
            && scope.identity.as_ref().is_some_and(|(uid, workshop_id)| {
                *uid == event.level.level.uid && *workshop_id == event.level.level.workshop_id
            })
        {
            scope.ready = true;
        }
    }
    async fn start(&self) -> Result<()> {
        let refresh = async {
            let mut interval =
                tokio::time::interval(Duration::from_millis(self.shared.tournament.asset_poll_ms));
            interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
            loop {
                interval.tick().await;
                self.shared.refresh_assets().await;
            }
        };
        let run = async {
            self.context.chat().command("/joinmessage off").await?;
            let mut tick = tokio::time::interval(Duration::from_millis(250));
            tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
            loop {
                tokio::select! {
                    _ = self.wake.notified() => return Ok(()),
                    _ = tick.tick() => {
                        if self.stopped.load(Ordering::Acquire) { return Ok(()); }
                        if let Err(error) = self.tick().await {
                            if error.is::<TransitionFailed>() || !self.context.is_host()
                                || error.to_string().contains("ownership lost") { return Err(error); }
                            if error.is::<TransitionExpired>() { continue; }
                            tracing::warn!(%error, "ZSL lifecycle tick failed; retaining pending results");
                        }
                    }
                }
            }
        };
        let messages = async {
            loop {
                let phase = self.shared.saved.lock().await.phase;
                self.context
                    .wait_for_round_message(self.overlay_interval(phase))
                    .await;
                let state = self.shared.saved.lock().await.clone();
                let live = self.live.lock().await.clone();
                let now = jiff::Timestamp::now().as_second();
                self.overlay(&state, &live, &self.shared.event()?, now)
                    .await?;
                // While the next round commits, its clock can already be running.
                if self
                    .context
                    .round_message_due(self.overlay_interval(state.phase))
                    .is_some()
                {
                    tokio::time::sleep(Duration::from_millis(20)).await;
                }
            }
        };
        tokio::select! { _ = refresh => Ok(()), result = run => result, result = messages => result }
    }
    fn capture_receipt(
        &self,
        packet: &GameHostPacket,
        received_at: jiff::Timestamp,
        players: &[zc_core::zeepnet::GameHostPlayer],
    ) -> Option<Arc<dyn std::any::Any + Send + Sync>> {
        let scope = self.receipt_scope()?;
        let GameHostPacket::PlayerResult {
            uid,
            has_result: true,
            level_uid,
            time,
            ..
        } = packet
        else {
            return None;
        };
        if !self.context.is_host()
            || self.stopped.load(Ordering::Acquire)
            || self.shared.retire.load(Ordering::Acquire)
            || scope.phase != Phase::Tournament
            || !scope.ready
            || received_at.as_millisecond() >= scope.deadline
            || scope
                .identity
                .as_ref()
                .is_none_or(|(ready, _)| ready != level_uid)
        {
            return None;
        }
        let level_id = scope.level_id?;
        let microseconds = normalized_time(*time)?;
        let player = players
            .iter()
            .find(|player| player.uid == *uid && player.steam_id != self.context.local_steam_id)?;
        if scope.timeslot == 1 && scope.locked_players.contains(&player.steam_id) {
            return None;
        }
        let finish = PendingFinish {
            steam_id: player.steam_id,
            name: player
                .username
                .as_ref()
                .unwrap_or(&player.backup_name)
                .clone(),
            level_id,
            timeslot: scope.timeslot as i32 + 1,
            microseconds,
            received_at_ms: received_at.as_millisecond(),
            index: scope.index,
        };
        self.shared.incoming.lock().unwrap().push(finish);
        tracing::debug!(
            generation = scope.generation,
            timeslot = scope.timeslot + 1,
            level_id,
            "ZSL finish admitted at receipt"
        );
        Some(Arc::new(scope))
    }
    async fn on_packet(&self, packet: &GameHostPacket) -> Result<()> {
        let received_at = jiff::Timestamp::now();
        let mut admitted = false;
        if matches!(packet, GameHostPacket::PlayerResult { .. }) {
            let state = self.shared.saved.lock().await;
            let live = self.live.lock().await;
            self.scoring_scope(&state, &live);
            drop(live);
            drop(state);
            admitted = self
                .capture_receipt(packet, received_at, &self.context.players().await)
                .is_some();
        }
        self.process_packet(packet, received_at, admitted).await
    }
    async fn on_received(&self, received: &ReceivedPacket) -> Result<()> {
        self.process_packet(
            &received.packet,
            received.received_at,
            received.captured.is_some(),
        )
        .await
    }
    async fn on_transfer(&self, _: &TransferEvent) -> Result<()> {
        // Round identity is committed from the receipt clock, including same-track repeats.
        Ok(())
    }
    async fn stop(&self) {
        self.stopped.store(true, Ordering::Release);
        *self.scoring.write().unwrap() = None;
        let mut state = self.shared.saved.lock().await.clone();
        self.shared.merge_incoming(&mut state, true);
        self.shared.retain(&state).await;
        if !state.pending.is_empty()
            && let Err(error) =
                tokio::time::timeout(Duration::from_secs(2), self.shared.save(&state))
                    .await
                    .map(|result| result.map_err(|error| error.to_string()))
                    .unwrap_or_else(|error| Err(error.to_string()))
        {
            tracing::warn!(%error, "ZSL accepted finishes waiting for recovery");
        }
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
