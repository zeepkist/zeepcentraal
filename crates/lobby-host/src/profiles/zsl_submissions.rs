use super::{SubmissionAsset, SubmissionAssets, SubmissionPlaylist, messages::submission_message};
use crate::{
    config::ManagedRoomConfig,
    runtime::{LobbyProfile, ProfileSession, RoomContext},
    transfer::TransferEvent,
};
use anyhow::{Context, Result, bail};
use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};
use tokio::sync::{Mutex, Notify, RwLock};
use zc_core::{
    object_storage::ObjectStorage,
    zeepnet::{GameHostPacket, OnlineLevel},
};
use zc_database::Database;

pub struct ZslSubmissionsProfile {
    config: ManagedRoomConfig,
    assets: Arc<dyn SubmissionSource>,
    current: Arc<RwLock<Option<CurrentSubmission>>>,
    stopped: AtomicBool,
}

#[async_trait::async_trait]
trait SubmissionSource: Send + Sync {
    async fn refresh(&self) -> Result<SubmissionPlaylist>;
}

#[async_trait::async_trait]
impl SubmissionSource for SubmissionAssets {
    async fn refresh(&self) -> Result<SubmissionPlaylist> {
        SubmissionAssets::refresh(self).await
    }
}

#[derive(Clone)]
struct CurrentSubmission {
    asset: SubmissionAsset,
    level: crate::assets::PreparedLevel,
}

impl ZslSubmissionsProfile {
    pub fn new(
        config: ManagedRoomConfig,
        database: Database,
        storage: Arc<dyn ObjectStorage>,
        thread_id: String,
    ) -> Self {
        Self {
            config,
            assets: Arc::new(SubmissionAssets::new(database, storage, thread_id)),
            current: Arc::new(RwLock::new(None)),
            stopped: AtomicBool::new(false),
        }
    }
}

#[async_trait::async_trait]
impl LobbyProfile for ZslSubmissionsProfile {
    fn name(&self) -> &str {
        "zsl-submissions"
    }

    async fn prepare(&self) -> Result<Option<crate::assets::PreparedLevel>> {
        if self.stopped.load(Ordering::Acquire) {
            return Ok(None);
        }
        let previous = self.current.read().await.clone();
        let asset = match self.assets.refresh().await {
            Ok(SubmissionPlaylist::Ready(asset)) => asset,
            Ok(SubmissionPlaylist::Empty) => {
                *self.current.write().await = None;
                return Ok(None);
            }
            Ok(SubmissionPlaylist::Missing) => return Ok(previous.map(|current| current.level)),
            Err(error) if previous.is_some() => {
                tracing::warn!(%error, "Submission playlist refresh failed; current playlist retained");
                return Ok(previous.map(|current| current.level));
            }
            Err(error) => return Err(error),
        };
        let level = if let Some(previous) = previous.filter(|current| {
            asset.playlist.levels.iter().any(|level| {
                level.uid == current.level.level.uid
                    && level.workshop_id == current.level.level.workshop_id
            })
        }) {
            if previous.asset.digest == asset.digest {
                previous.level
            } else {
                asset
                    .load(&previous.level.level.uid, previous.level.level.workshop_id)
                    .await?
                    .context("Submission playlist current level unavailable")?
            }
        } else {
            asset.first().await?
        };
        *self.current.write().await = Some(CurrentSubmission {
            asset,
            level: level.clone(),
        });
        Ok(Some(level))
    }

    async fn create_session(&self, context: RoomContext) -> Result<Arc<dyn ProfileSession>> {
        let current = self
            .current
            .read()
            .await
            .clone()
            .context("Submission playlist unavailable")?;
        let current_index = current
            .asset
            .playlist
            .levels
            .iter()
            .position(|level| {
                level.uid == current.level.level.uid
                    && level.workshop_id == current.level.level.workshop_id
            })
            .context("Submission current level absent from playlist")?;
        let next_index = (current_index + 1) % current.asset.playlist.levels.len();
        Ok(Arc::new(ZslSubmissionsSession {
            config: self.config.clone(),
            assets: self.assets.clone(),
            current: self.current.clone(),
            context,
            state: Mutex::new(SessionState {
                active: current.asset,
                pending: None,
                current_index,
                next_index,
            }),
            initial_level: current.level,
            stopped: AtomicBool::new(false),
            wake: Notify::new(),
            boundary: Notify::new(),
            poll: Mutex::new(()),
            transitioning: AtomicBool::new(false),
        }))
    }

    async fn stop(&self) -> Result<()> {
        self.stopped.store(true, Ordering::Release);
        Ok(())
    }
}

struct SessionState {
    active: SubmissionAsset,
    pending: Option<SubmissionAsset>,
    current_index: usize,
    next_index: usize,
}

struct TransitionGuard<'a>(&'a AtomicBool);

impl Drop for TransitionGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

fn digest_prefix(digest: &str) -> &str {
    digest.get(..12).unwrap_or(digest)
}

fn level_position(asset: &SubmissionAsset, level: &OnlineLevel) -> Option<usize> {
    asset.playlist.levels.iter().position(|candidate| {
        candidate.uid == level.uid && candidate.workshop_id == level.workshop_id
    })
}

fn retained_indices(state: &SessionState, asset: &SubmissionAsset) -> Option<(usize, usize)> {
    let current = state.active.playlist.levels.get(state.current_index)?;
    let current_index = level_position(asset, current)?;
    let next_index = state
        .active
        .playlist
        .levels
        .get(state.next_index)
        .and_then(|next| level_position(asset, next))
        .filter(|next| *next != current_index)
        .unwrap_or((current_index + 1) % asset.playlist.levels.len());
    Some((current_index, next_index))
}

struct ZslSubmissionsSession {
    config: ManagedRoomConfig,
    assets: Arc<dyn SubmissionSource>,
    current: Arc<RwLock<Option<CurrentSubmission>>>,
    context: RoomContext,
    state: Mutex<SessionState>,
    initial_level: crate::assets::PreparedLevel,
    stopped: AtomicBool,
    wake: Notify,
    boundary: Notify,
    poll: Mutex<()>,
    transitioning: AtomicBool,
}

impl ZslSubmissionsSession {
    async fn overlay(&self) -> Result<()> {
        if self.stopped.load(Ordering::Acquire) || !self.context.is_host() {
            return Ok(());
        }
        let entries = self.state.lock().await.active.playlist.levels.len();
        self.context
            .chat()
            .command(&submission_message(entries, self.config.round_time_seconds))
            .await
    }

    async fn refresh_overlay(&self) {
        if let Err(error) = self.overlay().await {
            tracing::warn!(%error, "Submission showcase message failed");
        }
    }

    async fn apply_retained(
        &self,
        state: &mut SessionState,
        candidate: SubmissionAsset,
    ) -> Result<bool> {
        let Some((current_index, next_index)) = retained_indices(state, &candidate) else {
            return Ok(false);
        };
        let entries = candidate.playlist.levels.len();
        if let Err(error) = self
            .context
            .update_playlist(
                candidate.playlist.clone(),
                current_index as i32,
                next_index as i32,
            )
            .await
        {
            tracing::warn!(
                room = %self.config.key,
                digest = digest_prefix(&candidate.digest),
                entries,
                %error,
                "Submission playlist update failed"
            );
            return Err(error);
        }
        state.current_index = current_index;
        state.next_index = next_index;
        state.pending = None;
        state.active = candidate;
        tracing::info!(
            room = %self.config.key,
            digest = digest_prefix(&state.active.digest),
            entries,
            "Submission playlist update applied"
        );
        Ok(true)
    }

    async fn refresh(&self) -> Result<()> {
        let _poll = self.poll.lock().await;
        if self.transitioning.load(Ordering::Acquire) {
            return Ok(());
        }
        let next = match self.assets.refresh().await {
            Ok(SubmissionPlaylist::Ready(next)) => next,
            Ok(SubmissionPlaylist::Missing) => {
                self.state.lock().await.pending = None;
                return Ok(());
            }
            Ok(SubmissionPlaylist::Empty) => bail!("Submission playlist became empty"),
            Err(error) => {
                tracing::warn!(%error, "Submission playlist refresh failed; current playlist retained");
                return Ok(());
            }
        };
        if self.stopped.load(Ordering::Acquire) {
            return Ok(());
        }
        let mut state = self.state.lock().await;
        if next.digest != state.active.digest {
            let staged = state
                .pending
                .as_ref()
                .is_none_or(|pending| pending.digest != next.digest);
            if staged {
                tracing::info!(
                    room = %self.config.key,
                    digest = digest_prefix(&next.digest),
                    entries = next.playlist.levels.len(),
                    "Submission playlist update staged"
                );
                state.pending = Some(next);
            }
            let candidate = state
                .pending
                .clone()
                .expect("changed digest has pending asset");
            let applied = self.apply_retained(&mut state, candidate.clone()).await?;
            if !applied && staged {
                tracing::info!(
                    room = %self.config.key,
                    digest = digest_prefix(&candidate.digest),
                    entries = candidate.playlist.levels.len(),
                    "Submission playlist update deferred until round boundary"
                );
            }
            drop(state);
            if applied {
                self.refresh_overlay().await;
            }
        } else {
            state.pending = None;
        }
        Ok(())
    }

    async fn select_next(&self) -> Result<()> {
        let mut state = self.state.lock().await;
        if self.transitioning.load(Ordering::Acquire) {
            return Ok(());
        }
        let changed = state.pending.is_some();
        let candidate = state
            .pending
            .clone()
            .unwrap_or_else(|| state.active.clone());
        let retained = retained_indices(&state, &candidate);
        let current_index = retained.map_or(0, |(current, _)| current);
        let next_index = if retained.is_some() {
            (current_index + 1) % candidate.playlist.levels.len()
        } else {
            0
        };
        let entries = candidate.playlist.levels.len();
        if let Err(error) = self
            .context
            .update_playlist(
                candidate.playlist.clone(),
                current_index as i32,
                next_index as i32,
            )
            .await
        {
            tracing::warn!(
                room = %self.config.key,
                digest = digest_prefix(&candidate.digest),
                entries,
                %error,
                "Submission playlist update failed"
            );
            return Err(error);
        }
        state.current_index = current_index;
        state.next_index = next_index;
        if changed {
            state.active = candidate;
            state.pending = None;
            tracing::info!(
                room = %self.config.key,
                digest = digest_prefix(&state.active.digest),
                entries,
                "Submission playlist update applied"
            );
        }
        drop(state);
        if changed {
            self.refresh_overlay().await;
        }
        Ok(())
    }

    async fn apply_at_boundary(&self) -> Result<()> {
        let mut state = self.state.lock().await;
        if self.transitioning.load(Ordering::Acquire) {
            return Ok(());
        }
        let Some(candidate) = state.pending.clone() else {
            return Ok(());
        };
        let applied = self.apply_retained(&mut state, candidate).await?;
        drop(state);
        if applied {
            self.refresh_overlay().await;
        } else {
            self.boundary.notify_one();
        }
        Ok(())
    }

    async fn activate_deferred(&self) -> Result<()> {
        if self.stopped.load(Ordering::Acquire) {
            return Ok(());
        }
        let _poll = self.poll.lock().await;
        let state = self.state.lock().await;
        let Some(candidate) = state.pending.clone() else {
            return Ok(());
        };
        if retained_indices(&state, &candidate).is_some() {
            drop(state);
            return self.apply_at_boundary().await;
        }
        self.transitioning.store(true, Ordering::Release);
        let transition = TransitionGuard(&self.transitioning);
        // The receive loop must stay free to deliver the new level request.
        drop(state);
        let entries = candidate.playlist.levels.len();
        let first_result = tokio::select! {
            result = candidate.first() => result,
            _ = self.wake.notified() => return Ok(()),
        };
        let first = match first_result {
            Ok(first) => first,
            Err(error) => {
                tracing::warn!(
                    room = %self.config.key,
                    digest = digest_prefix(&candidate.digest),
                    entries,
                    %error,
                    "Submission playlist update failed"
                );
                return Err(error);
            }
        };
        if self.stopped.load(Ordering::Acquire) {
            return Ok(());
        }
        let result = tokio::select! {
            result = self.context.activate(first.clone(), Some(candidate.playlist.clone())) => result,
            _ = self.wake.notified() => return Ok(()),
        };
        if let Err(error) = result {
            tracing::warn!(
                room = %self.config.key,
                digest = digest_prefix(&candidate.digest),
                entries,
                %error,
                "Submission playlist update failed"
            );
            return Err(error);
        }
        if self.stopped.load(Ordering::Acquire) {
            return Ok(());
        }
        let mut state = self.state.lock().await;
        let active = candidate.clone();
        state.active = candidate;
        state.pending = None;
        state.current_index = 0;
        state.next_index = usize::from(entries > 1);
        tracing::info!(
            room = %self.config.key,
            digest = digest_prefix(&state.active.digest),
            entries,
            "Submission playlist update applied"
        );
        drop(state);
        *self.current.write().await = Some(CurrentSubmission {
            asset: active,
            level: first,
        });
        drop(transition);
        self.refresh_overlay().await;
        Ok(())
    }
}

#[async_trait::async_trait]
impl ProfileSession for ZslSubmissionsSession {
    async fn start(&self) -> Result<()> {
        let playlist = self.state.lock().await.active.playlist.clone();
        self.context
            .activate(self.initial_level.clone(), Some(playlist))
            .await?;
        self.overlay().await?;
        let mut refresh = tokio::time::interval(std::time::Duration::from_secs(30));
        let mut message = tokio::time::interval(std::time::Duration::from_secs(60));
        refresh.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        message.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        refresh.tick().await;
        message.tick().await;
        loop {
            if self.stopped.load(Ordering::Acquire) {
                return Ok(());
            }
            tokio::select! {
                _ = self.wake.notified() => return Ok(()),
                _ = refresh.tick() => self.refresh().await?,
                _ = self.boundary.notified() => self.activate_deferred().await?,
                _ = message.tick() => {
                    self.refresh_overlay().await;
                },
            }
        }
    }

    async fn on_packet(&self, packet: &GameHostPacket) -> Result<()> {
        if self.stopped.load(Ordering::Acquire) || self.transitioning.load(Ordering::Acquire) {
            return Ok(());
        }
        if let GameHostPacket::PlaylistIndex {
            current_index,
            next_index,
            select_next,
        } = packet
        {
            if *select_next {
                self.select_next().await?;
            } else if *current_index >= 0 {
                let mut state = self.state.lock().await;
                if self.transitioning.load(Ordering::Acquire) {
                    return Ok(());
                }
                let index = *current_index as usize;
                if index < state.active.playlist.levels.len() {
                    let changed = state.current_index != index;
                    state.current_index = index;
                    if *next_index >= 0
                        && (*next_index as usize) < state.active.playlist.levels.len()
                    {
                        state.next_index = *next_index as usize;
                    }
                    let has_pending = state.pending.is_some();
                    drop(state);
                    if changed && has_pending {
                        self.apply_at_boundary().await?;
                    }
                }
            }
        }
        Ok(())
    }

    async fn on_transfer(&self, event: &TransferEvent) -> Result<()> {
        if self.stopped.load(Ordering::Acquire)
            || self.transitioning.load(Ordering::Acquire)
            || event.kind != crate::transfer::TransferEventKind::Ready
        {
            return Ok(());
        }
        let mut state = self.state.lock().await;
        if self.transitioning.load(Ordering::Acquire) {
            return Ok(());
        }
        let changed = state
            .active
            .playlist
            .levels
            .get(state.current_index)
            .is_some_and(|current| {
                current.uid != event.level.level.uid
                    || current.workshop_id != event.level.level.workshop_id
            });
        if let Some(index) = level_position(&state.active, &event.level.level) {
            state.current_index = index;
            if changed {
                state.next_index = (index + 1) % state.active.playlist.levels.len();
            }
        }
        let has_pending = state.pending.is_some();
        drop(state);
        if changed && has_pending {
            self.apply_at_boundary().await?;
        }
        let asset = self.state.lock().await.active.clone();
        if asset.playlist.levels.iter().any(|level| {
            level.uid == event.level.level.uid && level.workshop_id == event.level.level.workshop_id
        }) {
            *self.current.write().await = Some(CurrentSubmission {
                asset,
                level: event.level.clone(),
            });
        }
        Ok(())
    }

    async fn stop(&self) {
        if !self.stopped.swap(true, Ordering::AcqRel) {
            self.wake.notify_one();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        assets::{LevelLoader, PreparedLevel, PreparedPlaylist},
        chat::FnPacketSender,
        config::LobbyHostFileConfig,
        transfer::TransferEventKind,
    };
    use std::{collections::VecDeque, sync::atomic::AtomicUsize};
    use zc_core::zeepnet::{OnlineLevel, chat_message_packet, parse_game_host_packet};

    struct TestSource {
        results: Mutex<VecDeque<Result<SubmissionPlaylist>>>,
    }

    impl TestSource {
        fn new(results: Vec<Result<SubmissionPlaylist>>) -> Self {
            Self {
                results: Mutex::new(results.into()),
            }
        }
    }

    #[async_trait::async_trait]
    impl SubmissionSource for TestSource {
        async fn refresh(&self) -> Result<SubmissionPlaylist> {
            self.results
                .lock()
                .await
                .pop_front()
                .expect("test source exhausted")
        }
    }

    struct TestLoader(Vec<PreparedLevel>);

    #[async_trait::async_trait]
    impl LevelLoader for TestLoader {
        async fn load(&self, uid: &str, workshop_id: u64) -> Result<Option<PreparedLevel>> {
            Ok(self
                .0
                .iter()
                .find(|level| level.level.uid == uid && level.level.workshop_id == workshop_id)
                .cloned())
        }
    }

    fn asset(digest: &str, ids: &[u64]) -> Result<SubmissionAsset> {
        let levels: Vec<_> = ids
            .iter()
            .map(|id| PreparedLevel {
                compressed_data: Arc::from([*id as u8]),
                content_sha256: format!("hash-{id}").into(),
                level: OnlineLevel {
                    author: String::new(),
                    collaborators: String::new(),
                    name: format!("Level {id}"),
                    override_author_name: String::new(),
                    uid: format!("uid-{id}"),
                    workshop_id: *id,
                },
            })
            .collect();
        Ok(SubmissionAsset {
            digest: digest.into(),
            playlist: PreparedPlaylist::new(
                levels.iter().map(|level| level.level.clone()).collect(),
                Arc::new(TestLoader(levels)),
            )?,
        })
    }

    fn config() -> Result<ManagedRoomConfig> {
        Ok(LobbyHostFileConfig::parse(
            r#"{"version":1,"rooms":[{"key":"zsl","profile":{"type":"zsl-submissions","threadId":"1"},"room":{"name":"ZSL","isPublic":true,"maxPlayers":64},"roundTimeSeconds":900,"assetPollMs":30000,"reconnectMaxMs":60000,"messageRefreshMs":60000}]}"#,
        )?
        .rooms
        .remove(0))
    }

    async fn session(
        active: SubmissionAsset,
        current_index: usize,
        source: Arc<TestSource>,
        sent: Arc<Mutex<Vec<Vec<u8>>>>,
    ) -> Result<ZslSubmissionsSession> {
        let sink = sent.clone();
        let sender = Arc::new(FnPacketSender(move |packet| {
            let sink = sink.clone();
            async move {
                sink.lock().await.push(packet);
                Ok(())
            }
        }));
        session_with_sender(active, current_index, source, sender).await
    }

    async fn session_with_sender(
        active: SubmissionAsset,
        current_index: usize,
        source: Arc<TestSource>,
        sender: Arc<dyn crate::chat::PacketSender>,
    ) -> Result<ZslSubmissionsSession> {
        let context = RoomContext::for_test(sender, 1)?;
        let level = &active.playlist.levels[current_index];
        let initial_level = active
            .load(&level.uid, level.workshop_id)
            .await?
            .context("Missing test level")?;
        let next_index = (current_index + 1) % active.playlist.levels.len();
        Ok(ZslSubmissionsSession {
            config: config()?,
            assets: source,
            current: Arc::new(RwLock::new(None)),
            context,
            state: Mutex::new(SessionState {
                active,
                pending: None,
                current_index,
                next_index,
            }),
            initial_level,
            stopped: AtomicBool::new(false),
            wake: Notify::new(),
            boundary: Notify::new(),
            poll: Mutex::new(()),
            transitioning: AtomicBool::new(false),
        })
    }

    async fn selected_indices(sent: &Mutex<Vec<Vec<u8>>>) -> Result<(i32, i32, Vec<u64>)> {
        let sent = sent.lock().await;
        let playlist = sent
            .iter()
            .rev()
            .find_map(|packet| match parse_game_host_packet(packet) {
                Ok(GameHostPacket::Playlist(playlist)) => Some(playlist),
                _ => None,
            })
            .context("No playlist packet")?;
        Ok((
            playlist.current_index,
            playlist.next_index,
            playlist
                .levels
                .iter()
                .map(|entry| entry.level.workshop_id)
                .collect(),
        ))
    }

    fn select_next() -> GameHostPacket {
        GameHostPacket::PlaylistIndex {
            current_index: 1,
            next_index: 2,
            select_next: true,
        }
    }

    #[test]
    fn submission_overlay_matches_bun_message() {
        assert_eq!(
            submission_message(2, 900),
            "/servermessage yellow 900 <b>ZSL Level Contest Submissions</b>\n2 valid submissions"
        );
    }

    #[tokio::test]
    async fn poll_applies_30_to_31_without_select_next_and_refreshes_overlay() -> Result<()> {
        let original_ids = (1..=30).collect::<Vec<_>>();
        let updated_ids = (1..=31).collect::<Vec<_>>();
        let source = Arc::new(TestSource::new(vec![Ok(SubmissionPlaylist::Ready(asset(
            "published-31",
            &updated_ids,
        )?))]));
        let sent = Arc::new(Mutex::new(Vec::new()));
        let session = session(
            asset("published-30", &original_ids)?,
            5,
            source,
            sent.clone(),
        )
        .await?;

        session.refresh().await?;

        assert_eq!(selected_indices(&sent).await?, (5, 6, updated_ids));
        let packets = sent.lock().await;
        assert_eq!(packets.len(), 2);
        assert_eq!(
            packets[1],
            chat_message_packet(&submission_message(31, session.config.round_time_seconds))?
        );
        let state = session.state.lock().await;
        assert_eq!(state.active.digest, "published-31");
        assert_eq!(state.current_index, 5);
        assert_eq!(session.initial_level.level.workshop_id, 6);
        assert!(state.pending.is_none());
        Ok(())
    }

    #[tokio::test]
    async fn poll_maps_current_and_next_levels_across_reordering() -> Result<()> {
        let source = Arc::new(TestSource::new(vec![Ok(SubmissionPlaylist::Ready(asset(
            "reordered",
            &[4, 2, 1, 3],
        )?))]));
        let sent = Arc::new(Mutex::new(Vec::new()));
        let session = session(asset("original", &[1, 2, 3, 4])?, 1, source, sent.clone()).await?;

        session.refresh().await?;

        assert_eq!(selected_indices(&sent).await?, (1, 3, vec![4, 2, 1, 3]));
        assert_eq!(session.state.lock().await.next_index, 3);
        Ok(())
    }

    #[tokio::test]
    async fn rapid_publications_apply_latest_and_reversion() -> Result<()> {
        let source = Arc::new(TestSource::new(vec![
            Ok(SubmissionPlaylist::Ready(asset("second", &[1, 2, 3])?)),
            Ok(SubmissionPlaylist::Ready(asset("third", &[1, 2, 3, 4])?)),
            Ok(SubmissionPlaylist::Ready(asset("first", &[1, 2])?)),
        ]));
        let sent = Arc::new(Mutex::new(Vec::new()));
        let session = session(asset("first", &[1, 2])?, 0, source, sent.clone()).await?;

        session.refresh().await?;
        session.refresh().await?;
        session.refresh().await?;

        assert_eq!(selected_indices(&sent).await?, (0, 1, vec![1, 2]));
        assert_eq!(session.state.lock().await.active.digest, "first");
        assert_eq!(
            sent.lock()
                .await
                .iter()
                .filter(|packet| matches!(
                    parse_game_host_packet(packet),
                    Ok(GameHostPacket::Playlist(_))
                ))
                .count(),
            3
        );
        Ok(())
    }

    #[tokio::test]
    async fn failed_send_does_not_commit_and_next_poll_retries() -> Result<()> {
        let source = Arc::new(TestSource::new(vec![
            Ok(SubmissionPlaylist::Ready(asset("new", &[1, 2, 3])?)),
            Ok(SubmissionPlaylist::Ready(asset("new", &[1, 2, 3])?)),
        ]));
        let calls = Arc::new(AtomicUsize::new(0));
        let sent = Arc::new(Mutex::new(Vec::new()));
        let sender = Arc::new(FnPacketSender({
            let calls = calls.clone();
            let sent = sent.clone();
            move |packet| {
                let calls = calls.clone();
                let sent = sent.clone();
                async move {
                    if calls.fetch_add(1, Ordering::AcqRel) == 0 {
                        anyhow::bail!("mock packet send failed");
                    }
                    sent.lock().await.push(packet);
                    Ok(())
                }
            }
        }));
        let session = session_with_sender(asset("old", &[1, 2])?, 0, source, sender).await?;

        assert!(session.refresh().await.is_err());
        {
            let state = session.state.lock().await;
            assert_eq!(state.active.digest, "old");
            assert_eq!(state.pending.as_ref().unwrap().digest, "new");
        }
        session.refresh().await?;
        assert_eq!(selected_indices(&sent).await?, (0, 1, vec![1, 2, 3]));
        assert_eq!(session.state.lock().await.active.digest, "new");
        Ok(())
    }

    #[tokio::test]
    async fn ready_boundary_applies_deferred_playlist_without_select_next() -> Result<()> {
        let original = asset("old", &[1, 2, 3])?;
        let next_level = original.load("uid-3", 3).await?.unwrap();
        let source = Arc::new(TestSource::new(vec![Ok(SubmissionPlaylist::Ready(asset(
            "new",
            &[3, 4],
        )?))]));
        let sent = Arc::new(Mutex::new(Vec::new()));
        let session = session(original, 1, source, sent.clone()).await?;

        session.refresh().await?;
        assert!(sent.lock().await.is_empty());
        session
            .on_transfer(&TransferEvent {
                kind: TransferEventKind::Ready,
                level: next_level,
            })
            .await?;

        assert_eq!(selected_indices(&sent).await?, (0, 1, vec![3, 4]));
        assert_eq!(session.state.lock().await.active.digest, "new");
        Ok(())
    }

    #[tokio::test]
    async fn playlist_index_boundary_applies_deferred_playlist_without_select_next() -> Result<()> {
        let source = Arc::new(TestSource::new(vec![Ok(SubmissionPlaylist::Ready(asset(
            "new",
            &[3, 4],
        )?))]));
        let sent = Arc::new(Mutex::new(Vec::new()));
        let session = session(asset("old", &[1, 2, 3])?, 1, source, sent.clone()).await?;

        session.refresh().await?;
        session
            .on_packet(&GameHostPacket::PlaylistIndex {
                current_index: 2,
                next_index: 0,
                select_next: false,
            })
            .await?;

        assert_eq!(selected_indices(&sent).await?, (0, 1, vec![3, 4]));
        assert_eq!(session.state.lock().await.active.digest, "new");
        Ok(())
    }

    #[tokio::test]
    async fn removed_level_switches_to_first_new_level_at_ready_boundary() -> Result<()> {
        let original = asset("old", &[1, 2, 3])?;
        let old_next = original.load("uid-3", 3).await?.unwrap();
        let published = asset("new", &[4, 5])?;
        let first = published.first().await?;
        let source = Arc::new(TestSource::new(vec![Ok(SubmissionPlaylist::Ready(
            published,
        ))]));
        let sent = Arc::new(Mutex::new(Vec::new()));
        let (signal, mut packets) = tokio::sync::mpsc::unbounded_channel();
        let sender = Arc::new(FnPacketSender({
            let sent = sent.clone();
            move |packet| {
                let sent = sent.clone();
                let signal = signal.clone();
                async move {
                    sent.lock().await.push(packet);
                    signal.send(()).expect("test receiver still active");
                    Ok(())
                }
            }
        }));
        let session = session_with_sender(original, 1, source, sender).await?;
        session.refresh().await?;
        assert!(sent.lock().await.is_empty());
        session
            .on_transfer(&TransferEvent {
                kind: TransferEventKind::Ready,
                level: old_next,
            })
            .await?;

        let drive = async {
            packets.recv().await.context("Missing playlist packet")?;
            packets.recv().await.context("Missing skip packet")?;
            tokio::time::timeout(
                std::time::Duration::from_millis(100),
                session.on_packet(&GameHostPacket::GameState(1)),
            )
            .await??;
            session.context.complete_test_level_request(&first).await
        };
        tokio::time::timeout(std::time::Duration::from_secs(1), async {
            tokio::try_join!(session.activate_deferred(), drive)
        })
        .await??;

        assert_eq!(selected_indices(&sent).await?, (0, 1, vec![4, 5]));
        let state = session.state.lock().await;
        assert_eq!(state.active.digest, "new");
        assert_eq!(state.current_index, 0);
        drop(state);
        assert_eq!(
            session
                .current
                .read()
                .await
                .as_ref()
                .unwrap()
                .level
                .level
                .workshop_id,
            4
        );
        Ok(())
    }

    #[tokio::test]
    async fn deferred_activation_failure_keeps_old_playlist() -> Result<()> {
        let original = asset("old", &[1, 2, 3])?;
        let old_next = original.load("uid-3", 3).await?.unwrap();
        let source = Arc::new(TestSource::new(vec![Ok(SubmissionPlaylist::Ready(asset(
            "new",
            &[4, 5],
        )?))]));
        let sender = Arc::new(FnPacketSender(|_| async {
            anyhow::bail!("mock packet send failed")
        }));
        let session = session_with_sender(original, 1, source, sender).await?;

        session.refresh().await?;
        session
            .on_transfer(&TransferEvent {
                kind: TransferEventKind::Ready,
                level: old_next,
            })
            .await?;
        assert!(session.activate_deferred().await.is_err());
        let state = session.state.lock().await;
        assert_eq!(state.active.digest, "old");
        assert_eq!(state.pending.as_ref().unwrap().digest, "new");
        Ok(())
    }

    #[tokio::test]
    async fn removed_current_level_selects_first_new_submission() -> Result<()> {
        let source = Arc::new(TestSource::new(vec![Ok(SubmissionPlaylist::Ready(asset(
            "new",
            &[4, 5],
        )?))]));
        let sent = Arc::new(Mutex::new(Vec::new()));
        let session = session(asset("old", &[1, 2, 3])?, 1, source, sent.clone()).await?;
        session.refresh().await?;
        session.on_packet(&select_next()).await?;
        assert_eq!(selected_indices(&sent).await?, (0, 0, vec![4, 5]));
        Ok(())
    }

    #[tokio::test]
    async fn retained_current_level_advances_without_skip() -> Result<()> {
        let source = Arc::new(TestSource::new(vec![Ok(SubmissionPlaylist::Ready(asset(
            "new",
            &[3, 2, 4],
        )?))]));
        let sent = Arc::new(Mutex::new(Vec::new()));
        let session = session(asset("old", &[1, 2, 3])?, 1, source, sent.clone()).await?;
        session.refresh().await?;
        session.on_packet(&select_next()).await?;
        assert_eq!(selected_indices(&sent).await?, (1, 2, vec![3, 2, 4]));
        Ok(())
    }

    #[tokio::test]
    async fn latest_poll_wins_and_reversion_clears_stale_pending() -> Result<()> {
        let source = Arc::new(TestSource::new(vec![
            Ok(SubmissionPlaylist::Ready(asset("second", &[4, 5])?)),
            Ok(SubmissionPlaylist::Ready(asset("third", &[6, 7])?)),
        ]));
        let sent = Arc::new(Mutex::new(Vec::new()));
        let latest = session(asset("first", &[1, 2])?, 0, source, sent.clone()).await?;
        latest.refresh().await?;
        latest.refresh().await?;
        latest.on_packet(&select_next()).await?;
        assert_eq!(selected_indices(&sent).await?, (0, 0, vec![6, 7]));

        let source = Arc::new(TestSource::new(vec![
            Ok(SubmissionPlaylist::Ready(asset("second", &[4, 5])?)),
            Ok(SubmissionPlaylist::Ready(asset("first", &[1, 2])?)),
        ]));
        let sent = Arc::new(Mutex::new(Vec::new()));
        let session = session(asset("first", &[1, 2])?, 0, source, sent.clone()).await?;
        session.refresh().await?;
        session.refresh().await?;
        session.on_packet(&select_next()).await?;
        assert_eq!(selected_indices(&sent).await?, (0, 1, vec![1, 2]));
        Ok(())
    }

    #[tokio::test]
    async fn missing_published_playlist_clears_pending_update() -> Result<()> {
        let source = Arc::new(TestSource::new(vec![
            Ok(SubmissionPlaylist::Ready(asset("new", &[4, 5])?)),
            Ok(SubmissionPlaylist::Missing),
        ]));
        let sent = Arc::new(Mutex::new(Vec::new()));
        let session = session(asset("old", &[1, 2])?, 0, source, sent.clone()).await?;
        session.refresh().await?;
        session.refresh().await?;
        session.on_packet(&select_next()).await?;
        assert_eq!(selected_indices(&sent).await?, (0, 1, vec![1, 2]));
        Ok(())
    }

    #[tokio::test]
    async fn transient_poll_failure_keeps_current_playlist_and_empty_playlist_exits() -> Result<()>
    {
        let source = Arc::new(TestSource::new(vec![
            Err(anyhow::anyhow!("database unavailable")),
            Ok(SubmissionPlaylist::Missing),
            Ok(SubmissionPlaylist::Empty),
        ]));
        let sent = Arc::new(Mutex::new(Vec::new()));
        let session = session(asset("first", &[1, 2])?, 0, source, sent.clone()).await?;
        session.refresh().await?;
        session.refresh().await?;
        session.on_packet(&select_next()).await?;
        assert_eq!(selected_indices(&sent).await?, (0, 1, vec![1, 2]));
        assert!(session.refresh().await.is_err());
        session.stop().await;
        session.on_packet(&select_next()).await?;
        assert_eq!(sent.lock().await.len(), 1);
        Ok(())
    }

    #[tokio::test]
    async fn reconnect_prepares_last_ready_level_from_current_playlist() -> Result<()> {
        let active = asset("published", &[1, 2])?;
        let source = Arc::new(TestSource::new(vec![
            Ok(SubmissionPlaylist::Ready(active.clone())),
            Ok(SubmissionPlaylist::Ready(active.clone())),
        ]));
        let profile = ZslSubmissionsProfile {
            config: config()?,
            assets: source,
            current: Arc::new(RwLock::new(None)),
            stopped: AtomicBool::new(false),
        };
        assert_eq!(profile.prepare().await?.unwrap().level.workshop_id, 1);
        let sender = Arc::new(FnPacketSender(|_| async { Ok(()) }));
        let session = profile
            .create_session(RoomContext::for_test(sender, 1)?)
            .await?;
        let second = active.load("uid-2", 2).await?.unwrap();
        session
            .on_transfer(&TransferEvent {
                kind: TransferEventKind::Ready,
                level: second,
            })
            .await?;
        assert_eq!(profile.prepare().await?.unwrap().level.workshop_id, 2);
        Ok(())
    }
}
