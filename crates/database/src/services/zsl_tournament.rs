//! Durable tournament ownership, results, and atomic publication.
use crate::Database;
use anyhow::{Context, Result, ensure};
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{BigInt, Bool, Integer, Jsonb, Text},
};
use diesel_async::{AsyncConnection, RunQueryDsl};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZslEvent {
    pub name: String,
    pub round: i32,
    pub season: i32,
    pub first: i64,
    pub second: i64,
    pub points: Vec<i32>,
    pub minimum_points: i32,
    pub best_of: i32,
}
#[derive(QueryableByName)]
struct JsonRow {
    #[diesel(sql_type = Jsonb)]
    value: serde_json::Value,
}
#[derive(QueryableByName)]
struct IdRow {
    #[diesel(sql_type = Integer, column_name = id)]
    _id: i32,
}
#[derive(Clone, Debug, QueryableByName)]
pub struct ZslFinish {
    #[diesel(sql_type = Integer)]
    pub id_level: i32,
    #[diesel(sql_type = BigInt)]
    pub steam_id: i64,
    #[diesel(sql_type = Text)]
    pub name: String,
    #[diesel(sql_type = BigInt)]
    pub microseconds: i64,
    #[diesel(sql_type = Bool)]
    pub finalised: bool,
    #[diesel(sql_type = Integer)]
    pub timeslot: i32,
}

impl Database {
    pub async fn zsl_event(&self, round_id: i32) -> Result<ZslEvent> {
        let mut connection = self.connection().await?;
        let row = sql_query("SELECT jsonb_build_object('name',r.name,'round',r.round,'season',r.id_season,'first',extract(epoch FROM r.event_date)::bigint,'second',extract(epoch FROM r.event2_date)::bigint,'points',p.points,'minimumPoints',p.minimum_points,'bestOf',p.best_of) AS value FROM public.zsl_round r JOIN public.zsl_season s ON s.id=r.id_season JOIN public.zsl_points_structure p ON p.id=s.id_points_structure WHERE r.id=$1")
            .bind::<Integer,_>(round_id).get_result::<JsonRow>(&mut connection).await?;
        let event: ZslEvent =
            serde_json::from_value(row.value).context("Invalid ZSL event schedule")?;
        ensure!(
            event.second > event.first && event.best_of > 0 && !event.points.is_empty(),
            "Invalid ZSL event schedule or points structure"
        );
        Ok(event)
    }
    pub async fn claim_zsl_event(
        &self,
        round_id: i32,
        owner: &str,
    ) -> Result<Option<serde_json::Value>> {
        let mut connection = self.connection().await?;
        Ok(sql_query("INSERT INTO zc_private.zsl_tournament_state(id_round,owner,lease_until) VALUES($1,$2,clock_timestamp()+interval '90 seconds') ON CONFLICT(id_round) DO UPDATE SET owner=excluded.owner,lease_until=excluded.lease_until WHERE zsl_tournament_state.owner=excluded.owner OR zsl_tournament_state.lease_until<clock_timestamp() RETURNING state AS value")
            .bind::<Integer,_>(round_id).bind::<Text,_>(owner).get_result::<JsonRow>(&mut connection).await.optional()?.map(|row| row.value))
    }
    pub async fn save_zsl_event(
        &self,
        round_id: i32,
        owner: &str,
        state: &serde_json::Value,
    ) -> Result<()> {
        let mut connection = self.connection().await?;
        let count = sql_query("UPDATE zc_private.zsl_tournament_state SET state=$3,lease_until=clock_timestamp()+interval '90 seconds',date_updated=clock_timestamp() WHERE id_round=$1 AND owner=$2 AND lease_until>clock_timestamp()")
            .bind::<Integer,_>(round_id).bind::<Text,_>(owner).bind::<Jsonb,_>(state).execute(&mut connection).await?;
        ensure!(count == 1, "ZSL event ownership lost");
        Ok(())
    }
    pub async fn release_zsl_event(&self, round_id: i32, owner: &str) -> Result<()> {
        let mut connection = self.connection().await?;
        sql_query("UPDATE zc_private.zsl_tournament_state SET lease_until=clock_timestamp() WHERE id_round=$1 AND owner=$2")
            .bind::<Integer,_>(round_id).bind::<Text,_>(owner).execute(&mut connection).await?;
        Ok(())
    }
    pub async fn open_zsl_level(
        &self,
        round_id: i32,
        owner: &str,
        timeslot: i32,
        index: i32,
        level_id: Option<i32>,
        deadline: i64,
    ) -> Result<()> {
        let mut connection = self.connection().await?;
        let count = sql_query("INSERT INTO zc_private.zsl_tournament_level_state(id_round,timeslot,playlist_index,id_level,deadline) SELECT $1,$3,$4,$5,to_timestamp($6::double precision) FROM zc_private.zsl_tournament_state WHERE id_round=$1 AND owner=$2 AND lease_until>clock_timestamp() ON CONFLICT(id_round,timeslot,playlist_index) DO UPDATE SET deadline=zsl_tournament_level_state.deadline WHERE zsl_tournament_level_state.id_level IS NOT DISTINCT FROM excluded.id_level")
            .bind::<Integer,_>(round_id).bind::<Text,_>(owner).bind::<Integer,_>(timeslot).bind::<Integer,_>(index).bind::<diesel::sql_types::Nullable<Integer>,_>(level_id).bind::<BigInt,_>(deadline).execute(&mut connection).await?;
        ensure!(count == 1, "ZSL level closed or event ownership lost");
        Ok(())
    }
    #[allow(clippy::too_many_arguments)]
    pub async fn submit_zsl_finish(
        &self,
        round_id: i32,
        owner: &str,
        timeslot: i32,
        level_id: i32,
        user_id: i32,
        microseconds: i64,
        received_at_ms: i64,
    ) -> Result<bool> {
        ensure!(microseconds > 0, "Invalid ZSL finish time");
        let mut connection = self.connection().await?;
        connection.transaction::<bool, anyhow::Error, _>(async move |connection| {
            sql_query("SELECT id_round AS id FROM zc_private.zsl_tournament_state WHERE id_round=$1 AND owner=$2 AND lease_until>clock_timestamp() FOR UPDATE")
                .bind::<Integer,_>(round_id).bind::<Text,_>(owner).get_result::<IdRow>(connection).await?;
            let count = sql_query("INSERT INTO zc_private.zsl_provisional_level_result(id_level,id_user,time,timeslot) SELECT $4,$5,$6::numeric/1000000,$3 FROM zc_private.zsl_tournament_level_state WHERE id_round=$1 AND $2::text IS NOT NULL AND timeslot=$3 AND id_level=$4 AND NOT closed AND to_timestamp($7::double precision/1000)<deadline ON CONFLICT(id_level,id_user) DO UPDATE SET time=excluded.time,date_updated=clock_timestamp() WHERE NOT zsl_provisional_level_result.finalised AND zsl_provisional_level_result.timeslot=excluded.timeslot AND excluded.time<zsl_provisional_level_result.time")
                .bind::<Integer,_>(round_id).bind::<Text,_>(owner).bind::<Integer,_>(timeslot).bind::<Integer,_>(level_id).bind::<Integer,_>(user_id).bind::<BigInt,_>(microseconds).bind::<BigInt,_>(received_at_ms).execute(connection).await?;
            Ok(count == 1)
        }).await
    }
    pub async fn close_zsl_level(
        &self,
        round_id: i32,
        owner: &str,
        timeslot: i32,
        index: i32,
    ) -> Result<()> {
        let mut connection = self.connection().await?;
        connection.transaction::<(), anyhow::Error, _>(async move |connection| {
            sql_query("SELECT id_round AS id FROM zc_private.zsl_tournament_state WHERE id_round=$1 AND owner=$2 AND lease_until>clock_timestamp() FOR UPDATE")
                .bind::<Integer,_>(round_id).bind::<Text,_>(owner).get_result::<IdRow>(connection).await?;
            sql_query("UPDATE zc_private.zsl_provisional_level_result SET finalised=true,date_updated=clock_timestamp() WHERE id_level IN(SELECT id_level FROM zc_private.zsl_tournament_level_state WHERE id_round=$1 AND timeslot=$2 AND playlist_index=$3)")
                .bind::<Integer,_>(round_id).bind::<Integer,_>(timeslot).bind::<Integer,_>(index).execute(connection).await?;
            sql_query("UPDATE zc_private.zsl_tournament_level_state SET closed=true WHERE id_round=$1 AND timeslot=$2 AND playlist_index=$3")
                .bind::<Integer,_>(round_id).bind::<Integer,_>(timeslot).bind::<Integer,_>(index).execute(connection).await?;
            Ok(())
        }).await
    }
    pub async fn zsl_finishes(&self, round_id: i32) -> Result<Vec<ZslFinish>> {
        let mut connection = self.connection().await?;
        Ok(sql_query("SELECT p.id_level,u.steam_id::bigint,coalesce(u.steam_name,'Unknown player')::text AS name,(p.time*1000000)::bigint AS microseconds,p.finalised,p.timeslot FROM zc_private.zsl_provisional_level_result p JOIN public.zsl_level l ON l.id=p.id_level JOIN public.\"user\" u ON u.id=p.id_user WHERE l.id_round=$1 ORDER BY p.id_level,p.time,p.id_user")
            .bind::<Integer,_>(round_id).load(&mut connection).await?)
    }
    pub async fn publish_zsl_results(
        &self,
        round_id: i32,
        owner: &str,
        scoring_levels: i32,
    ) -> Result<()> {
        let mut connection = self.connection().await?;
        connection.transaction::<(), anyhow::Error, _>(async move |connection| {
            sql_query("SELECT id_round AS id FROM zc_private.zsl_tournament_state WHERE id_round=$1 AND owner=$2 AND lease_until>clock_timestamp() FOR UPDATE")
                .bind::<Integer,_>(round_id).bind::<Text,_>(owner).get_result::<IdRow>(connection).await?;
            sql_query("SELECT r.id FROM public.zsl_round r WHERE r.id=$1 AND (SELECT count(*) FROM zc_private.zsl_tournament_level_state WHERE id_round=$1 AND timeslot=2 AND id_level IS NOT NULL AND closed)=$2 AND NOT EXISTS(SELECT 1 FROM zc_private.zsl_tournament_level_state WHERE id_round=$1 AND timeslot=2 AND NOT closed) AND NOT EXISTS(SELECT 1 FROM zc_private.zsl_provisional_level_result p JOIN public.zsl_level l ON l.id=p.id_level WHERE l.id_round=$1 AND NOT p.finalised) FOR UPDATE")
                .bind::<Integer,_>(round_id).bind::<Integer,_>(scoring_levels).get_result::<IdRow>(connection).await.context("ZSL round not ready for publication")?;
            sql_query("SELECT s.id FROM public.zsl_season s JOIN public.zsl_round r ON r.id_season=s.id WHERE r.id=$1 FOR UPDATE OF s")
                .bind::<Integer,_>(round_id).get_result::<IdRow>(connection).await?;
            sql_query("WITH ranked AS (SELECT p.*,rank() OVER(PARTITION BY p.id_level ORDER BY p.time)::integer AS position FROM zc_private.zsl_provisional_level_result p JOIN public.zsl_level l ON l.id=p.id_level WHERE l.id_round=$1 AND p.finalised) INSERT INTO public.zsl_level_result(id_level,id_user,time,position,points,date_created) SELECT r.id_level,r.id_user,r.time::real,r.position,coalesce(ps.points[r.position],ps.minimum_points),clock_timestamp() FROM ranked r JOIN public.zsl_round event ON event.id=$1 JOIN public.zsl_season s ON s.id=event.id_season JOIN public.zsl_points_structure ps ON ps.id=s.id_points_structure ON CONFLICT(id_level,id_user) DO UPDATE SET time=excluded.time,position=excluded.position,points=excluded.points,date_updated=clock_timestamp()")
                .bind::<Integer,_>(round_id).execute(connection).await?;
            sql_query("WITH totals AS (SELECT r.id_user,ceil(sum(r.points)::numeric/(SELECT count(*) FROM public.zsl_level WHERE id_round=$1))::integer AS points FROM public.zsl_level_result r JOIN public.zsl_level l ON l.id=r.id_level WHERE l.id_round=$1 GROUP BY r.id_user), ranked AS(SELECT *,rank() OVER(ORDER BY points DESC)::integer AS position FROM totals) INSERT INTO public.zsl_round_result(id_round,id_user,points,position,date_created) SELECT $1,id_user,points,position,clock_timestamp() FROM ranked ON CONFLICT(id_round,id_user) DO UPDATE SET points=excluded.points,position=excluded.position,date_updated=clock_timestamp()")
                .bind::<Integer,_>(round_id).execute(connection).await?;
            sql_query("WITH ordered AS(SELECT rr.id_user,rr.points,r.id_season,ps.best_of,row_number() OVER(PARTITION BY rr.id_user ORDER BY rr.points DESC,rr.id_round) AS score_index FROM public.zsl_round_result rr JOIN public.zsl_round r ON r.id=rr.id_round JOIN public.zsl_season s ON s.id=r.id_season JOIN public.zsl_points_structure ps ON ps.id=s.id_points_structure WHERE r.id_season=(SELECT id_season FROM public.zsl_round WHERE id=$1)), totals AS(SELECT id_user,id_season,sum(points)::integer AS points FROM ordered WHERE score_index<=best_of GROUP BY id_user,id_season), ranked AS(SELECT *,rank() OVER(ORDER BY points DESC)::integer AS position FROM totals) INSERT INTO public.zsl_season_result(id_season,id_user,points,position,date_created) SELECT id_season,id_user,points,position,clock_timestamp() FROM ranked ON CONFLICT(id_season,id_user) DO UPDATE SET points=excluded.points,position=excluded.position,date_updated=clock_timestamp()")
                .bind::<Integer,_>(round_id).execute(connection).await?;
            sql_query("UPDATE zc_private.zsl_tournament_state SET published_at=coalesce(published_at,clock_timestamp()) WHERE id_round=$1")
                .bind::<Integer,_>(round_id).execute(connection).await?;
            Ok(())
        }).await
    }
}
