use anyhow::{Result, ensure};
use serde_json::json;
use zc_database::Database;

#[tokio::test]
#[ignore = "requires disposable local PostgreSQL named discord_feeds_test"]
async fn activity_pages_and_rank_users_preserve_nullable_fields_and_cursors() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/discord_feeds_test",
        "Dedicated disposable database required"
    );
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move {
        let _ = connection.await;
    });
    // Only production-shaped columns used by these services are needed.
    client
        .batch_execute(include_str!(
            "fixtures/discord_activity_feeds/create_zc_private.sql"
        ))
        .await?;
    let database = Database::connect(&url, 2).await?;
    let users = database.discord_users_lookup(&[2, 1, 1, 999]).await?;
    assert_eq!(
        users,
        vec![
            json!({"id":1,"steamName":"Fixture player","discordId":"123456789012345678","points":123000}),
            json!({"id":2,"steamName":null,"discordId":null,"points":null})
        ]
    );
    assert!(database.discord_users_lookup(&[]).await?.is_empty());
    let first = database.discord_activity_events_after(0, 500).await?;
    assert_eq!(first.len(), 500);
    assert_eq!(first[0]["id"], "1");
    assert_eq!(first[499]["id"], "500");
    assert_eq!(
        first[0]["level"]["levelItems"]["nodes"][0]["imageUrl"],
        "https://example.com/track.jpg"
    );
    database
        .advance_discord_guild_feed_cursor(1, "world_record", 500)
        .await?;
    let next = database.discord_activity_events_after(500, 500).await?;
    assert_eq!(
        next.iter()
            .map(|event| event["kind"].as_str().unwrap())
            .collect::<Vec<_>>(),
        vec!["world_record", "workshop", "rank_batch"]
    );
    assert!(next[2]["level"].is_null());
    assert_eq!(next[2]["payload"]["changes"][0]["idUser"], 1);
    assert_eq!(
        database.discord_worker_cursor("watch-events").await?["cursorEventId"],
        "500"
    );
    database
        .advance_discord_worker_cursor("watch-events", 503)
        .await?;
    assert_eq!(
        database.discord_worker_cursor("watch-events").await?["cursorEventId"],
        "503"
    );
    assert!(
        database
            .advance_discord_guild_feed_cursor(1, "world_record", 499)
            .await?
            .is_none()
    );
    assert_eq!(
        database.enabled_discord_guild_feeds().await?[0]["cursorEventId"],
        "500"
    );
    Ok(())
}
