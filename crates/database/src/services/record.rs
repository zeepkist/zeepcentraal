use crate::{Database, services::Level};
use anyhow::{Result, ensure};
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{Array, BigInt, Bool, Float, Integer, Jsonb, Text, Varchar},
};
use diesel_async::{AsyncConnection, RunQueryDsl};
use std::{fmt::Display, future::Future};
use tracing::Instrument;
use zc_core::ghosts::GhostStatistics;

const WORLD_RECORD_LOCK_NAMESPACE: i32 = 1_861_284_953;
const TRACK_TOURNAMENT_RESULT_LOCK_NAMESPACE: i32 = 1_953_744_432;

#[derive(Clone, Debug)]
pub struct RecordSubmission<'a> {
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
    E: Display,
    F: Future<Output = Result<T, E>>,
{
    let span = tracing::info_span!("record.submit.phase", phase);
    match future.instrument(span.clone()).await {
        Ok(value) => Ok(value),
        Err(error) => {
            tracing::error!(parent: &span, phase, error = %error, "Record submission phase failed");
            Err(error)
        }
    }
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
    ) -> Result<Level> {
        ensure!(!hash.is_empty(), "legacy level hash is empty");
        ensure!(
            xx_hash.len() == 32 && xx_hash.bytes().all(|byte| byte.is_ascii_hexdigit()),
            "XXH128 level hash is invalid"
        );
        let mut connection = self.connection().await?;
        connection
            .transaction::<Level, anyhow::Error, _>(|connection| {
                Box::pin(async move {
                    let by_xx = level_by_xx(connection, xx_hash).await?;
                    let level = if let Some(level) = by_xx {
                        level
                    } else {
                        let legacy = sql_query(
                            "SELECT id,hash,xx_hash,adventure,has_records,record_count,publicly_visible \
                             FROM public.level WHERE hash=$1 ORDER BY id LIMIT 1 FOR UPDATE",
                        )
                        .bind::<Text, _>(hash)
                        .get_result::<Level>(connection)
                        .await
                        .optional()?;
                        if let Some(level) = legacy.filter(|level| level.xx_hash.is_empty()) {
                            lock_level_workshop_items(connection, level.id).await?;
                            sql_query(
                                "UPDATE public.level SET xx_hash=$2,adventure=adventure OR $3,date_updated=clock_timestamp() \
                                 WHERE id=$1",
                            )
                            .bind::<Integer, _>(level.id)
                            .bind::<Text, _>(xx_hash)
                            .bind::<Bool, _>(adventure)
                            .execute(connection)
                            .await?;
                            level_by_xx(connection, xx_hash)
                                .await?
                                .expect("updated canonical level")
                        } else {
                            let created = sql_query(
                                "INSERT INTO public.level(hash,xx_hash,adventure) VALUES($1,$2,$3) \
                                 ON CONFLICT (xx_hash) DO NOTHING RETURNING id",
                            )
                            .bind::<Text, _>(hash)
                            .bind::<Text, _>(xx_hash)
                            .bind::<Bool, _>(adventure)
                            .get_result::<IdRow>(connection)
                            .await
                            .optional()?;
                            let _ = created;
                            level_by_xx(connection, xx_hash)
                                .await?
                                .ok_or_else(|| anyhow::anyhow!("failed to resolve canonical level"))?
                        }
                    };
                    if adventure && !level.adventure {
                        lock_level_workshop_items(connection, level.id).await?;
                        sql_query(
                            "UPDATE public.level SET adventure=true,date_updated=clock_timestamp() WHERE id=$1",
                        )
                        .bind::<Integer, _>(level.id)
                        .execute(connection)
                        .await?;
                        return level_by_xx(connection, xx_hash)
                            .await?
                            .ok_or_else(|| anyhow::anyhow!("promoted level disappeared"));
                    }
                    Ok(level)
                })
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
            .transaction::<RecordSubmissionResult, anyhow::Error, _>(|connection| {
                Box::pin(async move {
                    let accepted: AcceptanceRow = record_phase(
                        "user_level_lock",
                        sql_query(
                            "SELECT pg_advisory_xact_lock($1,$2),clock_timestamp()::text AS accepted_at",
                        )
                        .bind::<Integer, _>(input.id_user)
                        .bind::<Integer, _>(input.id_level)
                        .get_result(connection),
                    )
                    .await?;
                    record_phase(
                        "tournament_level_lock",
                        sql_query("SELECT pg_advisory_xact_lock_shared(0,$1)")
                            .bind::<Integer, _>(input.id_level)
                            .execute(connection),
                    )
                    .await?;

                    let created: IdRow = record_phase(
                        "record_insert",
                        sql_query(
                            "INSERT INTO public.record \
                         (id_user,time,game_version,id_level,mod_version,splits,speeds,date_created,date_updated) \
                         VALUES($1,$2,$3,$4,$5,$6,$7,clock_timestamp(),clock_timestamp()) RETURNING id",
                        )
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

                    sql_query(
                        "INSERT INTO public.record_statistic \
                         SELECT populated.* FROM jsonb_populate_record( \
                           NULL::public.record_statistic, \
                           $1 || jsonb_build_object('id_record',$2,'date_created',clock_timestamp(),'date_updated',clock_timestamp()) \
                         ) AS populated",
                    )
                    .bind::<Jsonb, _>(statistics)
                    .bind::<Integer, _>(created.id)
                    .execute(connection)
                    .await?;

                    let personal_best_changed = record_optional_phase(
                        "personal_best",
                        sql_query(
                            "INSERT INTO public.personal_best_global \
                         (id_user,id_level,id_record,date_created,date_updated) \
                         VALUES($1,$2,$3,clock_timestamp(),clock_timestamp()) \
                         ON CONFLICT (id_user,id_level) DO UPDATE SET \
                           id_record=excluded.id_record,date_updated=excluded.date_updated \
                         WHERE (SELECT current_record.time FROM public.record current_record \
                                WHERE current_record.id=personal_best_global.id_record)>$4 \
                         RETURNING id",
                        )
                        .bind::<Integer, _>(input.id_user)
                        .bind::<Integer, _>(input.id_level)
                        .bind::<Integer, _>(created.id)
                        .bind::<Float, _>(input.time)
                        .get_result::<IdRow>(connection),
                    )
                    .await?
                    .is_some();

                    let tournaments = sql_query(
                        "SELECT tournament.id FROM public.track_tournament tournament \
                         LEFT JOIN public.track_tournament_result existing \
                           ON existing.id_tournament=tournament.id AND existing.id_user=$2 \
                         WHERE tournament.id_level=$1 AND tournament.finalized_at IS NULL \
                           AND tournament.start_at<=$3::timestamptz AND tournament.end_at>$3::timestamptz \
                           AND (existing.time IS NULL OR existing.time>$4) ORDER BY tournament.id",
                    )
                    .bind::<Integer, _>(input.id_level)
                    .bind::<Integer, _>(input.id_user)
                    .bind::<Text, _>(&accepted.accepted_at)
                    .bind::<Float, _>(input.time)
                    .load::<TournamentRow>(connection)
                    .await?;
                    let mut changed_tournaments = Vec::new();
                    for tournament in tournaments {
                        sql_query("SELECT pg_advisory_xact_lock($1,$2)")
                            .bind::<Integer, _>(TRACK_TOURNAMENT_RESULT_LOCK_NAMESPACE)
                            .bind::<Integer, _>(tournament.id)
                            .execute(connection)
                            .await?;
                        let changed = sql_query(
                            "INSERT INTO public.track_tournament_result \
                             (id_tournament,id_user,id_record,time,rank,points,date_created,date_updated) \
                             VALUES($1,$2,$3,$4,1,1000,clock_timestamp(),clock_timestamp()) \
                             ON CONFLICT (id_tournament,id_user) DO UPDATE SET \
                               id_record=excluded.id_record,time=excluded.time,date_updated=excluded.date_updated \
                             WHERE excluded.time<track_tournament_result.time RETURNING id_tournament AS id",
                        )
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

                    let observed = sql_query(
                        "SELECT wr.id_user,r.time FROM public.world_record_global wr \
                         JOIN public.record r ON r.id=wr.id_record WHERE wr.id_level=$1",
                    )
                    .bind::<Integer, _>(input.id_level)
                    .get_result::<WorldRecordRow>(connection)
                    .await
                    .optional()?;
                    let mut world_record_user_ids = Vec::new();
                    if observed.as_ref().is_none_or(|record| record.time > input.time) {
                        record_phase(
                            "world_record_lock",
                            sql_query("SELECT pg_advisory_xact_lock($1,$2)")
                                .bind::<Integer, _>(WORLD_RECORD_LOCK_NAMESPACE)
                                .bind::<Integer, _>(input.id_level)
                                .execute(connection),
                        )
                        .await?;
                        let previous = sql_query(
                            "SELECT wr.id_user,r.time FROM public.world_record_global wr \
                             JOIN public.record r ON r.id=wr.id_record WHERE wr.id_level=$1",
                        )
                        .bind::<Integer, _>(input.id_level)
                        .get_result::<WorldRecordRow>(connection)
                        .await
                        .optional()?;
                        if previous.as_ref().is_some_and(|record| record.time <= input.time) {
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
                            sql_query(
                                "INSERT INTO public.world_record_global \
                             (id_user,id_level,id_record,date_created,date_updated) \
                             VALUES($1,$2,$3,clock_timestamp(),clock_timestamp()) \
                             ON CONFLICT (id_level) DO UPDATE SET \
                               id_user=excluded.id_user,id_record=excluded.id_record,date_updated=excluded.date_updated \
                             WHERE (SELECT current_record.time FROM public.record current_record \
                                    WHERE current_record.id=world_record_global.id_record)>$4 RETURNING id",
                            )
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
            })
            .await
    }

    pub async fn insert_record_media(&self, id_record: i32, ghost_url: &str) -> Result<()> {
        let mut connection = self.connection().await?;
        sql_query(
            "INSERT INTO public.record_media(id_record,ghost_url,date_created,date_updated) \
             VALUES($1,$2,clock_timestamp(),clock_timestamp())",
        )
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
        Ok(sql_query(
            "INSERT INTO public.level_request(workshop_id,hash) \
             SELECT $2,$3 WHERE NOT EXISTS(SELECT 1 FROM public.level_metadata WHERE id_level=$1) \
             ON CONFLICT (workshop_id) DO NOTHING RETURNING id",
        )
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
    Ok(sql_query(
        "SELECT id,hash,xx_hash,adventure,has_records,record_count,publicly_visible \
         FROM public.level WHERE xx_hash=$1 LIMIT 1 FOR UPDATE",
    )
    .bind::<Text, _>(xx_hash)
    .get_result(connection)
    .await
    .optional()?)
}

async fn lock_level_workshop_items(
    connection: &mut diesel_async::AsyncPgConnection,
    id_level: i32,
) -> Result<()> {
    sql_query(
        "SELECT wi.workshop_id FROM public.workshop_item wi \
         WHERE EXISTS(SELECT 1 FROM public.level_item li \
           WHERE li.id_level=$1 AND li.workshop_id=wi.workshop_id) \
         ORDER BY wi.workshop_id FOR UPDATE",
    )
    .bind::<Integer, _>(id_level)
    .execute(connection)
    .await?;
    Ok(())
}

async fn rerank_tournament(
    connection: &mut diesel_async::AsyncPgConnection,
    id_tournament: i32,
) -> Result<()> {
    sql_query(
        "WITH next_results AS ( \
           SELECT id_tournament,id_user,rank() OVER(ORDER BY time)::integer AS next_rank \
           FROM public.track_tournament_result WHERE id_tournament=$1 \
         ), scored AS ( \
           SELECT id_tournament,id_user,next_rank, \
             greatest(2,(2*ceil((1000*power(0.96,next_rank-1))/2))::integer) AS next_points \
           FROM next_results \
         ) UPDATE public.track_tournament_result result SET \
           rank=scored.next_rank,points=scored.next_points,date_updated=clock_timestamp() \
         FROM scored WHERE result.id_tournament=scored.id_tournament \
           AND result.id_user=scored.id_user \
           AND row(result.rank,result.points) IS DISTINCT FROM row(scored.next_rank,scored.next_points)",
    )
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
