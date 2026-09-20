use zc_database::Database;

#[tokio::test]
#[ignore = "requires PostgreSQL with current production-shaped schema"]
async fn discord_command_queries_execute_against_current_schema() -> anyhow::Result<()> {
    let database = Database::connect(&std::env::var("DATABASE_URL")?, 1).await?;
    let missing = "900000000000000000";

    assert!(
        database
            .discord_profile("discord", missing)
            .await?
            .is_none()
    );
    assert!(
        database
            .discord_user_statistics(missing.parse()?, "all-time", None, None)
            .await?
            .is_none()
    );
    assert!(database.discord_level_lookup(missing).await?.is_none());
    let _ = database.discord_level_search("zzzzzzzzzzzz").await?;
    let _ = database.discord_random_level(0).await?;
    let _ = database
        .discord_playlist_levels(missing.parse()?, 1, "points", false, false, false)
        .await?;
    assert!(
        database
            .discord_recommended_levels(missing.parse()?, 1)
            .await?
            .is_empty()
    );
    let _ = database.discord_tournament_snapshots().await?;
    assert!(
        database
            .discord_activity_events_after(i64::MAX - 1, 1)
            .await?
            .is_empty()
    );

    Ok(())
}
