use anyhow::{Result, ensure};
use zc_database::{
    Database,
    services::streamkist::{AddWatch, StreamkistStats, WatchSettings},
};

const UP: &str = include_str!("../migrations/20261010130000_streamkist/up.sql");
const DOWN: &str = include_str!("../migrations/20261010130000_streamkist/down.sql");
const POLICY_UP: &str =
    include_str!("../migrations/20261011160000_streamkist_tracking_policy/up.sql");
const POLICY_DOWN: &str =
    include_str!("../migrations/20261011160000_streamkist_tracking_policy/down.sql");

#[tokio::test]
#[ignore = "requires empty disposable local PostgreSQL named streamkist_stats_test"]
async fn historical_stats_deduplicate_streams_and_retain_removed_watches() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/streamkist_stats_test",
        "Dedicated disposable database required"
    );
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move {
        connection.await.expect("PostgreSQL connection");
    });
    client.batch_execute(UP).await?;
    client.batch_execute(POLICY_UP).await?;
    let database = Database::connect(&url, 2).await?;
    assert_eq!(
        database.streamkist_stats().await?,
        StreamkistStats {
            streams: 0,
            streamers: 0,
            categories: 0,
            guilds: 0,
        }
    );
    client
        .batch_execute(include_str!("fixtures/streamkist/insert_guilds.sql"))
        .await?;
    let expected = StreamkistStats {
        streams: 3,
        streamers: 2,
        categories: 3,
        guilds: 2,
    };
    assert_eq!(database.streamkist_stats().await?, expected);
    client
        .batch_execute(include_str!(
            "fixtures/streamkist/set_deleted_at_channels.sql"
        ))
        .await?;
    assert_eq!(database.streamkist_stats().await?, expected);
    client.batch_execute(POLICY_DOWN).await?;
    client.batch_execute(DOWN).await?;
    Ok(())
}

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
    client
        .batch_execute(include_str!("fixtures/streamkist/insert_guilds_2.sql"))
        .await?;
    // Discord snowflakes order delivery, even when the older card's row was created later.
    client
        .batch_execute(include_str!(
            "fixtures/streamkist/set_created_at_streams.sql"
        ))
        .await?;
    client.batch_execute(POLICY_UP).await?;
    let canonical = client
        .query_one(
            include_str!("fixtures/streamkist/select_message_id_streams.sql"),
            &[],
        )
        .await?;
    assert_eq!(canonical.get::<_, String>(0), "9001");
    assert_eq!(canonical.get::<_, i32>(1), 30);
    assert_eq!(canonical.get::<_, String>(2), "30");
    assert_eq!(
        client
            .query_one(include_str!("fixtures/streamkist/count_streams.sql"), &[])
            .await?
            .get::<_, i64>(0),
        1
    );
    client
        .batch_execute(include_str!(
            "fixtures/streamkist/set_tracking_state_streams.sql"
        ))
        .await?;
    client.batch_execute(POLICY_DOWN).await?;
    let rolled_back = client
        .query_one(
            include_str!("fixtures/streamkist/select_is_live_streams.sql"),
            &[],
        )
        .await?;
    assert!(rolled_back.get::<_, bool>(0));
    assert!(rolled_back.get::<_, Option<String>>(1).is_none());
    assert!(!rolled_back.get::<_, bool>(2));
    client.batch_execute(POLICY_UP).await?;
    let database = Database::connect(&url, 6).await?;
    let settings = WatchSettings::default();
    let (first, second) = tokio::join!(
        database.streamkist_add_watch("1", "10", "9", "Zeepkist", settings),
        database.streamkist_add_watch("1", "11", "8", "Other game", settings)
    );
    let (first, second) = (first?, second?);
    assert_eq!(
        usize::from(first == AddWatch::Added) + usize::from(second == AddWatch::Added),
        1
    );
    assert_eq!(
        usize::from(first == AddWatch::LimitReached)
            + usize::from(second == AddWatch::LimitReached),
        1
    );
    let mut watch = database.streamkist_watches(Some("1")).await?.remove(0);
    assert_eq!(watch.minimum_viewers, 0);
    assert!(!watch.allow_category_switches);
    assert_eq!(watch.stream_limit, 15);
    assert_eq!(
        database
            .streamkist_add_watch(
                "1",
                &watch.channel_id,
                &watch.game_id,
                &watch.game_name,
                WatchSettings {
                    minimum_viewers: Some(5),
                    allow_category_switches: Some(true)
                }
            )
            .await?,
        AddWatch::Updated
    );
    assert_eq!(
        database
            .streamkist_add_watch(
                "1",
                &watch.channel_id,
                &watch.game_id,
                &watch.game_name,
                settings
            )
            .await?,
        AddWatch::Updated
    );
    watch = database.streamkist_watches(Some("1")).await?.remove(0);
    assert_eq!(watch.minimum_viewers, 5);
    assert!(watch.allow_category_switches);
    assert!(
        database
            .streamkist_add_watch(
                "1",
                &watch.channel_id,
                &watch.game_id,
                &watch.game_name,
                WatchSettings {
                    minimum_viewers: Some(-1),
                    ..settings
                }
            )
            .await
            .is_err()
    );
    let snapshot = serde_json::json!({"fixture":true,"ended_at":null,"peak_viewers":12});
    assert!(
        database
            .streamkist_reserve_message(&watch, "stream-1", "user-1", &snapshot, 4)
            .await?
            .is_none()
    );
    let message = database
        .streamkist_reserve_message(&watch, "stream-1", "user-1", &snapshot, 5)
        .await?
        .unwrap();
    assert!(message.activation_pending);
    database
        .streamkist_save_message(message.id, Some("100"), &snapshot, 20, "active", watch.id)
        .await?;
    let paused = serde_json::json!({"fixture":true,"ended_at":123,"category_stopped":true,"peak_viewers":20});
    database
        .streamkist_save_message(
            message.id,
            Some("100"),
            &paused,
            20,
            "category_paused",
            watch.id,
        )
        .await?;
    assert!(
        database
            .streamkist_messages()
            .await?
            .iter()
            .any(|row| row.id == message.id && row.tracking_state == "category_paused")
    );
    let resumed = database
        .streamkist_reserve_message(&watch, "stream-1", "user-1", &snapshot, 0)
        .await?
        .unwrap();
    assert_eq!(resumed.id, message.id);
    assert_eq!(resumed.message_id.as_deref(), Some("100"));
    database
        .streamkist_save_message(resumed.id, Some("100"), &snapshot, 2, "active", watch.id)
        .await?;
    assert_eq!(
        database
            .streamkist_messages()
            .await?
            .iter()
            .find(|row| row.id == message.id)
            .unwrap()
            .peak_viewers,
        20
    );
    database
        .streamkist_save_message(message.id, Some("100"), &paused, 20, "finished", watch.id)
        .await?;
    assert!(
        database
            .streamkist_reserve_message(&watch, "stream-1", "user-1", &snapshot, 12)
            .await?
            .is_none()
    );
    assert_eq!(
        database
            .streamkist_terminal_messages(&["stream-1".into()])
            .await?
            .len(),
        1
    );
    database
        .streamkist_add_watch(
            "1",
            &watch.channel_id,
            &watch.game_id,
            &watch.game_name,
            WatchSettings {
                minimum_viewers: Some(0),
                ..settings
            },
        )
        .await?;
    watch = database.streamkist_watches(Some("1")).await?.remove(0);
    // Pending sends consume slots even before a message ID or successful delivery exists.
    let mut handles = Vec::new();
    for index in 0..16 {
        let db = database.clone();
        let watch = watch.clone();
        let snapshot = snapshot.clone();
        handles.push(tokio::spawn(async move {
            db.streamkist_reserve_message(&watch, &format!("pending-{index}"), "42", &snapshot, 12)
                .await
        }));
    }
    let mut reserved = Vec::new();
    for handle in handles {
        if let Some(row) = handle.await?? {
            reserved.push(row);
        }
    }
    assert_eq!(reserved.len(), 15);
    assert!(
        database
            .streamkist_reserve_message(&watch, "over-limit", "42", &snapshot, 12)
            .await?
            .is_none()
    );
    // Simulate failed pause: leave row unchanged; capacity remains occupied.
    assert!(
        database
            .streamkist_reserve_message(&watch, "replacement", "42", &snapshot, 12)
            .await?
            .is_none()
    );
    database
        .streamkist_save_message(reserved[0].id, None, &paused, 12, "limit_paused", watch.id)
        .await?;
    assert!(
        database
            .streamkist_reserve_message(&watch, "replacement", "42", &snapshot, 12)
            .await?
            .is_some()
    );
    client
        .execute(
            include_str!("fixtures/streamkist/set_watch_limit_guilds.sql"),
            &[],
        )
        .await?;
    database
        .streamkist_add_watch("1", "second-channel", "9", "Zeepkist", settings)
        .await?;
    database
        .streamkist_add_watch(
            "1",
            &watch.channel_id,
            "additional-category",
            "Other game",
            settings,
        )
        .await?;
    let watches = database.streamkist_watches(Some("1")).await?;
    assert!(watches.iter().all(|watch| watch.stream_limit == 30));
    let same_channel = watches
        .iter()
        .find(|other| other.game_id == "additional-category")
        .unwrap();
    let same = database
        .streamkist_reserve_message(same_channel, &reserved[1].stream_id, "42", &snapshot, 12)
        .await?
        .unwrap();
    assert_eq!(same.id, reserved[1].id);
    let second_channel = watches
        .iter()
        .find(|other| other.channel_id == "second-channel")
        .unwrap();
    let another = database
        .streamkist_reserve_message(second_channel, &reserved[1].stream_id, "42", &snapshot, 12)
        .await?
        .unwrap();
    assert_ne!(same.id, another.id);
    for index in 0..15 {
        assert!(
            database
                .streamkist_reserve_message(&watch, &format!("paid-{index}"), "42", &snapshot, 12)
                .await?
                .is_some()
        );
    }
    assert!(
        database
            .streamkist_reserve_message(&watch, "paid-overflow", "42", &snapshot, 12)
            .await?
            .is_none()
    );
    client
        .execute(
            include_str!("fixtures/streamkist/set_watch_limit_guilds_by_guild_id_1.sql"),
            &[],
        )
        .await?;
    assert!(
        database
            .streamkist_watches(Some("1"))
            .await?
            .iter()
            .all(|watch| watch.stream_limit == 30)
    );
    client
        .execute(
            include_str!("fixtures/streamkist/set_watch_limit_guilds_by_guild_id_1_2.sql"),
            &[],
        )
        .await?;
    assert!(
        database
            .streamkist_reserve_message(&watch, "downgrade-overflow", "42", &snapshot, 12)
            .await?
            .is_none()
    );
    database
        .streamkist_add_watch("2", "20", "9", "Zeepkist", settings)
        .await?;
    let other_watch = database.streamkist_watches(Some("2")).await?.remove(0);
    assert!(
        database
            .streamkist_reserve_message(&other_watch, "replacement", "42", &snapshot, 0)
            .await?
            .is_some()
    );
    let mut forged = other_watch.clone();
    forged.id = watch.id;
    assert!(
        database
            .streamkist_reserve_message(&forged, "wrong-server", "42", &snapshot, 12)
            .await?
            .is_none()
    );
    forged = other_watch.clone();
    forged.channel_id = "wrong-channel".into();
    assert!(
        database
            .streamkist_reserve_message(&forged, "wrong-channel", "42", &snapshot, 12)
            .await?
            .is_none()
    );
    assert!(!database.streamkist_remove_watch("2", watch.id).await?);
    assert!(database.streamkist_claim_poll("first").await?);
    assert!(!database.streamkist_claim_poll("second").await?);
    database.streamkist_release_poll("first").await?;
    assert!(database.streamkist_claim_poll("second").await?);
    database.streamkist_release_poll("second").await?;
    database
        .streamkist_log_command("ping", Some("1"), Some("10"), 5, &serde_json::json!([]))
        .await?;
    client.batch_execute(POLICY_DOWN).await?;
    client.batch_execute(DOWN).await?;
    Ok(())
}
