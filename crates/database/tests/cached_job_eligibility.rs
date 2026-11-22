use anyhow::{Result, ensure};
use tokio_postgres::{Client, NoTls};
use zc_database::{Database, services::jobs::MaintenanceOutcome};

async fn refresh_positions(database: &Database) -> Result<()> {
    let mut after = 0;
    let mut pages = 0;
    loop {
        let page = database.level_contribution_user_page(1, after, 50).await?;
        ensure!(
            matches!(
                database
                    .reconcile_level_contribution_users(1, &page.user_ids)
                    .await?,
                MaintenanceOutcome::Applied(_)
            ),
            "uncontended fixture repair required"
        );
        pages += 1;
        let Some(next) = page.next_after_user_id else {
            break;
        };
        after = next;
    }
    assert!(pages >= 2, "fixture must exercise multiple cursor pages");
    Ok(())
}

async fn assert_positions(client: &Client) -> Result<()> {
    let mismatch: i64 = client
        .query_one(
            include_str!("fixtures/cached_job_eligibility/select_personal_best_global.sql"),
            &[],
        )
        .await?
        .get(0);
    assert_eq!(
        mismatch, 0,
        "cached ranks differ from validation-derived ranks"
    );
    Ok(())
}

#[tokio::test]
#[ignore = "requires local cached_job_eligibility_test with persisted eligibility migration and scoring schema"]
async fn cached_queries_preserve_activity_ranks_repairs_and_score_inputs() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/cached_job_eligibility_test",
        "Dedicated local cached_job_eligibility_test database required"
    );
    let (client, connection) = tokio_postgres::connect(&url, NoTls).await?;
    tokio::spawn(async move { connection.await.expect("cached eligibility connection") });
    client
        .batch_execute(include_str!(
            "fixtures/cached_job_eligibility/truncate_user.sql"
        ))
        .await?;
    let database = Database::connect(&url, 4).await?;
    let activity = database.user_activity_page(0, 1000).await?;
    for user in activity {
        let expected: bool = client
            .query_one(
                include_str!("fixtures/cached_job_eligibility/exists.sql"),
                &[&user.id_user],
            )
            .await?
            .get(0);
        assert_eq!(user.active, expected);
    }
    // Failed PB remains discoverable through its stale contribution until repair removes it.
    assert!(
        database
            .level_contribution_user_page(1, 0, 50)
            .await?
            .user_ids
            .contains(&1)
    );
    refresh_positions(&database).await?;
    assert_positions(&client).await?;
    assert_eq!(
        client
            .query_one(
                include_str!("fixtures/cached_job_eligibility/count_user_point_contribution.sql"),
                &[]
            )
            .await?
            .get::<_, i64>(0),
        0
    );

    // Improved PB on page two changes users on every page, including tied times.
    client
        .batch_execute(include_str!(
            "fixtures/cached_job_eligibility/insert_record.sql"
        ))
        .await?;
    refresh_positions(&database).await?;
    assert_positions(&client).await?;
    assert_eq!(client.query_one(include_str!("fixtures/cached_job_eligibility/select_level_position_user_point_contribution.sql"),&[]).await?.get::<_,i32>(0),1);

    // Cached predicates agree under both bypass-RLS and restricted SELECT roles.
    let cached = include_str!("fixtures/cached_job_eligibility/select_record.sql");
    let expected: Vec<i32> = client
        .query_one(
            include_str!("fixtures/cached_job_eligibility/select_record_by_id_record.sql"),
            &[],
        )
        .await?
        .get(0);
    assert_eq!(
        client.query_one(cached, &[]).await?.get::<_, Vec<i32>>(0),
        expected
    );
    client
        .batch_execute(include_str!("fixtures/cached_job_eligibility/grant.sql"))
        .await?;
    assert_eq!(
        client.query_one(cached, &[]).await?.get::<_, Vec<i32>>(0),
        expected
    );
    client
        .batch_execute(include_str!(
            "fixtures/cached_job_eligibility/reset_role.sql"
        ))
        .await?;

    database.rebuild_player_skill_aggregates().await?;
    assert!(matches!(
        database.update_level_scores(&[1], false).await?,
        MaintenanceOutcome::Applied(_)
    ));
    assert!(matches!(
        database.update_level_scores(&[2], false).await?,
        MaintenanceOutcome::Applied(_)
    ));
    assert_eq!(
        client
            .query_one(
                include_str!("fixtures/cached_job_eligibility/select_points_level_points.sql"),
                &[]
            )
            .await?
            .get::<_, i32>(0),
        0
    );
    assert_eq!(
        database.reconcile_record_eligibility(1).await?,
        MaintenanceOutcome::Applied(())
    );
    assert_eq!(
        client
            .query_one(
                include_str!(
                    "fixtures/cached_job_eligibility/select_id_user_world_record_global.sql"
                ),
                &[]
            )
            .await?
            .get::<_, i32>(0),
        56
    );
    assert_eq!(
        client
            .query_one(
                include_str!("fixtures/cached_job_eligibility/count_personal_best_global.sql"),
                &[]
            )
            .await?
            .get::<_, i64>(0),
        0
    );

    // Failed evidence cannot be restored; unavailable levels still count as zero.
    client
        .batch_execute(include_str!(
            "fixtures/cached_job_eligibility/set_status_record_validation.sql"
        ))
        .await?;
    assert_eq!(
        database.reconcile_record_eligibility(1).await?,
        MaintenanceOutcome::Applied(())
    );
    let counts = client
        .query_one(
            include_str!(
                "fixtures/cached_job_eligibility/select_personal_bests_user_record_counts.sql"
            ),
            &[],
        )
        .await?;
    assert_eq!((counts.get::<_, i32>(0), counts.get::<_, i32>(1)), (0, 0));

    let stale = database
        .user_score_sources(&[56])
        .await?
        .pop()
        .expect("fixture score source");
    assert!(!stale.contributions.is_empty());
    client
        .execute(
            include_str!(
                "fixtures/cached_job_eligibility/set_level_points_user_point_contribution.sql"
            ),
            &[],
        )
        .await?;
    let count_invalidations =
        include_str!("fixtures/cached_job_eligibility/count_live_query_invalidations.sql");
    let before: i64 = client.query_one(count_invalidations, &[]).await?.get(0);
    assert!(matches!(
        database.recalculate_player_score_from(stale).await?,
        MaintenanceOutcome::Applied(())
    ));
    let after: i64 = client.query_one(count_invalidations, &[]).await?.get(0);
    assert_eq!(after - before, 1, "only the successful retry invalidates");
    Ok(())
}
