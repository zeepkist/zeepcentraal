use anyhow::{Result, ensure};
use zc_core::ghost_validation::ValidationReport;
use zc_database::Database;

const SELECT_RECORD: &str = include_str!("fixtures/record_eligibility/select_record.sql");
const COUNT_DISCORD_ACTIVITY_EVENT: &str =
    include_str!("fixtures/record_eligibility/count_discord_activity_event.sql");
const COUNT_JOB: &str = include_str!("fixtures/record_eligibility/count_job.sql");
const SELECT_ID_RECORD_WORLD_RECORD_GLOBAL: &str =
    include_str!("fixtures/record_eligibility/select_id_record_world_record_global.sql");
const SELECT_DATE_UPDATED_PERSONAL_BEST_GLOBAL: &str =
    include_str!("fixtures/record_eligibility/select_date_updated_personal_best_global.sql");
const COUNT_WORLD_RECORD_GLOBAL_BY_ID_LEVEL_2: &str =
    include_str!("fixtures/record_eligibility/count_world_record_global_by_id_level_2.sql");

#[tokio::test]
#[ignore = "requires isolated record_eligibility_test with persisted eligibility and current scoring schema"]
async fn repairs_visibility_assignments_tournaments_and_rollback() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/record_eligibility_test",
        "Isolated local database required"
    );
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("fixture connection") });
    let persisted_eligibility = client
        .query_one(include_str!("fixtures/record_eligibility/exists.sql"), &[])
        .await?
        .get::<_, bool>(0);
    ensure!(
        persisted_eligibility,
        "Persisted eligibility fixture required"
    );
    if !client
        .query_one(
            include_str!("fixtures/record_eligibility/exists_by_table_schema_public.sql"),
            &[],
        )
        .await?
        .get::<_, bool>(0)
    {
        client
            .batch_execute(include_str!(
                "../migrations/20261018010000_validation_metadata_guards/up.sql"
            ))
            .await?;
    }
    client
        .batch_execute(include_str!(
            "fixtures/record_eligibility/truncate_user.sql"
        ))
        .await?;
    let db = Database::connect(&url, 4).await?;
    let original = client
        .query_one(SELECT_RECORD, &[])
        .await?
        .get::<_, String>(0);
    let pb = client
        .query_one(
            include_str!("fixtures/record_eligibility/select_id_personal_best_global.sql"),
            &[],
        )
        .await?;
    let events = client
        .query_one(COUNT_DISCORD_ACTIVITY_EVENT, &[])
        .await?
        .get::<_, i64>(0);
    db.save_record_validation(1, None, &ValidationReport::failed("missing_checkpoint"))
        .await?;
    let count = client.query_one(COUNT_JOB, &[]).await?.get::<_, i64>(0);
    assert_eq!(count, 1);
    db.save_record_validation(1, None, &ValidationReport::failed("missing_checkpoint"))
        .await?;
    assert_eq!(
        client.query_one(COUNT_JOB, &[]).await?.get::<_, i64>(0),
        count
    );
    client
        .batch_execute(include_str!(
            "fixtures/record_eligibility/set_role_zeepcentraal_graphql.sql"
        ))
        .await?;
    assert!(
        client
            .query(
                include_str!("fixtures/record_eligibility/select_report_record_validation.sql"),
                &[]
            )
            .await
            .is_err(),
        "detailed evidence stays private"
    );
    assert_eq!(
        client
            .query_one(
                include_str!("fixtures/record_eligibility/count_track_tournament_result.sql"),
                &[]
            )
            .await?
            .get::<_, i64>(0),
        1,
        "finalized snapshot stays visible"
    );
    assert!(
        client
            .query_one(
                include_str!("fixtures/record_eligibility/select_id_track_tournament_result.sql"),
                &[]
            )
            .await?
            .get::<_, Option<i32>>(0)
            .is_none(),
        "failed record relationship hidden"
    );
    for sql in [
        include_str!("fixtures/record_eligibility/count_record.sql"),
        include_str!("fixtures/record_eligibility/count_record_media.sql"),
        include_str!("fixtures/record_eligibility/count_record_statistic.sql"),
        include_str!("fixtures/record_eligibility/count_personal_best_global.sql"),
        include_str!("fixtures/record_eligibility/count_world_record_global.sql"),
        include_str!("fixtures/record_eligibility/count_record_history_entry.sql"),
    ] {
        assert_eq!(
            client.query_one(sql, &[]).await?.get::<_, i64>(0),
            0,
            "{sql}"
        );
    }
    assert_eq!(
        client
            .query_one(
                include_str!("fixtures/record_eligibility/count_record_by_id_2.sql"),
                &[]
            )
            .await?
            .get::<_, i64>(0),
        1
    );
    client
        .batch_execute(include_str!("fixtures/record_eligibility/reset_role.sql"))
        .await?;
    client
        .batch_execute(include_str!("fixtures/record_eligibility/setval.sql"))
        .await?;
    let statistics = zc_core::ghosts::GhostStatistics::default();
    let submitted = db
        .submit_record(zc_database::services::record::RecordSubmission {
            evidence: None,
            id_user: 1,
            id_level: 1,
            time: 15.,
            game_version: "test",
            mod_version: "test",
            splits: &[],
            speeds: &[],
            statistics: &statistics,
        })
        .await?;
    assert!(
        !submitted.personal_best_changed,
        "slower run cannot replace eligible backup PB"
    );
    assert!(
        submitted.world_record_user_ids.is_empty(),
        "slower run cannot be announced as WR"
    );
    client
        .batch_execute(include_str!(
            "fixtures/record_eligibility/pg_advisory_xact_lock.sql"
        ))
        .await?;
    assert!(matches!(
        db.reconcile_record_eligibility(1).await?,
        zc_database::services::jobs::MaintenanceOutcome::Contended
    ));
    client
        .batch_execute(include_str!("fixtures/record_eligibility/rollback.sql"))
        .await?;
    let (first, second) = tokio::join!(
        db.reconcile_record_eligibility(1),
        db.reconcile_record_eligibility(1)
    );
    first?;
    second?;
    let updated = client
        .query_one(
            include_str!(
                "fixtures/record_eligibility/select_id_personal_best_global_by_id_user_1.sql"
            ),
            &[],
        )
        .await?;
    assert_eq!(updated.get::<_, i32>(0), pb.get::<_, i32>(0));
    assert_eq!(updated.get::<_, i32>(1), 2);
    assert_eq!(updated.get::<_, String>(2), pb.get::<_, String>(1));
    assert_eq!(
        client
            .query_one(SELECT_ID_RECORD_WORLD_RECORD_GLOBAL, &[])
            .await?
            .get::<_, i32>(0),
        3
    );
    assert_eq!(
        client
            .query_one(
                include_str!(
                    "fixtures/record_eligibility/count_personal_best_global_by_id_user_3.sql"
                ),
                &[]
            )
            .await?
            .get::<_, i64>(0),
        0,
        "banned player"
    );
    assert_eq!(
        client
            .query_one(
                include_str!(
                    "fixtures/record_eligibility/select_id_record_track_tournament_result.sql"
                ),
                &[]
            )
            .await?
            .get::<_, i32>(0),
        2
    );
    assert_eq!(
        client
            .query_one(
                include_str!("fixtures/record_eligibility/enqueue_level_contributions.sql"),
                &[]
            )
            .await?
            .get::<_, i32>(0),
        1,
        "finalized result preserved"
    );
    assert_eq!(client.query_one(include_str!("fixtures/record_eligibility/count_track_tournament_result_by_id_tournament_1.sql"),&[]).await?.get::<_,i64>(0),0,"outside original window");
    assert_eq!(
        client
            .query_one(COUNT_DISCORD_ACTIVITY_EVENT, &[])
            .await?
            .get::<_, i64>(0),
        events,
        "silent corrections"
    );
    client
        .batch_execute(include_str!(
            "fixtures/record_eligibility/insert_level_points.sql"
        ))
        .await?;
    let projection = db.reconcile_level_contribution_users(1, &[1, 2, 4]).await?;
    assert!(matches!(
        projection,
        zc_database::services::jobs::MaintenanceOutcome::Applied(_)
    ));
    db.recalculate_player_score(1).await?;
    assert_eq!(
        client
            .query_one(
                include_str!("fixtures/record_eligibility/select_total_points_user_points.sql"),
                &[]
            )
            .await?
            .get::<_, i32>(0),
        99,
        "inactive totals use eligible contributions"
    );
    assert_eq!(
        client
            .query_one(
                include_str!(
                    "fixtures/record_eligibility/select_id_record_user_point_contribution.sql"
                ),
                &[]
            )
            .await?
            .get::<_, i32>(0),
        2
    );
    assert_eq!(
        client
            .query_one(SELECT_RECORD, &[])
            .await?
            .get::<_, String>(0),
        original
    );
    let unchanged = client
        .query_one(SELECT_DATE_UPDATED_PERSONAL_BEST_GLOBAL, &[])
        .await?
        .get::<_, String>(0);
    db.reconcile_record_eligibility(1).await?;
    assert_eq!(
        client
            .query_one(SELECT_DATE_UPDATED_PERSONAL_BEST_GLOBAL, &[])
            .await?
            .get::<_, String>(0),
        unchanged
    );
    db.save_record_validation(1, None, &ValidationReport::uncertain("legacy"))
        .await?;
    db.reconcile_record_eligibility(1).await?;
    assert_eq!(
        client
            .query_one(SELECT_ID_RECORD_WORLD_RECORD_GLOBAL, &[])
            .await?
            .get::<_, i32>(0),
        3,
        "failed evidence never restores eligibility"
    );
    db.save_record_validation(7, None, &ValidationReport::failed("missing_ghost"))
        .await?;
    db.reconcile_record_eligibility(2).await?;
    assert_eq!(
        client
            .query_one(
                include_str!(
                    "fixtures/record_eligibility/count_personal_best_global_by_id_level_2.sql"
                ),
                &[]
            )
            .await?
            .get::<_, i64>(0),
        0
    );
    assert_eq!(
        client
            .query_one(COUNT_WORLD_RECORD_GLOBAL_BY_ID_LEVEL_2, &[])
            .await?
            .get::<_, i64>(0),
        0
    );
    client
        .batch_execute(include_str!(
            "fixtures/record_eligibility/delete_record_validation.sql"
        ))
        .await?;
    db.reconcile_record_eligibility(2).await?;
    db.reconcile_level_contribution_users(1, &[1, 2, 3, 4])
        .await?;
    for id in 1..=4 {
        db.recalculate_player_score(id).await?;
    }
    let ranks = db.player_rank_snapshot().await?;
    db.persist_player_rank_batch_with_notifications(&ranks, false)
        .await?;
    assert!(db.record_eligibility_level_current(1).await?);
    assert!(db.record_eligibility_scores_current().await?);
    assert_eq!(
        client
            .query_one(COUNT_WORLD_RECORD_GLOBAL_BY_ID_LEVEL_2, &[])
            .await?
            .get::<_, i64>(0),
        0,
        "failed evidence cannot be deleted to restore eligibility"
    );
    client
        .batch_execute(include_str!(
            "fixtures/record_eligibility/set_status_record_validation.sql"
        ))
        .await?;
    assert!(
        !client
            .query_one(
                include_str!("fixtures/record_eligibility/record_is_eligible.sql"),
                &[]
            )
            .await?
            .get::<_, bool>(0)
    );
    client
        .batch_execute(include_str!(
            "../migrations/20261018010000_validation_metadata_guards/down.sql"
        ))
        .await?;
    if persisted_eligibility {
        client
            .batch_execute(include_str!(
                "../migrations/20261013020000_persist_record_eligibility/down.sql"
            ))
            .await?;
    }
    client
        .batch_execute(include_str!(
            "../migrations/20261012010000_record_eligibility/down.sql"
        ))
        .await?;
    assert_eq!(
        client
            .query_one(
                include_str!("fixtures/record_eligibility/count_pg_policy.sql"),
                &[]
            )
            .await?
            .get::<_, i64>(0),
        0
    );
    client
        .batch_execute(include_str!(
            "../migrations/20261012010000_record_eligibility/up.sql"
        ))
        .await?;
    if persisted_eligibility {
        client
            .batch_execute(include_str!(
                "../migrations/20261013020000_persist_record_eligibility/up.sql"
            ))
            .await?;
    }
    client
        .batch_execute(include_str!(
            "../migrations/20261018010000_validation_metadata_guards/up.sql"
        ))
        .await?;
    client
        .batch_execute(include_str!("fixtures/record_eligibility/insert_level.sql"))
        .await?;
    db.save_checked_record_validations(
        &(1000..=1100).collect::<Vec<_>>(),
        None,
        &ValidationReport::failed("missing_ghost"),
        &zc_database::services::ghost_validation::ValidationCheckTimestamp {
            id_level: None,
            checked_at: "epoch".into(),
            checked_metadata_at: "epoch".into(),
        },
    )
    .await?;
    assert_eq!(db.failed_record_level_page(0, 110).await?.len(), 100);
    assert_eq!(db.failed_record_level_page(109, 110).await?, vec![110]);
    assert!(db.failed_record_level_page(109, 109).await?.is_empty());
    assert_eq!(
        db.failed_record_level_page(50, 55).await?,
        vec![51, 52, 53, 54, 55]
    );
    Ok(())
}

#[tokio::test]
#[ignore = "requires empty record_eligibility_benchmark_test with current schema and eligibility migrations"]
async fn production_sized_eligibility_queries() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1")
            && parsed.path() == "/record_eligibility_benchmark_test",
        "Isolated benchmark database required"
    );
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("benchmark connection") });
    if client
        .query_one(
            include_str!("fixtures/record_eligibility/count_record_2.sql"),
            &[],
        )
        .await?
        .get::<_, i64>(0)
        == 0
    {
        client
            .batch_execute(include_str!("fixtures/record_eligibility_benchmark.sql"))
            .await?;
    }
    let counts = client
        .query(
            include_str!("fixtures/record_eligibility/select_status_record_validation.sql"),
            &[],
        )
        .await?;
    assert_eq!(
        counts
            .iter()
            .map(|r| (r.get::<_, String>(0), r.get::<_, i64>(1)))
            .collect::<Vec<_>>(),
        vec![
            ("fail".into(), 626386),
            ("pass".into(), 2048),
            ("uncertain".into(), 3301323)
        ]
    );
    let mut plans = String::new();
    for sql in [
        include_str!("fixtures/record_eligibility/select_id_record.sql"),
        include_str!("fixtures/record_eligibility/select_id_level.sql"),
        include_str!("fixtures/record_eligibility/count_record_by_id_record.sql"),
    ] {
        plans.push_str(sql);
        plans.push('\n');
        for row in client
            .query(
                &include_str!("fixtures/record_eligibility/explain_sql.sql")
                    .replace("{{sql}}", sql),
                &[],
            )
            .await?
        {
            plans.push_str(&row.get::<_, String>(0));
            plans.push('\n');
        }
    }
    let db = Database::connect(&url, 2).await?;
    let started = std::time::Instant::now();
    assert!(matches!(
        db.reconcile_record_eligibility(20000).await?,
        zc_database::services::jobs::MaintenanceOutcome::Applied(())
    ));
    plans.push_str(&format!(
        "Level repair elapsed_ms={}\n",
        started.elapsed().as_millis()
    ));
    std::fs::write(
        "../../.local/ghost-validation/eligibility-benchmark-plans.txt",
        plans,
    )?;
    Ok(())
}
