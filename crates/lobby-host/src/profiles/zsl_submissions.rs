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
use zc_core::{object_storage::ObjectStorage, zeepnet::GameHostPacket};
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
        Ok(Arc::new(ZslSubmissionsSession {
            config: self.config.clone(),
            assets: self.assets.clone(),
            current: self.current.clone(),
            context,
            state: Mutex::new(SessionState {
                active: current.asset,
                pending: None,
                current_index,
            }),
            initial_level: current.level,
            stopped: AtomicBool::new(false),
            wake: Notify::new(),
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

    async fn refresh(&self) -> Result<()> {
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
            if state
                .pending
                .as_ref()
                .is_none_or(|pending| pending.digest != next.digest)
            {
                tracing::info!(
                    room = %self.config.key,
                    entries = next.playlist.levels.len(),
                    "Submission playlist update staged"
                );
                state.pending = Some(next);
            }
        } else {
            state.pending = None;
        }
        Ok(())
    }

    async fn select_next(&self) -> Result<()> {
        let (playlist, current, next, changed) = {
            let mut state = self.state.lock().await;
            let mut removed_current = false;
            let mut changed = false;
            if let Some(pending) = state.pending.take() {
                let current_level = state.active.playlist.levels.get(state.current_index);
                let retained = current_level.and_then(|level| {
                    pending.playlist.levels.iter().position(|candidate| {
                        candidate.uid == level.uid && candidate.workshop_id == level.workshop_id
                    })
                });
                state.active = pending;
                state.current_index = retained.unwrap_or(0);
                removed_current = retained.is_none();
                changed = true;
            }
            let len = state.active.playlist.levels.len();
            let current = state.current_index.min(len - 1);
            let next = if removed_current {
                0
            } else {
                (current + 1) % len
            };
            (state.active.playlist.clone(), current, next, changed)
        };
        let entries = playlist.levels.len();
        self.context
            .update_playlist(playlist, current as i32, next as i32)
            .await?;
        if changed {
            tracing::info!(room = %self.config.key, entries, "Submission playlist update applied");
        }
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
            tokio::select! {
                _ = self.wake.notified() => return Ok(()),
                _ = refresh.tick() => self.refresh().await?,
                _ = message.tick() => {
                    if let Err(error) = self.overlay().await {
                        tracing::warn!(%error, "Submission showcase message failed");
                    }
                },
            }
        }
    }

    async fn on_packet(&self, packet: &GameHostPacket) -> Result<()> {
        if self.stopped.load(Ordering::Acquire) {
            return Ok(());
        }
        if let GameHostPacket::PlaylistIndex {
            current_index,
            select_next,
            ..
        } = packet
        {
            if *select_next {
                self.select_next().await?;
            } else if *current_index >= 0 {
                let mut state = self.state.lock().await;
                let index = *current_index as usize;
                if index < state.active.playlist.levels.len() {
                    state.current_index = index;
                }
            }
        }
        Ok(())
    }

    async fn on_transfer(&self, event: &TransferEvent) -> Result<()> {
        if self.stopped.load(Ordering::Acquire)
            || event.kind != crate::transfer::TransferEventKind::Ready
        {
            return Ok(());
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
            self.wake.notify_waiters();
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
    use std::collections::VecDeque;
    use zc_core::zeepnet::{OnlineLevel, parse_game_host_packet};

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
        let context = RoomContext::for_test(sender, 1)?;
        let level = &active.playlist.levels[current_index];
        let initial_level = active
            .load(&level.uid, level.workshop_id)
            .await?
            .context("Missing test level")?;
        Ok(ZslSubmissionsSession {
            config: config()?,
            assets: source,
            current: Arc::new(RwLock::new(None)),
            context,
            state: Mutex::new(SessionState {
                active,
                pending: None,
                current_index,
            }),
            initial_level,
            stopped: AtomicBool::new(false),
            wake: Notify::new(),
        })
    }

    async fn selected_indices(sent: &Mutex<Vec<Vec<u8>>>) -> Result<(i32, i32, Vec<u64>)> {
        let sent = sent.lock().await;
        let GameHostPacket::Playlist(playlist) =
            parse_game_host_packet(sent.last().context("No playlist packet")?)?
        else {
            panic!("expected playlist packet");
        };
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
