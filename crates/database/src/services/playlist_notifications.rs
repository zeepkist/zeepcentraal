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
        sql_query("INSERT INTO zc_private.level_submission_playlist_notification(id_contest,desired_playlist_id) SELECT id,current_playlist_id FROM zc_private.level_submission_contest WHERE id_zsl_round=ANY($1) AND current_playlist_id IS NOT NULL ON CONFLICT(id_contest) DO UPDATE SET desired_playlist_id=EXCLUDED.desired_playlist_id,next_attempt_at=now() WHERE level_submission_playlist_notification.desired_playlist_id IS DISTINCT FROM EXCLUDED.desired_playlist_id")
            .bind::<Array<Integer>,_>(rounds).execute(&mut c).await?;
        Ok(())
    }
    pub async fn pending_playlist_notifications(
        &self,
        rounds: &[i32],
        channel: &str,
    ) -> Result<Vec<Value>> {
        let mut c = self.connection().await?;
        let rows = sql_query(r#"SELECT jsonb_build_object('contestId',n.id_contest,'playlistId',n.desired_playlist_id,
            'deliveredPlaylistId',n.delivered_playlist_id,'messageId',n.message_id,'channelId',n.channel_id,
            'attemptPlaylistId',n.attempt_playlist_id,'attemptChannelId',n.attempt_channel_id,
            'name',r.name,'validCount',p.valid_count,'objectKey',p.object_key,'digest',p.digest) AS payload
            FROM zc_private.level_submission_playlist_notification n
            JOIN zc_private.level_submission_contest c ON c.id=n.id_contest
            JOIN public.zsl_round r ON r.id=c.id_zsl_round
            JOIN zc_private.level_submission_playlist p ON p.id=n.desired_playlist_id
            WHERE c.id_zsl_round=ANY($1) AND n.next_attempt_at<=now() AND
                (n.delivered_playlist_id IS DISTINCT FROM n.desired_playlist_id OR n.channel_id IS DISTINCT FROM $2 OR n.attempt_started_at IS NOT NULL)
            ORDER BY n.next_attempt_at,n.id_contest"#)
            .bind::<Array<Integer>,_>(rounds).bind::<Text,_>(channel).load::<JsonRow>(&mut c).await?;
        Ok(rows.into_iter().map(|r| r.payload).collect())
    }
    pub async fn begin_playlist_notification(
        &self,
        contest: i64,
        playlist: i64,
        channel: &str,
    ) -> Result<()> {
        let mut c = self.connection().await?;
        sql_query("UPDATE zc_private.level_submission_playlist_notification SET attempt_playlist_id=$2,attempt_channel_id=$3,attempt_started_at=now() WHERE id_contest=$1 AND attempt_started_at IS NULL")
            .bind::<BigInt,_>(contest).bind::<BigInt,_>(playlist).bind::<Text,_>(channel).execute(&mut c).await?;
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
        sql_query("UPDATE zc_private.level_submission_playlist_notification SET message_id=$2,channel_id=$3,delivered_playlist_id=CASE WHEN $2 IS NOT NULL THEN attempt_playlist_id ELSE NULL END,attempt_playlist_id=NULL,attempt_channel_id=NULL,attempt_started_at=NULL WHERE id_contest=$1")
            .bind::<BigInt,_>(contest).bind::<Nullable<Text>,_>(message).bind::<Text,_>(channel).execute(&mut c).await?;
        Ok(())
    }
    pub async fn clear_playlist_message(&self, contest: i64) -> Result<()> {
        let mut c = self.connection().await?;
        sql_query("UPDATE zc_private.level_submission_playlist_notification SET message_id=NULL,delivered_playlist_id=NULL WHERE id_contest=$1")
            .bind::<BigInt,_>(contest).execute(&mut c).await?;
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
        sql_query("UPDATE zc_private.level_submission_playlist_notification SET delivered_playlist_id=$2,channel_id=$3,message_id=$4,attempt_playlist_id=NULL,attempt_channel_id=NULL,attempt_started_at=NULL WHERE id_contest=$1")
            .bind::<BigInt,_>(contest).bind::<BigInt,_>(playlist).bind::<Text,_>(channel).bind::<Nullable<Text>,_>(message).execute(&mut c).await?;
        Ok(())
    }
    pub async fn retry_playlist_notification(&self, contest: i64, delay: i64) -> Result<()> {
        let mut c = self.connection().await?;
        sql_query("UPDATE zc_private.level_submission_playlist_notification SET next_attempt_at=now()+($2 * interval '1 second') WHERE id_contest=$1")
            .bind::<BigInt,_>(contest).bind::<BigInt,_>(delay.clamp(1,3600)).execute(&mut c).await?;
        Ok(())
    }
}
