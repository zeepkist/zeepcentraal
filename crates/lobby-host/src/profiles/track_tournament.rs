use super::{
    TournamentAsset, TournamentAssets,
    messages::{escape_text, format_time, tournament_message},
};
use crate::{
    config::{ManagedRoomConfig, TournamentType},
    leaderboard::{DesiredPlayerStanding, PlayerLeaderboard},
    runtime::{LobbyProfile, ProfileSession, RoomContext},
    transfer::{TransferEvent, TransferEventKind},
};
use anyhow::{Context, Result};
use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};
use tokio::sync::{Mutex, Notify};
use zc_core::{
    object_storage::ObjectStorage,
    zeepnet::{GameHostPacket, LeaderboardOverrides},
};
use zc_database::{
    Database,
    services::lobby_assets::{TournamentLobbySnapshot, TournamentLobbyStanding},
};

pub struct TrackTournamentProfile {
    config: ManagedRoomConfig,
    tournament_type: TournamentType,
    assets: Arc<TournamentAssets>,
    database: Database,
    stopped: AtomicBool,
}

impl TrackTournamentProfile {
    pub fn new(
        config: ManagedRoomConfig,
        database: Database,
        storage: Arc<dyn ObjectStorage>,
        tournament_type: TournamentType,
    ) -> Result<Self> {
        let kind = match tournament_type {
            TournamentType::Weekly => 0,
            TournamentType::Monthly => 1,
        };
        Ok(Self {
            config,
            tournament_type,
            assets: Arc::new(TournamentAssets::new(database.clone(), storage, kind)?),
            database,
            stopped: AtomicBool::new(false),
        })
    }
}

#[async_trait::async_trait]
impl LobbyProfile for TrackTournamentProfile {
    fn name(&self) -> &str {
        match self.tournament_type {
            TournamentType::Weekly => "track-tournament.weekly",
            TournamentType::Monthly => "track-tournament.monthly",
        }
    }

    async fn prepare(&self) -> Result<Option<crate::assets::PreparedLevel>> {
        Ok(self.assets.refresh().await?.map(|asset| asset.level))
    }

    async fn create_session(&self, context: RoomContext) -> Result<Arc<dyn ProfileSession>> {
        let asset = self
            .assets
            .current()
            .await
            .context("Tournament asset became unavailable")?;
        Ok(Arc::new(TrackTournamentSession {
            config: self.config.clone(),
            tournament_type: self.tournament_type,
            assets: self.assets.clone(),
            database: self.database.clone(),
            context: context.clone(),
            state: Mutex::new(SessionState {
                asset,
                board: context.leaderboard(),
                snapshot: None,
                game_state: None,
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
    asset: TournamentAsset,
    board: PlayerLeaderboard,
    snapshot: Option<TournamentLobbySnapshot>,
    game_state: Option<i32>,
}

struct TrackTournamentSession {
    config: ManagedRoomConfig,
    tournament_type: TournamentType,
    assets: Arc<TournamentAssets>,
    database: Database,
    context: RoomContext,
    state: Mutex<SessionState>,
    stopped: AtomicBool,
    wake: Notify,
}

impl TrackTournamentSession {
    async fn refresh_leaderboard(&self) -> Result<()> {
        let (tournament_id, steam_ids) = {
            let state = self.state.lock().await;
            (state.asset.id_tournament, state.board.roster_steam_ids())
        };
        let snapshot = self
            .database
            .tournament_lobby_snapshot(tournament_id, &steam_ids)
            .await?;
        let packets = {
            let mut state = self.state.lock().await;
            if state.asset.id_tournament != tournament_id {
                return Ok(());
            }
            state.board.set_desired(
                snapshot
                    .connected_players
                    .iter()
                    .map(desired_standing)
                    .collect(),
            );
            state.snapshot = Some(snapshot);
            state.board.reconcile()?
        };
        for packet in packets {
            self.context.send(packet).await?;
        }
        Ok(())
    }

    async fn send_message(&self) -> Result<()> {
        let message = {
            let state = self.state.lock().await;
            tournament_message(
                self.tournament_type,
                &state.asset.tournament_slug,
                &state.asset.tournament_end_at,
                state.snapshot.as_ref(),
                self.config.round_time_seconds,
            )
        };
        self.context.chat().command(&message).await
    }

    async fn refresh_asset(&self) -> Result<()> {
        let Some(next) = self.assets.refresh().await? else {
            return Ok(());
        };
        let changed = {
            let state = self.state.lock().await;
            state.asset.level.content_sha256 != next.level.content_sha256
        };
        if changed {
            self.context.activate(next.level.clone(), None).await?;
            let mut state = self.state.lock().await;
            state.asset = next;
            let tournament_id = state.asset.id_tournament.to_string();
            let level_uid = state.asset.level.level.uid.clone();
            state.board.set_scope(tournament_id, level_uid);
            state.snapshot = None;
        }
        Ok(())
    }
}

#[async_trait::async_trait]
impl ProfileSession for TrackTournamentSession {
    async fn start(&self) -> Result<()> {
        let first = self.state.lock().await.asset.clone();
        self.context.activate(first.level.clone(), None).await?;
        self.context.chat().command("/joinmessage off").await?;
        {
            let mut state = self.state.lock().await;
            state.board.set_scope(
                first.id_tournament.to_string(),
                first.level.level.uid.clone(),
            );
            state.board.set_ready(true);
        }
        self.refresh_leaderboard().await?;
        self.send_message().await?;
        let mut asset =
            tokio::time::interval(std::time::Duration::from_millis(self.config.asset_poll_ms));
        let mut leaderboard = tokio::time::interval(std::time::Duration::from_secs(2));
        let mut message = tokio::time::interval(std::time::Duration::from_millis(
            self.config.message_refresh_ms,
        ));
        asset.tick().await;
        leaderboard.tick().await;
        message.tick().await;
        loop {
            tokio::select! {
                _ = self.wake.notified() => return Ok(()),
                _ = asset.tick() => self.refresh_asset().await?,
                _ = leaderboard.tick() => self.refresh_leaderboard().await?,
                _ = message.tick() => self.send_message().await?,
            }
        }
    }

    async fn on_packet(&self, packet: &GameHostPacket) -> Result<()> {
        let packets;
        let mut welcome = None;
        {
            let mut state = self.state.lock().await;
            state.board.observe(packet);
            if let GameHostPacket::GameState(value) = packet {
                let started = *value == 0 && state.game_state != Some(0);
                state.game_state = Some(*value);
                if started {
                    state.board.set_ready(true);
                }
            }
            if let GameHostPacket::PlayerConnected { player, .. } = packet {
                let event = match self.tournament_type {
                    TournamentType::Weekly => "Track of the Week",
                    TournamentType::Monthly => "Track of the Month",
                };
                let name = escape_text(player.username.as_deref().unwrap_or(&player.backup_name));
                welcome = Some((
                    player.steam_id,
                    format!("Welcome to {event}, {name}\nView leaderboard on zeepki.st!"),
                ));
            }
            packets = state.board.reconcile()?;
        }
        for packet in packets {
            self.context.send(packet).await?;
        }
        if let Some((steam_id, message)) = welcome {
            self.context
                .chat()
                .target(steam_id, &message, "HOST")
                .await?;
        }
        Ok(())
    }

    async fn on_transfer(&self, event: &TransferEvent) -> Result<()> {
        let current = if event.kind == TransferEventKind::Ready {
            self.assets.current().await
        } else {
            None
        };
        let mut state = self.state.lock().await;
        if event.kind == TransferEventKind::Switch {
            state.board.set_ready(false);
        }
        if event.kind == TransferEventKind::Ready {
            if let Some(asset) = current
                && asset.level.content_sha256 == event.level.content_sha256
            {
                state.asset = asset;
            }
            let tournament_id = state.asset.id_tournament.to_string();
            let level_uid = state.asset.level.level.uid.clone();
            state.board.set_scope(tournament_id, level_uid);
            state.board.set_ready(true);
        }
        Ok(())
    }

    async fn stop(&self) {
        if !self.stopped.swap(true, Ordering::AcqRel) {
            self.wake.notify_waiters();
        }
    }
}

fn desired_standing(row: &TournamentLobbyStanding) -> DesiredPlayerStanding {
    DesiredPlayerStanding {
        steam_id: u64::try_from(row.steam_id).unwrap_or_default(),
        time: Some(row.time),
        overrides: LeaderboardOverrides {
            time: format_time(row.time),
            position: row.rank.to_string(),
            name: format!(
                "<nobr>{}</nobr>",
                escape_text(row.steam_name.as_deref().unwrap_or("Unknown player"))
            ),
            points: format!("{} pts", row.points),
            points_won: " ".into(),
        },
    }
}
