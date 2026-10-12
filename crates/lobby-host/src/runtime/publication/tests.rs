use super::*;
use crate::chat::FnPacketSender;
use tokio::sync::Semaphore;
use zc_core::zeepnet::{
    LeaderboardOverrides, player_leaderboard_overrides_packet, player_leaderboard_time_packet,
};

fn standings(players: u64, points: &str) -> Result<Vec<Vec<u8>>> {
    let mut packets = Vec::new();
    for id in 1..=players {
        packets.push(player_leaderboard_time_packet(id, 12.5, false)?);
        packets.push(player_leaderboard_overrides_packet(
            id,
            &LeaderboardOverrides {
                name: format!("<color=#123456>Player {id}</color>"),
                points: points.into(),
                ..Default::default()
            },
        )?);
    }
    Ok(packets)
}
async fn yield_tasks() {
    for _ in 0..30 {
        tokio::task::yield_now().await;
    }
}

#[tokio::test]
async fn restores_two_then_sixty_four_players_during_delayed_acks_and_coalesces_deltas()
-> Result<()> {
    let publisher = Publisher::new(Arc::new(AtomicU64::new(1)));
    let sent = Arc::new(Mutex::new(Vec::new()));
    let ack = Arc::new(Semaphore::new(0));
    let sender = Arc::new(FnPacketSender({
        let sent = sent.clone();
        let ack = ack.clone();
        move |packet| {
            let sent = sent.clone();
            let ack = ack.clone();
            async move {
                sent.lock().unwrap().push(packet);
                ack.acquire().await?.forget();
                Ok(())
            }
        }
    }));
    publisher.enqueue(standings(2, "10")?, true)?;
    let worker = tokio::spawn(publisher.clone().run(sender));
    yield_tasks().await;
    assert_eq!(sent.lock().unwrap().len(), 1);
    publisher.enqueue(standings(64, "20")?, true)?;
    // A delta for one player must not discard other 63 unsent players.
    publisher.enqueue(
        vec![player_leaderboard_overrides_packet(
            64,
            &LeaderboardOverrides {
                name: "<color=#123456>Player 64</color>".into(),
                points: "30".into(),
                ..Default::default()
            },
        )?],
        true,
    )?;
    publisher.native_finish(2, 10.0, &(1..=64).collect::<Vec<_>>());
    // A lifecycle snapshot taken before receipt must not enqueue old time again.
    publisher.enqueue(vec![player_leaderboard_time_packet(2, 12.5, false)?], true)?;
    assert_eq!(publisher.queue.lock().unwrap().packets, 128);
    ack.add_permits(128);
    yield_tasks().await;
    let packets = sent.lock().unwrap().clone();
    assert_eq!(packets.len(), 128);
    let overrides: Vec<_> = packets
        .iter()
        .filter(|packet| standing_key(packet).unwrap().2)
        .map(|packet| crate::leaderboard::read_test_overrides(packet))
        .collect::<Result<_>>()?;
    assert_eq!(overrides.len(), 64);
    assert_eq!(
        overrides.iter().find(|(id, _)| *id == 64).unwrap().1.points,
        "30"
    );
    assert!(
        overrides
            .iter()
            .all(|(_, value)| value.name.contains("#123456"))
    );
    assert!(
        !packets
            .iter()
            .any(|packet| standing_key(packet) == Some((2, true, false)))
    );
    publisher.stop();
    worker.await??;
    Ok(())
}

#[tokio::test]
async fn stale_unsent_batches_never_reach_next_generation() -> Result<()> {
    let generation = Arc::new(AtomicU64::new(1));
    let publisher = Publisher::new(generation.clone());
    let sent = Arc::new(Mutex::new(Vec::new()));
    let ack = Arc::new(Semaphore::new(0));
    let sender = Arc::new(FnPacketSender({
        let sent = sent.clone();
        let ack = ack.clone();
        move |packet| {
            let sent = sent.clone();
            let ack = ack.clone();
            async move {
                sent.lock().unwrap().push(packet);
                ack.acquire().await?.forget();
                Ok(())
            }
        }
    }));
    publisher.enqueue(vec![vec![1], vec![2], vec![3]], false)?;
    let worker = tokio::spawn(publisher.clone().run(sender));
    yield_tasks().await;
    generation.store(2, Ordering::Release);
    publisher.enqueue(vec![vec![4]], false)?;
    ack.add_permits(2);
    yield_tasks().await;
    assert_eq!(*sent.lock().unwrap(), vec![vec![1], vec![4]]);
    publisher.stop();
    worker.await??;
    Ok(())
}

#[tokio::test]
async fn bounds_include_inflight_packets_and_transport_errors_keep_cause() -> Result<()> {
    for packets in [vec![vec![1]; 257], vec![vec![1; BYTES + 1]]] {
        let publisher = Publisher::new(Arc::new(AtomicU64::new(1)));
        assert_eq!(
            publisher.enqueue(packets, false).unwrap_err().to_string(),
            "Room publication queue exceeded capacity"
        );
        assert_eq!(
            publisher.failed().await,
            "Room publication queue exceeded capacity"
        );
    }
    let publisher = Publisher::new(Arc::new(AtomicU64::new(1)));
    publisher.enqueue(vec![vec![1]], false)?;
    let worker = tokio::spawn(publisher.clone().run(Arc::new(FnPacketSender(|_| async {
        std::future::pending::<Result<()>>().await
    }))));
    yield_tasks().await;
    assert!(publisher.enqueue(vec![vec![1]; 256], false).is_err());
    worker.abort();
    let _ = worker.await;
    let publisher = Publisher::new(Arc::new(AtomicU64::new(1)));
    publisher.enqueue(vec![vec![1]], false)?;
    let error = publisher
        .run(Arc::new(FnPacketSender(|_| async {
            Err(zc_core::zeepnet::LidgrenError::ReceiveQueueFull.into())
        })))
        .await
        .unwrap_err();
    assert_eq!(
        error.downcast_ref::<zc_core::zeepnet::LidgrenError>(),
        Some(&zc_core::zeepnet::LidgrenError::ReceiveQueueFull)
    );
    Ok(())
}
