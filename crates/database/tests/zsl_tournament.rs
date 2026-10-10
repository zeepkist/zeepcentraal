use anyhow::{Result, ensure};
const UP: &str = include_str!("../migrations/20261010120000_zsl_tournament/up.sql");
const DOWN: &str = include_str!("../migrations/20261010120000_zsl_tournament/down.sql");
#[test]
fn tournament_migration_is_embedded() -> Result<()> {
    let migrations = diesel::migration::MigrationSource::<diesel::pg::Pg>::migrations(
        &zc_database::migrations::MIGRATIONS,
    )
    .map_err(|error| anyhow::anyhow!(error.to_string()))?;
    assert!(
        migrations
            .iter()
            .any(|migration| migration.name().version().to_string() == "20261010120000")
    );
    Ok(())
}

#[tokio::test]
#[ignore = "requires empty localhost PostgreSQL database named zsl_tournament_test"]
async fn tournament_locks_ranks_publication_and_rollback() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/zsl_tournament_test",
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
        .batch_execute(include_str!("fixtures/zsl_tournament.sql"))
        .await?;
    client.batch_execute("BEGIN").await?;
    client.batch_execute(UP).await?;
    client.batch_execute(DOWN).await?;
    assert!(
        client
            .query_one(
                "SELECT to_regclass('zc_private.zsl_tournament_state') IS NULL",
                &[]
            )
            .await?
            .get::<_, bool>(0)
    );
    client.batch_execute("ROLLBACK").await?;
    client.batch_execute(UP).await?;
    client.batch_execute("INSERT INTO zsl_points_structure VALUES(1,'Test',ARRAY[100,80,60],5,4); INSERT INTO zsl_season(id,id_points_structure,name) VALUES(1,1,'Season 1'); INSERT INTO zsl_round(id,id_season,name,round,event_date,event2_date) SELECT i,1,'Round',i,now()+interval '1 day',now()+interval '2 days' FROM generate_series(1,6) i; INSERT INTO level(id,hash,xx_hash) SELECT i,'legacy-'||i,lpad(i::text,32,'0') FROM generate_series(1,3) i;").await?;
    let database = zc_database::Database::connect(&url, 5).await?;
    let users = database
        .upsert_zsl_users(
            &(1..=4)
                .map(|i| (76561198000000000 + i, format!("Player {i}")))
                .collect::<Vec<_>>(),
        )
        .await?;
    let user = |i: i64| users[&(76561198000000000_i64 + i)];
    assert!(database.claim_zsl_event(1, "host-a").await?.is_some());
    assert!(database.claim_zsl_event(1, "host-b").await?.is_none());
    database
        .save_zsl_event(1, "host-a", &serde_json::json!({"phase":"tournament"}))
        .await?;
    let now = jiff::Timestamp::now();
    let deadline = now.as_second() + 600;
    let mut levels = Vec::new();
    for id in 1..=3 {
        levels.push(database.get_or_create_zsl_level(1, id).await?.id);
    }
    let concurrent = tokio::try_join!(
        database.get_or_create_zsl_level(1, 1),
        database.get_or_create_zsl_level(1, 1)
    )?;
    assert_eq!(concurrent.0.id, concurrent.1.id);
    database
        .open_zsl_level(1, "host-a", 1, 0, Some(levels[0]), deadline)
        .await?;
    for (i, time) in [
        (1, 10_000_000),
        (2, 10_000_000),
        (3, 10_000_001),
        (4, 12_000_000),
    ] {
        assert!(
            database
                .submit_zsl_finish(
                    1,
                    "host-a",
                    1,
                    levels[0],
                    user(i),
                    time,
                    now.as_millisecond()
                )
                .await?
        );
    }
    assert!(
        !database
            .submit_zsl_finish(
                1,
                "host-a",
                1,
                levels[0],
                user(1),
                11_000_000,
                now.as_millisecond()
            )
            .await?
    );
    assert!(
        !database
            .submit_zsl_finish(
                1,
                "host-a",
                1,
                levels[0],
                user(1),
                9_000_000,
                deadline * 1000
            )
            .await?
    );
    database.close_zsl_level(1, "host-a", 1, 0).await?;
    // Reopen is idempotent recovery, never unlocks closed records.
    database
        .open_zsl_level(1, "host-a", 1, 0, Some(levels[0]), deadline)
        .await?;
    assert!(
        !database
            .submit_zsl_finish(
                1,
                "host-a",
                1,
                levels[0],
                user(1),
                9_000_000,
                now.as_millisecond()
            )
            .await?
    );
    database
        .open_zsl_level(1, "host-a", 2, 0, Some(levels[0]), deadline)
        .await?;
    assert!(
        !database
            .submit_zsl_finish(
                1,
                "host-a",
                2,
                levels[0],
                user(1),
                8_000_000,
                now.as_millisecond()
            )
            .await?
    );
    // Player 1 has no Timeslot 1 finish on second level. DNF remains eligible.
    database
        .open_zsl_level(1, "host-a", 1, 1, Some(levels[1]), deadline)
        .await?;
    database.close_zsl_level(1, "host-a", 1, 1).await?;
    database
        .open_zsl_level(1, "host-a", 2, 1, Some(levels[1]), deadline)
        .await?;
    assert!(
        database
            .submit_zsl_finish(
                1,
                "host-a",
                2,
                levels[1],
                user(1),
                20_000_000,
                now.as_millisecond()
            )
            .await?
    );
    let (first, second) = tokio::try_join!(
        database.submit_zsl_finish(
            1,
            "host-a",
            2,
            levels[1],
            user(1),
            19_000_000,
            now.as_millisecond()
        ),
        database.close_zsl_level(1, "host-a", 2, 1)
    )?;
    let _ = (first, second);
    database
        .open_zsl_level(1, "host-a", 2, 2, Some(levels[2]), deadline)
        .await?;
    database
        .open_zsl_level(1, "host-a", 2, 3, None, deadline)
        .await?;
    assert!(database.publish_zsl_results(1, "host-a", 3).await.is_err());
    database.close_zsl_level(1, "host-a", 2, 0).await?;
    database.close_zsl_level(1, "host-a", 2, 2).await?;
    database.close_zsl_level(1, "host-a", 2, 3).await?;
    client.execute("INSERT INTO zsl_round_result(id_round,id_user,points,position) SELECT r,$1,r*100,1 FROM generate_series(2,6) r",&[&user(1)]).await?;
    database.publish_zsl_results(1, "host-a", 3).await?;
    database.publish_zsl_results(1, "host-a", 3).await?;
    let standings = client
        .query(
            "SELECT position,points FROM zsl_level_result WHERE id_level=$1 ORDER BY time,id_user",
            &[&levels[0]],
        )
        .await?;
    assert_eq!(
        standings
            .iter()
            .map(|row| row.get::<_, i32>(0))
            .collect::<Vec<_>>(),
        [1, 1, 3, 4]
    );
    assert_eq!(
        standings
            .iter()
            .map(|row| row.get::<_, i32>(1))
            .collect::<Vec<_>>(),
        [100, 100, 60, 5]
    );
    assert_eq!(
        client
            .query_one(
                "SELECT points FROM zsl_round_result WHERE id_round=1 AND id_user=$1",
                &[&user(1)]
            )
            .await?
            .get::<_, i32>(0),
        67
    );
    assert_eq!(
        client
            .query_one(
                "SELECT points FROM zsl_season_result WHERE id_season=1 AND id_user=$1",
                &[&user(1)]
            )
            .await?
            .get::<_, i32>(0),
        1800
    );
    assert_eq!(
        client
            .query_one("SELECT count(*) FROM zsl_level WHERE id_round=1", &[])
            .await?
            .get::<_, i64>(0),
        3
    );
    database.release_zsl_event(1, "host-a").await?;
    assert!(database.claim_zsl_event(1, "host-b").await?.is_some());
    assert!(
        database
            .save_zsl_event(1, "host-a", &serde_json::json!({}))
            .await
            .is_err()
    );
    Ok(())
}
