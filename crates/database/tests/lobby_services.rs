use zc_core::zeepnet::{LobbyOperation, LobbyPacket, WireLobby};

#[tokio::test]
#[ignore = "requires disposable PostgreSQL with lobby tables"]
async fn lobby_packets_preserve_drizzle_history_semantics() -> anyhow::Result<()> {
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

    let mut private = WireLobby {
        id: format!("{master_id}-private"),
        title: "Private removal fixture".into(),
        is_public: false,
        ..lobby.clone()
    };
    let public = WireLobby {
        id: format!("{master_id}-public"),
        ..lobby.clone()
    };
    let inferred = WireLobby {
        id: format!("{master_id}-inferred"),
        title: "Inferred closure fixture".into(),
        ..private.clone()
    };
    database
        .persist_lobby_packet(
            &LobbyPacket::List(vec![inferred.clone()]),
            "2026-09-20T12:05:00Z",
        )
        .await?;
    for entry in [&private, &public] {
        database
            .persist_lobby_packet(
                &LobbyPacket::Update {
                    operation: LobbyOperation::Removed,
                    lobby: entry.clone(),
                },
                "2026-09-20T12:06:00Z",
            )
            .await?;
    }
    private.title = "Duplicate removal fixture".into();
    database
        .persist_lobby_packet(
            &LobbyPacket::Update {
                operation: LobbyOperation::Removed,
                lobby: private.clone(),
            },
            "2026-09-20T12:07:00Z",
        )
        .await?;
    database
        .persist_lobby_packet(&LobbyPacket::List(Vec::new()), "2026-09-20T12:08:00Z")
        .await?;

    for (entry, summary_name, history_names) in [
        (&private, "Private room", vec!["Private room"]),
        (&public, "Rust Lobby", vec!["Rust Lobby"]),
        (
            &inferred,
            "Inferred closure fixture",
            vec!["Inferred closure fixture", "Private room"],
        ),
    ] {
        let rows = client
            .query(
                include_str!("fixtures/lobby_services/select_room_name_lobby.sql"),
                &[&entry.id],
            )
            .await?;
        assert_eq!(rows.len(), history_names.len());
        for (row, history_name) in rows.iter().zip(history_names) {
            assert_eq!(row.get::<_, &str>(0), summary_name);
            assert_eq!(row.get::<_, &str>(1), history_name);
            assert_eq!(row.get::<_, i64>(2), steam_id);
            assert_eq!(row.get::<_, i64>(3), steam_id);
            assert_eq!(row.get::<_, &str>(4), "Rust Host");
        }
    }

    client
        .execute(
            include_str!("fixtures/lobby_services/delete_lobby_stats.sql"),
            &[],
        )
        .await?;
    client
        .execute(
            include_str!("fixtures/lobby_services/delete_lobby.sql"),
            &[&vec![master_id, private.id, public.id, inferred.id]],
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
