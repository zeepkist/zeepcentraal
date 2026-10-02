use anyhow::{Result, ensure};
use serde_json::{Value, json};
use zc_database::{
    Database,
    services::jobs::{MaintenanceOutcome, PlayerRankSnapshot},
};

fn snapshots(ids: std::ops::RangeInclusive<i32>) -> Vec<PlayerRankSnapshot> {
    ids.map(|id| PlayerRankSnapshot {
        id_user: id,
        points: 100,
        rank: id,
    })
    .collect()
}

async fn seed(client: &tokio_postgres::Client, first: i32, last: i32) -> Result<()> {
    client.execute("INSERT INTO public.user_points(id_user,points,rank) SELECT id,100,id+1 FROM generate_series($1::integer,$2::integer) id", &[&first, &last]).await?;
    Ok(())
}

async fn expire(client: &tokio_postgres::Client) -> Result<()> {
    client.batch_execute("UPDATE zc_private.discord_rank_batch_state SET window_started_at=clock_timestamp()-interval '3 minutes',last_change_at=clock_timestamp()-interval '2 minutes' WHERE changes<>'[]'::jsonb").await?;
    Ok(())
}

#[tokio::test(flavor = "multi_thread")]
#[ignore = "requires disposable local PostgreSQL named discord_rank_batches_test"]
async fn durable_batches_merge_restart_rollback_concurrency_and_deadlines() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/discord_rank_batches_test",
        "Dedicated disposable database required"
    );
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move {
        let _ = connection.await;
    });
    client.batch_execute(
        "CREATE SCHEMA zc_private; \
         DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='zeepcentraal_graphql') THEN CREATE ROLE zeepcentraal_graphql; END IF; END $$; \
         CREATE TABLE public.user_points (id_user integer PRIMARY KEY,points integer,rank integer,date_updated timestamptz); \
         CREATE TABLE public.discord_activity_event (id bigserial PRIMARY KEY,kind text,payload jsonb,occurred_at timestamptz DEFAULT clock_timestamp()); \
         INSERT INTO public.user_points VALUES(1,100,50,NULL)",
    ).await?;
    client
        .batch_execute(include_str!(
            "../migrations/20261002010000_discord_rank_batches/up.sql"
        ))
        .await?;
    let database = Database::connect(&url, 4).await?;
    for rank in [49, 47] {
        assert_eq!(
            database
                .persist_player_rank_batch(&[PlayerRankSnapshot {
                    id_user: 1,
                    points: 100,
                    rank
                }])
                .await?,
            MaintenanceOutcome::Applied(1)
        );
    }
    assert_eq!(database.flush_discord_rank_batches().await?, 0);
    let restarted = Database::connect(&url, 4).await?;
    assert_eq!(restarted.flush_discord_rank_batches().await?, 0);
    expire(&client).await?;
    let (first, second) = tokio::join!(
        database.flush_discord_rank_batches(),
        restarted.flush_discord_rank_batches()
    );
    assert_eq!(first? + second?, 1);
    let payload: String = client
        .query_one(
            "SELECT payload::text FROM public.discord_activity_event",
            &[],
        )
        .await?
        .get(0);
    let payload: Value = serde_json::from_str(&payload)?;
    assert_eq!(
        payload,
        json!({"changes":[{"idUser":1,"previousRank":50,"rank":47}]})
    );

    // Failure while emitting must roll back rank updates and accumulator changes together.
    seed(&client, 2, 51).await?;
    client.batch_execute("ALTER TABLE public.discord_activity_event ADD CONSTRAINT fixture_reject CHECK(false) NOT VALID").await?;
    assert!(
        database
            .persist_player_rank_batch(&snapshots(2..=51))
            .await
            .is_err()
    );
    assert_eq!(client.query_one("SELECT count(*) FROM public.user_points WHERE id_user BETWEEN 2 AND 51 AND rank=id_user+1", &[]).await?.get::<_, i64>(0), 50);
    assert_eq!(
        client
            .query_one(
                "SELECT changes::text FROM zc_private.discord_rank_batch_state",
                &[]
            )
            .await?
            .get::<_, String>(0),
        "[]"
    );
    client
        .batch_execute("ALTER TABLE public.discord_activity_event DROP CONSTRAINT fixture_reject")
        .await?;
    assert_eq!(
        database
            .persist_player_rank_batch(&snapshots(2..=51))
            .await?,
        MaintenanceOutcome::Applied(50)
    );
    assert_eq!(client.query_one("SELECT jsonb_array_length(payload->'changes') FROM public.discord_activity_event ORDER BY id DESC LIMIT 1", &[]).await?.get::<_, i32>(0), 50);

    seed(&client, 100, 150).await?;
    database
        .persist_player_rank_batch(&snapshots(100..=150))
        .await?;
    assert_eq!(
        client
            .query_one(
                "SELECT jsonb_array_length(changes) FROM zc_private.discord_rank_batch_state",
                &[]
            )
            .await?
            .get::<_, i32>(0),
        1
    );
    assert_eq!(database.flush_discord_rank_batches().await?, 0);
    expire(&client).await?;
    assert_eq!(database.flush_discord_rank_batches().await?, 1);

    // Concurrent producers merge into one shared durable window.
    seed(&client, 201, 249).await?;
    let left = snapshots(201..=220);
    let right = snapshots(221..=249);
    let (left, right) = tokio::join!(
        database.persist_player_rank_batch(&left),
        restarted.persist_player_rank_batch(&right)
    );
    assert_eq!(left?, MaintenanceOutcome::Applied(20));
    assert_eq!(right?, MaintenanceOutcome::Applied(29));
    assert_eq!(
        client
            .query_one(
                "SELECT jsonb_array_length(changes) FROM zc_private.discord_rank_batch_state",
                &[]
            )
            .await?
            .get::<_, i32>(0),
        49
    );
    // An arrival after deadline cannot extend or enter expired window.
    expire(&client).await?;
    seed(&client, 301, 301).await?;
    database
        .persist_player_rank_batch(&snapshots(301..=301))
        .await?;
    let payload: String = client
        .query_one(
            "SELECT payload::text FROM public.discord_activity_event ORDER BY id DESC LIMIT 1",
            &[],
        )
        .await?
        .get(0);
    let payload: Value = serde_json::from_str(&payload)?;
    assert_eq!(payload["changes"].as_array().unwrap().len(), 49);
    assert!(
        payload["changes"]
            .as_array()
            .unwrap()
            .iter()
            .all(|change| change["idUser"] != 301)
    );
    assert!(
        client
            .batch_execute(include_str!(
                "../migrations/20261002010000_discord_rank_batches/down.sql"
            ))
            .await
            .is_err()
    );
    // Hard cap fires despite recent activity.
    client.batch_execute("UPDATE zc_private.discord_rank_batch_state SET window_started_at=clock_timestamp()-interval '5 minutes',last_change_at=clock_timestamp()").await?;
    assert_eq!(restarted.flush_discord_rank_batches().await?, 1);
    assert_eq!(database.flush_discord_rank_batches().await?, 0);
    client
        .batch_execute(include_str!(
            "../migrations/20261002010000_discord_rank_batches/down.sql"
        ))
        .await?;
    client
        .batch_execute(include_str!(
            "../migrations/20261002010000_discord_rank_batches/up.sql"
        ))
        .await?;
    Ok(())
}
