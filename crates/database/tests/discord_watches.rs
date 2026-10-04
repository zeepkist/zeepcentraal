use anyhow::{Result, ensure};
use serde_json::{Value, json};
use zc_database::Database;

#[tokio::test]
#[ignore = "requires disposable local PostgreSQL named discord_watches_test"]
async fn existing_player_watch_aliases_match_canonical_record_and_rank_players() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/discord_watches_test",
        "Dedicated disposable database required"
    );
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move {
        let _ = connection.await;
    });
    client.batch_execute(r#"
        CREATE SCHEMA zc_private;
        CREATE TABLE public."user" (id integer PRIMARY KEY, steam_id bigint UNIQUE, steam_name varchar(255), discord_id bigint UNIQUE);
        CREATE TABLE zc_private.discord_watch (
            id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            discord_id bigint NOT NULL, kind text NOT NULL, target_id text NOT NULL,
            paused boolean NOT NULL DEFAULT false, last_error text, last_delivery_key text,
            date_created timestamptz NOT NULL DEFAULT now(), date_updated timestamptz NOT NULL DEFAULT now(),
            UNIQUE(discord_id,kind,target_id)
        );
        INSERT INTO public."user" VALUES
            (11,76561198000000011,'FiXtUrE Ω🦀 player',555000000000000111), (12,NULL,NULL,NULL),
            (13,76561198000000013,'FiXtUrE Ω🦀 player',555000000000000113),
            (14,76561198000000014,'11',555000000000000114);
        INSERT INTO public."user"
            SELECT id,76561198000000000+id,'Batch ' || id,666000000000000000+id
            FROM generate_series(101,150) id;
    "#).await?;
    let database = Database::connect(&url, 2).await?;
    let owner = 123000000000000111;
    let owner_string = owner.to_string();
    let other_owner = 123000000000000222;
    let mut expected = Vec::new();
    for alias in [
        "11",
        "76561198000000011",
        " FiXtUrE Ω🦀 player ",
        "555000000000000111",
        "<@555000000000000111>",
        "<@!555000000000000111>",
    ] {
        expected.push(
            database
                .add_discord_watch(owner, "player", alias)
                .await?
                .id
                .to_string(),
        );
    }
    let direct_name_watch = expected[2].clone();
    expected.push(
        database
            .add_discord_watch(other_owner, "player", "<@555000000000000111>")
            .await?
            .id
            .to_string(),
    );
    let paused = database
        .add_discord_watch(123000000000000333, "player", "555000000000000111")
        .await?;
    database
        .update_discord_watch_delivery(paused.id, true, Some("closed"), Some("event:1"))
        .await?;
    let unlinked = database.add_discord_watch(owner, "player", "12").await?;
    let deleted = database.add_discord_watch(owner, "player", "99").await?;
    database
        .add_discord_watch(owner, "author", "555000000000000111")
        .await?;

    let matches = database
        .matching_discord_watches(&[
            ("player".into(), vec!["11".into(), "11".into()]),
            ("player".into(), vec!["555000000000000111".into()]),
        ])
        .await?;
    assert_eq!(ids(&matches), expected);
    assert!(matches.iter().all(|watch| watch["matchedPlayerIds"] == json!([11])));
    assert!(
        matches
            .iter()
            .all(|watch| watch["discordId"] != "555000000000000111")
    );
    assert_eq!(
        matches.last().unwrap()["discordId"],
        other_owner.to_string()
    );
    let collisions = database
        .matching_discord_watches(&[
            ("player".into(), vec!["11".into()]),
            ("player".into(), vec!["13".into(), "14".into()]),
            ("player".into(), vec!["11".into()]),
        ])
        .await?;
    assert_eq!(ids(&collisions), expected);
    for watch in &collisions {
        let players = match watch["targetId"].as_str().unwrap() {
            "fixture ω🦀 player" => json!([11, 13]),
            "11" => json!([11, 14]),
            _ => json!([11]),
        };
        assert_eq!(watch["matchedPlayerIds"], players);
    }
    let deleted_matches = database
        .matching_discord_watches(&[("player".into(), vec!["99".into()])])
        .await?;
    assert_eq!(deleted_matches[0]["matchedPlayerIds"], json!([99]));
    let author_matches = database
        .matching_discord_watches(&[("author".into(), vec!["555000000000000111".into()])])
        .await?;
    assert_eq!(author_matches[0]["matchedPlayerIds"], json!([]));
    assert_eq!(
        ids(&database
            .matching_discord_watches(&[("player".into(), vec![" FIXTURE Ω🦀 PLAYER ".into()])])
            .await?),
        vec![direct_name_watch]
    );
    assert_eq!(
        ids(&database
            .matching_discord_watches(&[("player".into(), vec!["12".into()])])
            .await?),
        vec![unlinked.id.to_string()]
    );
    assert_eq!(
        ids(&database
            .matching_discord_watches(&[("player".into(), vec!["99".into()])])
            .await?),
        vec![deleted.id.to_string()]
    );

    let mut batch_watches = Vec::new();
    for id in 101..=150 {
        batch_watches.push(
            database
                .add_discord_watch(owner, "player", &(666000000000000000_i64 + id).to_string())
                .await?
                .id
                .to_string(),
        );
    }
    let batch = database
        .matching_discord_watches(&[(
            "player".into(),
            (101..=150).map(|id| id.to_string()).collect(),
        )])
        .await?;
    assert_eq!(ids(&batch), batch_watches);
    assert_eq!(batch.len(), 50);
    for (watch, id) in batch.iter().zip(101..=150) {
        assert_eq!(watch["matchedPlayerIds"], json!([id]));
    }
    assert!(
        batch
            .iter()
            .all(|watch| watch["discordId"].as_str() == Some(owner_string.as_str()))
    );
    let owner_state = database
        .matching_discord_watches(&[("player".into(), vec!["11".into()])])
        .await?;
    assert_eq!(ids(&owner_state), expected); // Matching does not resume paused watches or change delivery keys.
    Ok(())
}

fn ids(watches: &[Value]) -> Vec<String> {
    watches
        .iter()
        .map(|watch| watch["id"].as_str().unwrap().to_owned())
        .collect()
}
