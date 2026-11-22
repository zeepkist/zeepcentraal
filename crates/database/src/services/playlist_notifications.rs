//! Durable replacement state for inspector-published Discord playlists.
use crate::Database;
use anyhow::Result;
use diesel::{
    QueryableByName, sql_query,
    sql_types::{Array, BigInt, Integer, Jsonb, Nullable, Text},
};
use diesel_async::RunQueryDsl;
use serde_json::Value;
#[derive(QueryableByName)]
struct JsonRow {
    #[diesel(sql_type=Jsonb)]
    payload: Value,
}
impl Database {
    /// Backfill existing artifacts, including frozen contests. Preserve uncertain sends.
    pub async fn sync_playlist_notifications(&self, rounds: &[i32]) -> Result<()> {
        let mut c = self.connection().await?;
        sql_query(include_str!(
            "../queries/playlist_notifications/sync_playlist_notifications.sql"
        ))
        .bind::<Array<Integer>, _>(rounds)
        .execute(&mut c)
        .await?;
        Ok(())
    }
    pub async fn pending_playlist_notifications(
        &self,
        rounds: &[i32],
        channel: &str,
    ) -> Result<Vec<Value>> {
        let mut c = self.connection().await?;
        let rows = sql_query(include_str!(
            "../queries/playlist_notifications/pending_playlist_notifications.sql"
        ))
        .bind::<Array<Integer>, _>(rounds)
        .bind::<Text, _>(channel)
        .load::<JsonRow>(&mut c)
        .await?;
        Ok(rows.into_iter().map(|r| r.payload).collect())
    }
    pub async fn begin_playlist_notification(
        &self,
        contest: i64,
        playlist: i64,
        channel: &str,
    ) -> Result<()> {
        let mut c = self.connection().await?;
        sql_query(include_str!(
            "../queries/playlist_notifications/begin_playlist_notification.sql"
        ))
        .bind::<BigInt, _>(contest)
        .bind::<BigInt, _>(playlist)
        .bind::<Text, _>(channel)
        .execute(&mut c)
        .await?;
        Ok(())
    }
    /// Remember recovered message before another deletion or send can start.
    pub async fn recover_playlist_notification(
        &self,
        contest: i64,
        message: Option<&str>,
        channel: &str,
    ) -> Result<()> {
        let mut c = self.connection().await?;
        sql_query(include_str!(
            "../queries/playlist_notifications/recover_playlist_notification.sql"
        ))
        .bind::<BigInt, _>(contest)
        .bind::<Nullable<Text>, _>(message)
        .bind::<Text, _>(channel)
        .execute(&mut c)
        .await?;
        Ok(())
    }
    pub async fn clear_playlist_message(&self, contest: i64) -> Result<()> {
        let mut c = self.connection().await?;
        sql_query(include_str!(
            "../queries/playlist_notifications/clear_playlist_message.sql"
        ))
        .bind::<BigInt, _>(contest)
        .execute(&mut c)
        .await?;
        Ok(())
    }
    pub async fn finish_playlist_notification(
        &self,
        contest: i64,
        playlist: i64,
        channel: &str,
        message: Option<&str>,
    ) -> Result<()> {
        let mut c = self.connection().await?;
        sql_query(include_str!(
            "../queries/playlist_notifications/finish_playlist_notification.sql"
        ))
        .bind::<BigInt, _>(contest)
        .bind::<BigInt, _>(playlist)
        .bind::<Text, _>(channel)
        .bind::<Nullable<Text>, _>(message)
        .execute(&mut c)
        .await?;
        Ok(())
    }
    pub async fn retry_playlist_notification(&self, contest: i64, delay: i64) -> Result<()> {
        let mut c = self.connection().await?;
        sql_query(include_str!(
            "../queries/playlist_notifications/retry_playlist_notification.sql"
        ))
        .bind::<BigInt, _>(contest)
        .bind::<BigInt, _>(delay.clamp(1, 3600))
        .execute(&mut c)
        .await?;
        Ok(())
    }
}
