use super::*;
use crate::chat::FnPacketSender;
use zc_core::{
    object_storage::DownloadConstraints,
    practice::{PracticeLevel, PracticePayload},
    zeepnet::{BitReader, GameHostPlayer, KICK_PLAYER, SKIP_TO_LEVEL},
};

struct TestStorage;
#[async_trait::async_trait]
impl ObjectStorage for TestStorage {
    async fn upload(&self, _: &str, _: Vec<u8>, _: &str) -> Result<()> {
        Ok(())
    }
    async fn download(&self, _: &str, _: DownloadConstraints<'_>) -> Result<Vec<u8>> {
        Ok(vec![1, 2, 3])
    }
    async fn delete(&self, _: &str) -> Result<()> {
        Ok(())
    }
}
fn bundle(round_id: i32, warmup: bool) -> PracticeBundle {
    PracticeBundle {
        round_id,
        playlist: if warmup {
            zc_core::practice::warmup_playlist_key(round_id)
        } else {
            "https://example.com/final.zeeplist".into()
        },
        round_length: Some(if warmup { 300 } else { 420 }),
        levels: (0..if warmup { 4 } else { 15 })
            .map(|index| {
                let sha256 = format!("{:064x}", index + 1);
                PracticePayload {
                    level: PracticeLevel {
                        uid: format!("{}-{index}", if warmup { "warmup" } else { "zsl" }),
                        workshop_id: 1,
                        name: if warmup {
                            format!("Warm-up {index}")
                        } else if index == 7 {
                            "Break Time - Test".into()
                        } else {
                            format!("ZSL - Track {index}")
                        },
                        author: "Author".into(),
                        collaborators: String::new(),
                        override_author_name: String::new(),
                    },
                    object_key: format!("zsl-practice/payloads/{sha256}.gz"),
                    sha256,
                    byte_size: 3,
                    xx_hash: Some(format!("{:032x}", index + 1)),
                    legacy_hash: Some(format!("legacy-{}", index + 1)),
                    author_time: Some(30.0),
                }
            })
            .collect(),
    }
}
fn config(tournament: bool) -> Result<ManagedRoomConfig> {
    Ok(crate::config::LobbyHostFileConfig::parse(&format!(r#"{{"version":1,"rooms":[{{"key":"{}","profile":{{"type":"{}","roundId":7,"playlist":"https://example.com/final.zeeplist"}},"room":{{"name":"ZSL","isPublic":true,"maxPlayers":64}},"roundTimeSeconds":{},"assetPollMs":30000,"reconnectMaxMs":60000,"messageRefreshMs":60000}}]}}"#,if tournament {"zsl"} else {"practice"},if tournament {"zsl"} else {"zsl-practice"},if tournament {420} else {900}))?.rooms.remove(0))
}
fn player() -> GameHostPlayer {
    GameHostPlayer {
        chat_color: None,
        uid: 42,
        steam_id: 76561198000000042,
        username: Some("Player".into()),
        backup_name: "Player".into(),
        player_tag: String::new(),
    }
}

// These tests run without PostgreSQL. DB preparation precedes the tested operation;
// execute_and_commit is the same lock boundary used by the production lifecycle.
fn offline_session(sender: Arc<dyn crate::chat::PacketSender>) -> Result<Arc<ZslSession>> {
    use zc_database::{DatabasePool, PoolBudget, PoolSettings};
    let pool = DatabasePool::connect_lazy(
        "postgres://test:test@127.0.0.1:9/test",
        PoolSettings {
            application_name: "handover-test".into(),
            acquire_timeout: Duration::from_millis(1),
            statement_timeout: Duration::from_secs(1),
            lock_timeout: Duration::from_secs(1),
            idle_transaction_timeout: Duration::from_secs(1),
            idle_timeout: Duration::from_secs(1),
        },
        PoolBudget::application(1),
    )?;
    let profile = ZslProfile::new(
        config(true)?,
        Some(config(false)?),
        Database::from_partition(pool.application()),
        Arc::new(TestStorage),
    )?;
    *profile.shared.event.write().unwrap() = Some(ZslEvent {
        name: "Test Round".into(),
        round: 1,
        season: 1,
        first: jiff::Timestamp::now().as_second() + 1200,
        second: jiff::Timestamp::now().as_second() + 20000,
        points: vec![100],
        minimum_points: 1,
        best_of: 4,
    });
    let mut context = RoomContext::for_test(sender, 1)?;
    context.test_remote_time(1000.0);
    Ok(Arc::new(ZslSession {
        shared: profile.shared,
        board: Mutex::new(context.leaderboard()),
        context,
        live: Mutex::new(LiveState::default()),
        stopped: AtomicBool::new(false),
        wake: Notify::new(),
    }))
}

#[tokio::test]
async fn names_reconcile_in_every_phase_without_lifecycle_locks() -> Result<()> {
    for phase in [Phase::Practice, Phase::Warmup, Phase::Tournament] {
        let sent = Arc::new(Mutex::new(Vec::new()));
        let sink = sent.clone();
        let session = offline_session(Arc::new(FnPacketSender(move |packet| {
            let sink = sink.clone();
            async move {
                sink.lock().await.push(packet);
                Ok(())
            }
        })))?;
        let mut saved = session.shared.saved.lock().await;
        saved.phase = phase;
        let _live = session.live.lock().await;
        let packet = GameHostPacket::Initial {
            is_host: true,
            players: vec![player()],
            timing: zc_core::zeepnet::LobbyTiming {
                game_state: 0,
                round_time: 900.0,
                level_loaded_at: 0.0,
                uid: String::new(),
                workshop_id: 0,
            },
        };
        tokio::time::timeout(Duration::from_secs(1), session.on_packet(&packet)).await??;
        assert_eq!(
            crate::leaderboard::read_test_overrides(&sent.lock().await[0])?
                .1
                .name,
            "<color=#FFFFFF><nobr>Player</nobr></color>"
        );
        let packet = GameHostPacket::PlayerCosmetics {
            uid: player().uid,
            chat_color: Some([18, 52, 86]),
        };
        tokio::time::timeout(Duration::from_secs(1), session.on_packet(&packet)).await??;
        assert_eq!(
            crate::leaderboard::read_test_overrides(&sent.lock().await[1])?
                .1
                .name,
            "<color=#123456><nobr>Player</nobr></color>"
        );
        session.on_packet(&packet).await?;
        assert_eq!(sent.lock().await.len(), 2);
    }
    Ok(())
}

async fn prepared_transition(session: &ZslSession, phase: Phase) -> Result<PreparedTransition> {
    let asset = pinned_asset(bundle(7, phase == Phase::Warmup), Arc::new(TestStorage))?;
    let level = asset.first().await?;
    let generation = session.live.lock().await.generation + 1;
    Ok(PreparedTransition {
        phase,
        slot: 0,
        index: 0,
        generation,
        asset,
        level,
        deadline: jiff::Timestamp::now().as_second() + 300,
        seconds: 300.0,
        scoring_level: (phase == Phase::Tournament).then_some(42),
        title: "ZSL Test".into(),
    })
}

async fn run_transition(session: &ZslSession, transition: PreparedTransition) -> Result<()> {
    let mut state = session.shared.saved.lock().await;
    let mut live = session.live.lock().await;
    state.phase = transition.phase;
    state.index = transition.index;
    state.timeslot = transition.slot;
    state.deadline = transition.deadline;
    live.generation = transition.generation;
    live.ready = None;
    live.current_level_id = None;
    live.asset = None;
    let (state, live) = session.execute_and_commit(state, live, transition).await?;
    drop(live);
    drop(state);
    Ok(())
}

fn game_properties(level: &crate::assets::PreparedLevel, loaded_at: f64) -> GameHostPacket {
    GameHostPacket::GameProperties {
        uid: level.level.uid.clone(),
        workshop_id: level.level.workshop_id,
        level_loaded_at: loaded_at,
        round_time: 300.0,
    }
}

async fn wait_for_skip(packets: &mut tokio::sync::mpsc::UnboundedReceiver<Vec<u8>>) {
    loop {
        let packet = packets.recv().await.expect("sender closed");
        if u16::from_le_bytes([packet[0], packet[1]]) == SKIP_TO_LEVEL {
            return;
        }
    }
}

#[tokio::test]
async fn handovers_dispatch_join_chat_playlist_and_podium_packets_before_upload() -> Result<()> {
    for (previous, phase, cached) in [
        (Phase::Retired, Phase::Practice, false),
        (Phase::Practice, Phase::Warmup, false),
        (Phase::Warmup, Phase::Tournament, false),
        (Phase::Practice, Phase::Tournament, false),
        (Phase::Warmup, Phase::Tournament, true),
    ] {
        let (signal, mut packets) = tokio::sync::mpsc::unbounded_channel();
        let session = offline_session(Arc::new(FnPacketSender(move |packet: Vec<u8>| {
            let signal = signal.clone();
            async move {
                ensure!(
                    u16::from_le_bytes([packet[0], packet[1]])
                        != zc_core::zeepnet::CHANGE_LOBBY_GAME_PROPERTIES,
                    "Server-only GameProperties packet sent by host"
                );
                signal.send(packet)?;
                Ok(())
            }
        })))?;
        session.live.lock().await.active = Some((previous, 0, 0));
        let join = GameHostPacket::PlayerConnected {
            player: player(),
            is_host: false,
            has_host_powers: false,
        };
        session.context.observe_test_packet(&join).await;
        {
            let mut board = session.board.lock().await;
            board.observe(&join);
            board.set_ready(true);
            board.set_desired(vec![DesiredPlayerStanding {
                steam_id: player().steam_id,
                time: None,
                overrides: LeaderboardOverrides {
                    position: "2".into(),
                    points: "100".into(),
                    points_won: "20".into(),
                    ..Default::default()
                },
            }]);
            board.reconcile()?;
        }
        let transition = prepared_transition(&session, phase).await?;
        let deadline = transition.deadline;
        let level = transition.level.clone();
        let task = tokio::spawn({
            let session = session.clone();
            async move { run_transition(&session, transition).await }
        });
        tokio::time::timeout(Duration::from_secs(2), async {
            let mut cleared = false;
            loop {
                let packet = packets.recv().await.context("Missing transition packet")?;
                match u16::from_le_bytes([packet[0], packet[1]]) {
                    zc_core::zeepnet::CUSTOM_LEADERBOARD => {
                        let overrides = crate::leaderboard::read_test_overrides(&packet)?.1;
                        assert_eq!(overrides.name, "<color=#FFFFFF><nobr>Player</nobr></color>");
                        assert_eq!(overrides.position, "");
                        assert_eq!(overrides.points, "");
                        assert_eq!(overrides.points_won, "");
                        cleared = true;
                    }
                    SKIP_TO_LEVEL => break,
                    _ => {}
                }
            }
            assert!(cleared);
            for packet in [
                GameHostPacket::GameState(2),
                GameHostPacket::PlaylistIndex {
                    current_index: 0,
                    next_index: 1,
                    select_next: false,
                },
                GameHostPacket::Playlist(zc_core::zeepnet::OnlinePlaylist {
                    levels: vec![],
                    current_index: 0,
                    next_index: 0,
                    is_random: false,
                    original_playlist_length: 0,
                    round_time: 300.0,
                    was_synced: true,
                }),
                GameHostPacket::Leaderboard {
                    packet_type: 0,
                    times: vec![],
                    overrides: vec![],
                },
                GameHostPacket::Chat {
                    message: "hello".into(),
                    sender_uid: player().uid,
                },
                GameHostPacket::PlayerConnected {
                    player: player(),
                    is_host: false,
                    has_host_powers: false,
                },
                GameHostPacket::PlayerResult {
                    uid: player().uid,
                    has_result: true,
                    level_uid: level.level.uid.clone(),
                    time: 10.0,
                    checkpoints: 1,
                },
            ] {
                session.context.observe_test_packet(&packet).await;
                session.context.dispatch(session.as_ref(), &packet).await?;
            }
            assert!(session.live.lock().await.ready.is_none());
            let name = packets
                .recv()
                .await
                .context("Missing player name override")?;
            assert_eq!(
                crate::leaderboard::read_test_overrides(&name)?.1.name,
                "<color=#FFFFFF><nobr>Player</nobr></color>"
            );
            if phase == Phase::Warmup {
                let welcome = packets.recv().await.context("Missing warmup welcome")?;
                let mut reader = BitReader::new(&welcome);
                assert_eq!(reader.read_u16()?, zc_core::zeepnet::CUSTOM_CHAT_MESSAGE);
                assert_eq!(reader.read_u64()?, player().steam_id);
                let text = reader.read_string(4096)?;
                assert!(text.contains("Zeepkist Super League is starting in"));
                assert!(text.contains("Stay in this room."));
                assert!(!text.contains("Good luck"));
                assert!(!text.contains("has started"));
            }
            session
                .shared
                .saved
                .lock()
                .await
                .pending
                .push(PendingFinish {
                    steam_id: player().steam_id,
                    name: "retained".into(),
                    level_id: 7,
                    timeslot: 1,
                    microseconds: 1000000,
                    received_at_ms: 1,
                });
            if !cached {
                session
                    .context
                    .dispatch(
                        session.as_ref(),
                        &GameHostPacket::LevelRequest {
                            uid: level.level.uid.clone(),
                            workshop_id: level.level.workshop_id,
                            name: level.level.name.clone(),
                        },
                    )
                    .await?;
                assert!(
                    !task.is_finished(),
                    "upload alone must not complete transition"
                );
            }
            session
                .context
                .dispatch(session.as_ref(), &game_properties(&level, 10.0))
                .await?;
            assert!(!task.is_finished());
            session
                .context
                .dispatch(session.as_ref(), &GameHostPacket::GameState(0))
                .await?;
            Ok::<_, anyhow::Error>(())
        })
        .await??;
        task.await??;
        assert_eq!(session.live.lock().await.active, Some((phase, 0, 0)));
        assert_eq!(session.shared.saved.lock().await.pending.len(), 1);
        assert_eq!(session.context.players().await.len(), 1);
        let mut timing = None;
        while let Ok(packet) = packets.try_recv() {
            if u16::from_le_bytes([packet[0], packet[1]]) == zc_core::zeepnet::CHANGE_LOBBY_PLAYLIST
                && let GameHostPacket::Playlist(playlist) =
                    zc_core::zeepnet::parse_game_host_packet(&packet)?
            {
                timing = Some(playlist.round_time);
            }
        }
        let round_time = timing.context("Missing host playlist timing update")?;
        if phase == Phase::Practice {
            assert_eq!(round_time, 300.0);
        } else {
            // Load timestamp 10 and server clock 1000: 990 seconds already elapsed.
            // Timer's end, not time since activation began, matches fixed deadline.
            let expected = (deadline - jiff::Timestamp::now().as_second()) as f64 + 990.0;
            assert!((round_time - expected).abs() < 2.0);
        }
    }
    Ok(())
}

#[tokio::test]
async fn same_level_phase_change_requires_fresh_server_confirmation() -> Result<()> {
    let (signal, mut packets) = tokio::sync::mpsc::unbounded_channel();
    let session = offline_session(Arc::new(FnPacketSender(move |packet| {
        let signal = signal.clone();
        async move {
            signal.send(packet)?;
            Ok(())
        }
    })))?;
    for (phase, loaded_at) in [(Phase::Practice, 10.0), (Phase::Tournament, 11.0)] {
        // Practice and tournament deliberately share this level.
        let transition = prepared_transition(&session, phase).await?;
        let level = transition.level.clone();
        let task = tokio::spawn({
            let session = session.clone();
            async move { run_transition(&session, transition).await }
        });
        tokio::time::timeout(Duration::from_secs(2), async {
            wait_for_skip(&mut packets).await;
            session
                .context
                .dispatch(session.as_ref(), &GameHostPacket::GameState(2))
                .await?;
            if phase == Phase::Tournament {
                session
                    .context
                    .dispatch(session.as_ref(), &game_properties(&level, 10.0))
                    .await?;
                session
                    .context
                    .dispatch(session.as_ref(), &GameHostPacket::GameState(0))
                    .await?;
                assert!(!task.is_finished());
            }
            session
                .context
                .dispatch(session.as_ref(), &game_properties(&level, loaded_at))
                .await?;
            session
                .context
                .dispatch(session.as_ref(), &GameHostPacket::GameState(0))
                .await?;
            Ok::<_, anyhow::Error>(())
        })
        .await??;
        task.await??;
    }
    Ok(())
}

#[tokio::test(start_paused = true)]
async fn transition_retries_once_then_propagates_terminal_failure() -> Result<()> {
    let (signal, mut packets) = tokio::sync::mpsc::unbounded_channel();
    let session = offline_session(Arc::new(FnPacketSender(move |packet| {
        let signal = signal.clone();
        async move {
            signal.send(packet)?;
            Ok(())
        }
    })))?;
    for attempt in 1..=2 {
        let transition = prepared_transition(&session, Phase::Tournament).await?;
        let task = tokio::spawn({
            let session = session.clone();
            async move { run_transition(&session, transition).await }
        });
        wait_for_skip(&mut packets).await;
        tokio::time::advance(Duration::from_secs(30)).await;
        let error = task.await?.unwrap_err();
        if attempt == 1 {
            assert!(error.is::<ActivationTimeout>());
        } else {
            assert!(error.is::<TransitionFailed>());
        }
        assert!(session.live.lock().await.ready.is_none());
    }
    Ok(())
}

#[tokio::test(start_paused = true)]
async fn timeout_retry_can_succeed_and_resets_failure_count() -> Result<()> {
    let (signal, mut packets) = tokio::sync::mpsc::unbounded_channel();
    let session = offline_session(Arc::new(FnPacketSender(move |packet| {
        let signal = signal.clone();
        async move {
            signal.send(packet)?;
            Ok(())
        }
    })))?;
    let transition = prepared_transition(&session, Phase::Warmup).await?;
    let task = tokio::spawn({
        let session = session.clone();
        async move { run_transition(&session, transition).await }
    });
    wait_for_skip(&mut packets).await;
    tokio::time::advance(Duration::from_secs(30)).await;
    assert!(task.await?.unwrap_err().is::<ActivationTimeout>());
    let transition = prepared_transition(&session, Phase::Warmup).await?;
    let level = transition.level.clone();
    let task = tokio::spawn({
        let session = session.clone();
        async move { run_transition(&session, transition).await }
    });
    wait_for_skip(&mut packets).await;
    session
        .context
        .dispatch(session.as_ref(), &game_properties(&level, 10.0))
        .await?;
    session
        .context
        .dispatch(session.as_ref(), &GameHostPacket::GameState(0))
        .await?;
    task.await??;
    assert!(session.live.lock().await.failed_activation.is_none());
    Ok(())
}

#[tokio::test]
async fn transition_send_failure_propagates_and_does_not_commit() -> Result<()> {
    let session = offline_session(Arc::new(FnPacketSender(|_| async {
        anyhow::bail!("fake send failure")
    })))?;
    let transition = prepared_transition(&session, Phase::Warmup).await?;
    assert!(
        run_transition(&session, transition)
            .await
            .unwrap_err()
            .is::<TransitionFailed>()
    );
    assert!(session.live.lock().await.ready.is_none());
    assert!(session.live.lock().await.active.is_none());
    Ok(())
}

#[tokio::test]
async fn transition_with_elapsed_deadline_does_not_send_or_commit() -> Result<()> {
    let sent = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let count = sent.clone();
    let session = offline_session(Arc::new(FnPacketSender(move |_| {
        count.fetch_add(1, Ordering::Relaxed);
        async { Ok(()) }
    })))?;
    let mut transition = prepared_transition(&session, Phase::Tournament).await?;
    transition.deadline = jiff::Timestamp::now().as_second() - 1;
    assert!(
        run_transition(&session, transition)
            .await
            .unwrap_err()
            .is::<TransitionExpired>()
    );
    assert_eq!(sent.load(Ordering::Relaxed), 0);
    assert!(session.live.lock().await.ready.is_none());
    Ok(())
}

#[tokio::test]
async fn retired_generation_or_lost_authority_cannot_commit_confirmed_transition() -> Result<()> {
    for lost_authority in [false, true] {
        let (signal, mut packets) = tokio::sync::mpsc::unbounded_channel();
        let session = offline_session(Arc::new(FnPacketSender(move |packet| {
            let signal = signal.clone();
            async move {
                signal.send(packet)?;
                Ok(())
            }
        })))?;
        let transition = prepared_transition(&session, Phase::Tournament).await?;
        let level = transition.level.clone();
        let task = tokio::spawn({
            let session = session.clone();
            async move { run_transition(&session, transition).await }
        });
        tokio::time::timeout(Duration::from_secs(2), async {
            wait_for_skip(&mut packets).await;
            if lost_authority {
                session.context.test_authority(false);
            } else {
                session.live.lock().await.generation += 1;
            }
            session
                .context
                .dispatch(session.as_ref(), &game_properties(&level, 10.0))
                .await?;
            session
                .context
                .dispatch(session.as_ref(), &GameHostPacket::GameState(0))
                .await?;
            Ok::<_, anyhow::Error>(())
        })
        .await??;
        assert!(task.await?.unwrap_err().is::<TransitionFailed>());
        assert!(session.live.lock().await.ready.is_none());
        assert!(session.live.lock().await.active.is_none());
    }
    Ok(())
}

type DispatchTarget = Arc<Mutex<Option<Arc<ZslSession>>>>;

async fn recover_phase(
    profile: &ZslProfile,
    context: &RoomContext,
    target: &DispatchTarget,
) -> Result<()> {
    let shared = &profile.shared;
    let event = shared.event()?;
    let snapshot = {
        let mut saved = shared.saved.lock().await;
        // Test advances scheduled timestamps instead of waiting hours.
        saved.starts = [Some(event.first), Some(event.second)];
        shared.save(&saved).await?;
        saved.clone()
    };
    shared
        .database
        .release_zsl_event(shared.round_id, &shared.owner)
        .await?;
    let restarted = ZslProfile::new(
        shared.tournament.clone(),
        shared.practice.clone(),
        shared.database.clone(),
        shared.storage.clone(),
    )?;
    *restarted.shared.practice_asset.lock().await = shared.practice_asset.lock().await.clone();
    assert!(restarted.prepare().await?.is_some());
    let session = Arc::new(ZslSession {
        shared: restarted.shared.clone(),
        context: context.clone(),
        board: Mutex::new(context.leaderboard()),
        live: Mutex::new(LiveState {
            last_assets: Some(Instant::now()),
            ..Default::default()
        }),
        stopped: AtomicBool::new(false),
        wake: Notify::new(),
    });
    let previous = target.lock().await.replace(session.clone());
    tokio::time::timeout(Duration::from_secs(5), session.tick()).await??;
    *target.lock().await = previous;
    let recovered = restarted.shared.saved.lock().await.clone();
    assert_eq!(
        recovered.phase,
        if snapshot.phase == Phase::Retired {
            Phase::Practice
        } else {
            snapshot.phase
        }
    );
    assert_eq!(recovered.index, snapshot.index);
    assert_eq!(recovered.progress, snapshot.progress);
    if snapshot.phase != Phase::Retired {
        assert_eq!(recovered.deadline, snapshot.deadline);
    }
    assert_eq!(context.players().await.len(), 1);
    assert_eq!(
        shared
            .database
            .managed_lobby_join_id("practice")
            .await?
            .as_deref(),
        Some("unchanged-join-id")
    );
    restarted.stop().await?;
    let stored = shared
        .database
        .claim_zsl_event(shared.round_id, &shared.owner)
        .await?
        .context("recovery lease unavailable")?;
    *shared.saved.lock().await = serde_json::from_value(stored)?;
    Ok(())
}

#[tokio::test]
#[ignore = "requires empty localhost PostgreSQL database named zsl_lobby_test"]
async fn seamless_handover_break_rejoin_return_and_terminal_restart() -> Result<()> {
    let url = std::env::var("ZC_ZSL_LOBBY_TEST_DATABASE_URL")?;
    let parsed = reqwest::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/zsl_lobby_test",
        "Dedicated disposable database required"
    );
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move {
        let _ = connection.await;
    });
    ensure!(
        client
            .query_one("SELECT to_regclass('public.zsl_round') IS NULL", &[])
            .await?
            .get::<_, bool>(0),
        "Empty test database required"
    );
    client
        .batch_execute(include_str!(
            "../../../../database/tests/fixtures/zsl_tournament.sql"
        ))
        .await?;
    client
        .batch_execute(include_str!(
            "../../../../database/migrations/20261010120000_zsl_tournament/up.sql"
        ))
        .await?;
    client.batch_execute("INSERT INTO zsl_points_structure VALUES(1,'Test',ARRAY[100,80,60],5,4); INSERT INTO zsl_season(id,id_points_structure,name) VALUES(1,1,'Season 1'); INSERT INTO zsl_round(id,id_season,name,round,event_date,event2_date) VALUES(7,1,'Test Round',1,now()+interval '1 day',now()+interval '2 days'); INSERT INTO level(id,hash,xx_hash) SELECT i,'legacy-'||i,lpad(to_hex(i),32,'0') FROM generate_series(1,15) i;").await?;
    let database = Database::connect(&url, 5).await?;
    let storage: Arc<dyn ObjectStorage> = Arc::new(TestStorage);
    let profile = ZslProfile::new(
        config(true)?,
        Some(config(false)?),
        database.clone(),
        storage.clone(),
    )?;
    let shared = profile.shared.clone();
    database
        .claim_zsl_event(7, &shared.owner)
        .await?
        .context("claim failed")?;
    database
        .set_managed_lobby_join_id("practice", "unchanged-join-id")
        .await?;
    let tournament = bundle(7, false);
    let warmup = bundle(7, true);
    {
        let mut saved = shared.saved.lock().await;
        saved.pinned = Some(tournament.clone());
        saved.warmup = Some(warmup.clone());
        shared.save(&saved).await?;
    }
    *shared.practice_asset.lock().await = Some(pinned_asset(tournament.clone(), storage.clone())?);
    let now = jiff::Timestamp::now().as_second();
    *shared.event.write().unwrap() = Some(ZslEvent {
        name: "Test Round".into(),
        round: 1,
        season: 1,
        first: now + 1201,
        second: now + 20000,
        points: vec![100, 80, 60],
        minimum_points: 5,
        best_of: 4,
    });
    let sent = Arc::new(Mutex::new(Vec::<Vec<u8>>::new()));
    let (signal, mut packets) = tokio::sync::mpsc::unbounded_channel();
    let sender = Arc::new(FnPacketSender({
        let sent = sent.clone();
        move |packet: Vec<u8>| {
            let sent = sent.clone();
            let signal = signal.clone();
            async move {
                sent.lock().await.push(packet.clone());
                signal.send(packet).context("test driver stopped")?;
                Ok(())
            }
        }
    }));
    let mut context = RoomContext::for_test(sender, 1)?;
    context.test_remote_time(1000.0);
    context
        .observe_test_packet(&GameHostPacket::PlayerConnected {
            player: player(),
            is_host: false,
            has_host_powers: false,
        })
        .await;
    let driver_context = context.clone();
    let driver_storage = storage.clone();
    let target: DispatchTarget = Arc::new(Mutex::new(None));
    let driver_target = target.clone();
    let driver = tokio::spawn(async move {
        while let Some(packet) = packets.recv().await {
            let mut reader = BitReader::new(&packet);
            if reader.read_u16()? != SKIP_TO_LEVEL {
                continue;
            }
            let uid = reader.read_string(4096)?;
            let workshop = reader.read_u64()?;
            let source = if uid.starts_with("warmup") {
                warmup.clone()
            } else {
                tournament.clone()
            };
            let asset = pinned_asset(source, driver_storage.clone())?;
            let prepared = asset
                .load(&uid, workshop)
                .await?
                .context("test level missing")?;
            let session = driver_target
                .lock()
                .await
                .clone()
                .context("Missing dispatch target")?;
            // Echoes and unrelated traffic arrive before the upload request in real rooms.
            for packet in [
                GameHostPacket::Playlist(zc_core::zeepnet::OnlinePlaylist {
                    levels: vec![],
                    current_index: 0,
                    next_index: 0,
                    is_random: false,
                    original_playlist_length: 0,
                    round_time: 420.0,
                    was_synced: true,
                }),
                GameHostPacket::GameState(2),
                GameHostPacket::Leaderboard {
                    packet_type: 0,
                    times: vec![],
                    overrides: vec![],
                },
                GameHostPacket::Chat {
                    message: "handover".into(),
                    sender_uid: player().uid,
                },
                GameHostPacket::LevelRequest {
                    name: prepared.level.name,
                    uid: uid.clone(),
                    workshop_id: workshop,
                },
                GameHostPacket::GameProperties {
                    uid,
                    workshop_id: workshop,
                    level_loaded_at: driver_context.remote_now().unwrap(),
                    round_time: 420.0,
                },
                GameHostPacket::GameState(0),
            ] {
                driver_context.dispatch(session.as_ref(), &packet).await?;
            }
        }
        Ok::<_, anyhow::Error>(())
    });
    let session = Arc::new(ZslSession {
        shared: shared.clone(),
        board: Mutex::new(context.leaderboard()),
        context: context.clone(),
        live: Mutex::new(LiveState {
            last_assets: Some(Instant::now()),
            ..Default::default()
        }),
        stopped: AtomicBool::new(false),
        wake: Notify::new(),
    });
    *target.lock().await = Some(session.clone());
    session
        .board
        .lock()
        .await
        .observe(&GameHostPacket::PlayerConnected {
            player: player(),
            is_host: false,
            has_host_powers: false,
        });
    tokio::time::timeout(Duration::from_secs(5), session.tick()).await??;
    assert_eq!(shared.saved.lock().await.phase, Phase::Practice);
    recover_phase(&profile, &context, &target).await?;
    shared.event.write().unwrap().as_mut().unwrap().first = now + 1200;
    let missing = {
        let mut saved = shared.saved.lock().await;
        (saved.pinned.take(), saved.warmup.take())
    };
    tokio::time::timeout(Duration::from_secs(5), session.tick()).await??;
    assert_eq!(shared.saved.lock().await.phase, Phase::Practice);
    assert!(shared.saved.lock().await.announcements.contains("delay:0"));
    assert_eq!(context.players().await.len(), 1);
    {
        let mut saved = shared.saved.lock().await;
        (saved.pinned, saved.warmup) = missing;
    }
    tokio::time::timeout(Duration::from_secs(5), session.tick()).await??;
    assert_eq!(shared.saved.lock().await.phase, Phase::Warmup);
    recover_phase(&profile, &context, &target).await?;
    shared.event.write().unwrap().as_mut().unwrap().first = now + 1080;
    session.tick().await?;
    assert!(
        shared
            .saved
            .lock()
            .await
            .announcements
            .contains("countdown:0:1")
    );
    shared.event.write().unwrap().as_mut().unwrap().first = now + 300;
    tokio::time::timeout(Duration::from_secs(5), session.tick()).await??;
    assert!(shared.saved.lock().await.announcements.contains("staged:0"));
    shared.event.write().unwrap().as_mut().unwrap().first = now;
    tokio::time::timeout(Duration::from_secs(5), session.tick()).await??;
    let finish = GameHostPacket::PlayerResult {
        uid: 42,
        has_result: true,
        level_uid: "zsl-0".into(),
        time: 25.123456,
        checkpoints: 0,
    };
    session
        .on_packet(&GameHostPacket::PlayerResult {
            uid: 42,
            has_result: true,
            level_uid: "warmup-3".into(),
            time: 1.0,
            checkpoints: 0,
        })
        .await?;
    assert!(database.zsl_finishes(7).await?.is_empty());
    session.on_packet(&finish).await?;
    session
        .on_packet(&GameHostPacket::PlayerResult {
            uid: 42,
            has_result: false,
            level_uid: "zsl-0".into(),
            time: 0.0,
            checkpoints: 0,
        })
        .await?;
    context
        .observe_test_packet(&GameHostPacket::PlayerDisconnected(42))
        .await;
    session
        .on_packet(&GameHostPacket::PlayerDisconnected(42))
        .await?;
    assert_eq!(database.zsl_finishes(7).await?.len(), 1);
    context
        .observe_test_packet(&GameHostPacket::PlayerConnected {
            player: player(),
            is_host: false,
            has_host_powers: false,
        })
        .await;
    session
        .on_packet(&GameHostPacket::PlayerConnected {
            player: player(),
            is_host: false,
            has_host_powers: false,
        })
        .await?;
    session.tick().await?;
    assert_eq!(
        session
            .live
            .lock()
            .await
            .records
            .get(&player().steam_id)
            .copied(),
        normalized_time(25.123456)
    );
    recover_phase(&profile, &context, &target).await?;
    shared.saved.lock().await.deadline = now + 40;
    session.tick().await?;
    assert!(
        shared
            .saved
            .lock()
            .await
            .announcements
            .contains("reset:0:0")
    );
    shared.saved.lock().await.deadline = now + 5;
    session.tick().await?;
    assert!(shared.saved.lock().await.announcements.contains("next:0:0"));
    assert!(
        sent.lock()
            .await
            .iter()
            .any(|packet| u16::from_le_bytes([packet[0], packet[1]])
                == zc_core::zeepnet::CUSTOM_LEADERBOARD)
    );
    shared.event.write().unwrap().as_mut().unwrap().first = now - 7 * 420;
    tokio::time::timeout(Duration::from_secs(5), session.tick()).await??;
    assert!(session.live.lock().await.current_level_id.is_none());
    recover_phase(&profile, &context, &target).await?;
    assert!(
        shared
            .saved
            .lock()
            .await
            .announcements
            .contains("break:0:7")
    );
    session
        .on_packet(&GameHostPacket::PlayerResult {
            uid: 42,
            has_result: true,
            level_uid: "zsl-7".into(),
            time: 1.0,
            checkpoints: 0,
        })
        .await?;
    assert_eq!(database.zsl_finishes(7).await?.len(), 1);
    let saved = shared.saved.lock().await;
    assert!(zsl_messages::progress(saved.pinned.as_ref().unwrap(), 7).contains("[BREAK]"));
    drop(saved);
    shared.event.write().unwrap().as_mut().unwrap().first = now - 15 * 420;
    tokio::time::timeout(Duration::from_secs(5), session.tick()).await??;
    assert!(shared.saved.lock().await.completed[0]);
    assert_eq!(shared.saved.lock().await.phase, Phase::Practice);
    assert!(profile.close_at().is_none());
    // A previous standalone tournament controller retired Timeslot 1. Reloading
    // a paired config must reopen practice without replaying that tournament.
    {
        let mut saved = shared.saved.lock().await;
        saved.retired[0] = true;
        saved.phase = Phase::Retired;
    }
    recover_phase(&profile, &context, &target).await?;
    assert!(shared.saved.lock().await.completed[0]);
    assert!(!shared.saved.lock().await.completed[1]);
    assert_eq!(shared.saved.lock().await.phase, Phase::Practice);
    assert_eq!(
        database.managed_lobby_join_id("practice").await?.as_deref(),
        Some("unchanged-join-id")
    );
    shared.event.write().unwrap().as_mut().unwrap().second = now + 1200;
    tokio::time::timeout(Duration::from_secs(5), session.tick()).await??;
    shared.event.write().unwrap().as_mut().unwrap().second = now;
    tokio::time::timeout(Duration::from_secs(5), session.tick()).await??;
    session
        .on_packet(&GameHostPacket::PlayerResult {
            uid: 42,
            has_result: true,
            level_uid: "zsl-0".into(),
            time: 20.0,
            checkpoints: 0,
        })
        .await?;
    assert_eq!(database.zsl_finishes(7).await?[0].timeslot, 1);
    shared.event.write().unwrap().as_mut().unwrap().second = now - 15 * 420;
    tokio::time::timeout(Duration::from_secs(5), session.tick()).await??;
    assert!(shared.saved.lock().await.completed[1]);
    assert!(profile.close_at().is_some());
    assert!(
        sent.lock()
            .await
            .iter()
            .all(|packet| u16::from_le_bytes([packet[0], packet[1]]) != KICK_PLAYER)
    );
    assert_eq!(context.players().await.len(), 1);
    profile.scheduled_closed().await?;
    assert!(database.managed_lobby_join_id("practice").await?.is_none());
    profile.stop().await?;
    let restarted = ZslProfile::new(
        config(true)?,
        Some(config(false)?),
        database.clone(),
        storage.clone(),
    )?;
    assert!(restarted.prepare().await?.is_none());
    restarted.stop().await?;
    client.batch_execute("INSERT INTO zsl_round(id,id_season,name,round,event_date,event2_date) VALUES(8,1,'Failed Round',2,now()-interval '1 second',now()+interval '1 day')").await?;
    let mut tournament_config = config(true)?;
    let RoomProfile::Zsl { round_id, .. } = &mut tournament_config.profile else {
        unreachable!()
    };
    *round_id = 8;
    let failed_profile = ZslProfile::new(
        tournament_config.clone(),
        None,
        database.clone(),
        storage.clone(),
    )?;
    database
        .claim_zsl_event(8, &failed_profile.shared.owner)
        .await?
        .context("claim failed")?;
    *failed_profile.shared.event.write().unwrap() = Some(database.zsl_event(8).await?);
    let failed_session = ZslSession {
        shared: failed_profile.shared.clone(),
        context: context.clone(),
        board: Mutex::new(context.leaderboard()),
        live: Mutex::new(LiveState {
            last_assets: Some(Instant::now()),
            ..Default::default()
        }),
        stopped: AtomicBool::new(false),
        wake: Notify::new(),
    };
    failed_session.tick().await?;
    assert!(failed_profile.shared.saved.lock().await.failed[0]);
    assert!(failed_profile.close_at().is_some());
    assert_eq!(context.players().await.len(), 1);
    failed_profile.scheduled_closed().await?;
    failed_profile.stop().await?;
    let failed_restart = ZslProfile::new(tournament_config, None, database, storage)?;
    assert!(failed_restart.prepare().await?.is_none());
    driver.abort();
    Ok(())
}
