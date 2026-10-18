use crate::Database;
use anyhow::{Result, ensure};
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{Array, BigInt, Bool, Float, Integer, Jsonb, Nullable, Text},
};
use diesel_async::{AsyncPgConnection, RunQueryDsl};
use serde::Serialize;
use serde_json::Value;
use zc_core::ghost_validation::{VALIDATOR_VERSION, ValidationReport};

pub const AUDIT_WINDOW_SIZE: usize = 1_000;

const AUDIT_WINDOW_QUERY: &str = r#"
WITH records AS MATERIALIZED (
 SELECT r.id,r.id_level FROM public.record r
 WHERE r.id>$1 AND r.id<=$8
   AND NOT EXISTS(SELECT 1 FROM zc_private.record_validation terminal WHERE terminal.id_record=r.id AND terminal.status='fail')
   AND ($2::integer IS NULL OR r.id=$2)
   AND ($3::integer IS NULL OR r.id_level=$3)
   AND ($4::bigint IS NULL OR EXISTS(SELECT 1 FROM public.level_item o WHERE o.id_level=r.id_level AND o.workshop_id=$4))
   AND ($5::text IS NULL OR r.date_created >= $5::timestamptz)
   AND ($6::text IS NULL OR r.date_created < $6::timestamptz)
 ORDER BY r.id LIMIT 1000
)
SELECT r.id,r.id_level,l.xx_hash AS canonical_hash,l.validation_inputs_updated_at::text AS checked_at,l.validation_metadata_updated_at::text AS checked_metadata_at,
 EXISTS(SELECT 1 FROM public.record_media m WHERE m.id_record=r.id AND nullif(btrim(m.ghost_url),'') IS NOT NULL) AS has_ghost,
 ((cardinality($7::text[])=0 OR coalesce(v.report->'reasons' ?| $7,false))
  AND CASE WHEN v.status='fail' THEN false
       WHEN v.status='uncertain' THEN l.validation_metadata_updated_at>v.checked_metadata_at
       ELSE v.id IS NULL OR v.checked_at IS NULL OR v.validator_version<>$9
         OR v.id_level<>r.id_level OR l.validation_inputs_updated_at IS DISTINCT FROM v.checked_at
       END) AS needs_check
FROM records r JOIN public.level l ON l.id=r.id_level
LEFT JOIN zc_private.record_validation v ON v.id_record=r.id
ORDER BY r.id
"#;

const AUDIT_LEVEL_WINDOW_QUERY: &str = r#"
WITH records AS MATERIALIZED (
 SELECT r.id,r.id_level FROM public.record r
 WHERE r.id>$1 AND r.id<=$8
   AND NOT EXISTS(SELECT 1 FROM zc_private.record_validation terminal WHERE terminal.id_record=r.id AND terminal.status='fail')
   AND ($2::integer IS NULL OR r.id=$2)
   AND ($3::integer IS NULL OR r.id_level=$3)
   AND ($4::bigint IS NULL OR EXISTS(SELECT 1 FROM public.level_item o WHERE o.id_level=r.id_level AND o.workshop_id=$4))
   AND ($5::text IS NULL OR r.date_created >= $5::timestamptz)
   AND ($6::text IS NULL OR r.date_created < $6::timestamptz)
 AND (r.id_level,r.id)>($10,$11)
 AND (cardinality($12::integer[])=0 OR r.id_level=ANY($12))
 AND (cardinality($13::integer[])=0 OR r.id=ANY($13))
 ORDER BY r.id_level,r.id LIMIT 1000
)
SELECT r.id,r.id_level,l.xx_hash AS canonical_hash,l.validation_inputs_updated_at::text AS checked_at,l.validation_metadata_updated_at::text AS checked_metadata_at,
 EXISTS(SELECT 1 FROM public.record_media m WHERE m.id_record=r.id AND nullif(btrim(m.ghost_url),'') IS NOT NULL) AS has_ghost,
 ((cardinality($7::text[])=0 OR coalesce(v.report->'reasons' ?| $7,false))
  AND CASE WHEN v.status='fail' THEN false
       WHEN v.status='uncertain' THEN l.validation_metadata_updated_at>v.checked_metadata_at
       ELSE v.id IS NULL OR v.checked_at IS NULL OR v.validator_version<>$9
         OR v.id_level<>r.id_level OR l.validation_inputs_updated_at IS DISTINCT FROM v.checked_at
       END) AS needs_check
FROM records r JOIN public.level l ON l.id=r.id_level
LEFT JOIN zc_private.record_validation v ON v.id_record=r.id
ORDER BY r.id_level,r.id
"#;

const PERSIST_VALIDATIONS_QUERY: &str = r#"
INSERT INTO zc_private.record_validation AS existing
 (id_record,id_user,id_level,ghost_digest,status,report,validator_version,checked_at,checked_metadata_at)
SELECT r.id,r.id_user,r.id_level,$2,$3,$4,$5,$6::text::timestamptz,coalesce($7::text::timestamptz,'epoch')
FROM public.record r WHERE r.id=ANY($1) AND ($8::integer IS NULL OR r.id_level=$8) ORDER BY r.id
ON CONFLICT(id_record) DO UPDATE SET
 id_user=EXCLUDED.id_user,id_level=EXCLUDED.id_level,
 ghost_digest=CASE WHEN ROW(existing.status,existing.report,existing.validator_version)
   IS DISTINCT FROM ROW(EXCLUDED.status,EXCLUDED.report,EXCLUDED.validator_version)
   THEN EXCLUDED.ghost_digest ELSE existing.ghost_digest END,
 status=EXCLUDED.status,report=EXCLUDED.report,validator_version=EXCLUDED.validator_version,
 updated_at=CASE WHEN ROW(existing.status,existing.report,existing.validator_version)
   IS DISTINCT FROM ROW(EXCLUDED.status,EXCLUDED.report,EXCLUDED.validator_version)
   THEN clock_timestamp() ELSE existing.updated_at END,
 checked_at=coalesce(EXCLUDED.checked_at,existing.checked_at),checked_metadata_at=EXCLUDED.checked_metadata_at
WHERE existing.status<>'fail'
 AND (existing.status<>'uncertain' OR EXCLUDED.checked_metadata_at>existing.checked_metadata_at)
 AND (existing.checked_at IS NULL OR EXCLUDED.checked_at IS NULL OR EXCLUDED.checked_at>=existing.checked_at)
 AND (ROW(existing.status,existing.report,existing.validator_version)
   IS DISTINCT FROM ROW(EXCLUDED.status,EXCLUDED.report,EXCLUDED.validator_version)
   OR (EXCLUDED.checked_at IS NOT NULL AND existing.checked_at IS DISTINCT FROM EXCLUDED.checked_at)
   OR existing.checked_metadata_at IS DISTINCT FROM EXCLUDED.checked_metadata_at)
"#;

#[derive(Clone, Debug, QueryableByName)]
pub struct AuditWindowRecord {
    #[diesel(sql_type=Integer)]
    pub id: i32,
    #[diesel(sql_type=Integer)]
    pub id_level: i32,
    #[diesel(sql_type=Text)]
    pub canonical_hash: String,
    #[diesel(sql_type=Text)]
    pub checked_at: String,
    #[diesel(sql_type=Text)]
    pub checked_metadata_at: String,
    #[diesel(sql_type=Bool)]
    pub has_ghost: bool,
    #[diesel(sql_type=Bool)]
    pub needs_check: bool,
}

/// Input markers captured before validation; never refresh these after computing evidence.
#[derive(Clone, Debug, Eq, PartialEq, QueryableByName)]
pub struct ValidationCheckTimestamp {
    #[diesel(sql_type=Nullable<Integer>)]
    pub id_level: Option<i32>,
    #[diesel(sql_type=Text)]
    pub checked_at: String,
    #[diesel(sql_type=Text)]
    pub checked_metadata_at: String,
}
impl AuditWindowRecord {
    pub fn timestamp(&self) -> ValidationCheckTimestamp {
        ValidationCheckTimestamp {
            id_level: Some(self.id_level),
            checked_at: self.checked_at.clone(),
            checked_metadata_at: self.checked_metadata_at.clone(),
        }
    }
}

const ADMIN_VALIDATIONS_QUERY: &str = r#"
SELECT (to_jsonb(v)-'checked_metadata_at') || jsonb_build_object('id',v.id::text,'id_level',v.id_level::text,'level_xx_hash',l.xx_hash,'report',v.report || jsonb_build_object('status',v.status,'validatorVersion',v.validator_version)) AS data
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
    pub checked_at: ValidationCheckTimestamp,
}
pub async fn persist_validation(
    connection: &mut AsyncPgConnection,
    id_record: i32,
    digest: Option<&str>,
    report: &ValidationReport,
    checked_at: Option<&ValidationCheckTimestamp>,
) -> Result<()> {
    persist_validations(connection, &[id_record], digest, report, checked_at).await
}
async fn persist_validations(
    connection: &mut AsyncPgConnection,
    ids: &[i32],
    digest: Option<&str>,
    report: &ValidationReport,
    checked_at: Option<&ValidationCheckTimestamp>,
) -> Result<()> {
    ensure!(
        !report.comparison,
        "Candidate comparisons must not be persisted"
    );
    ensure!(
        ids.len() <= AUDIT_WINDOW_SIZE,
        "Validation batch exceeds limit"
    );
    sql_query(PERSIST_VALIDATIONS_QUERY)
        .bind::<Array<Integer>, _>(ids)
        .bind::<Nullable<Text>, _>(digest)
        .bind::<Text, _>(&report.status)
        .bind::<Jsonb, _>(compact_report(report)?)
        .bind::<Text, _>(&report.validator_version)
        .bind::<Nullable<Text>, _>(checked_at.map(|stamp| stamp.checked_at.as_str()))
        .bind::<Nullable<Text>, _>(checked_at.map(|stamp| stamp.checked_metadata_at.as_str()))
        .bind::<Nullable<Integer>, _>(checked_at.and_then(|stamp| stamp.id_level))
        .execute(connection)
        .await?;
    Ok(())
}
fn compact_report(report: &ValidationReport) -> Result<Value> {
    let mut value = serde_json::to_value(report)?;
    let object = value.as_object_mut().expect("validation report object");
    object.remove("status");
    object.remove("validatorVersion");
    Ok(value)
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
        persist_validation(&mut connection, record, digest, report, None).await
    }
    pub async fn audit_record(&self, id: i32) -> Result<Option<AuditRecord>> {
        self.load_audit_record(id, false).await
    }
    /// Evidence remains readable; only validators apply the terminal/metadata gate.
    pub async fn audit_record_for_validation(&self, id: i32) -> Result<Option<AuditRecord>> {
        self.load_audit_record(id, true).await
    }
    async fn load_audit_record(&self, id: i32, validation: bool) -> Result<Option<AuditRecord>> {
        let mut c = self.connection().await?;
        Ok(sql_query("SELECT r.id,r.id_user,r.id_level,coalesce(u.steam_id::text,'') AS steam_id,l.hash AS level_uid,l.xx_hash AS canonical_hash,r.game_version::text,r.time,coalesce(r.splits,ARRAY[]::real[]) AS splits,coalesce(r.speeds,ARRAY[]::real[]) AS speeds,(SELECT ghost_url FROM public.record_media WHERE id_record=r.id) AS ghost_url FROM public.record r JOIN public.level l ON l.id=r.id_level JOIN public.\"user\" u ON u.id=r.id_user WHERE r.id=$1 AND (NOT $2 OR NOT EXISTS(SELECT 1 FROM zc_private.record_validation v WHERE v.id_record=r.id AND (v.status='fail' OR (v.status='uncertain' AND v.checked_metadata_at>=l.validation_metadata_updated_at))))")
  .bind::<Integer,_>(id).bind::<Bool,_>(validation).get_result(&mut c).await.optional()?)
    }
    pub async fn validation_check_timestamp_for_hash(
        &self,
        hash: &str,
    ) -> Result<ValidationCheckTimestamp> {
        Ok(sql_query("SELECT l.id AS id_level,coalesce(l.validation_inputs_updated_at,'epoch'::timestamptz)::text AS checked_at,coalesce(l.validation_metadata_updated_at,'epoch'::timestamptz)::text AS checked_metadata_at FROM (SELECT 1) seed LEFT JOIN public.level l ON l.xx_hash=$1")
            .bind::<Text,_>(hash)
            .get_result(&mut self.connection().await?).await?)
    }
    pub async fn validation_check_timestamp(
        &self,
        id_level: i32,
    ) -> Result<ValidationCheckTimestamp> {
        Ok(sql_query("SELECT id AS id_level,validation_inputs_updated_at::text AS checked_at,validation_metadata_updated_at::text AS checked_metadata_at FROM public.level WHERE id=$1")
            .bind::<Integer,_>(id_level)
            .get_result(&mut self.connection().await?).await?)
    }
    pub async fn audit_upper_record_id(&self) -> Result<i32> {
        #[derive(QueryableByName)]
        struct Id {
            #[diesel(sql_type=Integer)]
            id: i32,
        }
        Ok(
            sql_query("SELECT coalesce(max(id),0) AS id FROM public.record")
                .get_result::<Id>(&mut self.connection().await?)
                .await?
                .id,
        )
    }
    pub async fn save_checked_record_validations(
        &self,
        ids: &[i32],
        digest: Option<&str>,
        report: &ValidationReport,
        checked_at: &ValidationCheckTimestamp,
    ) -> Result<()> {
        let mut connection = self.connection().await?;
        persist_validations(&mut connection, ids, digest, report, Some(checked_at)).await
    }
    pub async fn audit_record_window(
        &self,
        filter: &Value,
        through_id: i32,
    ) -> Result<Vec<AuditWindowRecord>> {
        let integer = |key: &str| filter[key].as_i64().and_then(|v| i32::try_from(v).ok());
        let reasons: Vec<String> = filter["reasons"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|v| v.as_str().map(str::to_owned))
            .collect();
        Ok(sql_query(AUDIT_WINDOW_QUERY)
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
            .bind::<Integer, _>(through_id)
            .bind::<Text, _>(VALIDATOR_VERSION)
            .load(&mut self.connection().await?)
            .await?)
    }
    pub async fn audit_level_window(
        &self,
        filter: &Value,
        through_id: i32,
    ) -> Result<Vec<AuditWindowRecord>> {
        let integer = |key: &str| filter[key].as_i64().and_then(|v| i32::try_from(v).ok());
        let reasons: Vec<String> = filter["reasons"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|v| v.as_str().map(str::to_owned))
            .collect();
        Ok(sql_query(AUDIT_LEVEL_WINDOW_QUERY)
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
            .bind::<Integer, _>(through_id)
            .bind::<Text, _>(VALIDATOR_VERSION)
            .bind::<Integer, _>(integer("afterLevelId").unwrap_or(0))
            .bind::<Integer, _>(integer("afterLevelRecordId").unwrap_or(0))
            .bind::<Array<Integer>, _>(
                filter["idLevels"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter_map(|v| v.as_i64().and_then(|n| i32::try_from(n).ok()))
                    .collect::<Vec<_>>(),
            )
            .bind::<Array<Integer>, _>(
                filter["recordIds"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter_map(|v| v.as_i64().and_then(|n| i32::try_from(n).ok()))
                    .collect::<Vec<_>>(),
            )
            .load(&mut self.connection().await?)
            .await?)
    }
    // Retained maintenance interface; skip empty eligible windows without stopping traversal.
    pub async fn audit_record_ids(&self, filter: &Value) -> Result<Vec<i32>> {
        let through_id = match filter["throughId"]
            .as_i64()
            .and_then(|id| i32::try_from(id).ok())
        {
            Some(id) => id,
            None => self.audit_upper_record_id().await?,
        };
        let mut cursor = filter.clone();
        let mut ids = Vec::new();
        loop {
            let window = self.audit_record_window(&cursor, through_id).await?;
            ids.extend(
                window
                    .iter()
                    .filter(|r| r.needs_check)
                    .map(|r| r.id)
                    .take(100 - ids.len()),
            );
            if ids.len() == 100 || window.len() < AUDIT_WINDOW_SIZE {
                break;
            }
            cursor["afterId"] = serde_json::json!(window.last().expect("full window").id);
        }
        Ok(ids)
    }
    pub async fn validation_candidates(&self, id_level: i32) -> Result<Vec<LevelSnapshot>> {
        let mut c = self.connection().await?;
        Ok(sql_query("SELECT l.id::bigint AS id,l.id AS id_level,l.xx_hash AS canonical_hash,m.format,m.blocks,m.environment,m.type_ground,m.type_skybox,ARRAY(SELECT DISTINCT file_uid FROM public.level_item verified WHERE verified.id_level=l.id) AS file_uids FROM public.level l JOIN public.level_metadata m ON m.id_level=l.id WHERE l.xx_hash IS NOT NULL AND pg_column_size(m.blocks)<=4194304 AND (l.id=$1 OR EXISTS(SELECT 1 FROM public.level_item candidate JOIN public.level_item origin ON origin.workshop_id=candidate.workshop_id WHERE candidate.id_level=l.id AND origin.id_level=$1)) ORDER BY (l.id=$1) DESC,l.id DESC,m.id DESC LIMIT 16")
  .bind::<Integer,_>(id_level).load::<LevelSnapshot>(&mut c).await?)
    }
    pub async fn record_validation_attempts(&self, id: i32) -> Result<Vec<Value>> {
        let mut connection = self.connection().await?;
        Ok(sql_query("SELECT (to_jsonb(v)-'checked_metadata_at') || jsonb_build_object('id',v.id::text,'id_level',v.id_level::text,'level_xx_hash',l.xx_hash,'report',v.report || jsonb_build_object('status',v.status,'validatorVersion',v.validator_version)) AS data FROM zc_private.record_validation v JOIN public.level l ON l.id=v.id_level WHERE v.id_record=$1").bind::<Integer,_>(id).load::<JsonRow>(&mut connection).await?.into_iter().map(|row|row.data).collect())
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
