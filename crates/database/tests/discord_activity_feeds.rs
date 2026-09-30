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
    client.batch_execute(r#"
        CREATE SCHEMA zc_private;
        CREATE TABLE public."user" (id integer PRIMARY KEY, steam_id bigint, steam_name varchar(255), discord_id bigint);
        CREATE TABLE public.user_points (id_user integer PRIMARY KEY, points integer);
        CREATE TABLE public.level (id integer PRIMARY KEY, xx_hash text NOT NULL, publicly_visible boolean);
        CREATE TABLE public.level_item (id integer PRIMARY KEY, id_level integer, deleted boolean, updated_at timestamptz, name text, image_url text, workshop_id bigint, author_id bigint);
        CREATE TABLE public.level_points (id_level integer PRIMARY KEY, points integer, rating real);
        CREATE TABLE public.personal_best_global (id_level integer);
        CREATE TABLE public.record (id integer PRIMARY KEY, time real, mod_version text);
        CREATE TABLE public.discord_activity_event (id bigint PRIMARY KEY, kind text, id_level integer, id_user integer, id_previous_user integer, id_record integer, id_previous_record integer, payload jsonb, occurred_at timestamptz);
        CREATE TABLE zc_private.discord_guild_feed (guild_id bigint, kind text, channel_id bigint, enabled boolean, cursor_event_id bigint, date_created timestamptz DEFAULT now(), date_updated timestamptz DEFAULT now(), PRIMARY KEY(guild_id,kind));
        CREATE TABLE zc_private.discord_worker_state (key text PRIMARY KEY, cursor_event_id bigint, date_updated timestamptz DEFAULT now());
        INSERT INTO public."user" VALUES (1,76561198000000001,'Fixture player',123456789012345678),(2,NULL,NULL,NULL);
        INSERT INTO public.user_points VALUES (1,123000);
        INSERT INTO public.level VALUES (1,'fixture-visible',true),(2,'fixture-hidden',false);
        INSERT INTO public.level_item VALUES (1,1,false,now(),'Fixture track','https://example.com/track.jpg',1,76561198000000001);
        INSERT INTO public.level_points VALUES (1,1000,0.75);
        INSERT INTO public.record VALUES (1,49.332,'1.0');
        INSERT INTO public.personal_best_global VALUES (1);
        INSERT INTO public.discord_activity_event(id,kind,id_level,id_user,id_record,payload,occurred_at)
        SELECT id,CASE id WHEN 501 THEN 'world_record' WHEN 502 THEN 'workshop' WHEN 503 THEN 'rank_batch' ELSE 'personal_best' END,
            CASE WHEN id=503 THEN NULL ELSE 1 END,1,1,
            CASE WHEN id=503 THEN '{"changes":[{"idUser":1,"previousRank":2,"rank":1}]}'::jsonb ELSE '{}'::jsonb END,
            '2026-10-05T06:00:00Z'::timestamptz FROM generate_series(1,503) id;
        INSERT INTO public.discord_activity_event(id,kind,id_level,payload,occurred_at) VALUES (504,'workshop',2,'{}',now());
        INSERT INTO zc_private.discord_guild_feed(guild_id,kind,channel_id,enabled,cursor_event_id) VALUES (1,'world_record',2,true,0);
        INSERT INTO zc_private.discord_worker_state(key,cursor_event_id) VALUES ('watch-events',500);
    "#).await?;
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
