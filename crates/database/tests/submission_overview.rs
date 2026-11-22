use anyhow::{Result, ensure};
use serde_json::json;
const UP: &str =
    include_str!("../migrations/20261011180000_submission_playlist_notifications/up.sql");
const DOWN: &str =
    include_str!("../migrations/20261011180000_submission_playlist_notifications/down.sql");
#[tokio::test]
#[ignore = "requires empty local zsl_submission_playlist_test database"]
async fn public_overview_and_playlist_migration() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1")
            && (parsed.path() == "/zsl_submission_playlist_test"
                || parsed
                    .path()
                    .strip_prefix("/zsl_submission_playlist_test_")
                    .is_some_and(
                        |suffix| !suffix.is_empty() && suffix.bytes().all(|c| c.is_ascii_digit())
                    )),
        "Disposable fixture required"
    );
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move {
        let _ = connection.await;
    });
    ensure!(
        client
            .query_one(
                include_str!("fixtures/submission_overview/to_regclass.sql"),
                &[]
            )
            .await?
            .get::<_, bool>(0),
        "Empty fixture required"
    );
    client
        .batch_execute(include_str!("fixtures/zsl_tournament.sql"))
        .await?;
    client
        .batch_execute(include_str!("fixtures/submission_playlist.sql"))
        .await?;
    client.batch_execute(UP).await?;
    client.batch_execute(DOWN).await?;
    client.batch_execute(UP).await?;
    client
        .batch_execute(include_str!(
            "fixtures/submission_overview/insert_zsl_points_structure.sql"
        ))
        .await?;
    let db = zc_database::Database::connect(&url, 2).await?;
    let snapshot = db.submission_overview(None).await?;
    assert_eq!(snapshot.contest.as_ref().unwrap()["roundId"], 1);
    assert_eq!(snapshot.total_count, 4);
    assert_eq!(snapshot.valid_count, 1);
    assert_eq!(snapshot.submissions[0].workshop_id, "9007199254740993");
    assert_eq!(snapshot.submissions[0].author_names, vec!["Alice", "Bob"]);
    assert_eq!(snapshot.submissions[0].level["authorName"], "Alice, Bob");
    let level = &snapshot.submissions[0].level;
    assert_eq!(level["points"], 321);
    assert!((level["rating"].as_f64().unwrap() - 0.8).abs() < 0.001);
    assert_eq!(level["recordCount"], 2);
    assert_eq!(level["personalBestCount"], 1);
    assert_eq!(level["voteCount"], 5);
    client
        .batch_execute(include_str!(
            "fixtures/submission_overview/delete_level_points.sql"
        ))
        .await?;
    let empty_metrics = db.submission_overview(Some(1)).await?;
    let level = &empty_metrics.submissions[0].level;
    assert!(level["points"].is_null());
    assert!(level["rating"].is_null());
    assert_eq!(level["recordCount"], 0);
    assert_eq!(level["personalBestCount"], 0);
    assert_eq!(level["voteCount"], 0);
    let members = [zc_database::services::inspector::InspectorPlaylistMember {
        id_validation: 1,
        workshop_id: 9007199254740993,
    }];
    let published = db
        .publish_inspector_playlist(
            1,
            1,
            "fixture-digest",
            "inspector/fixture.zeeplist",
            &members,
        )
        .await?;
    let queued = db.pending_playlist_notifications(&[1], "123").await?;
    assert_eq!(queued.len(), 1, "Publication queues delivery atomically");
    assert_eq!(queued[0]["playlistId"], published["id"]);
    assert!(
        db.publish_inspector_playlist(1, 999, "stale-digest", "inspector/stale.zeeplist", &members)
            .await
            .is_err()
    );
    assert_eq!(
        db.pending_playlist_notifications(&[1], "123").await?[0]["playlistId"],
        published["id"],
        "Rejected publication leaves delivery unchanged"
    );
    let other = db.submission_overview(Some(2)).await?;
    assert_eq!(other.total_count, 1);
    assert_eq!(other.valid_count, 0);
    assert!(db.submission_overview(Some(999)).await?.contest.is_none());
    client
        .execute(
            include_str!("fixtures/submission_overview/set_submission_end_zsl_round.sql"),
            &[],
        )
        .await?;
    assert_eq!(
        db.submission_overview(None).await?.contest.unwrap()["roundId"],
        2
    );
    client
        .execute(
            include_str!(
                "fixtures/submission_overview/set_payload_level_submission_validation.sql"
            ),
            &[&json!({"uid":"wrong","name":"Incomplete","sha256":"verified"}).to_string()],
        )
        .await?;
    assert_eq!(db.submission_overview(Some(1)).await?.valid_count, 0);
    Ok(())
}
