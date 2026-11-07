use anyhow::{Result, ensure};
use diesel::{
    QueryableByName, sql_query,
    sql_types::{BigInt, Jsonb},
};
use diesel_async::RunQueryDsl;
use serde_json::Value;
use zc_database::Database;
use zc_jobs::queue::{JobLane, Queue};

#[derive(QueryableByName)]
struct Payload {
    #[diesel(sql_type=Jsonb)]
    payload: Value,
}
#[derive(QueryableByName)]
struct Count {
    #[diesel(sql_type=BigInt)]
    count: i64,
}

#[tokio::test]
#[ignore = "requires empty current queue in local workshop_audit_queue_test with pgmq 1.12.0"]
async fn audit_batches_deduplicate_across_pages_and_preserve_running_work() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/workshop_audit_queue_test",
        "Dedicated isolated database required"
    );
    let database = Database::connect(&url, 2).await?;
    let partition = database.pool_partition();
    let queue = Queue::connect(partition.clone()).await?;
    let mut connection = partition.connection().await?;
    ensure!(
        sql_query("SELECT count(*)::bigint AS count FROM zc_jobs.job")
            .get_result::<Count>(&mut connection)
            .await?
            .count
            == 0,
        "Empty queue required"
    );
    drop(connection);
    let levels: Vec<_> = (1..=2001).chain(1..=2001).collect();
    queue.enqueue_ghost_audit_levels(&levels).await?;
    let mut connection = partition.connection().await?;
    let batches =
        sql_query("SELECT payload FROM zc_jobs.job WHERE task='auditRecordGhosts' ORDER BY id")
            .load::<Payload>(&mut connection)
            .await?;
    assert_eq!(batches.len(), 3);
    assert_eq!(
        batches
            .iter()
            .map(|batch| batch.payload["idLevels"].as_array().unwrap().len())
            .collect::<Vec<_>>(),
        vec![1000, 1000, 1]
    );
    let levels: Vec<_> = batches
        .iter()
        .flat_map(|batch| batch.payload["idLevels"].as_array().unwrap())
        .map(|id| id.as_i64().unwrap())
        .collect();
    assert_eq!(levels, (1..=2001).collect::<Vec<_>>());
    drop(connection);
    let running = queue
        .claim(JobLane::Bulk, 1)
        .await?
        .pop()
        .expect("first audit batch");
    let original = running.payload.clone();
    queue.enqueue_ghost_audit_levels(&[1000, 2002]).await?;
    let mut connection = partition.connection().await?;
    let unchanged = sql_query("SELECT payload FROM zc_jobs.job WHERE lane='bulk' AND id=$1")
        .bind::<BigInt, _>(running.id.parse::<i64>()?)
        .get_result::<Payload>(&mut connection)
        .await?
        .payload;
    assert_eq!(unchanged, original);
    let pending = sql_query("SELECT payload FROM zc_jobs.job WHERE task='auditRecordGhosts' AND NOT running AND jsonb_array_length(payload->'idLevels')<1000")
        .get_result::<Payload>(&mut connection).await?.payload;
    assert_eq!(pending["idLevels"], serde_json::json!([1000, 2001, 2002]));
    Ok(())
}
