use super::*;
use crate::{assets::PreparedLevel, config::RoomSettings, transfer::TransferEvent};
use std::sync::{Mutex as StdMutex, atomic::AtomicUsize};
use tokio::sync::mpsc;
use zc_core::zeepnet::{
    CHANGE_LOBBY_MASTER, CHANGE_LOBBY_VISIBILITY, CHAT_MESSAGE, GameHostPlayer,
};

const BOT_UID: u32 = 0xfedc_ba98;
const BOT_STEAM_ID: u64 = 76_561_198_000_000_000;
const PROFILE_PACKET: u16 = 0xfeac;

struct FakeConnection {
    inbox: Mutex<mpsc::UnboundedReceiver<Result<Option<GameHostPacket>>>>,
    sent: StdMutex<Vec<Vec<u8>>>,
    closes: AtomicUsize,
    fail_chat: AtomicBool,
    stall_controls: AtomicBool,
}

#[async_trait::async_trait]
impl PacketSender for FakeConnection {
    async fn send(&self, packet: Vec<u8>) -> Result<()> {
        let id = packet_type(&packet);
        self.sent.lock().unwrap().push(packet);
        if id == CHAT_MESSAGE && self.fail_chat.load(Ordering::Acquire) {
            bail!("fake chat failure");
        }
        if matches!(id, CHANGE_LOBBY_MASTER | CHAT_MESSAGE)
            && self.stall_controls.load(Ordering::Acquire)
        {
            pending::<()>().await;
        }
        Ok(())
    }
}

#[async_trait::async_trait]
impl RoomConnection for FakeConnection {
    async fn recv(&self) -> Result<Option<GameHostPacket>> {
        self.inbox.lock().await.recv().await.unwrap_or(Ok(None))
    }
    async fn close(&self, _reason: &str) -> Result<()> {
        self.closes.fetch_add(1, Ordering::AcqRel);
        Ok(())
    }
    fn remote_clock(&self) -> RemoteClock {
        RemoteClock::default()
    }
}

#[derive(Default)]
struct ProfileStats {
    starts: AtomicUsize,
    stops: AtomicUsize,
    contexts: StdMutex<Vec<RoomContext>>,
    observed: StdMutex<Vec<GameHostPacket>>,
    fail_start: AtomicBool,
    fail_seed: AtomicBool,
    fail_create: AtomicBool,
    stall_stop_once: AtomicBool,
}

struct FakeProfile(Arc<ProfileStats>);

#[async_trait::async_trait]
impl LobbyProfile for FakeProfile {
    fn name(&self) -> &str {
        "fake-profile"
    }
    async fn prepare(&self) -> Result<Option<PreparedLevel>> {
        Ok(None)
    }
    async fn create_session(&self, context: RoomContext) -> Result<Arc<dyn ProfileSession>> {
        if self.0.fail_create.load(Ordering::Acquire) {
            bail!("fake session creation failure");
        }
        self.0.contexts.lock().unwrap().push(context.clone());
        Ok(Arc::new(FakeSession {
            context,
            stats: self.0.clone(),
        }))
    }
    async fn stop(&self) -> Result<()> {
        Ok(())
    }
}

struct FakeSession {
    context: RoomContext,
    stats: Arc<ProfileStats>,
}

#[async_trait::async_trait]
impl ProfileSession for FakeSession {
    async fn start(&self) -> Result<()> {
        self.stats.starts.fetch_add(1, Ordering::AcqRel);
        self.context
            .send(PROFILE_PACKET.to_le_bytes().to_vec())
            .await?;
        if self.stats.fail_start.load(Ordering::Acquire) {
            bail!("fake profile failure");
        }
        pending().await
    }
    async fn on_packet(&self, packet: &GameHostPacket) -> Result<()> {
        self.stats.observed.lock().unwrap().push(packet.clone());
        // Reading players here also catches holding the roster lock while seeding.
        let _ = self.context.players().await;
        if self.stats.fail_seed.load(Ordering::Acquire) {
            bail!("fake seed failure");
        }
        Ok(())
    }
    async fn on_transfer(&self, _event: &TransferEvent) -> Result<()> {
        Ok(())
    }
    async fn stop(&self) {
        self.stats.stops.fetch_add(1, Ordering::AcqRel);
        if self.stats.stall_stop_once.swap(false, Ordering::AcqRel) {
            pending::<()>().await;
        }
    }
}

struct Harness {
    input: mpsc::UnboundedSender<Result<Option<GameHostPacket>>>,
    connection: Arc<FakeConnection>,
    stats: Arc<ProfileStats>,
    stopped: Arc<AtomicBool>,
    wake: Arc<Notify>,
    task: Option<JoinHandle<Result<()>>>,
}

impl Harness {
    fn new() -> Self {
        let (input, inbox) = mpsc::unbounded_channel();
        let connection = Arc::new(FakeConnection {
            inbox: Mutex::new(inbox),
            sent: StdMutex::new(Vec::new()),
            closes: AtomicUsize::new(0),
            fail_chat: AtomicBool::new(false),
            stall_controls: AtomicBool::new(false),
        });
        let stats = Arc::new(ProfileStats::default());
        let stopped = Arc::new(AtomicBool::new(false));
        let wake = Arc::new(Notify::new());
        let task = {
            let connection = connection.clone();
            let stats = stats.clone();
            let stopped = stopped.clone();
            let wake = wake.clone();
            tokio::spawn(async move {
                let config = ManagedRoomConfig {
                    key: "totw".into(),
                    profile: RoomProfile::TrackTournament {
                        tournament_type: TournamentType::Weekly,
                    },
                    room: RoomSettings {
                        name: "Room".into(),
                        is_public: true,
                        max_players: 64,
                    },
                    round_time_seconds: 900,
                    asset_poll_ms: 30_000,
                    reconnect_max_ms: 60_000,
                    message_refresh_ms: 60_000,
                };
                let profile = FakeProfile(stats);
                ConnectedRoom {
                    config: &config,
                    profile: &profile,
                    connection,
                    local_steam_id: BOT_STEAM_ID,
                    player_uid: BOT_UID,
                    stopped: &stopped,
                    wake: &wake,
                }
                .run(&mut RetryBackoff::new(config.reconnect_max_ms))
                .await
            })
        };
        Self {
            input,
            connection,
            stats,
            stopped,
            wake,
            task: Some(task),
        }
    }

    fn packet(&self, packet: GameHostPacket) {
        self.input.send(Ok(Some(packet))).unwrap();
    }
    fn count(&self, id: u16) -> usize {
        self.connection
            .sent
            .lock()
            .unwrap()
            .iter()
            .filter(|packet| packet_type(packet) == id)
            .count()
    }
    fn starts(&self) -> usize {
        self.stats.starts.load(Ordering::Acquire)
    }
    fn stops(&self) -> usize {
        self.stats.stops.load(Ordering::Acquire)
    }
    fn is_finished(&self) -> bool {
        self.task.as_ref().unwrap().is_finished()
    }
    async fn result(&mut self) -> Result<()> {
        self.task.take().unwrap().await.unwrap()
    }
    async fn shutdown(&mut self) -> Result<()> {
        self.stopped.store(true, Ordering::Release);
        self.wake.notify_waiters();
        self.result().await
    }
}

fn packet_type(packet: &[u8]) -> u16 {
    u16::from_le_bytes([packet[0], packet[1]])
}
fn player(uid: u32) -> GameHostPlayer {
    GameHostPlayer {
        backup_name: format!("Player {uid}"),
        player_tag: String::new(),
        steam_id: if uid == BOT_UID {
            BOT_STEAM_ID
        } else {
            BOT_STEAM_ID + u64::from(uid)
        },
        uid,
        username: None,
    }
}
fn initial(is_host: bool) -> GameHostPacket {
    GameHostPacket::Initial {
        is_host,
        players: vec![player(BOT_UID), player(42)],
        timing: LobbyTiming {
            game_state: 0,
            round_time: 900.0,
            level_loaded_at: 10.0,
            uid: "old".into(),
            workshop_id: 1,
        },
    }
}
async fn flush() {
    for _ in 0..20 {
        tokio::task::yield_now().await;
    }
}
async fn advance(seconds: u64) {
    tokio::time::advance(Duration::from_secs(seconds)).await;
    flush().await;
}

#[tokio::test(start_paused = true)]
async fn owned_join_waits_for_initial_and_settling_then_starts_once() -> Result<()> {
    let mut h = Harness::new();
    flush().await;
    assert_eq!(h.count(CHANGE_LOBBY_VISIBILITY), 0);
    h.packet(initial(true));
    flush().await;
    advance(3).await;
    assert_eq!(h.starts(), 0);
    advance(1).await;
    assert_eq!(h.starts(), 1);
    assert_eq!(h.count(PROFILE_PACKET), 1);
    assert_eq!(h.count(CHANGE_LOBBY_MASTER), 0);
    h.packet(GameHostPacket::Master(BOT_UID));
    h.packet(initial(true));
    flush().await;
    assert_eq!(h.starts(), 1);
    assert_eq!(h.count(CHAT_MESSAGE), 0);
    h.shutdown().await?;
    assert_eq!(h.stops(), 1);
    assert_eq!(h.connection.closes.load(Ordering::Acquire), 1);
    assert_eq!(h.count(CHANGE_LOBBY_VISIBILITY), 2);
    Ok(())
}

#[tokio::test(start_paused = true)]
async fn self_transfer_waits_for_server_and_seeds_latest_roster_and_timing() -> Result<()> {
    let mut h = Harness::new();
    h.packet(initial(false));
    flush().await;
    assert_eq!(
        h.connection.sent.lock().unwrap().as_slice(),
        [change_lobby_master_packet(BOT_UID)?]
    );
    h.packet(GameHostPacket::GameProperties {
        level_loaded_at: 20.0,
        round_time: 300.0,
        uid: "latest".into(),
        workshop_id: 2,
    });
    h.packet(GameHostPacket::GameState(1));
    h.packet(GameHostPacket::PlayerConnected {
        player: player(43),
        is_host: false,
        has_host_powers: true,
    });
    advance(4).await;
    assert_eq!(h.starts(), 0);
    assert_eq!(h.count(PROFILE_PACKET), 0);
    h.packet(GameHostPacket::Master(BOT_UID));
    flush().await;
    assert_eq!(h.starts(), 1);
    let seed = h.stats.observed.lock().unwrap()[0].clone();
    let GameHostPacket::Initial {
        is_host,
        players,
        timing,
    } = seed
    else {
        panic!("initial seed expected");
    };
    assert!(is_host);
    assert_eq!(
        players.iter().map(|p| p.uid).collect::<Vec<_>>(),
        [42, 43, BOT_UID]
    );
    assert_eq!(timing.uid, "latest");
    assert_eq!(timing.game_state, 1);
    assert_eq!(timing.level_loaded_at, 20.0);
    assert_eq!(timing.round_time, 300.0);
    advance(40).await;
    assert_eq!(h.count(CHAT_MESSAGE), 0);
    assert!(!h.is_finished());
    h.shutdown().await
}

#[tokio::test(start_paused = true)]
async fn stalled_reclaim_and_failed_chat_keep_original_thirty_second_deadline() {
    let mut h = Harness::new();
    h.connection.stall_controls.store(true, Ordering::Release);
    h.connection.fail_chat.store(true, Ordering::Release);
    h.packet(initial(false));
    flush().await;
    advance(4).await;
    assert_eq!(h.count(CHAT_MESSAGE), 0);
    h.packet(GameHostPacket::Master(42));
    h.packet(initial(false));
    flush().await;
    advance(1).await;
    assert_eq!(h.count(CHAT_MESSAGE), 1);
    assert_eq!(h.count(CHANGE_LOBBY_MASTER), 1);
    assert!(!h.is_finished());
    advance(24).await;
    h.packet(GameHostPacket::Master(43));
    flush().await;
    assert!(!h.is_finished());
    advance(1).await;
    assert_eq!(
        h.result().await.unwrap_err().to_string(),
        "Managed account lost lobby ownership"
    );
    assert_eq!(h.count(CHANGE_LOBBY_VISIBILITY), 0);
    assert_eq!(h.count(PROFILE_PACKET), 0);
    assert_eq!(h.count(CHAT_MESSAGE), 1);
    assert_eq!(h.connection.closes.load(Ordering::Acquire), 1);
}

#[tokio::test(start_paused = true)]
async fn silence_times_out_without_profile_or_host_packets() {
    let mut h = Harness::new();
    flush().await;
    advance(29).await;
    assert!(!h.is_finished());
    advance(1).await;
    assert_eq!(
        h.result().await.unwrap_err().to_string(),
        "Lobby initial state timed out"
    );
    assert!(h.connection.sent.lock().unwrap().is_empty());
    assert_eq!(h.connection.closes.load(Ordering::Acquire), 1);
}

#[tokio::test(start_paused = true)]
async fn moderator_permissions_do_not_trigger_recovery_but_actual_ownership_does() -> Result<()> {
    let mut h = Harness::new();
    h.packet(initial(true));
    flush().await;
    advance(4).await;
    let moderator = GameHostPacket::PlayerConnected {
        player: player(43),
        is_host: false,
        has_host_powers: true,
    };
    h.packet(moderator.clone());
    // Permission updates/other players' flags must not overwrite local authority.
    h.packet(GameHostPacket::PlayerConnected {
        player: player(43),
        is_host: true,
        has_host_powers: true,
    });
    h.packet(GameHostPacket::PlayerDisconnected(43));
    h.packet(moderator.clone());
    flush().await;
    advance(40).await;
    assert_eq!(h.count(CHANGE_LOBBY_MASTER), 0);
    assert_eq!(h.count(CHAT_MESSAGE), 0);
    assert_eq!(h.starts(), 1);
    assert_eq!(h.stops(), 0);
    assert_eq!(h.connection.closes.load(Ordering::Acquire), 0);
    assert!(h.stats.observed.lock().unwrap().contains(&moderator));
    let old = h.stats.contexts.lock().unwrap()[0].clone();
    h.packet(GameHostPacket::Master(43));
    flush().await;
    assert_eq!(h.count(CHANGE_LOBBY_MASTER), 1);
    assert_eq!(h.stops(), 1);
    assert!(!old.is_host());
    assert!(old.chat().command("/joinmessage off").await.is_err());
    assert!(
        old.send(PROFILE_PACKET.to_le_bytes().to_vec())
            .await
            .is_err()
    );
    h.packet(GameHostPacket::Master(43));
    h.packet(GameHostPacket::PlayerDisconnected(42));
    flush().await;
    advance(5).await;
    assert_eq!(h.count(CHAT_MESSAGE), 1);
    assert_eq!(h.count(PROFILE_PACKET), 1);
    h.packet(GameHostPacket::Master(BOT_UID));
    flush().await;
    h.packet(GameHostPacket::Master(BOT_UID));
    flush().await;
    assert_eq!(h.starts(), 2);
    assert_eq!(h.count(PROFILE_PACKET), 2);
    assert_eq!(h.count(CHANGE_LOBBY_MASTER), 1);
    assert!(!old.is_host());
    assert!(old.chat().command("stale message").await.is_err());
    let new = h.stats.contexts.lock().unwrap()[1].clone();
    assert!(new.is_host());
    assert_eq!(
        new.players()
            .await
            .iter()
            .map(|p| p.uid)
            .collect::<Vec<_>>(),
        [43, BOT_UID]
    );
    h.shutdown().await?;
    assert_eq!(h.stops(), 2);
    Ok(())
}

#[tokio::test(start_paused = true)]
async fn recovery_can_succeed_after_chat_and_cancel_stalled_control_tasks() -> Result<()> {
    let mut h = Harness::new();
    h.connection.stall_controls.store(true, Ordering::Release);
    h.packet(initial(false));
    flush().await;
    advance(5).await;
    assert_eq!(h.count(CHAT_MESSAGE), 1);
    advance(24).await;
    h.packet(GameHostPacket::Master(BOT_UID));
    flush().await;
    assert_eq!(h.starts(), 1);
    advance(60).await;
    assert!(!h.is_finished());
    assert_eq!(h.count(CHAT_MESSAGE), 1);
    h.shutdown().await
}

#[tokio::test(start_paused = true)]
async fn shutdown_interrupts_startup_settling_and_recovery() -> Result<()> {
    for initial_state in [None, Some(true), Some(false)] {
        let mut h = Harness::new();
        h.connection.stall_controls.store(true, Ordering::Release);
        if let Some(host) = initial_state {
            h.packet(initial(host));
        }
        flush().await;
        let now = Instant::now();
        h.shutdown().await?;
        assert_eq!(Instant::now(), now);
        assert_eq!(h.starts(), 0);
        assert_eq!(h.connection.closes.load(Ordering::Acquire), 1);
        assert_eq!(
            h.count(CHANGE_LOBBY_VISIBILITY),
            usize::from(initial_state == Some(true))
        );
    }
    // Stop before the receive loop registers its Notify waiter.
    let mut h = Harness::new();
    h.shutdown().await?;
    assert_eq!(h.connection.closes.load(Ordering::Acquire), 1);
    Ok(())
}

#[tokio::test(start_paused = true)]
async fn packet_and_profile_errors_always_close_connection_and_retire_session() {
    for failure in ["create", "seed", "start", "receive"] {
        let mut h = Harness::new();
        h.stats
            .fail_create
            .store(failure == "create", Ordering::Release);
        h.stats
            .fail_seed
            .store(failure == "seed", Ordering::Release);
        h.stats
            .fail_start
            .store(failure == "start", Ordering::Release);
        h.packet(initial(true));
        flush().await;
        advance(4).await;
        if failure == "receive" {
            h.input
                .send(Err(anyhow::anyhow!("fake malformed packet")))
                .unwrap();
            flush().await;
        }
        assert!(h.result().await.is_err(), "{failure}");
        assert_eq!(h.connection.closes.load(Ordering::Acquire), 1, "{failure}");
        assert_eq!(h.stops(), usize::from(failure != "create"), "{failure}");
        assert!(
            h.stats
                .contexts
                .lock()
                .unwrap()
                .iter()
                .all(|ctx| !ctx.is_host())
        );
        let last = h.connection.sent.lock().unwrap().last().unwrap().clone();
        assert_eq!(last, change_lobby_visibility_packet(false).unwrap());
    }
}

#[test]
fn recovery_chat_identifies_all_room_profiles() {
    for (profile, label) in [
        (
            RoomProfile::TrackTournament {
                tournament_type: TournamentType::Weekly,
            },
            "Track of the Week",
        ),
        (
            RoomProfile::TrackTournament {
                tournament_type: TournamentType::Monthly,
            },
            "Track of the Month",
        ),
        (
            RoomProfile::ZslSubmissions { round_id: 50 },
            "ZSL submissions",
        ),
    ] {
        assert_eq!(
            recovery_message(&profile),
            format!(
                "ZeepCentraal needs host back to keep this room operating for {label}. Please return host to ZeepCentraal."
            )
        );
    }
}

#[tokio::test(start_paused = true)]
async fn ownership_loss_closes_pending_activation_and_blocks_retired_transfer() -> Result<()> {
    use zc_core::zeepnet::OnlineLevel;

    let mut h = Harness::new();
    h.packet(initial(true));
    flush().await;
    advance(4).await;
    let context = h.stats.contexts.lock().unwrap()[0].clone();
    let level = PreparedLevel {
        compressed_data: Arc::from([]),
        content_sha256: Arc::from("fake-sha256"),
        level: OnlineLevel {
            author: "Author".into(),
            collaborators: String::new(),
            name: "Level".into(),
            override_author_name: String::new(),
            uid: "next".into(),
            workshop_id: 123,
        },
    };
    let ready = context
        .transfer
        .lock()
        .await
        .begin_activation(level.clone(), None)
        .await?;
    h.packet(GameHostPacket::Master(42));
    flush().await;
    assert_eq!(
        ready.await?.unwrap_err().to_string(),
        "GameServer connection closed"
    );
    let before = h.connection.sent.lock().unwrap().len();
    assert!(context.activate(level.clone(), None).await.is_err());
    assert_eq!(
        context
            .transfer
            .lock()
            .await
            .begin_activation(level, None)
            .await
            .unwrap_err()
            .to_string(),
        "GameServer connection closed"
    );
    assert_eq!(h.connection.sent.lock().unwrap().len(), before);
    h.shutdown().await
}

#[tokio::test(start_paused = true)]
async fn shutdown_during_session_retirement_still_closes_transfer() -> Result<()> {
    use zc_core::zeepnet::OnlineLevel;

    let mut h = Harness::new();
    h.packet(initial(true));
    flush().await;
    advance(4).await;
    let context = h.stats.contexts.lock().unwrap()[0].clone();
    let level = PreparedLevel {
        compressed_data: Arc::from([]),
        content_sha256: Arc::from("fake-sha256"),
        level: OnlineLevel {
            author: "Author".into(),
            collaborators: String::new(),
            name: "Level".into(),
            override_author_name: String::new(),
            uid: "next".into(),
            workshop_id: 123,
        },
    };
    let mut ready = context
        .transfer
        .lock()
        .await
        .begin_activation(level, None)
        .await?;
    h.stats.stall_stop_once.store(true, Ordering::Release);
    h.packet(GameHostPacket::Master(42));
    flush().await;
    assert_eq!(h.stops(), 1);
    assert!(!context.is_host());
    h.shutdown().await?;
    assert_eq!(h.stops(), 2);
    assert_eq!(
        ready.try_recv()?.unwrap_err().to_string(),
        "GameServer connection closed"
    );
    assert_eq!(h.connection.closes.load(Ordering::Acquire), 1);
    Ok(())
}
