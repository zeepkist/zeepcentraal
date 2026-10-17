use anyhow::{Context, Result, ensure};
use diesel::{QueryableByName, sql_query, sql_types::Jsonb};
use diesel_async::{RunQueryDsl, SimpleAsyncConnection};
use serde_json::Value;
use zc_database::Database;

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
    connection.batch_execute(r#"
        INSERT INTO public."user"(id,steam_id) VALUES(1,42);
        INSERT INTO public.level(id,xx_hash) VALUES(1,repeat('a',32));
        INSERT INTO public.record(id,id_user,id_level,time) SELECT id,1,1,10 FROM generate_series(1,8) id;
        INSERT INTO public.record_statistic(id_record,ghost_version,distance_on_ground,time_on_ground,distance_on_wood,time_on_wood,date_created)
        VALUES (1,7,100,10,20,2,'2020-01-01'),(2,8,100,10,200,20,'2020-01-01'),
               (3,6,100,10,20,2,'2020-01-01'),(4,8,NULL,NULL,NULL,NULL,'2020-01-01'),
               (5,8,100,NULL,20,NULL,'2020-01-01'),(6,7,100,10,NULL,NULL,'2020-01-01');
        UPDATE public.record_statistic SET time_on_unknown=7 WHERE id_record=6;
    "#).await?;
    let bound = database.surface_statistics_upper_bound().await?;
    assert_eq!(bound, 6);
    assert_eq!(database.remaining_surface_statistics(bound).await?, 4);
    connection.batch_execute("INSERT INTO public.record_statistic(id_record,ghost_version,distance_on_ground,time_on_ground) VALUES(7,8,100,10)").await?;
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
    let rows =
        sql_query("SELECT to_jsonb(s) AS data FROM public.record_statistic s ORDER BY id_record")
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
    let row =
        sql_query("SELECT to_jsonb(s) AS data FROM public.record_statistic s WHERE id_record=1")
            .get_result::<Row>(&mut connection)
            .await?;
    assert_eq!(before, row.data["date_updated"]);
    connection
        .batch_execute(include_str!(
            "../migrations/20261017170000_unknown_surface_statistics/down.sql"
        ))
        .await?;
    let row =
        sql_query("SELECT to_jsonb(s) AS data FROM public.record_statistic s WHERE id_record=1")
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
