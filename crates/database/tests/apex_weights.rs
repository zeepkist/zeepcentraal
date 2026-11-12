use anyhow::{Result, ensure};
use diesel::migration::MigrationSource;

const UP: &str = include_str!("../migrations/20261112040000_apex_top_weighted/up.sql");
const DOWN: &str = include_str!("../migrations/20261112040000_apex_top_weighted/down.sql");
const BASE_TIMES: &str = "SELECT json_agg(json_build_array(id,validation_time_bronze,validation_time_silver,validation_time_gold,validation_time_author,validation_time_expert) ORDER BY id)::text FROM public.level_item";

#[test]
fn rebalance_migration_is_embedded() {
    let migrations =
        <_ as MigrationSource<diesel::pg::Pg>>::migrations(&zc_database::migrations::MIGRATIONS)
            .unwrap();
    assert!(
        migrations
            .iter()
            .any(|migration| migration.name().version().to_string() == "20261112040000"),
        "Top-weighted Apex migration must ship in compiled executables"
    );
}

#[tokio::test]
#[ignore = "requires disposable local competitive_medal_test database"]
async fn rebalance_frozen_targets_counts_future_calculations_and_rollback() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/competitive_medal_test",
        "Dedicated local medal database required"
    );
    let (mut client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("Apex rebalance test connection") });
    let tx = client.transaction().await?;
    tx.batch_execute(include_str!("fixtures/competitive_medals.sql"))
        .await?;
    tx.batch_execute(include_str!(
        "../migrations/20261112000000_competitive_medals/up.sql"
    ))
    .await?;
    tx.batch_execute(include_str!(
        "../migrations/20261112010000_medal_times_on_level_items/up.sql"
    ))
    .await?;

    tx.batch_execute(include_str!(
        "../migrations/20261112030000_apex_five_percent/up.sql"
    ))
    .await?;

    // Unavailable content retains its one authoritative item, ready for reactivation.
    tx.batch_execute("INSERT INTO public.record(id,id_user,id_level,time) SELECT 300+id,id_user,3,time FROM public.record WHERE id BETWEEN 1 AND 10; INSERT INTO public.personal_best_global(id,id_user,id_level,id_record,record_eligible) SELECT id,id_user,id_level,id,true FROM public.record WHERE id BETWEEN 301 AND 310; UPDATE public.level_item SET validation_time_expert=38.251,validation_time_apex=36.433,medal_calculation_version=2,medal_calculated_at=now(),medal_qualified_at=now(),deleted=true WHERE id=3").await?;
    // Failure after updating level 1 must roll the entire rebalance back.
    tx.batch_execute("SAVEPOINT insufficient; UPDATE public.personal_best_global SET record_eligible=false WHERE id=301").await?;
    let error = tx
        .batch_execute(UP)
        .await
        .expect_err("insufficient population must abort");
    assert!(
        error
            .as_db_error()
            .unwrap()
            .message()
            .contains("fewer than 10 eligible PBs")
    );
    tx.batch_execute("ROLLBACK TO SAVEPOINT insufficient")
        .await?;
    assert_eq!(tx.query_one("SELECT zc_private.medal_milliseconds(validation_time_apex) FROM public.level_item WHERE id=1", &[]).await?.get::<_, Option<i64>>(0),Some(36433));

    let base_times: String = tx.query_one(BASE_TIMES, &[]).await?.get(0);
    tx.batch_execute(UP).await?;
    assert_eq!(
        tx.query_one(BASE_TIMES, &[]).await?.get::<_, String>(0),
        base_times
    );
    for id in [1, 3] {
        let row=tx.query_one("SELECT zc_private.medal_milliseconds(validation_time_apex),medal_calculation_version,medal_eligible_pb_count FROM public.level_item WHERE id=$1", &[&id]).await?;
        assert_eq!(row.get::<_, Option<i64>>(0), Some(36152));
        assert_eq!(row.get::<_, Option<i32>>(1), Some(3));
        assert_eq!(row.get::<_, i32>(2), 10);
    }
    assert_eq!(
        tx.query_one(
            "SELECT medal FROM public.personal_best_global WHERE id=4",
            &[]
        )
        .await?
        .get::<_, Option<i16>>(0),
        Some(4)
    );
    let counts = tx
        .query_one(
            "SELECT medal_apex,medal_expert,points FROM public.user_points WHERE id_user=4",
            &[],
        )
        .await?;
    assert_eq!(
        (
            counts.get::<_, i32>(0),
            counts.get::<_, i32>(1),
            counts.get::<_, i32>(2)
        ),
        (0, 1, 123)
    );
    tx.batch_execute("SET LOCAL ROLE zeepcentraal_graphql")
        .await?;
    assert_eq!(
        tx.query_one(
            "SELECT public.record_medal(r) FROM public.record r WHERE id=4",
            &[]
        )
        .await?
        .get::<_, Option<i16>>(0),
        Some(4)
    );
    tx.batch_execute("RESET ROLE; SAVEPOINT improvement; INSERT INTO public.record(id,id_user,id_level,time) VALUES(500,1,1,34); UPDATE public.personal_best_global SET id_record=500 WHERE id=1; SELECT zc_private.refresh_level_medals(1)").await?;
    assert_eq!(tx.query_one("SELECT zc_private.medal_milliseconds(validation_time_apex) FROM public.level_item WHERE id=1", &[]).await?.get::<_, Option<i64>>(0),Some(36152));
    tx.batch_execute("ROLLBACK TO SAVEPOINT improvement")
        .await?;

    // Newly qualifying levels still settle for seven days, then publish version 3.
    tx.batch_execute("INSERT INTO public.record(id,id_user,id_level,time) VALUES(210,10,2,36.2); INSERT INTO public.personal_best_global(id,id_user,id_level,id_record,record_eligible) VALUES(210,10,2,210,true); SELECT zc_private.refresh_level_medals(2)").await?;
    assert!(tx.query_one("SELECT validation_time_apex IS NULL AND medal_due_at-medal_qualified_at>=interval '7 days' FROM public.level_item WHERE id=2", &[]).await?.get::<_,bool>(0));
    tx.batch_execute("UPDATE public.level_item SET medal_due_at=now()-interval '1 day' WHERE id=2; SELECT zc_private.refresh_level_medals(2)").await?;
    assert!(tx.query_one("SELECT validation_time_apex IS NOT NULL AND medal_calculation_version=3 AND medal_due_at IS NULL FROM public.level_item WHERE id=2", &[]).await?.get::<_,bool>(0));
    let frozen_expert = tx
        .query_one(
            "SELECT validation_time_expert FROM public.level_item WHERE id=2",
            &[],
        )
        .await?
        .get::<_, f64>(0);

    tx.batch_execute(DOWN).await?;
    assert_eq!(tx.query_one("SELECT zc_private.medal_milliseconds(validation_time_apex),medal_calculation_version FROM public.level_item WHERE id=1", &[]).await?.get::<_, Option<i64>>(0),Some(36433));
    assert_eq!(
        tx.query_one(
            "SELECT medal_calculation_version FROM public.level_item WHERE id=1",
            &[]
        )
        .await?
        .get::<_, Option<i32>>(0),
        Some(2)
    );
    assert_eq!(
        tx.query_one(
            "SELECT validation_time_expert FROM public.level_item WHERE id=2",
            &[]
        )
        .await?
        .get::<_, f64>(0),
        frozen_expert
    );
    assert_eq!(
        tx.query_one(
            "SELECT medal_apex FROM public.user_points WHERE id_user=4",
            &[]
        )
        .await?
        .get::<_, i32>(0),
        2
    );
    tx.batch_execute(UP).await?;
    assert_eq!(tx.query_one("SELECT zc_private.medal_milliseconds(validation_time_apex) FROM public.level_item WHERE id=1", &[]).await?.get::<_, Option<i64>>(0),Some(36152));
    assert!(tx.query_one("SELECT to_regclass('public.level_medal_threshold') IS NULL AND to_regclass('zc_private.level_medal_revision') IS NULL", &[]).await?.get::<_,bool>(0));
    tx.rollback().await?;
    Ok(())
}
