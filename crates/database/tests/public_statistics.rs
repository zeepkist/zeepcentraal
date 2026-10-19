use anyhow::{Result, ensure};
use serde_json::Value;
use tokio_postgres::{Client, NoTls};

const UP: &str = include_str!("../migrations/20261019000900_public_statistics/up.sql");
const DOWN: &str = include_str!("../migrations/20261019000900_public_statistics/down.sql");
const SINGLE_UP: &str = include_str!("../migrations/20261019001000_single_player_statistic/up.sql");
const SINGLE_DOWN: &str =
    include_str!("../migrations/20261019001000_single_player_statistic/down.sql");
static TEST_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

async fn connect() -> Result<Client> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/zc_optimization_test",
        "Dedicated loopback zc_optimization_test database required"
    );
    let (client, connection) = tokio_postgres::connect(&url, NoTls).await?;
    tokio::spawn(async move { connection.await.expect("statistics fixture connection") });
    Ok(client)
}

#[tokio::test]
#[ignore = "requires dedicated loopback zc_optimization_test with current migrations"]
async fn statistics_migration_seeds_exact_counts_preserves_identity_and_reverses() -> Result<()> {
    let _guard = TEST_LOCK.lock().await;
    let mut client = connect().await?;
    let tx = client.transaction().await?;
    // Exercise migration 009 against its original result shape.
    tx.batch_execute(SINGLE_DOWN).await?;
    let identity: i64 = tx
        .query_one("SELECT 'public.statistics'::regclass::oid::bigint", &[])
        .await?
        .get(0);
    tx.batch_execute(DOWN).await?;
    tx.batch_execute("TRUNCATE zc_private.global_metrics_snapshot")
        .await?;
    tx.batch_execute(UP).await?;
    let row = tx
        .query_one(
            "SELECT 'public.statistics'::regclass::oid::bigint,
             to_regclass('zc_private.global_metrics_snapshot') IS NULL,
             (SELECT count(*) FROM public.statistics),
             (to_jsonb(s)-'singleton'-'semantics_version')=
                 to_jsonb(zc_private.compute_global_metrics(s.as_of))
             FROM public.statistics s",
            &[],
        )
        .await?;
    assert_eq!(row.get::<_, i64>(0), identity);
    assert!(row.get::<_, bool>(1));
    assert_eq!(row.get::<_, i64>(2), 1);
    assert!(
        row.get::<_, bool>(3),
        "All 20 counts and metadata must match"
    );
    tx.batch_execute("SET LOCAL ROLE zeepcentraal_graphql")
        .await?;
    assert_eq!(
        tx.query_one("SELECT count(*) FROM public.statistics", &[])
            .await?
            .get::<_, i64>(0),
        1
    );
    for privilege in ["INSERT", "UPDATE", "DELETE"] {
        assert!(
            !tx.query_one(
                "SELECT has_table_privilege(current_user,'public.statistics',$1)",
                &[&privilege],
            )
            .await?
            .get::<_, bool>(0)
        );
    }
    assert!(
        !tx.query_one(
            "SELECT has_function_privilege(current_user,'zc_private.refresh_global_metrics()','EXECUTE')",
            &[],
        )
        .await?
        .get::<_, bool>(0)
    );
    tx.batch_execute("RESET ROLE").await?;
    tx.batch_execute(DOWN).await?;
    let row = tx
        .query_one(
            "SELECT count(*),
             has_table_privilege('zeepcentraal_graphql','zc_private.global_metrics_snapshot','SELECT')
             FROM zc_private.global_metrics_snapshot",
            &[],
        )
        .await?;
    assert_eq!(row.get::<_, i64>(0), 1);
    assert!(!row.get::<_, bool>(1));
    tx.rollback().await?;
    Ok(())
}

#[tokio::test]
#[ignore = "requires dedicated loopback zc_optimization_test with current migrations"]
async fn single_player_count_migration_removes_duplicate_and_restores_original_shape() -> Result<()>
{
    let _guard = TEST_LOCK.lock().await;
    let mut client = connect().await?;
    let tx = client.transaction().await?;
    let identity = tx
        .query_one("SELECT 'public.statistics'::regclass::oid::bigint, 'public.global_metric_summary'::regtype::oid::bigint", &[])
        .await?;
    tx.batch_execute(SINGLE_DOWN).await?;
    tx.batch_execute(
        "TRUNCATE public.\"user\" RESTART IDENTITY CASCADE;
         INSERT INTO public.\"user\"(id,steam_id,banned) OVERRIDING SYSTEM VALUE
         VALUES(1,101,false),(2,102,true),(3,103,false),(4,104,false)",
    )
    .await?;
    tx.batch_execute("SELECT zc_private.refresh_global_metrics()")
        .await?;
    let snapshot: String = tx
        .query_one(
            "SELECT (to_jsonb(s)-'players_all'-'semantics_version')::text FROM public.statistics s",
            &[],
        )
        .await?
        .get(0);
    tx.batch_execute(SINGLE_UP).await?;
    let retained: String = tx
        .query_one(
            "SELECT (to_jsonb(s)-'semantics_version')::text FROM public.statistics s",
            &[],
        )
        .await?
        .get(0);
    assert_eq!(
        retained, snapshot,
        "Keep exact values and freshness timestamp"
    );
    let row = tx
        .query_one(
            "SELECT players,semantics_version,
             (to_jsonb(s)-'singleton'-'semantics_version')=to_jsonb(zc_private.compute_global_metrics(s.as_of)),
             to_jsonb(s) ? 'players_all',
             to_jsonb(zc_private.compute_global_metrics(s.as_of)) ? 'players_all',
             'public.statistics'::regclass::oid::bigint,
             'public.global_metric_summary'::regtype::oid::bigint
             FROM public.statistics s",
            &[],
        )
        .await?;
    assert_eq!(row.get::<_, i64>(0), 3);
    assert_eq!(row.get::<_, i32>(1), 2);
    assert!(row.get::<_, bool>(2));
    assert!(!row.get::<_, bool>(3));
    assert!(!row.get::<_, bool>(4));
    assert_eq!(row.get::<_, i64>(5), identity.get::<_, i64>(0));
    assert_eq!(row.get::<_, i64>(6), identity.get::<_, i64>(1));
    tx.batch_execute("SET LOCAL ROLE zeepcentraal_graphql")
        .await?;
    assert_eq!(
        tx.query_one("SELECT players FROM public.global_metrics()", &[])
            .await?
            .get::<_, i64>(0),
        3
    );
    tx.batch_execute("RESET ROLE").await?;
    tx.batch_execute(SINGLE_DOWN).await?;
    let row = tx
        .query_one(
            "SELECT players,players_all,semantics_version FROM public.statistics",
            &[],
        )
        .await?;
    assert_eq!(row.get::<_, i64>(0), 3);
    assert_eq!(row.get::<_, i64>(1), 4);
    assert_eq!(row.get::<_, i32>(2), 1);
    // Full result order also stays compatible with callers using SELECT *.
    let columns = tx.query("SELECT attname FROM pg_attribute WHERE attrelid='public.global_metric_summary'::regclass AND attnum>0 AND NOT attisdropped ORDER BY attnum", &[]).await?;
    assert_eq!(columns[15].get::<_, String>(0), "players");
    assert_eq!(columns[16].get::<_, String>(0), "players_all");
    assert_eq!(columns.last().unwrap().get::<_, String>(0), "time_zone");
    tx.batch_execute("TRUNCATE public.statistics").await?;
    tx.batch_execute(SINGLE_UP).await?;
    assert_eq!(
        tx.query_one("SELECT players FROM public.statistics", &[])
            .await?
            .get::<_, i64>(0),
        3
    );
    tx.rollback().await?;
    Ok(())
}

fn assert_bounded_world_record_join(plan: &Value) {
    assert!(
        !(plan["Node Type"] == "Nested Loop"
            && plan["Join Filter"]
                .as_str()
                .is_some_and(|filter| filter.contains("wr.id_level"))),
        "World-record availability regressed to broad nested-loop join"
    );
    if let Some(children) = plan["Plans"].as_array() {
        for child in children {
            assert_bounded_world_record_join(child);
        }
    }
}

#[tokio::test]
#[ignore = "requires dedicated loopback zc_optimization_test; loads 200,000 synthetic records"]
async fn refresh_uses_bounded_world_record_joins_for_custom_and_generic_plans() -> Result<()> {
    let _guard = TEST_LOCK.lock().await;
    let mut client = connect().await?;
    let tx = client.transaction().await?;
    tx.batch_execute(include_str!("fixtures/statistics_plans.sql"))
        .await?;
    let source: String = tx
        .query_one(
            "SELECT prosrc FROM pg_proc
             WHERE oid='zc_private.compute_global_metrics(timestamptz)'::regprocedure",
            &[],
        )
        .await?
        .get(0);
    tx.batch_execute(&format!(
        "PREPARE statistics_plan(timestamptz) AS {}",
        source.replace("p_as_of", "$1")
    ))
    .await?;
    for mode in ["force_custom_plan", "force_generic_plan"] {
        tx.batch_execute(&format!("SET LOCAL plan_cache_mode={mode}"))
            .await?;
        let rows = tx
            .simple_query(
                "EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON)
                 EXECUTE statistics_plan('2026-10-19Z')",
            )
            .await?;
        let json = rows.iter().find_map(|message| match message {
            tokio_postgres::SimpleQueryMessage::Row(row) => row.get(0),
            _ => None,
        });
        let measured: Value = serde_json::from_str(json.expect("JSON query plan"))?;
        assert_bounded_world_record_join(&measured[0]["Plan"]);
        println!(
            "{mode}: {} ms on 200,000 records / 50,000 WRs",
            measured[0]["Execution Time"]
        );
    }
    tx.batch_execute("DEALLOCATE statistics_plan").await?;
    let row = tx
        .query_one(
            "SELECT records,personal_bests,world_records
             FROM zc_private.compute_global_metrics('2026-10-19Z')",
            &[],
        )
        .await?;
    assert_eq!(row.get::<_, i64>(0), 200_000);
    assert_eq!(row.get::<_, i64>(1), 50_000);
    assert_eq!(row.get::<_, i64>(2), 50_000);
    tx.rollback().await?;
    Ok(())
}
