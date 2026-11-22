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
    #[diesel(sql_type = Text)]
    metrics_slot: String,
    #[diesel(sql_type = Bool)]
    recover: bool,
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
        let lock: LockRow = sql_query(include_str!("queries/cron/try_leader_lock.sql"))
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
    // Queue acquisition can fail while this dedicated connection stays healthy.
    // Release leadership before returning it to the shared physical pool on errors too.
    let result = run_leader(&mut connection, queue, shutdown).await;
    sql_query(include_str!("queries/cron/release_leader_lock.sql"))
        .bind::<diesel::sql_types::Integer, _>(SCHEDULER_LOCK_NAMESPACE)
        .execute(&mut connection)
        .await?;
    result
}

async fn run_leader(
    connection: &mut zc_database::PoolConnection,
    queue: &Queue,
    shutdown: &mut watch::Receiver<bool>,
) -> Result<()> {
    let mut last_minute = String::new();
    let mut last_metrics_slot = String::new();
    loop {
        if *shutdown.borrow() {
            break;
        }
        let schedule: ScheduleRow = sql_query(include_str!("queries/cron/claim_due_schedule.sql"))
            .get_result(&mut **connection)
            .await?;
        if schedule.metrics_slot != last_metrics_slot {
            enqueue(
                queue,
                TaskIdentifier::RefreshGlobalMetrics,
                serde_json::json!({}),
                JobLane::Fast,
                "refresh-global-metrics",
            )
            .await?;
            last_metrics_slot = schedule.metrics_slot.clone();
        }
        if schedule.minute_key != last_minute {
            for revision in zc_database::Database::pending_zsl_playlists(connection).await? {
                enqueue(
                    queue,
                    TaskIdentifier::PrepareZslPlaylistRevision,
                    serde_json::json!({"revision":revision}),
                    JobLane::Bulk,
                    &format!("zsl-playlist-revision:{revision}"),
                )
                .await?;
            }
            for alert in zc_database::Database::zsl_readiness_alerts(connection).await? {
                tracing::warn!(round_id = alert.round_id, timeslot = alert.timeslot,
                    starts_at = %alert.starts_at, hours = alert.hours, "ZSL playlists need attention before start");
            }
            enqueue_due(queue, &schedule).await?;
            last_minute = schedule.minute_key;
        }
        tokio::select! {
            result = shutdown.changed() => { if result.is_err() || *shutdown.borrow() { break; } }
            _ = tokio::time::sleep(Duration::from_secs(5)) => {}
        }
    }
    Ok(())
}

async fn enqueue_due(queue: &Queue, schedule: &ScheduleRow) -> Result<()> {
    enqueue(
        queue,
        TaskIdentifier::RefreshMedals,
        serde_json::json!({}),
        JobLane::Bulk,
        "cron:refreshMedals",
    )
    .await?;
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
    // Reconcile on startup and each minute. Stable keys coalesce replicas/retries.
    for (kind, key) in [
        (0, "cron:rotateTrackTournament:weekly"),
        (1, "cron:rotateTrackTournament:monthly"),
        (2, "cron:rotateTrackTournament:daily"),
    ] {
        enqueue(
            queue,
            TaskIdentifier::RotateTrackTournament,
            serde_json::json!({"type":kind}),
            JobLane::Bulk,
            key,
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
