use super::*;
use crate::{assets::PreparedLevel, leaderboard::DesiredPlayerStanding};
use zc_core::zeepnet::{LeaderboardOverrides, OnlineLevel};

async fn flush() {
    for _ in 0..2000 {
        tokio::task::yield_now().await;
    }
}

#[tokio::test(start_paused = true)]
async fn native_selection_uploads_before_callbacks_and_countdown_restarts_message_interval()
-> Result<()> {
    use crate::assets::{FnLevelLoader, PreparedPlaylist};
    use zc_core::zeepnet::{
        CHANGE_LOBBY_PLAYLIST, LEVEL_DATA, SKIP_TO_LEVEL, parse_game_host_packet,
    };

    let mut h = Harness::with_clock(RemoteClock::from_sample(127.0, Duration::ZERO));
    h.packet(initial(true));
    flush().await;
    advance(4).await;
    let context = h.stats.contexts.lock().unwrap()[0].clone();
    let levels = (0..15)
        .map(|index| OnlineLevel {
            uid: format!("tournament-{index}"),
            workshop_id: 100 + index,
            name: if index == 7 {
                "Break".into()
            } else {
                format!("Track {index}")
            },
            author: "ZSL".into(),
            collaborators: String::new(),
            override_author_name: String::new(),
        })
        .collect::<Vec<_>>();
    let first = PreparedLevel {
        level: levels[0].clone(),
        compressed_data: Arc::from([1, 2, 3]),
        content_sha256: "sha".into(),
    };
    let loader = Arc::new(FnLevelLoader({
        let first = first.clone();
        move |_: &str, _: u64| {
            let first = first.clone();
            async move { Ok(Some(first)) }
        }
    }));
    let playlist = PreparedPlaylist::new(levels, loader)?;
    h.stats.stall_callback.store(true, Ordering::Release);
    h.packet(GameHostPacket::GameState(2));
    flush().await;
    context.select_round(playlist, 14, 0, 420.0).await?;
    h.packet(GameHostPacket::LevelRequest {
        uid: first.level.uid.clone(),
        workshop_id: first.level.workshop_id,
        name: first.level.name.clone(),
    });
    h.packet(GameHostPacket::GameProperties {
        uid: first.level.uid.clone(),
        workshop_id: first.level.workshop_id,
        level_loaded_at: 113.0,
        round_time: 420.0,
    });
    h.packet(GameHostPacket::GameState(0));
    h.packet(GameHostPacket::Timer("0:13".into()));
    flush().await;
    assert_eq!(h.count(LEVEL_DATA), 1);
    assert_eq!(h.count(SKIP_TO_LEVEL), 0);
    let sent = h
        .connection
        .sent
        .lock()
        .unwrap()
        .iter()
        .find(|packet| packet_type(packet) == CHANGE_LOBBY_PLAYLIST)
        .unwrap()
        .clone();
    let GameHostPacket::Playlist(sent) = parse_game_host_packet(&sent)? else {
        unreachable!()
    };
    assert_eq!(
        (sent.current_index, sent.next_index, sent.round_time),
        (14, 0, 420.0)
    );
    assert_eq!(sent.levels.len(), 15);
    assert_eq!(sent.levels[7].level.name, "Break");
    let interval = Duration::from_secs(60);
    assert!(context.round_message_due(interval).is_none());
    h.packet(GameHostPacket::Timer("6:46".into()));
    flush().await;
    let key = context
        .round_message_due(interval)
        .context("First countdown must make message due")?;
    context
        .send_round_message(&key, interval, "/servermessage white 420 Race")
        .await?;
    assert!(context.round_message_due(interval).is_none());
    h.packet(GameHostPacket::GameState(2));
    h.packet(GameHostPacket::GameProperties {
        uid: first.level.uid,
        workshop_id: first.level.workshop_id,
        level_loaded_at: 126.0,
        round_time: 420.0,
    });
    h.packet(GameHostPacket::GameState(0));
    h.packet(GameHostPacket::Timer("6:59".into()));
    flush().await;
    let repeated = context
        .round_message_due(interval)
        .context("Same-track reload needs a new message")?;
    assert_ne!(repeated, key);
    h.shutdown().await?;
    Ok(())
}

#[tokio::test(start_paused = true)]
async fn production_receive_loop_drains_over_128_packets_while_standings_acks_wait() -> Result<()> {
    let mut h = Harness::new();
    h.packet(initial(true));
    flush().await;
    advance(4).await;
    let context = h.stats.contexts.lock().unwrap()[0].clone();
    h.connection
        .delay_publication
        .store(true, Ordering::Release);
    let mut board = context.leaderboard();
    let mut room = initial(true);
    if let GameHostPacket::Initial { players, .. } = &mut room {
        *players = (1..=64).map(player).collect();
    }
    board.observe(&room);
    board.set_scope("level", "target");
    board.set_ready(true);
    for players in [2, 64] {
        board.set_desired(
            (1..=players)
                .map(|id| DesiredPlayerStanding {
                    steam_id: player(id).steam_id,
                    time: Some(12.5),
                    overrides: LeaderboardOverrides {
                        position: id.to_string(),
                        points: "100".into(),
                        ..Default::default()
                    },
                })
                .collect(),
        );
        context.publish_standings(board.reconcile()?).await?;
        flush().await;
    }
    assert_eq!(h.count(zc_core::zeepnet::CUSTOM_LEADERBOARD), 1);
    let before = h.stats.observed.lock().unwrap().len();
    for i in 0..320 {
        h.packet(match i % 4 {
            0 => GameHostPacket::Leaderboard {
                packet_type: 0,
                times: vec![],
                overrides: vec![],
            },
            1 => GameHostPacket::Chat {
                message: "traffic".into(),
                sender_uid: 42,
            },
            2 => GameHostPacket::PlayerConnected {
                player: player(42),
                is_host: false,
                has_host_powers: false,
            },
            _ => GameHostPacket::GameState(0),
        });
    }
    flush().await;
    assert_eq!(h.stats.observed.lock().unwrap().len(), before + 320);
    assert!(!h.is_finished());
    let level = PreparedLevel {
        level: OnlineLevel {
            uid: "target".into(),
            workshop_id: 1,
            name: "Target".into(),
            author: "Author".into(),
            collaborators: String::new(),
            override_author_name: String::new(),
        },
        compressed_data: Arc::from([1, 2, 3]),
        content_sha256: Arc::from("sha"),
    };
    let activation = tokio::spawn({
        let context = context.clone();
        let level = level.clone();
        async move { context.activate(level, None).await }
    });
    flush().await;
    h.packet(GameHostPacket::LevelRequest {
        uid: level.level.uid.clone(),
        workshop_id: 1,
        name: "Target".into(),
    });
    h.packet(GameHostPacket::GameProperties {
        uid: "target".into(),
        workshop_id: 1,
        level_loaded_at: 20.0,
        round_time: 420.0,
    });
    h.packet(GameHostPacket::GameState(0));
    flush().await;
    activation.await??;
    assert_eq!(h.count(zc_core::zeepnet::LEVEL_DATA), 1);
    h.connection.publication_ack.add_permits(256);
    flush().await;
    // Activation invalidates unsent standings from old level.
    assert_eq!(h.count(zc_core::zeepnet::CUSTOM_LEADERBOARD), 1);
    context
        .publish_standings({
            board.observe(&GameHostPacket::Leaderboard {
                packet_type: 0,
                times: vec![],
                overrides: vec![],
            });
            board.reconcile()?
        })
        .await?;
    flush().await;
    assert_eq!(h.count(zc_core::zeepnet::CUSTOM_LEADERBOARD), 129);
    let envelopes = h.stats.envelopes.lock().unwrap().clone();
    assert!(
        envelopes
            .windows(2)
            .all(|pair| pair[0].0 < pair[1].0 && pair[0].1 == pair[1].1 && pair[0].2 <= pair[1].2)
    );
    assert!(envelopes.iter().skip(1).all(|value| value.3 > 0));
    h.shutdown().await?;
    assert_eq!(h.count(zc_core::zeepnet::KICK_PLAYER), 0);
    Ok(())
}

#[tokio::test(start_paused = true)]
async fn slow_callback_never_blocks_confirmation_or_immediate_ownership_loss() -> Result<()> {
    let mut h = Harness::new();
    h.packet(initial(true));
    flush().await;
    advance(4).await;
    let context = h.stats.contexts.lock().unwrap()[0].clone();
    h.stats.stall_callback.store(true, Ordering::Release);
    h.packet(GameHostPacket::GameState(2));
    flush().await;
    let before = h.stats.receipts.load(Ordering::Acquire);
    for _ in 0..200 {
        h.packet(GameHostPacket::GameState(0));
    }
    flush().await;
    assert_eq!(h.stats.receipts.load(Ordering::Acquire), before + 200);
    let level = PreparedLevel {
        level: OnlineLevel {
            uid: "cached".into(),
            workshop_id: 1,
            name: "Cached".into(),
            author: "Author".into(),
            collaborators: String::new(),
            override_author_name: String::new(),
        },
        compressed_data: Arc::from([]),
        content_sha256: Arc::from("cached"),
    };
    let activation = tokio::spawn({
        let context = context.clone();
        async move { context.activate(level, None).await }
    });
    flush().await;
    h.packet(GameHostPacket::LevelRequest {
        uid: "cached".into(),
        workshop_id: 1,
        name: "Cached".into(),
    });
    flush().await;
    assert_eq!(h.count(zc_core::zeepnet::LEVEL_DATA), 1);
    h.packet(GameHostPacket::GameProperties {
        uid: "cached".into(),
        workshop_id: 1,
        level_loaded_at: 20.0,
        round_time: 420.0,
    });
    h.packet(GameHostPacket::GameState(0));
    flush().await;
    activation.await??;
    h.packet(GameHostPacket::Master(42));
    flush().await;
    assert!(!context.is_host());
    assert!(context.publish(vec![vec![1, 2]]).await.is_err());
    h.shutdown().await?;
    Ok(())
}

#[tokio::test(start_paused = true)]
async fn queue_overflow_is_terminal_and_unknown_traffic_is_skipped() -> Result<()> {
    let mut h = Harness::new();
    h.stats.no_kicks.store(true, Ordering::Release);
    h.packet(initial(true));
    flush().await;
    advance(4).await;
    let before = h.stats.receipts.load(Ordering::Acquire);
    for _ in 0..1000 {
        h.packet(GameHostPacket::Unknown(999));
    }
    flush().await;
    assert_eq!(h.stats.receipts.load(Ordering::Acquire), before);
    h.stats.stall_callback.store(true, Ordering::Release);
    h.packet(GameHostPacket::GameState(2));
    flush().await;
    for _ in 0..512 {
        h.packet(GameHostPacket::GameState(0));
    }
    flush().await;
    assert_eq!(
        h.result().await.unwrap_err().to_string(),
        "Room profile queue exceeded event capacity"
    );
    assert_eq!(h.count(zc_core::zeepnet::KICK_PLAYER), 0);
    assert_eq!(h.connection.closes.load(Ordering::Acquire), 1);
    Ok(())
}

#[tokio::test(start_paused = true)]
async fn round_message_repeats_unchanged_content_at_configured_interval() -> Result<()> {
    let mut h = Harness::with_clock(RemoteClock::from_sample(491.0, Duration::ZERO));
    h.packet(initial(true));
    flush().await;
    advance(4).await;
    let context = h.stats.contexts.lock().unwrap()[0].clone();
    let interval = Duration::from_secs(60);
    assert!(context.round_message_due(interval).is_none());

    context.observe_round(
        &GameHostPacket::Timer("6:59".into()),
        jiff::Timestamp::now(),
    );
    let key = context.round_message_due(interval).context("Overlay due")?;
    let message = "/servermessage white 120 Race";
    let sent = h.count(zc_core::zeepnet::CHAT_MESSAGE);
    context.send_round_message(&key, interval, message).await?;
    flush().await;
    assert_eq!(h.count(zc_core::zeepnet::CHAT_MESSAGE), sent + 1);

    advance(59).await;
    assert!(context.round_message_due(interval).is_none());
    advance(1).await;
    assert_eq!(context.round_message_due(interval), Some(key.clone()));
    context.send_round_message(&key, interval, message).await?;
    flush().await;
    assert_eq!(h.count(zc_core::zeepnet::CHAT_MESSAGE), sent + 2);
    h.shutdown().await?;
    Ok(())
}
