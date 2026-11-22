use anyhow::{Result, ensure};
use zc_database::{Database, adoption, migrations};

const UP: &str = include_str!("../migrations/20260928030000_zsl_announcement/up.sql");
const DOWN: &str = include_str!("../migrations/20260928030000_zsl_announcement/down.sql");

#[tokio::test(flavor = "multi_thread")]
#[ignore = "requires disposable adopted PostgreSQL named zsl_announcement_test before announcement migration"]
async fn announcement_migration_and_contest_metadata() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/zsl_announcement_test",
        "Dedicated local disposable database required"
    );
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move {
        let _ = connection.await;
    });
    client
        .batch_execute(include_str!(
            "fixtures/zsl_announcement/insert_zsl_points_structure.sql"
        ))
        .await?;
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    adoption::run(
        &url,
        &root.join("packages/database/drizzle"),
        adoption::Mode::Verify,
    )
    .await?;
    assert_eq!(migrations::run_pending(&url).await?, vec!["20260928030000"]);
    assert!(migrations::run_pending(&url).await?.is_empty());
    adoption::run(
        &url,
        &root.join("packages/database/drizzle"),
        adoption::Mode::Verify,
    )
    .await?;
    let db = Database::connect(&url, 2).await?;
    let contests = db.submission_contests(None, Some(50)).await?;
    assert_eq!(contests[0]["steamAnnouncementId"], "705530288588981646");
    let viewer = db.viewer_submission(Some(50), "76561198000000001").await?;
    assert_eq!(
        viewer["contest"]["steamAnnouncementId"],
        "705530288588981646"
    );
    assert_eq!(viewer["submission"]["id"], 9000);
    let unconfigured = client
        .query_one(
            include_str!("fixtures/zsl_announcement/select_steam_announcement_id_zsl_round.sql"),
            &[],
        )
        .await?;
    assert_eq!(unconfigured.get::<_, Option<i64>>(0), None);
    for invalid in [0_i64, -1] {
        assert!(
            client
                .execute(
                    include_str!(
                        "fixtures/zsl_announcement/set_steam_announcement_id_zsl_round.sql"
                    ),
                    &[&invalid]
                )
                .await
                .is_err()
        );
    }
    db.get_or_create_zsl_round(8, 1, "Imported name", 999, "2026-10-11")
        .await?;
    let round = client
        .query_one(
            include_str!(
                "fixtures/zsl_announcement/select_steam_announcement_id_zsl_round_by_id_50.sql"
            ),
            &[],
        )
        .await?;
    assert_eq!(round.get::<_, i64>(0), 705530288588981646);
    assert_eq!(round.get::<_, i64>(1), 123);
    let preserved = client
        .query_one(
            include_str!("fixtures/zsl_announcement/select_state_level_submission_vote.sql"),
            &[],
        )
        .await?;
    assert_eq!(preserved.get::<_, &str>(0), "frozen");
    assert_eq!(preserved.get::<_, i64>(1), 9000);
    assert_eq!(preserved.get::<_, &str>(2), "a".repeat(64));
    assert_eq!(preserved.get::<_, i64>(3), 1);
    let votes = db
        .super_league_vote_snapshot(Some(50), 9000, "76561198000000099")
        .await?
        .unwrap();
    assert_eq!(votes.candidates.len(), 1);
    assert_eq!(votes.votes[0], vec![9000]);
    // Exercise null, seed preservation and reversible DDL without changing the final fixture.
    client
        .batch_execute(include_str!("fixtures/zsl_announcement/begin.sql"))
        .await?;
    client
        .batch_execute(include_str!(
            "fixtures/zsl_announcement/set_steam_announcement_id_zsl_round_by_id_50.sql"
        ))
        .await?;
    client
        .batch_execute(
            &include_str!("fixtures/zsl_announcement/backfill_announcement.sql")
                .replace("{{update_body}}", UP.split_once("UPDATE ").unwrap().1),
        )
        .await?;
    assert_eq!(
        client
            .query_one(
                include_str!("fixtures/zsl_announcement/select_steam_announcement_id_zsl_round_by_id_50_2.sql"),
                &[]
            )
            .await?
            .get::<_, i64>(0),
        123
    );
    client
        .batch_execute(include_str!(
            "fixtures/zsl_announcement/set_steam_announcement_id_zsl_round_by_id_50_2.sql"
        ))
        .await?;
    assert!(db.submission_contests(None, Some(51)).await?[0]["steamAnnouncementId"].is_null());
    client.batch_execute(DOWN).await?;
    client.batch_execute(UP).await?;
    client
        .batch_execute(include_str!("fixtures/zsl_announcement/rollback.sql"))
        .await?;
    Ok(())
}
