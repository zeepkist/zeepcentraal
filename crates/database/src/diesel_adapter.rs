use anyhow::Result;
use diesel::sql_query;
use diesel_async::{
    AsyncPgConnection, RunQueryDsl,
    pooled_connection::{AsyncDieselConnectionManager, bb8::Pool},
};

#[derive(Clone)]
pub struct Database {
    pool: Pool<AsyncPgConnection>,
}
impl Database {
    pub async fn connect(url: &str, max: u32) -> Result<Self> {
        let manager = AsyncDieselConnectionManager::<AsyncPgConnection>::new(url);
        Ok(Self {
            pool: Pool::builder()
                .max_size(max)
                .min_idle(Some(0))
                .idle_timeout(Some(std::time::Duration::from_secs(30)))
                .connection_timeout(std::time::Duration::from_secs(5))
                .reaper_rate(std::time::Duration::from_secs(1))
                .build(manager)
                .await?,
        })
    }

    pub async fn ping(&self) -> Result<()> {
        let mut connection = self.pool.get().await?;
        sql_query("SELECT 1").execute(&mut connection).await?;
        Ok(())
    }

    pub(crate) async fn connection(
        &self,
    ) -> Result<diesel_async::pooled_connection::bb8::PooledConnection<'_, AsyncPgConnection>> {
        Ok(self.pool.get().await?)
    }
}
