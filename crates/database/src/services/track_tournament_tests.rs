use super::*;
use diesel_async::{AsyncPgConnection, SimpleAsyncConnection};

const CREATE_ONCE_REPAIRED: &str =
    include_str!("../../tests/fixtures/track_tournament/create_once_repaired.sql");
const SELECT_TRACK_TOURNAMENT_2: &str =
    include_str!("../../tests/fixtures/track_tournament/select_track_tournament_2.sql");
const SAVEPOINT_BEFORE_DOWN: &str =
    include_str!("../../tests/fixtures/track_tournament/savepoint_before_down.sql");
const ROLLBACK_TO_SAVEPOINT_BEFORE_DOWN: &str =
    include_str!("../../tests/fixtures/track_tournament/rollback_to_savepoint_before_down.sql");
const INSERT_LEVEL: &str = include_str!("../../tests/fixtures/track_tournament/insert_level.sql");
const JSONB_AGG: &str = include_str!("../../tests/fixtures/track_tournament/jsonb_agg.sql");
const SELECT_TOTAL_POINTS_TRACK_TOURNAMENT_OVERALL_STANDING: &str = include_str!(
    "../../tests/fixtures/track_tournament/select_total_points_track_tournament_overall_standing.sql"
);
const SELECT_ID_LEVEL_TRACK_TOURNAMENT: &str =
    include_str!("../../tests/fixtures/track_tournament/select_id_level_track_tournament.sql");

const REPAIR_UP: &str =
    include_str!("../../migrations/20260930010000_track_tournament_utc_boundaries/up.sql");
const REPAIR_DOWN: &str =
    include_str!("../../migrations/20260930010000_track_tournament_utc_boundaries/down.sql");
const SLUG_UP: &str =
    include_str!("../../migrations/20261008030000_track_tournament_lowercase_week/up.sql");
const SLUG_DOWN: &str =
    include_str!("../../migrations/20261008030000_track_tournament_lowercase_week/down.sql");

async fn fixture() -> Result<AsyncPgConnection> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        matches!(parsed.host_str(), Some("127.0.0.1" | "localhost"))
            && matches!(
                parsed.path(),
                "/track_tournament_test" | "/track_tournament_overall_test"
            ),
        "Dedicated empty local track_tournament_test database required"
    );
    let mut connection = AsyncPgConnection::establish(&url).await?;
    connection.begin_test_transaction().await?;
    // Serialize fixture DDL; every test rolls back its tables on disconnect.
    sql_query(include_str!(
        "../../tests/fixtures/track_tournament/pg_advisory_xact_lock.sql"
    ))
    .execute(&mut connection)
    .await?;
    connection
        .batch_execute(include_str!(
            "../../tests/fixtures/track_tournament/create_level.sql"
        ))
        .await?;
    Ok(connection)
}

async fn clear_fixture(connection: &mut AsyncPgConnection) -> Result<()> {
    connection
        .batch_execute(include_str!(
            "../../tests/fixtures/track_tournament/truncate_track_tournament_result.sql"
        ))
        .await?;
    Ok(())
}

#[derive(QueryableByName)]
struct PeriodRow {
    #[diesel(sql_type = Text)]
    slug: String,
    #[diesel(sql_type = Text)]
    start_at: String,
    #[diesel(sql_type = Text)]
    end_at: String,
}

#[tokio::test]
#[ignore = "requires dedicated empty local PostgreSQL track_tournament_test"]
async fn slug_repair_preserves_tournaments_and_results_and_is_idempotent() -> Result<()> {
    let mut connection = fixture().await?;
    connection
        .batch_execute(include_str!(
            "../../tests/fixtures/track_tournament/insert_track_tournament.sql"
        ))
        .await?;
    connection.batch_execute(SLUG_UP).await?;
    let preserved: BooleanRow = sql_query(include_str!(
        "../../tests/fixtures/track_tournament/select_track_tournament.sql"
    ))
    .get_result(&mut connection)
    .await?;
    assert!(preserved.value);
    connection.batch_execute(CREATE_ONCE_REPAIRED).await?;
    connection.batch_execute(SLUG_UP).await?;
    let repeated: BooleanRow = sql_query(SELECT_TRACK_TOURNAMENT_2)
        .get_result(&mut connection)
        .await?;
    assert!(repeated.value);
    connection.batch_execute(SAVEPOINT_BEFORE_DOWN).await?;
    let error = connection.batch_execute(SLUG_DOWN).await.unwrap_err();
    assert!(
        error
            .to_string()
            .contains("Corrected tournament slugs cannot be automatically reverted")
    );
    connection
        .batch_execute(ROLLBACK_TO_SAVEPOINT_BEFORE_DOWN)
        .await?;
    Ok(())
}

#[tokio::test]
#[ignore = "requires dedicated empty local PostgreSQL track_tournament_test"]
async fn slug_repair_conflict_fails_without_partial_changes() -> Result<()> {
    let mut connection = fixture().await?;
    connection
        .batch_execute(include_str!(
            "../../tests/fixtures/track_tournament/insert_track_tournament_2.sql"
        ))
        .await?;
    let error = connection.batch_execute(SLUG_UP).await.unwrap_err();
    assert!(matches!(
        error,
        diesel::result::Error::DatabaseError(diesel::result::DatabaseErrorKind::UniqueViolation, _)
    ));
    connection
        .batch_execute(include_str!(
            "../../tests/fixtures/track_tournament/rollback_to_savepoint_before_repair.sql"
        ))
        .await?;
    let preserved: BooleanRow = sql_query(include_str!(
        "../../tests/fixtures/track_tournament/select_track_tournament_3.sql"
    ))
    .get_result(&mut connection)
    .await?;
    assert!(preserved.value);
    Ok(())
}

#[tokio::test]
#[ignore = "requires dedicated empty local PostgreSQL track_tournament_test"]
async fn rotation_uses_utc_six_am_periods_and_is_idempotent() -> Result<()> {
    let mut connection = fixture().await?;
    for zone in ["UTC", "Europe/London", "America/New_York"] {
        sql_query(include_str!(
            "../../tests/fixtures/track_tournament/set_config.sql"
        ))
        .bind::<Text, _>(zone)
        .execute(&mut connection)
        .await?;
        for (kind, at, slug, end) in [
            (
                0,
                "2026-09-28T06:00:00Z",
                "2026-w40",
                "2026-10-05T06:00:00Z",
            ),
            (
                0,
                "2025-12-29T06:00:00Z",
                "2026-w01",
                "2026-01-05T06:00:00Z",
            ),
            (
                0,
                "2026-03-23T06:00:00Z",
                "2026-w13",
                "2026-03-30T06:00:00Z",
            ),
            (
                0,
                "2026-10-19T06:00:00Z",
                "2026-w43",
                "2026-10-26T06:00:00Z",
            ),
            (
                2,
                "2028-02-29T06:00:00Z",
                "2028-02-29",
                "2028-03-01T06:00:00Z",
            ),
            (
                2,
                "2026-12-31T06:00:00Z",
                "2026-12-31",
                "2027-01-01T06:00:00Z",
            ),
            (
                2,
                "2026-03-29T06:00:00Z",
                "2026-03-29",
                "2026-03-30T06:00:00Z",
            ),
            (1, "2028-02-01T06:00:00Z", "2028-02", "2028-03-01T06:00:00Z"),
            (1, "2026-10-01T06:00:00Z", "2026-10", "2026-11-01T06:00:00Z"),
        ] {
            clear_fixture(&mut connection).await?;
            sql_query(INSERT_LEVEL)
                .bind::<Text, _>(at)
                .execute(&mut connection)
                .await?;
            connection
                .batch_execute(include_str!(
                    "../../tests/fixtures/track_tournament/insert_level_points.sql"
                ))
                .await?;
            let created = rotate_track_tournament_at(&mut connection, kind, Some(at)).await?;
            assert!(created.created, "{zone}: {at}");
            let id = created.id_tournament.unwrap();
            let period: PeriodRow = sql_query(include_str!(
                "../../tests/fixtures/track_tournament/select_slug_track_tournament.sql"
            ))
            .bind::<Integer, _>(id)
            .get_result(&mut connection)
            .await?;
            assert_eq!(period.slug, slug);
            assert_eq!(period.start_at, at);
            assert_eq!(period.end_at, end);
            let repeated = rotate_track_tournament_at(&mut connection, kind, Some(at)).await?;
            assert!(!repeated.created);
            assert_eq!(repeated.id_tournament, Some(id));

            // Finalization uses the injected database instant too.
            let finalized = rotate_track_tournament_at(&mut connection, kind, Some(end)).await?;
            assert!(!finalized.created); // Fixture's only eligible level was already used.
            let matches: BooleanRow = sql_query(include_str!(
                "../../tests/fixtures/track_tournament/select_finalized_at_track_tournament.sql"
            ))
            .bind::<Integer, _>(id)
            .bind::<Text, _>(end)
            .get_result(&mut connection)
            .await?;
            assert!(matches.value);
        }
    }
    Ok(())
}

#[tokio::test]
#[ignore = "requires dedicated empty local PostgreSQL track_tournament_test"]
async fn repair_moves_only_active_canonical_midnight_periods_and_preserves_results() -> Result<()> {
    let mut connection = fixture().await?;
    connection
        .batch_execute(include_str!(
            "../../tests/fixtures/track_tournament/set_local_time_zone_america_new_york.sql"
        ))
        .await?;
    for case in [
        "active",
        "correct",
        "expired",
        "finalized",
        "custom-slug",
        "custom-end",
        "custom-start",
        "future",
    ] {
        clear_fixture(&mut connection).await?;
        sql_query(include_str!(
            "../../tests/fixtures/track_tournament/select_generate_series.sql"
        ))
        .bind::<Text, _>(case)
        .execute(&mut connection)
        .await?;
        connection
            .batch_execute(include_str!(
                "../../tests/fixtures/track_tournament/insert_track_tournament_result.sql"
            ))
            .await?;
        connection.batch_execute(REPAIR_UP).await?;
        let preserved: BooleanRow = sql_query(include_str!(
            "../../tests/fixtures/track_tournament/select_track_tournament_result.sql"
        ))
        .get_result(&mut connection)
        .await?;
        assert!(preserved.value, "{case}");
        let correct: BooleanRow = sql_query(include_str!(
            "../../tests/fixtures/track_tournament/select_row.sql"
        ))
        .bind::<Text, _>(case)
        .get_result(&mut connection)
        .await?;
        assert!(correct.value, "{case}");
        connection.batch_execute(CREATE_ONCE_REPAIRED).await?;
        connection.batch_execute(REPAIR_UP).await?;
        let repeated: BooleanRow = sql_query(SELECT_TRACK_TOURNAMENT_2)
            .get_result(&mut connection)
            .await?;
        assert!(repeated.value, "{case}");
        connection
            .batch_execute(include_str!(
                "../../tests/fixtures/track_tournament/drop_original_tournaments.sql"
            ))
            .await?;
    }
    connection.batch_execute(SAVEPOINT_BEFORE_DOWN).await?;
    assert!(connection.batch_execute(REPAIR_DOWN).await.is_err());
    connection
        .batch_execute(ROLLBACK_TO_SAVEPOINT_BEFORE_DOWN)
        .await?;
    Ok(())
}

#[tokio::test]
#[ignore = "requires dedicated empty local PostgreSQL track_tournament_test"]
async fn delayed_rotation_recovers_original_period_and_eligible_records() -> Result<()> {
    let mut connection = fixture().await?;
    #[derive(QueryableByName)]
    struct Snapshot {
        #[diesel(sql_type=Jsonb)]
        value: serde_json::Value,
    }
    for (kind, at, start, end, slug) in [
        (
            2,
            "2026-11-02T12:00:00Z",
            "2026-11-02T06:00:00Z",
            "2026-11-03T06:00:00Z",
            "2026-11-02",
        ),
        (
            0,
            "2026-09-28T07:15:00Z",
            "2026-09-28T06:00:00Z",
            "2026-10-05T06:00:00Z",
            "2026-w40",
        ),
        (
            0,
            "2026-09-29T12:00:00Z",
            "2026-09-28T06:00:00Z",
            "2026-10-05T06:00:00Z",
            "2026-w40",
        ),
        (
            0,
            "2026-10-05T05:59:00Z",
            "2026-09-28T06:00:00Z",
            "2026-10-05T06:00:00Z",
            "2026-w40",
        ),
        (
            1,
            "2026-11-02T12:00:00Z",
            "2026-11-01T06:00:00Z",
            "2026-12-01T06:00:00Z",
            "2026-11",
        ),
        (
            1,
            "2026-11-01T05:59:00Z",
            "2026-10-01T06:00:00Z",
            "2026-11-01T06:00:00Z",
            "2026-10",
        ),
        (
            0,
            "2025-12-30T12:00:00Z",
            "2025-12-29T06:00:00Z",
            "2026-01-05T06:00:00Z",
            "2026-w01",
        ),
    ] {
        clear_fixture(&mut connection).await?;
        sql_query(INSERT_LEVEL)
            .bind::<Text, _>(start)
            .execute(&mut connection)
            .await?;
        connection
            .batch_execute(include_str!(
                "../../tests/fixtures/track_tournament/insert_level_points_2.sql"
            ))
            .await?;
        sql_query(include_str!(
            "../../tests/fixtures/track_tournament/insert_record.sql"
        ))
        .bind::<Text, _>(start)
        .bind::<Text, _>(end)
        .execute(&mut connection)
        .await?;
        let created = rotate_track_tournament_at(&mut connection, kind, Some(at)).await?;
        assert!(created.created, "{at}");
        let id = created.id_tournament.unwrap();
        let period = sql_query(include_str!(
            "../../tests/fixtures/track_tournament/select_slug_track_tournament_by_id.sql"
        ))
        .bind::<Integer, _>(id)
        .get_result::<PeriodRow>(&mut connection)
        .await?;
        assert_eq!(
            (
                period.slug.as_str(),
                period.start_at.as_str(),
                period.end_at.as_str()
            ),
            (slug, start, end)
        );
        let winners = sql_query(include_str!(
            "../../tests/fixtures/track_tournament/select_id_record_track_tournament_result.sql"
        ))
        .load::<IdRow>(&mut connection)
        .await?;
        assert_eq!(
            winners.into_iter().map(|r| r.id).collect::<Vec<_>>(),
            vec![2, 4, 7]
        );
        let ranks = sql_query(include_str!(
            "../../tests/fixtures/track_tournament/select_rank_track_tournament_result.sql"
        ))
        .load::<IdRow>(&mut connection)
        .await?;
        assert_eq!(
            ranks.into_iter().map(|r| r.id).collect::<Vec<_>>(),
            vec![1, 1, 3]
        );
        let before = sql_query(JSONB_AGG)
            .get_result::<Snapshot>(&mut connection)
            .await?
            .value;
        let repeated = rotate_track_tournament_at(&mut connection, kind, Some(at)).await?;
        assert!(!repeated.created);
        assert_eq!(repeated.id_tournament, Some(id));
        assert_eq!(
            sql_query(JSONB_AGG)
                .get_result::<Snapshot>(&mut connection)
                .await?
                .value,
            before
        );
        rotate_track_tournament_at(&mut connection, kind, Some(end)).await?;
        assert!(
            sql_query(
                include_str!("../../tests/fixtures/track_tournament/select_finalized_at_track_tournament_by_id.sql")
            )
            .bind::<Integer, _>(id)
            .get_result::<BooleanRow>(&mut connection)
            .await?
            .value
        );
    }
    clear_fixture(&mut connection).await?;
    let empty =
        rotate_track_tournament_at(&mut connection, 0, Some("2026-10-06T12:00:00Z")).await?;
    assert!(!empty.created);
    assert_eq!(empty.id_tournament, None);
    Ok(())
}

#[tokio::test]
#[ignore = "requires dedicated empty local PostgreSQL track_tournament_test"]
async fn rotation_waits_for_shared_submission_level_lock() -> Result<()> {
    use std::time::Duration;
    let mut connection = fixture().await?;
    connection
        .batch_execute(include_str!(
            "../../tests/fixtures/track_tournament/insert_level_2.sql"
        ))
        .await?;
    let mut submitter =
        AsyncPgConnection::establish(&std::env::var("ZC_TEST_DATABASE_URL")?).await?;
    sql_query(include_str!(
        "../../tests/fixtures/track_tournament/pg_advisory_lock_shared.sql"
    ))
    .execute(&mut submitter)
    .await?;
    let mut rotation = tokio::spawn(async move {
        let result =
            rotate_track_tournament_at(&mut connection, 0, Some("2026-09-29T12:00:00Z")).await;
        (result, connection)
    });
    assert!(
        tokio::time::timeout(Duration::from_millis(100), &mut rotation)
            .await
            .is_err()
    );
    sql_query(include_str!(
        "../../tests/fixtures/track_tournament/pg_advisory_unlock_shared.sql"
    ))
    .execute(&mut submitter)
    .await?;
    let (result, _connection) = tokio::time::timeout(Duration::from_secs(5), rotation).await??;
    assert!(result?.created);
    Ok(())
}

#[tokio::test]
#[ignore = "requires dedicated empty local PostgreSQL track_tournament_test"]
async fn rotation_finalization_publishes_overall_cache_atomically() -> Result<()> {
    let mut connection = fixture().await?;
    connection
        .batch_execute(include_str!(
            "../../tests/fixtures/track_tournament/create_zc_private.sql"
        ))
        .await?;
    connection
        .batch_execute(include_str!(
            "../../migrations/20261108010000_track_tournament_overall/up.sql"
        ))
        .await?;
    connection
        .batch_execute(include_str!(
            "../../tests/fixtures/track_tournament/insert_level_3.sql"
        ))
        .await?;
    let active =
        rotate_track_tournament_at(&mut connection, 0, Some("2026-09-29T12:00:00Z")).await?;
    assert!(active.created);
    let before = sql_query(include_str!(
        "../../tests/fixtures/track_tournament/count_track_tournament_overall_standing.sql"
    ))
    .get_result::<IdRow>(&mut connection)
    .await?;
    assert_eq!(before.id, 0);
    rotate_track_tournament_at(&mut connection, 0, Some("2026-10-05T06:00:00Z")).await?;
    let points = sql_query(SELECT_TOTAL_POINTS_TRACK_TOURNAMENT_OVERALL_STANDING)
        .get_result::<IdRow>(&mut connection)
        .await?;
    assert_eq!(points.id, 1000);
    let count = sql_query(include_str!("../../tests/fixtures/track_tournament/select_eligible_event_count_track_tournament_overall_period.sql")).get_result::<IdRow>(&mut connection).await?;
    assert_eq!(count.id, 1);
    rotate_track_tournament_at(&mut connection, 0, Some("2026-10-05T06:00:00Z")).await?;
    let repeated = sql_query(SELECT_TOTAL_POINTS_TRACK_TOURNAMENT_OVERALL_STANDING)
        .get_result::<IdRow>(&mut connection)
        .await?;
    assert_eq!(repeated.id, 1000);
    Ok(())
}

#[tokio::test]
#[ignore = "requires dedicated empty local PostgreSQL track_tournament_test"]
async fn daily_selection_filters_before_percentile_and_uses_event_date() -> Result<()> {
    let mut connection = fixture().await?;
    for (at, extra, expected) in [
        // Even day includes old levels. Before 06:00 still uses previous day's parity.
        ("2026-11-02T06:00:00Z", "", Some(1)),
        ("2026-11-03T05:59:59Z", "", Some(1)),
        // Odd day includes exact two-calendar-month cutoff, excludes older level.
        ("2026-11-03T06:00:00Z", "", Some(2)),
        // Missing recent levels falls back to all-time unused levels.
        (
            "2026-11-03T06:00:00Z",
            include_str!("../../tests/fixtures/track_tournament/set_date_created_level.sql"),
            Some(1),
        ),
        // Removing used top score before percentile lets next-best level qualify.
        (
            "2026-11-02T06:00:00Z",
            include_str!("../../tests/fixtures/track_tournament/insert_track_tournament_3.sql"),
            Some(2),
        ),
        // Weekly appearances do not exclude daily candidates.
        (
            "2026-11-02T06:00:00Z",
            include_str!("../../tests/fixtures/track_tournament/insert_track_tournament_4.sql"),
            Some(1),
        ),
        (
            "2026-11-02T06:00:00Z",
            include_str!("../../tests/fixtures/track_tournament/set_deleted_level_item.sql"),
            Some(2),
        ),
        (
            "2026-11-02T06:00:00Z",
            include_str!(
                "../../tests/fixtures/track_tournament/set_publicly_visible_level_item.sql"
            ),
            Some(2),
        ),
        (
            "2026-11-02T06:00:00Z",
            include_str!("../../tests/fixtures/track_tournament/set_publicly_visible_level.sql"),
            Some(2),
        ),
        (
            "2026-11-02T06:00:00Z",
            include_str!("../../tests/fixtures/track_tournament/set_points_level_points.sql"),
            Some(2),
        ),
        (
            "2026-11-02T06:00:00Z",
            include_str!(
                "../../tests/fixtures/track_tournament/set_date_created_level_by_id_1.sql"
            ),
            Some(2),
        ),
        (
            "2026-11-02T06:00:00Z",
            include_str!("../../tests/fixtures/track_tournament/set_deleted_level_item_true.sql"),
            None,
        ),
    ] {
        clear_fixture(&mut connection).await?;
        connection
            .batch_execute(include_str!(
                "../../tests/fixtures/track_tournament/insert_level_4.sql"
            ))
            .await?;
        connection.batch_execute(extra).await?;
        let rotation = rotate_track_tournament_at(&mut connection, 2, Some(at)).await?;
        assert_eq!(rotation.created, expected.is_some(), "{at}: {extra}");
        if let Some(expected) = expected {
            let level = sql_query(SELECT_ID_LEVEL_TRACK_TOURNAMENT)
                .bind::<Integer, _>(rotation.id_tournament.unwrap())
                .get_result::<IdRow>(&mut connection)
                .await?;
            assert_eq!(level.id, expected, "{at}: {extra}");
            let repeated = rotate_track_tournament_at(&mut connection, 2, Some(at)).await?;
            assert!(!repeated.created);
            assert_eq!(repeated.id_tournament, rotation.id_tournament);
        }
    }
    Ok(())
}

#[tokio::test]
#[ignore = "requires dedicated empty local PostgreSQL track_tournament_test"]
async fn daily_recovery_scores_only_eligible_records_inside_period() -> Result<()> {
    let mut connection = fixture().await?;
    connection
        .batch_execute(include_str!(
            "../../tests/fixtures/track_tournament/insert_level_5.sql"
        ))
        .await?;
    let rotation =
        rotate_track_tournament_at(&mut connection, 2, Some("2026-11-02T12:00Z")).await?;
    let rows=sql_query(include_str!("../../tests/fixtures/track_tournament/select_id_record_track_tournament_result_by_id_tournament.sql"))
        .bind::<Integer,_>(rotation.id_tournament.unwrap()).load::<IdRow>(&mut connection).await?;
    assert_eq!(rows.iter().map(|r| r.id).collect::<Vec<_>>(), vec![1, 2]);
    let valid = sql_query(include_str!(
        "../../tests/fixtures/track_tournament/select_track_tournament_result_2.sql"
    ))
    .get_result::<BooleanRow>(&mut connection)
    .await?;
    assert!(valid.value);
    rotate_track_tournament_at(&mut connection, 2, Some("2026-11-03T06:00Z")).await?;
    let valid = sql_query(include_str!(
        "../../tests/fixtures/track_tournament/select_finalized_at_track_tournament_by_id_2.sql"
    ))
    .bind::<Integer, _>(rotation.id_tournament.unwrap())
    .get_result::<BooleanRow>(&mut connection)
    .await?;
    assert!(valid.value);
    Ok(())
}

#[tokio::test]
#[ignore = "requires dedicated empty local PostgreSQL track_tournament_test"]
async fn selection_percentiles_exclude_used_levels_and_include_cutoff_ties() -> Result<()> {
    let mut connection = fixture().await?;
    let prefix = TRACK_TOURNAMENT_SELECTION_SQL
        .split("INSERT INTO public.track_tournament")
        .next()
        .unwrap();
    let query = include_str!("../../tests/fixtures/track_tournament/select_eligible_levels.sql")
        .replace("{{prefix}}", prefix);
    for (kind, cutoff) in [(2, 1901), (0, 1981), (1, 1999)] {
        clear_fixture(&mut connection).await?;
        connection
            .batch_execute(include_str!(
                "../../tests/fixtures/track_tournament/insert_level_6.sql"
            ))
            .await?;
        sql_query(include_str!(
            "../../tests/fixtures/track_tournament/insert_track_tournament_5.sql"
        ))
        .bind::<Integer, _>(kind)
        .execute(&mut connection)
        .await?;

        for first in [cutoff, cutoff - 1] {
            if first < cutoff {
                sql_query(include_str!(
                    "../../tests/fixtures/track_tournament/set_points_level_points_by_id_level.sql"
                ))
                .bind::<Integer, _>(cutoff)
                .execute(&mut connection)
                .await?;
            }
            let rows = sql_query(&query)
                .bind::<Integer, _>(kind)
                .bind::<Text, _>("2026-11-03T06:00Z")
                .load::<IdRow>(&mut connection)
                .await?;
            assert_eq!(
                rows.into_iter().map(|row| row.id).collect::<Vec<_>>(),
                (first..=2001).collect::<Vec<_>>(),
                "type {kind}, first eligible level {first}"
            );
        }
    }
    Ok(())
}

#[tokio::test]
#[ignore = "requires dedicated empty local PostgreSQL track_tournament_test"]
async fn rotation_falls_back_after_using_recent_levels_for_each_format() -> Result<()> {
    let mut connection = fixture().await?;
    connection
        .batch_execute(include_str!(
            "../../tests/fixtures/track_tournament/insert_level_7.sql"
        ))
        .await?;

    for (kind, dates) in [
        (
            2,
            [
                "2026-11-03T06:00Z",
                "2026-11-05T06:00Z",
                "2026-11-07T06:00Z",
            ],
        ),
        (
            0,
            [
                "2026-11-02T06:00Z",
                "2026-11-09T06:00Z",
                "2026-11-16T06:00Z",
            ],
        ),
        (
            1,
            [
                "2026-11-01T06:00Z",
                "2026-12-01T06:00Z",
                "2027-01-01T06:00Z",
            ],
        ),
    ] {
        for (at, expected) in dates.into_iter().zip([Some(1), Some(2), None]) {
            let rotation = rotate_track_tournament_at(&mut connection, kind, Some(at)).await?;
            assert_eq!(rotation.created, expected.is_some(), "type {kind}, {at}");
            let selected = if let Some(id) = rotation.id_tournament {
                let row = sql_query(SELECT_ID_LEVEL_TRACK_TOURNAMENT)
                    .bind::<Integer, _>(id)
                    .get_result::<IdRow>(&mut connection)
                    .await?;
                Some(row.id)
            } else {
                None
            };
            assert_eq!(selected, expected, "type {kind}, {at}");
        }
    }
    Ok(())
}
