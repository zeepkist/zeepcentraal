use anyhow::{Context, Result, ensure};

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
    tx.batch_execute("TRUNCATE public.lobby_history,public.lobby_stats,public.lobby CASCADE")
        .await?;
    tx.batch_execute(include_str!("fixtures/lobby_dashboard.sql"))
        .await?;
    tx.batch_execute("SET LOCAL ROLE zeepcentraal_graphql")
        .await?;
    assert!(
        !tx.query_one(
            "SELECT has_column_privilege(current_user,'public.lobby','master_id','SELECT')",
            &[]
        )
        .await?
        .get::<_, bool>(0)
    );
    let row = tx.query_one("SELECT occupancy,available_capacity,duration_seconds FROM public.lobby_listing WHERE id=1001", &[]).await?;
    assert_eq!(row.get::<_, f64>(0), 0.25);
    assert!(row.get::<_, bool>(1));
    assert_eq!(row.get::<_, f64>(2), 86400.0);
    assert_eq!(tx.query_one("SELECT count(*) FROM public.lobby_listing WHERE NOT is_public AND first_seen<'2001-01-03Z' AND coalesce(closed_at,last_seen)>='2001-01-02Z'", &[]).await?.get::<_,i64>(0),1);
    let rows = tx
        .query(
            "SELECT * FROM public.lobby_occupancy_timeline(1001,200)",
            &[],
        )
        .await?;
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
            "SELECT has_gap,has_closure,has_reopening FROM public.lobby_occupancy_timeline(1003,1)",
            &[],
        )
        .await?;
    assert!(gaps.iter().any(|r| r.get::<_, bool>(0)));
    assert!(gaps.iter().any(|r| r.get::<_, bool>(1)));
    assert!(gaps.iter().any(|r| r.get::<_, bool>(2)));
    tx.batch_execute("RESET ROLE").await?;
    assert_eq!(tx.query_one("SELECT count(*) FROM pg_trigger WHERE tgname='trg__live_query_invalidate' AND tgrelid IN ('public.lobby'::regclass,'public.lobby_history'::regclass,'public.lobby_stats'::regclass)",&[]).await?.get::<_,i64>(0),3);
    assert!(tx.query_one("SELECT count(*) FROM public.live_query_invalidations WHERE table_name IN ('lobby','lobby_history','lobby_stats')",&[]).await?.get::<_,i64>(0)>0);
    tx.batch_execute(down).await?;
    assert!(
        tx.query_one("SELECT to_regclass('public.lobby_listing')::text", &[])
            .await?
            .get::<_, Option<String>>(0)
            .is_none()
    );
    tx.batch_execute(up).await?;
    verify_growth_plans(&tx).await?;
    tx.rollback().await?;
    client
        .batch_execute(
            "ANALYZE public.lobby_stats; ANALYZE public.lobby; ANALYZE public.lobby_history",
        )
        .await?;
    Ok(())
}

async fn verify_growth_plans(tx: &tokio_postgres::Transaction<'_>) -> Result<()> {
    tx.batch_execute(include_str!("fixtures/lobby_dashboard_growth.sql"))
        .await?;
    tx.batch_execute("SET LOCAL ROLE zeepcentraal_graphql")
        .await?;
    let queries = [
        (
            "monthly",
            "SELECT date_trunc('month',date_created,'UTC'),avg(players),avg(players_in_rooms),avg(rooms),sum(players),sum(players_in_rooms),sum(rooms),max(players),max(players_in_rooms),max(rooms),count(DISTINCT id) FROM public.lobby_stats GROUP BY 1",
        ),
        (
            "peak",
            "SELECT players,date_created FROM public.lobby_stats ORDER BY players DESC,date_created,id LIMIT 1",
        ),
        (
            "history",
            "SELECT * FROM public.lobby_listing WHERE closed_at IS NOT NULL AND first_seen<'2020-04-01Z' AND coalesce(closed_at,last_seen)>='2020-03-01Z' ORDER BY closed_at DESC,id DESC LIMIT 25",
        ),
        (
            "search",
            "SELECT * FROM public.lobby_listing WHERE room_name ILIKE '%room 99%' ORDER BY duration_seconds DESC,id DESC LIMIT 25",
        ),
        (
            "timeline",
            "SELECT * FROM public.lobby_occupancy_timeline(1001,200)",
        ),
    ];
    for (name, query) in queries {
        let mut times = Vec::new();
        let mut buffers = serde_json::Value::Null;
        for _ in 0..20 {
            let messages = tx
                .simple_query(&format!("EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) {query}"))
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
    tx.batch_execute("RESET ROLE").await?;
    Ok(())
}
