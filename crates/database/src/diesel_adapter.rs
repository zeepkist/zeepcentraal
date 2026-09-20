use crate::{DatabasePool, PoolBudget, PoolConnection, PoolPartition, PoolSettings, PoolSnapshot};
use anyhow::Result;
use diesel::sql_query;
use diesel_async::RunQueryDsl;
use std::time::Duration;

#[derive(Clone)]
pub struct Database {
    partition: PoolPartition,
}
impl Database {
    pub async fn connect(url: &str, max: u32) -> Result<Self> {
        let settings = PoolSettings {
            application_name: "zeepcentraal-test".to_owned(),
            acquire_timeout: Duration::from_secs(5),
            statement_timeout: Duration::from_secs(15),
            lock_timeout: Duration::from_secs(3),
            idle_transaction_timeout: Duration::from_secs(30),
            idle_timeout: Duration::from_secs(30),
        };
        let pool = DatabasePool::connect(url, settings, PoolBudget::application(max)).await?;
        Ok(Self::from_partition(pool.application()))
    }

    pub fn from_partition(partition: PoolPartition) -> Self {
        Self { partition }
    }

    pub async fn ping(&self) -> Result<()> {
        let mut connection = self.connection().await?;
        sql_query("SELECT 1").execute(&mut connection).await?;
        Ok(())
    }

    pub fn pool_snapshot(&self) -> PoolSnapshot {
        self.partition.snapshot()
    }

    pub(crate) async fn connection(&self) -> Result<PoolConnection> {
        self.partition.connection().await
    }
}
