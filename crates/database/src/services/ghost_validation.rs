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

const AUDIT_WINDOW_QUERY: &str = include_str!("../queries/ghost_validation/audit_window.sql");

const AUDIT_LEVEL_WINDOW_QUERY: &str =
    include_str!("../queries/ghost_validation/audit_level_window.sql");

const PERSIST_VALIDATIONS_QUERY: &str =
    include_str!("../queries/ghost_validation/persist_validations.sql");

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

const ADMIN_VALIDATIONS_QUERY: &str =
    include_str!("../queries/ghost_validation/admin_validations.sql");

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
        Ok(sql_query(include_str!(
            "../queries/ghost_validation/accepted_run_digest.sql"
        ))
        .bind::<Integer, _>(user)
        .bind::<Text, _>(run_uuid)
        .get_result::<Run>(&mut c)
        .await
        .optional()?
        .map(|r| r.payload_digest))
    }
    pub async fn validation_snapshot(&self, hash: &str) -> Result<Option<LevelSnapshot>> {
        let mut c = self.connection().await?;
        let rows = sql_query(include_str!(
            "../queries/ghost_validation/validation_snapshot.sql"
        ))
        .bind::<Text, _>(hash)
        .load::<LevelSnapshot>(&mut c)
        .await?;
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
        Ok(sql_query(include_str!(
            "../queries/ghost_validation/load_audit_record.sql"
        ))
        .bind::<Integer, _>(id)
        .bind::<Bool, _>(validation)
        .get_result(&mut c)
        .await
        .optional()?)
    }
    /// Recovery snapshots retain the complete original failure for compare-and-swap.
    pub async fn timing_failure_evidence(&self, id: i32) -> Result<Option<Value>> {
        Ok(sql_query(include_str!(
            "../queries/ghost_validation/timing_failure_evidence.sql"
        ))
        .bind::<Integer, _>(id)
        .get_result::<JsonRow>(&mut self.connection().await?)
        .await
        .optional()?
        .map(|row| row.data))
    }
    pub async fn recover_timing_failure(
        &self,
        id: i32,
        expected: &Value,
        digest: &str,
        report: &ValidationReport,
        checked: &ValidationCheckTimestamp,
    ) -> Result<bool> {
        #[derive(QueryableByName)]
        struct Recovered {
            #[diesel(sql_type=Bool)]
            ok: bool,
        }
        Ok(sql_query(include_str!(
            "../queries/ghost_validation/recover_timing_failure.sql"
        ))
        .bind::<Integer, _>(id)
        .bind::<Jsonb, _>(expected)
        .bind::<Text, _>(digest)
        .bind::<Jsonb, _>(serde_json::to_value(report)?)
        .bind::<Text, _>(&checked.checked_at)
        .bind::<Text, _>(&checked.checked_metadata_at)
        .get_result::<Recovered>(&mut self.connection().await?)
        .await?
        .ok)
    }
    pub async fn validation_check_timestamp_for_hash(
        &self,
        hash: &str,
    ) -> Result<ValidationCheckTimestamp> {
        Ok(sql_query(include_str!(
            "../queries/ghost_validation/validation_check_timestamp_for_hash.sql"
        ))
        .bind::<Text, _>(hash)
        .get_result(&mut self.connection().await?)
        .await?)
    }
    pub async fn validation_check_timestamp(
        &self,
        id_level: i32,
    ) -> Result<ValidationCheckTimestamp> {
        Ok(sql_query(include_str!(
            "../queries/ghost_validation/validation_check_timestamp.sql"
        ))
        .bind::<Integer, _>(id_level)
        .get_result(&mut self.connection().await?)
        .await?)
    }
    pub async fn audit_upper_record_id(&self) -> Result<i32> {
        #[derive(QueryableByName)]
        struct Id {
            #[diesel(sql_type=Integer)]
            id: i32,
        }
        Ok(sql_query(include_str!(
            "../queries/ghost_validation/audit_upper_record_id.sql"
        ))
        .get_result::<Id>(&mut self.connection().await?)
        .await?
        .id)
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
            .bind::<Bool, _>(filter["recoverTimingFailures"].as_bool().unwrap_or(false))
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
            .bind::<Bool, _>(filter["recoverTimingFailures"].as_bool().unwrap_or(false))
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
        Ok(sql_query(include_str!(
            "../queries/ghost_validation/validation_candidates.sql"
        ))
        .bind::<Integer, _>(id_level)
        .load::<LevelSnapshot>(&mut c)
        .await?)
    }
    pub async fn record_validation_attempts(&self, id: i32) -> Result<Vec<Value>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(include_str!(
            "../queries/ghost_validation/record_validation_attempts.sql"
        ))
        .bind::<Integer, _>(id)
        .load::<JsonRow>(&mut connection)
        .await?
        .into_iter()
        .map(|row| row.data)
        .collect())
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
