use anyhow::{Result, bail, ensure};
use async_trait::async_trait;
use diesel::{
    QueryableByName, sql_query,
    sql_types::{BigInt, Text},
};
use diesel_async::{RunQueryDsl, SimpleAsyncConnection};
use serde_json::json;
use std::{sync::Arc, time::Duration};
use zc_core::object_storage::{DownloadConstraints, ObjectStorage};
use zc_database::{
    Database, DatabasePool, PoolBudget, PoolSettings, services::jobs::MaintenanceOutcome,
};
use zc_jobs::{
    TaskIdentifier,
    handlers::ServiceJobHandler,
    queue::{JobLane, Queue},
    runtime::{JobHandler, JobOutcome},
};

struct NoStorage;

#[async_trait]
impl ObjectStorage for NoStorage {
    async fn upload(&self, _: &str, _: Vec<u8>, _: &str) -> Result<()> {
        bail!("No storage during scoring")
    }
    async fn download(&self, _: &str, _: DownloadConstraints<'_>) -> Result<Vec<u8>> {
        bail!("No storage during scoring")
    }
    async fn delete(&self, _: &str) -> Result<()> {
        bail!("No storage during scoring")
    }
}

fn handler(database: &Database, queue: &Queue) -> Result<ServiceJobHandler> {
    let storage: Arc<dyn ObjectStorage> = Arc::new(NoStorage);
    Ok(ServiceJobHandler::new(
        database.clone(),
        queue.clone(),
        Arc::new(zc_workshop::metadata::SteamWebApiMetadata::new(
            "test", "1440670",
        )?),
        Arc::new(zc_workshop::steamcmd::SteamCmdDownloader::new(
            "1440670",
            "unused-test-executable",
        )),
        Arc::new(zc_workshop::persistence::DatabaseWorkshopPersistence::new(
            database.clone(),
            storage.clone(),
            "test",
        )?),
        storage,
    ))
}

#[derive(QueryableByName)]
struct Count {
    #[diesel(sql_type = BigInt)]
    count: i64,
}

async fn count(database: &Database, query: &str) -> Result<i64> {
    Ok(sql_query(query)
        .get_result::<Count>(&mut database.pool_partition().connection().await?)
        .await?
        .count)
}

async fn assert_ranks(database: &Database) -> Result<()> {
    assert_eq!(count(database, "WITH desired AS (SELECT p.id_user,RANK() OVER(ORDER BY p.points DESC)::integer rank FROM public.user_points p JOIN public.\"user\" u ON u.id=p.id_user WHERE NOT u.banned AND EXISTS(SELECT 1 FROM public.record r WHERE r.id_user=u.id AND r.date_created>=now()-interval '6 months')) SELECT count(*)::bigint AS count FROM desired JOIN public.user_points p USING(id_user) WHERE p.rank<>desired.rank").await?, 0);
    Ok(())
}

#[tokio::test]
#[ignore = "requires isolated local player_score_sweep_test with current scoring schema and pgmq"]
async fn pages_resume_yield_to_repairs_and_retry_complete_rank_snapshots() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/player_score_sweep_test",
        "Dedicated isolated database required"
    );
    let pool = DatabasePool::connect(
        &url,
        PoolSettings {
            application_name: "zeepcentraal-player-score-sweep-test".to_owned(),
            acquire_timeout: Duration::from_secs(5),
            statement_timeout: Duration::from_secs(15),
            lock_timeout: Duration::from_secs(3),
            idle_transaction_timeout: Duration::from_secs(30),
            idle_timeout: Duration::from_secs(30),
        },
        PoolBudget {
            application: 8,
            queue: 2,
            scheduler: 0,
        },
    )
    .await?;
    let database = Database::from_partition(pool.application());
    let queue = Queue::connect(pool.queue()?).await?;
    let service = handler(&database, &queue)?;
    let mut connection = database.pool_partition().connection().await?;
    connection.batch_execute(r#"
        INSERT INTO public."user"(id,steam_id,banned) OVERRIDING SYSTEM VALUE
          SELECT id,100000+id,false FROM generate_series(1,205) id;
        INSERT INTO public.level(id,hash,xx_hash,adventure) OVERRIDING SYSTEM VALUE VALUES(1,'score-test',repeat('c',32),true);
        INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version,date_created) OVERRIDING SYSTEM VALUE
          SELECT id,id,1,id::real,'test','test',CASE WHEN id<=201 THEN now() ELSE '2000-01-01'::timestamptz END FROM generate_series(1,205) id;
        INSERT INTO public.personal_best_global(id_user,id_level,id_record) SELECT id,1,id FROM generate_series(1,205) id;
        INSERT INTO public.level_points(id_level,points) VALUES(1,1000);
        INSERT INTO public.user_point_contribution(id_user,id_level,id_record,contribution_rank,level_position,level_points,level_decayed_points,player_decayed_points,date_calculated)
          SELECT id,1,id,1,id,1000,(1000-id/2)::real,0,now() FROM generate_series(1,205) id;
        INSERT INTO public.user_points(id_user,points,total_points,rank) SELECT id,-10,-10,-1 FROM generate_series(1,205) id;
        TRUNCATE zc_jobs.job,pgmq.q_zeepcentraal_fast,pgmq.q_zeepcentraal_bulk;
    "#).await?;
    drop(connection);

    queue
        .enqueue(
            TaskIdentifier::UpdatePlayerScores,
            json!({}),
            JobLane::Bulk,
            None,
        )
        .await?;
    let first = queue
        .claim(JobLane::Bulk, 1)
        .await?
        .pop()
        .expect("first score page");
    // A running sweep cannot block the group used by individual score repairs.
    queue
        .enqueue(
            TaskIdentifier::UpdatePlayerScore,
            json!({"idUser":1}),
            JobLane::Bulk,
            Some("score-test:repair"),
        )
        .await?;
    let repair = queue
        .claim(JobLane::Bulk, 1)
        .await?
        .pop()
        .expect("repair while sweep runs");
    assert_eq!(repair.task, "updatePlayerScore");
    assert_eq!(
        service.handle_claimed(&repair, JobLane::Bulk).await?,
        JobOutcome::Completed
    );
    assert!(queue.finish(&repair, None).await?);
    assert_eq!(
        service.handle_claimed(&first, JobLane::Bulk).await?,
        JobOutcome::Completed
    );
    assert_eq!(
        count(
            &database,
            "SELECT count(*)::bigint AS count FROM public.user_points WHERE points<>-10"
        )
        .await?,
        200
    );
    // Replay after continuation enqueue but before acknowledgement: no duplicate page.
    assert_eq!(
        service.handle_claimed(&first, JobLane::Bulk).await?,
        JobOutcome::Completed
    );
    assert_eq!(
        count(
            &database,
            "SELECT count(*)::bigint AS count FROM zc_jobs.job WHERE NOT running"
        )
        .await?,
        1
    );
    assert!(queue.finish(&first, None).await?);

    let restarted = handler(&database, &queue)?;
    let second = queue
        .claim(JobLane::Bulk, 1)
        .await?
        .pop()
        .expect("resumed score page");
    assert_eq!(second.payload["afterUserId"], 200);
    assert_eq!(
        restarted.handle_claimed(&second, JobLane::Bulk).await?,
        JobOutcome::Completed
    );
    assert!(queue.finish(&second, None).await?);
    assert_eq!(
        count(
            &database,
            "SELECT count(*)::bigint AS count FROM public.user_points WHERE points=-10"
        )
        .await?,
        0
    );
    assert_eq!(count(&database,"SELECT count(*)::bigint AS count FROM public.user_points WHERE id_user>201 AND points=0 AND rank=-1").await?,4);

    let ranks = queue
        .claim(JobLane::Bulk, 1)
        .await?
        .pop()
        .expect("rank phase");
    assert_eq!(ranks.payload["phase"], "ranks");
    let mut blocker = database.pool_partition().connection().await?;
    blocker
        .batch_execute("SELECT pg_advisory_lock(-1861284952,1)")
        .await?;
    assert_eq!(
        restarted.handle_claimed(&ranks, JobLane::Bulk).await?,
        JobOutcome::Deferred
    );
    assert!(queue.defer(&ranks).await?);
    assert_eq!(count(&database,"SELECT count(*)::bigint AS count FROM zc_jobs.job WHERE task='updatePlayerScores' AND payload->>'phase'='ranks' AND attempts=0 AND NOT running").await?,1);
    blocker
        .batch_execute("SELECT pg_advisory_unlock(-1861284952,1)")
        .await?;
    drop(blocker);
    let mut connection = database.pool_partition().connection().await?;
    sql_query("UPDATE pgmq.q_zeepcentraal_bulk SET vt=clock_timestamp() WHERE msg_id=$1::bigint")
        .bind::<Text, _>(&ranks.id)
        .execute(&mut connection)
        .await?;
    drop(connection);
    let retried = queue
        .claim(JobLane::Bulk, 1)
        .await?
        .pop()
        .expect("durable rank retry");
    assert_eq!(retried.id, ranks.id);
    assert_eq!(retried.payload["phase"], "ranks");
    assert_eq!(
        restarted.handle_claimed(&retried, JobLane::Bulk).await?,
        JobOutcome::Completed
    );
    assert!(queue.finish(&retried, None).await?);
    assert_ranks(&database).await?;
    assert_eq!(count(&database,"SELECT count(*)::bigint AS count FROM public.user_points WHERE id_user IN (2,3) AND rank=2").await?,2);
    assert_eq!(count(&database,"SELECT count(*)::bigint AS count FROM public.user_point_contribution WHERE level_position<>id_user").await?,0);

    // Change an earlier batch's score while a later batch writes its ranks.
    // Batch-local guards all pass; only complete snapshot validation catches this.
    let mut connection = database.pool_partition().connection().await?;
    connection.batch_execute(r#"
        UPDATE public.user_points SET rank=-1 WHERE id_user<=201;
        CREATE TABLE zc_private.score_test_mutation(applied boolean NOT NULL);
        INSERT INTO zc_private.score_test_mutation VALUES(false);
        CREATE FUNCTION zc_private.score_test_change_points() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.id_user=51 AND EXISTS(SELECT FROM zc_private.score_test_mutation WHERE NOT applied) THEN
            UPDATE zc_private.score_test_mutation SET applied=true;
            UPDATE public.user_points SET points=0 WHERE id_user=1;
          END IF;
          RETURN NEW;
        END $$;
        CREATE TRIGGER score_test_change_points AFTER UPDATE OF rank ON public.user_points
          FOR EACH ROW EXECUTE FUNCTION zc_private.score_test_change_points();
    "#).await?;
    drop(connection);
    queue
        .enqueue(
            TaskIdentifier::UpdatePlayerScores,
            json!({"phase":"ranks"}),
            JobLane::Bulk,
            None,
        )
        .await?;
    let changed = queue
        .claim(JobLane::Bulk, 1)
        .await?
        .pop()
        .expect("rank validation pass");
    assert_eq!(
        restarted.handle_claimed(&changed, JobLane::Bulk).await?,
        JobOutcome::Completed
    );
    assert!(queue.finish(&changed, None).await?);
    assert_eq!(count(&database,"SELECT count(*)::bigint AS count FROM public.user_points WHERE id_user=1 AND points=0 AND rank=201").await?,1);
    assert_ranks(&database).await?;
    assert_eq!(
        count(
            &database,
            "SELECT count(*)::bigint AS count FROM zc_jobs.job"
        )
        .await?,
        0
    );

    // Quiet ranking waits for score pages, but never waits for verification itself.
    queue
        .enqueue(
            TaskIdentifier::UpdatePlayerScores,
            json!({"silent":true,"phase":"ranks"}),
            JobLane::Bulk,
            None,
        )
        .await?;
    queue
        .enqueue(
            TaskIdentifier::UpdatePlayerScores,
            json!({"silent":true,"afterUserId":205}),
            JobLane::Bulk,
            None,
        )
        .await?;
    let quiet = queue
        .claim(JobLane::Bulk, 1)
        .await?
        .pop()
        .expect("quiet ranks");
    assert_eq!(quiet.payload["phase"], "ranks");
    assert_eq!(
        restarted.handle_claimed(&quiet, JobLane::Bulk).await?,
        JobOutcome::Deferred
    );
    assert!(queue.defer(&quiet).await?);
    let mut connection = database.pool_partition().connection().await?;
    sql_query("UPDATE pgmq.q_zeepcentraal_bulk SET vt=clock_timestamp()+interval '1 hour' WHERE msg_id=$1::bigint").bind::<Text,_>(&quiet.id).execute(&mut connection).await?;
    drop(connection);
    let page = queue
        .claim(JobLane::Bulk, 1)
        .await?
        .pop()
        .expect("unfinished score page");
    assert_eq!(page.payload["afterUserId"], 205);
    assert_eq!(
        restarted.handle_claimed(&page, JobLane::Bulk).await?,
        JobOutcome::Completed
    );
    assert!(queue.finish(&page, None).await?);
    queue
        .enqueue(
            TaskIdentifier::BackfillRecordEligibility,
            json!({"verify":true,"throughLevelId":1}),
            JobLane::Bulk,
            Some("score-test:verification"),
        )
        .await?;
    let mut connection = database.pool_partition().connection().await?;
    sql_query("UPDATE pgmq.q_zeepcentraal_bulk SET vt=clock_timestamp() WHERE msg_id=$1::bigint")
        .bind::<Text, _>(&quiet.id)
        .execute(&mut connection)
        .await?;
    drop(connection);
    let quiet_retry = queue
        .claim(JobLane::Bulk, 1)
        .await?
        .pop()
        .expect("quiet rank retry");
    assert_eq!(quiet_retry.id, quiet.id);
    assert_eq!(
        restarted
            .handle_claimed(&quiet_retry, JobLane::Bulk)
            .await?,
        JobOutcome::Completed
    );
    assert!(queue.finish(&quiet_retry, None).await?);
    let verification = queue
        .claim(JobLane::Bulk, 1)
        .await?
        .pop()
        .expect("verification remains queued");
    assert_eq!(verification.task, "backfillRecordEligibility");
    assert!(queue.finish(&verification, None).await?);

    // Eligibility changes must invalidate the field even if remaining scores match.
    let snapshot = database.player_rank_snapshot().await?;
    assert!(database.player_rank_snapshot_is_current(&snapshot).await?);
    let mut connection = database.pool_partition().connection().await?;
    connection
        .batch_execute("UPDATE public.\"user\" SET banned=true WHERE id=201")
        .await?;
    drop(connection);
    assert!(!database.player_rank_snapshot_is_current(&snapshot).await?);
    assert!(matches!(
        database
            .persist_player_rank_batch_with_notifications(&snapshot[0..50], false)
            .await?,
        MaintenanceOutcome::Applied(_)
    ));
    // Reconciliation uses SQL enqueueing, so verify it shares the sweep queue group.
    let mut connection = database.pool_partition().connection().await?;
    connection.batch_execute("INSERT INTO public.level(id,hash,xx_hash,adventure) OVERRIDING SYSTEM VALUE VALUES(2,'eligibility-score-test',repeat('d',32),true)").await?;
    drop(connection);
    assert_eq!(
        database.reconcile_record_eligibility(2).await?,
        MaintenanceOutcome::Applied(())
    );
    assert_eq!(count(&database,"SELECT count(*)::bigint AS count FROM zc_jobs.job WHERE task='updatePlayerScores' AND lock_group='player-score-sweep'").await?,1);
    for _ in 0..3 {
        for followup in queue.claim(JobLane::Bulk, 10).await? {
            assert!(queue.finish(&followup, None).await?);
        }
    }
    assert_eq!(
        count(
            &database,
            "SELECT count(*)::bigint AS count FROM zc_jobs.job"
        )
        .await?,
        0
    );

    // Simulate contribution commits followed by a lost player-score enqueue.
    let page_users: Vec<_> = (1..=50).collect();
    assert!(matches!(
        database
            .reconcile_level_contribution_users(1, &page_users)
            .await?,
        MaintenanceOutcome::Applied(_)
    ));
    assert_eq!(
        database
            .reconcile_level_contribution_users(1, &page_users)
            .await?,
        MaintenanceOutcome::Applied(Vec::new())
    );
    for defer_count in [0, 1] {
        assert_eq!(
            service
                .handle(
                    TaskIdentifier::UpdateLevelContributions,
                    json!({"idLevel":1,"afterUserId":0,"deferCount":defer_count}),
                    JobLane::Bulk,
                    1,
                )
                .await?,
            JobOutcome::Completed
        );
        assert_eq!(
            count(
                &database,
                "SELECT count(*)::bigint AS count FROM zc_jobs.job WHERE task='updatePlayerScore'"
            )
            .await?,
            if defer_count == 0 { 0 } else { 50 }
        );
        for _ in 0..55 {
            for followup in queue.claim(JobLane::Bulk, 10).await? {
                assert!(queue.finish(&followup, None).await?);
            }
        }
        assert_eq!(
            count(
                &database,
                "SELECT count(*)::bigint AS count FROM zc_jobs.job"
            )
            .await?,
            0
        );
    }
    assert_eq!(
        service
            .handle(
                TaskIdentifier::UpdateLevelContributions,
                json!({"idLevel":1,"idUser":1,"projectionToken":"bulk:1:1","deferCount":1}),
                JobLane::Bulk,
                1,
            )
            .await?,
        JobOutcome::Completed
    );
    let player_repair = queue
        .claim(JobLane::Bulk, 1)
        .await?
        .pop()
        .expect("unchanged contribution still repairs player total");
    assert_eq!(player_repair.task, "updatePlayerScore");
    assert_eq!(player_repair.payload["idUser"], 1);
    assert!(queue.finish(&player_repair, None).await?);
    Ok(())
}
