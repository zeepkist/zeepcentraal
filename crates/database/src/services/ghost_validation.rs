use crate::Database;
use anyhow::Result;
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{Array, BigInt, Float, Integer, Jsonb, Nullable, Text},
};
use diesel_async::{AsyncPgConnection, RunQueryDsl};
use serde::Serialize;
use serde_json::Value;
use zc_core::ghost_validation::ValidationReport;

#[derive(Clone, Debug, QueryableByName, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LevelSnapshot {
    #[diesel(sql_type=Integer)]
    pub type_ground: i32,
    #[diesel(sql_type=Integer)]
    pub type_skybox: i32,
    #[diesel(sql_type=Array<Text>)]
    pub file_uids: Vec<String>,
    #[diesel(sql_type=BigInt)]
    pub id: i64,
    #[diesel(sql_type=Integer)]
    pub id_level: i32,
    #[diesel(sql_type=Text)]
    pub canonical_hash: String,
    #[diesel(sql_type=Integer)]
    pub format: i32,
    #[diesel(sql_type=Jsonb)]
    pub blocks: Value,
    #[diesel(sql_type=Nullable<Jsonb>)]
    pub environment: Option<Value>,
}
impl LevelSnapshot {
    pub fn verified(&self) -> bool {
        let hash = match self.format {
            1 => zc_core::levels::calculate_json_level_xxhash(
                &serde_json::json!({"blox":self.blocks}).to_string(),
            ),
            0 => zc_core::levels::calculate_csv_blocks_xxhash(
                &self.blocks,
                self.type_skybox.into(),
                self.type_ground.into(),
            ),
            _ => return false,
        };
        hash.is_ok_and(|hash| hash.eq_ignore_ascii_case(&self.canonical_hash))
    }
}
#[derive(Clone, Debug, QueryableByName)]
pub struct AuditRecord {
    #[diesel(sql_type=Integer)]
    pub id: i32,
    #[diesel(sql_type=Integer)]
    pub id_user: i32,
    #[diesel(sql_type=Integer)]
    pub id_level: i32,
    #[diesel(sql_type=Text)]
    pub steam_id: String,
    #[diesel(sql_type=Text)]
    pub level_uid: String,
    #[diesel(sql_type=Text)]
    pub canonical_hash: String,
    #[diesel(sql_type=Text)]
    pub game_version: String,
    #[diesel(sql_type=Float)]
    pub time: f32,
    #[diesel(sql_type=Array<Float>)]
    pub splits: Vec<f32>,
    #[diesel(sql_type=Array<Float>)]
    pub speeds: Vec<f32>,
    #[diesel(sql_type=Nullable<Text>)]
    pub ghost_url: Option<String>,
}
#[derive(QueryableByName)]
struct JsonRow {
    #[diesel(sql_type=Jsonb)]
    data: Value,
}

pub async fn observe_level_version(
    connection: &mut AsyncPgConnection,
    id_level: i32,
    workshop_id: i64,
    uid: &str,
) -> Result<()> {
    // Preserve memberships before scanner replaces level_item.id_level for a reused UID.
    sql_query("INSERT INTO zc_private.level_version_lineage(id_level,workshop_id,file_uid,source) SELECT id_level,workshop_id,file_uid,'current_membership_seed' FROM public.level_item item WHERE workshop_id=$1 AND NOT EXISTS(SELECT 1 FROM zc_private.level_version_lineage known WHERE known.id_level=item.id_level AND known.workshop_id=item.workshop_id AND known.file_uid=item.file_uid) ON CONFLICT DO NOTHING")
        .bind::<BigInt,_>(workshop_id).execute(connection).await?;
    sql_query("INSERT INTO zc_private.level_version_lineage(id_level,workshop_id,file_uid,source) VALUES($1,$2,$3,'workshop_scan') ON CONFLICT DO NOTHING")
        .bind::<Integer,_>(id_level).bind::<BigInt,_>(workshop_id).bind::<Text,_>(uid).execute(connection).await?;
    Ok(())
}
#[derive(Clone, Debug)]
pub struct AcceptedEvidence<'a> {
    pub ghost_key: &'a str,
    pub ghost_digest: &'a str,
    pub payload_digest: &'a str,
    pub run_uuid: Option<&'a str>,
    pub snapshot: Option<&'a LevelSnapshot>,
    pub report: &'a ValidationReport,
}
pub async fn persist_validation(
    connection: &mut AsyncPgConnection,
    id_record: Option<i32>,
    id_user: i32,
    snapshot: Option<&LevelSnapshot>,
    digest: Option<&str>,
    report: &ValidationReport,
) -> Result<()> {
    sql_query("INSERT INTO zc_private.record_validation(id_record,id_user,id_level,ghost_digest,level_xx_hash,status,report,validator_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8)")
 .bind::<Nullable<Integer>,_>(id_record).bind::<Integer,_>(id_user).bind::<Nullable<Integer>,_>(snapshot.map(|s|s.id_level)).bind::<Nullable<Text>,_>(digest).bind::<Nullable<Text>,_>(snapshot.map(|s|s.canonical_hash.as_str())).bind::<Text,_>(&report.status).bind::<Jsonb,_>(serde_json::to_value(report)?).bind::<Text,_>(&report.validator_version).execute(connection).await?;
    Ok(())
}
impl Database {
    pub async fn accepted_run_digest(&self, user: i32, run_uuid: &str) -> Result<Option<String>> {
        #[derive(QueryableByName)]
        struct Run {
            #[diesel(sql_type=Text)]
            payload_digest: String,
        }
        let mut c = self.connection().await?;
        Ok(sql_query(
            "SELECT payload_digest FROM zc_private.record_run WHERE id_user=$1 AND run_uuid=$2",
        )
        .bind::<Integer, _>(user)
        .bind::<Text, _>(run_uuid)
        .get_result::<Run>(&mut c)
        .await
        .optional()?
        .map(|r| r.payload_digest))
    }
    pub async fn validation_snapshot(&self, hash: &str) -> Result<Option<LevelSnapshot>> {
        let mut c = self.connection().await?;
        let rows=sql_query("SELECT l.id::bigint AS id,l.id AS id_level,l.xx_hash AS canonical_hash,m.format,m.blocks,m.environment,m.type_ground,m.type_skybox,ARRAY(SELECT DISTINCT file_uid FROM zc_private.level_version_lineage o WHERE o.id_level=l.id AND o.source='workshop_scan') AS file_uids FROM public.level l JOIN public.level_metadata m ON m.id_level=l.id WHERE l.xx_hash=$1 AND pg_column_size(m.blocks)<=16777216 ORDER BY m.id DESC LIMIT 16").bind::<Text,_>(hash).load::<LevelSnapshot>(&mut c).await?;
        Ok(rows.into_iter().find(LevelSnapshot::verified))
    }
    pub async fn save_record_validation(
        &self,
        record: Option<i32>,
        user: i32,
        snapshot: Option<&LevelSnapshot>,
        digest: Option<&str>,
        report: &ValidationReport,
    ) -> Result<()> {
        let mut connection = self.connection().await?;
        persist_validation(&mut connection, record, user, snapshot, digest, report).await
    }
    pub async fn audit_record(&self, id: i32) -> Result<Option<AuditRecord>> {
        let mut c = self.connection().await?;
        Ok(sql_query("SELECT r.id,r.id_user,r.id_level,coalesce(u.steam_id::text,'') AS steam_id,l.hash AS level_uid,l.xx_hash AS canonical_hash,r.game_version::text,r.time,coalesce(r.splits,ARRAY[]::real[]) AS splits,coalesce(r.speeds,ARRAY[]::real[]) AS speeds,(SELECT ghost_url FROM public.record_media WHERE id_record=r.id) AS ghost_url FROM public.record r JOIN public.level l ON l.id=r.id_level JOIN public.\"user\" u ON u.id=r.id_user WHERE r.id=$1")
  .bind::<Integer,_>(id).get_result(&mut c).await.optional()?)
    }
    pub async fn audit_record_ids(&self, filter: &Value) -> Result<Vec<i32>> {
        #[derive(QueryableByName)]
        struct Id {
            #[diesel(sql_type=Integer)]
            id: i32,
        }
        let integer = |key: &str| filter[key].as_i64().and_then(|v| i32::try_from(v).ok());
        let mut c = self.connection().await?;
        Ok(sql_query("SELECT r.id FROM public.record r WHERE r.id>$1 AND ($2::integer IS NULL OR r.id=$2) AND ($3::integer IS NULL OR r.id_level=$3) AND ($4::bigint IS NULL OR EXISTS(SELECT 1 FROM zc_private.level_version_lineage o WHERE o.id_level=r.id_level AND o.workshop_id=$4)) AND ($5::text IS NULL OR r.date_created >= $5::timestamptz) AND ($6::text IS NULL OR r.date_created < $6::timestamptz) ORDER BY r.id LIMIT 100")
  .bind::<Integer,_>(integer("afterId").unwrap_or(0)).bind::<Nullable<Integer>,_>(integer("idRecord")).bind::<Nullable<Integer>,_>(integer("idLevel")).bind::<Nullable<BigInt>,_>(filter["workshopId"].as_str().and_then(|v|v.parse::<i64>().ok())).bind::<Nullable<Text>,_>(filter["from"].as_str()).bind::<Nullable<Text>,_>(filter["to"].as_str()).load::<Id>(&mut c).await?.into_iter().map(|r|r.id).collect())
    }
    pub async fn validation_candidates(&self, id_level: i32) -> Result<Vec<LevelSnapshot>> {
        let mut c = self.connection().await?;
        Ok(sql_query("SELECT l.id::bigint AS id,l.id AS id_level,l.xx_hash AS canonical_hash,m.format,m.blocks,m.environment,m.type_ground,m.type_skybox,ARRAY(SELECT DISTINCT file_uid FROM zc_private.level_version_lineage verified WHERE verified.id_level=l.id AND verified.source='workshop_scan') AS file_uids FROM public.level l JOIN public.level_metadata m ON m.id_level=l.id WHERE l.xx_hash IS NOT NULL AND pg_column_size(m.blocks)<=4194304 AND (l.id=$1 OR EXISTS(SELECT 1 FROM zc_private.level_version_lineage candidate JOIN zc_private.level_version_lineage origin ON origin.workshop_id=candidate.workshop_id WHERE candidate.id_level=l.id AND origin.id_level=$1)) ORDER BY (l.id=$1) DESC,l.id DESC,m.id DESC LIMIT 16")
  .bind::<Integer,_>(id_level).load::<LevelSnapshot>(&mut c).await?)
    }
    pub async fn record_validation_attempts(&self, id: i32) -> Result<Vec<Value>> {
        let mut connection = self.connection().await?;
        Ok(sql_query("SELECT to_jsonb(v) || jsonb_build_object('id',v.id::text,'id_level',v.id_level::text) AS data FROM zc_private.record_validation v WHERE v.id_record=$1 ORDER BY v.id DESC LIMIT 100").bind::<Integer,_>(id).load::<JsonRow>(&mut connection).await?.into_iter().map(|row|row.data).collect())
    }
    pub async fn admin_validations(
        &self,
        after: i64,
        record: Option<i32>,
        status: Option<&str>,
        filter: &Value,
    ) -> Result<Vec<Value>> {
        let mut c = self.connection().await?;
        Ok(sql_query("SELECT to_jsonb(v) || jsonb_build_object('id',v.id::text,'id_level',v.id_level::text) AS data FROM zc_private.record_validation v WHERE v.id>$1 AND ($2::integer IS NULL OR v.id_record=$2) AND ($3::text IS NULL OR v.status=$3) AND ($4::integer IS NULL OR EXISTS(SELECT 1 FROM public.record r WHERE r.id=v.id_record AND r.id_level=$4)) AND ($5::bigint IS NULL OR EXISTS(SELECT 1 FROM public.record r JOIN zc_private.level_version_lineage o ON o.id_level=r.id_level WHERE r.id=v.id_record AND o.workshop_id=$5)) AND ($6::text IS NULL OR EXISTS(SELECT 1 FROM public.record r WHERE r.id=v.id_record AND r.date_created >= $6::timestamptz)) AND ($7::text IS NULL OR EXISTS(SELECT 1 FROM public.record r WHERE r.id=v.id_record AND r.date_created < $7::timestamptz)) ORDER BY v.id LIMIT 100")
  .bind::<BigInt,_>(after).bind::<Nullable<Integer>,_>(record).bind::<Nullable<Text>,_>(status).bind::<Nullable<Integer>,_>(filter["idLevel"].as_i64().and_then(|v|i32::try_from(v).ok())).bind::<Nullable<BigInt>,_>(filter["workshopId"].as_str().and_then(|v|v.parse::<i64>().ok())).bind::<Nullable<Text>,_>(filter["from"].as_str()).bind::<Nullable<Text>,_>(filter["to"].as_str()).load::<JsonRow>(&mut c).await?.into_iter().map(|r|r.data).collect())
    }
}
