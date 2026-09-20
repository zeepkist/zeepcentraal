#[tokio::test]
#[ignore = "requires disposable PostgreSQL with current Discord tables"]
async fn discord_runtime_services_preserve_json_and_monotonic_cursors() -> anyhow::Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    anyhow::ensure!(
        url::Url::parse(&url)?
            .host_str()
            .is_some_and(|host| matches!(host, "127.0.0.1" | "localhost")),
        "Discord integration test requires local disposable PostgreSQL"
    );
    let database = zc_database::Database::connect(&url, 2).await?;
    let suffix = i64::from(std::process::id());
    let guild_id = 10_000_000 + suffix;
    let channel_id = 20_000_000 + suffix;
    let role_id = 30_000_000 + suffix;
    let discord_id = 40_000_000 + suffix;
    let key = format!("rust-{suffix}");

    let role = database
        .set_discord_guild_linked_role(guild_id, Some(role_id))
        .await?;
    assert_eq!(role["linkedRoleId"], role_id.to_string());
    let feed = database
        .set_discord_guild_feed(guild_id, "world_record", channel_id, true)
        .await?;
    assert_eq!(feed["cursorEventId"], "0");
    assert!(
        database
            .advance_discord_guild_feed_cursor(guild_id, "world_record", 10)
            .await?
            .is_some()
    );
    assert!(
        database
            .advance_discord_guild_feed_cursor(guild_id, "world_record", 9)
            .await?
            .is_none()
    );
    let guild_id_string = guild_id.to_string();
    assert!(
        database
            .enabled_discord_guild_feeds()
            .await?
            .iter()
            .any(|feed| feed["guildId"].as_str() == Some(guild_id_string.as_str()))
    );

    assert_eq!(
        database.discord_worker_cursor(&key).await?["cursorEventId"],
        "0"
    );
    assert!(
        database
            .advance_discord_worker_cursor(&key, 11)
            .await?
            .is_some()
    );
    assert!(
        database
            .advance_discord_worker_cursor(&key, 10)
            .await?
            .is_none()
    );

    let digest = database
        .set_discord_digest(guild_id, channel_id, true, false, 6, 1, None)
        .await?;
    assert_eq!(digest["deliveryHour"], 6);
    let delivery = database
        .set_discord_delivery(guild_id, 12, channel_id, None, "pending", None)
        .await?;
    assert_eq!(delivery["status"], "pending");
    assert_eq!(
        database.discord_delivery(guild_id, 12).await?.unwrap()["eventId"],
        "12"
    );
    let tournament = database
        .set_discord_tournament_message(guild_id, 1, channel_id, channel_id + 1, "0123456789abcdef")
        .await?;
    assert_eq!(tournament["idTournament"], 1);

    let watch = database
        .add_discord_watch(discord_id, "player", " Target ")
        .await?;
    let matches = database
        .matching_discord_watches(&[("player".to_owned(), vec!["TARGET".to_owned()])])
        .await?;
    assert_eq!(matches.len(), 1);
    assert_eq!(matches[0]["id"], watch.id.to_string());
    let updated = database
        .update_discord_watch_delivery(watch.id, true, Some("closed"), Some("event:12"))
        .await?
        .unwrap();
    assert_eq!(updated["paused"], true);

    let state = database.discord_guild_state(guild_id).await?;
    assert_eq!(state["config"]["guildId"], guild_id.to_string());
    assert_eq!(state["feeds"].as_array().unwrap().len(), 1);
    assert_eq!(state["tournamentMessages"].as_array().unwrap().len(), 1);
    Ok(())
}
