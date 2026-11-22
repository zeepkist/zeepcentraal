use crate::Database;
use anyhow::Result;
use diesel::{
    QueryableByName, sql_query,
    sql_types::{BigInt, Jsonb, Nullable, Text},
};
use diesel_async::RunQueryDsl;
use serde_json::Value;
#[derive(QueryableByName)]
struct JsonRow {
    #[diesel(sql_type=Jsonb)]
    payload: Value,
}
impl Database {
    pub async fn pending_submission_notifications(&self) -> Result<Vec<Value>> {
        let mut c = self.connection().await?;
        let rows = sql_query(include_str!(
            "../queries/submission_notifications/pending_submission_notifications.sql"
        ))
        .load::<JsonRow>(&mut c)
        .await?;
        Ok(rows.into_iter().map(|r| r.payload).collect())
    }
    pub async fn begin_submission_notification(&self, id: i64) -> Result<()> {
        let mut c = self.connection().await?;
        sql_query(include_str!(
            "../queries/submission_notifications/begin_submission_notification.sql"
        ))
        .bind::<BigInt, _>(id)
        .execute(&mut c)
        .await?;
        Ok(())
    }
    pub async fn finish_submission_notification(
        &self,
        id: i64,
        revision: i64,
        validation: Option<i64>,
        message: Option<&str>,
        digest: &str,
    ) -> Result<()> {
        let mut c = self.connection().await?;
        sql_query(include_str!(
            "../queries/submission_notifications/finish_submission_notification.sql"
        ))
        .bind::<BigInt, _>(id)
        .bind::<BigInt, _>(revision)
        .bind::<Nullable<BigInt>, _>(validation)
        .bind::<Nullable<Text>, _>(message)
        .bind::<Text, _>(digest)
        .execute(&mut c)
        .await?;
        Ok(())
    }
    pub async fn retry_submission_notification(&self, id: i64, delay: i64) -> Result<()> {
        let mut c = self.connection().await?;
        sql_query(include_str!(
            "../queries/submission_notifications/retry_submission_notification.sql"
        ))
        .bind::<BigInt, _>(id)
        .bind::<BigInt, _>(delay.clamp(1, 3600))
        .execute(&mut c)
        .await?;
        Ok(())
    }
}
