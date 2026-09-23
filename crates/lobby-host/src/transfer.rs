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
    level: PreparedLevel,
    ready: oneshot::Sender<Result<()>>,
}

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
            sender,
            round_time,
            timeout,
            closed: false,
        })
    }

    pub fn timeout(&self) -> Duration {
        self.timeout
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

    pub async fn begin_activation(
        &mut self,
        level: PreparedLevel,
        playlist: Option<PreparedPlaylist>,
    ) -> Result<oneshot::Receiver<Result<()>>> {
        ensure!(!self.closed, "GameServer connection closed");
        if self
            .active
            .as_ref()
            .is_some_and(|active| same_level(active, &level))
        {
            let (tx, rx) = oneshot::channel();
            let _ = tx.send(Ok(()));
            return Ok(rx);
        }
        ensure!(
            self.activation.is_none(),
            "Lobby activation already pending"
        );
        self.pending = Some(level.clone());
        self.playlist = playlist.clone();
        let packet = match playlist {
            Some(ref playlist) => {
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
        self.sender.send(packet).await?;
        self.sender
            .send(skip_to_level_packet(&level.level)?)
            .await?;
        let (tx, rx) = oneshot::channel();
        self.activation = Some(Activation { level, ready: tx });
        Ok(rx)
    }

    pub async fn activate(
        &mut self,
        level: PreparedLevel,
        playlist: Option<PreparedPlaylist>,
    ) -> Result<()> {
        let timeout = self.timeout;
        let ready = self.begin_activation(level, playlist).await?;
        tokio::time::timeout(timeout, ready)
            .await
            .context("Lobby level-data request timed out")??
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
        if self
            .pending
            .as_ref()
            .is_some_and(|pending| same_level(pending, &level))
        {
            self.previous = self.active.replace(level.clone());
            self.pending = None;
            events.push(TransferEvent {
                kind: TransferEventKind::Ready,
                level: level.clone(),
            });
            if self
                .activation
                .as_ref()
                .is_some_and(|activation| same_level(&activation.level, &level))
                && let Some(activation) = self.activation.take()
            {
                let _ = activation.ready.send(Ok(()));
            }
        }
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
    async fn activation_completes_after_matching_upload() -> Result<()> {
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
        let ready = transfer.begin_activation(level(), None).await?;
        transfer.request(&GameHostPacket::LevelRequest {
            name: "level".into(),
            uid: "uid".into(),
            workshop_id: 42,
        })?;
        let events = transfer.process_next().await?.unwrap();
        assert_eq!(events.last().unwrap().kind, TransferEventKind::Ready);
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
}
