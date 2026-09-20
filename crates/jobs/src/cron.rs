use crate::{
    TaskIdentifier,
    queue::{JobLane, Queue},
    retry::{RetryBackoff, is_unavailable, wait_or_shutdown},
};
use anyhow::Result;
use diesel::{
    QueryableByName, sql_query,
    sql_types::{Bool, Text},
};
use diesel_async::RunQueryDsl;
use std::time::Duration;
use tokio::sync::watch;

const SCHEDULER_LOCK_NAMESPACE: i32 = 1_861_284_951;

#[derive(QueryableByName)]
struct LockRow {
    #[diesel(sql_type = Bool)]
    acquired: bool,
}

#[derive(QueryableByName)]
struct ScheduleRow {
    #[diesel(sql_type = Text)]
    minute_key: String,
    #[diesel(sql_type = Bool)]
    recover: bool,
    #[diesel(sql_type = Bool)]
    rotate_weekly: bool,
    #[diesel(sql_type = Bool)]
    rotate_monthly: bool,
    #[diesel(sql_type = Bool)]
    workshop: bool,
    #[diesel(sql_type = Bool)]
    level_full: bool,
    #[diesel(sql_type = Bool)]
    level_incremental: bool,
    #[diesel(sql_type = Bool)]
    players: bool,
    #[diesel(sql_type = Bool)]
    level_history: bool,
    #[diesel(sql_type = Bool)]
    user_history: bool,
    #[diesel(sql_type = Bool)]
    prune: bool,
}

pub async fn run(
    scheduler: zc_database::PoolPartition,
    initial_connection: zc_database::PoolConnection,
    queue: Queue,
    mut shutdown: watch::Receiver<bool>,
) -> Result<()> {
    let mut initial_connection = Some(initial_connection);
    let mut retry = RetryBackoff::new();
    loop {
        if *shutdown.borrow() {
            return Ok(());
        }
        let connection = match initial_connection.take() {
            Some(connection) => connection,
            None => match scheduler.connection().await {
                Ok(connection) => connection,
                Err(error) if is_unavailable(&error) => {
                    let decision = retry.failure();
                    if decision.warn {
                        tracing::warn!(
                            retry_ms = decision.delay.as_millis(),
                            "Jobs scheduler database unavailable; connection will retry"
                        );
                    }
                    if wait_or_shutdown(decision.delay, &mut shutdown).await {
                        return Ok(());
                    }
                    continue;
                }
                Err(error) => return Err(error),
            },
        };
        match run_session(connection, &queue, &mut shutdown, &mut retry).await {
            Ok(()) => return Ok(()),
            Err(error) if is_unavailable(&error) => {
                let decision = retry.failure();
                if decision.warn {
                    tracing::warn!(
                        retry_ms = decision.delay.as_millis(),
                        "Jobs scheduler database unavailable; leadership will be reacquired"
                    );
                }
                if wait_or_shutdown(decision.delay, &mut shutdown).await {
                    return Ok(());
                }
            }
            Err(error) => return Err(error),
        }
    }
}

async fn run_session(
    mut connection: zc_database::PoolConnection,
    queue: &Queue,
    shutdown: &mut watch::Receiver<bool>,
    retry: &mut RetryBackoff,
) -> Result<()> {
    loop {
        if *shutdown.borrow() {
            return Ok(());
        }
        let lock: LockRow = sql_query("SELECT pg_try_advisory_lock($1,0) AS acquired")
            .bind::<diesel::sql_types::Integer, _>(SCHEDULER_LOCK_NAMESPACE)
            .get_result(&mut connection)
            .await?;
        if lock.acquired {
            break;
        }
        tokio::select! {
            result = shutdown.changed() => { if result.is_err() || *shutdown.borrow() { return Ok(()); } }
            _ = tokio::time::sleep(Duration::from_secs(5)) => {}
        }
    }
    retry.reset();
    tracing::info!("Jobs scheduler leadership acquired");
    let mut last_minute = String::new();
    loop {
        if *shutdown.borrow() {
            break;
        }
        let schedule: ScheduleRow = sql_query(
            "WITH times AS (SELECT timezone('Europe/London',clock_timestamp()) local_time,timezone('UTC',clock_timestamp()) utc_time) SELECT \
             to_char(utc_time,'YYYY-MM-DD HH24:MI') AS minute_key, \
             extract(minute FROM local_time)=0 AS recover, \
             extract(isodow FROM utc_time)=1 AND extract(hour FROM utc_time)=6 AND extract(minute FROM utc_time)=0 AS rotate_weekly, \
             extract(day FROM utc_time)=1 AND extract(hour FROM utc_time)=6 AND extract(minute FROM utc_time)=0 AS rotate_monthly, \
             extract(dow FROM local_time)=0 AND extract(hour FROM local_time)=1 AND extract(minute FROM local_time)=0 AS workshop, \
             extract(isodow FROM local_time)=1 AND extract(hour FROM local_time)=1 AND extract(minute FROM local_time)=0 AS level_full, \
             extract(minute FROM local_time) IN (0,30) AS level_incremental, \
             extract(minute FROM local_time)>=5 AND mod(extract(minute FROM local_time)::integer-5,10)=0 AS players, \
             extract(minute FROM local_time)=0 AS level_history, \
             extract(hour FROM local_time) IN (0,12) AND extract(minute FROM local_time)=0 AS user_history, \
             extract(hour FROM local_time)=2 AND extract(minute FROM local_time)=30 AS prune FROM times",
        ).get_result(&mut connection).await?;
        if schedule.minute_key != last_minute {
            enqueue_due(queue, &schedule).await?;
            last_minute = schedule.minute_key;
        }
        tokio::select! {
            result = shutdown.changed() => { if result.is_err() || *shutdown.borrow() { break; } }
            _ = tokio::time::sleep(Duration::from_secs(5)) => {}
        }
    }
    let _ = sql_query("SELECT pg_advisory_unlock($1,0)")
        .bind::<diesel::sql_types::Integer, _>(SCHEDULER_LOCK_NAMESPACE)
        .execute(&mut connection)
        .await;
    Ok(())
}

async fn enqueue_due(queue: &Queue, schedule: &ScheduleRow) -> Result<()> {
    if schedule.recover {
        enqueue(
            queue,
            TaskIdentifier::RecoverLevelRequests,
            serde_json::json!({}),
            JobLane::Bulk,
            "cron:recoverLevelRequests",
        )
        .await?;
    }
    if schedule.rotate_weekly {
        enqueue(
            queue,
            TaskIdentifier::RotateTrackTournament,
            serde_json::json!({"type":0}),
            JobLane::Bulk,
            "cron:rotateTrackTournament:weekly",
        )
        .await?;
    }
    if schedule.rotate_monthly {
        enqueue(
            queue,
            TaskIdentifier::RotateTrackTournament,
            serde_json::json!({"type":1}),
            JobLane::Bulk,
            "cron:rotateTrackTournament:monthly",
        )
        .await?;
    }
    if schedule.workshop {
        enqueue(
            queue,
            TaskIdentifier::SyncWorkshopCatalog,
            serde_json::json!({}),
            JobLane::Bulk,
            "cron:syncWorkshopCatalog",
        )
        .await?;
    }
    if schedule.level_full {
        enqueue(
            queue,
            TaskIdentifier::UpdateLevelScores,
            serde_json::json!({"all":true}),
            JobLane::Bulk,
            "update-level-scores:full",
        )
        .await?;
    }
    if schedule.level_incremental {
        enqueue(
            queue,
            TaskIdentifier::UpdateLevelScores,
            serde_json::json!({"all":false}),
            JobLane::Bulk,
            "update-level-scores:incremental",
        )
        .await?;
    }
    if schedule.players {
        enqueue(
            queue,
            TaskIdentifier::UpdatePlayerScores,
            serde_json::json!({}),
            JobLane::Bulk,
            "update-player-scores",
        )
        .await?;
    }
    if schedule.level_history {
        enqueue(
            queue,
            TaskIdentifier::UpdateLevelPointsHistory,
            serde_json::json!({}),
            JobLane::Bulk,
            "cron:updateLevelPointsHistory",
        )
        .await?;
    }
    if schedule.user_history {
        enqueue(
            queue,
            TaskIdentifier::UpdateUserPointsHistory,
            serde_json::json!({}),
            JobLane::Bulk,
            "cron:updateUserPointsHistory",
        )
        .await?;
    }
    if schedule.prune {
        enqueue(
            queue,
            TaskIdentifier::PrunePointsHistory,
            serde_json::json!({}),
            JobLane::Bulk,
            "cron:prunePointsHistory",
        )
        .await?;
    }
    Ok(())
}

async fn enqueue(
    queue: &Queue,
    task: TaskIdentifier,
    payload: serde_json::Value,
    lane: JobLane,
    key: &str,
) -> Result<()> {
    queue.enqueue(task, payload, lane, Some(key)).await?;
    Ok(())
}
