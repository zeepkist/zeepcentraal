use anyhow::{Result, ensure};
use diesel::migration::MigrationSource;

const MEDAL_MILLISECONDS: &str = include_str!("fixtures/apex_rebalance/medal_milliseconds.sql");
const SELECT_VALIDATION_TIME_EXPERT_LEVEL_ITEM: &str =
    include_str!("fixtures/apex_rebalance/select_validation_time_expert_level_item.sql");

const UP: &str = include_str!("../migrations/20261112030000_apex_five_percent/up.sql");
const DOWN: &str = include_str!("../migrations/20261112030000_apex_five_percent/down.sql");
const BASE_TIMES: &str = include_str!("fixtures/apex_rebalance/base_times.sql");

#[test]
fn rebalance_migration_is_embedded() {
    let migrations =
        <_ as MigrationSource<diesel::pg::Pg>>::migrations(&zc_database::migrations::MIGRATIONS)
            .unwrap();
    assert!(
        migrations
            .iter()
            .any(|migration| migration.name().version().to_string() == "20261112030000"),
        "5% Apex migration must ship in compiled executables"
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

    // Unavailable content retains its one authoritative item, ready for reactivation.
    tx.batch_execute(include_str!("fixtures/apex_rebalance/insert_record.sql"))
        .await?;
    // Failure after updating level 1 must roll the entire rebalance back.
    tx.batch_execute(include_str!("fixtures/apex_rebalance/savepoint.sql"))
        .await?;
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
    tx.batch_execute(include_str!(
        "fixtures/apex_rebalance/rollback_to_savepoint_insufficient.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(MEDAL_MILLISECONDS, &[])
            .await?
            .get::<_, Option<i64>>(0),
        Some(36809)
    );

    let base_times: String = tx.query_one(BASE_TIMES, &[]).await?.get(0);
    tx.batch_execute(UP).await?;
    assert_eq!(
        tx.query_one(BASE_TIMES, &[]).await?.get::<_, String>(0),
        base_times
    );
    for id in [1, 3] {
        let row = tx
            .query_one(
                include_str!("fixtures/apex_rebalance/medal_milliseconds_by_id.sql"),
                &[&id],
            )
            .await?;
        assert_eq!(row.get::<_, Option<i64>>(0), Some(36433));
        assert_eq!(row.get::<_, Option<i32>>(1), Some(2));
        assert_eq!(row.get::<_, i32>(2), 10);
    }
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/apex_rebalance/select_medal_personal_best_global.sql"),
            &[]
        )
        .await?
        .get::<_, Option<i16>>(0),
        Some(4)
    );
    let counts = tx
        .query_one(
            include_str!("fixtures/apex_rebalance/select_medal_apex_user_points.sql"),
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
    tx.batch_execute(include_str!(
        "fixtures/apex_rebalance/set_local_role_zeepcentraal_graphql.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/apex_rebalance/record_medal.sql"),
            &[]
        )
        .await?
        .get::<_, Option<i16>>(0),
        Some(4)
    );
    tx.batch_execute(include_str!(
        "fixtures/apex_rebalance/savepoint_by_id_1.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(MEDAL_MILLISECONDS, &[])
            .await?
            .get::<_, Option<i64>>(0),
        Some(36433)
    );
    tx.batch_execute(include_str!(
        "fixtures/apex_rebalance/rollback_to_savepoint_improvement.sql"
    ))
    .await?;

    // Newly qualifying levels still settle for seven days, then publish version 2.
    tx.batch_execute(include_str!("fixtures/apex_rebalance/insert_record_2.sql"))
        .await?;
    assert!(
        tx.query_one(
            include_str!("fixtures/apex_rebalance/select_validation_time_apex_level_item.sql"),
            &[]
        )
        .await?
        .get::<_, bool>(0)
    );
    tx.batch_execute(include_str!(
        "fixtures/apex_rebalance/set_medal_due_at_level_item.sql"
    ))
    .await?;
    assert!(
        tx.query_one(
            include_str!(
                "fixtures/apex_rebalance/select_validation_time_apex_level_item_by_id_2.sql"
            ),
            &[]
        )
        .await?
        .get::<_, bool>(0)
    );
    let frozen_expert = tx
        .query_one(SELECT_VALIDATION_TIME_EXPERT_LEVEL_ITEM, &[])
        .await?
        .get::<_, f64>(0);

    tx.batch_execute(DOWN).await?;
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/apex_rebalance/medal_milliseconds_by_id_1.sql"),
            &[]
        )
        .await?
        .get::<_, Option<i64>>(0),
        Some(36809)
    );
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/apex_rebalance/select_medal_calculation_version_level_item.sql"),
            &[]
        )
        .await?
        .get::<_, Option<i32>>(0),
        Some(1)
    );
    assert_eq!(
        tx.query_one(SELECT_VALIDATION_TIME_EXPERT_LEVEL_ITEM, &[])
            .await?
            .get::<_, f64>(0),
        frozen_expert
    );
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/apex_rebalance/select_medal_apex_user_points_by_id_user_5.sql"),
            &[]
        )
        .await?
        .get::<_, i32>(0),
        2
    );
    tx.batch_execute(UP).await?;
    assert_eq!(
        tx.query_one(MEDAL_MILLISECONDS, &[])
            .await?
            .get::<_, Option<i64>>(0),
        Some(36433)
    );
    assert!(
        tx.query_one(include_str!("fixtures/apex_rebalance/to_regclass.sql"), &[])
            .await?
            .get::<_, bool>(0)
    );
    tx.rollback().await?;
    Ok(())
}
