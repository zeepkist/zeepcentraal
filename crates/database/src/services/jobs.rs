use crate::Database;
use anyhow::{Result, ensure};
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{Array, BigInt, Bool, Double, Float, Integer, Jsonb, Nullable, Text},
};
use diesel_async::{AsyncConnection, RunQueryDsl};
use serde::Serialize;
use std::collections::BTreeMap;
use zc_core::ghosts::GhostStatistics;

const USER_SCORE_LOCK_NAMESPACE: i32 = -1_861_284_952;
const LEVEL_SCORE_LOCK_NAMESPACE: i32 = 1_861_284_954;
const MAINTENANCE_LOCK_TIMEOUT: &str = "100ms";

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MaintenanceOutcome<T> {
    Applied(T),
    SnapshotChanged,
    Contended,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LevelContributionPage {
    pub user_ids: Vec<i32>,
    pub next_after_user_id: Option<i32>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, QueryableByName)]
pub struct UserActivity {
    #[diesel(sql_type = Integer)]
    pub id_user: i32,
    #[diesel(sql_type = Bool)]
    pub active: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, QueryableByName, Serialize)]
pub struct PlayerRankSnapshot {
    #[diesel(sql_type = Integer)]
    pub id_user: i32,
    #[diesel(sql_type = Integer)]
    pub points: i32,
    #[diesel(sql_type = Integer)]
    pub rank: i32,
}

#[derive(Clone, Debug)]
pub struct UserScoreSource {
    pub id_user: i32,
    pub contributions: Vec<zc_core::score::LevelContribution>,
}

#[derive(Clone, Debug, QueryableByName)]
pub struct RecordGhostMedia {
    #[diesel(sql_type = Integer)]
    pub id_record: i32,
    #[diesel(sql_type = Text)]
    pub ghost_url: String,
}

#[derive(Clone, Debug, QueryableByName)]
pub struct TournamentLobbySource {
    #[diesel(sql_type = BigInt)]
    pub workshop_id: i64,
    #[diesel(sql_type = Text)]
    pub file_uid: String,
    #[diesel(sql_type = Text)]
    pub file_author: String,
    #[diesel(sql_type = Text)]
    pub level_name: String,
    #[diesel(sql_type = Integer)]
    pub format: i32,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct TournamentRotation {
    pub created: bool,
    pub id_tournament: Option<i32>,
}

#[derive(QueryableByName)]
struct IdRow {
    #[diesel(sql_type = Integer)]
    id: i32,
}

#[derive(QueryableByName)]
struct BooleanRow {
    #[diesel(sql_type = Bool)]
    value: bool,
}

#[derive(QueryableByName)]
struct CountRow {
    #[diesel(sql_type = BigInt)]
    count: i64,
}

#[derive(QueryableByName)]
struct AvailabilityRow {
    #[diesel(sql_type = Integer)]
    id_level: i32,
    #[diesel(sql_type = Bool)]
    adventure: bool,
    #[diesel(sql_type = BigInt)]
    item_count: i64,
    #[diesel(sql_type = BigInt)]
    accessible_item_count: i64,
}

#[derive(QueryableByName)]
struct PersonalBestRow {
    #[diesel(sql_type = Integer)]
    id_level: i32,
    #[diesel(sql_type = BigInt)]
    total_count: i64,
    #[diesel(sql_type = Float)]
    time: f32,
    #[diesel(sql_type = Nullable<Array<Float>>)]
    splits: Option<Vec<f32>>,
    #[diesel(sql_type = Nullable<Float>)]
    statistic_time: Option<f32>,
    #[diesel(sql_type = Nullable<Integer>)]
    turn_left_count: Option<i32>,
    #[diesel(sql_type = Nullable<Float>)]
    turn_left_time: Option<f32>,
    #[diesel(sql_type = Nullable<Integer>)]
    turn_right_count: Option<i32>,
    #[diesel(sql_type = Nullable<Float>)]
    turn_right_time: Option<f32>,
    #[diesel(sql_type = Nullable<Integer>)]
    brake_count: Option<i32>,
    #[diesel(sql_type = Nullable<Float>)]
    brake_time: Option<f32>,
    #[diesel(sql_type = Nullable<Integer>)]
    arms_up_count: Option<i32>,
    #[diesel(sql_type = Nullable<Float>)]
    arms_up_time: Option<f32>,
    #[diesel(sql_type = Nullable<Integer>)]
    driver_input_transition_count: Option<i32>,
    #[diesel(sql_type = Nullable<Bool>)]
    has_input_data: Option<bool>,
}

#[derive(QueryableByName)]
struct VoteRow {
    #[diesel(sql_type = Integer)]
    id_level: i32,
    #[diesel(sql_type = Integer)]
    value: i32,
}

#[derive(QueryableByName)]
struct SkillRow {
    #[diesel(sql_type = Integer)]
    id_level: i32,
    #[diesel(sql_type = Integer)]
    rated_player_count: i32,
    #[diesel(sql_type = Nullable<Double>)]
    alignment: Option<f64>,
    #[diesel(sql_type = Nullable<Double>)]
    separation: Option<f64>,
    #[diesel(sql_type = Nullable<Double>)]
    field_strength: Option<f64>,
}

#[derive(QueryableByName)]
struct UserContributionRow {
    #[diesel(sql_type = Integer)]
    id_user: i32,
    #[diesel(sql_type = Integer)]
    id_level: i32,
    #[diesel(sql_type = Integer)]
    id_record: i32,
    #[diesel(sql_type = BigInt)]
    level_position: i64,
    #[diesel(sql_type = Integer)]
    level_points: i32,
    #[diesel(sql_type = Float)]
    level_decayed_points: f32,
}

#[derive(Serialize)]
struct PersistedContribution {
    id_level: i32,
    id_record: i32,
    level_position: i64,
    level_points: i32,
    level_decayed_points: f32,
    contribution_rank: i32,
    player_decayed_points: f32,
}

#[derive(QueryableByName, Serialize)]
#[serde(rename_all = "camelCase")]
struct RankChangeRow {
    #[diesel(sql_type = Integer)]
    id_user: i32,
    #[diesel(sql_type = Integer)]
    previous_rank: i32,
    #[diesel(sql_type = Integer)]
    rank: i32,
}

impl Database {
    pub async fn record_media_for_statistics(
        &self,
        ids: Option<&[i32]>,
        before_id: Option<i32>,
        reparse_version: Option<i32>,
        limit: i64,
    ) -> Result<Vec<RecordGhostMedia>> {
        ensure!((1..=500).contains(&limit), "record media limit is invalid");
        let ids = ids.unwrap_or_default();
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "SELECT media.id_record,media.ghost_url::text AS ghost_url \
             FROM public.record_media media \
             LEFT JOIN public.record_statistic statistic ON statistic.id_record=media.id_record \
             WHERE media.ghost_url IS NOT NULL \
               AND (cardinality($1::integer[])=0 OR media.id_record=ANY($1)) \
               AND (cardinality($1::integer[])>0 OR $2::integer IS NULL OR media.id_record<$2) \
               AND (cardinality($1::integer[])>0 OR ( \
                    ($3::integer IS NOT NULL AND statistic.ghost_version=$3) OR \
                    ($3::integer IS NULL AND (statistic.id_record IS NULL \
                     OR statistic.ghost_version IS NULL OR statistic.has_input_data IS NULL \
                     OR statistic.has_air_data IS NULL OR statistic.has_wheel_data IS NULL \
                     OR statistic.has_slip_data IS NULL OR statistic.has_state_data IS NULL \
                     OR statistic.has_surface_data IS NULL OR statistic.has_velocity_data IS NULL \
                     OR statistic.has_ragdoll_data IS NULL \
                     OR (statistic.has_input_data=true AND \
                         (statistic.time_any_driver_input IS NULL \
                          OR statistic.driver_input_transition_count IS NULL)))))) \
             ORDER BY media.id_record DESC LIMIT $4",
        )
        .bind::<Array<Integer>, _>(ids)
        .bind::<Nullable<Integer>, _>(before_id)
        .bind::<Nullable<Integer>, _>(reparse_version)
        .bind::<BigInt, _>(limit)
        .load(&mut connection)
        .await?)
    }

    pub async fn upsert_record_statistics(
        &self,
        id_record: i32,
        statistics: &GhostStatistics,
    ) -> Result<()> {
        let value = serde_json::to_value(statistics)?;
        let mut connection = self.connection().await?;
        sql_query(
            "WITH previous AS ( \
                 DELETE FROM public.record_statistic WHERE id_record=$1 \
                 RETURNING date_created \
             ) \
             INSERT INTO public.record_statistic \
             SELECT populated.* FROM jsonb_populate_record( \
                 NULL::public.record_statistic, \
                 $2 || jsonb_build_object( \
                     'id_record',$1, \
                     'date_created',COALESCE((SELECT date_created FROM previous),clock_timestamp()), \
                     'date_updated',clock_timestamp())) AS populated",
        )
        .bind::<Integer, _>(id_record)
        .bind::<Jsonb, _>(value)
        .execute(&mut connection)
        .await?;
        Ok(())
    }

    pub async fn changed_level_point_ids(&self) -> Result<Vec<i32>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "SELECT points.id_level AS id FROM public.level_points points \
             LEFT JOIN LATERAL (SELECT history.* FROM public.level_points_history history \
                 WHERE history.id_level=points.id_level ORDER BY history.date_created DESC,history.id DESC LIMIT 1) latest ON true \
             WHERE latest.id IS NULL OR ROW(points.points,points.rating,points.modifier_length,points.modifier_evidence,points.modifier_quality,points.modifier_rating,points.complexity_confidence,points.complexity_score,points.field_strength,points.quality_score,points.skill_alignment,points.skill_confidence,points.skill_sample_size,points.skill_score,points.skill_separation) \
                 IS DISTINCT FROM ROW(latest.points,latest.rating,latest.modifier_length,latest.modifier_evidence,latest.modifier_quality,latest.modifier_rating,latest.complexity_confidence,latest.complexity_score,latest.field_strength,latest.quality_score,latest.skill_alignment,latest.skill_confidence,latest.skill_sample_size,latest.skill_score,latest.skill_separation) \
             ORDER BY points.id_level",
        )
        .load::<IdRow>(&mut connection)
        .await?
        .into_iter()
        .map(|row| row.id)
        .collect())
    }

    pub async fn insert_level_point_histories(&self, ids: &[i32]) -> Result<usize> {
        if ids.is_empty() {
            return Ok(0);
        }
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "INSERT INTO public.level_points_history \
             (id_level,points,rating,modifier_length,modifier_evidence,modifier_quality,modifier_rating,complexity_confidence,complexity_score,field_strength,quality_score,skill_alignment,skill_confidence,skill_sample_size,skill_score,skill_separation,date_created,date_updated) \
             SELECT id_level,points,rating,modifier_length,modifier_evidence,modifier_quality,modifier_rating,complexity_confidence,complexity_score,field_strength,quality_score,skill_alignment,skill_confidence,skill_sample_size,skill_score,skill_separation,clock_timestamp(),date_updated \
             FROM public.level_points WHERE id_level=ANY($1)",
        )
        .bind::<Array<Integer>, _>(ids)
        .execute(&mut connection)
        .await?)
    }

    pub async fn all_user_point_ids(&self) -> Result<Vec<i32>> {
        let mut connection = self.connection().await?;
        Ok(
            sql_query("SELECT id_user AS id FROM public.user_points ORDER BY id_user")
                .load::<IdRow>(&mut connection)
                .await?
                .into_iter()
                .map(|row| row.id)
                .collect(),
        )
    }

    pub async fn insert_user_point_histories(&self, ids: &[i32]) -> Result<usize> {
        if ids.is_empty() {
            return Ok(0);
        }
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "INSERT INTO public.user_points_history \
             (id_user,points,total_points,rank,world_records,date_created,date_updated) \
             SELECT id_user,points,total_points,rank,world_records,clock_timestamp(),date_updated \
             FROM public.user_points WHERE id_user=ANY($1)",
        )
        .bind::<Array<Integer>, _>(ids)
        .execute(&mut connection)
        .await?)
    }

    pub async fn user_activity_page(&self, after_id: i32, limit: i64) -> Result<Vec<UserActivity>> {
        ensure!(
            (1..=1_000).contains(&limit),
            "user activity page limit is invalid"
        );
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "SELECT account.id AS id_user,EXISTS(SELECT 1 FROM public.record record \
             WHERE record.id_user=account.id AND record.date_created>=clock_timestamp()-interval '6 months') AS active \
             FROM public.\"user\" account WHERE account.id>$1 ORDER BY account.id LIMIT $2",
        )
        .bind::<Integer, _>(after_id)
        .bind::<BigInt, _>(limit)
        .load(&mut connection)
        .await?)
    }

    pub async fn user_score_sources(&self, ids: &[i32]) -> Result<Vec<UserScoreSource>> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut connection = self.connection().await?;
        let rows = sql_query(
            "SELECT contribution.id_user,contribution.id_level,contribution.id_record, \
             contribution.level_position::bigint AS level_position,contribution.level_points, \
             contribution.level_decayed_points FROM public.user_point_contribution contribution \
             WHERE contribution.id_user=ANY($1) ORDER BY contribution.id_user,contribution.id_level",
        )
        .bind::<Array<Integer>, _>(ids)
        .load::<UserContributionRow>(&mut connection)
        .await?;
        let mut by_user = ids
            .iter()
            .copied()
            .map(|id_user| (id_user, Vec::new()))
            .collect::<BTreeMap<_, _>>();
        for row in rows {
            by_user
                .entry(row.id_user)
                .or_default()
                .push(zc_core::score::LevelContribution {
                    id_level: row.id_level,
                    id_record: row.id_record,
                    level_position: row.level_position,
                    level_points: row.level_points,
                    level_decayed_points: f64::from(row.level_decayed_points),
                });
        }
        Ok(by_user
            .into_iter()
            .map(|(id_user, contributions)| UserScoreSource {
                id_user,
                contributions,
            })
            .collect())
    }

    pub async fn recalculate_player_score(&self, id_user: i32) -> Result<MaintenanceOutcome<()>> {
        ensure!(id_user > 0, "user ID must be positive");
        let activity = self.user_activity_page(id_user - 1, 1).await?;
        let active = activity
            .as_slice()
            .first()
            .is_some_and(|row| row.id_user == id_user && row.active);
        if !active {
            return self.reset_inactive_user_scores(&[id_user]).await;
        }
        for _ in 0..3 {
            let contributions = self
                .user_score_sources(&[id_user])
                .await?
                .pop()
                .map_or_else(Vec::new, |source| source.contributions);
            let score = zc_core::score::calculate_player_points(contributions);
            match self.persist_player_score(id_user, &score).await? {
                MaintenanceOutcome::SnapshotChanged => continue,
                outcome => return Ok(outcome),
            }
        }
        Ok(MaintenanceOutcome::SnapshotChanged)
    }

    pub async fn recalculate_player_score_from(
        &self,
        source: UserScoreSource,
    ) -> Result<MaintenanceOutcome<()>> {
        let score = zc_core::score::calculate_player_points(source.contributions);
        match self.persist_player_score(source.id_user, &score).await? {
            MaintenanceOutcome::SnapshotChanged => {
                self.recalculate_player_score(source.id_user).await
            }
            outcome => Ok(outcome),
        }
    }

    async fn persist_player_score(
        &self,
        id_user: i32,
        score: &zc_core::score::PlayerPoints,
    ) -> Result<MaintenanceOutcome<()>> {
        let points = i32::try_from(score.points)?;
        let total_points = i32::try_from(score.total_points)?;
        let expected = serde_json::to_value(
            score
                .contributions
                .iter()
                .map(|value| PersistedContribution {
                    id_level: value.id_level,
                    id_record: value.id_record,
                    level_position: value.level_position,
                    level_points: value.level_points,
                    level_decayed_points: value.level_decayed_points as f32,
                    contribution_rank: value.contribution_rank,
                    player_decayed_points: value.player_decayed_points as f32,
                })
                .collect::<Vec<_>>(),
        )?;
        let mut connection = self.connection().await?;
        let result = connection
            .transaction::<MaintenanceOutcome<()>, anyhow::Error, _>(|connection| {
                Box::pin(async move {
                    set_maintenance_lock_timeout(connection).await?;
                    if !try_user_score_locks(connection, &[id_user]).await? {
                        return Ok(MaintenanceOutcome::Contended);
                    }
                    let matches: BooleanRow = sql_query(
                        "WITH expected_source AS MATERIALIZED (SELECT * FROM jsonb_to_recordset($2::jsonb) AS value( \
                           id_level integer,id_record integer,level_position bigint,level_points integer, \
                           level_decayed_points real,contribution_rank integer,player_decayed_points real)), \
                         expected AS MATERIALIZED (SELECT id_level,id_record,level_position,level_points,level_decayed_points FROM expected_source), \
                         current AS MATERIALIZED (SELECT id_level,id_record,level_position::bigint,level_points, \
                           level_decayed_points \
                           FROM public.user_point_contribution WHERE id_user=$1) \
                         SELECT NOT EXISTS((SELECT * FROM expected EXCEPT SELECT * FROM current) \
                           UNION ALL (SELECT * FROM current EXCEPT SELECT * FROM expected)) AS value",
                    )
                    .bind::<Integer, _>(id_user)
                    .bind::<Jsonb, _>(&expected)
                    .get_result(connection)
                    .await?;
                    if !matches.value {
                        return Ok(MaintenanceOutcome::SnapshotChanged);
                    }
                    sql_query(
                        "WITH source AS MATERIALIZED (SELECT * FROM jsonb_to_recordset($2::jsonb) AS value( \
                           id_level integer,id_record integer,level_position bigint,level_points integer, \
                           level_decayed_points real,contribution_rank integer,player_decayed_points real)) \
                         UPDATE public.user_point_contribution target SET \
                           contribution_rank=source.contribution_rank,player_decayed_points=source.player_decayed_points, \
                           date_calculated=clock_timestamp() FROM source \
                         WHERE target.id_user=$1 AND target.id_level=source.id_level \
                           AND ROW(target.id_record,target.level_position,target.level_points,target.level_decayed_points) \
                             IS NOT DISTINCT FROM ROW(source.id_record,source.level_position,source.level_points,source.level_decayed_points) \
                           AND ROW(target.contribution_rank,target.player_decayed_points) \
                             IS DISTINCT FROM ROW(source.contribution_rank,source.player_decayed_points)",
                    )
                    .bind::<Integer, _>(id_user)
                    .bind::<Jsonb, _>(&expected)
                    .execute(connection)
                    .await?;
                    sql_query(
                        "INSERT INTO public.user_points(id_user,points,total_points,world_records,date_created,date_updated) \
                         VALUES($1,$2,$3,(SELECT count(*)::integer FROM public.world_record_global WHERE id_user=$1),clock_timestamp(),clock_timestamp()) \
                         ON CONFLICT(id_user) DO UPDATE SET points=excluded.points,total_points=excluded.total_points, \
                           world_records=excluded.world_records,date_updated=excluded.date_updated \
                         WHERE ROW(user_points.points,user_points.total_points,user_points.world_records) \
                           IS DISTINCT FROM ROW(excluded.points,excluded.total_points,excluded.world_records)",
                    )
                    .bind::<Integer, _>(id_user)
                    .bind::<Integer, _>(points)
                    .bind::<Integer, _>(total_points)
                    .execute(connection)
                    .await?;
                    Ok(MaintenanceOutcome::Applied(()))
                })
            })
            .await;
        contention_outcome(result)
    }

    pub async fn reset_inactive_user_scores(&self, ids: &[i32]) -> Result<MaintenanceOutcome<()>> {
        if ids.is_empty() {
            return Ok(MaintenanceOutcome::Applied(()));
        }
        let mut sorted = ids.to_vec();
        sorted.sort_unstable();
        sorted.dedup();
        let mut connection = self.connection().await?;
        let result = connection
            .transaction::<MaintenanceOutcome<()>, anyhow::Error, _>(|connection| {
                Box::pin(async move {
                    set_maintenance_lock_timeout(connection).await?;
                    if !try_user_score_locks(connection, &sorted).await? {
                        return Ok(MaintenanceOutcome::Contended);
                    }
                    sql_query(
                        "WITH inactive AS MATERIALIZED (SELECT candidate.id FROM unnest($1::integer[]) candidate(id) \
                           WHERE NOT EXISTS(SELECT 1 FROM public.record record WHERE record.id_user=candidate.id \
                             AND record.date_created>=clock_timestamp()-interval '6 months')) \
                         UPDATE public.user_point_contribution contribution SET player_decayed_points=0,date_calculated=clock_timestamp() \
                         FROM inactive WHERE contribution.id_user=inactive.id AND contribution.player_decayed_points IS DISTINCT FROM 0::real",
                    )
                    .bind::<Array<Integer>, _>(&sorted)
                    .execute(connection)
                    .await?;
                    sql_query(
                        "WITH inactive AS MATERIALIZED (SELECT candidate.id FROM unnest($1::integer[]) candidate(id) \
                           WHERE NOT EXISTS(SELECT 1 FROM public.record record WHERE record.id_user=candidate.id \
                             AND record.date_created>=clock_timestamp()-interval '6 months')) \
                         UPDATE public.user_points points SET points=0,rank=-1, \
                           world_records=(SELECT count(*)::integer FROM public.world_record_global wr WHERE wr.id_user=points.id_user), \
                           date_updated=clock_timestamp() FROM inactive WHERE points.id_user=inactive.id \
                           AND ROW(points.points,points.rank,points.world_records) IS DISTINCT FROM ROW(0,-1, \
                             (SELECT count(*)::integer FROM public.world_record_global wr WHERE wr.id_user=points.id_user))",
                    )
                    .bind::<Array<Integer>, _>(&sorted)
                    .execute(connection)
                    .await?;
                    Ok(MaintenanceOutcome::Applied(()))
                })
            })
            .await;
        contention_outcome(result)
    }

    pub async fn player_rank_snapshot(&self) -> Result<Vec<PlayerRankSnapshot>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "SELECT ranked.id_user,ranked.points,ranked.rank FROM (SELECT points.id_user,points.points, \
             RANK() OVER(ORDER BY points.points DESC)::integer AS rank FROM public.user_points points \
             WHERE EXISTS(SELECT 1 FROM public.record record WHERE record.id_user=points.id_user \
               AND record.date_created>=clock_timestamp()-interval '6 months')) ranked ORDER BY ranked.id_user",
        )
        .load(&mut connection)
        .await?)
    }

    pub async fn persist_player_rank_batch(
        &self,
        snapshot: &[PlayerRankSnapshot],
    ) -> Result<MaintenanceOutcome<usize>> {
        if snapshot.is_empty() {
            return Ok(MaintenanceOutcome::Applied(0));
        }
        let ids = snapshot
            .iter()
            .map(|value| value.id_user)
            .collect::<Vec<_>>();
        let source = serde_json::to_value(snapshot)?;
        let mut connection = self.connection().await?;
        let result = connection
            .transaction::<MaintenanceOutcome<usize>, anyhow::Error, _>(|connection| {
                Box::pin(async move {
                    set_maintenance_lock_timeout(connection).await?;
                    if !try_user_score_locks(connection, &ids).await? {
                        return Ok(MaintenanceOutcome::Contended);
                    }
                    let matches: BooleanRow = sql_query(
                        "WITH source AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS value(id_user integer,points integer,rank integer)) \
                         SELECT count(*)=(SELECT count(*) FROM source) AS value FROM source \
                         JOIN public.user_points target USING(id_user) WHERE target.points=source.points",
                    )
                    .bind::<Jsonb, _>(&source)
                    .get_result(connection)
                    .await?;
                    if !matches.value {
                        return Ok(MaintenanceOutcome::SnapshotChanged);
                    }
                    let changes = sql_query(
                        "WITH source AS MATERIALIZED (SELECT * FROM jsonb_to_recordset($1::jsonb) AS value(id_user integer,points integer,rank integer)), \
                         changed AS MATERIALIZED (SELECT target.id_user,target.rank AS previous_rank,source.rank FROM public.user_points target \
                           JOIN source USING(id_user) WHERE target.rank IS DISTINCT FROM source.rank), \
                         updated AS (UPDATE public.user_points target SET rank=changed.rank,date_updated=clock_timestamp() FROM changed \
                           WHERE target.id_user=changed.id_user RETURNING target.id_user) \
                         SELECT changed.id_user,changed.previous_rank,changed.rank FROM changed JOIN updated USING(id_user) \
                         ORDER BY changed.rank,changed.id_user",
                    )
                    .bind::<Jsonb, _>(&source)
                    .load::<RankChangeRow>(connection)
                    .await?;
                    if !changes.is_empty() {
                        sql_query(
                            "INSERT INTO public.discord_activity_event(kind,payload) VALUES('rank_batch',jsonb_build_object('changes',$1::jsonb))",
                        )
                        .bind::<Jsonb, _>(serde_json::to_value(&changes)?)
                        .execute(connection)
                        .await?;
                    }
                    Ok(MaintenanceOutcome::Applied(changes.len()))
                })
            })
            .await;
        contention_outcome(result)
    }

    pub async fn level_ids_page(&self, after_id: i32, recent_only: bool) -> Result<Vec<i32>> {
        let mut connection = self.connection().await?;
        Ok(sql_query("SELECT level.id FROM public.level level WHERE level.id>$1 AND (NOT $2 OR EXISTS(SELECT 1 FROM public.record record WHERE record.id_level=level.id AND record.date_created>=clock_timestamp()-interval '1 hour')) ORDER BY level.id LIMIT 200")
            .bind::<Integer,_>(after_id).bind::<Bool,_>(recent_only).load::<IdRow>(&mut connection).await?.into_iter().map(|row|row.id).collect())
    }

    pub async fn rebuild_player_skill_aggregates(&self) -> Result<usize> {
        let mut connection = self.connection().await?;
        connection.transaction::<usize,anyhow::Error,_>(|connection|Box::pin(async move{
            sql_query("DELETE FROM public.player_skill_aggregate").execute(connection).await?;
            Ok(sql_query("WITH ranked AS MATERIALIZED(SELECT pb.id_user,RANK() OVER(PARTITION BY pb.id_level ORDER BY record.time) placement_rank,COUNT(*) OVER(PARTITION BY pb.id_level) field_count FROM public.personal_best_global pb JOIN public.record record ON record.id=pb.id_record JOIN public.\"user\" account ON account.id=pb.id_user WHERE account.banned=false AND record.time>0),eligible AS(SELECT id_user,1-(placement_rank-1)::double precision/(field_count-1) placement FROM ranked WHERE field_count>=20),placements AS(SELECT id_user,sum(placement)::double precision placement_sum,count(*)::integer eligible_level_count FROM eligible GROUP BY id_user) INSERT INTO public.player_skill_aggregate(id_user,placement_sum,eligible_level_count,skill,date_updated) SELECT id_user,placement_sum,eligible_level_count,(5.0+placement_sum)/(10+eligible_level_count),clock_timestamp() FROM placements").execute(connection).await?)
        })).await
    }

    pub async fn update_level_scores(
        &self,
        ids: &[i32],
        report_only: bool,
    ) -> Result<MaintenanceOutcome<()>> {
        if ids.is_empty() {
            return Ok(MaintenanceOutcome::Applied(()));
        }
        ensure!(
            report_only || ids.len() == 1,
            "persistent level scoring requires one level"
        );
        let mut connection = self.connection().await?;
        let result = connection.transaction::<MaintenanceOutcome<()>,anyhow::Error,_>(|connection|Box::pin(async move{
            if !report_only {
                set_maintenance_lock_timeout(connection).await?;
                let lock: BooleanRow = sql_query("SELECT pg_try_advisory_xact_lock($1,$2) AS value")
                    .bind::<Integer,_>(LEVEL_SCORE_LOCK_NAMESPACE).bind::<Integer,_>(ids[0]).get_result(connection).await?;
                if !lock.value {
                    return Ok(MaintenanceOutcome::Contended);
                }
            }
            let availability=sql_query("SELECT level.id AS id_level,level.adventure,count(item.id)::bigint AS item_count,count(item.id) FILTER(WHERE item.publicly_visible=true AND item.deleted=false)::bigint AS accessible_item_count FROM public.level level LEFT JOIN public.level_item item ON item.id_level=level.id WHERE level.id=ANY($1) GROUP BY level.id,level.adventure")
                .bind::<Array<Integer>,_>(ids).load::<AvailabilityRow>(connection).await?;
            let eligible:Vec<_>=availability.iter().filter(|row|zc_core::score::level_score_eligible(row.adventure,row.item_count,row.accessible_item_count)).map(|row|row.id_level).collect();
            let personal_bests=if eligible.is_empty(){Vec::new()}else{sql_query("WITH ranked AS MATERIALIZED(SELECT pb.id_level,record.id,record.time,record.splits,COUNT(*) OVER(PARTITION BY pb.id_level)::bigint total_count,ROW_NUMBER() OVER(PARTITION BY pb.id_level ORDER BY record.time,record.id) row_number FROM public.personal_best_global pb JOIN public.record record ON record.id=pb.id_record JOIN public.\"user\" account ON account.id=pb.id_user WHERE pb.id_level=ANY($1) AND account.banned=false) SELECT ranked.id_level,ranked.total_count,ranked.time,ranked.splits,statistic.time AS statistic_time,statistic.turn_left_count,statistic.turn_left_time,statistic.turn_right_count,statistic.turn_right_time,statistic.brake_count,statistic.brake_time,statistic.arms_up_count,statistic.arms_up_time,statistic.driver_input_transition_count,statistic.has_input_data FROM ranked LEFT JOIN public.record_statistic statistic ON statistic.id_record=ranked.id WHERE ranked.row_number<=20 ORDER BY ranked.id_level,ranked.row_number")
                .bind::<Array<Integer>,_>(&eligible).load::<PersonalBestRow>(connection).await?};
            let votes=if eligible.is_empty(){Vec::new()}else{sql_query("SELECT id_level,value FROM public.vote WHERE id_level=ANY($1) AND coalesce(date_updated,date_created)<=clock_timestamp()-interval '7 days'")
                .bind::<Array<Integer>,_>(&eligible).load::<VoteRow>(connection).await?};
            let skills=if eligible.is_empty(){Vec::new()}else{sql_query("WITH target_ranked AS MATERIALIZED(SELECT pb.id_level,pb.id_user,record.time,min(record.time) OVER(PARTITION BY pb.id_level) world_record_time,RANK() OVER(PARTITION BY pb.id_level ORDER BY record.time) placement_rank,COUNT(*) OVER(PARTITION BY pb.id_level) field_count FROM public.personal_best_global pb JOIN public.record record ON record.id=pb.id_record JOIN public.\"user\" account ON account.id=pb.id_user WHERE pb.id_level=ANY($1) AND account.banned=false AND record.time>0),target AS MATERIALIZED(SELECT *,CASE WHEN field_count>1 THEN 1-(placement_rank-1)::double precision/(field_count-1) ELSE 0.5 END placement,CASE WHEN field_count>=20 THEN 1 ELSE 0 END target_contributed FROM target_ranked),leave_one_out AS MATERIALIZED(SELECT target.*,(5.0+aggregate.placement_sum-target.placement*target.target_contributed)/(10+aggregate.eligible_level_count-target.target_contributed) independent_skill FROM target JOIN public.player_skill_aggregate aggregate ON aggregate.id_user=target.id_user WHERE aggregate.eligible_level_count-target.target_contributed>=20),skill_ranked AS MATERIALIZED(SELECT *,PERCENT_RANK() OVER(PARTITION BY id_level ORDER BY independent_skill) skill_percentile FROM leave_one_out) SELECT id_level,count(*)::integer rated_player_count,corr(skill_percentile,placement)::double precision alignment,(percentile_cont(0.5) WITHIN GROUP(ORDER BY ln(time/world_record_time)) FILTER(WHERE skill_percentile BETWEEN 0.4 AND 0.6)-percentile_cont(0.5) WITHIN GROUP(ORDER BY ln(time/world_record_time)) FILTER(WHERE skill_percentile>=0.8))::double precision separation,percentile_cont(0.5) WITHIN GROUP(ORDER BY independent_skill) FILTER(WHERE placement_rank<=10)::double precision field_strength FROM skill_ranked GROUP BY id_level")
                .bind::<Array<Integer>,_>(&eligible).load::<SkillRow>(connection).await?};
            for id in ids {
                if !eligible.contains(id) {
                    if !report_only { upsert_zero_level_points(connection,*id).await?; }
                    continue;
                }
                let rows:Vec<_>=personal_bests.iter().filter(|row|row.id_level==*id).collect();
                let runs=rows.iter().map(|row|zc_core::score::LevelScorePersonalBest{time:f64::from(row.time),splits:row.splits.clone().unwrap_or_default().into_iter().map(f64::from).collect(),telemetry:(row.statistic_time.is_some()||row.has_input_data.is_some()).then(||zc_core::score::LevelScoreTelemetry{arms_up_count:row.arms_up_count,arms_up_time:row.arms_up_time.map(f64::from),brake_count:row.brake_count,brake_time:row.brake_time.map(f64::from),driver_input_transition_count:row.driver_input_transition_count,has_input_data:row.has_input_data,time:row.statistic_time.map(f64::from),turn_left_count:row.turn_left_count,turn_left_time:row.turn_left_time.map(f64::from),turn_right_count:row.turn_right_count,turn_right_time:row.turn_right_time.map(f64::from)})}).collect();
                let skill=skills.iter().find(|row|row.id_level==*id).map(|row|zc_core::score::LevelScoreSkillMetrics{alignment:row.alignment,field_strength:row.field_strength,rated_player_count:row.rated_player_count,separation:row.separation});
                let vote_values:Vec<_>=votes.iter().filter(|row|row.id_level==*id).map(|row|f64::from(row.value)).collect();
                let result=zc_core::score::calculate_level_points_v2(runs,rows.as_slice().first().map_or(0,|row|row.total_count),skill,&vote_values);
                if !report_only { upsert_level_points(connection,*id,result).await?; }
            }
            Ok(MaintenanceOutcome::Applied(()))
        })).await;
        contention_outcome(result)
    }

    pub async fn level_contribution_user_page(
        &self,
        id_level: i32,
        after_user_id: i32,
        limit: i64,
    ) -> Result<LevelContributionPage> {
        ensure!(id_level > 0, "id_level must be positive");
        ensure!(after_user_id >= 0, "after_user_id must not be negative");
        ensure!((1..=50).contains(&limit), "level contribution page limit must be 1..=50");
        let mut connection = self.connection().await?;
        let user_ids = sql_query(
            "SELECT affected.id_user AS id FROM (SELECT id_user FROM public.personal_best_global WHERE id_level=$1 UNION SELECT id_user FROM public.user_point_contribution WHERE id_level=$1) affected WHERE affected.id_user>$2 ORDER BY affected.id_user LIMIT $3",
        )
        .bind::<Integer, _>(id_level)
        .bind::<Integer, _>(after_user_id)
        .bind::<BigInt, _>(limit)
        .load::<IdRow>(&mut connection)
        .await?
        .into_iter()
        .map(|row| row.id)
        .collect::<Vec<_>>();
        let next_after_user_id = (user_ids.len() == limit as usize)
            .then(|| user_ids.last().copied())
            .flatten();
        Ok(LevelContributionPage {
            user_ids,
            next_after_user_id,
        })
    }

    pub async fn reconcile_level_contribution_users(
        &self,
        id_level: i32,
        user_ids: &[i32],
    ) -> Result<MaintenanceOutcome<Vec<i32>>> {
        ensure!(id_level > 0, "id_level must be positive");
        ensure!(user_ids.len() <= 50, "level contribution batch exceeds 50 users");
        if user_ids.is_empty() {
            return Ok(MaintenanceOutcome::Applied(Vec::new()));
        }
        let mut sorted = user_ids.to_vec();
        sorted.sort_unstable();
        sorted.dedup();
        ensure!(sorted.iter().all(|id| *id > 0), "id_user must be positive");
        let mut connection = self.connection().await?;
        let result = connection
            .transaction::<MaintenanceOutcome<Vec<i32>>, anyhow::Error, _>(|connection| {
                Box::pin(async move {
                    set_maintenance_lock_timeout(connection).await?;
                    if !try_user_score_locks(connection, &sorted).await? {
                        return Ok(MaintenanceOutcome::Contended);
                    }
                    sync_contribution_levels_for_users(connection, &[id_level], &sorted).await?;
                    Ok(MaintenanceOutcome::Applied(sorted))
                })
            })
            .await;
        contention_outcome(result)
    }

    pub async fn prune_points_history_batch(&self, level_history: bool) -> Result<i64> {
        let statement = if level_history {
            "WITH candidates AS MATERIALIZED (SELECT history.id_level FROM public.level_points_history history WHERE history.date_created<clock_timestamp()-interval '28 days' GROUP BY history.id_level HAVING count(*)>count(DISTINCT date_trunc('week',history.date_created AT TIME ZONE 'UTC')) ORDER BY history.id_level LIMIT 200), annotated AS MATERIALIZED (SELECT history.*,date_trunc('week',history.date_created AT TIME ZONE 'UTC') AS week_start,first_value(history.points) OVER(PARTITION BY history.id_level,date_trunc('week',history.date_created AT TIME ZONE 'UTC') ORDER BY history.date_created DESC,history.id DESC) latest_points FROM public.level_points_history history JOIN candidates USING(id_level) WHERE history.date_created<clock_timestamp()-interval '28 days'), ranked AS MATERIALIZED (SELECT id,row_number() OVER(PARTITION BY id_level,week_start ORDER BY CASE WHEN latest_points=0 THEN date_created END DESC NULLS LAST,CASE WHEN latest_points<>0 THEN points END DESC NULLS LAST,date_created DESC,id DESC) keeper_rank FROM annotated), deleted AS (DELETE FROM public.level_points_history history USING (SELECT id FROM ranked WHERE keeper_rank>1 LIMIT 10000) target WHERE history.id=target.id RETURNING history.id) SELECT count(*)::bigint AS count FROM deleted"
        } else {
            "WITH candidates AS MATERIALIZED (SELECT history.id_user FROM public.user_points_history history WHERE history.date_created<clock_timestamp()-interval '28 days' GROUP BY history.id_user HAVING count(*)>count(DISTINCT date_trunc('week',history.date_created AT TIME ZONE 'UTC')) ORDER BY history.id_user LIMIT 200), ranked AS MATERIALIZED (SELECT history.id,row_number() OVER(PARTITION BY history.id_user,date_trunc('week',history.date_created AT TIME ZONE 'UTC') ORDER BY CASE WHEN history.rank>0 THEN 0 ELSE 1 END,CASE WHEN history.rank>0 THEN history.rank END ASC NULLS LAST,history.date_created DESC,history.id DESC) keeper_rank FROM public.user_points_history history JOIN candidates USING(id_user) WHERE history.date_created<clock_timestamp()-interval '28 days'), deleted AS (DELETE FROM public.user_points_history history USING (SELECT id FROM ranked WHERE keeper_rank>1 LIMIT 10000) target WHERE history.id=target.id RETURNING history.id) SELECT count(*)::bigint AS count FROM deleted"
        };
        let mut connection = self.connection().await?;
        let result: CountRow = sql_query(statement).get_result(&mut connection).await?;
        Ok(result.count)
    }

    pub async fn tournament_lobby_sources(
        &self,
        id_tournament: i32,
    ) -> Result<Vec<TournamentLobbySource>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "SELECT item.workshop_id,item.file_uid,item.file_author,item.name AS level_name,COALESCE((SELECT metadata.format FROM public.level_metadata metadata WHERE metadata.id_level=item.id_level ORDER BY metadata.id LIMIT 1),0)::integer AS format \
             FROM public.track_tournament tournament JOIN public.level level ON level.id=tournament.id_level AND level.publicly_visible=true JOIN public.level_item item ON item.id_level=level.id AND item.deleted=false AND item.publicly_visible=true WHERE tournament.id=$1 ORDER BY item.updated_at DESC,item.id DESC",
        ).bind::<Integer, _>(id_tournament).load(&mut connection).await?)
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn publish_tournament_lobby_asset(
        &self,
        id_tournament: i32,
        workshop_id: i64,
        file_uid: &str,
        level_name: &str,
        author: &str,
        object_key: &str,
        sha256: &str,
        byte_size: i32,
    ) -> Result<()> {
        let mut connection = self.connection().await?;
        sql_query("INSERT INTO zc_private.track_tournament_lobby_asset(id_tournament,workshop_id,file_uid,level_name,author,collaborators,override_author_name,object_key,content_sha256,byte_size,date_created,date_updated) VALUES($1,$2,$3,$4,$5,'','',$6,$7,$8,clock_timestamp(),clock_timestamp()) ON CONFLICT(id_tournament) DO UPDATE SET workshop_id=excluded.workshop_id,file_uid=excluded.file_uid,level_name=excluded.level_name,author=excluded.author,collaborators=excluded.collaborators,override_author_name=excluded.override_author_name,object_key=excluded.object_key,content_sha256=excluded.content_sha256,byte_size=excluded.byte_size,date_updated=excluded.date_updated")
            .bind::<Integer,_>(id_tournament).bind::<BigInt,_>(workshop_id).bind::<Text,_>(file_uid).bind::<Text,_>(level_name).bind::<Text,_>(author).bind::<Text,_>(object_key).bind::<Text,_>(sha256).bind::<Integer,_>(byte_size).execute(&mut connection).await?;
        Ok(())
    }

    pub async fn rotate_track_tournament(
        &self,
        tournament_type: i32,
    ) -> Result<TournamentRotation> {
        ensure!(matches!(tournament_type, 0 | 1), "invalid tournament type");
        let mut connection = self.connection().await?;
        connection.transaction::<TournamentRotation,anyhow::Error,_>(|connection|Box::pin(async move {
            sql_query("SELECT pg_advisory_xact_lock(1953744431,$1)").bind::<Integer,_>(tournament_type).execute(connection).await?;
            let boundary:BooleanRow=sql_query("SELECT CASE WHEN $1=0 THEN extract(isodow FROM timezone('UTC',clock_timestamp()))=1 AND extract(hour FROM timezone('UTC',clock_timestamp()))=6 ELSE extract(day FROM timezone('UTC',clock_timestamp()))=1 AND extract(hour FROM timezone('UTC',clock_timestamp()))=6 END AS value").bind::<Integer,_>(tournament_type).get_result(connection).await?;
            if !boundary.value{return Ok(TournamentRotation{created:false,id_tournament:None});}
            sql_query("UPDATE public.track_tournament SET finalized_at=clock_timestamp(),date_updated=clock_timestamp() WHERE type=$1 AND finalized_at IS NULL AND end_at<=clock_timestamp()")
                .bind::<Integer,_>(tournament_type).execute(connection).await?;
            let existing=sql_query("SELECT id FROM public.track_tournament WHERE type=$1 AND start_at=CASE WHEN $1=0 THEN date_trunc('week',timezone('UTC',clock_timestamp())) AT TIME ZONE 'UTC' ELSE date_trunc('month',timezone('UTC',clock_timestamp())) AT TIME ZONE 'UTC' END LIMIT 1")
                .bind::<Integer,_>(tournament_type).get_result::<IdRow>(connection).await.optional()?;
            if let Some(row)=existing{return Ok(TournamentRotation{created:false,id_tournament:Some(row.id)});}
            let created=sql_query("WITH eligible AS MATERIALIZED(SELECT points.id_level,points.points FROM public.level_points points JOIN public.level level ON level.id=points.id_level AND level.publicly_visible=true WHERE level.date_created>=clock_timestamp()-CASE WHEN $1=0 THEN interval '60 days' ELSE interval '30 days' END AND EXISTS(SELECT 1 FROM public.level_item item WHERE item.id_level=level.id AND item.publicly_visible=true AND item.deleted=false)), threshold AS(SELECT percentile_cont(0.9) WITHIN GROUP(ORDER BY points) AS points FROM eligible), selected AS(SELECT eligible.id_level FROM eligible CROSS JOIN threshold WHERE eligible.points>=threshold.points AND NOT EXISTS(SELECT 1 FROM public.track_tournament used WHERE used.type=$1 AND used.id_level=eligible.id_level) ORDER BY random() LIMIT 1) INSERT INTO public.track_tournament(type,slug,id_level,start_at,end_at,points_version,date_created,date_updated) SELECT $1,CASE WHEN $1=0 THEN to_char(timezone('UTC',clock_timestamp()),'IYYY-\"W\"IW') ELSE to_char(timezone('UTC',clock_timestamp()),'YYYY-MM') END,selected.id_level,CASE WHEN $1=0 THEN date_trunc('week',timezone('UTC',clock_timestamp())) AT TIME ZONE 'UTC' ELSE date_trunc('month',timezone('UTC',clock_timestamp())) AT TIME ZONE 'UTC' END,CASE WHEN $1=0 THEN (date_trunc('week',timezone('UTC',clock_timestamp()))+interval '1 week') AT TIME ZONE 'UTC' ELSE (date_trunc('month',timezone('UTC',clock_timestamp()))+interval '1 month') AT TIME ZONE 'UTC' END,1,clock_timestamp(),clock_timestamp() FROM selected RETURNING id")
                .bind::<Integer,_>(tournament_type).get_result::<IdRow>(connection).await.optional()?;
            Ok(TournamentRotation{created:created.is_some(),id_tournament:created.map(|row|row.id)})
        })).await
    }
}

async fn upsert_zero_level_points(
    connection: &mut diesel_async::AsyncPgConnection,
    id_level: i32,
) -> Result<()> {
    sql_query("INSERT INTO public.level_points(id_level,points,rating,modifier_length,modifier_evidence,modifier_quality,modifier_rating,complexity_confidence,complexity_score,field_strength,quality_score,skill_alignment,skill_confidence,skill_sample_size,skill_score,skill_separation,date_created,date_updated) VALUES($1,0,0.5,0,0.2,0.55,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,clock_timestamp(),clock_timestamp()) ON CONFLICT(id_level) DO UPDATE SET points=0,modifier_length=0,modifier_evidence=0.2,modifier_quality=0.55,modifier_rating=1,complexity_confidence=NULL,complexity_score=NULL,field_strength=NULL,quality_score=NULL,skill_alignment=NULL,skill_confidence=NULL,skill_sample_size=NULL,skill_score=NULL,skill_separation=NULL,date_updated=clock_timestamp()")
        .bind::<Integer,_>(id_level).execute(connection).await?;
    Ok(())
}

async fn upsert_level_points(
    connection: &mut diesel_async::AsyncPgConnection,
    id_level: i32,
    value: zc_core::score::LevelScoreResult,
) -> Result<()> {
    let real = |value: f64| value as f32;
    let optional = |value: Option<f64>| value.map(|value| value as f32);
    sql_query("INSERT INTO public.level_points(id_level,points,rating,modifier_length,modifier_evidence,modifier_quality,modifier_rating,complexity_confidence,complexity_score,field_strength,quality_score,skill_alignment,skill_confidence,skill_sample_size,skill_score,skill_separation,date_created,date_updated) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,clock_timestamp(),clock_timestamp()) ON CONFLICT(id_level) DO UPDATE SET points=excluded.points,rating=excluded.rating,modifier_length=excluded.modifier_length,modifier_evidence=excluded.modifier_evidence,modifier_quality=excluded.modifier_quality,modifier_rating=excluded.modifier_rating,complexity_confidence=excluded.complexity_confidence,complexity_score=excluded.complexity_score,field_strength=excluded.field_strength,quality_score=excluded.quality_score,skill_alignment=excluded.skill_alignment,skill_confidence=excluded.skill_confidence,skill_sample_size=excluded.skill_sample_size,skill_score=excluded.skill_score,skill_separation=excluded.skill_separation,date_updated=excluded.date_updated")
        .bind::<Integer,_>(id_level).bind::<Integer,_>(value.points).bind::<Float,_>(real(value.rating))
        .bind::<Float,_>(real(value.length_modifier)).bind::<Float,_>(real(value.evidence_modifier)).bind::<Float,_>(real(value.quality_modifier)).bind::<Float,_>(real(value.rating_modifier))
        .bind::<Nullable<Float>,_>(optional(value.complexity_confidence)).bind::<Nullable<Float>,_>(optional(value.complexity_score)).bind::<Nullable<Float>,_>(optional(value.field_strength)).bind::<Nullable<Float>,_>(optional(value.quality_score))
        .bind::<Nullable<Float>,_>(optional(value.skill_alignment)).bind::<Nullable<Float>,_>(optional(value.skill_confidence)).bind::<Nullable<Integer>,_>(value.skill_sample_size).bind::<Nullable<Float>,_>(optional(value.skill_score)).bind::<Nullable<Float>,_>(optional(value.skill_separation))
        .execute(connection).await?;
    Ok(())
}

async fn sync_contribution_levels_for_users(
    connection: &mut diesel_async::AsyncPgConnection,
    ids: &[i32],
    affected: &[i32],
) -> Result<()> {
    if affected.is_empty() {
        return Ok(());
    }
    sql_query("WITH ranked_all AS(SELECT pb.id_user,pb.id_level,pb.id_record,points.points AS level_points,RANK() OVER(PARTITION BY pb.id_level ORDER BY record.time)::integer AS level_position FROM public.personal_best_global pb JOIN public.record record ON record.id=pb.id_record JOIN public.level_points points ON points.id_level=pb.id_level WHERE pb.id_level=ANY($1) AND points.points>0),ranked AS(SELECT * FROM ranked_all WHERE id_user=ANY($2)),desired AS(SELECT ranked.*,CASE WHEN ln(ranked.level_points::double precision)+(ranked.level_position-1)*ln(0.985)<ln(1.401298464324817e-45) THEN 0 ELSE ranked.level_points::double precision*power(0.985,ranked.level_position-1) END AS level_decayed_points FROM ranked) INSERT INTO public.user_point_contribution(id_user,id_level,id_record,contribution_rank,level_position,level_points,level_decayed_points,player_decayed_points,date_calculated) SELECT desired.id_user,desired.id_level,desired.id_record,coalesce(existing.contribution_rank,2147483647),desired.level_position,desired.level_points,desired.level_decayed_points,coalesce(existing.player_decayed_points,0),clock_timestamp() FROM desired LEFT JOIN public.user_point_contribution existing ON existing.id_user=desired.id_user AND existing.id_level=desired.id_level ON CONFLICT(id_user,id_level) DO UPDATE SET id_record=excluded.id_record,level_position=excluded.level_position,level_points=excluded.level_points,level_decayed_points=excluded.level_decayed_points,date_calculated=excluded.date_calculated WHERE ROW(user_point_contribution.id_record,user_point_contribution.level_position,user_point_contribution.level_points,user_point_contribution.level_decayed_points) IS DISTINCT FROM ROW(excluded.id_record,excluded.level_position,excluded.level_points,excluded.level_decayed_points)")
        .bind::<Array<Integer>,_>(ids).bind::<Array<Integer>,_>(affected).execute(connection).await?;
    sql_query("DELETE FROM public.user_point_contribution contribution WHERE contribution.id_level=ANY($1) AND contribution.id_user=ANY($2) AND NOT EXISTS(SELECT 1 FROM public.personal_best_global pb JOIN public.level_points points ON points.id_level=pb.id_level WHERE pb.id_user=contribution.id_user AND pb.id_level=contribution.id_level AND points.points>0)")
        .bind::<Array<Integer>,_>(ids).bind::<Array<Integer>,_>(affected).execute(connection).await?;
    Ok(())
}

async fn set_maintenance_lock_timeout(
    connection: &mut diesel_async::AsyncPgConnection,
) -> Result<()> {
    sql_query("SELECT set_config('lock_timeout',$1,true)")
        .bind::<Text, _>(MAINTENANCE_LOCK_TIMEOUT)
        .execute(connection)
        .await?;
    Ok(())
}

async fn try_user_score_locks(
    connection: &mut diesel_async::AsyncPgConnection,
    ids: &[i32],
) -> Result<bool> {
    if ids.is_empty() {
        return Ok(true);
    }
    let mut sorted = ids.to_vec();
    sorted.sort_unstable();
    sorted.dedup();
    let result: BooleanRow = sql_query(
        "SELECT COALESCE(bool_and(pg_try_advisory_xact_lock($1,target.id)),true) AS value \
         FROM (SELECT id FROM unnest($2::integer[]) value(id) ORDER BY id) target",
    )
    .bind::<Integer, _>(USER_SCORE_LOCK_NAMESPACE)
    .bind::<Array<Integer>, _>(&sorted)
    .get_result(connection)
    .await?;
    Ok(result.value)
}

fn contention_outcome<T>(result: Result<MaintenanceOutcome<T>>) -> Result<MaintenanceOutcome<T>> {
    match result {
        Err(error) if is_maintenance_contention(&error) => Ok(MaintenanceOutcome::Contended),
        result => result,
    }
}

fn is_maintenance_contention(error: &anyhow::Error) -> bool {
    error.chain().any(|cause| {
        let message = cause.to_string().to_ascii_lowercase();
        message.contains("lock timeout") || message.contains("deadlock detected")
    })
}
