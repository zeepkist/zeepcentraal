use crate::Database;
use anyhow::{Result, ensure};
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{Array, BigInt, Float, Integer, Jsonb, Nullable, Text},
};
use diesel_async::{AsyncPgConnection, RunQueryDsl};
use serde::Serialize;
use serde_json::Value;
use zc_core::ghost_validation::{VALIDATOR_VERSION, ValidationReport};

const AUDIT_RECORD_IDS_QUERY: &str = r#"
SELECT r.id FROM public.record r
WHERE r.id>$1
  AND ($2::integer IS NULL OR r.id=$2)
  AND ($3::integer IS NULL OR r.id_level=$3)
  AND ($4::bigint IS NULL OR EXISTS(SELECT 1 FROM public.level_item o WHERE o.id_level=r.id_level AND o.workshop_id=$4))
  AND ($5::text IS NULL OR r.date_created >= $5::timestamptz)
  AND ($6::text IS NULL OR r.date_created < $6::timestamptz)
  AND (cardinality($7::text[])=0 OR EXISTS(
    SELECT 1 FROM zc_private.record_validation v
    WHERE v.id_record=r.id AND (
      (v.validator_version<>$8 AND v.report->'reasons' ?| $7)
      OR v.report->'reasons' ? 'ghost_storage_unavailable'
    )
  ))
ORDER BY r.id LIMIT 100
"#;

const ADMIN_VALIDATIONS_QUERY: &str = r#"
SELECT to_jsonb(v) || jsonb_build_object('id',v.id::text,'id_level',v.id_level::text,'level_xx_hash',l.xx_hash) AS data
FROM zc_private.record_validation v JOIN public.level l ON l.id=v.id_level
WHERE v.id>$1
  AND ($2::integer IS NULL OR v.id_record=$2)
  AND ($3::text IS NULL OR v.status=$3)
  AND ($4::integer IS NULL OR EXISTS(SELECT 1 FROM public.record r WHERE r.id=v.id_record AND r.id_level=$4))
  AND ($5::bigint IS NULL OR EXISTS(SELECT 1 FROM public.level_item o WHERE o.id_level=v.id_level AND o.workshop_id=$5))
  AND ($6::text IS NULL OR EXISTS(SELECT 1 FROM public.record r WHERE r.id=v.id_record AND r.date_created >= $6::timestamptz))
  AND ($7::text IS NULL OR EXISTS(SELECT 1 FROM public.record r WHERE r.id=v.id_record AND r.date_created < $7::timestamptz))
ORDER BY v.id LIMIT 100
"#;

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

#[derive(Clone, Debug)]
pub struct AcceptedEvidence<'a> {
    pub ghost_key: &'a str,
    pub ghost_digest: &'a str,
    pub payload_digest: &'a str,
    pub run_uuid: Option<&'a str>,
    pub report: &'a ValidationReport,
}
pub async fn persist_validation(
    connection: &mut AsyncPgConnection,
    id_record: i32,
    digest: Option<&str>,
    report: &ValidationReport,
) -> Result<()> {
    ensure!(
        !report.comparison,
        "Candidate comparisons must not be persisted"
    );
    sql_query("INSERT INTO zc_private.record_validation AS existing(id_record,id_user,id_level,ghost_digest,status,report,validator_version) SELECT r.id,r.id_user,r.id_level,$2,$3,$4,$5 FROM public.record r WHERE r.id=$1 ON CONFLICT(id_record) DO UPDATE SET id_user=EXCLUDED.id_user,id_level=EXCLUDED.id_level,ghost_digest=EXCLUDED.ghost_digest,status=EXCLUDED.status,report=EXCLUDED.report,validator_version=EXCLUDED.validator_version,updated_at=clock_timestamp() WHERE ROW(existing.status,existing.report,existing.validator_version) IS DISTINCT FROM ROW(EXCLUDED.status,EXCLUDED.report,EXCLUDED.validator_version)")
        .bind::<Integer,_>(id_record).bind::<Nullable<Text>,_>(digest).bind::<Text,_>(&report.status).bind::<Jsonb,_>(serde_json::to_value(report)?).bind::<Text,_>(&report.validator_version).execute(connection).await?;
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
        let rows=sql_query("SELECT l.id::bigint AS id,l.id AS id_level,l.xx_hash AS canonical_hash,m.format,m.blocks,m.environment,m.type_ground,m.type_skybox,ARRAY(SELECT DISTINCT file_uid FROM public.level_item o WHERE o.id_level=l.id) AS file_uids FROM public.level l JOIN public.level_metadata m ON m.id_level=l.id WHERE l.xx_hash=$1 AND pg_column_size(m.blocks)<=16777216 ORDER BY m.id DESC LIMIT 16").bind::<Text,_>(hash).load::<LevelSnapshot>(&mut c).await?;
        Ok(rows.into_iter().find(LevelSnapshot::verified))
    }
    pub async fn save_record_validation(
        &self,
        record: i32,
        digest: Option<&str>,
        report: &ValidationReport,
    ) -> Result<()> {
        let mut connection = self.connection().await?;
        persist_validation(&mut connection, record, digest, report).await
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
        let reasons: Vec<String> = filter["reasons"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|v| v.as_str().map(str::to_owned))
            .collect();
        Ok(sql_query(AUDIT_RECORD_IDS_QUERY)
            .bind::<Integer, _>(integer("afterId").unwrap_or(0))
            .bind::<Nullable<Integer>, _>(integer("idRecord"))
            .bind::<Nullable<Integer>, _>(integer("idLevel"))
            .bind::<Nullable<BigInt>, _>(
                filter["workshopId"]
                    .as_str()
                    .and_then(|v| v.parse::<i64>().ok()),
            )
            .bind::<Nullable<Text>, _>(filter["from"].as_str())
            .bind::<Nullable<Text>, _>(filter["to"].as_str())
            .bind::<Array<Text>, _>(reasons)
            .bind::<Text, _>(VALIDATOR_VERSION)
            .load::<Id>(&mut c)
            .await?
            .into_iter()
            .map(|r| r.id)
            .collect())
    }
    pub async fn validation_candidates(&self, id_level: i32) -> Result<Vec<LevelSnapshot>> {
        let mut c = self.connection().await?;
        Ok(sql_query("SELECT l.id::bigint AS id,l.id AS id_level,l.xx_hash AS canonical_hash,m.format,m.blocks,m.environment,m.type_ground,m.type_skybox,ARRAY(SELECT DISTINCT file_uid FROM public.level_item verified WHERE verified.id_level=l.id) AS file_uids FROM public.level l JOIN public.level_metadata m ON m.id_level=l.id WHERE l.xx_hash IS NOT NULL AND pg_column_size(m.blocks)<=4194304 AND (l.id=$1 OR EXISTS(SELECT 1 FROM public.level_item candidate JOIN public.level_item origin ON origin.workshop_id=candidate.workshop_id WHERE candidate.id_level=l.id AND origin.id_level=$1)) ORDER BY (l.id=$1) DESC,l.id DESC,m.id DESC LIMIT 16")
  .bind::<Integer,_>(id_level).load::<LevelSnapshot>(&mut c).await?)
    }
    pub async fn record_validation_attempts(&self, id: i32) -> Result<Vec<Value>> {
        let mut connection = self.connection().await?;
        Ok(sql_query("SELECT to_jsonb(v) || jsonb_build_object('id',v.id::text,'id_level',v.id_level::text,'level_xx_hash',l.xx_hash) AS data FROM zc_private.record_validation v JOIN public.level l ON l.id=v.id_level WHERE v.id_record=$1").bind::<Integer,_>(id).load::<JsonRow>(&mut connection).await?.into_iter().map(|row|row.data).collect())
    }
    pub async fn admin_validations(
        &self,
        after: i64,
        record: Option<i32>,
        status: Option<&str>,
        filter: &Value,
    ) -> Result<Vec<Value>> {
        let mut c = self.connection().await?;
        Ok(sql_query(ADMIN_VALIDATIONS_QUERY)
            .bind::<BigInt, _>(after)
            .bind::<Nullable<Integer>, _>(record)
            .bind::<Nullable<Text>, _>(status)
            .bind::<Nullable<Integer>, _>(
                filter["idLevel"]
                    .as_i64()
                    .and_then(|v| i32::try_from(v).ok()),
            )
            .bind::<Nullable<BigInt>, _>(
                filter["workshopId"]
                    .as_str()
                    .and_then(|v| v.parse::<i64>().ok()),
            )
            .bind::<Nullable<Text>, _>(filter["from"].as_str())
            .bind::<Nullable<Text>, _>(filter["to"].as_str())
            .load::<JsonRow>(&mut c)
            .await?
            .into_iter()
            .map(|r| r.data)
            .collect())
    }
}
