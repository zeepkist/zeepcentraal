use anyhow::{Context, Result, ensure};
use bb8::ErrorSink;
use diesel::{ConnectionError, sql_query, sql_types::Text};
use diesel_async::{
    AsyncConnection, AsyncPgConnection, RunQueryDsl,
    pooled_connection::{AsyncDieselConnectionManager, ManagerConfig, bb8::Pool},
};
use std::{
    fmt,
    ops::{Deref, DerefMut},
    sync::{
        Arc, Mutex,
        atomic::{AtomicU64, Ordering},
    },
    time::{Duration, Instant},
};
use tokio::sync::{OwnedSemaphorePermit, Semaphore};

type PgPool = Pool<AsyncPgConnection>;
type PgConnection =
    diesel_async::pooled_connection::bb8::PooledConnection<'static, AsyncPgConnection>;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PoolBudget {
    pub application: u32,
    pub queue: u32,
    pub scheduler: u32,
}

impl PoolBudget {
    pub const fn application(maximum: u32) -> Self {
        Self {
            application: maximum,
            queue: 0,
            scheduler: 0,
        }
    }

    fn total(self) -> Result<u32> {
        ensure!(
            self.application > 0,
            "application pool budget must be positive"
        );
        self.application
            .checked_add(self.queue)
            .and_then(|value| value.checked_add(self.scheduler))
            .context("database pool budget overflow")
    }
}

#[derive(Clone, Debug)]
pub struct PoolSettings {
    pub application_name: String,
    pub acquire_timeout: Duration,
    pub statement_timeout: Duration,
    pub lock_timeout: Duration,
    pub idle_transaction_timeout: Duration,
    pub idle_timeout: Duration,
}

impl PoolSettings {
    pub fn from_database_config(
        config: &zc_core::DatabaseConfig,
        application_name: impl Into<String>,
    ) -> Self {
        Self {
            application_name: application_name.into(),
            acquire_timeout: config.timeouts.connect,
            statement_timeout: config.timeouts.statement,
            lock_timeout: config.timeouts.lock,
            idle_transaction_timeout: config.timeouts.idle_transaction,
            idle_timeout: Duration::from_secs(30),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PoolSnapshot {
    pub physical_limit: u32,
    pub physical_connections: u32,
    pub idle_connections: u32,
    pub partition_limit: u32,
    pub partition_available: u32,
    pub waiting_acquisitions: u64,
    pub pending_gets: u64,
    pub connections_created: u64,
    pub connection_failures: u64,
    pub acquisition_timeouts: u64,
    pub last_connection_failure: Option<PoolFailureStage>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PoolFailureStage {
    ConnectionEstablishment,
    SessionSetup,
    Validation,
    CheckoutTimeout,
}

impl fmt::Display for PoolFailureStage {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::ConnectionEstablishment => "connection establishment",
            Self::SessionSetup => "session setup",
            Self::Validation => "connection validation",
            Self::CheckoutTimeout => "checkout timeout",
        })
    }
}

#[derive(Debug, thiserror::Error)]
#[error(
    "database {role} pool unavailable after {timeout_ms}ms (partition {partition_available}/{partition_limit} available, physical {physical_connections}/{physical_limit}, idle {idle_connections}, waiting {waiting_acquisitions}, pending {pending_gets}, created {connections_created}, connection failures {connection_failures}, acquisition timeouts {acquisition_timeouts}, last failure {failure_stage_label}){cause}"
)]
pub struct PoolAcquireError {
    pub role: &'static str,
    pub timeout_ms: u128,
    pub partition_limit: u32,
    pub partition_available: u32,
    pub physical_limit: u32,
    pub physical_connections: u32,
    pub idle_connections: u32,
    pub waiting_acquisitions: u64,
    pub pending_gets: u64,
    pub connections_created: u64,
    pub connection_failures: u64,
    pub acquisition_timeouts: u64,
    pub last_connection_failure: Option<PoolFailureStage>,
    failure_stage_label: FailureStage,
    cause: Cause,
}

#[derive(Debug)]
struct FailureStage(Option<PoolFailureStage>);

impl fmt::Display for FailureStage {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self.0 {
            Some(stage) => stage.fmt(formatter),
            None => formatter.write_str("none"),
        }
    }
}

#[derive(Debug)]
struct Cause(Option<String>);

impl fmt::Display for Cause {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match &self.0 {
            Some(cause) => write!(formatter, ": {cause}"),
            None => Ok(()),
        }
    }
}

#[derive(Clone)]
pub struct DatabasePool {
    physical_limit: u32,
    acquire_timeout: Duration,
    application: PoolPartition,
    queue: Option<PoolPartition>,
    scheduler: Option<PoolPartition>,
}

impl DatabasePool {
    pub async fn connect(
        database_url: &str,
        settings: PoolSettings,
        budget: PoolBudget,
    ) -> Result<Self> {
        let physical_limit = budget.total()?;
        let diagnostics = Arc::new(PoolDiagnostics::default());
        let manager = manager(database_url, &settings, diagnostics.clone());
        let pool = Pool::builder()
            .max_size(physical_limit)
            .min_idle(Some(1))
            .idle_timeout(Some(settings.idle_timeout))
            .connection_timeout(settings.acquire_timeout)
            .error_sink(Box::new(PoolErrorLogger {
                diagnostics: diagnostics.clone(),
            }))
            .build(manager)
            .await
            .map_err(|_| {
                PoolAcquireError::from_snapshot_with_stage(
                    "startup",
                    settings.acquire_timeout,
                    PoolSnapshot {
                        physical_limit,
                        physical_connections: 0,
                        idle_connections: 0,
                        partition_limit: physical_limit,
                        partition_available: physical_limit,
                        waiting_acquisitions: 0,
                        pending_gets: 0,
                        connections_created: 0,
                        connection_failures: diagnostics.failure_count(),
                        acquisition_timeouts: 0,
                        last_connection_failure: diagnostics.last_failure(),
                    },
                    None,
                    Some(PoolFailureStage::ConnectionEstablishment),
                )
            })?;
        let application = PoolPartition::new(
            pool.clone(),
            "application",
            budget.application,
            physical_limit,
            settings.acquire_timeout,
            diagnostics.clone(),
        );
        let queue = (budget.queue > 0).then(|| {
            PoolPartition::new(
                pool.clone(),
                "queue",
                budget.queue,
                physical_limit,
                settings.acquire_timeout,
                diagnostics.clone(),
            )
        });
        let scheduler = (budget.scheduler > 0).then(|| {
            PoolPartition::new(
                pool.clone(),
                "scheduler",
                budget.scheduler,
                physical_limit,
                settings.acquire_timeout,
                diagnostics,
            )
        });
        Ok(Self {
            physical_limit,
            acquire_timeout: settings.acquire_timeout,
            application,
            queue,
            scheduler,
        })
    }

    pub fn application(&self) -> PoolPartition {
        self.application.clone()
    }

    pub fn queue(&self) -> Result<PoolPartition> {
        self.queue
            .clone()
            .context("queue database pool partition is not configured")
    }

    pub fn scheduler(&self) -> Result<PoolPartition> {
        self.scheduler
            .clone()
            .context("scheduler database pool partition is not configured")
    }

    pub fn snapshot(&self) -> PoolSnapshot {
        self.application.snapshot()
    }

    pub fn physical_limit(&self) -> u32 {
        self.physical_limit
    }

    pub fn acquire_timeout(&self) -> Duration {
        self.acquire_timeout
    }
}

#[derive(Clone)]
pub struct PoolPartition {
    pool: PgPool,
    role: &'static str,
    limit: u32,
    physical_limit: u32,
    acquire_timeout: Duration,
    permits: Arc<Semaphore>,
    waiting: Arc<AtomicU64>,
    diagnostics: Arc<PoolDiagnostics>,
}

impl PoolPartition {
    fn new(
        pool: PgPool,
        role: &'static str,
        limit: u32,
        physical_limit: u32,
        acquire_timeout: Duration,
        diagnostics: Arc<PoolDiagnostics>,
    ) -> Self {
        Self {
            pool,
            role,
            limit,
            physical_limit,
            acquire_timeout,
            permits: Arc::new(Semaphore::new(limit as usize)),
            waiting: Arc::new(AtomicU64::new(0)),
            diagnostics,
        }
    }

    pub async fn connection(&self) -> Result<PoolConnection> {
        self.waiting.fetch_add(1, Ordering::Relaxed);
        let _waiting = WaitingGuard(self.waiting.clone());
        let deadline = tokio::time::Instant::now() + self.acquire_timeout;
        let permit = tokio::time::timeout_at(deadline, self.permits.clone().acquire_owned()).await;
        let permit = match permit {
            Ok(Ok(permit)) => permit,
            Ok(Err(_)) | Err(_) => {
                return Err(self
                    .acquire_error(None, Some(PoolFailureStage::CheckoutTimeout))
                    .into());
            }
        };
        let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
        let connection = tokio::time::timeout(remaining, self.pool.get_owned()).await;
        match connection {
            Ok(Ok(connection)) => Ok(PoolConnection {
                connection,
                _permit: permit,
            }),
            Ok(Err(error)) => {
                let cause = match error {
                    bb8::RunError::TimedOut => "bb8 checkout timed out",
                    bb8::RunError::User(_) => "bb8 checkout failed",
                };
                Err(self
                    .acquire_error(
                        Some(cause.to_owned()),
                        Some(PoolFailureStage::CheckoutTimeout),
                    )
                    .into())
            }
            Err(_) => Err(self
                .acquire_error(None, Some(PoolFailureStage::CheckoutTimeout))
                .into()),
        }
    }

    pub async fn warm(&self, count: u32) -> Result<()> {
        validate_warm_count(self.role, self.limit, count)?;
        let mut connections = Vec::with_capacity(count as usize);
        for _ in 0..count {
            connections.push(self.connection().await?);
        }
        drop(connections);
        Ok(())
    }

    pub const fn limit(&self) -> u32 {
        self.limit
    }

    pub fn snapshot(&self) -> PoolSnapshot {
        let state = self.pool.state();
        PoolSnapshot {
            physical_limit: self.physical_limit,
            physical_connections: state.connections,
            idle_connections: state.idle_connections,
            partition_limit: self.limit,
            partition_available: u32::try_from(self.permits.available_permits())
                .unwrap_or(u32::MAX),
            waiting_acquisitions: self.waiting.as_ref().load(Ordering::Relaxed),
            pending_gets: state.statistics.pending_gets(),
            connections_created: state.statistics.connections_created,
            connection_failures: self.diagnostics.failure_count(),
            acquisition_timeouts: state.statistics.get_timed_out,
            last_connection_failure: self.diagnostics.last_failure(),
        }
    }

    fn acquire_error(
        &self,
        cause: Option<String>,
        fallback_stage: Option<PoolFailureStage>,
    ) -> PoolAcquireError {
        let snapshot = self.snapshot();
        PoolAcquireError::from_snapshot_with_stage(
            self.role,
            self.acquire_timeout,
            snapshot,
            cause,
            fallback_stage,
        )
    }
}

impl PoolAcquireError {
    pub fn from_snapshot(
        role: &'static str,
        timeout: Duration,
        snapshot: PoolSnapshot,
        cause: Option<String>,
    ) -> Self {
        Self::from_snapshot_with_stage(role, timeout, snapshot, cause, None)
    }

    fn from_snapshot_with_stage(
        role: &'static str,
        timeout: Duration,
        snapshot: PoolSnapshot,
        cause: Option<String>,
        fallback_stage: Option<PoolFailureStage>,
    ) -> Self {
        Self {
            role,
            timeout_ms: timeout.as_millis(),
            partition_limit: snapshot.partition_limit,
            partition_available: snapshot.partition_available,
            physical_limit: snapshot.physical_limit,
            physical_connections: snapshot.physical_connections,
            idle_connections: snapshot.idle_connections,
            waiting_acquisitions: snapshot.waiting_acquisitions,
            pending_gets: snapshot.pending_gets,
            connections_created: snapshot.connections_created,
            connection_failures: snapshot.connection_failures,
            acquisition_timeouts: snapshot.acquisition_timeouts,
            last_connection_failure: snapshot.last_connection_failure.or(fallback_stage),
            failure_stage_label: FailureStage(snapshot.last_connection_failure.or(fallback_stage)),
            cause: Cause(cause),
        }
    }
}

struct WaitingGuard(Arc<AtomicU64>);

impl Drop for WaitingGuard {
    fn drop(&mut self) {
        self.0.fetch_sub(1, Ordering::Relaxed);
    }
}

pub struct PoolConnection {
    connection: PgConnection,
    _permit: OwnedSemaphorePermit,
}

impl Deref for PoolConnection {
    type Target = AsyncPgConnection;

    fn deref(&self) -> &Self::Target {
        &self.connection
    }
}

impl DerefMut for PoolConnection {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.connection
    }
}

#[derive(Debug)]
struct PoolErrorLogger {
    diagnostics: Arc<PoolDiagnostics>,
}

impl ErrorSink<diesel_async::pooled_connection::PoolError> for PoolErrorLogger {
    fn sink(&self, error: diesel_async::pooled_connection::PoolError) {
        let _ = error;
        if self.diagnostics.last_failure().is_none() {
            self.diagnostics
                .record_failure(PoolFailureStage::Validation);
        }
        if self.diagnostics.should_warn() {
            tracing::warn!(
                stage = %FailureStage(self.diagnostics.last_failure()),
                failures = self.diagnostics.failure_count(),
                "PostgreSQL connection creation failed"
            );
        }
    }

    fn boxed_clone(&self) -> Box<dyn ErrorSink<diesel_async::pooled_connection::PoolError>> {
        Box::new(Self {
            diagnostics: self.diagnostics.clone(),
        })
    }
}

#[derive(Debug, Default)]
struct PoolDiagnostics {
    failures: AtomicU64,
    last_failure: Mutex<Option<PoolFailureStage>>,
    last_warning: Mutex<Option<Instant>>,
}

impl PoolDiagnostics {
    fn record_failure(&self, stage: PoolFailureStage) {
        self.failures.fetch_add(1, Ordering::Relaxed);
        *self
            .last_failure
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner) = Some(stage);
    }

    fn last_failure(&self) -> Option<PoolFailureStage> {
        *self
            .last_failure
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
    }

    fn failure_count(&self) -> u64 {
        AtomicU64::load(&self.failures, Ordering::Relaxed)
    }

    fn should_warn(&self) -> bool {
        self.should_warn_at(Instant::now())
    }

    fn should_warn_at(&self, now: Instant) -> bool {
        let mut last_warning = self
            .last_warning
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        if last_warning.is_some_and(|last| now.duration_since(last) < Duration::from_secs(30)) {
            return false;
        }
        *last_warning = Some(now);
        true
    }
}

fn manager(
    database_url: &str,
    settings: &PoolSettings,
    diagnostics: Arc<PoolDiagnostics>,
) -> AsyncDieselConnectionManager<AsyncPgConnection> {
    let application_name = settings.application_name.clone();
    let statement_timeout = milliseconds(settings.statement_timeout);
    let lock_timeout = milliseconds(settings.lock_timeout);
    let idle_transaction_timeout = milliseconds(settings.idle_transaction_timeout);
    let setup_timeout = settings.acquire_timeout;
    let setup_gate = Arc::new(Semaphore::new(1));
    let mut config = ManagerConfig::default();
    config.custom_setup = Box::new(move |database_url| {
        let database_url = database_url.to_owned();
        let application_name = application_name.clone();
        let statement_timeout = statement_timeout.clone();
        let lock_timeout = lock_timeout.clone();
        let idle_transaction_timeout = idle_transaction_timeout.clone();
        let setup_gate = setup_gate.clone();
        let diagnostics = diagnostics.clone();
        Box::pin(async move {
            let setup = async {
                let _setup_permit = setup_gate.acquire().await.map_err(|_| {
                    ConnectionError::BadConnection("connection setup closed".into())
                })?;
                let mut connection = match AsyncPgConnection::establish(&database_url).await {
                    Ok(connection) => connection,
                    Err(error) => {
                        diagnostics.record_failure(PoolFailureStage::ConnectionEstablishment);
                        return Err(error);
                    }
                };
                if sql_query(
                    "SELECT set_config('application_name',$1,false), \
                     set_config('statement_timeout',$2,false), \
                     set_config('lock_timeout',$3,false), \
                     set_config('idle_in_transaction_session_timeout',$4,false)",
                )
                .bind::<Text, _>(application_name)
                .bind::<Text, _>(statement_timeout)
                .bind::<Text, _>(lock_timeout)
                .bind::<Text, _>(idle_transaction_timeout)
                .execute(&mut connection)
                .await
                .is_err()
                {
                    diagnostics.record_failure(PoolFailureStage::SessionSetup);
                    return Err(ConnectionError::BadConnection(
                        "database session setup failed".to_owned(),
                    ));
                }
                Ok(connection)
            };
            match tokio::time::timeout(setup_timeout, setup).await {
                Ok(result) => result,
                Err(_) => {
                    diagnostics.record_failure(PoolFailureStage::ConnectionEstablishment);
                    Err(ConnectionError::BadConnection(format!(
                        "database connection setup timed out after {}ms",
                        setup_timeout.as_millis()
                    )))
                }
            }
        })
    });
    AsyncDieselConnectionManager::new_with_config(database_url, config)
}

fn milliseconds(duration: Duration) -> String {
    format!("{}ms", duration.as_millis())
}

fn validate_warm_count(role: &str, limit: u32, count: u32) -> Result<()> {
    ensure!(
        count <= limit,
        "cannot warm {count} {role} connections above partition limit {limit}"
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn budget_total_includes_reserved_partitions() {
        assert_eq!(
            PoolBudget {
                application: 5,
                queue: 2,
                scheduler: 1,
            }
            .total()
            .unwrap(),
            8
        );
        assert!(PoolBudget::application(0).total().is_err());
    }

    #[test]
    fn durations_are_postgresql_milliseconds() {
        assert_eq!(milliseconds(Duration::from_millis(15_000)), "15000ms");
    }

    #[test]
    fn warm_count_cannot_exceed_partition_limit() {
        assert!(validate_warm_count("queue", 2, 2).is_ok());
        assert_eq!(
            validate_warm_count("queue", 2, 3).unwrap_err().to_string(),
            "cannot warm 3 queue connections above partition limit 2"
        );
    }

    #[test]
    fn diagnostics_track_safe_failure_stage() {
        let diagnostics = PoolDiagnostics::default();
        diagnostics.record_failure(PoolFailureStage::SessionSetup);
        assert_eq!(diagnostics.failure_count(), 1);
        assert_eq!(
            diagnostics.last_failure(),
            Some(PoolFailureStage::SessionSetup)
        );
        let now = Instant::now();
        assert!(diagnostics.should_warn_at(now));
        assert!(!diagnostics.should_warn_at(now + Duration::from_secs(29)));
        assert!(diagnostics.should_warn_at(now + Duration::from_secs(30)));
    }
}
