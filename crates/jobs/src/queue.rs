use crate::{TaskIdentifier, VISIBILITY_SECONDS};
use anyhow::{Context, Result, ensure};
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{BigInt, Bool, Integer, Jsonb, Nullable, Text},
};
use diesel_async::{AsyncConnection, RunQueryDsl};
use serde::{Deserialize, Serialize};
use std::time::Duration;

const MAX_ENQUEUE_BATCH: usize = 100;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum JobLane {
    Fast,
    Bulk,
}

impl JobLane {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Fast => "fast",
            Self::Bulk => "bulk",
        }
    }
}

#[derive(Debug, QueryableByName, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnqueuedJob {
    #[diesel(sql_type = Text)]
    pub id: String,
    #[diesel(sql_type = Text)]
    pub task_identifier: String,
    #[diesel(sql_type = Integer)]
    pub attempts: i32,
    #[diesel(sql_type = Integer)]
    pub max_attempts: i32,
}

#[derive(Clone, Debug)]
pub struct EnqueueRequest {
    pub task: TaskIdentifier,
    pub payload: serde_json::Value,
    pub lane: JobLane,
    pub key: Option<String>,
    pub delay: Duration,
}

#[derive(Clone, Debug, QueryableByName, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaimedJob {
    #[diesel(sql_type = Text)]
    pub lane: String,
    #[diesel(sql_type = Text)]
    pub id: String,
    #[diesel(sql_type = Text)]
    pub task: String,
    #[diesel(sql_type = Jsonb)]
    pub payload: serde_json::Value,
    #[diesel(sql_type = Integer)]
    pub attempts: i32,
    #[diesel(sql_type = Integer)]
    pub max_attempts: i32,
    #[diesel(sql_type = Text)]
    pub generation: String,
}

#[derive(QueryableByName)]
struct ExtensionVersion {
    #[diesel(sql_type = Text)]
    extversion: String,
}

#[derive(QueryableByName)]
struct BooleanResult {
    #[diesel(sql_type = Bool)]
    ok: bool,
}

#[derive(QueryableByName)]
struct PendingPayload {
    #[diesel(sql_type = Jsonb)]
    payload: serde_json::Value,
}

#[derive(Clone)]
pub struct Queue {
    partition: zc_database::PoolPartition,
}

impl Queue {
    pub async fn connect(partition: zc_database::PoolPartition) -> Result<Self> {
        let queue = Self::deferred(partition);
        queue.verify_contract().await?;
        Ok(queue)
    }

    pub fn deferred(partition: zc_database::PoolPartition) -> Self {
        Self { partition }
    }

    pub async fn verify_contract(&self) -> Result<()> {
        let mut connection = self.partition.connection().await?;
        let version: ExtensionVersion =
            sql_query("SELECT extversion FROM pg_extension WHERE extname='pgmq'")
                .get_result(&mut connection)
                .await
                .context("pgmq extension is missing")?;
        ensure!(
            version.extversion == "1.12.0",
            "pgmq 1.12.0 migration required"
        );
        sql_query(
            "SELECT 'zc_jobs.job'::regclass, 'zc_jobs.claim(text,integer,integer)'::regprocedure",
        )
        .execute(&mut connection)
        .await
        .context("zc_jobs queue schema is missing")?;
        Ok(())
    }

    pub async fn enqueue(
        &self,
        task: TaskIdentifier,
        payload: serde_json::Value,
        lane: JobLane,
        key: Option<&str>,
    ) -> Result<EnqueuedJob> {
        self.enqueue_after(task, payload, lane, key, Duration::ZERO)
            .await
    }

    pub async fn enqueue_after(
        &self,
        task: TaskIdentifier,
        payload: serde_json::Value,
        lane: JobLane,
        key: Option<&str>,
        delay: Duration,
    ) -> Result<EnqueuedJob> {
        let request = EnqueueRequest {
            task,
            payload,
            lane,
            key: key.map(str::to_owned),
            delay,
        };
        let mut jobs = self.enqueue_many(vec![request]).await?;
        Ok(jobs.remove(0))
    }

    pub async fn enqueue_many(&self, requests: Vec<EnqueueRequest>) -> Result<Vec<EnqueuedJob>> {
        ensure!(!requests.is_empty(), "enqueue batch must not be empty");
        ensure!(
            requests.len() <= MAX_ENQUEUE_BATCH,
            "enqueue batch exceeds {MAX_ENQUEUE_BATCH} jobs"
        );
        let mut connection = self.partition.connection().await?;
        let mut jobs = Vec::with_capacity(requests.len());
        for request in requests {
            ensure!(
                request.task.validate_payload(&request.payload),
                "Invalid queued task: {}",
                request.task.as_str()
            );
            let (derived_key, group) = queue_identity(
                request.task,
                &request.payload,
                request.lane,
                request.key.as_deref(),
            );
            let delay_ms = i64::try_from(request.delay.as_millis())?;
            let job = sql_query("SELECT zc_jobs.enqueue($1,$2,$3,$4,$5,$6,clock_timestamp()+$7*interval '1 millisecond')::text AS id, $2::text AS task_identifier, 0::integer AS attempts, $6::integer AS max_attempts")
                .bind::<Text, _>(request.lane.as_str())
                .bind::<Text, _>(request.task.as_str())
                .bind::<Jsonb, _>(request.payload)
                .bind::<Nullable<Text>, _>(derived_key)
                .bind::<Nullable<Text>, _>(group)
                .bind::<Integer, _>(request.task.max_attempts())
                .bind::<BigInt, _>(delay_ms)
                .get_result(&mut connection)
                .await?;
            jobs.push(job);
        }
        Ok(jobs)
    }

    pub async fn enqueue_level_projection(
        &self,
        id_level: i32,
        after_user_id: i32,
    ) -> Result<EnqueuedJob> {
        ensure!(id_level > 0 && after_user_id >= 0, "invalid level cursor");
        let key = format!("update-level-contributions:{id_level}");
        let group = format!("level-maintenance-shard:{}", id_level.rem_euclid(4));
        let mut connection = self.partition.connection().await?;
        connection.transaction::<EnqueuedJob, anyhow::Error, _>(|connection| Box::pin(async move {
            sql_query("SELECT zc_jobs.lock_lane('bulk')").execute(connection).await?;
            let pending = sql_query("SELECT payload FROM zc_jobs.job WHERE lane='bulk' AND job_key=$1 AND NOT running ORDER BY id LIMIT 1")
                .bind::<Text,_>(&key).get_result::<PendingPayload>(connection).await.optional()?;
            let cursor = pending.as_ref().and_then(|row|row.payload["afterUserId"].as_i64())
                .and_then(|value|i32::try_from(value).ok()).map_or(after_user_id, |value| value.min(after_user_id));
            let payload = serde_json::json!({"idLevel":id_level,"afterUserId":cursor});
            Ok(sql_query("SELECT zc_jobs.enqueue('bulk',$1,$2,$3,$4,$5,clock_timestamp())::text AS id, $1::text AS task_identifier, 0::integer AS attempts, $5::integer AS max_attempts")
                .bind::<Text,_>(TaskIdentifier::UpdateLevelContributions.as_str())
                .bind::<Jsonb,_>(payload).bind::<Text,_>(&key).bind::<Text,_>(&group)
                .bind::<Integer,_>(TaskIdentifier::UpdateLevelContributions.max_attempts())
                .get_result(connection).await?)
        })).await
    }

    pub async fn claim(&self, lane: JobLane, count: i32) -> Result<Vec<ClaimedJob>> {
        ensure!(count > 0, "Claim count must be positive");
        let mut connection = self.partition.connection().await?;
        Ok(sql_query("SELECT lane,id::text,task,payload,attempts,max_attempts,generation::text FROM zc_jobs.claim($1,$2,$3)")
            .bind::<Text, _>(lane.as_str()).bind::<Integer, _>(count).bind::<Integer, _>(VISIBILITY_SECONDS)
            .load(&mut connection).await?)
    }

    pub async fn has_fast_level_score(&self, id_level: i32) -> Result<bool> {
        ensure!(id_level > 0, "idLevel must be positive");
        let mut connection = self.partition.connection().await?;
        let result: BooleanResult = sql_query(
            "SELECT EXISTS(SELECT 1 FROM zc_jobs.job WHERE lane='fast' AND task='updateLevelScore' AND job_key=$1) AS ok",
        )
        .bind::<Text, _>(format!("update-level-score:{id_level}"))
        .get_result(&mut connection)
        .await?;
        Ok(result.ok)
    }

    pub async fn heartbeat(&self, job: &ClaimedJob) -> Result<bool> {
        self.finish_call(
            "SELECT zc_jobs.heartbeat($1,$2::bigint,$3::bigint,$4) AS ok",
            job,
            None,
        )
        .await
    }

    pub async fn finish(&self, job: &ClaimedJob, failure: Option<&str>) -> Result<bool> {
        self.finish_call(
            "SELECT zc_jobs.finish($1,$2::bigint,$3::bigint,$4) AS ok",
            job,
            failure,
        )
        .await
    }

    pub async fn defer(&self, job: &ClaimedJob) -> Result<bool> {
        let delay = defer_delay(job.payload["deferCount"].as_u64().unwrap_or(0));
        let delay_ms = i64::try_from(delay.as_millis())?;
        let mut connection = self.partition.connection().await?;
        connection.transaction::<bool, anyhow::Error, _>(|connection| Box::pin(async move {
            sql_query("SELECT zc_jobs.lock_lane($1)").bind::<Text,_>(&job.lane).execute(connection).await?;
            let current: BooleanResult = sql_query("SELECT EXISTS(SELECT 1 FROM zc_jobs.job WHERE lane=$1 AND id=$2::bigint AND generation=$3::bigint AND running AND lease_until>clock_timestamp()) AS ok")
                .bind::<Text,_>(&job.lane).bind::<Text,_>(&job.id).bind::<Text,_>(&job.generation)
                .get_result(connection).await?;
            if !current.ok { return Ok(false); }
            let superseded: BooleanResult = sql_query("SELECT EXISTS(SELECT 1 FROM zc_jobs.job active JOIN zc_jobs.job pending ON pending.lane=active.lane AND pending.job_key=active.job_key AND pending.id<>active.id AND NOT pending.running WHERE active.lane=$1 AND active.id=$2::bigint AND active.job_key IS NOT NULL) AS ok")
                .bind::<Text,_>(&job.lane).bind::<Text,_>(&job.id).get_result(connection).await?;
            if superseded.ok {
                let result: BooleanResult = sql_query("SELECT zc_jobs.finish($1,$2::bigint,$3::bigint,NULL) AS ok")
                    .bind::<Text,_>(&job.lane).bind::<Text,_>(&job.id).bind::<Text,_>(&job.generation)
                    .get_result(connection).await?;
                return Ok(result.ok);
            }
            sql_query("UPDATE zc_jobs.job SET running=false,lease_until=NULL,attempts=GREATEST(0,attempts-1),payload=jsonb_set(payload,'{deferCount}',to_jsonb(LEAST(4,COALESCE((payload->>'deferCount')::integer,0)+1))) WHERE lane=$1 AND id=$2::bigint AND generation=$3::bigint")
                .bind::<Text,_>(&job.lane).bind::<Text,_>(&job.id).bind::<Text,_>(&job.generation).execute(connection).await?;
            let statement = match job.lane.as_str() {
                "fast" => "UPDATE pgmq.q_zeepcentraal_fast SET vt=clock_timestamp()+$1*interval '1 millisecond' WHERE msg_id=$2::bigint",
                "bulk" => "UPDATE pgmq.q_zeepcentraal_bulk SET vt=clock_timestamp()+$1*interval '1 millisecond' WHERE msg_id=$2::bigint",
                _ => anyhow::bail!("invalid job lane"),
            };
            let updated = sql_query(statement).bind::<BigInt,_>(delay_ms).bind::<Text,_>(&job.id).execute(connection).await?;
            ensure!(updated == 1, "job queue message missing during deferral");
            Ok(true)
        })).await
    }

    async fn finish_call(
        &self,
        query: &str,
        job: &ClaimedJob,
        failure: Option<&str>,
    ) -> Result<bool> {
        let mut connection = self.partition.connection().await?;
        let statement = sql_query(query)
            .bind::<Text, _>(&job.lane)
            .bind::<Text, _>(&job.id)
            .bind::<Text, _>(&job.generation);
        let result: BooleanResult = if query.contains("heartbeat") {
            statement
                .bind::<Integer, _>(VISIBILITY_SECONDS)
                .get_result(&mut connection)
                .await?
        } else {
            statement
                .bind::<Nullable<Text>, _>(failure)
                .get_result(&mut connection)
                .await?
        };
        Ok(result.ok)
    }
}

fn queue_identity(
    task: TaskIdentifier,
    payload: &serde_json::Value,
    lane: JobLane,
    explicit_key: Option<&str>,
) -> (Option<String>, Option<String>) {
    let id_level = payload.get("idLevel").and_then(serde_json::Value::as_i64);
    let derived_key = match task {
        TaskIdentifier::UpdateLevelScore => id_level.map(|id| format!("update-level-score:{id}")),
        TaskIdentifier::UpdateLevelContributions => id_level.and_then(|id_level| {
            if payload
                .get("afterUserId")
                .and_then(serde_json::Value::as_i64)
                .is_some()
            {
                Some(format!("update-level-contributions:{id_level}"))
            } else {
                let token = payload.get("projectionToken")?.as_str()?;
                let id_user = payload.get("idUser")?.as_i64()?;
                if lane == JobLane::Fast {
                    Some(format!(
                        "update-level-contribution-submit:{id_level}:{id_user}:{token}"
                    ))
                } else {
                    Some(format!("update-level-contribution:{id_level}:{id_user}"))
                }
            }
        }),
        _ => None,
    };
    let key = derived_key.or_else(|| explicit_key.map(str::to_owned));
    let group = if lane == JobLane::Fast
        && matches!(
            task,
            TaskIdentifier::UpdateLevelScore | TaskIdentifier::UpdateLevelContributions
        ) {
        id_level.map(|id| format!("fast-level-maintenance:{id}"))
    } else if lane == JobLane::Bulk
        && matches!(
            task,
            TaskIdentifier::UpdateLevelScore | TaskIdentifier::UpdateLevelContributions
        )
    {
        id_level.map(|id| format!("level-maintenance-shard:{}", id.rem_euclid(4)))
    } else if lane == JobLane::Bulk
        && matches!(
            task,
            TaskIdentifier::UpdateLevelScores
                | TaskIdentifier::UpdatePlayerScores
                | TaskIdentifier::UpdatePlayerScore
        )
    {
        Some("global-scores".to_owned())
    } else {
        None
    };
    (key, group)
}

pub fn defer_delay(defer_count: u64) -> Duration {
    const DELAYS_MS: [u64; 5] = [250, 500, 1_000, 2_000, 5_000];
    Duration::from_millis(DELAYS_MS[(defer_count as usize).min(4)])
}

#[cfg(test)]
mod tests {
    use super::{JobLane, defer_delay, queue_identity};
    use crate::TaskIdentifier;
    use serde_json::json;
    use std::time::Duration;

    #[test]
    fn deferred_job_backoff_caps_at_five_seconds() {
        assert_eq!(defer_delay(0), Duration::from_millis(250));
        assert_eq!(defer_delay(1), Duration::from_millis(500));
        assert_eq!(defer_delay(2), Duration::from_secs(1));
        assert_eq!(defer_delay(3), Duration::from_secs(2));
        assert_eq!(defer_delay(4), Duration::from_secs(5));
        assert_eq!(defer_delay(100), Duration::from_secs(5));
    }

    #[test]
    fn derives_stable_level_and_projection_identities() {
        assert_eq!(
            queue_identity(
                TaskIdentifier::UpdateLevelScore,
                &json!({"idLevel": 17}),
                JobLane::Fast,
                None,
            ),
            (
                Some("update-level-score:17".to_owned()),
                Some("fast-level-maintenance:17".to_owned())
            )
        );
        assert_eq!(
            queue_identity(
                TaskIdentifier::UpdateLevelContributions,
                &json!({"idLevel": 17, "afterUserId": 50}),
                JobLane::Bulk,
                None,
            ),
            (
                Some("update-level-contributions:17".to_owned()),
                Some("level-maintenance-shard:1".to_owned())
            )
        );
        assert_eq!(
            queue_identity(
                TaskIdentifier::UpdateLevelContributions,
                &json!({"idLevel": 17, "idUser": 2, "projectionToken": "b", "deferCount": 0}),
                JobLane::Bulk,
                None,
            )
            .0,
            Some("update-level-contribution:17:2".to_owned())
        );
    }

    #[test]
    fn projection_generations_coalesce() {
        let first = queue_identity(
            TaskIdentifier::UpdateLevelContributions,
            &json!({"idLevel": 1, "afterUserId": 0, "projectionToken": "first"}),
            JobLane::Bulk,
            None,
        );
        let second = queue_identity(
            TaskIdentifier::UpdateLevelContributions,
            &json!({"idLevel": 1, "afterUserId": 0, "projectionToken": "second"}),
            JobLane::Bulk,
            None,
        );
        assert_eq!(first.0, second.0);
    }

    #[test]
    fn fast_submitters_keep_separate_keys_and_share_level_ordering() {
        let score = queue_identity(
            TaskIdentifier::UpdateLevelScore,
            &json!({"idLevel": 17, "idUser": 2}),
            JobLane::Fast,
            None,
        );
        let first = queue_identity(
            TaskIdentifier::UpdateLevelContributions,
            &json!({"idLevel": 17, "idUser": 2, "projectionToken": "100", "deferCount": 0}),
            JobLane::Fast,
            None,
        );
        let second = queue_identity(
            TaskIdentifier::UpdateLevelContributions,
            &json!({"idLevel": 17, "idUser": 3, "projectionToken": "101", "deferCount": 0}),
            JobLane::Fast,
            None,
        );
        assert_eq!(score.1, first.1);
        assert_eq!(score.1, second.1);
        assert_ne!(first.0, second.0);
        assert_eq!(
            first.0,
            Some("update-level-contribution-submit:17:2:100".to_owned())
        );
    }
}
