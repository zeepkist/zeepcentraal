use super::*;
use crate::chat::FnPacketSender;
use crate::transfer::ActivationTimeout;
use zc_core::{
    object_storage::DownloadConstraints,
    practice::{PracticeLevel, PracticePayload},
    zeepnet::{BitReader, GameHostPlayer, KICK_PLAYER, SKIP_TO_LEVEL},
};

struct TestStorage;
const VERIFIED_PRACTICE_DIGEST: &str =
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

#[async_trait::async_trait]
impl ObjectStorage for TestStorage {
    async fn upload(&self, _: &str, _: Vec<u8>, _: &str) -> Result<()> {
        Ok(())
    }
    async fn download(&self, _: &str, constraints: DownloadConstraints<'_>) -> Result<Vec<u8>> {
        if constraints.expected_sha256 == Some(VERIFIED_PRACTICE_DIGEST) {
            zc_core::zeepnet::encode_zeepkist_level_payload("Practice fixture", true)
        } else {
            Ok(vec![1, 2, 3])
        }
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

#[tokio::test]
async fn host_reports_each_undecodable_warmup_payload() -> Result<()> {
    let asset = pinned_asset(bundle(7, true), Arc::new(TestStorage))?;
    let failures = verify_payloads(&asset).await;
    assert_eq!(failures.len(), 4);
    assert_eq!(failures[0]["uid"], "warmup-0");
    assert_eq!(failures[3]["position"], 4);
    assert_eq!(failures[3]["workshopId"], "1");
    Ok(())
}
fn config(tournament: bool) -> Result<ManagedRoomConfig> {
    let (key, profile, playlist, seconds) = if tournament {
        ("zsl", "zsl", "final", 420)
    } else {
        ("practice", "zsl-practice", "practice", 900)
    };
    Ok(crate::config::LobbyHostFileConfig::parse(&format!(
        r#"{{"version":1,"rooms":[{{"key":"{key}","profile":{{"type":"{profile}","roundId":7,"playlist":"https://example.com/{playlist}.zeeplist"}},"room":{{"name":"ZSL","isPublic":true,"maxPlayers":64}},"roundTimeSeconds":{seconds},"assetPollMs":30000,"reconnectMaxMs":60000,"messageRefreshMs":60000}}]}}"#
    ))?.rooms.remove(0))
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

#[tokio::test]
async fn receipt_scope_survives_deadline_transition_and_session_retirement() -> Result<()> {
    let session = offline_session(Arc::new(FnPacketSender(|_| async { Ok(()) })))?;
    session
        .context
        .observe_test_packet(&GameHostPacket::PlayerConnected {
            player: player(),
            is_host: false,
            has_host_powers: false,
        })
        .await;
    let deadline = jiff::Timestamp::now().as_second() + 10;
    let mut state = SavedState {
        phase: Phase::Tournament,
        timeslot: 0,
        deadline,
        ..Default::default()
    };
    let live = LiveState {
        generation: 7,
        current_level_id: Some(42),
        ready: Some(("zsl-0".into(), 1)),
        ..Default::default()
    };
    *session.shared.saved.lock().await = state.clone();
    *session.live.lock().await = live.clone();
    session.scoring_scope(&state, &live);
    let result = || GameHostPacket::PlayerResult {
        uid: 42,
        has_result: true,
        level_uid: "zsl-0".into(),
        time: 12.5,
        checkpoints: 0,
    };
    let accepted = session
        .context
        .receive_for_test(
            session.as_ref(),
            result(),
            jiff::Timestamp::from_millisecond(deadline * 1000 - 1)?,
        )
        .await?;
    let captured = accepted
        .captured
        .as_ref()
        .unwrap()
        .downcast_ref::<ScoringScope>()
        .unwrap();
    assert_eq!(captured.generation, 7);
    assert_eq!(captured.timeslot, 0);
    assert_eq!(captured.level_id, Some(42));
    let rejected = session
        .context
        .receive_for_test(
            session.as_ref(),
            result(),
            jiff::Timestamp::from_second(deadline)?,
        )
        .await?;
    assert!(rejected.captured.is_none());
    state.timeslot = 1;
    state.deadline = deadline + 420;
    let next = LiveState {
        generation: 8,
        current_level_id: Some(43),
        ready: Some(("zsl-1".into(), 1)),
        ..Default::default()
    };
    *session.shared.saved.lock().await = state.clone();
    *session.live.lock().await = next.clone();
    session.scoring_scope(&state, &next);
    session.on_received(&accepted).await?;
    let state = session.shared.saved.lock().await;
    assert_eq!(state.pending.len(), 1);
    assert_eq!(state.pending[0].level_id, 42);
    assert_eq!(state.pending[0].timeslot, 1);
    assert_eq!(state.pending[0].received_at_ms, deadline * 1000 - 1);
    drop(state);
    assert!(session.live.lock().await.records.is_empty());
    session.stop().await;
    assert_eq!(session.shared.saved.lock().await.pending.len(), 1);
    assert!(session.scoring.read().unwrap().is_none());
    Ok(())
}

#[tokio::test]
async fn receipt_admission_needs_confirmed_playing_and_preserves_finishes_during_memory_locks()
-> Result<()> {
    let session = offline_session(Arc::new(FnPacketSender(|_| async { Ok(()) })))?;
    let state = SavedState {
        phase: Phase::Tournament,
        deadline: jiff::Timestamp::now().as_second() + 60,
        ..Default::default()
    };
    let live = LiveState {
        generation: 1,
        current_level_id: Some(42),
        ready: None,
        ..Default::default()
    };
    session.scoring_scope(&state, &live);
    let result = GameHostPacket::PlayerResult {
        uid: 42,
        has_result: true,
        level_uid: "zsl-0".into(),
        time: 12.5,
        checkpoints: 0,
    };
    assert!(
        session
            .capture_receipt(&result, jiff::Timestamp::now(), &[player()])
            .is_none()
    );
    let transition = prepared_transition(&session, Phase::Tournament).await?;
    *session.scoring.write().unwrap() = Some(ScoringScope {
        phase: Phase::Tournament,
        timeslot: 0,
        level_id: Some(42),
        identity: Some(("zsl-0".into(), 1)),
        generation: 1,
        ready: false,
        deadline: state.deadline * 1000,
        index: None,
        round: None,
        locked_players: HashSet::new(),
    });
    session.confirm_receipt(&TransferEvent {
        kind: TransferEventKind::Uploaded,
        level: transition.level.clone(),
    });
    assert!(
        session
            .capture_receipt(&result, jiff::Timestamp::now(), &[player()])
            .is_none()
    );
    session.confirm_receipt(&TransferEvent {
        kind: TransferEventKind::Ready,
        level: transition.level,
    });
    let _saved = session.shared.saved.lock().await;
    let _live = session.live.lock().await;
    assert!(
        session
            .capture_receipt(&result, jiff::Timestamp::now(), &[player()])
            .is_some()
    );
    assert_eq!(session.shared.incoming.lock().unwrap().len(), 1);
    Ok(())
}

#[tokio::test]
async fn timeslot_two_rejects_locked_timeslot_one_finish_and_accepts_dnf_player() -> Result<()> {
    let session = offline_session(Arc::new(FnPacketSender(|_| async { Ok(()) })))?;
    let mut scope = ScoringScope {
        phase: Phase::Tournament,
        timeslot: 1,
        level_id: Some(42),
        identity: Some(("zsl-0".into(), 1)),
        generation: 2,
        ready: true,
        deadline: jiff::Timestamp::now().as_millisecond() + 60_000,
        index: None,
        round: None,
        locked_players: HashSet::from([player().steam_id]),
    };
    *session.scoring.write().unwrap() = Some(scope.clone());
    let packet = GameHostPacket::PlayerResult {
        uid: 42,
        has_result: true,
        level_uid: "zsl-0".into(),
        time: 1.0,
        checkpoints: 0,
    };
    assert!(
        session
            .capture_receipt(&packet, jiff::Timestamp::now(), &[player()])
            .is_none()
    );
    assert!(!session.preserve_native_finish(&packet, player().steam_id, jiff::Timestamp::now()));
    scope.locked_players.clear();
    *session.scoring.write().unwrap() = Some(scope);
    assert!(
        session
            .capture_receipt(&packet, jiff::Timestamp::now(), &[player()])
            .is_some()
    );
    assert!(session.preserve_native_finish(&packet, player().steam_id, jiff::Timestamp::now()));
    Ok(())
}

#[tokio::test]
async fn rejected_result_callbacks_never_wait_for_lifecycle_locks_or_database() -> Result<()> {
    let session = offline_session(Arc::new(FnPacketSender(|_| async { Ok(()) })))?;
    for has_result in [false, true] {
        let received = session
            .context
            .receive_for_test(
                session.as_ref(),
                GameHostPacket::PlayerResult {
                    uid: 42,
                    has_result,
                    level_uid: "invalid".into(),
                    time: 12.5,
                    checkpoints: 0,
                },
                jiff::Timestamp::now(),
            )
            .await?;
        assert!(received.captured.is_none());
        let _saved = session.shared.saved.lock().await;
        let _live = session.live.lock().await;
        tokio::time::timeout(Duration::from_millis(100), session.on_received(&received)).await??;
    }
    Ok(())
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
        scoring: RwLock::new(None),
        next_scoring: RwLock::new(None),
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
    live.round = None;
    live.next = None;
    live.ready = None;
    live.current_level_id = None;
    live.asset = None;
    let mut saved = state.clone();
    let mut current = live.clone();
    drop(live);
    drop(state);
    let outcome = session
        .execute_and_commit(&mut saved, &mut current, transition, false)
        .await;
    if session.live.lock().await.generation == current.generation {
        *session.live.lock().await = current;
    }
    outcome?;
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
        let seconds = transition.seconds;
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
                    zc_core::zeepnet::CHANGE_LOBBY_PLAYLIST => {
                        let GameHostPacket::Playlist(playlist) =
                            zc_core::zeepnet::parse_game_host_packet(&packet)?
                        else {
                            unreachable!()
                        };
                        assert_eq!(playlist.round_time, seconds);
                        assert_eq!(
                            playlist.levels.len(),
                            if phase == Phase::Warmup { 4 } else { 15 }
                        );
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
                assert!(text.contains("Tournament starts in"));
                assert!(text.contains("Stay in this room to join automatically."));
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
                    index: None,
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
    for attempt in 1..=3 {
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
        } else if attempt == 2 {
            assert!(error.is::<TransitionFailed>());
        } else {
            assert!(error.is::<TransitionUnavailable>());
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
    assert!(session.shared.recovery.lock().await.is_none());
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
            .to_string()
            .contains("fake send failure")
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
                session.context.test_ownership_loss().await;
            } else {
                session.live.lock().await.generation += 1;
            }
            if !lost_authority {
                session
                    .context
                    .dispatch(session.as_ref(), &game_properties(&level, 10.0))
                    .await?;
                session
                    .context
                    .dispatch(session.as_ref(), &GameHostPacket::GameState(0))
                    .await?;
            }
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

async fn delayed_finish_finalisation_barrier(
    session: Arc<ZslSession>,
    client: &tokio_postgres::Client,
    finish: &GameHostPacket,
) -> Result<()> {
    client
        .batch_execute(include_str!(
            "../../../tests/fixtures/zsl_profile/create_delay_test_finish.sql"
        ))
        .await?;
    let received = session
        .context
        .receive_for_test(session.as_ref(), finish.clone(), jiff::Timestamp::now())
        .await?;
    assert!(received.captured.is_some());
    let started = Instant::now();
    let finalising = tokio::spawn({
        let session = session.clone();
        async move {
            session
                .context
                .dispatch(session.as_ref(), &GameHostPacket::GameState(2))
                .await
        }
    });
    tokio::time::sleep(Duration::from_millis(30)).await;
    assert!(session.shared.saved.try_lock().is_ok());
    assert!(session.live.try_lock().is_ok());
    assert!(session.board.try_lock().is_ok());
    let late = session
        .context
        .receive_for_test(session.as_ref(), finish.clone(), jiff::Timestamp::now())
        .await?;
    assert!(late.captured.is_none());
    assert!(!finalising.is_finished());
    let rows: i64 = client
        .query_one(
            include_str!(
                "../../../tests/fixtures/zsl_profile/count_zsl_tournament_level_state.sql"
            ),
            &[],
        )
        .await?
        .get(0);
    assert_eq!(rows, 0);
    finalising.await??;
    assert!(started.elapsed() >= Duration::from_millis(150));
    let finishes = session.shared.database.zsl_finishes(7).await?;
    assert_eq!(finishes.len(), 1);
    assert!(finishes[0].finalised);
    assert!(session.shared.saved.lock().await.pending.is_empty());
    session.on_received(&received).await?;
    client
        .batch_execute(include_str!(
            "../../../tests/fixtures/zsl_profile/drop_delay_test_finish.sql"
        ))
        .await?;
    Ok(())
}

async fn recover_phase(
    profile: &ZslProfile,
    context: &RoomContext,
    target: &DispatchTarget,
) -> Result<()> {
    let player_count = context.players().await.len();
    let shared = &profile.shared;
    let event = shared.event()?;
    let snapshot = {
        let mut saved = shared.saved.lock().await;
        // Test advances scheduled timestamps instead of waiting hours.
        saved.starts = [Some(event.first), Some(event.second)];
        let snapshot = saved.clone();
        drop(saved);
        shared.save(&snapshot).await?;
        snapshot
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
        scoring: RwLock::new(None),
        next_scoring: RwLock::new(None),
        live: Mutex::new(LiveState::default()),
        stopped: AtomicBool::new(false),
        wake: Notify::new(),
    });
    let previous = target.lock().await.replace(session.clone());
    tokio::time::timeout(Duration::from_secs(5), session.tick())
        .await
        .context("ZSL test activation timed out")??;
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
        assert_eq!(recovered.loaded_at, snapshot.loaded_at);
        assert_eq!(recovered.deadline_ms, snapshot.deadline_ms);
    }
    assert_eq!(context.players().await.len(), player_count);
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
    let mut selections = shared.selections.lock().await;
    if selections.tournament.is_none() {
        selections.tournament = restarted.shared.selections.lock().await.tournament.clone();
    }
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
            .query_one(
                include_str!("../../../tests/fixtures/zsl_profile/to_regclass.sql"),
                &[]
            )
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
    client
        .batch_execute(include_str!(
            "../../../../database/migrations/20261122001000_zsl_admin/up.sql"
        ))
        .await?;
    client
        .batch_execute(include_str!(
            "../../../../database/migrations/20261122002000_zsl_practice_upload/up.sql"
        ))
        .await?;
    client
        .batch_execute(include_str!(
            "../../../tests/fixtures/zsl_profile/insert_zsl_points_structure.sql"
        ))
        .await?;
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
    let mut practice = tournament.clone();
    practice.playlist = zc_core::practice::practice_playlist_key(7);
    practice.round_length = Some(900);
    practice.levels.remove(7);
    let payload = zc_core::zeepnet::encode_zeepkist_level_payload("Practice fixture", true)?;
    for entry in &mut practice.levels {
        entry.sha256 = VERIFIED_PRACTICE_DIGEST.into();
        entry.object_key = format!("zsl-practice/payloads/{VERIFIED_PRACTICE_DIGEST}.gz");
        entry.byte_size = payload.len();
    }
    practice.validate()?;
    assert!(practice.validate_tournament().is_err());
    {
        let mut saved = shared.saved.lock().await;
        saved.pinned = Some(tournament.clone());
        saved.warmup = Some(warmup.clone());
        let snapshot = saved.clone();
        drop(saved);
        shared.save(&snapshot).await?;
    }
    let revision = database
        .request_zsl_playlist(42, 7, "practice", Some("{}".into()), None)
        .await?;
    let job = database
        .claim_zsl_playlist(revision)
        .await?
        .context("Missing practice preparation")?;
    database
        .finish_zsl_playlist(&job, Some(&practice), serde_json::json!([]))
        .await?;
    let assets = shared
        .practice_assets
        .as_ref()
        .context("Missing practice source")?;
    let SubmissionPlaylist::Ready(asset) = assets.refresh().await? else {
        anyhow::bail!("Practice playlist failed host verification");
    };
    assert_eq!(
        database.zsl_playlist_status(7).await?["playlists"][0]["verifiedRevision"],
        revision
    );
    *shared.practice_asset.lock().await = Some(asset);
    let replacement = database
        .request_zsl_playlist(42, 7, "practice", Some("{}".into()), None)
        .await?;
    let job = database
        .claim_zsl_playlist(replacement)
        .await?
        .context("Missing practice replacement")?;
    let mut broken = practice;
    broken.levels[0].sha256 = "b".repeat(64);
    broken.levels[0].object_key = format!("zsl-practice/payloads/{}.gz", broken.levels[0].sha256);
    database
        .finish_zsl_playlist(&job, Some(&broken), serde_json::json!([]))
        .await?;
    let SubmissionPlaylist::Ready(asset) = assets.refresh().await? else {
        anyhow::bail!("Failed replacement removed verified practice playlist");
    };
    assert_eq!(
        asset.digest,
        shared.practice_asset.lock().await.as_ref().unwrap().digest
    );
    let status = database.zsl_playlist_status(7).await?;
    assert_eq!(status["playlists"][0]["state"], "failed");
    assert_eq!(status["playlists"][0]["diagnostics"][0]["uid"], "zsl-0");
    let now = jiff::Timestamp::now().as_second();
    *shared.event.write().unwrap() = Some(ZslEvent {
        name: "Test Round".into(),
        round: 1,
        season: 1,
        first: now + 3600,
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
        let mut duration = 900.0;
        while let Some(packet) = packets.recv().await {
            let mut reader = BitReader::new(&packet);
            let id = reader.read_u16()?;
            if id == zc_core::zeepnet::CHANGE_LOBBY_PLAYLIST {
                duration = reader.read_f64()?;
            }
            if id != SKIP_TO_LEVEL {
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
                    round_time: duration,
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
        scoring: RwLock::new(None),
        next_scoring: RwLock::new(None),
        context: context.clone(),
        live: Mutex::new(LiveState::default()),
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
    tokio::time::timeout(Duration::from_secs(5), session.tick())
        .await
        .context("ZSL test activation timed out")??;
    assert_eq!(shared.saved.lock().await.phase, Phase::Practice);
    {
        let live = session.live.lock().await;
        let asset = live
            .asset
            .as_ref()
            .context("Practice playlist unavailable")?;
        assert_eq!(asset.playlist.levels.len(), 14);
        assert!(
            asset
                .playlist
                .levels
                .iter()
                .all(|level| level.uid != "zsl-7")
        );
    }
    recover_phase(&profile, &context, &target).await?;
    {
        let mut state = shared.saved.lock().await;
        state.warmup = None;
        state.warmups[0] = None;
    }
    shared.event.write().unwrap().as_mut().unwrap().first = now;
    session.tick().await?;
    assert_eq!(shared.saved.lock().await.phase, Phase::Practice);
    let mut loaded_at = 1013.0;
    let practice_seconds = shared.practice.as_ref().unwrap().round_time_seconds as f64;
    native_advance(&session, &sent, loaded_at, "zsl", 1, 7, practice_seconds).await?;
    assert_eq!(
        session.live.lock().await.active,
        Some((Phase::Practice, 0, 1))
    );

    let warmup_asset = pinned_asset(bundle(7, true), storage.clone())?;
    // Allocate the final track's scoring ID first. IDs do not encode playlist order.
    let final_level_id = session.scoring_level(&bundle(7, false), 14).await?.unwrap();
    let tournament_asset = pinned_asset(bundle(7, false), storage.clone())?;
    {
        let mut selections = shared.selections.lock().await;
        selections.warmup = Some(warmup_asset);
        selections.tournament = Some(tournament_asset);
    }
    let returning = player();
    let second_only = GameHostPlayer {
        uid: 43,
        steam_id: returning.steam_id + 1,
        ..returning.clone()
    };
    for slot in 0..2 {
        for index in 0..4 {
            loaded_at += 0.01;
            native_advance(&session, &sent, loaded_at, "warmup", index, 4, 300.0).await?;
            assert_eq!(
                session.live.lock().await.active,
                Some((Phase::Warmup, slot, index))
            );
        }
        if slot == 1 {
            context
                .dispatch(
                    session.as_ref(),
                    &GameHostPacket::PlayerDisconnected(returning.uid),
                )
                .await?;
        }
        for index in 0..15 {
            let first_packet = sent.lock().await.len();
            loaded_at += 0.01;
            native_advance(&session, &sent, loaded_at, "zsl", index, 15, 420.0).await?;
            assert_eq!(
                session.live.lock().await.active,
                Some((Phase::Tournament, slot, index))
            );
            let state = shared.saved.lock().await.clone();
            assert_eq!(state.progress[slot], index);
            assert!(state.deadline_ms.unwrap() > jiff::Timestamp::now().as_millisecond() + 418_000);

            if index == 0 {
                let finish = GameHostPacket::PlayerResult {
                    uid: 42,
                    has_result: true,
                    level_uid: "zsl-0".into(),
                    time: if slot == 0 { 25.123456 } else { 12.0 },
                    checkpoints: 0,
                };
                if slot == 0 {
                    assert!(session.live.lock().await.current_level_id.unwrap() > final_level_id);
                    // Timeslot 2 becomes eligible while Timeslot 1 still has 14 rounds left.
                    shared.event.write().unwrap().as_mut().unwrap().second = now;
                    session.tick().await?;
                    assert_eq!(shared.saved.lock().await.timeslot, 0);
                    delayed_finish_finalisation_barrier(session.clone(), &client, &finish).await?;
                } else {
                    for attempt in 0..2 {
                        let start = sent.lock().await.len();
                        context
                            .dispatch(
                                session.as_ref(),
                                &GameHostPacket::PlayerConnected {
                                    player: returning.clone(),
                                    is_host: false,
                                    has_host_powers: false,
                                },
                            )
                            .await?;
                        session.tick().await?;
                        assert_override_points(&sent, start, returning.steam_id, 100, Some(100))
                            .await?;
                        if attempt == 0 {
                            context
                                .dispatch(
                                    session.as_ref(),
                                    &GameHostPacket::PlayerDisconnected(returning.uid),
                                )
                                .await?;
                        }
                    }
                    context
                        .dispatch(
                            session.as_ref(),
                            &GameHostPacket::PlayerConnected {
                                player: second_only.clone(),
                                is_host: false,
                                has_host_powers: false,
                            },
                        )
                        .await?;
                    session.on_packet(&finish).await?;
                }
            }
            if index == 7 {
                assert!(session.live.lock().await.current_level_id.is_none());
                assert_ne!(
                    shared
                        .last_playable
                        .lock()
                        .await
                        .as_ref()
                        .unwrap()
                        .level
                        .uid,
                    "zsl-7"
                );
                recover_phase(&profile, &context, &target).await?;
                assert_override_points(&sent, first_packet, returning.steam_id, 700, None).await?;
                if slot == 1 {
                    assert_override_points(&sent, first_packet, second_only.steam_id, 560, None)
                        .await?;
                }
            } else if slot == 0 && index != 0 {
                session
                    .on_packet(&GameHostPacket::PlayerResult {
                        uid: returning.uid,
                        has_result: true,
                        level_uid: format!("zsl-{index}"),
                        time: 25.0,
                        checkpoints: 0,
                    })
                    .await?;
            } else if slot == 1 {
                let scoring_levels = (index + 1 - usize::from(index > 7)) as i32;
                session.tick().await?;
                assert_override_points(
                    &sent,
                    first_packet,
                    second_only.steam_id,
                    (scoring_levels - 1) * 80,
                    None,
                )
                .await?;
                let after_finish = sent.lock().await.len();
                session
                    .on_packet(&GameHostPacket::PlayerResult {
                        uid: second_only.uid,
                        has_result: true,
                        level_uid: format!("zsl-{index}"),
                        time: 35.0,
                        checkpoints: 0,
                    })
                    .await?;
                session.tick().await?;
                assert_override_points(
                    &sent,
                    first_packet,
                    returning.steam_id,
                    scoring_levels * 100,
                    Some(100),
                )
                .await?;
                assert_override_points(
                    &sent,
                    after_finish,
                    second_only.steam_id,
                    scoring_levels * 80,
                    Some(80),
                )
                .await?;
            }
        }
    }
    context
        .dispatch(session.as_ref(), &GameHostPacket::GameState(2))
        .await?;
    assert_eq!(shared.saved.lock().await.completed, [true, true]);
    assert!(profile.close_at().is_some());
    let finishes = database.zsl_finishes(7).await?;
    assert_eq!(finishes.len(), 28);
    assert!(finishes.iter().all(|finish| finish.finalised
        && finish.timeslot
            == if finish.steam_id == returning.steam_id as i64 {
                1
            } else {
                2
            }));
    let packets = sent.lock().await;
    assert_eq!(
        packets
            .iter()
            .filter(|packet| u16::from_le_bytes([packet[0], packet[1]]) == SKIP_TO_LEVEL)
            .count(),
        1
    );
    assert!(
        packets
            .iter()
            .all(|packet| u16::from_le_bytes([packet[0], packet[1]]) != KICK_PLAYER)
    );
    drop(packets);
    assert_eq!(context.players().await.len(), 2);
    profile.scheduled_closed().await?;
    assert!(database.managed_lobby_join_id("practice").await?.is_none());
    profile.stop().await?;
    let restarted = ZslProfile::new(config(true)?, Some(config(false)?), database, storage)?;
    assert!(restarted.prepare().await?.is_none());
    restarted.stop().await?;
    driver.abort();
    Ok(())
}

fn points_overrides(
    packets: &[Vec<u8>],
    steam_id: u64,
    forbid_time: bool,
) -> Result<Vec<LeaderboardOverrides>> {
    let mut overrides = Vec::new();
    for packet in packets {
        let mut reader = BitReader::new(packet);
        if reader.read_u16()? != zc_core::zeepnet::CUSTOM_LEADERBOARD
            || reader.read_u64()? != steam_id
        {
            continue;
        }
        reader.read_bool()?;
        reader.read_f32()?;
        reader.read_i32()?;
        reader.read_bool()?;
        if reader.read_bool()? {
            overrides.push(crate::leaderboard::read_test_overrides(packet)?.1);
        } else {
            assert!(!forbid_time, "Unexpected time packet for {steam_id}");
        }
    }
    Ok(overrides)
}

async fn assert_override_points(
    packets: &Mutex<Vec<Vec<u8>>>,
    start: usize,
    steam_id: u64,
    total: i32,
    current: Option<i32>,
) -> Result<()> {
    let packets = packets.lock().await;
    let overrides = points_overrides(&packets[start..], steam_id, current.is_none())?;
    let expected = (
        total.to_string(),
        current.map_or_else(|| " ".into(), |points| points.to_string()),
    );
    let mut awarded = overrides
        .iter()
        .filter(|item| !item.points.is_empty())
        .peekable();
    assert!(
        awarded.peek().is_some(),
        "No points override for {steam_id}"
    );
    assert!(
        awarded.all(
            |item| (&item.points, &item.points_won) == (&expected.0, &expected.1)
                && (current.is_some() || (item.time.is_empty() && item.position.is_empty()))
        ),
        "Unexpected overrides for {steam_id}: {overrides:?}"
    );
    Ok(())
}

async fn native_advance(
    session: &ZslSession,
    packets: &Mutex<Vec<Vec<u8>>>,
    loaded_at: f64,
    prefix: &str,
    index: usize,
    entries: usize,
    seconds: f64,
) -> Result<()> {
    use zc_core::zeepnet::{CHANGE_LOBBY_PLAYLIST, LEVEL_DATA, parse_game_host_packet};
    session
        .context
        .dispatch(session, &GameHostPacket::GameState(2))
        .await?;
    session
        .context
        .dispatch(
            session,
            &GameHostPacket::PlaylistIndex {
                current_index: 0,
                next_index: 0,
                select_next: true,
            },
        )
        .await?;
    let selection = packets
        .lock()
        .await
        .iter()
        .rev()
        .find(|packet| u16::from_le_bytes([packet[0], packet[1]]) == CHANGE_LOBBY_PLAYLIST)
        .cloned()
        .context("Missing native selection")?;
    let GameHostPacket::Playlist(playlist) = parse_game_host_packet(&selection)? else {
        unreachable!()
    };
    assert_eq!(playlist.round_time, seconds);
    assert_eq!(playlist.next_index, index as i32);
    let expected = (0..entries)
        .map(|index| format!("{prefix}-{index}"))
        .collect::<Vec<_>>();
    let actual = playlist
        .levels
        .iter()
        .take(entries)
        .map(|entry| entry.level.uid.clone())
        .collect::<Vec<_>>();
    assert_eq!(actual, expected);
    let level = &playlist.levels[index].level;
    let uploads_before = packets
        .lock()
        .await
        .iter()
        .filter(|packet| u16::from_le_bytes([packet[0], packet[1]]) == LEVEL_DATA)
        .count();
    session
        .context
        .dispatch(
            session,
            &GameHostPacket::LevelRequest {
                uid: level.uid.clone(),
                workshop_id: level.workshop_id,
                name: level.name.clone(),
            },
        )
        .await?;
    assert_eq!(
        packets
            .lock()
            .await
            .iter()
            .filter(|packet| u16::from_le_bytes([packet[0], packet[1]]) == LEVEL_DATA)
            .count(),
        uploads_before + 1
    );
    session
        .context
        .dispatch(
            session,
            &GameHostPacket::GameProperties {
                uid: level.uid.clone(),
                workshop_id: level.workshop_id,
                level_loaded_at: loaded_at,
                round_time: seconds,
            },
        )
        .await?;
    session
        .context
        .dispatch(session, &GameHostPacket::GameState(0))
        .await?;
    session.tick().await
}
