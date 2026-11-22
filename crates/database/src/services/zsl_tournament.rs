//! Durable tournament ownership, results, and atomic publication.
use crate::Database;
use anyhow::{Context, Result, ensure};
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{BigInt, Bool, Integer, Jsonb, Text},
};
use diesel_async::{AsyncConnection, RunQueryDsl};
use serde::{Deserialize, Serialize};

const SELECT_ID_ROUND_ZSL_TOURNAMENT_STATE: &str =
    include_str!("../queries/zsl_tournament/select_id_round_zsl_tournament_state.sql");

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
        let row = sql_query(include_str!("../queries/zsl_tournament/zsl_event.sql"))
            .bind::<Integer, _>(round_id)
            .get_result::<JsonRow>(&mut connection)
            .await?;
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
        Ok(sql_query(include_str!(
            "../queries/zsl_tournament/claim_zsl_event.sql"
        ))
        .bind::<Integer, _>(round_id)
        .bind::<Text, _>(owner)
        .get_result::<JsonRow>(&mut connection)
        .await
        .optional()?
        .map(|row| row.value))
    }
    pub async fn save_zsl_event(
        &self,
        round_id: i32,
        owner: &str,
        state: &serde_json::Value,
    ) -> Result<()> {
        let mut connection = self.connection().await?;
        let count = sql_query(include_str!("../queries/zsl_tournament/save_zsl_event.sql"))
            .bind::<Integer, _>(round_id)
            .bind::<Text, _>(owner)
            .bind::<Jsonb, _>(state)
            .execute(&mut connection)
            .await?;
        ensure!(count == 1, "ZSL event ownership lost");
        Ok(())
    }
    pub async fn release_zsl_event(&self, round_id: i32, owner: &str) -> Result<()> {
        let mut connection = self.connection().await?;
        sql_query(include_str!(
            "../queries/zsl_tournament/release_zsl_event.sql"
        ))
        .bind::<Integer, _>(round_id)
        .bind::<Text, _>(owner)
        .execute(&mut connection)
        .await?;
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
        let count = sql_query(include_str!("../queries/zsl_tournament/open_zsl_level.sql"))
            .bind::<Integer, _>(round_id)
            .bind::<Text, _>(owner)
            .bind::<Integer, _>(timeslot)
            .bind::<Integer, _>(index)
            .bind::<diesel::sql_types::Nullable<Integer>, _>(level_id)
            .bind::<BigInt, _>(deadline)
            .execute(&mut connection)
            .await?;
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
        connection
            .transaction::<bool, anyhow::Error, _>(async move |connection| {
                sql_query(SELECT_ID_ROUND_ZSL_TOURNAMENT_STATE)
                    .bind::<Integer, _>(round_id)
                    .bind::<Text, _>(owner)
                    .get_result::<IdRow>(connection)
                    .await?;
                let count = sql_query(include_str!(
                    "../queries/zsl_tournament/insert_zsl_provisional_level_result.sql"
                ))
                .bind::<Integer, _>(round_id)
                .bind::<Text, _>(owner)
                .bind::<Integer, _>(timeslot)
                .bind::<Integer, _>(level_id)
                .bind::<Integer, _>(user_id)
                .bind::<BigInt, _>(microseconds)
                .bind::<BigInt, _>(received_at_ms)
                .execute(connection)
                .await?;
                Ok(count == 1)
            })
            .await
    }
    pub async fn close_zsl_level(
        &self,
        round_id: i32,
        owner: &str,
        timeslot: i32,
        index: i32,
    ) -> Result<()> {
        let mut connection = self.connection().await?;
        connection
            .transaction::<(), anyhow::Error, _>(async move |connection| {
                sql_query(SELECT_ID_ROUND_ZSL_TOURNAMENT_STATE)
                    .bind::<Integer, _>(round_id)
                    .bind::<Text, _>(owner)
                    .get_result::<IdRow>(connection)
                    .await?;
                sql_query(include_str!(
                    "../queries/zsl_tournament/set_finalised_zsl_provisional_level_result.sql"
                ))
                .bind::<Integer, _>(round_id)
                .bind::<Integer, _>(timeslot)
                .bind::<Integer, _>(index)
                .execute(connection)
                .await?;
                sql_query(include_str!(
                    "../queries/zsl_tournament/set_closed_zsl_tournament_level_state.sql"
                ))
                .bind::<Integer, _>(round_id)
                .bind::<Integer, _>(timeslot)
                .bind::<Integer, _>(index)
                .execute(connection)
                .await?;
                Ok(())
            })
            .await
    }
    pub async fn zsl_finishes(&self, round_id: i32) -> Result<Vec<ZslFinish>> {
        let mut connection = self.connection().await?;
        Ok(
            sql_query(include_str!("../queries/zsl_tournament/zsl_finishes.sql"))
                .bind::<Integer, _>(round_id)
                .load(&mut connection)
                .await?,
        )
    }
    pub async fn publish_zsl_results(
        &self,
        round_id: i32,
        owner: &str,
        scoring_levels: i32,
    ) -> Result<()> {
        let mut connection = self.connection().await?;
        connection
            .transaction::<(), anyhow::Error, _>(async move |connection| {
                sql_query(SELECT_ID_ROUND_ZSL_TOURNAMENT_STATE)
                    .bind::<Integer, _>(round_id)
                    .bind::<Text, _>(owner)
                    .get_result::<IdRow>(connection)
                    .await?;
                sql_query(include_str!(
                    "../queries/zsl_tournament/select_id_zsl_round.sql"
                ))
                .bind::<Integer, _>(round_id)
                .bind::<Integer, _>(scoring_levels)
                .get_result::<IdRow>(connection)
                .await
                .context("ZSL round not ready for publication")?;
                sql_query(include_str!(
                    "../queries/zsl_tournament/select_id_zsl_season.sql"
                ))
                .bind::<Integer, _>(round_id)
                .get_result::<IdRow>(connection)
                .await?;
                sql_query(include_str!(
                    "../queries/zsl_tournament/select_zsl_provisional_level_result.sql"
                ))
                .bind::<Integer, _>(round_id)
                .execute(connection)
                .await?;
                sql_query(include_str!(
                    "../queries/zsl_tournament/select_zsl_level.sql"
                ))
                .bind::<Integer, _>(round_id)
                .execute(connection)
                .await?;
                sql_query(include_str!(
                    "../queries/zsl_tournament/select_zsl_round_result.sql"
                ))
                .bind::<Integer, _>(round_id)
                .execute(connection)
                .await?;
                sql_query(include_str!(
                    "../queries/zsl_tournament/set_published_at_zsl_tournament_state.sql"
                ))
                .bind::<Integer, _>(round_id)
                .execute(connection)
                .await?;
                Ok(())
            })
            .await
    }
}
