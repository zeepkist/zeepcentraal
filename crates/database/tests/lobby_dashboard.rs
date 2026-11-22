use anyhow::{Context, Result, ensure};

const SET_LOCAL_ROLE_ZEEPCENTRAAL_GRAPHQL: &str =
    include_str!("fixtures/lobby_dashboard/set_local_role_zeepcentraal_graphql.sql");
const SELECT_LOBBY_OCCUPANCY_TIMELINE: &str =
    include_str!("fixtures/lobby_dashboard/select_lobby_occupancy_timeline.sql");
const RESET_ROLE: &str = include_str!("fixtures/lobby_dashboard/reset_role.sql");

#[tokio::test]
#[ignore = "requires disposable local zc_lobby_dashboard_test"]
async fn lobby_projection_timeline_permissions_plans_and_rollback() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/zc_lobby_dashboard_test",
        "Dedicated lobby test database required"
    );
    let (mut client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("Lobby test connection") });
    let tx = client.transaction().await?;
    let up = include_str!("../migrations/20261108040000_lobby_dashboard/up.sql");
    let down = include_str!("../migrations/20261108040000_lobby_dashboard/down.sql");
    tx.batch_execute(down).await?;
    tx.batch_execute(up).await?;
    tx.batch_execute(include_str!(
        "fixtures/lobby_dashboard/truncate_lobby_history.sql"
    ))
    .await?;
    tx.batch_execute(include_str!("fixtures/lobby_dashboard.sql"))
        .await?;
    tx.batch_execute(SET_LOCAL_ROLE_ZEEPCENTRAAL_GRAPHQL)
        .await?;
    assert!(
        !tx.query_one(
            include_str!("fixtures/lobby_dashboard/has_column_privilege.sql"),
            &[]
        )
        .await?
        .get::<_, bool>(0)
    );
    let row = tx
        .query_one(
            include_str!("fixtures/lobby_dashboard/select_occupancy_lobby_listing.sql"),
            &[],
        )
        .await?;
    assert_eq!(row.get::<_, f64>(0), 0.25);
    assert!(row.get::<_, bool>(1));
    assert_eq!(row.get::<_, f64>(2), 86400.0);
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/lobby_dashboard/count_lobby_listing.sql"),
            &[]
        )
        .await?
        .get::<_, i64>(0),
        1
    );
    let rows = tx.query(SELECT_LOBBY_OCCUPANCY_TIMELINE, &[]).await?;
    assert!(rows.len() <= 201);
    assert_eq!(
        rows.iter().map(|r| r.get::<_, i32>("max_players")).max(),
        Some(6)
    );
    assert_eq!(
        rows.iter().map(|r| r.get::<_, i32>("max_capacity")).max(),
        Some(12)
    );
    let gaps = tx
        .query(
            include_str!("fixtures/lobby_dashboard/select_has_gap_lobby_occupancy_timeline.sql"),
            &[],
        )
        .await?;
    assert!(gaps.iter().any(|r| r.get::<_, bool>(0)));
    assert!(gaps.iter().any(|r| r.get::<_, bool>(1)));
    assert!(gaps.iter().any(|r| r.get::<_, bool>(2)));
    tx.batch_execute(RESET_ROLE).await?;
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/lobby_dashboard/count_pg_trigger.sql"),
            &[]
        )
        .await?
        .get::<_, i64>(0),
        3
    );
    assert!(
        tx.query_one(
            include_str!("fixtures/lobby_dashboard/count_live_query_invalidations.sql"),
            &[]
        )
        .await?
        .get::<_, i64>(0)
            > 0
    );
    tx.batch_execute(down).await?;
    assert!(
        tx.query_one(
            include_str!("fixtures/lobby_dashboard/to_regclass.sql"),
            &[]
        )
        .await?
        .get::<_, Option<String>>(0)
        .is_none()
    );
    tx.batch_execute(up).await?;
    verify_growth_plans(&tx).await?;
    tx.rollback().await?;
    client
        .batch_execute(include_str!(
            "fixtures/lobby_dashboard/analyze_lobby_stats.sql"
        ))
        .await?;
    Ok(())
}

async fn verify_growth_plans(tx: &tokio_postgres::Transaction<'_>) -> Result<()> {
    tx.batch_execute(include_str!("fixtures/lobby_dashboard_growth.sql"))
        .await?;
    tx.batch_execute(SET_LOCAL_ROLE_ZEEPCENTRAAL_GRAPHQL)
        .await?;
    let queries = [
        (
            "monthly",
            include_str!("fixtures/lobby_dashboard/select_date_trunc_lobby_stats.sql"),
        ),
        (
            "peak",
            include_str!("fixtures/lobby_dashboard/select_players_lobby_stats.sql"),
        ),
        (
            "history",
            include_str!("fixtures/lobby_dashboard/select_lobby_listing.sql"),
        ),
        (
            "search",
            include_str!("fixtures/lobby_dashboard/select_lobby_listing_2.sql"),
        ),
        ("timeline", SELECT_LOBBY_OCCUPANCY_TIMELINE),
    ];
    for (name, query) in queries {
        let mut times = Vec::new();
        let mut buffers = serde_json::Value::Null;
        for _ in 0..20 {
            let messages = tx
                .simple_query(
                    &include_str!("fixtures/lobby_dashboard/explain_query.sql")
                        .replace("{{query}}", query),
                )
                .await?;
            let json = messages
                .iter()
                .find_map(|message| match message {
                    tokio_postgres::SimpleQueryMessage::Row(row) => row.get(0),
                    _ => None,
                })
                .context("Missing JSON query plan")?;
            let plan: serde_json::Value = serde_json::from_str(json)?;
            times.push(
                plan[0]["Execution Time"]
                    .as_f64()
                    .context("Missing execution time")?,
            );
            buffers = serde_json::json!({"sharedHitBlocks":plan[0]["Plan"]["Shared Hit Blocks"],"sharedReadBlocks":plan[0]["Plan"]["Shared Read Blocks"]});
        }
        let first_run_ms = times.remove(0);
        times.sort_by(f64::total_cmp);
        let p95_ms = times
            .get(18)
            .copied()
            .context("Missing benchmark samples")?;
        println!(
            "{}",
            serde_json::json!({"query":name,"firstRunMs":first_run_ms,"p95Ms":p95_ms,"buffers":buffers})
        );
        ensure!(
            p95_ms < 500.0,
            "{name} exceeds 500 ms SQL budget: {p95_ms} ms"
        );
    }
    tx.batch_execute(RESET_ROLE).await?;
    Ok(())
}
