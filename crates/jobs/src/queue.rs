use crate::{TaskIdentifier, VISIBILITY_SECONDS};
use anyhow::{Context, Result, ensure};
use diesel::{
    QueryableByName, sql_query,
    sql_types::{Bool, Integer, Jsonb, Nullable, Text},
};
use diesel_async::RunQueryDsl;
use serde::{Deserialize, Serialize};

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
        ensure!(
            task.validate_payload(&payload),
            "Invalid queued task: {}",
            task.as_str()
        );
        let group = if lane == JobLane::Bulk
            && matches!(
                task,
                TaskIdentifier::UpdateLevelScores
                    | TaskIdentifier::UpdatePlayerScores
                    | TaskIdentifier::UpdatePlayerScore
            ) {
            Some("global-scores")
        } else {
            None
        };
        let mut connection = self.partition.connection().await?;
        let job = sql_query("SELECT zc_jobs.enqueue($1,$2,$3,$4,$5,$6,clock_timestamp())::text AS id, $2::text AS task_identifier, 0::integer AS attempts, $6::integer AS max_attempts")
            .bind::<Text, _>(lane.as_str())
            .bind::<Text, _>(task.as_str())
            .bind::<Jsonb, _>(payload)
            .bind::<Nullable<Text>, _>(key)
            .bind::<Nullable<Text>, _>(group)
            .bind::<Integer, _>(task.max_attempts())
            .get_result(&mut connection).await?;
        Ok(job)
    }

    pub async fn claim(&self, lane: JobLane, count: i32) -> Result<Vec<ClaimedJob>> {
        ensure!(count > 0, "Claim count must be positive");
        let mut connection = self.partition.connection().await?;
        Ok(sql_query("SELECT lane,id::text,task,payload,attempts,max_attempts,generation::text FROM zc_jobs.claim($1,$2,$3)")
            .bind::<Text, _>(lane.as_str()).bind::<Integer, _>(count).bind::<Integer, _>(VISIBILITY_SECONDS)
            .load(&mut connection).await?)
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
