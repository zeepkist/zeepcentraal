use anyhow::{Result, ensure};
use tokio_postgres::{Client, NoTls};

const SELECT_TOTAL_POINTS_TRACK_TOURNAMENT_OVERALL_STANDING: &str = include_str!(
    "fixtures/track_tournament_overall/select_total_points_track_tournament_overall_standing.sql"
);
const SELECT_LAST_UPDATED_AT_TRACK_TOURNAMENT_OVERALL_PERIOD: &str = include_str!(
    "fixtures/track_tournament_overall/select_last_updated_at_track_tournament_overall_period.sql"
);
const SELECT_TOTAL_POINTS_TRACK_TOURNAMENT_OVERALL_STANDING_BY_TYPE_0: &str = include_str!(
    "fixtures/track_tournament_overall/select_total_points_track_tournament_overall_standing_by_type_0.sql"
);
const COUNT_TRACK_TOURNAMENT_OVERALL_STANDING: &str =
    include_str!("fixtures/track_tournament_overall/count_track_tournament_overall_standing.sql");
const SET_LOCAL_ROLE_ZEEPCENTRAAL_GRAPHQL: &str =
    include_str!("fixtures/track_tournament_overall/set_local_role_zeepcentraal_graphql.sql");
const COUNT_TRACK_TOURNAMENT_OVERALL_PERIOD: &str =
    include_str!("fixtures/track_tournament_overall/count_track_tournament_overall_period.sql");
const HAS_FUNCTION_PRIVILEGE: &str =
    include_str!("fixtures/track_tournament_overall/has_function_privilege.sql");
const REFRESH_TRACK_TOURNAMENT_OVERALL: &str =
    include_str!("fixtures/track_tournament_overall/refresh_track_tournament_overall.sql");
const SELECT_CONNAME_PG_CONSTRAINT: &str =
    include_str!("fixtures/track_tournament_overall/select_conname_pg_constraint.sql");
const SELECT_ELIGIBLE_EVENT_COUNT_TRACK_TOURNAMENT_OVERALL_PERIOD_BY_TYPE_2: &str = include_str!(
    "fixtures/track_tournament_overall/select_eligible_event_count_track_tournament_overall_period_by_type_2.sql"
);
const SELECT_TOTAL_POINTS_TRACK_TOURNAMENT_OVERALL_STANDING_BY_TYPE_2: &str = include_str!(
    "fixtures/track_tournament_overall/select_total_points_track_tournament_overall_standing_by_type_2.sql"
);

const UP: &str = include_str!("../migrations/20261108010000_track_tournament_overall/up.sql");
const DOWN: &str = include_str!("../migrations/20261108010000_track_tournament_overall/down.sql");
static TEST_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

async fn connect() -> Result<Client> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/track_tournament_overall_test",
        "Dedicated local track_tournament_overall_test database required"
    );
    let (client, connection) = tokio_postgres::connect(&url, NoTls).await?;
    tokio::spawn(async move { connection.await.expect("overall test connection") });
    Ok(client)
}

const FIXTURE: &str = include_str!("fixtures/track_tournament_overall/fixture.sql");

#[tokio::test]
#[ignore = "requires dedicated empty local track_tournament_overall_test database"]
async fn rolling_cache_lifecycle_permissions_backfill_and_rollback() -> Result<()> {
    let _guard = TEST_LOCK.lock().await;
    let mut client = connect().await?;
    let tx = client.transaction().await?;
    tx.batch_execute(FIXTURE).await?;
    tx.batch_execute(UP).await?;
    for (kind, count, points) in [(0, 12, 12000), (1, 6, 6000)] {
        let period = tx.query_one(include_str!("fixtures/track_tournament_overall/select_eligible_event_count_track_tournament_overall_period.sql"), &[&kind]).await?;
        assert_eq!(period.get::<_, i32>(0), count);
        let rows = tx.query(include_str!("fixtures/track_tournament_overall/select_id_user_track_tournament_overall_standing.sql"), &[&kind]).await?;
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0].get::<_, i32>(1), points);
        assert_eq!(rows[0].get::<_, i32>(2), count);
        assert_eq!(rows[0].get::<_, i32>(3), 1);
        assert_eq!(rows[1].get::<_, i32>(3), 1);
        assert_eq!(rows[2].get::<_, i32>(3), 3);
        assert_eq!(rows[2].get::<_, i32>(2), 1);
    }
    // Completion time does not displace newer event periods.
    tx.batch_execute(include_str!(
        "fixtures/track_tournament_overall/set_finalized_at_track_tournament.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(SELECT_TOTAL_POINTS_TRACK_TOURNAMENT_OVERALL_STANDING, &[])
            .await?
            .get::<_, i32>(0),
        12000
    );
    let updated: String = tx
        .query_one(SELECT_LAST_UPDATED_AT_TRACK_TOURNAMENT_OVERALL_PERIOD, &[])
        .await?
        .get(0);
    tx.batch_execute(include_str!(
        "fixtures/track_tournament_overall/insert_track_tournament.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(SELECT_LAST_UPDATED_AT_TRACK_TOURNAMENT_OVERALL_PERIOD, &[])
            .await?
            .get::<_, String>(0),
        updated,
        "active writes never refresh"
    );
    tx.batch_execute(include_str!(
        "fixtures/track_tournament_overall/set_record_eligible_record.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(SELECT_LAST_UPDATED_AT_TRACK_TOURNAMENT_OVERALL_PERIOD, &[])
            .await?
            .get::<_, String>(0),
        updated,
        "record corrections leave frozen awards unchanged"
    );
    tx.batch_execute(include_str!(
        "fixtures/track_tournament_overall/savepoint.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(
            SELECT_TOTAL_POINTS_TRACK_TOURNAMENT_OVERALL_STANDING_BY_TYPE_0,
            &[]
        )
        .await?
        .get::<_, i32>(0),
        11000
    );
    tx.batch_execute(include_str!(
        "fixtures/track_tournament_overall/rollback_to_rotation.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(
            SELECT_TOTAL_POINTS_TRACK_TOURNAMENT_OVERALL_STANDING_BY_TYPE_0,
            &[]
        )
        .await?
        .get::<_, i32>(0),
        12000
    );
    tx.batch_execute(include_str!(
        "fixtures/track_tournament_overall/set_finalized_at_track_tournament_by_id_16.sql"
    ))
    .await?;
    assert!(
        !tx.query_one(
            include_str!(
                "fixtures/track_tournament_overall/select_overall_competitive_track_tournament.sql"
            ),
            &[]
        )
        .await?
        .get::<_, bool>(0),
        "empty completion excluded"
    );
    tx.batch_execute(include_str!(
        "fixtures/track_tournament_overall/delete_track_tournament_result.sql"
    ))
    .await?;
    assert!(
        tx.query_one(
            include_str!("fixtures/track_tournament_overall/select_overall_competitive_track_tournament_by_id_16.sql"),
            &[]
        )
        .await?
        .get::<_, bool>(0),
        "competitive event keeps slot"
    );
    assert_eq!(
        tx.query_one(SELECT_TOTAL_POINTS_TRACK_TOURNAMENT_OVERALL_STANDING, &[])
            .await?
            .get::<_, i32>(0),
        11000
    );
    tx.batch_execute(include_str!(
        "fixtures/track_tournament_overall/set_publicly_visible_level.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(COUNT_TRACK_TOURNAMENT_OVERALL_STANDING, &[])
            .await?
            .get::<_, i64>(0),
        0
    );
    tx.batch_execute(include_str!(
        "fixtures/track_tournament_overall/set_publicly_visible_level_by_id_15.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(COUNT_TRACK_TOURNAMENT_OVERALL_STANDING, &[])
            .await?
            .get::<_, i64>(0),
        0,
        "cancelled event excluded"
    );
    tx.batch_execute(include_str!(
        "fixtures/track_tournament_overall/delete_user.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/track_tournament_overall/select_rank_track_tournament_overall_standing.sql"),
            &[]
        )
        .await?
        .get::<_, i32>(0),
        1
    );
    tx.batch_execute(SET_LOCAL_ROLE_ZEEPCENTRAAL_GRAPHQL)
        .await?;
    assert_eq!(
        tx.query_one(COUNT_TRACK_TOURNAMENT_OVERALL_PERIOD, &[])
            .await?
            .get::<_, i64>(0),
        2
    );
    assert!(
        !tx.query_one(HAS_FUNCTION_PRIVILEGE, &[])
            .await?
            .get::<_, bool>(0)
    );
    for privilege in ["INSERT", "UPDATE", "DELETE"] {
        assert!(
            !tx.query_one(
                include_str!("fixtures/track_tournament_overall/has_table_privilege.sql"),
                &[&privilege]
            )
            .await?
            .get::<_, bool>(0)
        );
    }
    tx.batch_execute(include_str!(
        "fixtures/track_tournament_overall/reset_role.sql"
    ))
    .await?;
    tx.batch_execute(include_str!(
        "fixtures/track_tournament_overall/insert_user.sql"
    ))
    .await?;
    let plan = tx
        .query(
            include_str!(
                "fixtures/track_tournament_overall/explain_track_tournament_overall_standing.sql"
            ),
            &[],
        )
        .await?;
    assert!(
        plan.iter().any(|row| row
            .get::<_, String>(0)
            .contains("track_tournament_overall_order")),
        "cached pagination must use ordered index"
    );
    tx.batch_execute(DOWN).await?;
    assert!(
        tx.query_one(
            include_str!("fixtures/track_tournament_overall/to_regclass.sql"),
            &[]
        )
        .await?
        .get::<_, bool>(0)
    );
    tx.batch_execute(UP).await?;
    tx.batch_execute(include_str!(
        "fixtures/track_tournament_overall/delete_track_tournament.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/track_tournament_overall/select_eligible_event_count_track_tournament_overall_period_by_type_0.sql"),
            &[]
        )
        .await?
        .get::<_, i32>(0),
        0
    );
    assert!(tx.query_one(include_str!("fixtures/track_tournament_overall/select_period_start_track_tournament_overall_period.sql"),&[]).await?.get::<_,bool>(0));
    tx.rollback().await?;
    Ok(())
}

#[tokio::test]
#[ignore = "requires dedicated empty local track_tournament_overall_test database"]
async fn refresh_serializes_and_committed_cache_survives_new_connections() -> Result<()> {
    use std::time::Duration;
    let _guard = TEST_LOCK.lock().await;
    let client = connect().await?;
    client.batch_execute(FIXTURE).await?;
    client.batch_execute(UP).await?;
    let result = async {
        let mut writer = connect().await?;
        let transaction = writer.transaction().await?;
        transaction.batch_execute(REFRESH_TRACK_TOURNAMENT_OVERALL).await?;
        let second = connect().await?;
        let mut waiting = tokio::spawn(async move {
            second.batch_execute(REFRESH_TRACK_TOURNAMENT_OVERALL).await
        });
        assert!(tokio::time::timeout(Duration::from_millis(100), &mut waiting).await.is_err());
        let reader = connect().await?;
        assert_eq!(reader.query_one(include_str!("fixtures/track_tournament_overall/count_track_tournament_overall_standing_by_type_0.sql"),&[]).await?.get::<_,i64>(0),3,"reader sees committed snapshot during refresh");
        transaction.rollback().await?;
        tokio::time::timeout(Duration::from_secs(5),waiting).await???;
        drop(writer);
        let restarted = connect().await?;
        assert_eq!(restarted.query_one(SELECT_TOTAL_POINTS_TRACK_TOURNAMENT_OVERALL_STANDING,&[]).await?.get::<_,i32>(0),12000);
        Ok::<(),anyhow::Error>(())
    }.await;
    client.batch_execute(DOWN).await?;
    client
        .batch_execute(include_str!(
            "fixtures/track_tournament_overall/drop_track_tournament_result.sql"
        ))
        .await?;
    result
}

#[tokio::test]
#[ignore = "requires dedicated empty local track_tournament_overall_test database"]
async fn daily_migration_window_permissions_and_destructive_rollback() -> Result<()> {
    let _guard = TEST_LOCK.lock().await;
    let mut client = connect().await?;
    let tx = client.transaction().await?;
    tx.batch_execute(FIXTURE).await?;
    tx.batch_execute(UP).await?;
    let original_constraint: String = tx
        .query_one(SELECT_CONNAME_PG_CONSTRAINT, &[])
        .await?
        .get(0);
    assert_eq!(original_constraint, "track_tournament_overall_period_check");
    tx.batch_execute(include_str!(
        "fixtures/track_tournament_overall/alter_track_tournament.sql"
    ))
    .await?;
    tx.batch_execute(include_str!(
        "../migrations/20261111010000_track_of_the_day/up.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(
            SELECT_ELIGIBLE_EVENT_COUNT_TRACK_TOURNAMENT_OVERALL_PERIOD_BY_TYPE_2,
            &[]
        )
        .await?
        .get::<_, i32>(0),
        0
    );
    tx.batch_execute(include_str!(
        "fixtures/track_tournament_overall/insert_track_tournament_by_type_2.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(
            SELECT_ELIGIBLE_EVENT_COUNT_TRACK_TOURNAMENT_OVERALL_PERIOD_BY_TYPE_2,
            &[]
        )
        .await?
        .get::<_, i32>(0),
        30
    );
    assert_eq!(
        tx.query_one(
            SELECT_TOTAL_POINTS_TRACK_TOURNAMENT_OVERALL_STANDING_BY_TYPE_2,
            &[]
        )
        .await?
        .get::<_, i32>(0),
        30000
    );
    // Visibility changes remove points without restoring an older event.
    tx.batch_execute(include_str!(
        "fixtures/track_tournament_overall/set_publicly_visible_level_by_id_32.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(
            SELECT_TOTAL_POINTS_TRACK_TOURNAMENT_OVERALL_STANDING_BY_TYPE_2,
            &[]
        )
        .await?
        .get::<_, i32>(0),
        29000
    );
    tx.batch_execute(include_str!(
        "fixtures/track_tournament_overall/set_publicly_visible_level_by_id_32_2.sql"
    ))
    .await?;
    assert!(
        tx.query_one(
            include_str!("fixtures/track_tournament_overall/select_overall_competitive_track_tournament_by_id_131.sql"),
            &[]
        )
        .await?
        .get::<_, bool>(0)
    );
    assert_eq!(
        tx.query_one(
            SELECT_TOTAL_POINTS_TRACK_TOURNAMENT_OVERALL_STANDING_BY_TYPE_2,
            &[]
        )
        .await?
        .get::<_, i32>(0),
        29000
    );
    for (kind, points) in [(0, 12000), (1, 6000)] {
        assert_eq!(tx.query_one(include_str!("fixtures/track_tournament_overall/select_total_points_track_tournament_overall_standing_by_type.sql"),&[&kind]).await?.get::<_,i32>(0),points);
    }
    tx.batch_execute(SET_LOCAL_ROLE_ZEEPCENTRAAL_GRAPHQL)
        .await?;
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/track_tournament_overall/count_track_tournament_overall_period_by_type_2.sql"),
            &[]
        )
        .await?
        .get::<_, i64>(0),
        1
    );
    assert!(
        !tx.query_one(HAS_FUNCTION_PRIVILEGE, &[])
            .await?
            .get::<_, bool>(0)
    );
    assert!(
        !tx.query_one(
            include_str!("fixtures/track_tournament_overall/has_table_privilege_2.sql"),
            &[]
        )
        .await?
        .get::<_, bool>(0)
    );
    tx.batch_execute(include_str!(
        "fixtures/track_tournament_overall/insert_discord_guild_feed.sql"
    ))
    .await?;
    tx.batch_execute(include_str!(
        "../migrations/20261111010000_track_of_the_day/down.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/track_tournament_overall/count_track_tournament.sql"),
            &[]
        )
        .await?
        .get::<_, i64>(0),
        0
    );
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/track_tournament_overall/count_discord_guild_feed.sql"),
            &[]
        )
        .await?
        .get::<_, i64>(0),
        1
    );
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/track_tournament_overall/count_discord_watch.sql"),
            &[]
        )
        .await?
        .get::<_, i64>(0),
        1
    );
    assert_eq!(
        tx.query_one(COUNT_TRACK_TOURNAMENT_OVERALL_PERIOD, &[])
            .await?
            .get::<_, i64>(0),
        2
    );
    tx.batch_execute(include_str!(
        "fixtures/track_tournament_overall/savepoint_reject_daily.sql"
    ))
    .await?;
    assert!(
        tx.batch_execute(include_str!(
            "fixtures/track_tournament_overall/insert_discord_guild_feed_2.sql"
        ))
        .await
        .is_err()
    );
    tx.batch_execute(include_str!(
        "fixtures/track_tournament_overall/rollback_to_reject_daily.sql"
    ))
    .await?;
    let restored_constraint: String = tx
        .query_one(SELECT_CONNAME_PG_CONSTRAINT, &[])
        .await?
        .get(0);
    assert_eq!(restored_constraint, original_constraint);
    tx.batch_execute(include_str!(
        "../migrations/20261111010000_track_of_the_day/up.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(
            SELECT_ELIGIBLE_EVENT_COUNT_TRACK_TOURNAMENT_OVERALL_PERIOD_BY_TYPE_2,
            &[],
        )
        .await?
        .get::<_, i32>(0),
        0
    );
    tx.rollback().await?;
    Ok(())
}
