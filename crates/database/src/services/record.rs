use crate::{Database, services::Level};
use anyhow::{Result, ensure};
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{Array, BigInt, Bool, Float, Integer, Jsonb, Text, Varchar},
};
use diesel_async::{AsyncConnection, RunQueryDsl};
use opentelemetry::{KeyValue, global, metrics::Histogram};
use std::{future::Future, sync::OnceLock, time::Instant};
use zc_core::ghosts::GhostStatistics;

const LOCK_RECORD_LEVEL: &str = include_str!("../queries/records/lock_record_level.sql");
const INSERT_RECORD_MEDIA: &str = include_str!("../queries/records/insert_record_media.sql");
const SELECT_ID_USER_RECORD: &str = include_str!("../queries/records/select_id_user_record.sql");

const WORLD_RECORD_LOCK_NAMESPACE: i32 = 1_861_284_953;
const TRACK_TOURNAMENT_RESULT_LOCK_NAMESPACE: i32 = 1_953_744_432;

#[derive(Clone, Debug)]
pub struct RecordSubmission<'a> {
    pub evidence: Option<super::ghost_validation::AcceptedEvidence<'a>>,
    pub id_user: i32,
    pub id_level: i32,
    pub time: f32,
    pub game_version: &'a str,
    pub mod_version: &'a str,
    pub splits: &'a [f32],
    pub speeds: &'a [f32],
    pub statistics: &'a GhostStatistics,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecordSubmissionResult {
    pub id_record: i32,
    pub personal_best_changed: bool,
    pub tournament_result_changed: bool,
    pub world_record_user_ids: Vec<i32>,
}

#[derive(QueryableByName)]
struct IdRow {
    #[diesel(sql_type = Integer)]
    id: i32,
}

#[derive(QueryableByName)]
struct AcceptanceRow {
    #[diesel(sql_type = Text)]
    accepted_at: String,
}

#[derive(QueryableByName)]
struct TournamentRow {
    #[diesel(sql_type = Integer)]
    id: i32,
}

#[derive(QueryableByName)]
struct WorldRecordRow {
    #[diesel(sql_type = Integer)]
    id_user: i32,
    #[diesel(sql_type = Float)]
    time: f32,
}

async fn record_phase<T, E, F>(phase: &'static str, future: F) -> Result<T, E>
where
    F: Future<Output = Result<T, E>>,
{
    static DURATION: OnceLock<Histogram<f64>> = OnceLock::new();
    let started = Instant::now();
    let result = future.await;
    let outcome = if result.is_ok() { "ok" } else { "error" };
    DURATION
        .get_or_init(|| {
            global::meter("zeepcentraal-database")
                .f64_histogram("record.submit.phase.duration")
                .with_unit("s")
                .build()
        })
        .record(
            started.elapsed().as_secs_f64(),
            &[
                KeyValue::new("phase", phase),
                KeyValue::new("outcome", outcome),
            ],
        );
    if result.is_err() {
        tracing::error!(phase, "Record submission phase failed");
    }
    result
}

async fn record_optional_phase<T, F>(
    phase: &'static str,
    future: F,
) -> diesel::QueryResult<Option<T>>
where
    F: Future<Output = diesel::QueryResult<T>>,
{
    record_phase(phase, async { future.await.optional() }).await
}

impl Database {
    pub async fn resolve_submission_level(
        &self,
        hash: &str,
        xx_hash: &str,
        adventure: bool,
    ) -> Result<Option<Level>> {
        ensure!(!hash.is_empty(), "legacy level hash is empty");
        ensure!(
            xx_hash.len() == 32 && xx_hash.bytes().all(|byte| byte.is_ascii_hexdigit()),
            "XXH128 level hash is invalid"
        );
        let mut connection = self.connection().await?;
        connection
            .transaction::<Option<Level>, anyhow::Error, _>(async move |connection| {
                let by_xx = level_by_xx(connection, xx_hash).await?;
                let level = if let Some(level) = by_xx {
                    level
                } else {
                    let legacy = sql_query(include_str!("../queries/records/select_id_level.sql"))
                        .bind::<Text, _>(hash)
                        .get_result::<Level>(connection)
                        .await
                        .optional()?;
                    let verified_legacy = if let Some(level) = legacy
                        .filter(|level| level.xx_hash.is_empty() && (!adventure || level.adventure))
                    {
                        #[derive(QueryableByName)]
                        struct Blocks {
                            #[diesel(sql_type=Jsonb)]
                            blocks: serde_json::Value,
                            #[diesel(sql_type=Integer)]
                            format: i32,
                            #[diesel(sql_type=Integer)]
                            type_ground: i32,
                            #[diesel(sql_type=Integer)]
                            type_skybox: i32,
                        }
                        let stored = sql_query(include_str!(
                            "../queries/records/select_blocks_level_metadata.sql"
                        ))
                        .bind::<Integer, _>(level.id)
                        .get_result::<Blocks>(connection)
                        .await
                        .optional()?;
                        stored
                            .filter(|stored| {
                                let hash = match stored.format {
                                    1 => zc_core::levels::calculate_json_level_xxhash(
                                        &serde_json::json!({"blox":stored.blocks}).to_string(),
                                    ),
                                    0 => zc_core::levels::calculate_csv_blocks_xxhash(
                                        &stored.blocks,
                                        stored.type_skybox.into(),
                                        stored.type_ground.into(),
                                    ),
                                    _ => return false,
                                };
                                hash.is_ok_and(|hash| hash.eq_ignore_ascii_case(xx_hash))
                            })
                            .map(|_| level)
                    } else {
                        None
                    };
                    if let Some(level) = verified_legacy {
                        lock_level_workshop_items(connection, level.id).await?;
                        sql_query(include_str!("../queries/records/set_xx_hash_level.sql"))
                            .bind::<Integer, _>(level.id)
                            .bind::<Text, _>(xx_hash)
                            .execute(connection)
                            .await?;
                        level_by_xx(connection, xx_hash)
                            .await?
                            .expect("updated canonical level")
                    } else {
                        if adventure {
                            return Ok(None);
                        }
                        let created = sql_query(include_str!(
                            "../queries/records/resolve_submission_level_insert_level.sql"
                        ))
                        .bind::<Text, _>(hash)
                        .bind::<Text, _>(xx_hash)
                        .bind::<Bool, _>(false)
                        .get_result::<IdRow>(connection)
                        .await
                        .optional()?;
                        let _ = created;
                        level_by_xx(connection, xx_hash)
                            .await?
                            .ok_or_else(|| anyhow::anyhow!("failed to resolve canonical level"))?
                    }
                };
                Ok((!adventure || level.adventure).then_some(level))
            })
            .await
    }

    pub async fn submit_record(
        &self,
        input: RecordSubmission<'_>,
    ) -> Result<RecordSubmissionResult> {
        ensure!(
            input.id_user > 0 && input.id_level > 0,
            "record IDs must be positive"
        );
        ensure!(
            input.time.is_finite() && input.time > 0.0,
            "record time is invalid"
        );
        ensure!(
            input.splits.iter().all(|value| value.is_finite())
                && input.speeds.iter().all(|value| value.is_finite()),
            "record checkpoint values are invalid"
        );
        let statistics = serde_json::to_value(input.statistics)?;
        let mut connection = self.connection().await?;
        connection
            .transaction::<RecordSubmissionResult, anyhow::Error, _>(async move |connection| {
                sql_query(LOCK_RECORD_LEVEL)
                    .bind::<Integer, _>(super::record_eligibility::LEVEL_LOCK_NAMESPACE)
                    .bind::<Integer, _>(input.id_level)
                    .execute(connection)
                    .await?;
                if let Some(evidence) = &input.evidence
                    && let Some(run_uuid) = evidence.run_uuid
                {
                    sql_query(include_str!("../queries/records/lock_record_run_uuid.sql"))
                        .bind::<Integer, _>(input.id_user)
                        .bind::<Text, _>(run_uuid)
                        .execute(connection)
                        .await?;
                    #[derive(QueryableByName)]
                    struct Run {
                        #[diesel(sql_type=Integer)]
                        id_record: i32,
                        #[diesel(sql_type=Text)]
                        payload_digest: String,
                    }
                    let existing = sql_query(include_str!(
                        "../queries/records/select_id_record_record_run.sql"
                    ))
                    .bind::<Integer, _>(input.id_user)
                    .bind::<Text, _>(run_uuid)
                    .get_result::<Run>(connection)
                    .await
                    .optional()?;
                    if let Some(existing) = existing {
                        ensure!(
                            existing.payload_digest == evidence.payload_digest,
                            "run UUID payload mismatch"
                        );
                        return Ok(RecordSubmissionResult {
                            id_record: existing.id_record,
                            personal_best_changed: false,
                            tournament_result_changed: false,
                            world_record_user_ids: vec![],
                        });
                    }
                }
                let accepted: AcceptanceRow = record_phase(
                    "user_level_lock",
                    sql_query(include_str!(
                        "../queries/records/lock_record_submission.sql"
                    ))
                    .bind::<Integer, _>(input.id_user)
                    .bind::<Integer, _>(input.id_level)
                    .get_result(connection),
                )
                .await?;
                record_phase(
                    "tournament_level_lock",
                    sql_query(include_str!(
                        "../queries/records/lock_tournament_level_shared.sql"
                    ))
                    .bind::<Integer, _>(input.id_level)
                    .execute(connection),
                )
                .await?;

                let created: IdRow = record_phase(
                    "record_insert",
                    sql_query(include_str!(
                        "../queries/records/submit_record_insert_record.sql"
                    ))
                    .bind::<Integer, _>(input.id_user)
                    .bind::<Float, _>(input.time)
                    .bind::<Varchar, _>(input.game_version)
                    .bind::<Integer, _>(input.id_level)
                    .bind::<Varchar, _>(input.mod_version)
                    .bind::<Array<Float>, _>(input.splits)
                    .bind::<Array<Float>, _>(input.speeds)
                    .get_result(connection),
                )
                .await?;

                if let Some(evidence) = &input.evidence {
                    sql_query(INSERT_RECORD_MEDIA)
                        .bind::<Integer, _>(created.id)
                        .bind::<Text, _>(evidence.ghost_key)
                        .execute(connection)
                        .await?;
                    super::ghost_validation::persist_validation(
                        connection,
                        created.id,
                        Some(evidence.ghost_digest),
                        evidence.report,
                        Some(&evidence.checked_at),
                    )
                    .await?;
                    if let Some(run_uuid) = evidence.run_uuid {
                        sql_query(include_str!("../queries/records/insert_record_run.sql"))
                            .bind::<Integer, _>(input.id_user)
                            .bind::<Text, _>(run_uuid)
                            .bind::<Text, _>(evidence.payload_digest)
                            .bind::<Integer, _>(created.id)
                            .execute(connection)
                            .await?;
                    }
                }
                sql_query(include_str!(
                    "../queries/records/insert_record_statistic.sql"
                ))
                .bind::<Jsonb, _>(statistics)
                .bind::<Integer, _>(created.id)
                .execute(connection)
                .await?;

                if input
                    .evidence
                    .as_ref()
                    .is_some_and(|e| e.report.status == "fail")
                {
                    return Ok(RecordSubmissionResult {
                        id_record: created.id,
                        personal_best_changed: false,
                        tournament_result_changed: false,
                        world_record_user_ids: vec![],
                    });
                }
                let personal_best_changed = record_optional_phase(
                    "personal_best",
                    sql_query(include_str!(
                        "../queries/records/insert_personal_best_global.sql"
                    ))
                    .bind::<Integer, _>(input.id_user)
                    .bind::<Integer, _>(input.id_level)
                    .bind::<Integer, _>(created.id)
                    .bind::<Float, _>(input.time)
                    .get_result::<IdRow>(connection),
                )
                .await?
                .is_some();

                let tournaments = sql_query(include_str!(
                    "../queries/records/select_id_track_tournament.sql"
                ))
                .bind::<Integer, _>(input.id_level)
                .bind::<Integer, _>(input.id_user)
                .bind::<Text, _>(&accepted.accepted_at)
                .bind::<Float, _>(input.time)
                .load::<TournamentRow>(connection)
                .await?;
                let mut changed_tournaments = Vec::new();
                for tournament in tournaments {
                    sql_query(LOCK_RECORD_LEVEL)
                        .bind::<Integer, _>(TRACK_TOURNAMENT_RESULT_LOCK_NAMESPACE)
                        .bind::<Integer, _>(tournament.id)
                        .execute(connection)
                        .await?;
                    let changed = sql_query(include_str!(
                        "../queries/records/insert_track_tournament_result.sql"
                    ))
                    .bind::<Integer, _>(tournament.id)
                    .bind::<Integer, _>(input.id_user)
                    .bind::<Integer, _>(created.id)
                    .bind::<Float, _>(input.time)
                    .get_result::<IdRow>(connection)
                    .await
                    .optional()?;
                    if changed.is_some() {
                        changed_tournaments.push(tournament.id);
                    }
                }
                for tournament in &changed_tournaments {
                    rerank_tournament(connection, *tournament).await?;
                }

                let observed = sql_query(SELECT_ID_USER_RECORD)
                    .bind::<Integer, _>(input.id_level)
                    .bind::<Integer, _>(created.id)
                    .get_result::<WorldRecordRow>(connection)
                    .await
                    .optional()?;
                let mut world_record_user_ids = Vec::new();
                if observed
                    .as_ref()
                    .is_none_or(|record| record.time > input.time)
                {
                    record_phase(
                        "world_record_lock",
                        sql_query(LOCK_RECORD_LEVEL)
                            .bind::<Integer, _>(WORLD_RECORD_LOCK_NAMESPACE)
                            .bind::<Integer, _>(input.id_level)
                            .execute(connection),
                    )
                    .await?;
                    let previous = sql_query(SELECT_ID_USER_RECORD)
                        .bind::<Integer, _>(input.id_level)
                        .bind::<Integer, _>(created.id)
                        .get_result::<WorldRecordRow>(connection)
                        .await
                        .optional()?;
                    if previous
                        .as_ref()
                        .is_some_and(|record| record.time <= input.time)
                    {
                        return Ok(RecordSubmissionResult {
                            id_record: created.id,
                            personal_best_changed,
                            tournament_result_changed: !changed_tournaments.is_empty(),
                            world_record_user_ids,
                        });
                    }
                    let mut user_ids = vec![input.id_user];
                    if let Some(previous) = &previous {
                        user_ids.push(previous.id_user);
                    }
                    user_ids.sort_unstable();
                    user_ids.dedup();
                    let changed = record_optional_phase(
                        "world_record",
                        sql_query(include_str!(
                            "../queries/records/insert_world_record_global.sql"
                        ))
                        .bind::<Integer, _>(input.id_user)
                        .bind::<Integer, _>(input.id_level)
                        .bind::<Integer, _>(created.id)
                        .bind::<Float, _>(input.time)
                        .get_result::<IdRow>(connection),
                    )
                    .await?;
                    if changed.is_some() {
                        world_record_user_ids = user_ids;
                    }
                }

                Ok(RecordSubmissionResult {
                    id_record: created.id,
                    personal_best_changed,
                    tournament_result_changed: !changed_tournaments.is_empty(),
                    world_record_user_ids,
                })
            })
            .await
    }

    pub async fn insert_record_media(&self, id_record: i32, ghost_url: &str) -> Result<()> {
        let mut connection = self.connection().await?;
        sql_query(INSERT_RECORD_MEDIA)
            .bind::<Integer, _>(id_record)
            .bind::<Text, _>(ghost_url)
            .execute(&mut connection)
            .await?;
        Ok(())
    }

    pub async fn claim_missing_level_metadata_request(
        &self,
        id_level: i32,
        workshop_id: i64,
        hash: &str,
    ) -> Result<bool> {
        let mut connection = self.connection().await?;
        Ok(sql_query(include_str!(
            "../queries/records/claim_missing_level_metadata_request.sql"
        ))
        .bind::<Integer, _>(id_level)
        .bind::<BigInt, _>(workshop_id)
        .bind::<Text, _>(hash)
        .get_result::<IdRow>(&mut connection)
        .await
        .optional()?
        .is_some())
    }
}

async fn level_by_xx(
    connection: &mut diesel_async::AsyncPgConnection,
    xx_hash: &str,
) -> Result<Option<Level>> {
    Ok(
        sql_query(include_str!("../queries/records/level_by_xx.sql"))
            .bind::<Text, _>(xx_hash)
            .get_result(connection)
            .await
            .optional()?,
    )
}

async fn lock_level_workshop_items(
    connection: &mut diesel_async::AsyncPgConnection,
    id_level: i32,
) -> Result<()> {
    sql_query(include_str!(
        "../queries/records/lock_level_workshop_items.sql"
    ))
    .bind::<Integer, _>(id_level)
    .execute(connection)
    .await?;
    Ok(())
}

pub(crate) async fn rerank_tournament(
    connection: &mut diesel_async::AsyncPgConnection,
    id_tournament: i32,
) -> Result<()> {
    sql_query(include_str!("../queries/records/rerank_tournament.sql"))
        .bind::<Integer, _>(id_tournament)
        .execute(connection)
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};
    use tracing::{Event, Level, Subscriber, field::Visit};
    use tracing_subscriber::{Layer, layer::SubscriberExt};

    #[derive(Clone, Default)]
    struct ErrorPhases(Arc<Mutex<Vec<String>>>);

    impl<S> Layer<S> for ErrorPhases
    where
        S: Subscriber,
    {
        fn on_event(&self, event: &Event<'_>, _context: tracing_subscriber::layer::Context<'_, S>) {
            if *event.metadata().level() != Level::ERROR {
                return;
            }
            let mut visitor = PhaseVisitor::default();
            event.record(&mut visitor);
            self.0
                .lock()
                .expect("error phase capture")
                .push(visitor.phase.unwrap_or_else(|| "missing-phase".to_owned()));
        }
    }

    #[derive(Default)]
    struct PhaseVisitor {
        phase: Option<String>,
    }

    impl Visit for PhaseVisitor {
        fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn std::fmt::Debug) {
            if field.name() == "phase" {
                self.phase = Some(format!("{value:?}").trim_matches('"').to_owned());
            }
        }

        fn record_str(&mut self, field: &tracing::field::Field, value: &str) {
            if field.name() == "phase" {
                self.phase = Some(value.to_owned());
            }
        }
    }

    #[tokio::test(flavor = "current_thread")]
    async fn optional_record_miss_is_not_logged_as_an_error() {
        let errors = ErrorPhases::default();
        let subscriber = tracing_subscriber::registry().with(errors.clone());
        let _guard = tracing::subscriber::set_default(subscriber);

        let result = record_optional_phase::<IdRow, _>(
            "personal_best",
            std::future::ready(Err(diesel::result::Error::NotFound)),
        )
        .await
        .expect("optional miss");

        assert!(result.is_none());
        assert!(errors.0.lock().expect("error phases").is_empty());
    }

    #[tokio::test(flavor = "current_thread")]
    async fn optional_record_failure_is_logged_with_phase() {
        let errors = ErrorPhases::default();
        let subscriber = tracing_subscriber::registry().with(errors.clone());
        let _guard = tracing::subscriber::set_default(subscriber);

        let result = record_optional_phase::<IdRow, _>(
            "world_record",
            std::future::ready(Err(diesel::result::Error::RollbackTransaction)),
        )
        .await;

        assert!(matches!(
            result,
            Err(diesel::result::Error::RollbackTransaction)
        ));
        assert_eq!(
            errors.0.lock().expect("error phases").as_slice(),
            ["world_record"]
        );
    }
}
