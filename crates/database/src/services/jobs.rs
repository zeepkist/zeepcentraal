use crate::{
    Database,
    services::discord_rank::{RankChange, append_rank_changes},
};
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
pub(crate) const LEVEL_SCORE_LOCK_NAMESPACE: i32 = 1_861_284_954;
const MAINTENANCE_LOCK_TIMEOUT: &str = "100ms";

const TRACK_TOURNAMENT_SELECTION_SQL: &str =
    include_str!("../queries/track_tournament/track_tournament_selection.sql");

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MaintenanceOutcome<T> {
    Applied(T),
    SnapshotChanged,
    Contended,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LevelScoreUpdate {
    pub points_changed: bool,
    pub projection_needed: bool,
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
        Ok(sql_query(include_str!(
            "../queries/record_statistics/record_media_for_statistics.sql"
        ))
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
        sql_query(include_str!(
            "../queries/record_statistics/upsert_record_statistics.sql"
        ))
        .bind::<Integer, _>(id_record)
        .bind::<Jsonb, _>(value)
        .execute(&mut connection)
        .await?;
        Ok(())
    }

    pub async fn changed_level_point_ids(&self) -> Result<Vec<i32>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(include_str!(
            "../queries/scoring/changed_level_point_ids.sql"
        ))
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
        Ok(sql_query(include_str!(
            "../queries/scoring/insert_level_point_histories.sql"
        ))
        .bind::<Array<Integer>, _>(ids)
        .execute(&mut connection)
        .await?)
    }

    pub async fn all_user_point_ids(&self) -> Result<Vec<i32>> {
        let mut connection = self.connection().await?;
        Ok(
            sql_query(include_str!("../queries/scoring/all_user_point_ids.sql"))
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
        Ok(sql_query(include_str!(
            "../queries/scoring/insert_user_point_histories.sql"
        ))
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
        Ok(
            sql_query(include_str!("../queries/scoring/user_activity_page.sql"))
                .bind::<Integer, _>(after_id)
                .bind::<BigInt, _>(limit)
                .load(&mut connection)
                .await?,
        )
    }

    pub async fn user_score_sources(&self, ids: &[i32]) -> Result<Vec<UserScoreSource>> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut connection = self.connection().await?;
        let rows = sql_query(include_str!("../queries/scoring/user_score_sources.sql"))
            .bind::<Array<Integer>, _>(ids)
            .load::<UserContributionRow>(&mut connection)
            .await?;
        Ok(group_user_contributions(ids, rows))
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
            .transaction::<MaintenanceOutcome<()>, anyhow::Error, _>(async move |connection| {
                set_maintenance_lock_timeout(connection).await?;
                if !try_user_score_locks(connection, &[id_user]).await? {
                    return Ok(MaintenanceOutcome::Contended);
                }
                let matches: BooleanRow = sql_query(include_str!(
                    "../queries/scoring/persist_player_contributions.sql"
                ))
                .bind::<Integer, _>(id_user)
                .bind::<Jsonb, _>(&expected)
                .get_result(connection)
                .await?;
                if !matches.value {
                    // PostgreSQL fires statement triggers even when the guarded
                    // UPDATE finds no rows. Discard their writes on mismatch.
                    return Err(diesel::result::Error::RollbackTransaction.into());
                }
                sql_query(include_str!("../queries/scoring/persist_player_score.sql"))
                    .bind::<Integer, _>(id_user)
                    .bind::<Integer, _>(points)
                    .bind::<Integer, _>(total_points)
                    .execute(connection)
                    .await?;
                super::record_counts::refresh_user_record_counts(connection, &[id_user]).await?;
                Ok(MaintenanceOutcome::Applied(()))
            })
            .await;
        match result {
            Err(error)
                if matches!(
                    error.downcast_ref::<diesel::result::Error>(),
                    Some(diesel::result::Error::RollbackTransaction)
                ) =>
            {
                Ok(MaintenanceOutcome::SnapshotChanged)
            }
            result => contention_outcome(result),
        }
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
            .transaction::<MaintenanceOutcome<()>, anyhow::Error, _>(async move |connection| {
                    set_maintenance_lock_timeout(connection).await?;
                    if !try_user_score_locks(connection, &sorted).await? {
                        return Ok(MaintenanceOutcome::Contended);
                    }
                    sql_query(
                        include_str!("../queries/scoring/reset_inactive_player_points.sql"),
                    )
                    .bind::<Array<Integer>, _>(&sorted)
                    .execute(connection)
                    .await?;
                    let rows=sql_query(include_str!("../queries/scoring/load_inactive_player_contributions.sql"))
                        .bind::<Array<Integer>,_>(&sorted).load::<UserContributionRow>(connection).await?;
                    let totals=serde_json::Value::Array(group_user_contributions(&sorted,rows).into_iter().map(|source| {
                        let score=zc_core::score::calculate_player_points(source.contributions);
                        serde_json::json!({"id_user":source.id_user,"total_points":score.total_points})
                    }).collect());
                    sql_query(include_str!("../queries/scoring/write_inactive_player_totals.sql")).bind::<Array<Integer>,_>(&sorted).bind::<Jsonb,_>(totals).execute(connection).await?;
                    super::record_counts::refresh_user_record_counts(connection, &sorted).await?;
                    Ok(MaintenanceOutcome::Applied(()))
                })
            .await;
        contention_outcome(result)
    }

    pub async fn player_rank_snapshot(&self) -> Result<Vec<PlayerRankSnapshot>> {
        let mut connection = self.connection().await?;
        Ok(
            sql_query(include_str!("../queries/scoring/player_rank_snapshot.sql"))
                .load(&mut connection)
                .await?,
        )
    }

    /// Recheck the whole field, including users outside the most recently written batch.
    pub async fn player_rank_snapshot_is_current(
        &self,
        snapshot: &[PlayerRankSnapshot],
    ) -> Result<bool> {
        Ok(self.player_rank_snapshot().await? == snapshot)
    }

    pub async fn persist_player_rank_batch(
        &self,
        snapshot: &[PlayerRankSnapshot],
    ) -> Result<MaintenanceOutcome<usize>> {
        self.persist_player_rank_batch_with_notifications(snapshot, true)
            .await
    }

    pub async fn persist_player_rank_batch_with_notifications(
        &self,
        snapshot: &[PlayerRankSnapshot],
        notify: bool,
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
            .transaction::<MaintenanceOutcome<usize>, anyhow::Error, _>(async move |connection| {
                set_maintenance_lock_timeout(connection).await?;
                if !try_user_score_locks(connection, &ids).await? {
                    return Ok(MaintenanceOutcome::Contended);
                }
                let matches: BooleanRow =
                    sql_query(include_str!("../queries/scoring/persist_rank_batch.sql"))
                        .bind::<Jsonb, _>(&source)
                        .get_result(connection)
                        .await?;
                if !matches.value {
                    return Ok(MaintenanceOutcome::SnapshotChanged);
                }
                let changes = sql_query(include_str!(
                    "../queries/scoring/persist_rank_batch_and_enqueue_changes.sql"
                ))
                .bind::<Jsonb, _>(&source)
                .load::<RankChange>(connection)
                .await?;
                let count = changes.len();
                if count > 0 && notify {
                    append_rank_changes(connection, changes).await?;
                }
                Ok(MaintenanceOutcome::Applied(count))
            })
            .await;
        contention_outcome(result)
    }

    pub async fn level_ids_page(&self, after_id: i32, recent_only: bool) -> Result<Vec<i32>> {
        let mut connection = self.connection().await?;
        Ok(
            sql_query(include_str!("../queries/scoring/level_ids_page.sql"))
                .bind::<Integer, _>(after_id)
                .bind::<Bool, _>(recent_only)
                .load::<IdRow>(&mut connection)
                .await?
                .into_iter()
                .map(|row| row.id)
                .collect(),
        )
    }

    pub async fn rebuild_player_skill_aggregates(&self) -> Result<usize> {
        let mut connection = self.connection().await?;
        connection
            .transaction::<usize, anyhow::Error, _>(async move |connection| {
                sql_query(include_str!(
                    "../queries/scoring/delete_player_skill_aggregate.sql"
                ))
                .execute(connection)
                .await?;
                Ok(sql_query(include_str!(
                    "../queries/scoring/insert_player_skill_aggregates.sql"
                ))
                .execute(connection)
                .await?)
            })
            .await
    }

    pub async fn update_level_scores(
        &self,
        ids: &[i32],
        report_only: bool,
    ) -> Result<MaintenanceOutcome<LevelScoreUpdate>> {
        if ids.is_empty() {
            return Ok(MaintenanceOutcome::Applied(LevelScoreUpdate {
                points_changed: false,
                projection_needed: false,
            }));
        }
        ensure!(
            report_only || ids.len() == 1,
            "persistent level scoring requires one level"
        );
        let mut connection = self.connection().await?;
        let result = connection
            .transaction::<MaintenanceOutcome<LevelScoreUpdate>, anyhow::Error, _>(
                async move |connection| {
                    if !report_only {
                        set_maintenance_lock_timeout(connection).await?;
                        let lock: BooleanRow =
                            sql_query(include_str!("../queries/scoring/try_level_score_lock.sql"))
                                .bind::<Integer, _>(LEVEL_SCORE_LOCK_NAMESPACE)
                                .bind::<Integer, _>(ids[0])
                                .get_result(connection)
                                .await?;
                        if !lock.value {
                            return Ok(MaintenanceOutcome::Contended);
                        }
                    }
                    let availability = sql_query(include_str!(
                        "../queries/scoring/load_level_scoring_inputs.sql"
                    ))
                    .bind::<Array<Integer>, _>(ids)
                    .load::<AvailabilityRow>(connection)
                    .await?;
                    let eligible: Vec<_> = availability
                        .iter()
                        .filter(|row| {
                            zc_core::score::level_score_eligible(
                                row.adventure,
                                row.item_count,
                                row.accessible_item_count,
                            )
                        })
                        .map(|row| row.id_level)
                        .collect();
                    let personal_bests = if eligible.is_empty() {
                        Vec::new()
                    } else {
                        sql_query(include_str!(
                            "../queries/scoring/level_scoring_personal_bests.sql"
                        ))
                        .bind::<Array<Integer>, _>(&eligible)
                        .load::<PersonalBestRow>(connection)
                        .await?
                    };
                    let votes = if eligible.is_empty() {
                        Vec::new()
                    } else {
                        sql_query(include_str!(
                            "../queries/scoring/load_level_scoring_votes.sql"
                        ))
                        .bind::<Array<Integer>, _>(&eligible)
                        .load::<VoteRow>(connection)
                        .await?
                    };
                    let skills = if eligible.is_empty() {
                        Vec::new()
                    } else {
                        sql_query(include_str!(
                            "../queries/scoring/rank_level_scoring_contributions.sql"
                        ))
                        .bind::<Array<Integer>, _>(&eligible)
                        .load::<SkillRow>(connection)
                        .await?
                    };
                    let mut points_changed = false;
                    for id in ids {
                        if !eligible.contains(id) {
                            if !report_only {
                                points_changed |= upsert_zero_level_points(connection, *id).await?;
                            }
                            continue;
                        }
                        let rows: Vec<_> = personal_bests
                            .iter()
                            .filter(|row| row.id_level == *id)
                            .collect();
                        let runs = rows
                            .iter()
                            .map(|row| zc_core::score::LevelScorePersonalBest {
                                time: f64::from(row.time),
                                splits: row
                                    .splits
                                    .clone()
                                    .unwrap_or_default()
                                    .into_iter()
                                    .map(f64::from)
                                    .collect(),
                                telemetry: (row.statistic_time.is_some()
                                    || row.has_input_data.is_some())
                                .then(|| zc_core::score::LevelScoreTelemetry {
                                    arms_up_count: row.arms_up_count,
                                    arms_up_time: row.arms_up_time.map(f64::from),
                                    brake_count: row.brake_count,
                                    brake_time: row.brake_time.map(f64::from),
                                    driver_input_transition_count: row
                                        .driver_input_transition_count,
                                    has_input_data: row.has_input_data,
                                    time: row.statistic_time.map(f64::from),
                                    turn_left_count: row.turn_left_count,
                                    turn_left_time: row.turn_left_time.map(f64::from),
                                    turn_right_count: row.turn_right_count,
                                    turn_right_time: row.turn_right_time.map(f64::from),
                                }),
                            })
                            .collect();
                        let skill = skills.iter().find(|row| row.id_level == *id).map(|row| {
                            zc_core::score::LevelScoreSkillMetrics {
                                alignment: row.alignment,
                                field_strength: row.field_strength,
                                rated_player_count: row.rated_player_count,
                                separation: row.separation,
                            }
                        });
                        let vote_values: Vec<_> = votes
                            .iter()
                            .filter(|row| row.id_level == *id)
                            .map(|row| f64::from(row.value))
                            .collect();
                        let result = zc_core::score::calculate_level_points_v2(
                            runs,
                            rows.as_slice().first().map_or(0, |row| row.total_count),
                            skill,
                            &vote_values,
                        );
                        if !report_only {
                            points_changed |= upsert_level_points(connection, *id, result).await?;
                        }
                    }
                    let projection_needed = if report_only {
                        false
                    } else {
                        level_contribution_drift(connection, ids[0]).await?
                    };
                    Ok(MaintenanceOutcome::Applied(LevelScoreUpdate {
                        points_changed,
                        projection_needed,
                    }))
                },
            )
            .await;
        contention_outcome(result)
    }

    /// Include every holder, even failed records and levels without score contributions.
    pub async fn level_record_count_user_page(
        &self,
        id_level: i32,
        after_user_id: i32,
    ) -> Result<LevelContributionPage> {
        ensure!(
            id_level > 0 && after_user_id >= 0,
            "invalid record count cursor"
        );
        let user_ids = sql_query(include_str!(
            "../queries/record_counts/level_record_count_user_page.sql"
        ))
        .bind::<Integer, _>(id_level)
        .bind::<Integer, _>(after_user_id)
        .load::<IdRow>(&mut self.connection().await?)
        .await?
        .into_iter()
        .map(|row| row.id)
        .collect::<Vec<_>>();
        let next_after_user_id = (user_ids.len() == 50)
            .then(|| user_ids.last().copied())
            .flatten();
        Ok(LevelContributionPage {
            user_ids,
            next_after_user_id,
        })
    }

    pub async fn level_contribution_user_page(
        &self,
        id_level: i32,
        after_user_id: i32,
        limit: i64,
    ) -> Result<LevelContributionPage> {
        ensure!(id_level > 0, "id_level must be positive");
        ensure!(after_user_id >= 0, "after_user_id must not be negative");
        ensure!(
            (1..=50).contains(&limit),
            "level contribution page limit must be 1..=50"
        );
        let mut connection = self.connection().await?;
        let user_ids = sql_query(include_str!(
            "../queries/scoring/level_contribution_user_page.sql"
        ))
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
        ensure!(
            user_ids.len() <= 50,
            "level contribution batch exceeds 50 users"
        );
        if user_ids.is_empty() {
            return Ok(MaintenanceOutcome::Applied(Vec::new()));
        }
        let mut sorted = user_ids.to_vec();
        sorted.sort_unstable();
        sorted.dedup();
        ensure!(sorted.iter().all(|id| *id > 0), "id_user must be positive");
        let mut connection = self.connection().await?;
        let result = connection
            .transaction::<MaintenanceOutcome<Vec<i32>>, anyhow::Error, _>(
                async move |connection| {
                    set_maintenance_lock_timeout(connection).await?;
                    if !try_user_score_locks(connection, &sorted).await? {
                        return Ok(MaintenanceOutcome::Contended);
                    }
                    let changed =
                        sync_contribution_levels_for_users(connection, &[id_level], &sorted)
                            .await?;
                    Ok(MaintenanceOutcome::Applied(changed))
                },
            )
            .await;
        contention_outcome(result)
    }

    pub async fn prune_points_history_batch(&self, level_history: bool) -> Result<i64> {
        let statement = if level_history {
            include_str!("../queries/scoring/prune_level_points_history.sql")
        } else {
            include_str!("../queries/scoring/prune_user_points_history.sql")
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
        Ok(sql_query(include_str!(
            "../queries/track_tournament/tournament_lobby_sources.sql"
        ))
        .bind::<Integer, _>(id_tournament)
        .load(&mut connection)
        .await?)
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
        sql_query(include_str!(
            "../queries/track_tournament/publish_tournament_lobby_asset.sql"
        ))
        .bind::<Integer, _>(id_tournament)
        .bind::<BigInt, _>(workshop_id)
        .bind::<Text, _>(file_uid)
        .bind::<Text, _>(level_name)
        .bind::<Text, _>(author)
        .bind::<Text, _>(object_key)
        .bind::<Text, _>(sha256)
        .bind::<Integer, _>(byte_size)
        .execute(&mut connection)
        .await?;
        Ok(())
    }

    pub async fn rotate_track_tournament(
        &self,
        tournament_type: i32,
    ) -> Result<TournamentRotation> {
        ensure!(matches!(tournament_type, 0..=2), "invalid tournament type");
        let mut connection = self.connection().await?;
        rotate_track_tournament_at(&mut connection, tournament_type, None).await
    }
}

#[derive(QueryableByName)]
struct TournamentClockRow {
    #[diesel(sql_type = Text)]
    observed_at: String,
}

async fn rotate_track_tournament_at(
    connection: &mut diesel_async::AsyncPgConnection,
    tournament_type: i32,
    observed_at: Option<&str>,
) -> Result<TournamentRotation> {
    ensure!(matches!(tournament_type, 0..=2), "invalid tournament type");
    connection
        .transaction::<TournamentRotation, anyhow::Error, _>(async move |connection| {
            sql_query(include_str!(
                "../queries/track_tournament/rotate_track_tournament_at_pg_advisory_xact_lock.sql"
            ))
            .bind::<Integer, _>(tournament_type)
            .execute(connection)
            .await?;
            // Capture after acquiring the lock; every query uses this same instant.
            let clock: TournamentClockRow = sql_query(include_str!(
                "../queries/track_tournament/rotate_track_tournament_at_coalesce.sql"
            ))
            .bind::<Nullable<Text>, _>(observed_at)
            .get_result(connection)
            .await?;
            let at = &clock.observed_at;
            let existing = sql_query(include_str!(
                "../queries/track_tournament/select_id_track_tournament.sql"
            ))
            .bind::<Integer, _>(tournament_type)
            .bind::<Text, _>(at)
            .get_result::<IdRow>(connection)
            .await
            .optional()?;
            let (id_tournament, created) = if let Some(row) = existing {
                (Some(row.id), false)
            } else {
                let row = sql_query(TRACK_TOURNAMENT_SELECTION_SQL)
                    .bind::<Integer, _>(tournament_type)
                    .bind::<Text, _>(at)
                    .get_result::<IdRow>(connection)
                    .await
                    .optional()?;
                (row.as_ref().map(|row| row.id), row.is_some())
            };
            #[derive(QueryableByName)]
            struct LockedTournament {
                #[diesel(sql_type=Integer)]
                id: i32,
                #[diesel(sql_type=Integer)]
                id_level: i32,
            }
            let affected = sql_query(include_str!(
                "../queries/track_tournament/select_id_track_tournament_by_type.sql"
            ))
            .bind::<Integer, _>(tournament_type)
            .bind::<Text, _>(at)
            .bind::<Bool, _>(created)
            .bind::<Nullable<Integer>, _>(id_tournament)
            .load::<LockedTournament>(connection)
            .await?;
            let levels: std::collections::BTreeSet<_> =
                affected.iter().map(|row| row.id_level).collect();
            // Submissions and eligibility repair hold shared counterparts. Acquire
            // every level in order before result/row locks, including across types.
            for level in levels {
                sql_query(include_str!(
                    "../queries/track_tournament/lock_tournament_level.sql"
                ))
                .bind::<Integer, _>(level)
                .execute(connection)
                .await?;
            }
            for tournament in affected {
                sql_query(include_str!(
                    "../queries/track_tournament/select_id_track_tournament_by_id.sql"
                ))
                .bind::<Integer, _>(tournament.id)
                .execute(connection)
                .await?;
                sql_query(include_str!(
                    "../queries/track_tournament/lock_tournament_results.sql"
                ))
                .bind::<Integer, _>(tournament.id)
                .execute(connection)
                .await?;
                if created && Some(tournament.id) == id_tournament {
                    // Acceptance before recovery still belongs to original period.
                    sql_query(include_str!(
                        "../queries/track_tournament/insert_track_tournament_result.sql"
                    ))
                    .bind::<Integer, _>(tournament.id)
                    .execute(connection)
                    .await?;
                    super::record::rerank_tournament(connection, tournament.id).await?;
                }
            }
            sql_query(include_str!(
                "../queries/track_tournament/set_finalized_at_track_tournament.sql"
            ))
            .bind::<Integer, _>(tournament_type)
            .bind::<Text, _>(at)
            .execute(connection)
            .await?;
            Ok(TournamentRotation {
                created,
                id_tournament,
            })
        })
        .await
}

#[cfg(test)]
#[path = "track_tournament_tests.rs"]
mod track_tournament_tests;

pub(crate) async fn upsert_zero_level_points(
    connection: &mut diesel_async::AsyncPgConnection,
    id_level: i32,
) -> Result<bool> {
    Ok(sql_query(include_str!(
        "../queries/scoring/upsert_zero_level_points.sql"
    ))
    .bind::<Integer, _>(id_level)
    .execute(connection)
    .await?
        > 0)
}

async fn upsert_level_points(
    connection: &mut diesel_async::AsyncPgConnection,
    id_level: i32,
    value: zc_core::score::LevelScoreResult,
) -> Result<bool> {
    let real = |value: f64| value as f32;
    let optional = |value: Option<f64>| value.map(|value| value as f32);
    Ok(
        sql_query(include_str!("../queries/scoring/upsert_level_points.sql"))
            .bind::<Integer, _>(id_level)
            .bind::<Integer, _>(value.points)
            .bind::<Float, _>(real(value.rating))
            .bind::<Float, _>(real(value.length_modifier))
            .bind::<Float, _>(real(value.evidence_modifier))
            .bind::<Float, _>(real(value.quality_modifier))
            .bind::<Float, _>(real(value.rating_modifier))
            .bind::<Nullable<Float>, _>(optional(value.complexity_confidence))
            .bind::<Nullable<Float>, _>(optional(value.complexity_score))
            .bind::<Nullable<Float>, _>(optional(value.field_strength))
            .bind::<Nullable<Float>, _>(optional(value.quality_score))
            .bind::<Nullable<Float>, _>(optional(value.skill_alignment))
            .bind::<Nullable<Float>, _>(optional(value.skill_confidence))
            .bind::<Nullable<Integer>, _>(value.skill_sample_size)
            .bind::<Nullable<Float>, _>(optional(value.skill_score))
            .bind::<Nullable<Float>, _>(optional(value.skill_separation))
            .execute(connection)
            .await?
            > 0,
    )
}

pub(crate) async fn level_contribution_drift(
    connection: &mut diesel_async::AsyncPgConnection,
    id_level: i32,
) -> Result<bool> {
    let row: BooleanRow = sql_query(include_str!(
        "../queries/scoring/level_contribution_drift.sql"
    ))
    .bind::<Integer, _>(id_level)
    .get_result(connection)
    .await?;
    Ok(row.value)
}

async fn sync_contribution_levels_for_users(
    connection: &mut diesel_async::AsyncPgConnection,
    ids: &[i32],
    affected: &[i32],
) -> Result<Vec<i32>> {
    if affected.is_empty() {
        return Ok(Vec::new());
    }
    let mut changed = sql_query(include_str!(
        "../queries/scoring/sync_level_contributions_for_users.sql"
    ))
    .bind::<Array<Integer>, _>(ids)
    .bind::<Array<Integer>, _>(affected)
    .load::<IdRow>(connection)
    .await?
    .into_iter()
    .map(|row| row.id)
    .collect::<Vec<_>>();
    changed.extend(
        sql_query(include_str!(
            "../queries/scoring/delete_stale_level_contributions.sql"
        ))
        .bind::<Array<Integer>, _>(ids)
        .bind::<Array<Integer>, _>(affected)
        .load::<IdRow>(connection)
        .await?
        .into_iter()
        .map(|row| row.id),
    );
    changed.sort_unstable();
    changed.dedup();
    Ok(changed)
}

async fn set_maintenance_lock_timeout(
    connection: &mut diesel_async::AsyncPgConnection,
) -> Result<()> {
    sql_query(include_str!(
        "../queries/scoring/set_maintenance_lock_timeout.sql"
    ))
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
    let result: BooleanRow = sql_query(include_str!("../queries/scoring/try_user_score_locks.sql"))
        .bind::<Integer, _>(USER_SCORE_LOCK_NAMESPACE)
        .bind::<Array<Integer>, _>(&sorted)
        .get_result(connection)
        .await?;
    Ok(result.value)
}

pub(crate) fn contention_outcome<T>(
    result: Result<MaintenanceOutcome<T>>,
) -> Result<MaintenanceOutcome<T>> {
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

fn group_user_contributions(ids: &[i32], rows: Vec<UserContributionRow>) -> Vec<UserScoreSource> {
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
    by_user
        .into_iter()
        .map(|(id_user, contributions)| UserScoreSource {
            id_user,
            contributions,
        })
        .collect()
}
