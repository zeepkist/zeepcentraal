use super::{SubmissionAsset, SubmissionAssets, messages::submission_message};
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
    assets: Arc<SubmissionAssets>,
    current: RwLock<Option<SubmissionAsset>>,
    stopped: AtomicBool,
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
            current: RwLock::new(None),
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
        let next = self.assets.refresh().await?;
        *self.current.write().await = next.clone();
        Ok(next.map(|asset| asset.first))
    }

    async fn create_session(&self, context: RoomContext) -> Result<Arc<dyn ProfileSession>> {
        let asset = self
            .current
            .read()
            .await
            .clone()
            .context("Submission playlist unavailable")?;
        Ok(Arc::new(ZslSubmissionsSession {
            config: self.config.clone(),
            assets: self.assets.clone(),
            context,
            state: Mutex::new(SessionState {
                active: asset,
                pending: None,
                current_index: 0,
            }),
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
    assets: Arc<SubmissionAssets>,
    context: RoomContext,
    state: Mutex<SessionState>,
    stopped: AtomicBool,
    wake: Notify,
}

impl ZslSubmissionsSession {
    async fn overlay(&self) -> Result<()> {
        let entries = self.state.lock().await.active.playlist.levels.len();
        self.context
            .chat()
            .command(&submission_message(entries, self.config.round_time_seconds))
            .await
    }

    async fn refresh(&self) -> Result<()> {
        let Some(next) = self.assets.refresh().await? else {
            bail!("Submission playlist became unavailable");
        };
        let mut state = self.state.lock().await;
        if next.digest != state.active.digest {
            state.pending = Some(next);
        }
        Ok(())
    }

    async fn select_next(&self) -> Result<()> {
        let (playlist, current, next) = {
            let mut state = self.state.lock().await;
            if let Some(pending) = state.pending.take() {
                let current_level = state.active.playlist.levels.get(state.current_index);
                let retained = current_level.and_then(|level| {
                    pending.playlist.levels.iter().position(|candidate| {
                        candidate.uid == level.uid && candidate.workshop_id == level.workshop_id
                    })
                });
                state.active = pending;
                state.current_index = retained.unwrap_or(0);
            }
            let len = state.active.playlist.levels.len();
            let current = state.current_index.min(len - 1);
            let next = (current + 1) % len;
            (state.active.playlist.clone(), current, next)
        };
        self.context
            .update_playlist(playlist, current as i32, next as i32)
            .await
    }
}

#[async_trait::async_trait]
impl ProfileSession for ZslSubmissionsSession {
    async fn start(&self) -> Result<()> {
        let asset = self.state.lock().await.active.clone();
        self.context
            .activate(asset.first, Some(asset.playlist))
            .await?;
        self.overlay().await?;
        let mut refresh = tokio::time::interval(std::time::Duration::from_secs(30));
        let mut message = tokio::time::interval(std::time::Duration::from_secs(60));
        refresh.tick().await;
        message.tick().await;
        loop {
            tokio::select! {
                _ = self.wake.notified() => return Ok(()),
                _ = refresh.tick() => self.refresh().await?,
                _ = message.tick() => self.overlay().await?,
            }
        }
    }

    async fn on_packet(&self, packet: &GameHostPacket) -> Result<()> {
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

    async fn on_transfer(&self, _event: &TransferEvent) -> Result<()> {
        Ok(())
    }

    async fn stop(&self) {
        if !self.stopped.swap(true, Ordering::AcqRel) {
            self.wake.notify_waiters();
        }
    }
}
