use anyhow::{Result, ensure};
use zc_database::{Database, services::streamkist::AddWatch};

const UP: &str = include_str!("../migrations/20261010130000_streamkist/up.sql");
const DOWN: &str = include_str!("../migrations/20261010130000_streamkist/down.sql");

#[tokio::test(flavor = "multi_thread")]
#[ignore = "requires empty disposable local PostgreSQL named streamkist_test"]
async fn migration_quota_concurrency_scope_delivery_and_terminal_state() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/streamkist_test",
        "Dedicated disposable database required"
    );
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move {
        connection.await.expect("PostgreSQL connection");
    });
    client.batch_execute(UP).await?;
    client.batch_execute(DOWN).await?;
    client.batch_execute(UP).await?;
    let database = Database::connect(&url, 3).await?;
    let table_count: i64 = client
        .query_one(
            "SELECT count(*) FROM information_schema.tables WHERE table_schema='streamkist'",
            &[],
        )
        .await?
        .get(0);
    assert_eq!(table_count, 7);
    let (first, second) = tokio::join!(
        database.streamkist_add_watch("1", "10", "9", "Zeepkist"),
        database.streamkist_add_watch("1", "11", "8", "Other game"),
    );
    let first = first?;
    let second = second?;
    assert_eq!(
        usize::from(first == AddWatch::Added) + usize::from(second == AddWatch::Added),
        1
    );
    assert_eq!(
        usize::from(first == AddWatch::LimitReached)
            + usize::from(second == AddWatch::LimitReached),
        1
    );
    let watch = database.streamkist_watches(Some("1")).await?.remove(0);
    assert_eq!(
        database
            .streamkist_add_watch("1", &watch.channel_id, &watch.game_id, &watch.game_name)
            .await?,
        AddWatch::Duplicate
    );
    assert_eq!(
        database
            .streamkist_add_watch("2", "20", "9", "Zeepkist")
            .await?,
        AddWatch::Added
    );
    assert!(!database.streamkist_remove_watch("2", watch.id).await?);
    let snapshot = serde_json::json!({"fixture":true});
    let message = database
        .streamkist_reserve_message(watch.id, "stream-1", "user-1", &snapshot, 12)
        .await?
        .unwrap();
    database
        .streamkist_save_message(message.id, "100", &snapshot, 20, true)
        .await?;
    database
        .streamkist_save_message(message.id, "100", &snapshot, 2, false)
        .await?;
    let peak: i32 = client
        .query_one(
            "SELECT peak_viewers FROM streamkist.streams WHERE id=$1",
            &[&message.id],
        )
        .await?
        .get(0);
    assert_eq!(peak, 20);
    let other_watch = database.streamkist_watches(Some("2")).await?.remove(0);
    let other_message = database
        .streamkist_reserve_message(other_watch.id, "stream-1", "user-1", &snapshot, 12)
        .await?
        .unwrap();
    assert_ne!(message.id, other_message.id);
    assert!(database.streamkist_messages(watch.id).await?.is_empty());
    assert!(
        database
            .streamkist_reserve_message(watch.id, "stream-1", "user-1", &snapshot, 2)
            .await?
            .is_none()
    );
    assert!(database.streamkist_claim_poll("first").await?);
    assert!(!database.streamkist_claim_poll("second").await?);
    database.streamkist_release_poll("second").await?;
    assert!(!database.streamkist_claim_poll("second").await?);
    database.streamkist_release_poll("first").await?;
    assert!(database.streamkist_claim_poll("second").await?);
    assert!(database.streamkist_remove_watch("1", watch.id).await?);
    assert_eq!(
        database
            .streamkist_add_watch("1", "12", "9", "Zeepkist")
            .await?,
        AddWatch::Added
    );
    for limit in [3, 5] {
        client
            .execute(
                "UPDATE streamkist.guilds SET watch_limit=$1 WHERE guild_id='1'",
                &[&limit],
            )
            .await?;
        let active = database.streamkist_watches(Some("1")).await?.len();
        for number in active..usize::try_from(limit)? {
            assert_eq!(
                database
                    .streamkist_add_watch("1", &format!("plan-{number}"), "9", "Zeepkist")
                    .await?,
                AddWatch::Added
            );
        }
        assert_eq!(
            database
                .streamkist_add_watch("1", "over-limit", "9", "Zeepkist")
                .await?,
            AddWatch::LimitReached
        );
    }
    database
        .streamkist_log_command("ping", Some("1"), Some("12"), 5, &serde_json::json!([]))
        .await?;
    database
        .streamkist_log_command("ping", None, None, 6, &serde_json::json!([]))
        .await?;
    let count: i64 = client
        .query_one(
            "SELECT usage_count FROM streamkist.command_usage WHERE command_name='ping'",
            &[],
        )
        .await?
        .get(0);
    assert_eq!(count, 2);
    client.batch_execute(DOWN).await?;
    Ok(())
}
