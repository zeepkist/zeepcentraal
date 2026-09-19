use crate::{
    BULK_CONCURRENCY, FAST_CONCURRENCY, HEARTBEAT_SECONDS, POLL_MILLISECONDS, TaskIdentifier,
    queue::{ClaimedJob, JobLane, Queue},
};
use anyhow::{Result, anyhow};
use async_trait::async_trait;
use std::{sync::Arc, time::Duration};
use tokio::{sync::watch, task::JoinSet, time::MissedTickBehavior};

#[async_trait]
pub trait JobHandler: Send + Sync {
    async fn handle(&self, task: TaskIdentifier, payload: serde_json::Value) -> Result<()>;
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
        shutdown,
    ));
    let (fast, bulk) = tokio::try_join!(fast, bulk)?;
    fast?;
    bulk
}

async fn run_lane(
    queue: Queue,
    handler: Arc<dyn JobHandler>,
    lane: JobLane,
    concurrency: usize,
    mut shutdown: watch::Receiver<bool>,
) -> Result<()> {
    let mut active = JoinSet::new();
    loop {
        while active.len() < concurrency && !*shutdown.borrow() {
            let capacity = i32::try_from(concurrency - active.len())?;
            let claimed = queue.claim(lane, capacity).await?;
            if claimed.is_empty() {
                break;
            }
            for job in claimed {
                let queue = queue.clone();
                let handler = handler.clone();
                active.spawn(async move { execute(queue, handler, job).await });
            }
        }
        if *shutdown.borrow() {
            break;
        }
        tokio::select! {
            result = active.join_next(), if !active.is_empty() => {
                if let Some(result) = result {
                    result??;
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
        result??;
    }
    Ok(())
}

async fn execute(queue: Queue, handler: Arc<dyn JobHandler>, job: ClaimedJob) -> Result<()> {
    let task = TaskIdentifier::parse(&job.task).ok_or_else(|| anyhow!("invalid job task"));
    let result = match task {
        Ok(task) if task.validate_payload(&job.payload) => {
            let mut heartbeat = tokio::time::interval_at(
                tokio::time::Instant::now() + Duration::from_secs(HEARTBEAT_SECONDS),
                Duration::from_secs(HEARTBEAT_SECONDS),
            );
            heartbeat.set_missed_tick_behavior(MissedTickBehavior::Delay);
            let work = handler.handle(task, job.payload.clone());
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
    let failure = result.as_ref().err().map(|_| "handler_failed");
    if !queue.finish(&job, failure).await? {
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
