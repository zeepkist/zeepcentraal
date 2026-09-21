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
            "SELECT players,peak_players,closed_at IS NOT NULL FROM public.lobby WHERE master_id=$1",
            &[&master_id],
        )
        .await?;
    assert_eq!(row.get::<_, i32>(0), 3);
    assert_eq!(row.get::<_, i32>(1), 3);
    assert!(row.get::<_, bool>(2));
    let changes = client
        .query(
            "SELECT history.change_type FROM public.lobby_history history JOIN public.lobby value ON value.id=history.lobby_id WHERE value.master_id=$1 ORDER BY history.id",
            &[&master_id],
        )
        .await?
        .into_iter()
        .map(|row| row.get::<_, String>(0))
        .collect::<Vec<_>>();
    assert_eq!(changes, ["opened", "updated", "closed"]);
    let stats: i64 = client
        .query_one(
            "SELECT count(*) FROM public.lobby_stats WHERE players=5 AND rooms=1 AND players_in_rooms=3",
            &[],
        )
        .await?
        .get(0);
    assert_eq!(stats, 1);

    client
        .execute(
            "DELETE FROM public.lobby_stats WHERE players=5 AND rooms=1 AND players_in_rooms=3",
            &[],
        )
        .await?;
    client
        .execute("DELETE FROM public.lobby WHERE master_id=$1", &[&master_id])
        .await?;
    client
        .execute(
            "DELETE FROM public.\"user\" WHERE steam_id=$1",
            &[&steam_id],
        )
        .await?;
    Ok(())
}
