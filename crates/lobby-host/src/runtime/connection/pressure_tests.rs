use super::*;
use crate::{assets::PreparedLevel, leaderboard::DesiredPlayerStanding};
use zc_core::zeepnet::{LeaderboardOverrides, OnlineLevel};

async fn flush() {
    for _ in 0..2000 {
        tokio::task::yield_now().await;
    }
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
