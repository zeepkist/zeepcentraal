use crate::Database;
use anyhow::{Result, ensure};
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{Array, BigInt, Bool, Float, Integer, Jsonb, SmallInt, Text},
};
use diesel_async::{AsyncConnection, RunQueryDsl};
use serde_json::Value;
use std::collections::HashMap;

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
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct WorkshopLevelUpsertResult {
    pub id_level: i32,
    pub score_changed: bool,
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
        let row = sql_query(
            "SELECT li.author_id FROM public.level_item li \
             JOIN public.level l ON l.id=li.id_level \
             JOIN public.workshop_item wi ON wi.workshop_id=li.workshop_id \
             WHERE l.xx_hash=$1 AND li.author_id<>$2 AND wi.author_id<>$2 \
             ORDER BY li.deleted,li.id LIMIT 1",
        )
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
            .transaction::<WorkshopLevelUpsertResult, anyhow::Error, _>(|connection| {
                Box::pin(async move {
                    let previous_workshop = sql_query(
                        "SELECT visibility FROM public.workshop_item WHERE workshop_id=$1 LIMIT 1",
                    )
                    .bind::<BigInt, _>(input.workshop_id)
                    .get_result::<VisibilityRow>(connection)
                    .await
                    .optional()?;

                    for steam_id in [input.author_id, input.level_author_id] {
                        sql_query(
                            "INSERT INTO public.\"user\" \
                             (steam_id,steam_name,discord_id,banned,date_created,date_updated) \
                             VALUES($1,'Unknown',-1,false,clock_timestamp(),clock_timestamp()) \
                             ON CONFLICT (steam_id) DO NOTHING",
                        )
                        .bind::<BigInt, _>(steam_id)
                        .execute(connection)
                        .await?;
                    }

                    sql_query(
                        "INSERT INTO public.workshop_item \
                         (workshop_id,author_id,name,image_url,visibility,file_size,created_at,updated_at,date_created,date_updated) \
                         VALUES($1,$2,$3,$4,$5,$6,$7::timestamptz,$8::timestamptz,clock_timestamp(),clock_timestamp()) \
                         ON CONFLICT (workshop_id) DO UPDATE SET \
                         author_id=excluded.author_id,name=excluded.name,image_url=excluded.image_url, \
                         visibility=excluded.visibility,file_size=excluded.file_size,created_at=excluded.created_at, \
                         updated_at=excluded.updated_at,date_updated=clock_timestamp()",
                    )
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

                    let existing_item = sql_query(
                        "SELECT li.id,li.id_level,li.deleted,l.xx_hash \
                         FROM public.level_item li JOIN public.level l ON l.id=li.id_level \
                         WHERE li.workshop_id=$1 AND (l.xx_hash=$2 OR li.file_uid=$3) \
                         ORDER BY CASE WHEN l.xx_hash=$2 THEN 0 ELSE 1 END,li.id LIMIT 1 FOR UPDATE OF li",
                    )
                    .bind::<BigInt, _>(input.workshop_id)
                    .bind::<Text, _>(&input.xx_hash)
                    .bind::<Text, _>(&input.file_uid)
                    .get_result::<ExistingItem>(connection)
                    .await
                    .optional()?;

                    let existing_level = sql_query(
                        "SELECT id FROM public.level WHERE xx_hash=$1 LIMIT 1 FOR UPDATE",
                    )
                    .bind::<Text, _>(&input.xx_hash)
                    .get_result::<IdRow>(connection)
                    .await
                    .optional()?;

                    let mut created = false;
                    let id_level = if let Some(level) = existing_level {
                        level.id
                    } else if let Some(item) = existing_item
                        .as_ref()
                        .filter(|item| item.xx_hash == input.xx_hash)
                    {
                        item.id_level
                    } else {
                        let inserted = sql_query(
                            "INSERT INTO public.level(hash,xx_hash,adventure) VALUES($1,$2,false) \
                             ON CONFLICT (xx_hash) DO NOTHING RETURNING id",
                        )
                        .bind::<Text, _>(&input.hash)
                        .bind::<Text, _>(&input.xx_hash)
                        .get_result::<IdRow>(connection)
                        .await
                        .optional()?;
                        created = inserted.is_some();
                        match inserted {
                            Some(row) => row.id,
                            None => sql_query(
                                "SELECT id FROM public.level WHERE xx_hash=$1 LIMIT 1 FOR UPDATE",
                            )
                            .bind::<Text, _>(&input.xx_hash)
                            .get_result::<IdRow>(connection)
                            .await?
                            .id,
                        }
                    };

                    sql_query(
                        "UPDATE public.level SET hash=$2,date_updated=clock_timestamp() \
                         WHERE id=$1 AND hash IS DISTINCT FROM $2",
                    )
                    .bind::<Integer, _>(id_level)
                    .bind::<Text, _>(&input.hash)
                    .execute(connection)
                    .await?;

                    let existing_metadata = sql_query(
                        "SELECT id FROM public.level_metadata WHERE id_level=$1 ORDER BY id LIMIT 1 FOR UPDATE",
                    )
                    .bind::<Integer, _>(id_level)
                    .get_result::<IdRow>(connection)
                    .await
                    .optional()?;
                    if let Some(metadata) = existing_metadata {
                        sql_query(
                            "UPDATE public.level_metadata SET amount_checkpoints=$2,amount_finishes=$3, \
                             amount_blocks=$4,type_ground=$5,type_skybox=$6,format=$7,blocks=$8, \
                             date_updated=clock_timestamp() WHERE id=$1 AND \
                             ROW(amount_checkpoints,amount_finishes,amount_blocks,type_ground,type_skybox,format,blocks) \
                             IS DISTINCT FROM ROW($2,$3,$4,$5,$6,$7,$8)",
                        )
                        .bind::<Integer, _>(metadata.id)
                        .bind::<Integer, _>(input.amount_checkpoints)
                        .bind::<Integer, _>(input.amount_finishes)
                        .bind::<Integer, _>(input.amount_blocks)
                        .bind::<Integer, _>(input.type_ground)
                        .bind::<Integer, _>(input.type_skybox)
                        .bind::<Integer, _>(input.format)
                        .bind::<Jsonb, _>(&input.blocks)
                        .execute(connection)
                        .await?;
                    } else {
                        sql_query(
                            "INSERT INTO public.level_metadata \
                             (id_level,amount_checkpoints,amount_finishes,amount_blocks,type_ground,type_skybox,format,blocks,date_created,date_updated) \
                             VALUES($1,$2,$3,$4,$5,$6,$7,$8,clock_timestamp(),clock_timestamp())",
                        )
                        .bind::<Integer, _>(id_level)
                        .bind::<Integer, _>(input.amount_checkpoints)
                        .bind::<Integer, _>(input.amount_finishes)
                        .bind::<Integer, _>(input.amount_blocks)
                        .bind::<Integer, _>(input.type_ground)
                        .bind::<Integer, _>(input.type_skybox)
                        .bind::<Integer, _>(input.format)
                        .bind::<Jsonb, _>(&input.blocks)
                        .execute(connection)
                        .await?;
                    }

                    let item_changed = existing_item.as_ref().is_none_or(|item| {
                        item.deleted || item.id_level != id_level
                    });
                    if let Some(item) = existing_item.as_ref() {
                        sql_query(
                            "UPDATE public.level_item SET id_level=$2,author_id=$3,name=$4,image_url=$5, \
                             file_author=$6,file_uid=$7,validation_time_author=$8,validation_time_gold=$9, \
                             validation_time_silver=$10,validation_time_bronze=$11,deleted=false, \
                             created_at=$12::timestamptz,updated_at=$13::timestamptz,date_updated=clock_timestamp() \
                             WHERE id=$1 AND ROW(id_level,author_id,name,image_url,file_author,file_uid, \
                               validation_time_author,validation_time_gold,validation_time_silver,validation_time_bronze, \
                               deleted,created_at,updated_at) IS DISTINCT FROM ROW($2,$3,$4,$5,$6,$7,$8,$9,$10,$11, \
                               false,$12::timestamptz,$13::timestamptz)",
                        )
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
                        sql_query(
                            "INSERT INTO public.level_item \
                             (id_level,workshop_id,author_id,name,image_url,file_author,file_uid, \
                              validation_time_author,validation_time_gold,validation_time_silver,validation_time_bronze, \
                              deleted,created_at,updated_at,date_created,date_updated) \
                             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false,$12::timestamptz,$13::timestamptz,clock_timestamp(),clock_timestamp())",
                        )
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
                    }

                    let accessibility_changed = previous_workshop.is_some_and(|previous| {
                        is_accessible(previous.visibility) != is_accessible(input.workshop_visibility)
                    });
                    Ok(WorkshopLevelUpsertResult {
                        id_level,
                        score_changed: created || item_changed || accessibility_changed,
                    })
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
            .transaction::<Vec<i32>, anyhow::Error, _>(|connection| {
                Box::pin(async move {
                    sql_query(
                        "SELECT workshop_id FROM public.workshop_item WHERE workshop_id=$1 FOR UPDATE",
                    )
                    .bind::<BigInt, _>(workshop_id)
                    .execute(connection)
                    .await?;
                    let changed = sql_query(
                        "UPDATE public.level_item li SET deleted=true,date_updated=clock_timestamp() \
                         FROM public.level l WHERE li.id_level=l.id AND li.workshop_id=$1 \
                         AND NOT li.deleted AND NOT l.adventure AND NOT (l.xx_hash=ANY($2)) \
                         RETURNING li.id_level",
                    )
                    .bind::<BigInt, _>(workshop_id)
                    .bind::<Array<Text>, _>(active_xx_hashes)
                    .load::<ChangedLevel>(connection)
                    .await?;
                    Ok(unique_ids(changed))
                })
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
            .transaction::<Vec<i32>, anyhow::Error, _>(|connection| {
                Box::pin(async move {
                    sql_query(
                        "UPDATE public.workshop_item SET visibility=$2,date_updated=clock_timestamp() \
                         WHERE workshop_id=$1",
                    )
                    .bind::<BigInt, _>(workshop_id)
                    .bind::<SmallInt, _>(visibility)
                    .execute(connection)
                    .await?;
                    let changed = sql_query(
                        "UPDATE public.level_item li SET deleted=true,date_updated=clock_timestamp() \
                         FROM public.level l WHERE li.id_level=l.id AND li.workshop_id=$1 \
                         AND NOT li.deleted AND NOT l.adventure RETURNING li.id_level",
                    )
                    .bind::<BigInt, _>(workshop_id)
                    .load::<ChangedLevel>(connection)
                    .await?;
                    Ok(unique_ids(changed))
                })
            })
            .await
    }

    pub async fn pending_level_request_workshop_ids(&self) -> Result<Vec<i64>> {
        #[derive(QueryableByName)]
        struct RequestRow {
            #[diesel(sql_type = BigInt)]
            workshop_id: i64,
        }
        let mut connection = self.connection().await?;
        Ok(
            sql_query("SELECT workshop_id FROM public.level_request ORDER BY id")
                .load::<RequestRow>(&mut connection)
                .await?
                .into_iter()
                .map(|row| row.workshop_id)
                .collect(),
        )
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
        let rows = sql_query(
            "SELECT workshop_id,count(*) FILTER(WHERE NOT deleted)::bigint AS active_item_count, \
             extract(epoch FROM max(updated_at))::bigint AS updated_epoch \
             FROM public.level_item GROUP BY workshop_id",
        )
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
