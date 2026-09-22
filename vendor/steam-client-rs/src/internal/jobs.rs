//! Job-based response system for request/response correlation.
//!
//! This module provides job tracking for Steam protocol messages that require
//! response correlation, such as service method calls.

use std::{
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};

use rustc_hash::FxHashMap;

use bytes::Bytes;
use tokio::sync::oneshot;
use tracing::{debug, warn};

use crate::utils::clock::{Clock, SystemClock};

/// Response from a completed job.
#[derive(Debug)]
pub enum JobResponse {
    /// Successful response with raw protobuf body (zero-copy).
    Success(Bytes),
    /// Job timed out.
    Timeout,
    /// Job failed with an error.
    Error(String),
}

/// A pending job awaiting response.
pub struct PendingJob {
    /// The job ID.
    pub job_id: u64,
    /// When the job was created.
    pub created_at: Instant,
    /// Timeout duration for this job.
    pub timeout: Duration,
    /// Channel to send the response.
    pub response_tx: oneshot::Sender<JobResponse>,
}

/// Job manager for tracking pending requests.
#[derive(Clone)]
pub struct JobManager {
    inner: Arc<JobManagerInner>,
}

struct JobManagerInner {
    /// Counter for generating job IDs.
    current_job_id: AtomicU64,
    /// Pending jobs awaiting responses.
    pending_jobs: Mutex<FxHashMap<u64, PendingJob>>,
    /// Default timeout for jobs.
    default_timeout: Duration,
    /// Clock for time operations.
    clock: Arc<dyn Clock>,
}

impl JobManager {
    /// Create a new job manager.
    pub fn new() -> Self {
        Self::with_timeout(Duration::from_secs(30))
    }

    /// Create a new job manager with a custom default timeout.
    pub fn with_timeout(default_timeout: Duration) -> Self {
        Self::with_clock(default_timeout, Arc::new(SystemClock))
    }

    /// Create a new job manager with a custom clock.
    ///
    /// This is primarily useful for testing, allowing mock clocks to be
    /// injected.
    pub fn with_clock(default_timeout: Duration, clock: Arc<dyn Clock>) -> Self {
        Self {
            inner: Arc::new(JobManagerInner { current_job_id: AtomicU64::new(1), pending_jobs: Mutex::new(FxHashMap::default()), default_timeout, clock }),
        }
    }

    /// Create a new job and return the job ID and response receiver.
    ///
    /// The job ID should be used in the request message's `jobid_source` field.
    /// The response receiver will receive the response when it arrives.
    pub async fn create_job(&self) -> (u64, oneshot::Receiver<JobResponse>) {
        self.create_job_with_timeout(self.inner.default_timeout).await
    }

    /// Create a new job with a custom timeout.
    pub async fn create_job_with_timeout(&self, timeout: Duration) -> (u64, oneshot::Receiver<JobResponse>) {
        let mut job_id = self.inner.current_job_id.fetch_add(1, Ordering::Relaxed);
        // Avoid using u64::MAX as it typically represents JOBID_NONE
        if job_id == u64::MAX {
            job_id = self.inner.current_job_id.fetch_add(1, Ordering::Relaxed);
        }
        let (tx, rx) = oneshot::channel();

        let job = PendingJob { job_id, created_at: self.inner.clock.now(), timeout, response_tx: tx };

        self.inner.pending_jobs.lock().expect("mutex poisoned").insert(job_id, job);
        debug!("Created job {} with timeout {:?}", job_id, timeout);

        (job_id, rx)
    }

    /// Complete a job with a response.
    ///
    /// Returns `true` if the job was found and completed, `false` otherwise.
    pub async fn complete_job(&self, job_id: u64, response: JobResponse) -> bool {
        if let Some(job) = self.inner.pending_jobs.lock().expect("mutex poisoned").remove(&job_id) {
            debug!("Completing job {}", job_id);
            // Ignore send error - receiver may have been dropped
            let _ = job.response_tx.send(response);
            true
        } else {
            warn!("Job {} not found for completion", job_id);
            false
        }
    }

    /// Complete a job with success response.
    pub async fn complete_job_success(&self, job_id: u64, body: Bytes) -> bool {
        self.complete_job(job_id, JobResponse::Success(body)).await
    }

    /// Complete a job with error response.
    pub async fn complete_job_error(&self, job_id: u64, error: String) -> bool {
        self.complete_job(job_id, JobResponse::Error(error)).await
    }

    /// Try to complete a job with success response without blocking.
    ///
    /// This is a non-blocking version that uses `try_lock`. Returns `true` if
    /// the job was found and completed, `false` if the job wasn't found or
    /// the lock couldn't be acquired.
    ///
    /// Useful in poll-based contexts where async isn't available.
    pub fn try_complete_job_success(&self, job_id: u64, body: Bytes) -> bool {
        if let Ok(mut pending) = self.inner.pending_jobs.try_lock() {
            if let Some(job) = pending.remove(&job_id) {
                debug!("Completing job {} (non-blocking)", job_id);
                let _ = job.response_tx.send(JobResponse::Success(body));
                return true;
            }
        }
        false
    }

    /// Clean up expired jobs.
    ///
    /// This should be called periodically to avoid memory leaks from
    /// jobs that never receive a response.
    pub async fn cleanup_expired(&self) {
        let now = self.inner.clock.now();
        let mut pending = self.inner.pending_jobs.lock().expect("mutex poisoned");
        let expired_ids: Vec<u64> = pending.iter().filter(|(_, job)| now.duration_since(job.created_at) > job.timeout).map(|(id, _)| *id).collect();

        for job_id in expired_ids {
            if let Some(job) = pending.remove(&job_id) {
                debug!("Job {} expired after {:?}", job_id, job.timeout);
                let _ = job.response_tx.send(JobResponse::Timeout);
            }
        }
    }

    /// Get the number of pending jobs.
    pub async fn pending_count(&self) -> usize {
        self.inner.pending_jobs.lock().expect("mutex poisoned").len()
    }

    /// Check if a job ID is pending.
    pub async fn is_pending(&self, job_id: u64) -> bool {
        self.inner.pending_jobs.lock().expect("mutex poisoned").contains_key(&job_id)
    }

    /// Start a background task to periodically clean up expired jobs.
    pub fn start_cleanup_task(self, interval: Duration) -> tokio::task::JoinHandle<()> {
        let clock = self.inner.clock.clone();
        tokio::spawn(async move {
            loop {
                clock.sleep(interval).await;
                self.cleanup_expired().await;
            }
        })
    }
}

impl Default for JobManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_create_and_complete_job() -> Result<(), Box<dyn std::error::Error>> {
        let manager = JobManager::new();
        let (job_id, rx) = manager.create_job().await;

        assert!(job_id > 0);
        assert!(manager.is_pending(job_id).await);

        let result = manager.complete_job_success(job_id, Bytes::from(vec![1u8, 2, 3])).await;
        assert!(result);
        assert!(!manager.is_pending(job_id).await);

        match rx.await.map_err(|e| std::io::Error::other(e.to_string()))? {
            JobResponse::Success(data) => assert_eq!(&data[..], &[1u8, 2, 3]),
            _ => panic!("Expected success response"),
        }
        Ok(())
    }

    #[tokio::test]
    async fn test_job_timeout() -> Result<(), Box<dyn std::error::Error>> {
        let manager = JobManager::with_timeout(Duration::from_millis(50));
        let (job_id, rx) = manager.create_job().await;

        tokio::time::sleep(Duration::from_millis(100)).await;
        manager.cleanup_expired().await;

        assert!(!manager.is_pending(job_id).await);

        match rx.await.map_err(|e| std::io::Error::other(e.to_string()))? {
            JobResponse::Timeout => {}
            _ => panic!("Expected timeout response"),
        }
        Ok(())
    }

    #[tokio::test]
    async fn test_complete_nonexistent_job() {
        let manager = JobManager::new();
        let result = manager.complete_job_success(99999, Bytes::new()).await;
        assert!(!result);
    }
}
