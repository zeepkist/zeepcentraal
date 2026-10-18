use crate::Database;
use anyhow::Result;
use diesel::sql_query;
use diesel_async::RunQueryDsl;

impl Database {
    pub async fn refresh_global_metrics(&self) -> Result<()> {
        let mut connection = self.connection().await?;
        sql_query("SELECT zc_private.refresh_global_metrics()")
            .execute(&mut connection)
            .await?;
        Ok(())
    }
}
