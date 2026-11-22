use anyhow::{Result, ensure};
use serde_json::Value;
use tokio_postgres::{Client, NoTls};

const READ_FIXTURE_STATE: &str = include_str!("fixtures/public_statistics/read_fixture_state.sql");
const SET_LOCAL_ROLE_ZEEPCENTRAAL_GRAPHQL: &str =
    include_str!("fixtures/public_statistics/set_local_role_zeepcentraal_graphql.sql");
const HAS_TABLE_PRIVILEGE: &str =
    include_str!("fixtures/public_statistics/has_table_privilege.sql");
const HAS_FUNCTION_PRIVILEGE: &str =
    include_str!("fixtures/public_statistics/has_function_privilege.sql");
const RESET_ROLE: &str = include_str!("fixtures/public_statistics/reset_role.sql");
const REFRESH_GLOBAL_METRICS: &str =
    include_str!("fixtures/public_statistics/refresh_global_metrics.sql");
const TRUNCATE_STATISTICS: &str =
    include_str!("fixtures/public_statistics/truncate_statistics.sql");

const UP: &str = include_str!("../migrations/20261019000900_public_statistics/up.sql");
const DOWN: &str = include_str!("../migrations/20261019000900_public_statistics/down.sql");
const SINGLE_UP: &str = include_str!("../migrations/20261019001000_single_player_statistic/up.sql");
const SINGLE_DOWN: &str =
    include_str!("../migrations/20261019001000_single_player_statistic/down.sql");
const SERVE_STALE_UP: &str =
    include_str!("../migrations/20261121000000_global_metrics_serve_stale/up.sql");
const SERVE_STALE_DOWN: &str =
    include_str!("../migrations/20261121000000_global_metrics_serve_stale/down.sql");
static TEST_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

async fn connect() -> Result<Client> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/zc_optimization_test",
        "Dedicated loopback zc_optimization_test database required"
    );
    let (client, connection) = tokio_postgres::connect(&url, NoTls).await?;
    tokio::spawn(async move { connection.await.expect("statistics fixture connection") });
    Ok(client)
}

#[tokio::test]
#[ignore = "requires dedicated loopback zc_optimization_test with current migrations"]
async fn statistics_migration_seeds_exact_counts_preserves_identity_and_reverses() -> Result<()> {
    let _guard = TEST_LOCK.lock().await;
    let mut client = connect().await?;
    let tx = client.transaction().await?;
    tx.batch_execute(include_str!(
        "../migrations/20261021000000_frozen_statistic_periods/down.sql"
    ))
    .await?;
    // Exercise migration 009 against its original result shape.
    tx.batch_execute(SINGLE_DOWN).await?;
    let identity: i64 = tx.query_one(READ_FIXTURE_STATE, &[]).await?.get(0);
    tx.batch_execute(DOWN).await?;
    tx.batch_execute(include_str!(
        "fixtures/public_statistics/truncate_global_metrics_snapshot.sql"
    ))
    .await?;
    tx.batch_execute(UP).await?;
    let row = tx
        .query_one(
            include_str!("fixtures/public_statistics/select_statistics.sql"),
            &[],
        )
        .await?;
    assert_eq!(row.get::<_, i64>(0), identity);
    assert!(row.get::<_, bool>(1));
    assert_eq!(row.get::<_, i64>(2), 1);
    assert!(
        row.get::<_, bool>(3),
        "All 20 counts and metadata must match"
    );
    tx.batch_execute(SET_LOCAL_ROLE_ZEEPCENTRAAL_GRAPHQL)
        .await?;
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/public_statistics/count_statistics.sql"),
            &[]
        )
        .await?
        .get::<_, i64>(0),
        1
    );
    for privilege in ["INSERT", "UPDATE", "DELETE"] {
        assert!(
            !tx.query_one(HAS_TABLE_PRIVILEGE, &[&privilege],)
                .await?
                .get::<_, bool>(0)
        );
    }
    assert!(
        !tx.query_one(HAS_FUNCTION_PRIVILEGE, &[],)
            .await?
            .get::<_, bool>(0)
    );
    tx.batch_execute(RESET_ROLE).await?;
    tx.batch_execute(DOWN).await?;
    let row = tx
        .query_one(
            include_str!("fixtures/public_statistics/count_global_metrics_snapshot.sql"),
            &[],
        )
        .await?;
    assert_eq!(row.get::<_, i64>(0), 1);
    assert!(!row.get::<_, bool>(1));
    tx.rollback().await?;
    Ok(())
}

#[tokio::test]
#[ignore = "requires dedicated loopback zc_optimization_test with current migrations"]
async fn single_player_count_migration_removes_duplicate_and_restores_original_shape() -> Result<()>
{
    let _guard = TEST_LOCK.lock().await;
    let mut client = connect().await?;
    let tx = client.transaction().await?;
    tx.batch_execute(include_str!(
        "../migrations/20261021000000_frozen_statistic_periods/down.sql"
    ))
    .await?;
    let identity = tx
        .query_one(
            include_str!("fixtures/public_statistics/read_fixture_state_2.sql"),
            &[],
        )
        .await?;
    tx.batch_execute(SINGLE_DOWN).await?;
    tx.batch_execute(include_str!("fixtures/public_statistics/truncate_user.sql"))
        .await?;
    tx.batch_execute(REFRESH_GLOBAL_METRICS).await?;
    let snapshot: String = tx
        .query_one(
            include_str!("fixtures/public_statistics/select_statistics_2.sql"),
            &[],
        )
        .await?
        .get(0);
    tx.batch_execute(SINGLE_UP).await?;
    let retained: String = tx
        .query_one(
            include_str!("fixtures/public_statistics/select_statistics_3.sql"),
            &[],
        )
        .await?
        .get(0);
    assert_eq!(
        retained, snapshot,
        "Keep exact values and freshness timestamp"
    );
    let row = tx
        .query_one(
            include_str!("fixtures/public_statistics/select_players_statistics.sql"),
            &[],
        )
        .await?;
    assert_eq!(row.get::<_, i64>(0), 3);
    assert_eq!(row.get::<_, i32>(1), 2);
    assert!(row.get::<_, bool>(2));
    assert!(!row.get::<_, bool>(3));
    assert!(!row.get::<_, bool>(4));
    assert_eq!(row.get::<_, i64>(5), identity.get::<_, i64>(0));
    assert_eq!(row.get::<_, i64>(6), identity.get::<_, i64>(1));
    tx.batch_execute(SET_LOCAL_ROLE_ZEEPCENTRAAL_GRAPHQL)
        .await?;
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/public_statistics/select_players_global_metrics.sql"),
            &[]
        )
        .await?
        .get::<_, i64>(0),
        3
    );
    tx.batch_execute(RESET_ROLE).await?;
    tx.batch_execute(SINGLE_DOWN).await?;
    let row = tx
        .query_one(
            include_str!("fixtures/public_statistics/select_players_statistics_2.sql"),
            &[],
        )
        .await?;
    assert_eq!(row.get::<_, i64>(0), 3);
    assert_eq!(row.get::<_, i64>(1), 4);
    assert_eq!(row.get::<_, i32>(2), 1);
    // Full result order also stays compatible with callers using SELECT *.
    let columns = tx
        .query(
            include_str!("fixtures/public_statistics/select_attname_pg_attribute.sql"),
            &[],
        )
        .await?;
    assert_eq!(columns[15].get::<_, String>(0), "players");
    assert_eq!(columns[16].get::<_, String>(0), "players_all");
    assert_eq!(columns.last().unwrap().get::<_, String>(0), "time_zone");
    tx.batch_execute(TRUNCATE_STATISTICS).await?;
    tx.batch_execute(SINGLE_UP).await?;
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/public_statistics/select_players_statistics_3.sql"),
            &[]
        )
        .await?
        .get::<_, i64>(0),
        3
    );
    tx.rollback().await?;
    Ok(())
}

fn assert_bounded_world_record_join(plan: &Value) {
    assert!(
        !(plan["Node Type"] == "Nested Loop"
            && plan["Join Filter"]
                .as_str()
                .is_some_and(|filter| filter.contains("wr.id_level"))),
        "World-record availability regressed to broad nested-loop join"
    );
    if let Some(children) = plan["Plans"].as_array() {
        for child in children {
            assert_bounded_world_record_join(child);
        }
    }
}

#[tokio::test]
#[ignore = "requires dedicated loopback zc_optimization_test; loads 200,000 synthetic records"]
async fn refresh_uses_bounded_world_record_joins_for_custom_and_generic_plans() -> Result<()> {
    let _guard = TEST_LOCK.lock().await;
    let mut client = connect().await?;
    let tx = client.transaction().await?;
    tx.batch_execute(include_str!("fixtures/statistics_plans.sql"))
        .await?;
    let source: String = tx
        .query_one(
            include_str!("fixtures/public_statistics/select_prosrc_pg_proc.sql"),
            &[],
        )
        .await?
        .get(0);
    tx.batch_execute(
        &include_str!("fixtures/public_statistics/prepare.sql")
            .replace("{{query}}", &source.replace("p_as_of", "$1")),
    )
    .await?;
    for phase in ["rollover", "normal"] {
        for mode in ["force_custom_plan", "force_generic_plan"] {
            tx.batch_execute(
                &include_str!("fixtures/public_statistics/set_plan_cache_mode.sql")
                    .replace("{{mode}}", mode),
            )
            .await?;
            let rows = tx
                .simple_query(include_str!("fixtures/public_statistics/explain_query.sql"))
                .await?;
            let json = rows.iter().find_map(|message| match message {
                tokio_postgres::SimpleQueryMessage::Row(row) => row.get(0),
                _ => None,
            });
            let measured: Value = serde_json::from_str(json.expect("JSON query plan"))?;
            assert_bounded_world_record_join(&measured[0]["Plan"]);
            println!(
                "{phase} {mode}: {} ms on 200,000 records / 50,000 WRs",
                measured[0]["Execution Time"]
            );
        }
        tx.batch_execute(include_str!(
            "fixtures/public_statistics/truncate_statistics_2.sql"
        ))
        .await?;
    }
    tx.batch_execute(include_str!("fixtures/public_statistics/deallocate.sql"))
        .await?;
    let row = tx
        .query_one(
            include_str!("fixtures/public_statistics/select_records_compute_global_metrics.sql"),
            &[],
        )
        .await?;
    assert_eq!(row.get::<_, i64>(0), 200_000);
    assert_eq!(row.get::<_, i64>(1), 50_000);
    assert_eq!(row.get::<_, i64>(2), 50_000);
    tx.rollback().await?;
    Ok(())
}

const FROZEN_UP: &str =
    include_str!("../migrations/20261021000000_frozen_statistic_periods/up.sql");
const FROZEN_DOWN: &str =
    include_str!("../migrations/20261021000000_frozen_statistic_periods/down.sql");
const CAPTURE_AT: &str = include_str!("fixtures/public_statistics/capture_at.sql");

#[tokio::test]
#[ignore = "requires dedicated loopback zc_optimization_test with current migrations"]
async fn frozen_period_migration_preserves_identity_and_reverses() -> Result<()> {
    let _guard = TEST_LOCK.lock().await;
    let mut client = connect().await?;
    let tx = client.transaction().await?;
    let identity: i64 = tx.query_one(READ_FIXTURE_STATE, &[]).await?.get(0);
    tx.batch_execute(FROZEN_DOWN).await?;
    tx.batch_execute(FROZEN_UP).await?;
    let row = tx
        .query_one(
            include_str!("fixtures/public_statistics/select_semantics_version_pg_proc.sql"),
            &[],
        )
        .await?;
    assert_eq!(row.get::<_, i32>(0), 3);
    assert_eq!(row.get::<_, i64>(1), identity);
    assert!(row.get::<_, bool>(2));
    assert!(row.get::<_, bool>(3));
    tx.batch_execute(SET_LOCAL_ROLE_ZEEPCENTRAAL_GRAPHQL)
        .await?;
    let row = tx
        .query_one(
            include_str!("fixtures/public_statistics/select_records_yesterday_global_metrics.sql"),
            &[],
        )
        .await?;
    assert!(row.get::<_, i64>(0) >= 0 && row.get::<_, i64>(1) >= 0);
    for privilege in ["INSERT", "UPDATE", "DELETE"] {
        assert!(
            !tx.query_one(HAS_TABLE_PRIVILEGE, &[&privilege])
                .await?
                .get::<_, bool>(0)
        );
    }
    assert!(
        !tx.query_one(HAS_FUNCTION_PRIVILEGE, &[])
            .await?
            .get::<_, bool>(0)
    );
    tx.batch_execute(RESET_ROLE).await?;
    tx.batch_execute(FROZEN_DOWN).await?;
    assert!(
        tx.query_one(
            include_str!("fixtures/public_statistics/select_semantics_version_statistics.sql"),
            &[]
        )
        .await?
        .get::<_, bool>(0)
    );
    tx.rollback().await?;
    Ok(())
}

#[tokio::test]
#[ignore = "requires dedicated loopback zc_optimization_test with current migrations"]
async fn completed_calendar_periods_handle_dst_year_and_leap_boundaries() -> Result<()> {
    let _guard = TEST_LOCK.lock().await;
    let mut client = connect().await?;
    let tx = client.transaction().await?;
    tx.batch_execute(TRUNCATE_STATISTICS).await?;
    for (at, yesterday, month, hours) in [
        (
            "2026-03-30 12:00Z",
            "2026-03-29 00:00Z",
            "2026-02-01 00:00Z",
            23,
        ),
        (
            "2026-10-26 12:00Z",
            "2026-10-24 23:00Z",
            "2026-08-31 23:00Z",
            25,
        ),
        (
            "2027-01-01 00:00Z",
            "2026-12-31 00:00Z",
            "2026-12-01 00:00Z",
            24,
        ),
        (
            "2028-03-01 00:00Z",
            "2028-02-29 00:00Z",
            "2028-02-01 00:00Z",
            24,
        ),
    ] {
        let row = tx
            .query_one(
                include_str!("fixtures/public_statistics/select_yesterday_start_day_start.sql"),
                &[&at, &yesterday, &month, &(hours as i64)],
            )
            .await?;
        for i in 0..3 {
            assert!(
                row.get::<_, bool>(i),
                "Calendar boundary failed: {at}, column {i}"
            );
        }
    }
    tx.rollback().await?;
    Ok(())
}

#[tokio::test]
#[ignore = "requires dedicated loopback zc_optimization_test with current migrations"]
async fn completed_period_counts_use_exclusive_ends_and_freeze_after_source_changes() -> Result<()>
{
    let _guard = TEST_LOCK.lock().await;
    let mut client = connect().await?;
    let tx = client.transaction().await?;
    tx.batch_execute(include_str!(
        "../migrations/20261019000800_retire_history_index/down.sql"
    ))
    .await?;
    tx.batch_execute(include_str!("fixtures/global_metrics.sql"))
        .await?;
    tx.batch_execute(CAPTURE_AT).await?;
    tx.batch_execute(include_str!(
        "fixtures/public_statistics/set_date_created_record.sql"
    ))
    .await?;
    let row = tx
        .query_one(
            include_str!("fixtures/public_statistics/select_records_yesterday_statistics.sql"),
            &[],
        )
        .await?;
    for (i, expected) in [2i64, 1, 2, 1, 1, 0, 1, 1, 1, 1, 1, 1]
        .into_iter()
        .enumerate()
    {
        assert_eq!(row.get::<_, i64>(i), expected, "Metric column {i}");
    }
    tx.batch_execute(include_str!(
        "fixtures/public_statistics/delete_personal_best_global.sql"
    ))
    .await?;
    let after: String = tx
        .query_one(
            include_str!("fixtures/public_statistics/select_statistics_4.sql"),
            &[],
        )
        .await?
        .get(0);
    assert_eq!(after, "[2, 1, 2, 1, 1, 0, 1, 1, 1, 1, 1, 1]");
    let daily = tx
        .query_one(
            include_str!(
                "fixtures/public_statistics/select_records_yesterday_compute_global_metrics.sql"
            ),
            &[],
        )
        .await?;
    assert!(daily.get::<_, bool>(0));
    tx.batch_execute(include_str!(
        "fixtures/public_statistics/capture_metrics.sql"
    ))
    .await?;
    assert!(
        tx.query_one(
            include_str!("fixtures/public_statistics/select_records_yesterday_statistics_2.sql"),
            &[]
        )
        .await?
        .get::<_, bool>(0)
    );
    tx.batch_execute(include_str!(
        "fixtures/public_statistics/capture_metrics_2.sql"
    ))
    .await?;
    assert!(
        tx.query_one(
            include_str!("fixtures/public_statistics/select_records_yesterday_statistics_3.sql"),
            &[]
        )
        .await?
        .get::<_, bool>(0)
    );
    tx.rollback().await?;
    Ok(())
}

#[tokio::test]
#[ignore = "requires dedicated loopback zc_optimization_test with current migrations"]
async fn stale_reads_keep_frozen_counts_and_rollover_keeps_matching_labels() -> Result<()> {
    let _guard = TEST_LOCK.lock().await;
    let mut client = connect().await?;
    let tx = client.transaction().await?;
    tx.batch_execute(include_str!(
        "../migrations/20261019000800_retire_history_index/down.sql"
    ))
    .await?;
    tx.batch_execute(include_str!("fixtures/global_metrics.sql"))
        .await?;
    tx.batch_execute(include_str!(
        "fixtures/public_statistics/refresh_global_metrics_71.sql"
    ))
    .await?;
    let row = tx
        .query_one(
            include_str!("fixtures/public_statistics/select_records_global_metrics.sql"),
            &[],
        )
        .await?;
    assert!(row.get::<_, bool>(0));
    for invalid_snapshot in [
        include_str!("fixtures/public_statistics/set_semantics_version_statistics.sql"),
        include_str!("fixtures/public_statistics/set_time_zone_statistics.sql"),
        include_str!("fixtures/public_statistics/set_as_of_statistics.sql"),
        include_str!("fixtures/public_statistics/delete_statistics.sql"),
    ] {
        tx.batch_execute(include_str!(
            "fixtures/public_statistics/savepoint_invalid_snapshot.sql"
        ))
        .await?;
        tx.batch_execute(invalid_snapshot).await?;
        assert_eq!(
            tx.query_one(
                include_str!("fixtures/public_statistics/select_records_global_metrics_2.sql"),
                &[]
            )
            .await?
            .get::<_, i64>(0),
            4
        );
        tx.batch_execute(include_str!("fixtures/public_statistics/rollback.sql"))
            .await?;
    }
    tx.batch_execute(SERVE_STALE_DOWN).await?;
    tx.batch_execute(include_str!(
        "fixtures/public_statistics/set_day_start_statistics.sql"
    ))
    .await?;
    let row = tx
        .query_one(
            include_str!("fixtures/public_statistics/select_records_global_metrics_3.sql"),
            &[],
        )
        .await?;
    assert!(row.get::<_, bool>(0));
    tx.batch_execute(SERVE_STALE_UP).await?;
    tx.batch_execute(REFRESH_GLOBAL_METRICS).await?;
    assert!(
        tx.query_one(
            include_str!("fixtures/public_statistics/select_records_statistics.sql"),
            &[]
        )
        .await?
        .get::<_, bool>(0)
    );
    tx.batch_execute(include_str!(
        "fixtures/public_statistics/set_day_start_statistics_2.sql"
    ))
    .await?;
    let row = tx
        .query_one(
            include_str!("fixtures/public_statistics/select_statistics_5.sql"),
            &[],
        )
        .await?;
    assert!(row.get::<_, bool>(0));
    tx.batch_execute(REFRESH_GLOBAL_METRICS).await?;
    assert!(
        tx.query_one(
            include_str!("fixtures/public_statistics/select_records_statistics_2.sql"),
            &[]
        )
        .await?
        .get::<_, bool>(0)
    );
    tx.rollback().await?;
    Ok(())
}
