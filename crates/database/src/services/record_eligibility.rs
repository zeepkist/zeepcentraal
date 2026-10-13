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
        let bad=sql_query("SELECT EXISTS(SELECT 1 FROM public.personal_best_global pb JOIN zc_private.record_validation v ON v.id_record=pb.id_record WHERE pb.id_level=$1 AND v.status='fail' UNION ALL SELECT 1 FROM public.world_record_global wr JOIN zc_private.record_validation v ON v.id_record=wr.id_record WHERE wr.id_level=$1 AND v.status='fail') AS value")
            .bind::<Integer,_>(level).get_result::<Lock>(&mut c).await?.value;
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
            let cached=sql_query("SELECT expected.id_user,coalesce(p.points,0) AS points,coalesce(p.total_points,0) AS total_points,coalesce(p.world_records,0)::integer AS world_records,expected.world_records AS expected_world_records,coalesce(p.personal_bests,0)::integer AS personal_bests,expected.personal_bests AS expected_personal_bests FROM zc_private.user_record_counts($1) expected LEFT JOIN public.user_points p ON p.id_user=expected.id_user")
                .bind::<Array<Integer>,_>(&ids).load::<Cache>(&mut self.connection().await?).await?;
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
        Ok(!sql_query("SELECT EXISTS(SELECT 1 FROM jsonb_to_recordset($1::jsonb) expected(id_user integer,rank integer) LEFT JOIN public.user_points p ON p.id_user=expected.id_user WHERE p.rank IS DISTINCT FROM expected.rank) AS value")
            .bind::<Jsonb,_>(ranks).get_result::<Lock>(&mut self.connection().await?).await?.value)
    }
    pub async fn failed_record_level_page(&self, after: i32, through: i32) -> Result<Vec<i32>> {
        Ok(sql_query("SELECT l.id FROM public.level l WHERE l.id>$1 AND l.id<=$2 AND EXISTS(SELECT 1 FROM public.record r JOIN zc_private.record_validation v ON v.id_record=r.id WHERE r.id_level=l.id AND v.status='fail') ORDER BY l.id LIMIT 100")
            .bind::<Integer,_>(after).bind::<Integer,_>(through).load::<Id>(&mut self.connection().await?).await?
            .into_iter().map(|r|r.id).collect())
    }
    pub async fn eligibility_level_upper_bound(&self) -> Result<i32> {
        Ok(
            sql_query("SELECT coalesce(max(id),0) AS id FROM public.level")
                .get_result::<Id>(&mut self.connection().await?)
                .await?
                .id,
        )
    }

    pub async fn reconcile_record_eligibility(&self, level: i32) -> Result<MaintenanceOutcome<()>> {
        let mut connection = self.connection().await?;
        let result=connection.transaction::<MaintenanceOutcome<()>, anyhow::Error,_>(async move |connection| {
            sql_query("SELECT set_config('zc.validation_correction','on',true)").execute(connection).await?;
            sql_query("SELECT set_config('lock_timeout','100ms',true)").execute(connection).await?;
            if !sql_query("SELECT pg_try_advisory_xact_lock($1,$2) AS value").bind::<Integer,_>(LEVEL_LOCK_NAMESPACE).bind::<Integer,_>(level).get_result::<Lock>(connection).await?.value { return Ok(MaintenanceOutcome::Contended); }
            sql_query("SELECT id FROM public.level WHERE id=$1 FOR NO KEY UPDATE")
                .bind::<Integer,_>(level).execute(connection).await?;
            // Finalization takes the exclusive counterpart of this level lock.
            if !sql_query("SELECT pg_try_advisory_xact_lock_shared(0,$1) AS value").bind::<Integer,_>(level).get_result::<Lock>(connection).await?.value { return Ok(MaintenanceOutcome::Contended); }
            let users = sql_query("SELECT id_user AS id FROM public.personal_best_global WHERE id_level=$1 UNION SELECT id_user FROM public.world_record_global WHERE id_level=$1 UNION SELECT id_user FROM public.user_point_contribution WHERE id_level=$1 UNION SELECT id_user FROM public.record WHERE id_level=$1 ORDER BY id")
                .bind::<Integer,_>(level).load::<Id>(connection).await?;
            let user_ids:Vec<_>=users.iter().map(|u|u.id).collect();
            if !sql_query("SELECT coalesce(bool_and(pg_try_advisory_xact_lock(-1861284952,id)),true) AS value FROM (SELECT id FROM unnest($1::integer[]) id ORDER BY id) targets")
                .bind::<Array<Integer>,_>(&user_ids).get_result::<Lock>(connection).await?.value { return Ok(MaintenanceOutcome::Contended); }
            // Keep one snapshot for selecting winners. New validation changes enqueue
            // a follow-up; public RLS hides failures even before that job runs.
            sql_query("CREATE TEMP TABLE eligible_record_winners ON COMMIT DROP AS SELECT DISTINCT ON(r.id_user) r.id_user,r.id,r.time,r.date_created FROM public.record r JOIN public.\"user\" u ON u.id=r.id_user WHERE r.id_level=$1 AND NOT u.banned AND zc_private.record_is_eligible(r.id) ORDER BY r.id_user,r.time,r.id")
                .bind::<Integer,_>(level).execute(connection).await?;
            sql_query("INSERT INTO public.personal_best_global(id_user,id_level,id_record,date_created,date_updated) SELECT id_user,$1,id,clock_timestamp(),clock_timestamp() FROM eligible_record_winners ON CONFLICT(id_user,id_level) DO UPDATE SET id_record=excluded.id_record,date_updated=clock_timestamp() WHERE personal_best_global.id_record IS DISTINCT FROM excluded.id_record")
                .bind::<Integer,_>(level).execute(connection).await?;
            sql_query("DELETE FROM public.personal_best_global pb WHERE pb.id_level=$1 AND NOT EXISTS(SELECT 1 FROM eligible_record_winners w WHERE w.id_user=pb.id_user)")
                .bind::<Integer,_>(level).execute(connection).await?;
            sql_query("INSERT INTO public.world_record_global(id_user,id_level,id_record,date_created,date_updated) SELECT id_user,$1,id,clock_timestamp(),clock_timestamp() FROM eligible_record_winners ORDER BY time,id LIMIT 1 ON CONFLICT(id_level) DO UPDATE SET id_user=excluded.id_user,id_record=excluded.id_record,date_updated=clock_timestamp() WHERE ROW(world_record_global.id_user,world_record_global.id_record) IS DISTINCT FROM ROW(excluded.id_user,excluded.id_record)")
                .bind::<Integer,_>(level).execute(connection).await?;
            sql_query("DELETE FROM public.world_record_global WHERE id_level=$1 AND NOT EXISTS(SELECT 1 FROM eligible_record_winners)").bind::<Integer,_>(level).execute(connection).await?;
            let tournaments = sql_query("SELECT id FROM public.track_tournament WHERE id_level=$1 AND finalized_at IS NULL ORDER BY id FOR UPDATE")
                .bind::<Integer,_>(level).load::<Id>(connection).await?;
            for tournament in tournaments {
                sql_query("SELECT pg_advisory_xact_lock(1953744432,$1)").bind::<Integer,_>(tournament.id).execute(connection).await?;
                sql_query("CREATE TEMP TABLE eligible_tournament_winners ON COMMIT DROP AS SELECT DISTINCT ON(r.id_user) r.id_user,r.id,r.time FROM public.record r JOIN public.\"user\" u ON u.id=r.id_user JOIN public.track_tournament t ON t.id=$1 WHERE r.id_level=t.id_level AND ((r.date_created>=t.start_at AND r.date_created<t.end_at) OR EXISTS(SELECT 1 FROM public.track_tournament_result accepted WHERE accepted.id_tournament=t.id AND accepted.id_record=r.id)) AND NOT u.banned AND zc_private.record_is_eligible(r.id) ORDER BY r.id_user,r.time,r.id")
                    .bind::<Integer,_>(tournament.id).execute(connection).await?;
                sql_query("INSERT INTO public.track_tournament_result(id_tournament,id_user,id_record,time,rank,points,date_created,date_updated) SELECT $1,id_user,id,time,1,1000,clock_timestamp(),clock_timestamp() FROM eligible_tournament_winners ON CONFLICT(id_tournament,id_user) DO UPDATE SET id_record=excluded.id_record,time=excluded.time,date_updated=clock_timestamp() WHERE ROW(track_tournament_result.id_record,track_tournament_result.time) IS DISTINCT FROM ROW(excluded.id_record,excluded.time)")
                    .bind::<Integer,_>(tournament.id).execute(connection).await?;
                sql_query("DELETE FROM public.track_tournament_result result WHERE id_tournament=$1 AND NOT EXISTS(SELECT 1 FROM eligible_tournament_winners w WHERE w.id_user=result.id_user)")
                    .bind::<Integer,_>(tournament.id).execute(connection).await?;
                super::record::rerank_tournament(connection,tournament.id).await?;
                sql_query("DROP TABLE eligible_tournament_winners").execute(connection).await?;
            }
            sql_query("UPDATE public.level SET record_count=(SELECT count(*) FROM public.record r WHERE r.id_level=$1 AND zc_private.record_is_eligible(r.id)) WHERE id=$1")
                .bind::<Integer,_>(level).execute(connection).await?;
            // Recompute affected players from current eligible PBs. Delta updates
            // cannot safely infer whether a concurrent full refresh saw a failure.
            sql_query("WITH levels AS MATERIALIZED(SELECT DISTINCT id_level FROM public.personal_best_global WHERE id_user=ANY($1)), ranked AS MATERIALIZED(SELECT pb.id_user,RANK() OVER(PARTITION BY pb.id_level ORDER BY r.time) AS place,COUNT(*) OVER(PARTITION BY pb.id_level) AS field FROM public.personal_best_global pb JOIN levels USING(id_level) JOIN public.record r ON r.id=pb.id_record JOIN public.\"user\" u ON u.id=pb.id_user WHERE NOT u.banned AND r.time>0 AND zc_private.record_is_eligible(r.id)), totals AS(SELECT id_user,sum(1-(place-1)::double precision/(field-1)) AS placement_sum,count(*)::integer AS eligible_level_count FROM ranked WHERE field>=20 AND id_user=ANY($1) GROUP BY id_user) INSERT INTO public.player_skill_aggregate(id_user,placement_sum,eligible_level_count,skill,date_updated) SELECT id,coalesce(t.placement_sum,0),coalesce(t.eligible_level_count,0),(5.0+coalesce(t.placement_sum,0))/(10+coalesce(t.eligible_level_count,0)),clock_timestamp() FROM unnest($1::integer[]) id LEFT JOIN totals t ON t.id_user=id ON CONFLICT(id_user) DO UPDATE SET placement_sum=excluded.placement_sum,eligible_level_count=excluded.eligible_level_count,skill=excluded.skill,date_updated=excluded.date_updated WHERE ROW(player_skill_aggregate.placement_sum,player_skill_aggregate.eligible_level_count,player_skill_aggregate.skill) IS DISTINCT FROM ROW(excluded.placement_sum,excluded.eligible_level_count,excluded.skill)")
                .bind::<Array<Integer>,_>(&user_ids).execute(connection).await?;
            // Use the queue in this same transaction: crashes cannot lose scoring.
            sql_query("SELECT zc_jobs.enqueue('bulk','updateLevelScore',jsonb_build_object('idLevel',$1::integer),'update-level-score:'||$1,'level-maintenance-shard:'||($1%4),3,clock_timestamp())")
                .bind::<Integer,_>(level).execute(connection).await?;
            sql_query("SELECT zc_jobs.enqueue('bulk','updateLevelContributions',jsonb_build_object('idLevel',$1::integer,'afterUserId',0),'update-level-contributions:'||$1,'level-maintenance-shard:'||($1%4),3,clock_timestamp())")
                .bind::<Integer,_>(level).execute(connection).await?;
            sql_query("SELECT zc_jobs.enqueue('bulk','updateLevelScore',jsonb_build_object('idLevel',id_level),'update-level-score:'||id_level,'level-maintenance-shard:'||(id_level%4),3,clock_timestamp()) FROM (SELECT DISTINCT id_level FROM public.personal_best_global WHERE id_user=ANY($1) AND id_level<>$2 ORDER BY id_level) levels")
                .bind::<Array<Integer>,_>(&user_ids).bind::<Integer,_>(level).execute(connection).await?;
            sql_query("SELECT zc_jobs.enqueue('bulk','updatePlayerScore',jsonb_build_object('idUser',id),'update-player-score:'||id,'global-scores',3,clock_timestamp()) FROM unnest($1::integer[]) id ORDER BY id")
                .bind::<Array<Integer>,_>(&user_ids).execute(connection).await?;
            sql_query("SELECT zc_jobs.enqueue('bulk','updatePlayerScores','{\"silent\":true}'::jsonb,'eligibility-refresh-player-scores','global-scores',3,clock_timestamp())").execute(connection).await?;
            Ok(MaintenanceOutcome::Applied(()))
        }).await;
        contention_outcome(result)
    }
}
