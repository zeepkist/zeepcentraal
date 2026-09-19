#[tokio::test]
#[ignore = "requires disposable PostgreSQL cloned from current Drizzle schema"]
async fn discord_link_codes_rotate_and_unlink() -> anyhow::Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    anyhow::ensure!(
        url::Url::parse(&url)?
            .host_str()
            .is_some_and(|host| matches!(host, "127.0.0.1" | "localhost")),
        "Account integration test requires local disposable PostgreSQL"
    );
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("PostgreSQL connection") });
    let database = zc_database::Database::connect(&url, 2).await?;
    let steam_id = 76_561_198_998_000_000_i64 + i64::from(std::process::id());
    let user = database.upsert_user(steam_id, "Rust Link User").await?;

    let first = database.create_discord_link_code(user.id, "first").await?;
    let second = database.create_discord_link_code(user.id, "second").await?;
    assert!(first.ends_with('Z'));
    assert!(second.ends_with('Z'));
    let codes = client
        .query(
            "SELECT code_hash FROM zc_private.discord_link_code WHERE id_user=$1",
            &[&user.id],
        )
        .await?;
    assert_eq!(codes.len(), 1);
    assert_eq!(codes[0].get::<_, &str>(0), "second");

    let linked = database.consume_discord_link_code("second", 123).await?;
    assert_eq!(linked.status, DiscordLinkStatus::Linked);
    assert_eq!(linked.id_user, Some(user.id));
    assert_eq!(linked.steam_id, Some(steam_id));
    assert_eq!(
        database
            .consume_discord_link_code("second", 123)
            .await?
            .status,
        DiscordLinkStatus::Consumed
    );
    let preference = database.set_discord_user_preference(123, true).await?;
    assert!(preference.ping_on_world_record_loss);
    let watch = database
        .add_discord_watch(123, "player", " 76561198000000000 ")
        .await?;
    assert_eq!(watch.target_id, "76561198000000000");
    let state = database.discord_user_state(123).await?;
    assert_eq!(
        state.linked_user.as_ref().map(|user| user.id),
        Some(user.id)
    );
    assert!(state.preference.is_some());
    assert_eq!(state.watches.len(), 1);
    let state_json = serde_json::to_value(&state)?;
    assert_eq!(state_json["linkedUser"]["discordId"], "123");
    assert_eq!(state_json["watches"][0]["id"], watch.id.to_string());
    assert!(
        database
            .remove_discord_watch(123, watch.id)
            .await?
            .is_some()
    );
    let unlinked = database
        .unlink_discord_by_discord_id(123)
        .await?
        .expect("linked Discord user");
    assert_eq!(unlinked.id_user, user.id);
    assert_eq!(unlinked.discord_id, Some(-1));
    database.update_discord_id(steam_id, Some(456)).await?;
    assert!(database.unlink_discord_by_steam_id(steam_id).await?);
    let discord_id: i64 = client
        .query_one(
            "SELECT discord_id FROM public.\"user\" WHERE id=$1",
            &[&user.id],
        )
        .await?
        .get(0);
    assert_eq!(discord_id, -1);
    client
        .execute("DELETE FROM public.\"user\" WHERE id=$1", &[&user.id])
        .await?;
    Ok(())
}
use zc_database::services::discord::DiscordLinkStatus;
