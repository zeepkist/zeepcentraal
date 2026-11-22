use super::workshop_queue::{enqueue_ghost_audit_levels, enqueue_level_scores};
use crate::Database;
use anyhow::{Result, ensure};
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{Array, BigInt, Bool, Float, Integer, Jsonb, Nullable, SmallInt, Text},
};
use diesel_async::{AsyncConnection, RunQueryDsl};
use serde_json::Value;
use std::collections::{BTreeSet, HashMap};

#[derive(Clone, Debug)]
pub struct WorkshopLevelInput {
    pub hash: String,
    pub xx_hash: String,
    pub workshop_id: i64,
    pub workshop_name: String,
    pub workshop_image_url: String,
    pub workshop_visibility: i16,
    pub workshop_file_size: i32,
    pub author_id: i64,
    pub level_author_id: i64,
    pub name: String,
    pub image_url: String,
    pub file_author: String,
    pub file_uid: String,
    pub validation_time_author: f32,
    pub validation_time_gold: f32,
    pub validation_time_silver: f32,
    pub validation_time_bronze: f32,
    pub created_at: String,
    pub updated_at: String,
    pub format: i32,
    pub amount_checkpoints: i32,
    pub amount_finishes: i32,
    pub amount_blocks: i32,
    pub type_ground: i32,
    pub type_skybox: i32,
    pub blocks: Value,
    pub environment: Option<Value>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkshopLevelUpsertResult {
    pub id_level: i32,
    pub changed_level_ids: Vec<i32>,
    pub validation_level_ids: Vec<i32>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct WorkshopSyncState {
    pub active_item_count: i64,
    pub updated_epoch: i64,
}

#[derive(QueryableByName)]
struct IdRow {
    #[diesel(sql_type = Integer)]
    id: i32,
}

#[derive(QueryableByName)]
struct ExistingLevel {
    #[diesel(sql_type = Integer)]
    id: i32,
    #[diesel(sql_type = Nullable<BigInt>)]
    simhash: Option<i64>,
}

#[derive(QueryableByName)]
struct AuthorRow {
    #[diesel(sql_type = BigInt)]
    author_id: i64,
}

#[derive(QueryableByName)]
struct VisibilityRow {
    #[diesel(sql_type = SmallInt)]
    visibility: i16,
}

#[derive(QueryableByName)]
struct ExistingItem {
    #[diesel(sql_type = Integer)]
    id: i32,
    #[diesel(sql_type = Integer)]
    id_level: i32,
    #[diesel(sql_type = Bool)]
    deleted: bool,
    #[diesel(sql_type = Text)]
    xx_hash: String,
}

#[derive(QueryableByName)]
struct ChangedLevel {
    #[diesel(sql_type = Integer)]
    id_level: i32,
}

impl Database {
    pub async fn find_workshop_level_author(
        &self,
        xx_hash: &str,
        excluded_uploader_id: i64,
    ) -> Result<Option<i64>> {
        let mut connection = self.connection().await?;
        let row = sql_query(include_str!(
            "../queries/workshop/find_workshop_level_author.sql"
        ))
        .bind::<Text, _>(xx_hash)
        .bind::<BigInt, _>(excluded_uploader_id)
        .get_result::<AuthorRow>(&mut connection)
        .await
        .optional()?;
        Ok(row.map(|row| row.author_id))
    }

    pub async fn upsert_workshop_level(
        &self,
        input: &WorkshopLevelInput,
    ) -> Result<WorkshopLevelUpsertResult> {
        validate_input(input)?;
        let mut connection = self.connection().await?;
        connection
            .transaction::<WorkshopLevelUpsertResult, anyhow::Error, _>(async move |connection| {
                let previous_workshop = sql_query(include_str!(
                    "../queries/workshop/select_visibility_workshop_item.sql"
                ))
                .bind::<BigInt, _>(input.workshop_id)
                .get_result::<VisibilityRow>(connection)
                .await
                .optional()?;

                for steam_id in [input.author_id, input.level_author_id] {
                    sql_query(include_str!(
                        "../queries/workshop/upsert_workshop_level_insert_user.sql"
                    ))
                    .bind::<BigInt, _>(steam_id)
                    .execute(connection)
                    .await?;
                }

                sql_query(include_str!("../queries/workshop/insert_workshop_item.sql"))
                    .bind::<BigInt, _>(input.workshop_id)
                    .bind::<BigInt, _>(input.author_id)
                    .bind::<Text, _>(&input.workshop_name)
                    .bind::<Text, _>(&input.workshop_image_url)
                    .bind::<SmallInt, _>(input.workshop_visibility)
                    .bind::<Integer, _>(input.workshop_file_size)
                    .bind::<Text, _>(&input.created_at)
                    .bind::<Text, _>(&input.updated_at)
                    .execute(connection)
                    .await?;

                let existing_item =
                    sql_query(include_str!("../queries/workshop/select_id_level_item.sql"))
                        .bind::<BigInt, _>(input.workshop_id)
                        .bind::<Text, _>(&input.xx_hash)
                        .get_result::<ExistingItem>(connection)
                        .await
                        .optional()?;

                let existing_level =
                    sql_query(include_str!("../queries/workshop/select_id_level.sql"))
                        .bind::<Text, _>(&input.xx_hash)
                        .get_result::<ExistingLevel>(connection)
                        .await
                        .optional()?;

                let needs_simhash = existing_level
                    .as_ref()
                    .is_none_or(|level| level.simhash.is_none());
                let mut created = false;
                let id_level = if let Some(level) = existing_level {
                    level.id
                } else if let Some(item) = existing_item
                    .as_ref()
                    .filter(|item| item.xx_hash == input.xx_hash)
                {
                    item.id_level
                } else {
                    let inserted = sql_query(include_str!(
                        "../queries/workshop/upsert_workshop_level_insert_level.sql"
                    ))
                    .bind::<Text, _>(&input.hash)
                    .bind::<Text, _>(&input.xx_hash)
                    .get_result::<IdRow>(connection)
                    .await
                    .optional()?;
                    created = inserted.is_some();
                    match inserted {
                        Some(row) => row.id,
                        None => {
                            sql_query(include_str!(
                                "../queries/workshop/select_id_level_by_xx_hash.sql"
                            ))
                            .bind::<Text, _>(&input.xx_hash)
                            .get_result::<IdRow>(connection)
                            .await?
                            .id
                        }
                    }
                };

                sql_query(include_str!("../queries/workshop/set_hash_level.sql"))
                    .bind::<Integer, _>(id_level)
                    .bind::<Text, _>(&input.hash)
                    .execute(connection)
                    .await?;

                let existing_metadata = sql_query(include_str!(
                    "../queries/workshop/select_id_level_metadata.sql"
                ))
                .bind::<Integer, _>(id_level)
                .get_result::<IdRow>(connection)
                .await
                .optional()?;
                let metadata_changed = if let Some(metadata) = existing_metadata {
                    sql_query(include_str!(
                        "../queries/workshop/set_amount_checkpoints_level_metadata.sql"
                    ))
                    .bind::<Integer, _>(metadata.id)
                    .bind::<Integer, _>(input.amount_checkpoints)
                    .bind::<Integer, _>(input.amount_finishes)
                    .bind::<Integer, _>(input.amount_blocks)
                    .bind::<Integer, _>(input.type_ground)
                    .bind::<Integer, _>(input.type_skybox)
                    .bind::<Integer, _>(input.format)
                    .bind::<Jsonb, _>(&input.blocks)
                    .bind::<Nullable<Jsonb>, _>(&input.environment)
                    .execute(connection)
                    .await?
                        > 0
                } else {
                    sql_query(include_str!(
                        "../queries/workshop/insert_level_metadata.sql"
                    ))
                    .bind::<Integer, _>(id_level)
                    .bind::<Integer, _>(input.amount_checkpoints)
                    .bind::<Integer, _>(input.amount_finishes)
                    .bind::<Integer, _>(input.amount_blocks)
                    .bind::<Integer, _>(input.type_ground)
                    .bind::<Integer, _>(input.type_skybox)
                    .bind::<Integer, _>(input.format)
                    .bind::<Jsonb, _>(&input.blocks)
                    .bind::<Nullable<Jsonb>, _>(&input.environment)
                    .execute(connection)
                    .await?;
                    true
                };

                if needs_simhash {
                    let simhash = match input.format {
                        0 => zc_core::levels::calculate_level_simhash(
                            &input.blocks,
                            zc_core::levels::LevelFormat::Csv,
                        ),
                        1 => zc_core::levels::calculate_level_simhash(
                            &input.blocks,
                            zc_core::levels::LevelFormat::Json,
                        ),
                        _ => Err(anyhow::anyhow!("Unsupported level format")),
                    };
                    match simhash {
                        Ok(Some(simhash)) => {
                            sql_query(include_str!("../queries/workshop/set_simhash_level.sql"))
                                .bind::<Integer, _>(id_level)
                                .bind::<BigInt, _>(simhash)
                                .execute(connection)
                                .await?;
                        }
                        Ok(None) => {}
                        Err(error) => {
                            tracing::warn!(id_level, error = %error, "Invalid blocks for SimHash")
                        }
                    }
                }

                // Reused UIDs retire old uploads; never detach historical levels.
                let retired = sql_query(include_str!(
                    "../queries/workshop/set_deleted_level_item.sql"
                ))
                .bind::<BigInt, _>(input.workshop_id)
                .bind::<Text, _>(&input.file_uid)
                .bind::<Integer, _>(id_level)
                .load::<ChangedLevel>(connection)
                .await?;
                let mut changed_level_ids = unique_ids(retired);
                let item_changed = existing_item
                    .as_ref()
                    .is_none_or(|item| item.deleted || item.id_level != id_level);
                if let Some(item) = existing_item.as_ref() {
                    sql_query(include_str!(
                        "../queries/workshop/set_id_level_level_item.sql"
                    ))
                    .bind::<Integer, _>(item.id)
                    .bind::<Integer, _>(id_level)
                    .bind::<BigInt, _>(input.level_author_id)
                    .bind::<Text, _>(&input.name)
                    .bind::<Text, _>(&input.image_url)
                    .bind::<Text, _>(&input.file_author)
                    .bind::<Text, _>(&input.file_uid)
                    .bind::<Float, _>(input.validation_time_author)
                    .bind::<Float, _>(input.validation_time_gold)
                    .bind::<Float, _>(input.validation_time_silver)
                    .bind::<Float, _>(input.validation_time_bronze)
                    .bind::<Text, _>(&input.created_at)
                    .bind::<Text, _>(&input.updated_at)
                    .execute(connection)
                    .await?;
                } else {
                    sql_query(include_str!("../queries/workshop/insert_level_item.sql"))
                        .bind::<Integer, _>(id_level)
                        .bind::<BigInt, _>(input.workshop_id)
                        .bind::<BigInt, _>(input.level_author_id)
                        .bind::<Text, _>(&input.name)
                        .bind::<Text, _>(&input.image_url)
                        .bind::<Text, _>(&input.file_author)
                        .bind::<Text, _>(&input.file_uid)
                        .bind::<Float, _>(input.validation_time_author)
                        .bind::<Float, _>(input.validation_time_gold)
                        .bind::<Float, _>(input.validation_time_silver)
                        .bind::<Float, _>(input.validation_time_bronze)
                        .bind::<Text, _>(&input.created_at)
                        .bind::<Text, _>(&input.updated_at)
                        .execute(connection)
                        .await?;
                };

                let accessibility_changed = previous_workshop.is_some_and(|previous| {
                    is_accessible(previous.visibility) != is_accessible(input.workshop_visibility)
                });
                let mut validation_level_ids = Vec::new();
                if metadata_changed {
                    validation_level_ids.push(id_level);
                }
                if created || item_changed || accessibility_changed {
                    changed_level_ids.push(id_level);
                }
                if accessibility_changed {
                    changed_level_ids.extend(
                        sql_query(include_str!("../queries/workshop/select_level_item.sql"))
                            .bind::<BigInt, _>(input.workshop_id)
                            .load::<ChangedLevel>(connection)
                            .await?
                            .into_iter()
                            .map(|row| row.id_level),
                    );
                }
                changed_level_ids.sort_unstable();
                changed_level_ids.dedup();
                enqueue_level_scores(connection, &changed_level_ids).await?;
                enqueue_ghost_audit_levels(connection, &validation_level_ids).await?;
                Ok(WorkshopLevelUpsertResult {
                    id_level,
                    changed_level_ids,
                    validation_level_ids,
                })
            })
            .await
    }

    pub async fn mark_missing_workshop_levels_deleted(
        &self,
        workshop_id: i64,
        active_xx_hashes: &[String],
    ) -> Result<Vec<i32>> {
        let mut connection = self.connection().await?;
        connection
            .transaction::<Vec<i32>, anyhow::Error, _>(async move |connection| {
                sql_query(include_str!(
                    "../queries/workshop/select_workshop_id_workshop_item.sql"
                ))
                .bind::<BigInt, _>(workshop_id)
                .execute(connection)
                .await?;
                let changed = sql_query(include_str!(
                    "../queries/workshop/set_deleted_level_item_by_id_level.sql"
                ))
                .bind::<BigInt, _>(workshop_id)
                .bind::<Array<Text>, _>(active_xx_hashes)
                .load::<ChangedLevel>(connection)
                .await?;
                let ids = unique_ids(changed);
                enqueue_level_scores(connection, &ids).await?;
                Ok(ids)
            })
            .await
    }

    pub async fn mark_workshop_deleted(
        &self,
        workshop_id: i64,
        visibility: i16,
    ) -> Result<Vec<i32>> {
        let mut connection = self.connection().await?;
        connection
            .transaction::<Vec<i32>, anyhow::Error, _>(async move |connection| {
                sql_query(include_str!(
                    "../queries/workshop/set_visibility_workshop_item.sql"
                ))
                .bind::<BigInt, _>(workshop_id)
                .bind::<SmallInt, _>(visibility)
                .execute(connection)
                .await?;
                let changed = sql_query(include_str!(
                    "../queries/workshop/soft_delete_workshop_level_items.sql"
                ))
                .bind::<BigInt, _>(workshop_id)
                .load::<ChangedLevel>(connection)
                .await?;
                let ids = unique_ids(changed);
                enqueue_level_scores(connection, &ids).await?;
                Ok(ids)
            })
            .await
    }

    /// Reconcile IDs absent from a complete catalog, including unfinished repairs from retries.
    pub async fn reconcile_missing_workshop_items(&self, workshop_ids: &[i64]) -> Result<Vec<i32>> {
        use super::jobs::{LEVEL_SCORE_LOCK_NAMESPACE, upsert_zero_level_points};

        ensure!(
            workshop_ids.len() <= 100,
            "Workshop reconciliation batch exceeds 100 items"
        );
        ensure!(
            workshop_ids.iter().all(|id| *id > 0),
            "Workshop IDs must be positive"
        );
        if workshop_ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut connection = self.connection().await?;
        let (ids, deleted, zeroed) = connection
            .transaction::<_, anyhow::Error, _>(async move |connection| {
                sql_query(
                    include_str!("../queries/workshop/select_workshop_id_workshop_item_by_workshop_id.sql"),
                )
                .bind::<Array<BigInt>, _>(workshop_ids)
                .execute(connection)
                .await?;
                let levels = sql_query(
                    include_str!("../queries/workshop/select_level_item_by_workshop_id.sql"),
                )
                .bind::<Array<BigInt>, _>(workshop_ids)
                .load::<ChangedLevel>(connection)
                .await?;
                let level_ids: Vec<_> = levels.into_iter().map(|row| row.id_level).collect();
                // Serialize against score jobs before changing their availability snapshot.
                for id_level in &level_ids {
                    sql_query(include_str!("../queries/workshop/reconcile_missing_workshop_items_pg_advisory_xact_lock.sql"))
                        .bind::<Integer, _>(LEVEL_SCORE_LOCK_NAMESPACE)
                        .bind::<Integer, _>(id_level)
                        .execute(connection)
                        .await?;
                }
                let changed = sql_query(
                    include_str!("../queries/workshop/set_deleted_level_item_by_id.sql"),
                )
                .bind::<Array<BigInt>, _>(workshop_ids)
                .load::<ChangedLevel>(connection)
                .await?;
                let deleted = changed.len();
                let mut refresh: BTreeSet<_> =
                    changed.into_iter().map(|row| row.id_level).collect();
                let unavailable = sql_query(
                    include_str!("../queries/workshop/select_id_level_by_id.sql"),
                )
                .bind::<Array<Integer>, _>(&level_ids)
                .load::<ChangedLevel>(connection)
                .await?;
                let unavailable_ids: Vec<_> =
                    unavailable.into_iter().map(|row| row.id_level).collect();
                let mut zeroed = 0;
                for id_level in &unavailable_ids {
                    if upsert_zero_level_points(connection, *id_level).await? {
                        zeroed += 1;
                        refresh.insert(*id_level);
                    }
                }
                // A crash after commit must not strand old player contributions on retry.
                refresh.extend(
                    sql_query(
                        include_str!("../queries/workshop/select_user_point_contribution.sql"),
                    )
                    .bind::<Array<Integer>, _>(&unavailable_ids)
                    .load::<ChangedLevel>(connection)
                    .await?
                    .into_iter()
                    .map(|row| row.id_level),
                );
                let ids: Vec<_> = refresh.into_iter().collect();
                enqueue_level_scores(connection, &ids).await?;
                Ok((ids, deleted, zeroed))
            })
            .await?;
        tracing::info!(
            missing = workshop_ids.len(),
            deleted,
            zeroed,
            "Workshop catalog deletion reconciliation committed"
        );
        Ok(ids)
    }

    pub async fn pending_level_request_workshop_ids(&self) -> Result<Vec<i64>> {
        #[derive(QueryableByName)]
        struct RequestRow {
            #[diesel(sql_type = BigInt)]
            workshop_id: i64,
        }
        let mut connection = self.connection().await?;
        Ok(sql_query(include_str!(
            "../queries/workshop/pending_level_request_workshop_ids.sql"
        ))
        .load::<RequestRow>(&mut connection)
        .await?
        .into_iter()
        .map(|row| row.workshop_id)
        .collect())
    }

    pub async fn workshop_sync_state(&self) -> Result<HashMap<i64, WorkshopSyncState>> {
        #[derive(QueryableByName)]
        struct StateRow {
            #[diesel(sql_type = BigInt)]
            workshop_id: i64,
            #[diesel(sql_type = BigInt)]
            active_item_count: i64,
            #[diesel(sql_type = BigInt)]
            updated_epoch: i64,
        }
        let mut connection = self.connection().await?;
        let rows = sql_query(include_str!("../queries/workshop/workshop_sync_state.sql"))
            .load::<StateRow>(&mut connection)
            .await?;
        Ok(rows
            .into_iter()
            .map(|row| {
                (
                    row.workshop_id,
                    WorkshopSyncState {
                        active_item_count: row.active_item_count,
                        updated_epoch: row.updated_epoch,
                    },
                )
            })
            .collect())
    }
}

fn validate_input(input: &WorkshopLevelInput) -> Result<()> {
    ensure!(input.workshop_id > 0, "Workshop ID must be positive");
    ensure!(input.author_id > 0, "Workshop author ID must be positive");
    ensure!(
        input.level_author_id > 0,
        "Level author ID must be positive"
    );
    ensure!(!input.xx_hash.is_empty(), "Level xxHash must not be empty");
    ensure!(
        !input.file_uid.is_empty(),
        "Level file UID must not be empty"
    );
    ensure!(
        input.workshop_file_size >= 0,
        "Workshop file size must not be negative"
    );
    for value in [
        input.validation_time_author,
        input.validation_time_gold,
        input.validation_time_silver,
        input.validation_time_bronze,
    ] {
        ensure!(value.is_finite(), "Level medal times must be finite");
    }
    Ok(())
}

fn is_accessible(visibility: i16) -> bool {
    matches!(visibility, 0 | 3)
}

fn unique_ids(rows: Vec<ChangedLevel>) -> Vec<i32> {
    let mut ids: Vec<_> = rows.into_iter().map(|row| row.id_level).collect();
    ids.sort_unstable();
    ids.dedup();
    ids
}
