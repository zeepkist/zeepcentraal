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
        Ok(sql_query("SELECT name, to_char(event_date AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS event_date, to_char(event2_date AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS event2_date FROM public.zsl_round WHERE id=$1")
            .bind::<Integer,_>(round_id).get_result(&mut connection).await.optional()?)
    }
    pub async fn practice_asset(
        &self,
        round_id: i32,
        playlist: &str,
    ) -> Result<Option<PracticeAssetRow>> {
        let mut connection = self.connection().await?;
        Ok(sql_query("SELECT object_key,content_sha256,byte_size FROM zc_private.zsl_practice_playlist WHERE id_zsl_round=$1 AND playlist_url=$2")
            .bind::<Integer,_>(round_id).bind::<Text,_>(playlist).get_result(&mut connection).await.optional()?)
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
        sql_query("INSERT INTO zc_private.zsl_practice_playlist (id_zsl_round,playlist_url,object_key,content_sha256,byte_size) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id_zsl_round,playlist_url) DO UPDATE SET object_key=EXCLUDED.object_key,content_sha256=EXCLUDED.content_sha256,byte_size=EXCLUDED.byte_size,date_updated=clock_timestamp()")
            .bind::<Integer,_>(round_id).bind::<Text,_>(playlist).bind::<Text,_>(key).bind::<Text,_>(digest).bind::<Integer,_>(size).execute(&mut connection).await?;
        Ok(())
    }
}
