use crate::Database;
use anyhow::{Result, ensure};
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{Integer, Nullable, Text},
};
use diesel_async::RunQueryDsl;

#[derive(Clone, Debug, QueryableByName)]
pub struct PracticeScheduleRow {
    #[diesel(sql_type = Text)]
    pub name: String,
    #[diesel(sql_type = Text)]
    pub event_date: String,
    #[diesel(sql_type = Nullable<Text>)]
    pub event2_date: Option<String>,
}
#[derive(Clone, Debug, QueryableByName)]
pub struct PracticeAssetRow {
    #[diesel(sql_type = Text)]
    pub object_key: String,
    #[diesel(sql_type = Text)]
    pub content_sha256: String,
    #[diesel(sql_type = Integer)]
    pub byte_size: i32,
}
impl Database {
    pub async fn practice_schedule(&self, round_id: i32) -> Result<Option<PracticeScheduleRow>> {
        let mut connection = self.connection().await?;
        Ok(
            sql_query(include_str!("../queries/practice/practice_schedule.sql"))
                .bind::<Integer, _>(round_id)
                .get_result(&mut connection)
                .await
                .optional()?,
        )
    }
    pub async fn practice_asset(
        &self,
        round_id: i32,
        playlist: &str,
    ) -> Result<Option<PracticeAssetRow>> {
        let mut connection = self.connection().await?;
        Ok(
            sql_query(include_str!("../queries/practice/practice_asset.sql"))
                .bind::<Integer, _>(round_id)
                .bind::<Text, _>(playlist)
                .get_result(&mut connection)
                .await
                .optional()?,
        )
    }
    pub async fn publish_practice_asset(
        &self,
        round_id: i32,
        playlist: &str,
        key: &str,
        digest: &str,
        size: i32,
    ) -> Result<()> {
        ensure!(
            round_id > 0 && (1..=1048576).contains(&size),
            "Invalid practice asset"
        );
        let mut connection = self.connection().await?;
        sql_query(include_str!(
            "../queries/practice/publish_practice_asset.sql"
        ))
        .bind::<Integer, _>(round_id)
        .bind::<Text, _>(playlist)
        .bind::<Text, _>(key)
        .bind::<Text, _>(digest)
        .bind::<Integer, _>(size)
        .execute(&mut connection)
        .await?;
        Ok(())
    }
}
