use crate::Database;
use anyhow::Result;
use diesel::sql_query;
use diesel_async::RunQueryDsl;

impl Database {
    pub async fn refresh_global_metrics(&self) -> Result<()> {
        let mut connection = self.connection().await?;
        sql_query(include_str!(
            "../queries/global_metrics/refresh_global_metrics.sql"
        ))
        .execute(&mut connection)
        .await?;
        Ok(())
    }
}
