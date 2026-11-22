use anyhow::{Result, ensure};

const SELECT_TOTAL_LEVELS_ADVENTURE_LEADERBOARD_SCOPE_BY_SERIES_A: &str = include_str!(
    "fixtures/adventure_leaderboards/select_total_levels_adventure_leaderboard_scope_by_series_a.sql"
);

const UP: &str = include_str!("../migrations/20261108020000_adventure_leaderboards/up.sql");
const DOWN: &str = include_str!("../migrations/20261108020000_adventure_leaderboards/down.sql");
const FIXTURE: &str = include_str!("fixtures/adventure_leaderboards.sql");

#[tokio::test]
#[ignore = "requires disposable local adventure_leaderboard_test database"]
async fn adventure_ranking_membership_permissions_changes_and_rollback() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/adventure_leaderboard_test",
        "Dedicated local Adventure database required"
    );
    let (mut client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("Adventure test connection") });
    let tx = client.transaction().await?;
    tx.batch_execute(FIXTURE).await?;
    tx.batch_execute(UP).await?;
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/adventure_leaderboards/count_adventure_leaderboard_scope.sql"),
            &[]
        )
        .await?
        .get::<_, i32>(0),
        18
    );
    tx.batch_execute(include_str!(
        "fixtures/adventure_leaderboards/set_local_role_zeepcentraal_graphql.sql"
    ))
    .await?;
    let rows = tx
        .query(
            include_str!(
                "fixtures/adventure_leaderboards/select_id_user_adventure_leaderboard_entry.sql"
            ),
            &[],
        )
        .await?;
    assert_eq!(rows.len(), 65);
    assert_eq!(rows[0].get::<_, i32>(1), 1);
    assert_eq!(rows[1].get::<_, i32>(1), 1);
    assert_eq!(rows[2].get::<_, i32>(1), 3);
    assert_eq!(rows[3].get::<_, i32>(1), 3);
    assert_eq!(rows[4].get::<_, i32>(1), 5);
    assert_eq!(rows[0].get::<_, i64>(3), 120000);
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/adventure_leaderboards/select_total_levels_adventure_leaderboard_scope.sql"),
            &[]
        )
        .await?
        .get::<_, i32>(0),
        18
    );
    assert_eq!(tx.query_one(include_str!("fixtures/adventure_leaderboards/count_adventure_leaderboard_scope_missing_levels.sql"), &[]).await?.get::<_,i32>(0),2);
    assert_eq!(tx.query_one(include_str!("fixtures/adventure_leaderboards/select_rank_adventure_leaderboard_scope_player_entry.sql"), &[]).await?.get::<_,i32>(0),6);
    // Different completed sets cannot produce a time gap.
    assert!(
        tx.query_one(
            include_str!("fixtures/adventure_leaderboards/adventure_leaderboard_entry_gap_ms.sql"),
            &[]
        )
        .await?
        .get::<_, Option<i64>>(0)
        .is_some()
    );
    assert!(
        tx.query_one(
            include_str!(
                "fixtures/adventure_leaderboards/adventure_leaderboard_entry_gap_ms_by_series_a.sql"
            ),
            &[]
        )
        .await?
        .get::<_, Option<i64>>(0)
        .is_none()
    );
    tx.batch_execute(include_str!(
        "fixtures/adventure_leaderboards/set_record_eligible_record.sql"
    ))
    .await?;
    assert_eq!(tx.query_one(include_str!("fixtures/adventure_leaderboards/select_completed_levels_adventure_leaderboard_entry.sql"), &[]).await?.get::<_,i32>(0),1);
    tx.batch_execute(include_str!(
        "fixtures/adventure_leaderboards/insert_record.sql"
    ))
    .await?;
    assert_eq!(tx.query_one(include_str!("fixtures/adventure_leaderboards/select_total_time_ms_adventure_leaderboard_entry.sql"), &[]).await?.get::<_,i64>(0),130000);
    tx.batch_execute(include_str!(
        "fixtures/adventure_leaderboards/set_banned_user.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(
            SELECT_TOTAL_LEVELS_ADVENTURE_LEADERBOARD_SCOPE_BY_SERIES_A,
            &[]
        )
        .await?
        .get::<_, i32>(0),
        1
    );
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/adventure_leaderboards/count_adventure_leaderboard_entry.sql"),
            &[]
        )
        .await?
        .get::<_, i32>(0),
        0
    );
    tx.batch_execute(include_str!(
        "fixtures/adventure_leaderboards/set_publicly_visible_level.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(
            SELECT_TOTAL_LEVELS_ADVENTURE_LEADERBOARD_SCOPE_BY_SERIES_A,
            &[]
        )
        .await?
        .get::<_, i32>(0),
        0
    );
    tx.batch_execute(DOWN).await?;
    tx.batch_execute(UP).await?;
    // Representative PB volume plus unrelated history. Aggregation must use
    // PB references, not enumerate the decoy history on every request.
    tx.batch_execute(include_str!(
        "fixtures/adventure_leaderboards/set_publicly_visible_level_by_after_id.sql"
    ))
    .await?;
    for scope in ["", "a", "xg"] {
        let plan = tx
            .query(
                include_str!(
                    "fixtures/adventure_leaderboards/explain_adventure_leaderboard_entry.sql"
                ),
                &[&scope],
            )
            .await?;
        let lines: Vec<String> = plan.iter().map(|row| row.get(0)).collect();
        ensure!(
            !lines
                .iter()
                .any(|line| line.contains("Seq Scan on record ")),
            "Leaderboard scans full history: {}",
            lines.join("\n")
        );
        println!("Adventure scope {scope:?}: {}", lines.last().unwrap());
        let count = tx
            .query_one(
                include_str!("fixtures/adventure_leaderboards/count_adventure_leaderboard_entry_by_series.sql"),
                &[&scope],
            )
            .await?
            .get::<_, i32>(0);
        ensure!(count >= 2000, "Benchmark participants missing");
        assert_eq!(tx.query_one(include_str!("fixtures/adventure_leaderboards/select_completed_levels_adventure_leaderboard_scope_player_entry.sql"), &[&scope]).await?.get::<_,i32>(0),if scope.is_empty(){18}else if scope=="a"{2}else{1});
    }
    tx.rollback().await?;
    Ok(())
}
