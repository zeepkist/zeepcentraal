use zc_core::zeepnet::{LobbyOperation, LobbyPacket, WireLobby};

// The snapshot test closes every room absent from its snapshot.
static LOBBY_FIXTURES: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

#[tokio::test]
#[ignore = "requires disposable PostgreSQL with lobby tables"]
async fn lobby_packets_preserve_drizzle_history_semantics() -> anyhow::Result<()> {
    let _fixture = LOBBY_FIXTURES.lock().await;
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    let disposable_host = parsed.host_str().is_some_and(|host| {
        matches!(host, "localhost" | "zc-lobby-db")
            || host.parse::<std::net::IpAddr>().is_ok_and(|address| {
                address.is_loopback()
                    || matches!(address, std::net::IpAddr::V4(address) if address.is_private())
            })
    });
    anyhow::ensure!(
        disposable_host && parsed.path() == "/zc_test",
        "Lobby integration test requires disposable PostgreSQL"
    );
    let database = zc_database::Database::connect(&url, 2).await?;
    let suffix = std::process::id();
    let master_id = format!("rust-lobby-{suffix}");
    let steam_id = 76_561_198_700_000_000_i64 + i64::from(suffix);
    let observed = "2026-09-20T12:00:00Z";
    let mut lobby = WireLobby {
        id: master_id.clone(),
        title: "Rust Lobby".into(),
        host_name: "Rust Host".into(),
        host_steam_id: steam_id as u64,
        players: 2,
        player_limit: 12,
        is_public: true,
        ..Default::default()
    };

    database
        .persist_lobby_packet(&LobbyPacket::List(vec![lobby.clone()]), observed)
        .await?;
    database
        .persist_lobby_packet(&LobbyPacket::List(vec![lobby.clone()]), observed)
        .await?;
    lobby.players = 3;
    database
        .persist_lobby_packet(
            &LobbyPacket::Update {
                operation: LobbyOperation::Updated,
                lobby: lobby.clone(),
            },
            "2026-09-20T12:01:00Z",
        )
        .await?;
    let statistics = LobbyPacket::Statistics {
        online_players: 5,
        lobby_count: 1,
        players_in_lobbies: 3,
    };
    database
        .persist_lobby_packet(&statistics, "2026-09-20T12:02:00Z")
        .await?;
    database
        .persist_lobby_packet(&statistics, "2026-09-20T12:03:00Z")
        .await?;
    database
        .persist_lobby_packet(&LobbyPacket::List(Vec::new()), "2026-09-20T12:04:00Z")
        .await?;

    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("PostgreSQL connection") });
    let row = client
        .query_one(
            include_str!("fixtures/lobby_services/select_players_lobby.sql"),
            &[&master_id],
        )
        .await?;
    assert_eq!(row.get::<_, i32>(0), 3);
    assert_eq!(row.get::<_, i32>(1), 3);
    assert!(row.get::<_, bool>(2));
    let changes = client
        .query(
            include_str!("fixtures/lobby_services/select_change_type_lobby_history.sql"),
            &[&master_id],
        )
        .await?
        .into_iter()
        .map(|row| row.get::<_, String>(0))
        .collect::<Vec<_>>();
    assert_eq!(changes, ["opened", "updated", "closed"]);
    let stats: i64 = client
        .query_one(
            include_str!("fixtures/lobby_services/count_lobby_stats.sql"),
            &[],
        )
        .await?
        .get(0);
    assert_eq!(stats, 1);

    let explicit = WireLobby {
        id: format!("{master_id}-explicit"),
        title: "Explicit closure fixture".into(),
        is_public: false,
        ..lobby.clone()
    };
    let inferred = WireLobby {
        id: format!("{master_id}-inferred"),
        title: "Inferred closure fixture".into(),
        ..explicit.clone()
    };
    let unknown_id = format!("{master_id}-unknown");
    database
        .persist_lobby_packet(
            &LobbyPacket::List(vec![explicit.clone(), inferred.clone()]),
            "2026-09-20T12:05:00Z",
        )
        .await?;
    for (id, time) in [
        (&unknown_id, "2026-09-20T12:06:00Z"),
        (&explicit.id, "2026-09-20T12:07:00Z"),
        (&explicit.id, "2026-09-20T12:08:00Z"),
    ] {
        database
            .persist_lobby_packet(
                &LobbyPacket::Update {
                    operation: LobbyOperation::Removed,
                    lobby: WireLobby {
                        id: id.clone(),
                        title: "Untrusted removal name".into(),
                        is_public: true,
                        ..lobby.clone()
                    },
                },
                time,
            )
            .await?;
    }
    database
        .persist_lobby_packet(&LobbyPacket::List(Vec::new()), "2026-09-20T12:09:00Z")
        .await?;

    let unknown_exists: bool = client
        .query_one(
            "SELECT EXISTS (SELECT FROM public.lobby WHERE master_id = $1)",
            &[&unknown_id],
        )
        .await?
        .get(0);
    assert!(!unknown_exists, "Unknown removal must not invent a room");

    for entry in [&explicit, &inferred] {
        let rows = client
            .query(
                include_str!("fixtures/lobby_services/select_room_name_lobby.sql"),
                &[&entry.id],
            )
            .await?;
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].get::<_, &str>(2), "opened");
        assert_eq!(rows[1].get::<_, &str>(2), "closed");
        for row in rows {
            assert_eq!(row.get::<_, &str>(0), entry.title);
            assert_eq!(row.get::<_, &str>(1), entry.title);
            assert!(!row.get::<_, bool>(3));
            assert!(!row.get::<_, bool>(4));
        }
    }

    let bot_room = WireLobby {
        id: format!("{master_id}-bot"),
        title: "Bot fixture".into(),
        host_name: "zeepcentraal".into(),
        host_steam_id: 76_561_198_679_467_221,
        players: 1,
        player_limit: 64,
        ..lobby.clone()
    };
    let private_bot_room = WireLobby {
        id: format!("{master_id}-private-bot"),
        players: 0,
        player_limit: 0,
        is_public: false,
        ..bot_room.clone()
    };
    let rooms = || LobbyPacket::List(vec![bot_room.clone(), private_bot_room.clone()]);
    assert!(
        database
            .persist_lobby_packet(&rooms(), "2026-09-20T12:10:00Z")
            .await?
    );
    let occupied_bot_room = WireLobby {
        players: 2,
        ..bot_room.clone()
    };
    assert!(
        !database
            .persist_lobby_packet(
                &LobbyPacket::Update {
                    operation: LobbyOperation::Updated,
                    lobby: occupied_bot_room
                },
                "2026-09-20T12:10:30Z",
            )
            .await?
    );
    assert!(
        !database
            .persist_lobby_packet(&rooms(), "2026-09-20T12:11:00Z")
            .await?
    );
    for (online_players, players_in_lobbies, date) in [
        (7, 5, "2026-09-20T12:11:00Z"),
        (0, 1, "2026-09-20T12:12:00Z"),
    ] {
        database
            .persist_lobby_packet(
                &LobbyPacket::Statistics {
                    online_players,
                    lobby_count: 2,
                    players_in_lobbies,
                },
                date,
            )
            .await?;
    }
    let counts = client
        .query_one(
            include_str!("fixtures/lobby_services/check_saved_bot_counts.sql"),
            &[&bot_room.id, &private_bot_room.id],
        )
        .await?;
    for (column, expected) in [0, 63, 1, 0, 0, 0].into_iter().enumerate() {
        assert_eq!(counts.get::<_, i32>(column), expected);
    }
    assert_eq!(counts.get::<_, &str>("stats"), "{{6,3},{0,0}}");
    assert_eq!(counts.get::<_, &str>("history"), "{{0,63},{1,63},{0,63}}");
    assert!(
        database
            .persist_lobby_packet(&LobbyPacket::List(vec![]), "2026-09-20T12:13:00Z")
            .await?
    );
    client
        .execute(
            include_str!("fixtures/lobby_services/delete_lobby_stats.sql"),
            &[],
        )
        .await?;
    client
        .execute(
            include_str!("fixtures/lobby_services/delete_lobby.sql"),
            &[&vec![
                master_id,
                explicit.id,
                inferred.id,
                bot_room.id,
                private_bot_room.id,
            ]],
        )
        .await?;
    client
        .execute(
            include_str!("fixtures/lobby_services/delete_user.sql"),
            &[&steam_id],
        )
        .await?;
    Ok(())
}

#[tokio::test]
#[ignore = "requires disposable migrated PostgreSQL named zc_test"]
async fn lobby_levels_resolve_distinct_items_without_logging_room_state() -> anyhow::Result<()> {
    let _fixture = LOBBY_FIXTURES.lock().await;
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    anyhow::ensure!(parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/zc_test");
    let database = zc_database::Database::connect(&url, 2).await?;
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(connection);
    let suffix = std::process::id();
    let steam = 76_561_198_710_000_000_i64 + i64::from(suffix);
    let workshop = 1_000_000_i64 + i64::from(suffix);
    let adventure_uid = format!("adventure-{suffix}");
    let workshop_uid = format!("workshop-{suffix}");
    let room_id = format!("level-room-{suffix}");
    let observed = "2026-11-27T10:00:00Z";
    let adventure: i32 = client
        .query_one(
            "INSERT INTO public.level (hash, xx_hash, adventure) VALUES ($1,$1,true) RETURNING id",
            &[&adventure_uid],
        )
        .await?
        .get(0);
    let custom: i32 = client
        .query_one(
            "INSERT INTO public.level (hash, xx_hash, adventure) VALUES ($1,$1,false) RETURNING id",
            &[&workshop_uid],
        )
        .await?
        .get(0);
    client.execute(
        r#"INSERT INTO public."user" (steam_id, steam_name, banned) VALUES ($1,'Fixture Host',false) ON CONFLICT DO NOTHING"#,
        &[&steam],
    ).await?;
    client.execute(
        "INSERT INTO public.workshop_item (workshop_id,author_id,name,image_url) VALUES (0,$1,'Adventure',''),($2,$1,'Fixture Workshop','') ON CONFLICT DO NOTHING",
        &[&steam,&workshop],
    ).await?;
    let insert_item = "INSERT INTO public.level_item (id_level, workshop_id, file_uid, author_id, name, image_url, file_author, validation_time_author, validation_time_gold, validation_time_silver, validation_time_bronze, created_at, updated_at, deleted) VALUES ($1,$2,$3,$6,'Fixture','','',0,0,0,0,now(),$4::text::timestamptz,$5) RETURNING id";
    let old: i32 = client
        .query_one(
            insert_item,
            &[
                &adventure,
                &0_i64,
                &adventure_uid,
                &"2026-11-24T00:00:00Z",
                &false,
                &steam,
            ],
        )
        .await?
        .get(0);
    let newest: i32 = client
        .query_one(
            insert_item,
            &[
                &adventure,
                &0_i64,
                &adventure_uid,
                &"2026-11-25T00:00:00Z",
                &false,
                &steam,
            ],
        )
        .await?
        .get(0);
    let deleted: i32 = client
        .query_one(
            insert_item,
            &[
                &adventure,
                &0_i64,
                &adventure_uid,
                &"2026-11-26T00:00:00Z",
                &true,
                &steam,
            ],
        )
        .await?
        .get(0);
    let mut room = WireLobby {
        id: room_id.clone(),
        title: "Lobby level fixture".into(),
        host_name: "Fixture Host".into(),
        host_steam_id: steam as u64,
        player_limit: 16,
        players: 2,
        is_public: true,
        level_name: "Adventure".into(),
        level_uid: adventure_uid.clone(),
        level_author_steam_id: 1,
        round_time: 60.0,
        ..Default::default()
    };
    let persist = async |room: &WireLobby| {
        database
            .persist_lobby_packet(
                &LobbyPacket::Update {
                    operation: LobbyOperation::Updated,
                    lobby: room.clone(),
                },
                observed,
            )
            .await
    };
    persist(&room).await?;
    let state = "SELECT level_item_id, l.round_time, l.game_state, l.level_author_steam_id,
      (SELECT count(*) FROM public.lobby_history WHERE lobby_id = l.id),
      (SELECT count(*) FROM public.lobby_level WHERE lobby_id = l.id), l.levels_played
      FROM public.lobby l LEFT JOIN public.lobby_level m
        ON (m.lobby_id, m.level_uid, m.workshop_id) = (l.id, l.current_level_uid, l.level_workshop_id)
      WHERE l.master_id = $1";
    let result = client.query_one(state, &[&room_id]).await?;
    assert_eq!(result.get::<_, Option<i32>>(0), Some(newest));
    assert_eq!(result.get::<_, i64>(6), 0);
    room.level_uid = workshop_uid.clone();
    room.level_workshop_id = workshop as u64;
    room.level_name = "Workshop".into();
    room.level_author_steam_id = steam as u64;
    persist(&room).await?;
    assert_eq!(
        client
            .query_one(state, &[&room_id])
            .await?
            .get::<_, Option<i64>>(3),
        Some(steam)
    );
    assert!(
        database
            .pending_lobby_workshop_scans()
            .await?
            .contains(&workshop)
    );
    database.mark_lobby_workshop_scan(workshop).await?;
    assert!(
        !database
            .pending_lobby_workshop_scans()
            .await?
            .contains(&workshop)
    );

    room.level_uid = adventure_uid.clone();
    room.level_workshop_id = 0;
    room.level_name = "Adventure".into();
    room.level_author_steam_id = 1;
    room.round_time = 360.25;
    room.game_state = 2;
    persist(&room).await?;
    let workshop_item: i32 = client
        .query_one(
            insert_item,
            &[
                &custom,
                &workshop,
                &workshop_uid,
                &"2026-11-26T00:00:00Z",
                &false,
                &steam,
            ],
        )
        .await?
        .get(0);
    database.resolve_lobby_workshop_levels(workshop).await?;
    let result = client.query_one(state, &[&room_id]).await?;
    assert_eq!(result.get::<_, Option<i32>>(0), Some(newest));
    assert_eq!(result.get::<_, f64>(1), 360.25);
    assert_eq!(result.get::<_, i32>(2), 2);
    assert_eq!(result.get::<_, Option<i64>>(3), None);
    assert_eq!(result.get::<_, i64>(4), 1);
    assert_eq!(result.get::<_, i64>(5), 2);
    assert_eq!(result.get::<_, i64>(6), 1);
    persist(&room).await?;
    database
        .persist_lobby_packet(&LobbyPacket::List(vec![room.clone()]), observed)
        .await?;
    assert_eq!(
        client.query_one(state, &[&room_id]).await?.get::<_, i64>(6),
        1
    );
    room.game_state = 0;
    persist(&room).await?;
    room.game_state = 2;
    persist(&room).await?;
    let result = client.query_one(state, &[&room_id]).await?;
    assert_eq!(result.get::<_, i64>(4), 1);
    assert_eq!(result.get::<_, i64>(5), 2);
    assert_eq!(result.get::<_, i64>(6), 2);
    let linked: i32 = client
        .query_one(
            "SELECT level_item_id FROM public.lobby_level WHERE workshop_id = $1",
            &[&workshop],
        )
        .await?
        .get(0);
    assert_eq!(linked, workshop_item);

    database
        .persist_lobby_packet(
            &LobbyPacket::Update {
                operation: LobbyOperation::Removed,
                lobby: WireLobby {
                    id: room_id.clone(),
                    ..Default::default()
                },
            },
            "2026-11-27T11:00:00Z",
        )
        .await?;
    let result = client.query_one(state, &[&room_id]).await?;
    assert_eq!(result.get::<_, Option<i32>>(0), Some(newest));
    assert_eq!(result.get::<_, i64>(6), 2);
    database
        .persist_lobby_packet(
            &LobbyPacket::List(vec![room.clone()]),
            "2026-11-27T11:01:00Z",
        )
        .await?;
    assert_eq!(
        client.query_one(state, &[&room_id]).await?.get::<_, i64>(6),
        2
    );
    room.is_public = false;
    room.level_uid = "private".into();
    persist(&room).await?;
    let result = client.query_one(state, &[&room_id]).await?;
    assert_eq!(result.get::<_, Option<i32>>(0), None);
    assert_eq!(result.get::<_, Option<f64>>(1), None);
    assert_eq!(result.get::<_, Option<i32>>(2), None);
    assert_eq!(result.get::<_, i64>(5), 2);
    assert_eq!(result.get::<_, i64>(6), 2);
    let public_count = client
        .query_one(
            "SELECT listing.levels_played FROM public.lobby_listing listing
             JOIN public.lobby room USING (id) WHERE room.master_id = $1",
            &[&room_id],
        )
        .await?
        .get::<_, Option<i64>>(0);
    assert_eq!(public_count, None);
    assert!(!client.query_one("SELECT has_table_privilege('zeepcentraal_graphql', 'public.lobby_level', 'SELECT')", &[]).await?.get::<_, bool>(0));

    client
        .execute("DELETE FROM public.lobby WHERE master_id = $1", &[&room_id])
        .await?;
    client
        .execute(
            "DELETE FROM public.level_item WHERE id = ANY($1)",
            &[&vec![old, newest, deleted, workshop_item]],
        )
        .await?;
    client
        .execute(
            "DELETE FROM public.level WHERE id = ANY($1)",
            &[&vec![adventure, custom]],
        )
        .await?;
    Ok(())
}
