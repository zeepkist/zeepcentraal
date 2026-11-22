use anyhow::{Context, Result, ensure};
use diesel::{QueryableByName, sql_query, sql_types::Jsonb};
use diesel_async::{RunQueryDsl, SimpleAsyncConnection};
use serde_json::Value;
use zc_database::Database;

const SELECT_RECORD_STATISTIC_BY_ID_RECORD_1: &str =
    include_str!("fixtures/surface_statistics/select_record_statistic_by_id_record_1.sql");

#[derive(QueryableByName)]
struct Row {
    #[diesel(sql_type = Jsonb)]
    data: Value,
}

#[tokio::test]
#[ignore = "requires dedicated local surface_statistics_test database"]
async fn repairs_stored_totals_with_bounded_repeat_safe_batches() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")
        .context("Dedicated local fixture required")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/surface_statistics_test",
        "Dedicated local fixture required"
    );
    let database = Database::connect(&url, 2).await?;
    let mut connection = database.pool_partition().connection().await?;
    connection
        .batch_execute(include_str!("fixtures/ghost_validation.sql"))
        .await?;
    connection
        .batch_execute(include_str!(
            "../migrations/20261017170000_unknown_surface_statistics/up.sql"
        ))
        .await?;
    connection
        .batch_execute(include_str!("fixtures/surface_statistics/insert_user.sql"))
        .await?;
    let bound = database.surface_statistics_upper_bound().await?;
    assert_eq!(bound, 6);
    assert_eq!(database.remaining_surface_statistics(bound).await?, 4);
    connection
        .batch_execute(include_str!(
            "fixtures/surface_statistics/insert_record_statistic.sql"
        ))
        .await?;
    let first = database
        .repair_surface_statistics_batch(bound, None, 2)
        .await?;
    assert_eq!(first.processed, 2);
    assert_eq!(first.before_id, Some(5));
    let second = database
        .repair_surface_statistics_batch(bound, first.before_id, 2)
        .await?;
    assert_eq!(second.processed, 2);
    assert_eq!(second.before_id, Some(1));
    assert_eq!(database.remaining_surface_statistics(bound).await?, 0);
    assert_eq!(
        database
            .repair_surface_statistics_batch(bound, None, 500)
            .await?
            .processed,
        0
    );
    assert!(
        database
            .repair_surface_statistics_batch(bound, None, 501)
            .await
            .is_err()
    );
    let rows = sql_query(include_str!(
        "fixtures/surface_statistics/select_record_statistic.sql"
    ))
    .load::<Row>(&mut connection)
    .await?;
    assert_eq!(rows[0].data["distance_on_unknown"].as_f64(), Some(80.0));
    assert_eq!(rows[0].data["time_on_unknown"].as_f64(), Some(8.0));
    assert_eq!(rows[0].data["distance_on_wood"].as_f64(), Some(20.0));
    assert!(
        rows[0].data["date_created"]
            .as_str()
            .unwrap()
            .starts_with("2020-01-01")
    );
    assert_eq!(rows[1].data["distance_on_unknown"].as_f64(), Some(0.0));
    assert_eq!(rows[1].data["time_on_unknown"].as_f64(), Some(0.0));
    assert!(rows[2].data["distance_on_unknown"].is_null());
    assert!(rows[3].data["time_on_unknown"].is_null());
    assert_eq!(rows[4].data["distance_on_unknown"].as_f64(), Some(80.0));
    assert!(rows[4].data["time_on_unknown"].is_null());
    assert_eq!(rows[5].data["distance_on_unknown"].as_f64(), Some(100.0));
    assert_eq!(rows[5].data["time_on_unknown"].as_f64(), Some(7.0));
    assert!(rows[6].data["distance_on_unknown"].is_null());
    let before = rows[0].data["date_updated"].clone();
    assert_eq!(
        database
            .repair_surface_statistics_batch(bound, None, 500)
            .await?
            .processed,
        0
    );
    let row = sql_query(SELECT_RECORD_STATISTIC_BY_ID_RECORD_1)
        .get_result::<Row>(&mut connection)
        .await?;
    assert_eq!(before, row.data["date_updated"]);
    connection
        .batch_execute(include_str!(
            "../migrations/20261017170000_unknown_surface_statistics/down.sql"
        ))
        .await?;
    let row = sql_query(SELECT_RECORD_STATISTIC_BY_ID_RECORD_1)
        .get_result::<Row>(&mut connection)
        .await?;
    assert!(row.data.get("distance_on_unknown").is_none());
    assert_eq!(row.data["distance_on_wood"].as_f64(), Some(20.0));
    connection
        .batch_execute(include_str!(
            "../migrations/20261017170000_unknown_surface_statistics/up.sql"
        ))
        .await?;
    Ok(())
}
