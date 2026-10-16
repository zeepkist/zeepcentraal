use crate::{
    BULK_CONCURRENCY, FAST_CONCURRENCY, HEARTBEAT_SECONDS, POLL_MILLISECONDS, TaskIdentifier,
    queue::{ClaimedJob, JobLane, Queue},
    retry::{RetryBackoff, is_unavailable, wait_or_shutdown},
};
use anyhow::{Result, anyhow};
use async_trait::async_trait;
use std::{sync::Arc, time::Duration};
use tokio::{
    sync::watch,
    task::{JoinError, JoinHandle, JoinSet},
    time::MissedTickBehavior,
};

#[async_trait]
pub trait JobHandler: Send + Sync {
    async fn handle_claimed(&self, job: &ClaimedJob, lane: JobLane) -> Result<JobOutcome> {
        let task = TaskIdentifier::parse(&job.task).ok_or_else(|| anyhow!("invalid job task"))?;
        self.handle(task, job.payload.clone(), lane, job.attempts)
            .await
    }
    async fn handle(
        &self,
        task: TaskIdentifier,
        payload: serde_json::Value,
        lane: JobLane,
        attempts: i32,
    ) -> Result<JobOutcome>;
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum JobOutcome {
    Completed,
    Deferred,
}

pub async fn run(
    queue: Queue,
    handler: Arc<dyn JobHandler>,
    shutdown: watch::Receiver<bool>,
) -> Result<()> {
    let fast = tokio::spawn(run_lane(
        queue.clone(),
        handler.clone(),
        JobLane::Fast,
        FAST_CONCURRENCY,
        shutdown.clone(),
    ));
    let bulk = tokio::spawn(run_lane(
        queue,
        handler,
        JobLane::Bulk,
        BULK_CONCURRENCY,
        shutdown.clone(),
    ));
    supervise_lanes(fast, bulk, shutdown).await
}

async fn supervise_lanes(
    mut fast: JoinHandle<Result<()>>,
    mut bulk: JoinHandle<Result<()>>,
    shutdown: watch::Receiver<bool>,
) -> Result<()> {
    let (lane, result, sibling_lane, sibling) = tokio::select! {
        result = &mut fast => (JobLane::Fast, result, JobLane::Bulk, &mut bulk),
        result = &mut bulk => (JobLane::Bulk, result, JobLane::Fast, &mut fast),
    };
    let result = lane_exit(lane, result, *shutdown.borrow());
    match result {
        Ok(()) => {
            let result = sibling.await;
            lane_exit(sibling_lane, result, *shutdown.borrow())
        }
        Err(error) => {
            sibling.abort();
            let _ = sibling.await;
            Err(error)
        }
    }
}

fn lane_exit(
    lane: JobLane,
    result: std::result::Result<Result<()>, JoinError>,
    shutdown_requested: bool,
) -> Result<()> {
    let result = result
        .map_err(anyhow::Error::from)
        .and_then(|result| result);
    let result = result.and_then(|()| {
        if shutdown_requested {
            Ok(())
        } else {
            Err(anyhow!("jobs lane exited without shutdown"))
        }
    });
    result.map_err(|error| {
        tracing::error!(
            lane = lane.as_str(),
            error = %format!("{error:#}"),
            "Jobs lane failed"
        );
        error.context(format!("{} jobs lane failed", lane.as_str()))
    })
}

async fn run_lane(
    queue: Queue,
    handler: Arc<dyn JobHandler>,
    lane: JobLane,
    concurrency: usize,
    mut shutdown: watch::Receiver<bool>,
) -> Result<()> {
    let mut active = JoinSet::new();
    let mut retry = RetryBackoff::new();
    'runtime: loop {
        while active.len() < concurrency && !*shutdown.borrow() {
            let capacity = i32::try_from(concurrency - active.len())?;
            let claimed = match queue.claim(lane, capacity).await {
                Ok(claimed) => {
                    retry.reset();
                    claimed
                }
                Err(error) if is_unavailable(&error) => {
                    let decision = retry.failure();
                    if decision.warn {
                        tracing::warn!(
                            lane = lane.as_str(),
                            retry_ms = decision.delay.as_millis(),
                            "Jobs queue unavailable; claim will retry"
                        );
                    }
                    if wait_or_shutdown(decision.delay, &mut shutdown).await {
                        break 'runtime;
                    }
                    continue 'runtime;
                }
                Err(error) => return Err(error),
            };
            if claimed.is_empty() {
                break;
            }
            for job in claimed {
                let queue = queue.clone();
                let handler = handler.clone();
                active.spawn(async move {
                    zc_telemetry::observe_operation(
                        "jobs.execute",
                        execute(queue, handler, job, lane),
                    )
                    .await
                });
            }
        }
        if *shutdown.borrow() {
            break;
        }
        tokio::select! {
            result = active.join_next(), if !active.is_empty() => {
                if let Some(result) = result {
                    match result? {
                        Ok(()) => retry.reset(),
                        Err(error) if is_unavailable(&error) => {
                            let decision = retry.failure();
                            if decision.warn {
                                tracing::warn!(
                                    lane = lane.as_str(),
                                    retry_ms = decision.delay.as_millis(),
                                    "Jobs database unavailable; lease will expire and worker will retry"
                                );
                            }
                            if wait_or_shutdown(decision.delay, &mut shutdown).await {
                                break 'runtime;
                            }
                        }
                        Err(error) => return Err(error),
                    }
                }
            }
            changed = shutdown.changed() => {
                if changed.is_err() || *shutdown.borrow() {
                    break;
                }
            }
            _ = tokio::time::sleep(Duration::from_millis(POLL_MILLISECONDS)) => {}
        }
    }
    while let Some(result) = active.join_next().await {
        match result? {
            Ok(()) => {}
            Err(error) if is_unavailable(&error) => {
                tracing::warn!(
                    lane = lane.as_str(),
                    "Jobs database unavailable during shutdown; lease will expire"
                );
            }
            Err(error) => return Err(error),
        }
    }
    Ok(())
}

async fn execute(
    queue: Queue,
    handler: Arc<dyn JobHandler>,
    job: ClaimedJob,
    lane: JobLane,
) -> Result<()> {
    let task = TaskIdentifier::parse(&job.task).ok_or_else(|| anyhow!("invalid job task"));
    let result = match task {
        Ok(task) if task.validate_payload(&job.payload) => {
            let mut heartbeat = tokio::time::interval_at(
                tokio::time::Instant::now() + Duration::from_secs(HEARTBEAT_SECONDS),
                Duration::from_secs(HEARTBEAT_SECONDS),
            );
            heartbeat.set_missed_tick_behavior(MissedTickBehavior::Delay);
            let work = handler.handle_claimed(&job, lane);
            tokio::pin!(work);
            loop {
                tokio::select! {
                    result = &mut work => break result,
                    _ = heartbeat.tick() => {
                        if !queue.heartbeat(&job).await? {
                            return Err(anyhow!("job lease lost for {}", job.id));
                        }
                    }
                }
            }
        }
        _ => Err(anyhow!("invalid job payload")),
    };
    let acknowledged = match result.as_ref() {
        Ok(JobOutcome::Deferred) => queue.defer(&job).await?,
        _ => {
            queue
                .finish(&job, result.as_ref().err().map(|_| "handler_failed"))
                .await?
        }
    };
    if !acknowledged {
        return Err(anyhow!(
            "job lease expired before acknowledgement {}",
            job.id
        ));
    }
    if let Err(error) = result {
        tracing::warn!(
            lane = %job.lane,
            job_id = %job.id,
            task = %job.task,
            attempt = job.attempts,
            max_attempts = job.max_attempts,
            error = %error,
            "Job attempt failed"
        );
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::future::pending;
    use tokio::sync::oneshot;

    struct SignalOnDrop(Option<oneshot::Sender<()>>);

    impl Drop for SignalOnDrop {
        fn drop(&mut self) {
            if let Some(sender) = self.0.take() {
                let _ = sender.send(());
            }
        }
    }

    async fn assert_failed_lane_stops_sibling(lane: JobLane, panics: bool) {
        let (_shutdown_tx, shutdown) = watch::channel(false);
        let (started_tx, started) = oneshot::channel();
        let (dropped_tx, mut dropped) = oneshot::channel();
        let sibling = tokio::spawn(async move {
            let _guard = SignalOnDrop(Some(dropped_tx));
            started_tx.send(()).unwrap();
            pending::<Result<()>>().await
        });
        started.await.unwrap();
        let failed = tokio::spawn(async move {
            assert!(!panics, "test lane panic");
            Err(anyhow!("test lane failure"))
        });
        let (fast, bulk) = match lane {
            JobLane::Fast => (failed, sibling),
            JobLane::Bulk => (sibling, failed),
        };
        let error = tokio::time::timeout(
            Duration::from_secs(2),
            supervise_lanes(fast, bulk, shutdown),
        )
        .await
        .expect("lane failure must propagate without waiting for sibling")
        .unwrap_err();
        let message = format!("{error:#}");
        assert!(message.contains(&format!("{} jobs lane failed", lane.as_str())));
        assert!(message.contains(if panics {
            "test lane panic"
        } else {
            "test lane failure"
        }));
        assert_eq!(
            dropped.try_recv(),
            Ok(()),
            "sibling must stop before return"
        );
    }

    #[tokio::test]
    async fn bulk_failure_stops_fast_lane() {
        assert_failed_lane_stops_sibling(JobLane::Bulk, false).await;
    }

    #[tokio::test]
    async fn fast_failure_stops_bulk_lane() {
        assert_failed_lane_stops_sibling(JobLane::Fast, false).await;
    }

    #[tokio::test]
    async fn lane_panic_stops_sibling() {
        assert_failed_lane_stops_sibling(JobLane::Bulk, true).await;
        assert_failed_lane_stops_sibling(JobLane::Fast, true).await;
    }

    #[tokio::test]
    async fn unexpected_success_stops_sibling() {
        let (_shutdown_tx, shutdown) = watch::channel(false);
        let (dropped_tx, mut dropped) = oneshot::channel();
        let (started_tx, started) = oneshot::channel();
        let bulk = tokio::spawn(async move {
            let _guard = SignalOnDrop(Some(dropped_tx));
            started_tx.send(()).unwrap();
            pending::<Result<()>>().await
        });
        started.await.unwrap();
        let fast = tokio::spawn(async { Ok(()) });
        let error = tokio::time::timeout(
            Duration::from_secs(2),
            supervise_lanes(fast, bulk, shutdown),
        )
        .await
        .unwrap()
        .unwrap_err();
        assert!(format!("{error:#}").contains("jobs lane exited without shutdown"));
        assert_eq!(dropped.try_recv(), Ok(()));
    }

    #[tokio::test]
    async fn requested_shutdown_drains_both_lanes() {
        let (shutdown_tx, shutdown) = watch::channel(false);
        let (fast_release, fast_work) = oneshot::channel();
        let (bulk_release, bulk_work) = oneshot::channel();
        let (fast_drained_tx, fast_drained) = oneshot::channel();
        let (bulk_drained_tx, mut bulk_drained) = oneshot::channel();
        let mut fast_shutdown = shutdown.clone();
        let mut bulk_shutdown = shutdown.clone();
        let fast = tokio::spawn(async move {
            fast_shutdown.changed().await?;
            fast_work.await?;
            fast_drained_tx.send(()).unwrap();
            Ok(())
        });
        let bulk = tokio::spawn(async move {
            bulk_shutdown.changed().await?;
            bulk_work.await?;
            bulk_drained_tx.send(()).unwrap();
            Ok(())
        });
        let supervisor = tokio::spawn(supervise_lanes(fast, bulk, shutdown));
        shutdown_tx.send(true).unwrap();
        fast_release.send(()).unwrap();
        tokio::time::timeout(Duration::from_secs(2), fast_drained)
            .await
            .unwrap()
            .unwrap();
        assert!(
            !supervisor.is_finished(),
            "bulk work must finish before exit"
        );
        bulk_release.send(()).unwrap();
        tokio::time::timeout(Duration::from_secs(2), supervisor)
            .await
            .unwrap()
            .unwrap()
            .unwrap();
        assert_eq!(bulk_drained.try_recv(), Ok(()));
    }

    #[tokio::test]
    async fn draining_lane_failure_propagates() {
        let (_shutdown_tx, shutdown) = watch::channel(true);
        let fast = tokio::spawn(async { Ok(()) });
        let bulk = tokio::spawn(async { Err(anyhow!("drain failed")) });
        let error = tokio::time::timeout(
            Duration::from_secs(2),
            supervise_lanes(fast, bulk, shutdown),
        )
        .await
        .unwrap()
        .unwrap_err();
        assert!(format!("{error:#}").contains("drain failed"));
    }
}
