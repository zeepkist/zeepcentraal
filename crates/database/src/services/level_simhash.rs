use crate::Database;
use anyhow::{Result, ensure};
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{BigInt, Integer, Jsonb, Text},
};
use diesel_async::{AsyncConnection, RunQueryDsl};
use serde_json::Value;
use zc_core::levels::{LevelFormat, calculate_level_simhash};

#[derive(QueryableByName)]
struct IdRow {
    #[diesel(sql_type = Integer)]
    id: i32,
}

#[derive(QueryableByName)]
pub struct LevelSimhashSnapshot {
    #[diesel(sql_type = Integer)]
    pub id: i32,
    #[diesel(sql_type = Integer)]
    pub id_level: i32,
    #[diesel(sql_type = Integer)]
    pub format: i32,
    #[diesel(sql_type = Jsonb)]
    pub blocks: Value,
    #[diesel(sql_type = Text)]
    pub version: String,
}

#[derive(Debug, Eq, PartialEq)]
pub enum LevelSimhashOutcome {
    Updated,
    MissingMetadata,
    Empty,
    InvalidMetadata,
    SnapshotChanged,
}

impl Database {
    pub async fn missing_level_simhash_ids(&self, after_id: i32, limit: i64) -> Result<Vec<i32>> {
        ensure!(
            after_id >= 0 && (1..=100).contains(&limit),
            "Invalid SimHash page"
        );
        let mut connection = self.connection().await?;
        Ok(sql_query(include_str!(
            "../queries/level_simhash/missing_level_simhash_ids.sql"
        ))
        .bind::<Integer, _>(after_id)
        .bind::<BigInt, _>(limit)
        .load::<IdRow>(&mut connection)
        .await?
        .into_iter()
        .map(|row| row.id)
        .collect())
    }

    pub async fn level_simhash_snapshot(
        &self,
        id_level: i32,
    ) -> Result<Option<LevelSimhashSnapshot>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(include_str!(
            "../queries/level_simhash/level_simhash_snapshot.sql"
        ))
        .bind::<Integer, _>(id_level)
        .get_result(&mut connection)
        .await
        .optional()?)
    }

    pub async fn set_missing_level_simhash(
        &self,
        snapshot: &LevelSimhashSnapshot,
        simhash: i64,
    ) -> Result<bool> {
        let mut connection = self.connection().await?;
        connection
            .transaction::<bool, anyhow::Error, _>(async move |connection| {
                // Match workshop lock order. Never hold a DB connection while hashing blocks.
                let level = sql_query(include_str!("../queries/level_simhash/select_id_level.sql"))
                    .bind::<Integer, _>(snapshot.id_level)
                    .get_result::<IdRow>(connection)
                    .await
                    .optional()?;
                if level.is_none() {
                    return Ok(false);
                }
                let metadata = sql_query(include_str!(
                    "../queries/level_simhash/select_id_level_metadata.sql"
                ))
                .bind::<Integer, _>(snapshot.id)
                .bind::<Integer, _>(snapshot.id_level)
                .bind::<Text, _>(&snapshot.version)
                .get_result::<IdRow>(connection)
                .await
                .optional()?;
                if metadata.is_none() {
                    return Ok(false);
                }
                Ok(sql_query(include_str!(
                    "../queries/level_simhash/set_missing_level_simhash_simhash_level.sql"
                ))
                .bind::<Integer, _>(snapshot.id_level)
                .bind::<BigInt, _>(simhash)
                .execute(connection)
                .await?
                    == 1)
            })
            .await
    }

    pub async fn backfill_level_simhash(&self, id_level: i32) -> Result<LevelSimhashOutcome> {
        let Some(snapshot) = self.level_simhash_snapshot(id_level).await? else {
            return Ok(LevelSimhashOutcome::MissingMetadata);
        };
        let (snapshot, result) = tokio::task::spawn_blocking(move || {
            let result = match snapshot.format {
                0 => calculate_level_simhash(&snapshot.blocks, LevelFormat::Csv),
                1 => calculate_level_simhash(&snapshot.blocks, LevelFormat::Json),
                _ => Err(anyhow::anyhow!("Unsupported level format")),
            };
            (snapshot, result)
        })
        .await?;
        match result {
            Ok(Some(simhash)) => Ok(
                if self.set_missing_level_simhash(&snapshot, simhash).await? {
                    LevelSimhashOutcome::Updated
                } else {
                    LevelSimhashOutcome::SnapshotChanged
                },
            ),
            Ok(None) => Ok(LevelSimhashOutcome::Empty),
            Err(error) => {
                tracing::warn!(id_level, error = %error, "Invalid blocks for SimHash");
                Ok(LevelSimhashOutcome::InvalidMetadata)
            }
        }
    }
}
