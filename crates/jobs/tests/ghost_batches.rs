use anyhow::{Context, Result, bail, ensure};
use async_trait::async_trait;
use diesel::{
    QueryableByName, sql_query,
    sql_types::{BigInt, Jsonb, Text},
};
use diesel_async::{RunQueryDsl, SimpleAsyncConnection};
use serde_json::{Value, json};
use std::sync::{
    Arc,
    atomic::{AtomicBool, AtomicUsize, Ordering},
};
use zc_core::object_storage::{DownloadConstraints, ObjectStorage};
use zc_database::Database;
use zc_jobs::{
    TaskIdentifier,
    ghost_audit::GhostAuditService,
    queue::{ClaimedJob, JobLane, Queue},
    runtime::JobOutcome,
};
const MD5: &str = include_str!("fixtures/ghost_batches/md5.sql");

#[derive(Default)]
struct Storage {
    downloads: AtomicUsize,
    active: AtomicUsize,
    peak: AtomicUsize,
    recover_failing: AtomicBool,
}
#[async_trait]
impl ObjectStorage for Storage {
    async fn upload(&self, _: &str, _: Vec<u8>, _: &str) -> Result<()> {
        bail!("No uploads during audit")
    }
    async fn delete(&self, _: &str) -> Result<()> {
        bail!("No deletion during audit")
    }
    async fn download(&self, key: &str, _: DownloadConstraints<'_>) -> Result<Vec<u8>> {
        self.downloads.fetch_add(1, Ordering::SeqCst);
        let active = self.active.fetch_add(1, Ordering::SeqCst) + 1;
        self.peak.fetch_max(active, Ordering::SeqCst);
        tokio::time::sleep(std::time::Duration::from_millis(1)).await;
        self.active.fetch_sub(1, Ordering::SeqCst);
        if key == "outage"
            || (key == "recover" && AtomicBool::load(&self.recover_failing, Ordering::SeqCst))
        {
            bail!("fixture outage")
        }
        let wire: Value =
            serde_json::from_str(include_str!("../../../test/fixtures/ghost-v8.json"))?;
        Ok(hex::decode(
            wire["lzmaHex"].as_str().context("wire fixture")?,
        )?)
    }
}
#[derive(QueryableByName)]
struct Count {
    #[diesel(sql_type=BigInt)]
    count: i64,
}
#[derive(QueryableByName)]
struct Data {
    #[diesel(sql_type=Jsonb)]
    data: Value,
}
#[derive(QueryableByName)]
struct Digest {
    #[diesel(sql_type=Text)]
    value: String,
}
async fn refreshed(db: &Database, job: &ClaimedJob) -> Result<ClaimedJob> {
    let mut connection = db.pool_partition().connection().await?;
    let data = sql_query(include_str!(
        "fixtures/ghost_batches/select_payload_job.sql"
    ))
    .bind::<BigInt, _>(job.id.parse::<i64>()?)
    .get_result::<Data>(&mut connection)
    .await?;
    let mut job = job.clone();
    job.payload = data.data;
    Ok(job)
}
async fn retry(db: &Database, queue: &Queue, job: &ClaimedJob) -> Result<ClaimedJob> {
    ensure!(queue.finish(job, Some("handler_failed")).await?);
    let mut connection = db.pool_partition().connection().await?;
    sql_query(include_str!(
        "fixtures/ghost_batches/set_vt_q_zeepcentraal_bulk.sql"
    ))
    .bind::<BigInt, _>(job.id.parse::<i64>()?)
    .execute(&mut connection)
    .await?;
    drop(connection);
    queue
        .claim(JobLane::Bulk, 1)
        .await?
        .pop()
        .context("retry claim")
}
#[tokio::test]
#[ignore = "requires fresh local ghost_validation_batch_test database"]
async fn batches_reuse_geometry_checkpoint_retries_coalesce_and_compact_reports() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1")
            && matches!(
                parsed.path(),
                "/ghost_validation_batch_test" | "/ghost_validation_batch_benchmark_test"
            ),
        "Dedicated local fixture required"
    );
    let db = Database::connect(&url, 6).await?;
    let mut connection = db.pool_partition().connection().await?;
    for sql in [
        include_str!("../../database/tests/fixtures/ghost_validation.sql"),
        include_str!("../../database/migrations/20261006180000_ghost_validation/up.sql"),
        include_str!("../../database/migrations/20261008020000_mutable_record_validation/up.sql"),
        include_str!("../../../packages/database/drizzle/0083_pgmq_queue.sql"),
        include_str!("../../database/migrations/20261008040000_incremental_ghost_audits/up.sql"),
        include_str!("../../database/migrations/20261008050000_compact_validation_reports/up.sql"),
        include_str!("../../database/migrations/20261018010000_validation_metadata_guards/up.sql"),
    ] {
        connection.batch_execute(sql).await?;
    }
    connection
        .batch_execute(include_str!("fixtures/ghost_batches/insert_user.sql"))
        .await?;
    for (level, x) in [(1, 0), (2, 100)] {
        let blocks =
            json!([{"i":1,"u":"start","p":{"x":x}},{"i":22,"u":"checkpoint"},{"i":2,"u":"finish"}]);
        let hash =
            zc_core::levels::calculate_json_level_xxhash(&json!({"blox":blocks}).to_string())?;
        sql_query(include_str!("fixtures/ghost_batches/insert_level.sql"))
            .bind::<diesel::sql_types::Integer, _>(level)
            .bind::<Text, _>(hash)
            .execute(&mut connection)
            .await?;
        sql_query(include_str!(
            "fixtures/ghost_batches/insert_level_metadata.sql"
        ))
        .bind::<diesel::sql_types::Integer, _>(level)
        .bind::<Jsonb, _>(blocks)
        .execute(&mut connection)
        .await?;
    }
    connection
        .batch_execute(include_str!("fixtures/ghost_batches/insert_record.sql"))
        .await?;
    let before = sql_query(MD5)
        .get_result::<Digest>(&mut connection)
        .await?
        .value;
    drop(connection);
    let queue = Queue::connect(db.pool_partition()).await?;
    let storage = Arc::new(Storage::default());
    storage.recover_failing.store(true, Ordering::SeqCst);
    let auditor = GhostAuditService::new(db.clone(), queue.clone(), storage.clone());
    queue
        .enqueue(
            TaskIdentifier::AuditRecordGhosts,
            json!({}),
            JobLane::Bulk,
            None,
        )
        .await?;
    let mut job = queue
        .claim(JobLane::Bulk, 1)
        .await?
        .pop()
        .context("claim")?;
    let started = std::time::Instant::now();
    assert!(matches!(
        auditor.audit_claimed(&job).await?,
        JobOutcome::Completed
    ));
    println!(
        "Batch 1,000 records: {} ms; snapshots {}; preparations {}",
        started.elapsed().as_millis(),
        AtomicUsize::load(&auditor.counters.snapshot_loads, Ordering::SeqCst),
        AtomicUsize::load(&auditor.counters.geometry_preparations, Ordering::SeqCst)
    );
    assert_eq!(
        AtomicUsize::load(&storage.downloads, Ordering::SeqCst),
        1000
    );
    assert_eq!(
        AtomicUsize::load(&auditor.counters.snapshot_loads, Ordering::SeqCst),
        1
    );
    assert_eq!(
        AtomicUsize::load(&auditor.counters.geometry_preparations, Ordering::SeqCst),
        1
    );
    job = refreshed(&db, &job).await?;
    assert_eq!(
        job.payload["work"]["recordIds"].as_array().unwrap().len(),
        1000
    );
    let mut stale = job.clone();
    stale.generation = "999999".into();
    assert!(!queue.checkpoint(&stale, &stale.payload).await?);
    storage.recover_failing.store(false, Ordering::SeqCst);
    job = retry(&db, &queue, &job).await?;
    assert!(matches!(
        auditor.audit_claimed(&job).await?,
        JobOutcome::Completed
    ));
    assert_eq!(
        AtomicUsize::load(&storage.downloads, Ordering::SeqCst),
        1000
    );
    job = retry(&db, &queue, &job).await?;
    assert!(matches!(
        auditor.audit_claimed(&job).await?,
        JobOutcome::Completed
    ));
    assert_eq!(
        AtomicUsize::load(&storage.downloads, Ordering::SeqCst),
        1000
    );
    // Replaying completed work cannot duplicate continuation or successful downloads.
    assert!(matches!(
        auditor.audit_claimed(&job).await?,
        JobOutcome::Completed
    ));
    ensure!(queue.finish(&job, None).await?);
    let mut connection = db.pool_partition().connection().await?;
    assert_eq!(
        sql_query(include_str!("fixtures/ghost_batches/count_job.sql"))
            .get_result::<Count>(&mut connection)
            .await?
            .count,
        1
    );
    drop(connection);
    let job = queue
        .claim(JobLane::Bulk, 1)
        .await?
        .pop()
        .context("packed second batch")?;
    assert!(matches!(
        auditor.audit_claimed(&job).await?,
        JobOutcome::Completed
    ));
    ensure!(queue.finish(&job, None).await?);
    let job = queue
        .claim(JobLane::Bulk, 1)
        .await?
        .pop()
        .context("partial final batch")?;
    assert!(matches!(
        auditor.audit_claimed(&job).await?,
        JobOutcome::Completed
    ));
    ensure!(queue.finish(&job, None).await?);
    assert_eq!(AtomicUsize::load(&storage.peak, Ordering::SeqCst), 2);
    assert_eq!(
        db.record_validation_attempts(20).await?[0]["report"]["reasons"][0],
        "ghost_storage_unavailable"
    );
    assert_eq!(
        db.record_validation_attempts(2001).await?[0]["status"],
        "fail"
    );
    assert_eq!(
        db.record_validation_attempts(2002).await?[0]["report"]["reasons"][0],
        "missing_snapshot"
    );
    let mut connection = db.pool_partition().connection().await?;
    assert_eq!(
        sql_query(include_str!(
            "fixtures/ghost_batches/count_record_validation.sql"
        ))
        .get_result::<Count>(&mut connection)
        .await?
        .count,
        0
    );
    let after = sql_query(MD5)
        .get_result::<Digest>(&mut connection)
        .await?
        .value;
    assert_eq!(before, after);
    let saved = db.record_validation_attempts(10).await?.remove(0);
    connection
        .batch_execute(include_str!(
            "../../database/migrations/20261008050000_compact_validation_reports/down.sql"
        ))
        .await?;
    assert_eq!(saved, db.record_validation_attempts(10).await?[0]);
    connection
        .batch_execute(include_str!(
            "../../database/migrations/20261008050000_compact_validation_reports/up.sql"
        ))
        .await?;
    assert_eq!(saved, db.record_validation_attempts(10).await?[0]);
    drop(connection);
    queue.enqueue_ghost_audit_levels(&[1, 2]).await?;
    queue.enqueue_ghost_audit_levels(&[2, 3]).await?;
    let job = queue
        .claim(JobLane::Bulk, 1)
        .await?
        .pop()
        .context("coalesced levels")?;
    assert_eq!(job.payload["idLevels"], json!([1, 2, 3]));
    queue.enqueue_ghost_audit_levels(&[3]).await?;
    assert_eq!(
        refreshed(&db, &job).await?.payload,
        job.payload,
        "Running scope must remain fixed"
    );
    ensure!(queue.finish(&job, None).await?);
    let pending = queue
        .claim(JobLane::Bulk, 1)
        .await?
        .pop()
        .context("later changed level")?;
    ensure!(queue.finish(&pending, None).await?);
    let mut connection = db.pool_partition().connection().await?;
    connection
        .batch_execute(include_str!(
            "fixtures/ghost_batches/set_validator_version_record_validation.sql"
        ))
        .await?;
    drop(connection);
    let expected = db
        .audit_record_window(&json!({}), 1000)
        .await?
        .iter()
        .filter(|row| row.needs_check)
        .count();
    let loads = AtomicUsize::load(&auditor.counters.snapshot_loads, Ordering::SeqCst);
    let prepared = AtomicUsize::load(&auditor.counters.geometry_preparations, Ordering::SeqCst);
    let started = std::time::Instant::now();
    for id in 1..=1000 {
        auditor
            .validate_record_ghost(&json!({"idRecord":id}))
            .await?;
    }
    assert_eq!(
        AtomicUsize::load(&auditor.counters.snapshot_loads, Ordering::SeqCst) - loads,
        expected
    );
    assert_eq!(
        AtomicUsize::load(&auditor.counters.geometry_preparations, Ordering::SeqCst) - prepared,
        expected
    );
    println!(
        "Singleton audit requests: {} ms; eligible {}",
        started.elapsed().as_millis(),
        expected
    );
    queue
        .enqueue_ghost_audit_levels(&(1..=2001).collect::<Vec<_>>())
        .await?;
    let jobs = queue.claim(JobLane::Bulk, 3).await?;
    assert_eq!(
        jobs.len(),
        1,
        "Audit lock group allows only one running batch"
    );
    assert_eq!(jobs[0].payload["idLevels"].as_array().unwrap().len(), 1000);
    ensure!(queue.finish(&jobs[0], None).await?);
    for expected in [1000, 1] {
        let job = queue
            .claim(JobLane::Bulk, 1)
            .await?
            .pop()
            .context("level-set boundary")?;
        assert_eq!(job.payload["idLevels"].as_array().unwrap().len(), expected);
        ensure!(queue.finish(&job, None).await?);
    }
    let mut connection = db.pool_partition().connection().await?;
    connection
        .batch_execute(include_str!(
            "fixtures/ghost_batches/set_environment_level_metadata.sql"
        ))
        .await?;
    drop(connection);
    let inputs = db
        .audit_level_window(&json!({"recordIds":[10,2001,2002]}), 2002)
        .await?;
    assert!(
        inputs[0].needs_check,
        "Changed metadata requires validation"
    );
    assert!(
        inputs.iter().all(|row| row.id != 2001),
        "Failed record excluded before limit"
    );
    assert!(
        !inputs
            .iter()
            .find(|row| row.id == 2002)
            .unwrap()
            .needs_check,
        "Membership never invalidates uncertainty"
    );
    queue
        .enqueue(
            TaskIdentifier::AuditRecordGhosts,
            json!({"idRecord":10}),
            JobLane::Bulk,
            None,
        )
        .await?;
    let job = queue
        .claim(JobLane::Bulk, 1)
        .await?
        .pop()
        .context("expired lease")?;
    let mut connection = db.pool_partition().connection().await?;
    sql_query(include_str!(
        "fixtures/ghost_batches/set_lease_until_job.sql"
    ))
    .bind::<BigInt, _>(job.id.parse::<i64>()?)
    .execute(&mut connection)
    .await?;
    drop(connection);
    let downloads = AtomicUsize::load(&storage.downloads, Ordering::SeqCst);
    assert!(auditor.audit_claimed(&job).await.is_err());
    assert_eq!(
        AtomicUsize::load(&storage.downloads, Ordering::SeqCst),
        downloads,
        "Lost lease cannot start downloads"
    );
    let mut connection = db.pool_partition().connection().await?;
    sql_query(include_str!(
        "fixtures/ghost_batches/set_lease_until_job_by_id.sql"
    ))
    .bind::<BigInt, _>(job.id.parse::<i64>()?)
    .execute(&mut connection)
    .await?;
    drop(connection);
    ensure!(queue.finish(&job, None).await?);
    Ok(())
}
