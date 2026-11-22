//! Eligibility corrections never create new-run notifications or delete evidence.
use super::jobs::{MaintenanceOutcome, contention_outcome};
use crate::Database;
use anyhow::Result;
use diesel::{
    QueryableByName, sql_query,
    sql_types::{Array, Bool, Integer, Jsonb},
};
use diesel_async::{AsyncConnection, RunQueryDsl};

pub const LEVEL_LOCK_NAMESPACE: i32 = 1_869_000_001;

/// Immutable repair snapshot. Only the cursor changes between durable pages.
#[derive(Clone, Debug, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EligibilityFanOut {
    pub operation_id: String,
    pub user_ids: Vec<i32>,
    pub after_user_id: i32,
}
impl EligibilityFanOut {
    pub fn valid(&self) -> bool {
        !self.operation_id.is_empty()
            && self.operation_id.len() <= 40
            && self.operation_id.bytes().all(|c| c.is_ascii_digit())
            && self.after_user_id >= 0
            && self.user_ids.iter().all(|id| *id > 0)
            && self.user_ids.windows(2).all(|pair| pair[0] < pair[1])
    }
    pub fn page(&self) -> &[i32] {
        let start = self
            .user_ids
            .partition_point(|id| *id <= self.after_user_id);
        &self.user_ids[start..(start + 100).min(self.user_ids.len())]
    }
    pub fn has_next(&self) -> bool {
        self.page()
            .last()
            .is_some_and(|last| self.user_ids.last() > Some(last))
    }
}

#[derive(QueryableByName)]
struct Id {
    #[diesel(sql_type=Integer)]
    id: i32,
}
#[derive(QueryableByName)]
struct Lock {
    #[diesel(sql_type=Bool)]
    value: bool,
}

struct RepairStats {
    affected_users: usize,
    changed_skill_users: usize,
    level_score_requests: usize,
}
#[derive(QueryableByName)]
struct Cache {
    #[diesel(sql_type=Integer)]
    id_user: i32,
    #[diesel(sql_type=Integer)]
    points: i32,
    #[diesel(sql_type=Integer)]
    total_points: i32,
    #[diesel(sql_type=Integer)]
    world_records: i32,
    #[diesel(sql_type=Integer)]
    expected_world_records: i32,
    #[diesel(sql_type=Integer)]
    personal_bests: i32,
    #[diesel(sql_type=Integer)]
    expected_personal_bests: i32,
}

impl Database {
    pub async fn record_eligibility_level_current(&self, level: i32) -> Result<bool> {
        let mut c = self.connection().await?;
        let bad = sql_query(include_str!(
            "../queries/record_eligibility/record_eligibility_level_current.sql"
        ))
        .bind::<Integer, _>(level)
        .get_result::<Lock>(&mut c)
        .await?
        .value;
        Ok(!bad && !super::jobs::level_contribution_drift(&mut c, level).await?)
    }
    pub async fn record_eligibility_scores_current(&self) -> Result<bool> {
        let mut after = 0;
        loop {
            let page = self.user_activity_page(after, 200).await?;
            if page.is_empty() {
                break;
            }
            let ids: Vec<_> = page.iter().map(|u| u.id_user).collect();
            let sources = self.user_score_sources(&ids).await?;
            let cached = sql_query(include_str!(
                "../queries/record_eligibility/select_id_user_user_record_counts.sql"
            ))
            .bind::<Array<Integer>, _>(&ids)
            .load::<Cache>(&mut self.connection().await?)
            .await?;
            for row in cached {
                let active = page.iter().any(|u| u.id_user == row.id_user && u.active);
                let score = zc_core::score::calculate_player_points(
                    sources
                        .iter()
                        .find(|s| s.id_user == row.id_user)
                        .map(|s| s.contributions.clone())
                        .unwrap_or_default(),
                );
                let (points, total) = (
                    if active {
                        i32::try_from(score.points)?
                    } else {
                        0
                    },
                    i32::try_from(score.total_points)?,
                );
                if row.points != points
                    || row.total_points != total
                    || row.world_records != row.expected_world_records
                    || row.personal_bests != row.expected_personal_bests
                {
                    return Ok(false);
                }
            }
            after = *ids.last().expect("nonempty user page");
        }
        let ranks = serde_json::to_value(self.player_rank_snapshot().await?)?;
        Ok(!sql_query(include_str!(
            "../queries/record_eligibility/record_eligibility_scores_current_exists.sql"
        ))
        .bind::<Jsonb, _>(ranks)
        .get_result::<Lock>(&mut self.connection().await?)
        .await?
        .value)
    }
    pub async fn failed_record_level_page(&self, after: i32, through: i32) -> Result<Vec<i32>> {
        Ok(sql_query(include_str!(
            "../queries/record_eligibility/failed_record_level_page.sql"
        ))
        .bind::<Integer, _>(after)
        .bind::<Integer, _>(through)
        .load::<Id>(&mut self.connection().await?)
        .await?
        .into_iter()
        .map(|r| r.id)
        .collect())
    }
    pub async fn eligibility_level_upper_bound(&self) -> Result<i32> {
        Ok(sql_query(include_str!(
            "../queries/record_eligibility/eligibility_level_upper_bound.sql"
        ))
        .get_result::<Id>(&mut self.connection().await?)
        .await?
        .id)
    }

    pub async fn reconcile_record_eligibility(&self, level: i32) -> Result<MaintenanceOutcome<()>> {
        let mut connection = self.connection().await?;
        let result=connection.transaction::<MaintenanceOutcome<RepairStats>, anyhow::Error,_>(async move |connection| {
            sql_query(include_str!("../queries/record_eligibility/reconcile_record_eligibility_set_config.sql")).execute(connection).await?;
            sql_query(include_str!("../queries/record_eligibility/set_reconcile_lock_timeout.sql")).execute(connection).await?;
            if !sql_query(include_str!("../queries/record_eligibility/reconcile_record_eligibility_pg_try_advisory_xact_lock.sql")).bind::<Integer,_>(LEVEL_LOCK_NAMESPACE).bind::<Integer,_>(level).get_result::<Lock>(connection).await?.value { return Ok(MaintenanceOutcome::Contended); }
            sql_query(include_str!("../queries/record_eligibility/select_id_level.sql"))
                .bind::<Integer,_>(level).execute(connection).await?;
            // Finalization takes the exclusive counterpart of this level lock.
            if !sql_query(include_str!("../queries/record_eligibility/reconcile_record_eligibility_pg_try_advisory_xact_lock_shared.sql")).bind::<Integer,_>(level).get_result::<Lock>(connection).await?.value { return Ok(MaintenanceOutcome::Contended); }
            let users = sql_query(include_str!("../queries/record_eligibility/select_id_user_personal_best_global.sql"))
                .bind::<Integer,_>(level).load::<Id>(connection).await?;
            let user_ids:Vec<_>=users.iter().map(|u|u.id).collect();
            if !sql_query(include_str!("../queries/record_eligibility/reconcile_record_eligibility_select_unnest.sql"))
                .bind::<Array<Integer>,_>(&user_ids).get_result::<Lock>(connection).await?.value { return Ok(MaintenanceOutcome::Contended); }
            // Keep one snapshot for selecting winners. New validation changes enqueue
            // a follow-up; public RLS hides failures even before that job runs.
            sql_query(include_str!("../queries/record_eligibility/reconcile_record_eligibility_create_eligible_record_winners.sql"))
                .bind::<Integer,_>(level).execute(connection).await?;
            sql_query(include_str!("../queries/record_eligibility/insert_personal_best_global.sql"))
                .bind::<Integer,_>(level).execute(connection).await?;
            sql_query(include_str!("../queries/record_eligibility/delete_personal_best_global.sql"))
                .bind::<Integer,_>(level).execute(connection).await?;
            sql_query(include_str!("../queries/record_eligibility/insert_world_record_global.sql"))
                .bind::<Integer,_>(level).execute(connection).await?;
            sql_query(include_str!("../queries/record_eligibility/delete_world_record_global.sql")).bind::<Integer,_>(level).execute(connection).await?;
            let tournaments = sql_query(include_str!("../queries/record_eligibility/select_id_track_tournament.sql"))
                .bind::<Integer,_>(level).load::<Id>(connection).await?;
            for tournament in tournaments {
                sql_query(include_str!("../queries/record_eligibility/reconcile_record_eligibility_pg_advisory_xact_lock.sql")).bind::<Integer,_>(tournament.id).execute(connection).await?;
                sql_query(include_str!("../queries/record_eligibility/reconcile_record_eligibility_create_eligible_tournament_winners.sql"))
                    .bind::<Integer,_>(tournament.id).execute(connection).await?;
                sql_query(include_str!("../queries/record_eligibility/insert_track_tournament_result.sql"))
                    .bind::<Integer,_>(tournament.id).execute(connection).await?;
                sql_query(include_str!("../queries/record_eligibility/delete_track_tournament_result.sql"))
                    .bind::<Integer,_>(tournament.id).execute(connection).await?;
                super::record::rerank_tournament(connection,tournament.id).await?;
                sql_query(include_str!("../queries/record_eligibility/reconcile_record_eligibility_drop_eligible_tournament_winners.sql")).execute(connection).await?;
            }
            sql_query(include_str!("../queries/record_eligibility/set_record_count_level.sql"))
                .bind::<Integer,_>(level).execute(connection).await?;
            // Recompute affected players from current eligible PBs. Delta updates
            // cannot safely infer whether a concurrent full refresh saw a failure.
            let changed_skills = sql_query(include_str!("../queries/record_eligibility/select_personal_best_global.sql"))
                .bind::<Array<Integer>,_>(&user_ids).load::<Id>(connection).await?;
            let changed_skill_users: Vec<_> = changed_skills.into_iter().map(|user| user.id).collect();
            // Use the queue in this same transaction: crashes cannot lose scoring.
            sql_query(include_str!("../queries/record_eligibility/enqueue_level_score.sql"))
                .bind::<Integer,_>(level).execute(connection).await?;
            sql_query(include_str!("../queries/record_eligibility/enqueue_level_contributions.sql"))
                .bind::<Integer,_>(level).execute(connection).await?;
            // Skill changes never invalidate other levels. Player repairs are paged
            // outside this transaction so the lane lock covers only three requests.
            sql_query(include_str!("../queries/record_eligibility/enqueue_eligibility_fanout.sql"))
                .bind::<Array<Integer>,_>(&user_ids).execute(connection).await?;
            Ok(MaintenanceOutcome::Applied(RepairStats {
                affected_users: user_ids.len(),
                changed_skill_users: changed_skill_users.len(),
                level_score_requests: 1,
            }))
        }).await;
        Ok(match contention_outcome(result)? {
            MaintenanceOutcome::Applied(stats) => {
                tracing::info!(
                    id_level = level,
                    affected_users = stats.affected_users,
                    changed_skill_users = stats.changed_skill_users,
                    level_score_requests = stats.level_score_requests,
                    "Record eligibility reconciliation completed"
                );
                MaintenanceOutcome::Applied(())
            }
            MaintenanceOutcome::Contended => MaintenanceOutcome::Contended,
            MaintenanceOutcome::SnapshotChanged => MaintenanceOutcome::SnapshotChanged,
        })
    }
}
