use super::{
    TournamentAsset, TournamentAssets,
    messages::{
        HOSTNAME, format_time, join_message, leaderboard_name, standing_message, tournament_message,
    },
    notifications::StandingNotifications,
};
use crate::{
    config::{ManagedRoomConfig, TournamentType},
    leaderboard::{DesiredPlayerStanding, PlayerLeaderboard},
    runtime::{LobbyProfile, ProfileSession, RoomContext},
    transfer::{TransferEvent, TransferEventKind},
};
use anyhow::{Context, Result};
use std::{
    future::Future,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
};
use tokio::sync::{Mutex, Notify};
use zc_core::{
    object_storage::ObjectStorage,
    zeepnet::{GameHostPacket, GameHostPlayer, LeaderboardOverrides},
};
use zc_database::{
    Database,
    services::lobby_assets::{
        TournamentLobbyPlayerContext, TournamentLobbySnapshot, TournamentLobbyStanding,
    },
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
            state: Arc::new(Mutex::new(SessionState {
                asset,
                board: context.leaderboard(),
                snapshot: None,
                game_state: None,
                notifications: StandingNotifications::default(),
                ready: false,
            })),
            stopped: Arc::new(AtomicBool::new(false)),
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
    notifications: StandingNotifications,
    ready: bool,
}

struct TrackTournamentSession {
    config: ManagedRoomConfig,
    tournament_type: TournamentType,
    assets: Arc<TournamentAssets>,
    database: Database,
    context: RoomContext,
    state: Arc<Mutex<SessionState>>,
    stopped: Arc<AtomicBool>,
    wake: Notify,
}

impl TrackTournamentSession {
    async fn flush_notifications(&self) {
        let due = self
            .state
            .lock()
            .await
            .notifications
            .drain_due(tokio::time::Instant::now());
        if self.stopped.load(Ordering::Acquire) || !self.context.is_host() {
            return;
        }
        for (steam_id, previous, current) in due {
            if !self
                .context
                .players()
                .await
                .iter()
                .any(|player| player.steam_id == steam_id)
            {
                continue;
            }
            let message = standing_message(self.tournament_type, previous, current);
            if self
                .context
                .chat()
                .target(steam_id, &message, HOSTNAME)
                .await
                .is_err()
            {
                tracing::warn!("Targeted standing notification failed");
            }
        }
    }

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
            let players = state.board.roster_players();
            let ids = players
                .iter()
                .map(|player| player.steam_id)
                .collect::<Vec<_>>();
            state.notifications.update(
                &ids,
                &snapshot.connected_players,
                tokio::time::Instant::now(),
            );
            state
                .board
                .set_desired(desired_for_roster(&players, Some(&snapshot)));
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
            )?
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
            state.notifications.reset();
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
            state.notifications.set_ready(true);
            state.ready = true;
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
            let deadline = self
                .state
                .lock()
                .await
                .notifications
                .next_due()
                .unwrap_or_else(|| {
                    tokio::time::Instant::now() + std::time::Duration::from_secs(86_400)
                });
            tokio::select! {
                _ = self.wake.notified() => return Ok(()),
                _ = asset.tick() => self.refresh_asset().await?,
                _ = leaderboard.tick() => self.refresh_leaderboard().await?,
                _ = message.tick() => self.send_message().await?,
                _ = tokio::time::sleep_until(deadline) => self.flush_notifications().await,
            }
        }
    }

    async fn on_packet(&self, packet: &GameHostPacket) -> Result<()> {
        let packets;
        let mut welcome = None;
        {
            let mut state = self.state.lock().await;
            state.board.observe(packet);
            if matches!(
                packet,
                GameHostPacket::Initial { .. }
                    | GameHostPacket::PlayerConnected { .. }
                    | GameHostPacket::PlayerDisconnected(_)
            ) {
                let roster = state.board.roster_steam_ids();
                state.notifications.set_roster(&roster);
                let players = state.board.roster_players();
                let desired = desired_for_roster(&players, state.snapshot.as_ref());
                state.board.set_desired(desired);
            }
            if let GameHostPacket::GameState(value) = packet {
                let started = *value == 0 && state.game_state != Some(0);
                state.game_state = Some(*value);
                if started {
                    state.board.set_ready(true);
                }
            }
            if let GameHostPacket::PlayerConnected { player, .. } = packet {
                welcome = Some(player.clone());
            }
            packets = state.board.reconcile()?;
        }
        for packet in packets {
            self.context.send(packet).await?;
        }
        if let Some(player) = welcome {
            let database = self.database.clone();
            let context = self.context.clone();
            let state = self.state.clone();
            let stopped = self.stopped.clone();
            let kind = self.tournament_type;
            tokio::spawn(async move {
                send_tournament_welcome(
                    context,
                    state,
                    stopped,
                    kind,
                    player,
                    move |id, steam_id| {
                        let database = database.clone();
                        async move { database.tournament_lobby_player_context(id, steam_id).await }
                    },
                )
                .await;
            });
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
            state.notifications.set_ready(false);
            state.ready = false;
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
            state.notifications.set_ready(true);
            state.ready = true;
        }
        Ok(())
    }

    async fn stop(&self) {
        if !self.stopped.swap(true, Ordering::AcqRel) {
            self.state.lock().await.notifications.reset();
            self.wake.notify_waiters();
        }
    }
}

fn desired_standing(
    player: &GameHostPlayer,
    row: Option<&TournamentLobbyStanding>,
) -> DesiredPlayerStanding {
    let name = player
        .username
        .as_deref()
        .filter(|name| !name.is_empty())
        .unwrap_or(&player.backup_name);
    DesiredPlayerStanding {
        steam_id: player.steam_id,
        time: row.map(|row| row.time),
        overrides: LeaderboardOverrides {
            time: row.map(|row| format_time(row.time)).unwrap_or_default(),
            position: row
                .map(|row| row.rank.to_string())
                .unwrap_or_else(|| "—".into()),
            name: leaderboard_name(&format!("{}{name}", player.player_tag)),
            points: format!("{} pts", row.map(|row| row.points).unwrap_or_default()),
            points_won: " ".into(),
        },
    }
}

fn desired_for_roster(
    players: &[GameHostPlayer],
    snapshot: Option<&TournamentLobbySnapshot>,
) -> Vec<DesiredPlayerStanding> {
    players
        .iter()
        .map(|player| {
            let result = snapshot.and_then(|snapshot| {
                snapshot
                    .connected_players
                    .iter()
                    .find(|row| u64::try_from(row.steam_id).ok() == Some(player.steam_id))
            });
            desired_standing(player, result)
        })
        .collect()
}

async fn send_tournament_welcome<F, Fut>(
    context: RoomContext,
    state: Arc<Mutex<SessionState>>,
    stopped: Arc<AtomicBool>,
    kind: TournamentType,
    player: GameHostPlayer,
    lookup: F,
) where
    F: Fn(i32, u64) -> Fut,
    Fut: Future<Output = Result<TournamentLobbyPlayerContext>>,
{
    for attempt in 0..2 {
        let tournament_id = state.lock().await.asset.id_tournament;
        if !can_send_welcome(&context, &state, &stopped, &player).await {
            return;
        }
        let player_context = match tokio::time::timeout(
            std::time::Duration::from_secs(5),
            lookup(tournament_id, player.steam_id),
        )
        .await
        {
            Ok(Ok(context)) => context,
            _ => {
                tracing::warn!("Tournament player context lookup failed; using GTR fallback");
                TournamentLobbyPlayerContext {
                    minimum_gtr_version: None,
                    user_exists: false,
                    recent_record: false,
                    standing: None,
                }
            }
        };
        if !can_send_welcome(&context, &state, &stopped, &player).await {
            return;
        }
        if state.lock().await.asset.id_tournament != tournament_id {
            if attempt == 0 {
                continue;
            }
            return;
        }
        let name = player
            .username
            .as_deref()
            .map(str::trim)
            .filter(|name| !name.is_empty())
            .unwrap_or(&player.backup_name);
        let message = join_message(kind, name, &player_context);
        if context
            .chat()
            .target(player.steam_id, &message, HOSTNAME)
            .await
            .is_err()
        {
            tracing::warn!("Targeted join message failed");
        }
        return;
    }
}

async fn can_send_welcome(
    context: &RoomContext,
    state: &Mutex<SessionState>,
    stopped: &AtomicBool,
    player: &GameHostPlayer,
) -> bool {
    if stopped.load(Ordering::Acquire) || !context.is_host() || !state.lock().await.ready {
        return false;
    }
    context
        .players()
        .await
        .iter()
        .any(|current| current.uid == player.uid && current.steam_id == player.steam_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{assets::PreparedLevel, chat::FnPacketSender};
    use zc_core::zeepnet::{BitReader, CUSTOM_CHAT_MESSAGE, OnlineLevel};

    async fn welcome_fixture() -> Result<(
        RoomContext,
        Arc<Mutex<SessionState>>,
        Arc<AtomicBool>,
        GameHostPlayer,
        Arc<Mutex<Vec<Vec<u8>>>>,
    )> {
        let packets = Arc::new(Mutex::new(Vec::new()));
        let captured = packets.clone();
        let sender = Arc::new(FnPacketSender(move |packet| {
            let captured = captured.clone();
            async move {
                captured.lock().await.push(packet);
                Ok(())
            }
        }));
        let context = RoomContext::for_test(sender, 1)?;
        let player = GameHostPlayer {
            backup_name: "Player".into(),
            player_tag: "".into(),
            steam_id: 42,
            uid: 4,
            username: None,
        };
        context
            .observe_test_packet(&GameHostPacket::PlayerConnected {
                player: player.clone(),
                is_host: false,
                has_host_powers: false,
            })
            .await;
        let state = Arc::new(Mutex::new(SessionState {
            asset: TournamentAsset {
                level: PreparedLevel {
                    compressed_data: Arc::<[u8]>::from(Vec::new()),
                    content_sha256: Arc::<str>::from("fixture"),
                    level: OnlineLevel {
                        author: "".into(),
                        collaborators: "".into(),
                        name: "".into(),
                        override_author_name: "".into(),
                        uid: "level".into(),
                        workshop_id: 1,
                    },
                },
                id_tournament: 7,
                tournament_slug: "2026-w33".into(),
                tournament_end_at: "2026-09-01T00:00:00Z".into(),
            },
            board: context.leaderboard(),
            snapshot: None,
            game_state: None,
            notifications: StandingNotifications::default(),
            ready: true,
        }));
        Ok((
            context,
            state,
            Arc::new(AtomicBool::new(false)),
            player,
            packets,
        ))
    }

    fn read_targeted_message(packet: &[u8]) -> Result<String> {
        let mut reader = BitReader::new(packet);
        assert_eq!(reader.read_u16()?, CUSTOM_CHAT_MESSAGE);
        assert_eq!(reader.read_u64()?, 42);
        let message = reader.read_string(4_096)?;
        assert_eq!(reader.read_string(4_096)?, HOSTNAME);
        Ok(message)
    }

    #[tokio::test]
    async fn failed_lookup_sends_bun_gtr_fallback() -> Result<()> {
        let (context, state, stopped, player, packets) = welcome_fixture().await?;
        send_tournament_welcome(
            context,
            state,
            stopped,
            TournamentType::Weekly,
            player,
            |_, _| async { Err(anyhow::anyhow!("unavailable")) },
        )
        .await;
        let packets = packets.lock().await;
        assert_eq!(packets.len(), 1);
        assert!(
            read_targeted_message(&packets[0])?
                .contains("You need GTR installed to join the tournament leaderboard.")
        );
        Ok(())
    }

    #[tokio::test]
    async fn delayed_lookup_retries_changed_tournament_once() -> Result<()> {
        let (context, state, stopped, player, packets) = welcome_fixture().await?;
        let changing_state = state.clone();
        let started = Arc::new(Notify::new());
        let release = Arc::new(Notify::new());
        let looked_up = Arc::new(Mutex::new(Vec::new()));
        let task = tokio::spawn({
            let started = started.clone();
            let release = release.clone();
            let looked_up = looked_up.clone();
            async move {
                send_tournament_welcome(
                    context,
                    state.clone(),
                    stopped,
                    TournamentType::Weekly,
                    player,
                    move |id, _| {
                        let started = started.clone();
                        let release = release.clone();
                        let looked_up = looked_up.clone();
                        async move {
                            looked_up.lock().await.push(id);
                            if id == 7 {
                                started.notify_one();
                                release.notified().await;
                            }
                            Ok(TournamentLobbyPlayerContext {
                                minimum_gtr_version: None,
                                user_exists: true,
                                recent_record: true,
                                standing: Some((id, 34.234)),
                            })
                        }
                    },
                )
                .await;
            }
        });
        started.notified().await;
        changing_state.lock().await.asset.id_tournament = 8;
        release.notify_one();
        task.await?;
        assert_eq!(*looked_up.lock().await, [7, 8]);
        let packets = packets.lock().await;
        assert_eq!(packets.len(), 1);
        assert!(read_targeted_message(&packets[0])?.contains("You are currently #8"));
        Ok(())
    }

    #[tokio::test]
    async fn delayed_lookup_drops_departed_or_stopped_player() -> Result<()> {
        for stop_room in [false, true] {
            let (context, state, stopped, player, packets) = welcome_fixture().await?;
            let started = Arc::new(Notify::new());
            let release = Arc::new(Notify::new());
            let task = tokio::spawn({
                let context = context.clone();
                let task_stopped = stopped.clone();
                let started = started.clone();
                let release = release.clone();
                let player = player.clone();
                async move {
                    send_tournament_welcome(
                        context,
                        state,
                        task_stopped,
                        TournamentType::Weekly,
                        player,
                        move |_, _| {
                            let started = started.clone();
                            let release = release.clone();
                            async move {
                                started.notify_one();
                                release.notified().await;
                                Ok(TournamentLobbyPlayerContext {
                                    minimum_gtr_version: None,
                                    user_exists: true,
                                    recent_record: true,
                                    standing: None,
                                })
                            }
                        },
                    )
                    .await;
                }
            });
            started.notified().await;
            if stop_room {
                stopped.store(true, Ordering::Release);
            } else {
                context
                    .observe_test_packet(&GameHostPacket::PlayerDisconnected(player.uid))
                    .await;
            }
            release.notify_one();
            task.await?;
            assert!(packets.lock().await.is_empty());
        }
        Ok(())
    }

    #[test]
    fn unranked_player_gets_bun_overrides_without_replacing_native_time() -> Result<()> {
        let player = GameHostPlayer {
            backup_name: "<b>Player</b>".into(),
            player_tag: "[T]".into(),
            steam_id: 42,
            uid: 4,
            username: None,
        };
        let standing = desired_standing(&player, None);
        assert_eq!(standing.time, None);
        assert_eq!(standing.overrides.position, "—");
        assert_eq!(standing.overrides.time, "");
        assert_eq!(standing.overrides.points, "0 pts");
        assert_eq!(
            standing.overrides.name,
            "<nobr>[T]&lt;b&gt;Player&lt;/b&gt;</nobr>"
        );
        let mut board = PlayerLeaderboard::new(1);
        board.set_scope("tournament", "level");
        board.set_ready(true);
        board.observe(&GameHostPacket::Initial {
            is_host: true,
            players: vec![player],
        });
        board.observe(&GameHostPacket::Leaderboard {
            packet_type: 1,
            times: vec![zc_core::zeepnet::LeaderboardTime {
                steam_id: 42,
                time: 12.5,
            }],
            overrides: vec![],
        });
        board.set_desired(vec![standing]);
        let packets = board.reconcile()?;
        assert_eq!(packets.len(), 1);
        let mut reader = zc_core::zeepnet::BitReader::new(&packets[0]);
        assert_eq!(reader.read_u16()?, zc_core::zeepnet::CUSTOM_LEADERBOARD);
        assert_eq!(reader.read_u64()?, 42);
        Ok(())
    }

    #[test]
    fn ranked_override_uses_live_roster_name() {
        let player = GameHostPlayer {
            backup_name: "Player".into(),
            player_tag: "[T]".into(),
            steam_id: 42,
            uid: 4,
            username: Some("Current name".into()),
        };
        let row = TournamentLobbyStanding {
            user_id: 1,
            record_id: 2,
            steam_id: 42,
            steam_name: Some("Stale database name".into()),
            time: 12.345,
            rank: 17,
            points: 400,
        };
        let standing = desired_standing(&player, Some(&row));
        assert_eq!(standing.overrides.position, "17");
        assert_eq!(standing.overrides.name, "<nobr>[T]Current name</nobr>");
        assert_eq!(standing.overrides.points, "400 pts");
    }
}
