use anyhow::{Context, Result, ensure};
use std::{future::Future, time::Instant};
use tokio_postgres::{Client, NoTls};

const SET_LEASE_UNTIL_JOB: &str = include_str!("fixtures/queue_claim/set_lease_until_job.sql");
const SELECT_PROACL_PG_PROC: &str = include_str!("fixtures/queue_claim/select_proacl_pg_proc.sql");

const UP: &str = include_str!("../migrations/20261018000000_optimize_job_claims/up.sql");
const DOWN: &str = include_str!("../migrations/20261018000000_optimize_job_claims/down.sql");

async fn connect() -> Result<Client> {
    let url = std::env::var("ZC_TEST_DATABASE_URL").context("ZC_TEST_DATABASE_URL required")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/queue_claim_test",
        "Dedicated local queue_claim_test database required"
    );
    let (client, connection) = tokio_postgres::connect(&url, NoTls).await?;
    tokio::spawn(async move { connection.await.expect("queue test connection") });
    client
        .batch_execute(include_str!(
            "fixtures/queue_claim/set_statement_timeout_60s.sql"
        ))
        .await?;
    Ok(client)
}

async fn reset(client: &Client) -> Result<()> {
    client
        .batch_execute(include_str!("fixtures/queue_claim/truncate_job.sql"))
        .await?;
    Ok(())
}

async fn enqueue(
    client: &Client,
    lane: &str,
    key: Option<&str>,
    group: Option<&str>,
) -> Result<i64> {
    // Set keys after enqueue to also exercise duplicate keys across different groups.
    let id = client
        .query_one(
            include_str!("fixtures/queue_claim/enqueue.sql"),
            &[&lane, &group],
        )
        .await?
        .get(0);
    client
        .execute(
            include_str!("fixtures/queue_claim/set_job_key_job.sql"),
            &[&lane, &id, &key],
        )
        .await?;
    Ok(id)
}

async fn claim(client: &Client, lane: &str, count: i32) -> Result<Vec<(i64, i64)>> {
    Ok(client
        .query(
            include_str!("fixtures/queue_claim/select_id_claim.sql"),
            &[&lane, &count],
        )
        .await?
        .into_iter()
        .map(|row| (row.get(0), row.get(1)))
        .collect())
}

async fn finish(client: &Client, lane: &str, id: i64, generation: i64) -> Result<bool> {
    Ok(client
        .query_one(
            include_str!("fixtures/queue_claim/finish.sql"),
            &[&lane, &id, &generation],
        )
        .await?
        .get(0))
}

async fn heartbeat(client: &Client, id: i64, generation: i64) -> Result<bool> {
    Ok(client
        .query_one(
            include_str!("fixtures/queue_claim/heartbeat.sql"),
            &[&id, &generation],
        )
        .await?
        .get(0))
}

async fn timed<T>(name: &str, operation: impl Future<Output = Result<T>>) -> Result<T> {
    let start = Instant::now();
    let result = operation.await;
    println!("{name}={:.3}ms", start.elapsed().as_secs_f64() * 1000.0);
    result
}

async fn semantics(client: &Client, lane: &str) -> Result<()> {
    reset(client).await?;
    assert!(
        client
            .query(
                include_str!("fixtures/queue_claim/select_claim.sql"),
                &[&lane]
            )
            .await
            .is_err()
    );
    assert!(
        client
            .query(
                include_str!("fixtures/queue_claim/select_claim_2.sql"),
                &[&lane]
            )
            .await
            .is_err()
    );
    let first = enqueue(client, lane, Some("one"), Some("group")).await?;
    let second = enqueue(client, lane, Some("two"), Some("group")).await?;
    let shared = enqueue(client, lane, Some("one"), Some("different")).await?;
    let free = enqueue(client, lane, None, None).await?;
    let other_free = enqueue(client, lane, None, None).await?;
    assert_eq!(claim(client, lane, 3).await?, vec![(first, 1), (free, 1)]);
    assert_eq!(claim(client, lane, 3).await?, vec![(other_free, 1)]);
    assert!(finish(client, lane, first, 1).await?);
    assert_eq!(claim(client, lane, 1).await?, vec![(second, 1)]);
    assert_eq!(claim(client, lane, 10).await?, vec![(shared, 1)]);

    reset(client).await?;
    let keyed = enqueue(client, lane, Some("key-only"), None).await?;
    let duplicate = enqueue(client, lane, Some("key-only"), None).await?;
    assert_eq!(claim(client, lane, 10).await?, vec![(keyed, 1)]);
    assert!(claim(client, lane, 10).await?.is_empty());
    assert!(finish(client, lane, keyed, 1).await?);
    assert_eq!(claim(client, lane, 10).await?, vec![(duplicate, 1)]);

    reset(client).await?;
    let delayed = enqueue(client, lane, None, Some("delayed")).await?;
    client
        .query_one(
            include_str!("fixtures/queue_claim/set_vt.sql"),
            &[&lane, &delayed],
        )
        .await?;
    let ready = enqueue(client, lane, None, Some("delayed")).await?;
    assert_eq!(claim(client, lane, 1).await?, vec![(ready, 1)]);
    assert!(claim(client, lane, 10).await?.is_empty());

    reset(client).await?;
    let other_lane = if lane == "fast" { "bulk" } else { "fast" };
    enqueue(client, other_lane, Some("shared"), Some("shared")).await?;
    assert_eq!(claim(client, other_lane, 1).await?.len(), 1);
    let independent = enqueue(client, lane, Some("shared"), Some("shared")).await?;
    assert_eq!(claim(client, lane, 1).await?, vec![(independent, 1)]);

    // Live blocker precedes a large blocked prefix. Independent work still claims.
    reset(client).await?;
    let blocker = enqueue(client, lane, Some("blocker"), Some("busy")).await?;
    assert_eq!(claim(client, lane, 1).await?, vec![(blocker, 1)]);
    for _ in 0..80 {
        enqueue(client, lane, None, Some("busy")).await?;
    }
    let ready = enqueue(client, lane, None, Some("ready")).await?;
    assert_eq!(claim(client, lane, 1).await?, vec![(ready, 1)]);
    assert!(claim(client, lane, 10).await?.is_empty());

    // pgmq visibility and lease expiry are independent; exclude only OTHER live jobs.
    reset(client).await?;
    let retry = enqueue(client, lane, Some("retry"), Some("retry")).await?;
    assert_eq!(claim(client, lane, 1).await?, vec![(retry, 1)]);
    client
        .batch_execute(
            &include_str!("fixtures/queue_claim/set_vt_q_zeepcentraal.sql")
                .replace("{{lane}}", lane),
        )
        .await?;
    assert_eq!(claim(client, lane, 1).await?, vec![(retry, 2)]);
    assert!(!finish(client, lane, retry, 1).await?);
    assert!(
        !client
            .query_one(
                include_str!("fixtures/queue_claim/heartbeat_2.sql"),
                &[&lane, &retry]
            )
            .await?
            .get::<_, bool>(0)
    );
    client
        .batch_execute(&SET_LEASE_UNTIL_JOB.replace("{{lane}}", lane))
        .await?;
    assert_eq!(claim(client, lane, 1).await?, vec![(retry, 3)]);
    client
        .batch_execute(&SET_LEASE_UNTIL_JOB.replace("{{lane}}", lane))
        .await?;
    assert!(claim(client, lane, 1).await?.is_empty());
    assert_eq!(
        client
            .query_one(
                &include_str!("fixtures/queue_claim/select_message_a_zeepcentraal.sql")
                    .replace("{{lane}}", lane),
                &[&retry]
            )
            .await?
            .get::<_, String>(0),
        "attempts_exhausted"
    );
    Ok(())
}

fn selection(migration: &str) -> String {
    migration
        .split("$query$")
        .nth(1)
        .unwrap()
        .replace("%I", "q_zeepcentraal_bulk")
}

#[tokio::test]
#[ignore = "requires disposable local queue_claim_test PostgreSQL with pgmq 1.12.0 installed"]
async fn claim_migration_preserves_semantics_and_removes_backlog_probes() -> Result<()> {
    let client = connect().await?;
    if !client
        .query_one(include_str!("fixtures/queue_claim/exists.sql"), &[])
        .await?
        .get::<_, bool>(0)
    {
        client
            .batch_execute(include_str!(
                "../../../packages/database/drizzle/0083_pgmq_queue.sql"
            ))
            .await?;
    }
    for migration in [DOWN, UP] {
        client.batch_execute(migration).await?;
        for lane in ["fast", "bulk"] {
            semantics(&client, lane).await?;
        }
    }

    // Replacing either function never changes pending jobs, running jobs, or pgmq state.
    reset(&client).await?;
    enqueue(&client, "bulk", Some("running"), None).await?;
    claim(&client, "bulk", 1).await?;
    enqueue(&client, "bulk", Some("pending"), None).await?;
    let snapshot = include_str!("fixtures/queue_claim/select_job.sql");
    let before: String = client.query_one(snapshot, &[]).await?.get(0);
    let permissions: Option<String> = client.query_one(SELECT_PROACL_PG_PROC, &[]).await?.get(0);
    for migration in [DOWN, UP] {
        client.batch_execute(migration).await?;
        assert_eq!(
            client.query_one(snapshot, &[]).await?.get::<_, String>(0),
            before
        );
        assert_eq!(
            client
                .query_one(SELECT_PROACL_PG_PROC, &[])
                .await?
                .get::<_, Option<String>>(0),
            permissions
        );
    }

    // Distinct claimers serialize ownership, while acknowledgement and heartbeat remain valid.
    reset(&client).await?;
    for _ in 0..40 {
        enqueue(&client, "bulk", None, None).await?;
    }
    let peer = connect().await?;
    let (left, right) = tokio::try_join!(claim(&client, "bulk", 15), claim(&peer, "bulk", 15))?;
    assert_eq!(left.len() + right.len(), 30);
    assert!(left.iter().all(|job| !right.contains(job)));
    let (id, generation) = left[0];
    let (finished, renewed, remaining) = tokio::try_join!(
        finish(&client, "bulk", id, generation),
        heartbeat(&peer, right[0].0, right[0].1),
        async {
            let third = connect().await?;
            claim(&third, "bulk", 15).await
        }
    )?;
    assert!(finished && renewed);
    assert_eq!(remaining.len(), 10);

    reset(&client).await?;
    client
        .batch_execute(include_str!("fixtures/queue_claim/insert_job.sql"))
        .await?;
    let baseline = selection(DOWN);
    let optimized = selection(UP);
    let mut times = [Vec::new(), Vec::new()];
    let mut expected = Vec::new();
    for run in 0..6 {
        for index in if run % 2 == 0 { [0, 1] } else { [1, 0] } {
            let sql = if index == 0 { &baseline } else { &optimized };
            let start = Instant::now();
            let rows = client.query(sql, &[&"bulk", &15_i64]).await?;
            let ids = rows
                .iter()
                .map(|row| row.get::<_, i64>("id"))
                .collect::<Vec<_>>();
            if expected.is_empty() {
                expected = ids.clone();
            }
            assert_eq!(ids, expected);
            if run > 0 {
                times[index].push(start.elapsed().as_secs_f64() * 1000.0);
            }
        }
    }
    for samples in &mut times {
        samples.sort_by(f64::total_cmp);
    }
    let reduction = 1.0 - times[1][2] / times[0][2];
    println!(
        "claim selection median baseline={:.3}ms optimized={:.3}ms reduction={:.1}%",
        times[0][2],
        times[1][2],
        reduction * 100.0
    );
    ensure!(
        reduction >= 0.8,
        "claim selection must improve by at least 80%"
    );
    let plan = client
        .query(
            &include_str!("fixtures/queue_claim/explain_optimized.sql")
                .replace("{{optimized}}", &optimized),
            &[&"bulk", &15_i64],
        )
        .await?
        .into_iter()
        .map(|row| row.get::<_, String>(0))
        .collect::<Vec<_>>()
        .join("\n");
    println!("{plan}");
    ensure!(
        !plan.contains("SubPlan"),
        "blocker selection must use set-based joins"
    );

    // Exercise actual mutations at backlog size, not only SELECT performance.
    let start = Instant::now();
    let jobs = claim(&client, "bulk", 15).await?;
    println!(
        "backlog claim={:.3}ms",
        start.elapsed().as_secs_f64() * 1000.0
    );
    let third = connect().await?;
    let (completed, renewed, additional) = tokio::try_join!(
        timed(
            "backlog finish",
            finish(&client, "bulk", jobs[0].0, jobs[0].1)
        ),
        timed("backlog heartbeat", heartbeat(&peer, jobs[1].0, jobs[1].1)),
        timed("concurrent backlog claim", claim(&third, "bulk", 15))
    )?;
    assert!(completed && renewed);
    assert!(!additional.is_empty());
    reset(&client).await?;
    Ok(())
}
