use crate::Database;
use anyhow::Result;
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{BigInt, Bool, Integer, Nullable, Text, Varchar},
};
use diesel_async::{AsyncConnection, RunQueryDsl};
use serde::Serialize;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DiscordLinkStatus {
    Linked,
    Expired,
    Invalid,
    Consumed,
    Conflict,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DiscordLinkResult {
    pub status: DiscordLinkStatus,
    pub id_user: Option<i32>,
    pub steam_id: Option<i64>,
}

impl DiscordLinkResult {
    fn status(status: DiscordLinkStatus) -> Self {
        Self {
            status,
            id_user: None,
            steam_id: None,
        }
    }
}

#[derive(QueryableByName)]
struct LinkCode {
    #[diesel(sql_type = Integer)]
    id_user: i32,
    #[diesel(sql_type = Bool)]
    expired: bool,
    #[diesel(sql_type = Bool)]
    consumed: bool,
}

#[derive(QueryableByName)]
struct UserId {
    #[diesel(sql_type = Integer)]
    id: i32,
}

#[derive(QueryableByName)]
struct LinkedUser {
    #[diesel(sql_type = Integer)]
    id_user: i32,
    #[diesel(sql_type = Nullable<BigInt>)]
    steam_id: Option<i64>,
}

#[derive(QueryableByName)]
pub struct UnlinkedDiscordUser {
    #[diesel(sql_type = Integer)]
    pub id_user: i32,
    #[diesel(sql_type = Nullable<BigInt>)]
    pub discord_id: Option<i64>,
}

#[derive(Clone, Debug, QueryableByName, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscordLinkedUser {
    #[diesel(sql_type = Integer)]
    pub id: i32,
    #[diesel(sql_type = Nullable<Varchar>)]
    pub steam_name: Option<String>,
    #[diesel(sql_type = Bool)]
    pub banned: bool,
    #[diesel(sql_type = Nullable<BigInt>)]
    #[serde(serialize_with = "serialize_optional_bigint")]
    pub steam_id: Option<i64>,
    #[diesel(sql_type = Nullable<BigInt>)]
    #[serde(serialize_with = "serialize_optional_bigint")]
    pub discord_id: Option<i64>,
    #[diesel(sql_type = Text)]
    pub date_created: String,
    #[diesel(sql_type = Nullable<Text>)]
    pub date_updated: Option<String>,
}

#[derive(Clone, Debug, QueryableByName, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscordUserPreference {
    #[diesel(sql_type = BigInt)]
    #[serde(serialize_with = "serialize_bigint")]
    pub discord_id: i64,
    #[diesel(sql_type = Bool)]
    pub ping_on_world_record_loss: bool,
    #[diesel(sql_type = Text)]
    pub date_updated: String,
}

#[derive(Clone, Debug, QueryableByName, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscordWatch {
    #[diesel(sql_type = BigInt)]
    #[serde(serialize_with = "serialize_bigint")]
    pub id: i64,
    #[diesel(sql_type = BigInt)]
    #[serde(serialize_with = "serialize_bigint")]
    pub discord_id: i64,
    #[diesel(sql_type = Text)]
    pub kind: String,
    #[diesel(sql_type = Text)]
    pub target_id: String,
    #[diesel(sql_type = Bool)]
    pub paused: bool,
    #[diesel(sql_type = Nullable<Text>)]
    pub last_error: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    pub last_delivery_key: Option<String>,
    #[diesel(sql_type = Text)]
    pub date_created: String,
    #[diesel(sql_type = Text)]
    pub date_updated: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscordUserState {
    pub linked_user: Option<DiscordLinkedUser>,
    pub preference: Option<DiscordUserPreference>,
    pub watches: Vec<DiscordWatch>,
}

impl Database {
    pub async fn consume_discord_link_code(
        &self,
        code_hash: &str,
        discord_id: i64,
    ) -> Result<DiscordLinkResult> {
        let mut connection = self.connection().await?;
        connection
            .transaction::<DiscordLinkResult, anyhow::Error, _>(|connection| {
                Box::pin(async move {
                    let code: Option<LinkCode> = sql_query(
                        "SELECT id_user,expires_at<=clock_timestamp() AS expired, \
                         consumed_at IS NOT NULL AS consumed \
                         FROM zc_private.discord_link_code WHERE code_hash=$1 FOR UPDATE",
                    )
                    .bind::<Text, _>(code_hash)
                    .get_result(connection)
                    .await
                    .optional()?;
                    let Some(code) = code else {
                        return Ok(DiscordLinkResult::status(DiscordLinkStatus::Invalid));
                    };
                    if code.consumed {
                        return Ok(DiscordLinkResult::status(DiscordLinkStatus::Consumed));
                    }
                    if code.expired {
                        return Ok(DiscordLinkResult::status(DiscordLinkStatus::Expired));
                    }
                    let existing: Option<UserId> = sql_query(
                        "SELECT id FROM public.\"user\" WHERE discord_id=$1 AND discord_id>0 LIMIT 1",
                    )
                    .bind::<BigInt, _>(discord_id)
                    .get_result(connection)
                    .await
                    .optional()?;
                    if existing.is_some_and(|user| user.id != code.id_user) {
                        return Ok(DiscordLinkResult::status(DiscordLinkStatus::Conflict));
                    }
                    let linked: Option<LinkedUser> = sql_query(
                        "UPDATE public.\"user\" SET discord_id=$2,date_updated=clock_timestamp() \
                         WHERE id=$1 AND (discord_id IS NULL OR discord_id=-1 OR discord_id=$2) \
                         RETURNING id AS id_user,steam_id",
                    )
                    .bind::<Integer, _>(code.id_user)
                    .bind::<BigInt, _>(discord_id)
                    .get_result(connection)
                    .await
                    .optional()?;
                    let Some(linked) = linked else {
                        return Ok(DiscordLinkResult::status(DiscordLinkStatus::Conflict));
                    };
                    sql_query(
                        "UPDATE zc_private.discord_link_code SET consumed_at=clock_timestamp() \
                         WHERE code_hash=$1",
                    )
                    .bind::<Text, _>(code_hash)
                    .execute(connection)
                    .await?;
                    Ok(DiscordLinkResult {
                        status: DiscordLinkStatus::Linked,
                        id_user: Some(linked.id_user),
                        steam_id: linked.steam_id,
                    })
                })
            })
            .await
    }

    pub async fn unlink_discord_by_discord_id(
        &self,
        discord_id: i64,
    ) -> Result<Option<UnlinkedDiscordUser>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "UPDATE public.\"user\" SET discord_id=-1,date_updated=clock_timestamp() \
             WHERE discord_id=$1 RETURNING id AS id_user,discord_id",
        )
        .bind::<BigInt, _>(discord_id)
        .get_result(&mut connection)
        .await
        .optional()?)
    }

    pub async fn discord_user_state(&self, discord_id: i64) -> Result<DiscordUserState> {
        let mut connection = self.connection().await?;
        let linked_user = sql_query(
            "SELECT id,steam_name,banned,steam_id,discord_id, \
             to_char(date_created AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS date_created, \
             CASE WHEN date_updated IS NULL THEN NULL ELSE \
               to_char(date_updated AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') END AS date_updated \
             FROM public.\"user\" WHERE discord_id=$1 LIMIT 1",
        )
        .bind::<BigInt, _>(discord_id)
        .get_result(&mut connection)
        .await
        .optional()?;
        let preference = sql_query(
            "SELECT discord_id,ping_on_world_record_loss, \
             to_char(date_updated AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS date_updated \
             FROM zc_private.discord_user_preference WHERE discord_id=$1",
        )
        .bind::<BigInt, _>(discord_id)
        .get_result(&mut connection)
        .await
        .optional()?;
        let watches = sql_query(
            "SELECT id,discord_id,kind,target_id,paused,last_error,last_delivery_key, \
             to_char(date_created AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS date_created, \
             to_char(date_updated AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS date_updated \
             FROM zc_private.discord_watch WHERE discord_id=$1 ORDER BY date_created DESC",
        )
        .bind::<BigInt, _>(discord_id)
        .load(&mut connection)
        .await?;
        Ok(DiscordUserState {
            linked_user,
            preference,
            watches,
        })
    }

    pub async fn set_discord_user_preference(
        &self,
        discord_id: i64,
        ping_on_world_record_loss: bool,
    ) -> Result<DiscordUserPreference> {
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "INSERT INTO zc_private.discord_user_preference \
             (discord_id,ping_on_world_record_loss,date_updated) VALUES($1,$2,clock_timestamp()) \
             ON CONFLICT(discord_id) DO UPDATE SET ping_on_world_record_loss=excluded.ping_on_world_record_loss, \
             date_updated=clock_timestamp() RETURNING discord_id,ping_on_world_record_loss, \
             to_char(date_updated AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS date_updated",
        )
        .bind::<BigInt, _>(discord_id)
        .bind::<Bool, _>(ping_on_world_record_loss)
        .get_result(&mut connection)
        .await?)
    }

    pub async fn add_discord_watch(
        &self,
        discord_id: i64,
        kind: &str,
        target_id: &str,
    ) -> Result<DiscordWatch> {
        let target_id = target_id.trim().to_lowercase();
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "INSERT INTO zc_private.discord_watch(discord_id,kind,target_id) VALUES($1,$2,$3) \
             ON CONFLICT(discord_id,kind,target_id) DO UPDATE SET paused=false,last_error=NULL, \
             date_updated=clock_timestamp() RETURNING id,discord_id,kind,target_id,paused,last_error, \
             last_delivery_key,to_char(date_created AT TIME ZONE 'UTC', \
             'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS date_created,to_char(date_updated AT TIME ZONE 'UTC', \
             'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS date_updated",
        )
        .bind::<BigInt, _>(discord_id)
        .bind::<Text, _>(kind)
        .bind::<Text, _>(&target_id)
        .get_result(&mut connection)
        .await?)
    }

    pub async fn remove_discord_watch(
        &self,
        discord_id: i64,
        id: i64,
    ) -> Result<Option<DiscordWatch>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "DELETE FROM zc_private.discord_watch WHERE discord_id=$1 AND id=$2 \
             RETURNING id,discord_id,kind,target_id,paused,last_error,last_delivery_key, \
             to_char(date_created AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS date_created, \
             to_char(date_updated AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS date_updated",
        )
        .bind::<BigInt, _>(discord_id)
        .bind::<BigInt, _>(id)
        .get_result(&mut connection)
        .await
        .optional()?)
    }
}

fn serialize_bigint<S>(value: &i64, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    serializer.serialize_str(&value.to_string())
}

fn serialize_optional_bigint<S>(value: &Option<i64>, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    match value {
        Some(value) => serializer.serialize_some(&value.to_string()),
        None => serializer.serialize_none(),
    }
}
