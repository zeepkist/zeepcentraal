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
        uid: 42,
        steam_id: 76561198000000042,
        username: Some("Player".into()),
        backup_name: "Player".into(),
        player_tag: String::new(),
    }
}

async fn recover_phase(profile: &ZslProfile, context: &RoomContext) -> Result<()> {
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
    let session = ZslSession {
        shared: restarted.shared.clone(),
        context: context.clone(),
        board: Mutex::new(context.leaderboard()),
        live: Mutex::new(LiveState {
            last_assets: Some(Instant::now()),
            ..Default::default()
        }),
        stopped: AtomicBool::new(false),
        wake: Notify::new(),
    };
    tokio::time::timeout(Duration::from_secs(5), session.tick()).await??;
    let recovered = restarted.shared.saved.lock().await.clone();
    assert_eq!(recovered.phase, snapshot.phase);
    assert_eq!(recovered.index, snapshot.index);
    assert_eq!(recovered.progress, snapshot.progress);
    assert_eq!(recovered.deadline, snapshot.deadline);
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
            driver_context
                .complete_test_level_request(&prepared)
                .await?;
        }
        Ok::<_, anyhow::Error>(())
    });
    let session = ZslSession {
        shared: shared.clone(),
        board: Mutex::new(context.leaderboard()),
        context: context.clone(),
        live: Mutex::new(LiveState {
            last_assets: Some(Instant::now()),
            ..Default::default()
        }),
        stopped: AtomicBool::new(false),
        wake: Notify::new(),
    };
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
    recover_phase(&profile, &context).await?;
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
    recover_phase(&profile, &context).await?;
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
    recover_phase(&profile, &context).await?;
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
    recover_phase(&profile, &context).await?;
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
    recover_phase(&profile, &context).await?;
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
