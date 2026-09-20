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
        Arc,
        atomic::{AtomicU64, Ordering},
    },
    time::Duration,
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
}

#[derive(Debug, thiserror::Error)]
#[error(
    "database {role} pool unavailable after {timeout_ms}ms (partition {partition_available}/{partition_limit} available, physical {physical_connections}/{physical_limit}, idle {idle_connections}, waiting {waiting_acquisitions}){cause}"
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
    cause: Cause,
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
        let manager = manager(database_url, &settings);
        let pool = Pool::builder()
            .max_size(physical_limit)
            .min_idle(Some(1))
            .idle_timeout(Some(settings.idle_timeout))
            .connection_timeout(settings.acquire_timeout)
            .error_sink(Box::new(PoolErrorLogger))
            .build(manager)
            .await
            .context("failed to initialize database connection pool")?;
        let application = PoolPartition::new(
            pool.clone(),
            "application",
            budget.application,
            physical_limit,
            settings.acquire_timeout,
        );
        let queue = (budget.queue > 0).then(|| {
            PoolPartition::new(
                pool.clone(),
                "queue",
                budget.queue,
                physical_limit,
                settings.acquire_timeout,
            )
        });
        let scheduler = (budget.scheduler > 0).then(|| {
            PoolPartition::new(
                pool.clone(),
                "scheduler",
                budget.scheduler,
                physical_limit,
                settings.acquire_timeout,
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
}

impl PoolPartition {
    fn new(
        pool: PgPool,
        role: &'static str,
        limit: u32,
        physical_limit: u32,
        acquire_timeout: Duration,
    ) -> Self {
        Self {
            pool,
            role,
            limit,
            physical_limit,
            acquire_timeout,
            permits: Arc::new(Semaphore::new(limit as usize)),
            waiting: Arc::new(AtomicU64::new(0)),
        }
    }

    pub async fn connection(&self) -> Result<PoolConnection> {
        self.waiting.fetch_add(1, Ordering::Relaxed);
        let _waiting = WaitingGuard(self.waiting.clone());
        let deadline = tokio::time::Instant::now() + self.acquire_timeout;
        let permit = tokio::time::timeout_at(deadline, self.permits.clone().acquire_owned()).await;
        let permit = match permit {
            Ok(Ok(permit)) => permit,
            Ok(Err(_)) | Err(_) => return Err(self.acquire_error(None).into()),
        };
        let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
        let connection = tokio::time::timeout(remaining, self.pool.get_owned()).await;
        match connection {
            Ok(Ok(connection)) => Ok(PoolConnection {
                connection,
                _permit: permit,
            }),
            Ok(Err(error)) => Err(self.acquire_error(Some(error.to_string())).into()),
            Err(_) => Err(self.acquire_error(None).into()),
        }
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
        }
    }

    fn acquire_error(&self, cause: Option<String>) -> PoolAcquireError {
        let snapshot = self.snapshot();
        PoolAcquireError::from_snapshot(self.role, self.acquire_timeout, snapshot, cause)
    }
}

impl PoolAcquireError {
    pub fn from_snapshot(
        role: &'static str,
        timeout: Duration,
        snapshot: PoolSnapshot,
        cause: Option<String>,
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
struct PoolErrorLogger;

impl ErrorSink<diesel_async::pooled_connection::PoolError> for PoolErrorLogger {
    fn sink(&self, error: diesel_async::pooled_connection::PoolError) {
        tracing::warn!(error = %error, "PostgreSQL connection creation failed");
    }

    fn boxed_clone(&self) -> Box<dyn ErrorSink<diesel_async::pooled_connection::PoolError>> {
        Box::new(Self)
    }
}

fn manager(
    database_url: &str,
    settings: &PoolSettings,
) -> AsyncDieselConnectionManager<AsyncPgConnection> {
    let application_name = settings.application_name.clone();
    let statement_timeout = milliseconds(settings.statement_timeout);
    let lock_timeout = milliseconds(settings.lock_timeout);
    let idle_transaction_timeout = milliseconds(settings.idle_transaction_timeout);
    let mut config = ManagerConfig::default();
    config.custom_setup = Box::new(move |database_url| {
        let database_url = database_url.to_owned();
        let application_name = application_name.clone();
        let statement_timeout = statement_timeout.clone();
        let lock_timeout = lock_timeout.clone();
        let idle_transaction_timeout = idle_transaction_timeout.clone();
        Box::pin(async move {
            let mut connection = AsyncPgConnection::establish(&database_url).await?;
            sql_query(
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
            .map_err(|error| ConnectionError::BadConnection(error.to_string()))?;
            Ok(connection)
        })
    });
    AsyncDieselConnectionManager::new_with_config(database_url, config)
}

fn milliseconds(duration: Duration) -> String {
    format!("{}ms", duration.as_millis())
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
}
