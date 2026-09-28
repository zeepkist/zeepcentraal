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
        let rows=sql_query(r#"SELECT jsonb_build_object('id',s.id,'revision',n.desired_revision,'validationId',n.desired_validation_id,'messageId',n.message_id,'digest',n.payload_digest,'uncertain',n.attempt_started_at IS NOT NULL,'withdrawn',s.state='withdrawn','roundId',r.id,'roundName',r.name,'workshopId',s.workshop_id::text,'authors',coalesce((SELECT jsonb_agg(coalesce(u.steam_name,a.id) ORDER BY a.n) FROM unnest(s.authors) WITH ORDINALITY a(id,n) LEFT JOIN public."user" u ON u.steam_id::text=a.id),'[]'::jsonb),'name',coalesce(v.payload->>'name','Workshop item '||s.workshop_id),'thumbnail',coalesce(nullif(v.payload->>'thumbnailUrl',''),nullif(i.image_url,''),nullif(w.image_url,'')),'levelHash',s.level_hash,'valid',v.valid,'measurements',v.measurements,'failures',v.failures,'workshopUpdatedAt',v.workshop_updated_at) AS payload
FROM zc_private.level_submission_notification n JOIN zc_private.level_submissions s ON s.id=n.id_submission JOIN zc_private.level_submission_contest c ON c.id=s.id_contest JOIN public.zsl_round r ON r.id=c.id_zsl_round LEFT JOIN zc_private.level_submission_validation v ON v.id=n.desired_validation_id LEFT JOIN public.workshop_item w ON w.workshop_id=s.workshop_id LEFT JOIN public.level l ON l.xx_hash=s.level_hash LEFT JOIN LATERAL (SELECT image_url FROM public.level_item WHERE id_level=l.id AND workshop_id=s.workshop_id ORDER BY id DESC LIMIT 1) i ON true
WHERE n.next_attempt_at<=now() AND (s.revision=n.desired_revision OR s.state='withdrawn') AND (n.delivered_revision IS DISTINCT FROM n.desired_revision OR n.delivered_validation_id IS DISTINCT FROM n.desired_validation_id) ORDER BY n.next_attempt_at LIMIT 50"#)
            .load::<JsonRow>(&mut c).await?;
        Ok(rows.into_iter().map(|r| r.payload).collect())
    }
    pub async fn begin_submission_notification(&self, id: i64) -> Result<()> {
        let mut c = self.connection().await?;
        sql_query("UPDATE zc_private.level_submission_notification SET attempt_started_at=coalesce(attempt_started_at,now()) WHERE id_submission=$1")
            .bind::<BigInt,_>(id).execute(&mut c).await?;
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
        sql_query("UPDATE zc_private.level_submission_notification SET message_id=$4,payload_digest=$5,delivered_revision=$2,delivered_validation_id=$3,attempt_started_at=NULL,last_error=NULL,date_updated=now() WHERE id_submission=$1")
            .bind::<BigInt,_>(id).bind::<BigInt,_>(revision).bind::<Nullable<BigInt>,_>(validation).bind::<Nullable<Text>,_>(message).bind::<Text,_>(digest).execute(&mut c).await?;
        Ok(())
    }
    pub async fn retry_submission_notification(&self, id: i64, delay: i64) -> Result<()> {
        let mut c = self.connection().await?;
        sql_query("UPDATE zc_private.level_submission_notification SET next_attempt_at=now()+($2 * interval '1 second'),last_error='delivery-transient',date_updated=now() WHERE id_submission=$1")
            .bind::<BigInt,_>(id).bind::<BigInt,_>(delay.clamp(1,3600)).execute(&mut c).await?;
        Ok(())
    }
}
