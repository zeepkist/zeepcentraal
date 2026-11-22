use anyhow::{Result, ensure};

const SET_LOCAL_ROLE_ZEEPCENTRAAL_GRAPHQL: &str =
    include_str!("fixtures/competitive_medals/set_local_role_zeepcentraal_graphql.sql");
const ZSL_LEVEL_RESULT_MEDAL_BY_ID_USER_1: &str =
    include_str!("fixtures/competitive_medals/zsl_level_result_medal_by_id_user_1.sql");
const ZSL_LEVEL_RESULT_MEDAL_BY_ID_USER_2: &str =
    include_str!("fixtures/competitive_medals/zsl_level_result_medal_by_id_user_2.sql");
const SELECT_LEVEL_ITEM: &str = include_str!("fixtures/competitive_medals/select_level_item.sql");
const MEDAL_MILLISECONDS_BY_ID_1: &str =
    include_str!("fixtures/competitive_medals/medal_milliseconds_by_id_1.sql");
const SELECT_APEX_USER_MEDAL_COUNTS: &str =
    include_str!("fixtures/competitive_medals/select_apex_user_medal_counts.sql");
const SELECT_VALIDATION_TIME_EXPERT_LEVEL_ITEM_BY_ID_1: &str = include_str!(
    "fixtures/competitive_medals/select_validation_time_expert_level_item_by_id_1.sql"
);
const SELECT_VALIDATION_TIME_EXPERT_LEVEL_ITEM_BY_ID_1_2: &str = include_str!(
    "fixtures/competitive_medals/select_validation_time_expert_level_item_by_id_1_2.sql"
);

const ORIGINAL_UP: &str = include_str!("../migrations/20261112000000_competitive_medals/up.sql");
const UP: &str = include_str!("../migrations/20261112010000_medal_times_on_level_items/up.sql");
const ORIGINAL_DOWN: &str =
    include_str!("../migrations/20261112000000_competitive_medals/down.sql");
const DOWN: &str = include_str!("../migrations/20261112010000_medal_times_on_level_items/down.sql");

#[tokio::test]
#[ignore = "requires disposable local competitive_medal_test database"]
async fn backfill_lifecycle_permissions_counts_and_rollback() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/competitive_medal_test",
        "Dedicated local medal database required"
    );
    let (mut client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("medal test connection") });
    let tx = client.transaction().await?;
    tx.batch_execute(include_str!("fixtures/competitive_medals.sql"))
        .await?;
    tx.batch_execute(ORIGINAL_UP).await?;
    tx.batch_execute(UP).await?;
    tx.batch_execute(include_str!(
        "fixtures/competitive_medals/create_zsl_level.sql"
    ))
    .await?;
    tx.batch_execute(include_str!(
        "../migrations/20261112020000_zsl_result_medals/up.sql"
    ))
    .await?;
    let official_medals: Vec<Option<i16>> = tx
        .query(
            include_str!("fixtures/competitive_medals/zsl_level_result_medal.sql"),
            &[],
        )
        .await?
        .iter()
        .map(|row| row.get(0))
        .collect();
    assert_eq!(
        official_medals,
        vec![Some(5), Some(4), Some(3), Some(2), Some(1), Some(0), None]
    );
    tx.batch_execute(SET_LOCAL_ROLE_ZEEPCENTRAAL_GRAPHQL)
        .await?;
    assert_eq!(
        tx.query_one(ZSL_LEVEL_RESULT_MEDAL_BY_ID_USER_1, &[])
            .await?
            .get::<_, Option<i16>>(0),
        Some(5)
    );
    tx.batch_execute(include_str!("fixtures/competitive_medals/savepoint.sql"))
        .await?;
    assert_eq!(
        tx.query_one(ZSL_LEVEL_RESULT_MEDAL_BY_ID_USER_1, &[])
            .await?
            .get::<_, Option<i16>>(0),
        None
    );
    tx.batch_execute(include_str!("fixtures/competitive_medals/rollback.sql"))
        .await?;
    assert_eq!(
        tx.query_one(ZSL_LEVEL_RESULT_MEDAL_BY_ID_USER_1, &[])
            .await?
            .get::<_, Option<i16>>(0),
        None
    );
    tx.batch_execute(include_str!("fixtures/competitive_medals/rollback_2.sql"))
        .await?;
    assert_eq!(
        tx.query_one(ZSL_LEVEL_RESULT_MEDAL_BY_ID_USER_2, &[])
            .await?
            .get::<_, Option<i16>>(0),
        Some(3)
    );
    tx.batch_execute(include_str!(
        "fixtures/competitive_medals/set_deleted_level_item.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(ZSL_LEVEL_RESULT_MEDAL_BY_ID_USER_2, &[])
            .await?
            .get::<_, Option<i16>>(0),
        Some(4)
    );
    tx.batch_execute(include_str!(
        "fixtures/competitive_medals/rollback_to_savepoint_zsl_medal_checks.sql"
    ))
    .await?;
    tx.batch_execute(include_str!(
        "../migrations/20261112020000_zsl_result_medals/down.sql"
    ))
    .await?;
    assert!(
        tx.query_one(
            include_str!("fixtures/competitive_medals/to_regprocedure.sql"),
            &[]
        )
        .await?
        .get::<_, bool>(0)
    );
    let thresholds = tx
        .query_one(
            include_str!("fixtures/competitive_medals/medal_milliseconds.sql"),
            &[],
        )
        .await?;
    assert_eq!(thresholds.get::<_, Option<i64>>(0), Some(38251));
    assert_eq!(thresholds.get::<_, Option<i64>>(1), Some(36809));
    assert_eq!(thresholds.get::<_, i32>(2), 1);
    assert!(thresholds.get::<_, bool>(3) && thresholds.get::<_, bool>(4));
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/competitive_medals/count_personal_best_global.sql"),
            &[]
        )
        .await?
        .get::<_, i32>(0),
        5
    );
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/competitive_medals/count_personal_best_global_by_medal_4.sql"),
            &[]
        )
        .await?
        .get::<_, i32>(0),
        4
    );
    assert!(
        tx.query_one(
            include_str!("fixtures/competitive_medals/to_regclass.sql"),
            &[]
        )
        .await?
        .get::<_, bool>(0)
    );
    let base = tx
        .query_one(
            include_str!(
                "fixtures/competitive_medals/select_validation_time_author_level_item.sql"
            ),
            &[],
        )
        .await?;
    assert_eq!(
        [
            base.get::<_, f32>(0),
            base.get::<_, f32>(1),
            base.get::<_, f32>(2),
            base.get::<_, f32>(3)
        ],
        [40.0, 45.0, 50.0, 60.0]
    );
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/competitive_medals/count_information_schema.sql"),
            &[]
        )
        .await?
        .get::<_, i32>(0),
        6
    );
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/competitive_medals/select_user_points.sql"),
            &[]
        )
        .await?
        .get::<_, i64>(0),
        5
    );
    tx.batch_execute(include_str!(
        "fixtures/competitive_medals/refresh_level_medals.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/competitive_medals/count_job.sql"),
            &[]
        )
        .await?
        .get::<_, i32>(0),
        0
    );
    // Matching a threshold earns that tier. Float storage must not lose one millisecond.
    tx.batch_execute(include_str!(
        "fixtures/competitive_medals/insert_record.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/competitive_medals/select_medal_personal_best_global.sql"),
            &[]
        )
        .await?
        .get::<_, Option<i16>>(0),
        Some(4)
    );
    // Corrections preserve finalised thresholds without retaining history.
    tx.batch_execute(include_str!(
        "fixtures/competitive_medals/set_record_eligible_record.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(SELECT_LEVEL_ITEM, &[]).await?.get::<_, i32>(0),
        1
    );
    assert!(
        tx.query_one(
            include_str!(
                "fixtures/competitive_medals/select_medal_personal_best_global_by_id_1.sql"
            ),
            &[]
        )
        .await?
        .get::<_, Option<i16>>(0)
        .is_none()
    );
    // Metadata uses current PBs immediately; insufficient population suspends the pair.
    tx.batch_execute(include_str!(
        "fixtures/competitive_medals/set_validation_time_author_level_item.sql"
    ))
    .await?;
    assert!(
        tx.query_one(MEDAL_MILLISECONDS_BY_ID_1, &[])
            .await?
            .get::<_, Option<i64>>(0)
            .is_none()
    );
    assert_eq!(
        tx.query_one(SELECT_LEVEL_ITEM, &[]).await?.get::<_, i32>(0),
        0
    );
    tx.batch_execute(include_str!(
        "fixtures/competitive_medals/set_validation_time_author_level_item_by_id_1.sql"
    ))
    .await?;
    assert!(
        tx.query_one(MEDAL_MILLISECONDS_BY_ID_1, &[])
            .await?
            .get::<_, Option<i64>>(0)
            .is_some()
    );
    // New qualifications settle for seven days and retain their first deadline after a drop.
    tx.batch_execute(include_str!(
        "fixtures/competitive_medals/insert_record_2.sql"
    ))
    .await?;
    assert!(
        tx.query_one(
            include_str!("fixtures/competitive_medals/select_medal_due_at_level_item.sql"),
            &[]
        )
        .await?
        .get::<_, bool>(0)
    );
    tx.batch_execute(include_str!(
        "fixtures/competitive_medals/set_medal_due_at_level_item.sql"
    ))
    .await?;
    assert!(
        tx.query_one(
            include_str!("fixtures/competitive_medals/select_medal_due_at_level_item_by_id_2.sql"),
            &[]
        )
        .await?
        .get::<_, bool>(0)
    );
    tx.batch_execute(include_str!(
        "fixtures/competitive_medals/set_record_eligible_record_by_id_110.sql"
    ))
    .await?;
    assert!(
        tx.query_one(
            include_str!(
                "fixtures/competitive_medals/select_validation_time_expert_level_item.sql"
            ),
            &[]
        )
        .await?
        .get::<_, bool>(0)
    );
    // Millisecond collapse publishes neither target.
    assert!(
        tx.query_one(
            include_str!(
                "fixtures/competitive_medals/select_expert_ms_calculate_medal_thresholds.sql"
            ),
            &[]
        )
        .await?
        .get::<_, bool>(0)
    );
    // Availability and bans affect counts without multiplying duplicate uploads.
    tx.batch_execute(include_str!(
        "fixtures/competitive_medals/insert_level_item.sql"
    ))
    .await?;
    let counts = tx
        .query_one(SELECT_APEX_USER_MEDAL_COUNTS, &[])
        .await?
        .get::<_, i32>(0);
    assert_eq!(counts, 2);
    tx.batch_execute(include_str!(
        "fixtures/competitive_medals/set_deleted_level_item_by_id_level_2.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(SELECT_APEX_USER_MEDAL_COUNTS, &[])
            .await?
            .get::<_, i32>(0),
        1
    );
    tx.batch_execute(include_str!(
        "fixtures/competitive_medals/set_banned_user.sql"
    ))
    .await?;
    tx.batch_execute(include_str!("fixtures/competitive_medals/delete_job.sql"))
        .await?;
    assert_eq!(
        tx.query_one(
            include_str!(
                "fixtures/competitive_medals/count_job_by_task_update_level_record_counts.sql"
            ),
            &[]
        )
        .await?
        .get::<_, i32>(0),
        1
    );
    assert_eq!(
        tx.query_one(SELECT_APEX_USER_MEDAL_COUNTS, &[])
            .await?
            .get::<_, i32>(0),
        0
    );
    // A new latest item takes ownership of frozen targets; the old row stores no copy.
    let frozen = tx
        .query_one(SELECT_VALIDATION_TIME_EXPERT_LEVEL_ITEM_BY_ID_1, &[])
        .await?
        .get::<_, f64>(0);
    tx.batch_execute(include_str!(
        "fixtures/competitive_medals/insert_level_item_2.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(
            include_str!(
                "fixtures/competitive_medals/select_validation_time_expert_level_item_by_id_5.sql"
            ),
            &[]
        )
        .await?
        .get::<_, f64>(0),
        frozen
    );
    assert!(
        tx.query_one(SELECT_VALIDATION_TIME_EXPERT_LEVEL_ITEM_BY_ID_1_2, &[])
            .await?
            .get::<_, bool>(0)
    );
    tx.batch_execute(include_str!(
        "fixtures/competitive_medals/set_deleted_level_item_by_id_5.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(SELECT_VALIDATION_TIME_EXPERT_LEVEL_ITEM_BY_ID_1, &[])
            .await?
            .get::<_, f64>(0),
        frozen
    );
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/competitive_medals/count_level_item.sql"),
            &[]
        )
        .await?
        .get::<_, i32>(0),
        1
    );
    // A different Author Time on the selected item recalculates immediately, not after seven days.
    tx.batch_execute(include_str!(
        "fixtures/competitive_medals/insert_record_3.sql"
    ))
    .await?;
    assert!(
        tx.query_one(
            include_str!(
                "fixtures/competitive_medals/select_validation_time_expert_level_item_by_id_6.sql"
            ),
            &[&frozen]
        )
        .await?
        .get::<_, bool>(0)
    );
    assert!(
        tx.query_one(SELECT_VALIDATION_TIME_EXPERT_LEVEL_ITEM_BY_ID_1_2, &[])
            .await?
            .get::<_, bool>(0)
    );
    tx.batch_execute(SET_LOCAL_ROLE_ZEEPCENTRAAL_GRAPHQL)
        .await?;
    assert!(
        tx.query_one(
            include_str!("fixtures/competitive_medals/record_medal.sql"),
            &[]
        )
        .await?
        .get::<_, bool>(0)
    );
    assert!(
        tx.query_one(
            include_str!("fixtures/competitive_medals/record_history_entry_medal.sql"),
            &[]
        )
        .await?
        .get::<_, bool>(0)
    );
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/competitive_medals/select_apex_medal_counts.sql"),
            &[]
        )
        .await?
        .get::<_, i64>(0),
        1
    );
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/competitive_medals/select_apex_medal_counts_2.sql"),
            &[]
        )
        .await?
        .get::<_, i64>(0),
        0
    );
    tx.batch_execute(include_str!("fixtures/competitive_medals/reset_role.sql"))
        .await?;
    tx.batch_execute(include_str!(
        "fixtures/competitive_medals/savepoint_ambiguous_identifier.sql"
    ))
    .await?;
    assert!(
        tx.query_one(
            include_str!("fixtures/competitive_medals/select_medal_counts.sql"),
            &[]
        )
        .await
        .is_err()
    );
    tx.batch_execute(include_str!(
        "fixtures/competitive_medals/rollback_to_savepoint_ambiguous_identifier.sql"
    ))
    .await?;
    tx.batch_execute(include_str!(
        "fixtures/competitive_medals/savepoint_dirty_medal_counts.sql"
    ))
    .await?;
    tx.batch_execute(include_str!(
        "../migrations/20261121010000_dirty_user_medal_counts/up.sql"
    ))
    .await?;
    tx.batch_execute(include_str!(
        "fixtures/competitive_medals/refresh_dirty_user_medal_counts.sql"
    ))
    .await?;
    tx.batch_execute(include_str!(
        "../migrations/20261121010000_dirty_user_medal_counts/down.sql"
    ))
    .await?;
    tx.batch_execute(include_str!(
        "fixtures/competitive_medals/rollback_to_savepoint_dirty_medal_counts.sql"
    ))
    .await?;
    let rollback_expert=tx.query_one(include_str!("fixtures/competitive_medals/select_validation_time_expert_level_item_by_id_level_1.sql"), &[]).await?.get::<_,f64>(0);
    tx.batch_execute(DOWN).await?;
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/competitive_medals/select_expert_ms_level_medal_threshold.sql"),
            &[]
        )
        .await?
        .get::<_, i64>(0),
        (rollback_expert * 1000.0).round() as i64
    );
    tx.batch_execute(ORIGINAL_DOWN).await?;
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/competitive_medals/select_points_user_points.sql"),
            &[]
        )
        .await?
        .get::<_, i32>(0),
        123
    );
    tx.rollback().await?;
    Ok(())
}
