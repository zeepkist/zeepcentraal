use anyhow::{Result, ensure};
use zc_database::{
    Database,
    services::{jobs::MaintenanceOutcome, record::RecordSubmission},
};

const TRUNCATE_JOB: &str = include_str!("fixtures/available_record_counts/truncate_job.sql");
const SET_DELETED_LEVEL_ITEM: &str =
    include_str!("fixtures/available_record_counts/set_deleted_level_item.sql");

const UP: &str = include_str!("../migrations/20261013010000_available_record_counts/up.sql");
const DOWN: &str = include_str!("../migrations/20261013010000_available_record_counts/down.sql");

#[tokio::test]
#[ignore = "requires isolated local available_record_counts_test cloned from current schema"]
async fn availability_counts_backfill_workshop_refresh_and_rollback() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/available_record_counts_test",
        "Isolated local count database required"
    );
    let (mut client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("count fixture connection") });
    if client
        .query_one(
            include_str!("fixtures/available_record_counts/to_regprocedure.sql"),
            &[],
        )
        .await?
        .get::<_, bool>(0)
    {
        client.batch_execute(DOWN).await?;
    }
    client
        .batch_execute(include_str!(
            "fixtures/available_record_counts/truncate_user.sql"
        ))
        .await?;
    client.batch_execute(UP).await?;
    assert_eq!(counts(&client, 1).await?, (1, 1));
    assert_eq!(counts(&client, 2).await?, (2, 1));
    assert_eq!(counts(&client, 56).await?, (1, 0));
    let preserved = client
        .query_one(
            include_str!("fixtures/available_record_counts/select_points_user_points.sql"),
            &[],
        )
        .await?;
    assert_eq!(
        (
            preserved.get::<_, i32>(0),
            preserved.get::<_, i32>(1),
            preserved.get::<_, i32>(2)
        ),
        (42, 99, 7)
    );
    let db = Database::connect(&url, 4).await?;
    db.save_record_validation(
        59,
        None,
        &zc_core::ghost_validation::ValidationReport::failed("missing_checkpoint"),
    )
    .await?;
    assert_eq!(
        db.recalculate_player_score(2).await?,
        MaintenanceOutcome::Applied(())
    );
    assert_eq!(counts(&client, 2).await?, (1, 0));
    client
        .execute(
            include_str!("fixtures/available_record_counts/set_date_updated_user_points.sql"),
            &[],
        )
        .await?;
    db.recalculate_player_score(2).await?;
    assert!(
        client
            .query_one(
                include_str!(
                    "fixtures/available_record_counts/select_date_updated_user_points.sql"
                ),
                &[]
            )
            .await?
            .get::<_, bool>(0)
    );

    // Partial removal keeps duplicate uploads counted exactly once.
    db.mark_workshop_deleted(1, 2).await?;
    db.recalculate_player_score(1).await?;
    assert_eq!(counts(&client, 1).await?, (1, 1));
    client.execute(TRUNCATE_JOB, &[]).await?;
    db.mark_missing_workshop_levels_deleted(2, &[]).await?;
    assert_eq!(queued_cursor(&client).await?, 1);
    let first = db.level_record_count_user_page(1, 0).await?;
    assert_eq!(first.user_ids, (1..=50).collect::<Vec<_>>());
    let last = db
        .level_record_count_user_page(1, first.next_after_user_id.unwrap())
        .await?;
    assert_eq!(last.user_ids, (51..=56).collect::<Vec<_>>());
    assert_eq!(last.next_after_user_id, None);
    for id in first.user_ids.into_iter().chain(last.user_ids) {
        db.recalculate_player_score(id).await?;
        assert_eq!(counts(&client, id).await?, (0, 0));
    }

    // Rolled-back restoration cannot queue work or change count sources.
    client.execute(TRUNCATE_JOB, &[]).await?;
    let transaction = client.transaction().await?;
    transaction.execute(SET_DELETED_LEVEL_ITEM, &[]).await?;
    transaction.rollback().await?;
    assert_eq!(queued_cursor(&client).await?, 0);
    client.execute(SET_DELETED_LEVEL_ITEM, &[]).await?;
    assert_eq!(queued_cursor(&client).await?, 1);
    db.recalculate_player_score(1).await?;
    assert_eq!(counts(&client, 1).await?, (1, 1));

    // Real WR transfer refreshes both holders, independently of score contributions.
    client
        .execute(
            include_str!("fixtures/available_record_counts/setval.sql"),
            &[],
        )
        .await?;
    client.execute(TRUNCATE_JOB, &[]).await?;
    let statistics = zc_core::ghosts::GhostStatistics::default();
    let transferred = db
        .submit_record(RecordSubmission {
            evidence: None,
            id_user: 2,
            id_level: 1,
            time: 9.0,
            game_version: "test",
            mod_version: "test",
            splits: &[],
            speeds: &[],
            statistics: &statistics,
        })
        .await?;
    assert_eq!(transferred.world_record_user_ids, vec![1, 2]);
    assert_eq!(
        client
            .query_one(
                include_str!("fixtures/available_record_counts/count_job.sql"),
                &[]
            )
            .await?
            .get::<_, i64>(0),
        2
    );
    db.recalculate_player_score(1).await?;
    db.recalculate_player_score(2).await?;
    assert_eq!(counts(&client, 1).await?, (1, 0));
    assert_eq!(counts(&client, 2).await?, (1, 1));

    // Metadata-only scans do not restart count work. Reassignment refreshes both levels.
    client.execute(TRUNCATE_JOB, &[]).await?;
    client
        .execute(
            include_str!("fixtures/available_record_counts/set_name_level_item.sql"),
            &[],
        )
        .await?;
    assert_eq!(queued_cursor(&client).await?, 0);
    client
        .execute(
            include_str!("fixtures/available_record_counts/set_id_level_level_item.sql"),
            &[],
        )
        .await?;
    assert_eq!(queued_cursor(&client).await?, 2);
    db.recalculate_player_score(1).await?;
    db.recalculate_player_score(2).await?;
    assert_eq!(counts(&client, 1).await?, (0, 0));
    assert_eq!(counts(&client, 2).await?, (1, 1));
    db.reconcile_missing_workshop_items(&[2]).await?;
    db.recalculate_player_score(2).await?;
    assert_eq!(counts(&client, 2).await?, (0, 0));

    // Projection changes queue users even when no score contribution exists.
    client.execute(TRUNCATE_JOB, &[]).await?;
    let improved = db
        .submit_record(RecordSubmission {
            evidence: None,
            id_user: 1,
            id_level: 1,
            time: 9.0,
            game_version: "test",
            mod_version: "test",
            splits: &[],
            speeds: &[],
            statistics: &statistics,
        })
        .await?;
    assert!(improved.personal_best_changed);
    assert!(improved.world_record_user_ids.is_empty());
    assert!(
        client
            .query_one(
                include_str!("fixtures/available_record_counts/exists.sql"),
                &[]
            )
            .await?
            .get::<_, bool>(0)
    );
    client.batch_execute(DOWN).await?;
    assert_eq!(
        client
            .query_one(
                include_str!(
                    "fixtures/available_record_counts/select_world_records_user_points.sql"
                ),
                &[]
            )
            .await?
            .get::<_, i32>(0),
        1
    );
    client.batch_execute(UP).await?;
    assert_eq!(counts(&client, 1).await?, (0, 0));
    Ok(())
}

async fn counts(client: &tokio_postgres::Client, user: i32) -> Result<(i32, i32)> {
    let row = client
        .query_one(
            include_str!("fixtures/available_record_counts/select_personal_bests_user_points.sql"),
            &[&user],
        )
        .await?;
    Ok((row.get(0), row.get(1)))
}
async fn queued_cursor(client: &tokio_postgres::Client) -> Result<i64> {
    Ok(client
        .query_one(
            include_str!(
                "fixtures/available_record_counts/count_job_by_task_update_level_record_counts.sql"
            ),
            &[],
        )
        .await?
        .get(0))
}
