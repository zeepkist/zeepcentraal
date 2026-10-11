use crate::{
    assets::{PreparedLevel, PreparedPlaylist},
    chat::PacketSender,
};
use anyhow::{Context, Result, bail, ensure};
use std::{collections::VecDeque, sync::Arc, time::Duration};
use tokio::sync::oneshot;
use zc_core::zeepnet::{
    GameHostPacket, change_lobby_levels_packet, change_lobby_playlist_packet, level_data_packet,
    skip_to_level_packet,
};

const REQUEST_CAPACITY: usize = 8;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TransferEventKind {
    Switch,
    Request,
    Uploaded,
    Ready,
    Repeat,
}

pub struct TransferEvent {
    pub kind: TransferEventKind,
    pub level: PreparedLevel,
}

struct Activation {
    id: u64,
    level: PreparedLevel,
    ready: oneshot::Sender<Result<()>>,
    properties_confirmed: bool,
    playing_confirmed: bool,
    started: tokio::time::Instant,
    previous_loaded_at: Option<f64>,
}

pub(crate) struct ActivationAttempt {
    pub id: u64,
    pub ready: oneshot::Receiver<Result<()>>,
    pub packets: [Vec<u8>; 2],
}

#[derive(Debug)]
pub(crate) struct ActivationTimeout;

impl std::fmt::Display for ActivationTimeout {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("Lobby level activation timed out")
    }
}

impl std::error::Error for ActivationTimeout {}

fn same_level(left: &PreparedLevel, right: &PreparedLevel) -> bool {
    left.content_sha256 == right.content_sha256
        && left.level.uid == right.level.uid
        && left.level.workshop_id == right.level.workshop_id
}

pub struct LevelTransfer {
    pub active: Option<PreparedLevel>,
    pub pending: Option<PreparedLevel>,
    previous: Option<PreparedLevel>,
    playlist: Option<PreparedPlaylist>,
    requests: VecDeque<(String, u64, String)>,
    activation: Option<Activation>,
    next_activation_id: u64,
    timing: Option<(String, u64, f64)>,
    game_state: Option<i32>,
    sender: Arc<dyn PacketSender>,
    round_time: f64,
    timeout: Duration,
    closed: bool,
}

impl LevelTransfer {
    pub fn new(sender: Arc<dyn PacketSender>, round_time: f64, timeout: Duration) -> Result<Self> {
        ensure!(
            round_time.is_finite() && round_time > 0.0,
            "Invalid round time"
        );
        Ok(Self {
            active: None,
            pending: None,
            previous: None,
            playlist: None,
            requests: VecDeque::new(),
            activation: None,
            next_activation_id: 0,
            timing: None,
            game_state: None,
            sender,
            round_time,
            timeout,
            closed: false,
        })
    }

    pub fn timeout(&self) -> Duration {
        self.timeout
    }
    pub fn set_round_time(&mut self, seconds: f64) -> Result<()> {
        ensure!(seconds.is_finite() && seconds > 0.0, "Invalid round time");
        self.round_time = seconds;
        Ok(())
    }

    pub async fn update_playlist(
        &mut self,
        playlist: PreparedPlaylist,
        current: i32,
        next: i32,
    ) -> Result<()> {
        ensure!(!self.closed, "GameServer connection closed");
        self.sender
            .send(change_lobby_levels_packet(
                &playlist.levels,
                self.round_time,
                current,
                next,
            )?)
            .await?;
        self.playlist = Some(playlist);
        Ok(())
    }

    pub(crate) fn prepare_activation(
        &mut self,
        level: PreparedLevel,
        playlist: Option<PreparedPlaylist>,
    ) -> Result<ActivationAttempt> {
        ensure!(!self.closed, "GameServer connection closed");
        if let Some(activation) = &self.activation
            && activation.ready.is_closed()
        {
            self.cancel_activation(activation.id);
        }
        ensure!(
            self.activation.is_none(),
            "Lobby activation already pending"
        );
        let packet = match &playlist {
            Some(playlist) => {
                let current = playlist
                    .levels
                    .iter()
                    .position(|candidate| {
                        candidate.uid == level.level.uid
                            && candidate.workshop_id == level.level.workshop_id
                    })
                    .context("Activation level absent from playlist")?;
                change_lobby_levels_packet(
                    &playlist.levels,
                    self.round_time,
                    i32::try_from(current)?,
                    i32::try_from((current + 1) % playlist.levels.len())?,
                )?
            }
            None => change_lobby_playlist_packet(&level.level, self.round_time)?,
        };
        let skip = skip_to_level_packet(&level.level)?;
        self.next_activation_id = self
            .next_activation_id
            .checked_add(1)
            .context("Lobby activation generation exhausted")?;
        let id = self.next_activation_id;
        let previous_loaded_at = self
            .timing
            .as_ref()
            .filter(|(uid, workshop_id, _)| {
                *uid == level.level.uid && *workshop_id == level.level.workshop_id
            })
            .map(|(_, _, loaded_at)| *loaded_at);
        self.pending = Some(level.clone());
        self.playlist = playlist;
        let (tx, rx) = oneshot::channel();
        tracing::info!(activation = id, uid = %level.level.uid, workshop_id = level.level.workshop_id, "Lobby activation started");
        self.activation = Some(Activation {
            id,
            level,
            ready: tx,
            properties_confirmed: false,
            playing_confirmed: false,
            started: tokio::time::Instant::now(),
            previous_loaded_at,
        });
        Ok(ActivationAttempt {
            id,
            ready: rx,
            packets: [packet, skip],
        })
    }

    #[cfg(test)]
    pub async fn begin_activation(
        &mut self,
        level: PreparedLevel,
        playlist: Option<PreparedPlaylist>,
    ) -> Result<oneshot::Receiver<Result<()>>> {
        let attempt = self.prepare_activation(level, playlist)?;
        for packet in attempt.packets {
            if let Err(error) = self.sender.send(packet).await {
                self.cancel_activation(attempt.id);
                return Err(error);
            }
        }
        Ok(attempt.ready)
    }

    pub(crate) fn cancel_activation(&mut self, id: u64) {
        if self
            .activation
            .as_ref()
            .is_some_and(|activation| activation.id == id)
        {
            let activation = self.activation.take().expect("matching activation");
            tracing::warn!(activation = id, uid = %activation.level.level.uid, elapsed_ms = activation.started.elapsed().as_millis() as u64, "Lobby activation cancelled");
            self.pending = None;
        }
    }

    /// Server broadcasts, not transport ACKs, confirm that clients can leave podium.
    pub async fn observe(&mut self, packet: &GameHostPacket) -> Result<Vec<TransferEvent>> {
        ensure!(!self.closed, "GameServer connection closed");
        if let Some(activation) = &self.activation
            && activation.ready.is_closed()
        {
            self.cancel_activation(activation.id);
        }
        match packet {
            GameHostPacket::Initial { timing, .. } => {
                self.timing = Some((
                    timing.uid.clone(),
                    timing.workshop_id,
                    timing.level_loaded_at,
                ));
                self.game_state = Some(timing.game_state);
            }
            GameHostPacket::GameProperties {
                uid,
                workshop_id,
                level_loaded_at,
                round_time,
            } if level_loaded_at.is_finite() && round_time.is_finite() && *round_time > 0.0 => {
                self.timing = Some((uid.clone(), *workshop_id, *level_loaded_at));
                if let Some(activation) = &mut self.activation {
                    activation.properties_confirmed = uid == &activation.level.level.uid
                        && *workshop_id == activation.level.level.workshop_id
                        && activation
                            .previous_loaded_at
                            .is_none_or(|previous| *level_loaded_at > previous);
                } else if self.pending.is_none()
                    && self.active.as_ref().is_none_or(|active| {
                        active.level.uid != *uid || active.level.workshop_id != *workshop_id
                    })
                    && let Some(playlist) = &self.playlist
                {
                    self.pending = playlist.load(uid, *workshop_id).await?;
                }
            }
            GameHostPacket::GameState(state) => {
                self.game_state = Some(*state);
                if let Some(activation) = &mut self.activation {
                    activation.playing_confirmed = *state == 0;
                }
            }
            _ => {}
        }
        Ok(self.confirm_pending())
    }

    fn confirm_pending(&mut self) -> Vec<TransferEvent> {
        let confirmed = match &self.activation {
            Some(activation) => activation.properties_confirmed && activation.playing_confirmed,
            None => {
                self.game_state == Some(0)
                    && self.pending.as_ref().is_some_and(|pending| {
                        self.timing.as_ref().is_some_and(|(uid, workshop_id, _)| {
                            *uid == pending.level.uid && *workshop_id == pending.level.workshop_id
                        })
                    })
            }
        };
        if !confirmed {
            return Vec::new();
        }
        let Some(level) = self.pending.take() else {
            return Vec::new();
        };
        self.previous = self.active.replace(level.clone());
        if let Some(activation) = self.activation.take() {
            tracing::info!(activation = activation.id, uid = %level.level.uid, elapsed_ms = activation.started.elapsed().as_millis() as u64, "Lobby activation confirmed playing");
            let _ = activation.ready.send(Ok(()));
        }
        vec![TransferEvent {
            kind: TransferEventKind::Ready,
            level,
        }]
    }

    pub fn request(&mut self, packet: &GameHostPacket) -> Result<()> {
        let GameHostPacket::LevelRequest {
            name,
            uid,
            workshop_id,
        } = packet
        else {
            return Ok(());
        };
        ensure!(!self.closed, "GameServer connection closed");
        ensure!(
            self.requests.len() < REQUEST_CAPACITY,
            "Level request queue exceeded capacity"
        );
        self.requests
            .push_back((uid.clone(), *workshop_id, name.clone()));
        Ok(())
    }

    pub async fn process_next(&mut self) -> Result<Option<Vec<TransferEvent>>> {
        let Some((uid, workshop_id, name)) = self.requests.pop_front() else {
            return Ok(None);
        };
        ensure!(!self.closed, "GameServer connection closed");
        let mut level = if let Some(playlist) = &self.playlist {
            playlist.load(&uid, workshop_id).await?
        } else {
            None
        };
        let from_playlist = level.is_some();
        if level.is_none() {
            level = [&self.pending, &self.active, &self.previous]
                .into_iter()
                .flatten()
                .find(|candidate| {
                    candidate.level.uid == uid && candidate.level.workshop_id == workshop_id
                })
                .cloned();
        }
        let Some(level) = level else {
            bail!("GameServer requested unknown level");
        };
        if from_playlist
            && self.activation.is_none()
            && self
                .active
                .as_ref()
                .is_none_or(|active| !same_level(active, &level))
        {
            self.pending = Some(level.clone());
        }
        let mut events = vec![TransferEvent {
            kind: TransferEventKind::Request,
            level: level.clone(),
        }];
        tracing::info!(uid = %uid, workshop_id, activation = self.activation.as_ref().map(|activation| activation.id), "Lobby level requested");
        self.sender
            .send(level_data_packet(
                &name,
                &uid,
                workshop_id,
                &level.compressed_data,
            )?)
            .await?;
        events.push(TransferEvent {
            kind: TransferEventKind::Uploaded,
            level: level.clone(),
        });
        tracing::info!(uid = %uid, workshop_id, activation = self.activation.as_ref().map(|activation| activation.id), "Lobby level uploaded; awaiting server confirmation");
        if self
            .active
            .as_ref()
            .is_some_and(|active| same_level(active, &level))
            && self
                .pending
                .as_ref()
                .is_none_or(|pending| !same_level(pending, &level))
        {
            events.push(TransferEvent {
                kind: TransferEventKind::Repeat,
                level,
            });
            return Ok(Some(events));
        }
        events.extend(self.confirm_pending());
        Ok(Some(events))
    }

    pub fn close(&mut self) {
        self.closed = true;
        self.requests.clear();
        if let Some(activation) = self.activation.take() {
            let _ = activation
                .ready
                .send(Err(anyhow::anyhow!("GameServer connection closed")));
        }
        self.pending = None;
        self.previous = None;
        self.active = None;
        self.playlist = None;
        self.timing = None;
        self.game_state = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{assets::LevelLoader, chat::FnPacketSender};
    use std::sync::Arc;
    use tokio::sync::Mutex;
    use zc_core::zeepnet::OnlineLevel;

    fn level() -> PreparedLevel {
        PreparedLevel {
            compressed_data: Arc::from([1_u8, 2, 3]),
            content_sha256: Arc::from("abc"),
            level: OnlineLevel {
                author: "author".into(),
                collaborators: String::new(),
                name: "level".into(),
                override_author_name: String::new(),
                uid: "uid".into(),
                workshop_id: 42,
            },
        }
    }

    struct FixedLoader(Option<PreparedLevel>);

    #[async_trait::async_trait]
    impl LevelLoader for FixedLoader {
        async fn load(&self, uid: &str, workshop_id: u64) -> Result<Option<PreparedLevel>> {
            Ok(self
                .0
                .as_ref()
                .filter(|level| level.level.uid == uid && level.level.workshop_id == workshop_id)
                .cloned())
        }
    }

    #[tokio::test]
    async fn activation_waits_for_server_properties_and_playing_after_upload() -> Result<()> {
        let sent = Arc::new(Mutex::new(Vec::new()));
        let sink = sent.clone();
        let sender = Arc::new(FnPacketSender(move |packet| {
            let sink = sink.clone();
            async move {
                sink.lock().await.push(packet);
                Ok(())
            }
        }));
        let mut transfer = LevelTransfer::new(sender, 300.0, Duration::from_secs(1))?;
        let mut ready = transfer.begin_activation(level(), None).await?;
        transfer.request(&GameHostPacket::LevelRequest {
            name: "level".into(),
            uid: "uid".into(),
            workshop_id: 42,
        })?;
        let events = transfer.process_next().await?.unwrap();
        assert_eq!(events.last().unwrap().kind, TransferEventKind::Uploaded);
        assert!(matches!(
            ready.try_recv(),
            Err(oneshot::error::TryRecvError::Empty)
        ));
        assert!(
            transfer
                .observe(&properties(&level(), 1000.0))
                .await?
                .is_empty()
        );
        assert!(matches!(
            ready.try_recv(),
            Err(oneshot::error::TryRecvError::Empty)
        ));
        let events = transfer.observe(&GameHostPacket::GameState(0)).await?;
        assert_eq!(events[0].kind, TransferEventKind::Ready);
        ready.await??;
        assert_eq!(sent.lock().await.len(), 3);
        Ok(())
    }

    #[tokio::test]
    async fn activation_restores_current_playlist_index() -> Result<()> {
        let sent = Arc::new(Mutex::new(Vec::new()));
        let sink = sent.clone();
        let sender = Arc::new(FnPacketSender(move |packet| {
            let sink = sink.clone();
            async move {
                sink.lock().await.push(packet);
                Ok(())
            }
        }));
        let first = level();
        let mut second = level();
        second.level.uid = "second".into();
        second.level.workshop_id = 43;
        second.content_sha256 = "second-hash".into();
        let playlist = PreparedPlaylist::new(
            vec![first.level, second.level.clone()],
            Arc::new(FixedLoader(None)),
        )?;
        let mut transfer = LevelTransfer::new(sender, 300.0, Duration::from_secs(1))?;
        let _ready = transfer.begin_activation(second, Some(playlist)).await?;
        let packets = sent.lock().await;
        let GameHostPacket::Playlist(playlist) =
            zc_core::zeepnet::parse_game_host_packet(&packets[0])?
        else {
            panic!("expected playlist packet");
        };
        assert_eq!((playlist.current_index, playlist.next_index), (1, 0));
        Ok(())
    }

    #[tokio::test]
    async fn playlist_level_request_promotes_new_active_level() -> Result<()> {
        let sender = Arc::new(FnPacketSender(|_| async { Ok(()) }));
        let first = level();
        let mut second = level();
        second.level.uid = "second".into();
        second.level.workshop_id = 43;
        let playlist = PreparedPlaylist::new(
            vec![first.level.clone(), second.level.clone()],
            Arc::new(FixedLoader(Some(second.clone()))),
        )?;
        let mut transfer = LevelTransfer::new(sender, 300.0, Duration::from_secs(1))?;
        transfer.active = Some(first);
        transfer.update_playlist(playlist, 0, 1).await?;
        transfer.request(&GameHostPacket::LevelRequest {
            name: "second".into(),
            uid: "second".into(),
            workshop_id: 43,
        })?;
        let events = transfer.process_next().await?.unwrap();
        assert_eq!(events.last().unwrap().kind, TransferEventKind::Uploaded);
        transfer.observe(&properties(&second, 1000.0)).await?;
        let events = transfer.observe(&GameHostPacket::GameState(0)).await?;
        assert_eq!(events.last().unwrap().kind, TransferEventKind::Ready);
        assert_eq!(transfer.active.as_ref().unwrap().level.workshop_id, 43);
        Ok(())
    }

    #[test]
    fn request_queue_is_bounded() -> Result<()> {
        let sender = Arc::new(FnPacketSender(|_| async { Ok(()) }));
        let mut transfer = LevelTransfer::new(sender, 300.0, Duration::from_secs(1))?;
        let request = GameHostPacket::LevelRequest {
            name: "level".into(),
            uid: "uid".into(),
            workshop_id: 42,
        };
        for _ in 0..REQUEST_CAPACITY {
            transfer.request(&request)?;
        }
        assert!(transfer.request(&request).is_err());
        Ok(())
    }

    fn properties(level: &PreparedLevel, loaded_at: f64) -> GameHostPacket {
        GameHostPacket::GameProperties {
            uid: level.level.uid.clone(),
            workshop_id: level.level.workshop_id,
            level_loaded_at: loaded_at,
            round_time: 300.0,
        }
    }

    #[tokio::test]
    async fn cached_level_can_complete_without_upload_in_either_confirmation_order() -> Result<()> {
        for playing_first in [false, true] {
            let sender = Arc::new(FnPacketSender(|_| async { Ok(()) }));
            let mut transfer = LevelTransfer::new(sender, 300.0, Duration::from_secs(1))?;
            let ready = transfer.begin_activation(level(), None).await?;
            let packets = if playing_first {
                [GameHostPacket::GameState(0), properties(&level(), 10.0)]
            } else {
                [properties(&level(), 10.0), GameHostPacket::GameState(0)]
            };
            assert!(transfer.observe(&packets[0]).await?.is_empty());
            assert_eq!(
                transfer.observe(&packets[1]).await?[0].kind,
                TransferEventKind::Ready
            );
            ready.await??;
        }
        Ok(())
    }

    #[tokio::test]
    async fn same_level_reload_sends_packets_and_requires_new_loaded_timestamp() -> Result<()> {
        let sent = Arc::new(Mutex::new(Vec::new()));
        let sink = sent.clone();
        let sender = Arc::new(FnPacketSender(move |packet| {
            let sink = sink.clone();
            async move {
                sink.lock().await.push(packet);
                Ok(())
            }
        }));
        let mut transfer = LevelTransfer::new(sender, 300.0, Duration::from_secs(1))?;
        transfer.active = Some(level());
        transfer.observe(&properties(&level(), 10.0)).await?;
        transfer.observe(&GameHostPacket::GameState(2)).await?;
        let mut ready = transfer.begin_activation(level(), None).await?;
        assert_eq!(sent.lock().await.len(), 2);
        transfer.observe(&properties(&level(), 10.0)).await?;
        transfer.observe(&GameHostPacket::GameState(0)).await?;
        assert!(matches!(
            ready.try_recv(),
            Err(oneshot::error::TryRecvError::Empty)
        ));
        transfer.observe(&properties(&level(), 11.0)).await?;
        ready.await??;
        Ok(())
    }

    #[tokio::test]
    async fn stale_request_confirmation_and_cleanup_cannot_replace_new_attempt() -> Result<()> {
        let sender = Arc::new(FnPacketSender(|_| async { Ok(()) }));
        let mut transfer = LevelTransfer::new(sender, 300.0, Duration::from_secs(1))?;
        let first = transfer.prepare_activation(level(), None)?;
        transfer.cancel_activation(first.id);
        let mut next = level();
        next.level.uid = "next".into();
        let playlist = PreparedPlaylist::new(
            vec![level().level, next.level.clone()],
            Arc::new(FixedLoader(Some(level()))),
        )?;
        let mut second = transfer.prepare_activation(next.clone(), Some(playlist))?;
        transfer.cancel_activation(first.id);
        transfer.request(&GameHostPacket::LevelRequest {
            name: "old".into(),
            uid: "uid".into(),
            workshop_id: 42,
        })?;
        transfer.process_next().await?;
        assert_eq!(transfer.pending.as_ref().unwrap().level.uid, "next");
        transfer.observe(&properties(&level(), 10.0)).await?;
        transfer.observe(&GameHostPacket::GameState(0)).await?;
        assert!(matches!(
            second.ready.try_recv(),
            Err(oneshot::error::TryRecvError::Empty)
        ));
        transfer.observe(&properties(&next, 11.0)).await?;
        second.ready.await??;
        Ok(())
    }

    #[tokio::test]
    async fn invalid_or_dropped_attempt_does_not_poison_next_activation() -> Result<()> {
        let sender = Arc::new(FnPacketSender(|_| async { Ok(()) }));
        let mut transfer = LevelTransfer::new(sender, 300.0, Duration::from_secs(1))?;
        let mut other = level();
        other.level.uid = "other".into();
        let playlist = PreparedPlaylist::new(vec![other.level], Arc::new(FixedLoader(None)))?;
        assert!(
            transfer
                .prepare_activation(level(), Some(playlist))
                .is_err()
        );
        assert!(transfer.pending.is_none());
        let first = transfer.prepare_activation(level(), None)?;
        drop(first);
        let second = transfer.prepare_activation(level(), None)?;
        transfer.cancel_activation(second.id);
        assert!(transfer.pending.is_none());
        Ok(())
    }
}
