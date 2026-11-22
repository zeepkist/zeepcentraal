use crate::Database;
use anyhow::{Result, ensure};
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{Array, BigInt, Bool, Float, Integer, Nullable, Text},
};
use diesel_async::{AsyncConnection, RunQueryDsl};
use std::collections::HashMap;

#[derive(Clone, Debug, QueryableByName)]
pub struct ExistingUser {
    #[diesel(sql_type = Integer)]
    pub id: i32,
    #[diesel(sql_type = BigInt)]
    pub steam_id: i64,
    #[diesel(sql_type = Nullable<Text>)]
    pub steam_name: Option<String>,
}

#[derive(Clone, Debug, QueryableByName)]
pub struct ZslSeason {
    #[diesel(sql_type = Integer)]
    pub id: i32,
    #[diesel(sql_type = Integer)]
    pub id_points_structure: i32,
}

#[derive(Clone, Debug, QueryableByName)]
pub struct ZslRound {
    #[diesel(sql_type = Integer)]
    pub id: i32,
}

#[derive(Clone, Debug, QueryableByName)]
pub struct ZslLevel {
    #[diesel(sql_type = Integer)]
    pub id: i32,
}

#[derive(Clone, Debug)]
pub struct RankedResult {
    pub id_parent: i32,
    pub id_user: i32,
    pub points: i32,
    pub position: i32,
}

#[derive(Clone, Debug)]
pub struct RankedLevelResult {
    pub id_level: i32,
    pub id_user: i32,
    pub points: i32,
    pub position: i32,
    pub time: f32,
}

#[derive(QueryableByName)]
struct LevelUid {
    #[diesel(sql_type = Integer)]
    id: i32,
    #[diesel(sql_type = Text)]
    file_uid: String,
}

#[derive(QueryableByName)]
struct BooleanValue {
    #[diesel(sql_type = Bool)]
    value: bool,
}

impl Database {
    pub async fn existing_zsl_users(&self, steam_ids: &[i64]) -> Result<Vec<ExistingUser>> {
        if steam_ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut connection = self.connection().await?;
        Ok(
            sql_query(include_str!("../queries/zsl/existing_zsl_users.sql"))
                .bind::<Array<BigInt>, _>(steam_ids)
                .load(&mut connection)
                .await?,
        )
    }

    pub async fn upsert_zsl_users(&self, users: &[(i64, String)]) -> Result<HashMap<i64, i32>> {
        if users.is_empty() {
            return Ok(HashMap::new());
        }
        let steam_ids: Vec<i64> = users.iter().map(|(steam_id, _)| *steam_id).collect();
        let steam_names: Vec<String> = users.iter().map(|(_, name)| name.clone()).collect();
        let mut connection = self.connection().await?;
        let rows: Vec<ExistingUser> =
            sql_query(include_str!("../queries/zsl/upsert_zsl_users.sql"))
                .bind::<Array<BigInt>, _>(&steam_ids)
                .bind::<Array<Text>, _>(&steam_names)
                .load(&mut connection)
                .await?;
        Ok(rows.into_iter().map(|row| (row.steam_id, row.id)).collect())
    }

    pub async fn get_or_create_zsl_season(
        &self,
        name: &str,
        id_points_structure: i32,
        start_date: &str,
        end_date: &str,
    ) -> Result<ZslSeason> {
        ensure!(!name.is_empty(), "ZSL season name must not be empty");
        let mut connection = self.connection().await?;
        connection
            .transaction::<ZslSeason, anyhow::Error, _>(async move |connection| {
                if let Some(existing) =
                    sql_query(include_str!("../queries/zsl/select_id_zsl_season.sql"))
                        .bind::<Text, _>(name)
                        .get_result(connection)
                        .await
                        .optional()?
                {
                    return Ok(existing);
                }
                Ok(
                    sql_query(include_str!("../queries/zsl/insert_zsl_season.sql"))
                        .bind::<Integer, _>(id_points_structure)
                        .bind::<Text, _>(name)
                        .bind::<Text, _>(start_date)
                        .bind::<Text, _>(end_date)
                        .get_result(connection)
                        .await?,
                )
            })
            .await
    }

    pub async fn get_or_create_zsl_round(
        &self,
        id_season: i32,
        round: i32,
        name: &str,
        workshop_id: i64,
        event_date: &str,
    ) -> Result<ZslRound> {
        let mut connection = self.connection().await?;
        connection
            .transaction::<ZslRound, anyhow::Error, _>(async move |connection| {
                let existing: Option<ZslRound> =
                    sql_query(include_str!("../queries/zsl/select_id_zsl_round.sql"))
                        .bind::<Integer, _>(id_season)
                        .bind::<Integer, _>(round)
                        .get_result(connection)
                        .await
                        .optional()?;
                if let Some(existing) = existing {
                    let updated = sql_query(include_str!("../queries/zsl/set_name_zsl_round.sql"))
                        .bind::<Integer, _>(existing.id)
                        .bind::<Text, _>(name)
                        .bind::<BigInt, _>(workshop_id)
                        .bind::<Text, _>(event_date)
                        .get_result(connection)
                        .await
                        .optional()?;
                    return Ok(updated.unwrap_or(existing));
                }
                Ok(
                    sql_query(include_str!("../queries/zsl/insert_zsl_round.sql"))
                        .bind::<Integer, _>(id_season)
                        .bind::<Integer, _>(round)
                        .bind::<Text, _>(name)
                        .bind::<BigInt, _>(workshop_id)
                        .bind::<Text, _>(event_date)
                        .get_result(connection)
                        .await?,
                )
            })
            .await
    }

    pub async fn zsl_event_is_future(&self, event_date: &str) -> Result<bool> {
        let mut connection = self.connection().await?;
        let row: BooleanValue = sql_query(include_str!("../queries/zsl/zsl_event_is_future.sql"))
            .bind::<Text, _>(event_date)
            .get_result(&mut connection)
            .await?;
        Ok(row.value)
    }

    pub async fn levels_by_file_uids(&self, file_uids: &[String]) -> Result<HashMap<String, i32>> {
        if file_uids.is_empty() {
            return Ok(HashMap::new());
        }
        let mut connection = self.connection().await?;
        let rows: Vec<LevelUid> = sql_query(include_str!("../queries/zsl/levels_by_file_uids.sql"))
            .bind::<Array<Text>, _>(file_uids)
            .load(&mut connection)
            .await?;
        Ok(rows.into_iter().map(|row| (row.file_uid, row.id)).collect())
    }

    pub async fn get_or_create_zsl_level(&self, id_round: i32, id_level: i32) -> Result<ZslLevel> {
        let mut connection = self.connection().await?;
        connection
            .transaction::<ZslLevel, anyhow::Error, _>(async move |connection| {
                sql_query(include_str!(
                    "../queries/zsl/get_or_create_zsl_level_pg_advisory_xact_lock.sql"
                ))
                .bind::<Integer, _>(id_round)
                .execute(connection)
                .await?;
                if let Some(existing) =
                    sql_query(include_str!("../queries/zsl/select_id_zsl_level.sql"))
                        .bind::<Integer, _>(id_round)
                        .bind::<Integer, _>(id_level)
                        .get_result::<ZslLevel>(connection)
                        .await
                        .optional()?
                {
                    sql_query(include_str!(
                        "../queries/zsl/set_date_updated_zsl_level.sql"
                    ))
                    .bind::<Integer, _>(existing.id)
                    .execute(connection)
                    .await?;
                    return Ok(existing);
                }
                Ok(
                    sql_query(include_str!("../queries/zsl/insert_zsl_level.sql"))
                        .bind::<Integer, _>(id_round)
                        .bind::<Integer, _>(id_level)
                        .get_result(connection)
                        .await?,
                )
            })
            .await
    }

    pub async fn upsert_zsl_season_results(&self, rows: &[RankedResult]) -> Result<()> {
        self.upsert_zsl_ranked_results("season", rows).await
    }

    pub async fn upsert_zsl_round_results(&self, rows: &[RankedResult]) -> Result<()> {
        self.upsert_zsl_ranked_results("round", rows).await
    }

    async fn upsert_zsl_ranked_results(&self, kind: &str, rows: &[RankedResult]) -> Result<()> {
        if rows.is_empty() {
            return Ok(());
        }
        let parents: Vec<i32> = rows.iter().map(|row| row.id_parent).collect();
        let users: Vec<i32> = rows.iter().map(|row| row.id_user).collect();
        let points: Vec<i32> = rows.iter().map(|row| row.points).collect();
        let positions: Vec<i32> = rows.iter().map(|row| row.position).collect();
        let query = match kind {
            "season" => {
                include_str!("../queries/zsl/insert_zsl_season_result.sql")
            }
            "round" => {
                include_str!("../queries/zsl/insert_zsl_round_result.sql")
            }
            _ => anyhow::bail!("Unknown ZSL result kind"),
        };
        let mut connection = self.connection().await?;
        sql_query(query)
            .bind::<Array<Integer>, _>(&parents)
            .bind::<Array<Integer>, _>(&users)
            .bind::<Array<Integer>, _>(&points)
            .bind::<Array<Integer>, _>(&positions)
            .execute(&mut connection)
            .await?;
        Ok(())
    }

    pub async fn upsert_zsl_level_results(&self, rows: &[RankedLevelResult]) -> Result<()> {
        if rows.is_empty() {
            return Ok(());
        }
        let levels: Vec<i32> = rows.iter().map(|row| row.id_level).collect();
        let users: Vec<i32> = rows.iter().map(|row| row.id_user).collect();
        let points: Vec<i32> = rows.iter().map(|row| row.points).collect();
        let positions: Vec<i32> = rows.iter().map(|row| row.position).collect();
        let times: Vec<f32> = rows.iter().map(|row| row.time).collect();
        let mut connection = self.connection().await?;
        sql_query(include_str!("../queries/zsl/upsert_zsl_level_results.sql"))
            .bind::<Array<Integer>, _>(&levels)
            .bind::<Array<Integer>, _>(&users)
            .bind::<Array<Integer>, _>(&points)
            .bind::<Array<Integer>, _>(&positions)
            .bind::<Array<Float>, _>(&times)
            .execute(&mut connection)
            .await?;
        Ok(())
    }
}
