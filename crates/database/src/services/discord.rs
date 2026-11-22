use crate::Database;
use anyhow::Result;
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{BigInt, Bool, Integer, Nullable, Text, Varchar},
};
use diesel_async::{AsyncConnection, RunQueryDsl};
use serde::Serialize;

const SELECT_ID_USER: &str = include_str!("../queries/discord/select_id_user.sql");
const SET_DISCORD_ID_USER: &str = include_str!("../queries/discord/set_discord_id_user.sql");

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
    pub async fn create_discord_oauth_link_state(
        &self,
        state_hash: &str,
        id_user: i32,
    ) -> Result<()> {
        let mut connection = self.connection().await?;
        connection
            .transaction::<(), anyhow::Error, _>(async move |connection| {
                sql_query(include_str!(
                    "../queries/discord/delete_discord_oauth_link_state.sql"
                ))
                .bind::<Integer, _>(id_user)
                .execute(connection)
                .await?;
                sql_query(include_str!(
                    "../queries/discord/insert_discord_oauth_link_state.sql"
                ))
                .bind::<Text, _>(state_hash)
                .bind::<Integer, _>(id_user)
                .execute(connection)
                .await?;
                Ok(())
            })
            .await
    }

    pub async fn consume_discord_oauth_link_state(
        &self,
        state_hash: &str,
        discord_id: i64,
    ) -> Result<DiscordLinkResult> {
        let mut connection = self.connection().await?;
        connection
            .transaction::<DiscordLinkResult, anyhow::Error, _>(async move |connection| {
                let state: Option<LinkCode> = sql_query(include_str!(
                    "../queries/discord/select_id_user_discord_oauth_link_state.sql"
                ))
                .bind::<Text, _>(state_hash)
                .get_result(connection)
                .await
                .optional()?;
                let Some(state) = state else {
                    return Ok(DiscordLinkResult::status(DiscordLinkStatus::Invalid));
                };
                if state.consumed {
                    return Ok(DiscordLinkResult::status(DiscordLinkStatus::Consumed));
                }
                if state.expired {
                    return Ok(DiscordLinkResult::status(DiscordLinkStatus::Expired));
                }
                let existing: Option<UserId> = sql_query(SELECT_ID_USER)
                    .bind::<BigInt, _>(discord_id)
                    .get_result(connection)
                    .await
                    .optional()?;
                if existing.is_some_and(|user| user.id != state.id_user) {
                    return Ok(DiscordLinkResult::status(DiscordLinkStatus::Conflict));
                }
                let linked: Option<LinkedUser> = sql_query(SET_DISCORD_ID_USER)
                    .bind::<Integer, _>(state.id_user)
                    .bind::<BigInt, _>(discord_id)
                    .get_result(connection)
                    .await
                    .optional()?;
                let Some(linked) = linked else {
                    return Ok(DiscordLinkResult::status(DiscordLinkStatus::Conflict));
                };
                sql_query(include_str!(
                    "../queries/discord/set_consumed_at_discord_oauth_link_state.sql"
                ))
                .bind::<Text, _>(state_hash)
                .execute(connection)
                .await?;
                Ok(DiscordLinkResult {
                    status: DiscordLinkStatus::Linked,
                    id_user: Some(linked.id_user),
                    steam_id: linked.steam_id,
                })
            })
            .await
    }

    pub async fn consume_discord_link_code(
        &self,
        code_hash: &str,
        discord_id: i64,
    ) -> Result<DiscordLinkResult> {
        let mut connection = self.connection().await?;
        connection
            .transaction::<DiscordLinkResult, anyhow::Error, _>(async move |connection| {
                let code: Option<LinkCode> = sql_query(include_str!(
                    "../queries/discord/select_id_user_discord_link_code.sql"
                ))
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
                let existing: Option<UserId> = sql_query(SELECT_ID_USER)
                    .bind::<BigInt, _>(discord_id)
                    .get_result(connection)
                    .await
                    .optional()?;
                if existing.is_some_and(|user| user.id != code.id_user) {
                    return Ok(DiscordLinkResult::status(DiscordLinkStatus::Conflict));
                }
                let linked: Option<LinkedUser> = sql_query(SET_DISCORD_ID_USER)
                    .bind::<Integer, _>(code.id_user)
                    .bind::<BigInt, _>(discord_id)
                    .get_result(connection)
                    .await
                    .optional()?;
                let Some(linked) = linked else {
                    return Ok(DiscordLinkResult::status(DiscordLinkStatus::Conflict));
                };
                sql_query(include_str!(
                    "../queries/discord/set_consumed_at_discord_link_code.sql"
                ))
                .bind::<Text, _>(code_hash)
                .execute(connection)
                .await?;
                Ok(DiscordLinkResult {
                    status: DiscordLinkStatus::Linked,
                    id_user: Some(linked.id_user),
                    steam_id: linked.steam_id,
                })
            })
            .await
    }

    pub async fn unlink_discord_by_discord_id(
        &self,
        discord_id: i64,
    ) -> Result<Option<UnlinkedDiscordUser>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(include_str!(
            "../queries/discord/unlink_discord_by_discord_id.sql"
        ))
        .bind::<BigInt, _>(discord_id)
        .get_result(&mut connection)
        .await
        .optional()?)
    }

    pub async fn discord_user_state(&self, discord_id: i64) -> Result<DiscordUserState> {
        let mut connection = self.connection().await?;
        let linked_user = sql_query(include_str!(
            "../queries/discord/select_id_user_by_discord_id.sql"
        ))
        .bind::<BigInt, _>(discord_id)
        .get_result(&mut connection)
        .await
        .optional()?;
        let preference = sql_query(include_str!(
            "../queries/discord/select_discord_id_discord_user_preference.sql"
        ))
        .bind::<BigInt, _>(discord_id)
        .get_result(&mut connection)
        .await
        .optional()?;
        let watches = sql_query(include_str!(
            "../queries/discord/select_id_discord_watch.sql"
        ))
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
        Ok(sql_query(include_str!(
            "../queries/discord/set_discord_user_preference.sql"
        ))
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
        Ok(
            sql_query(include_str!("../queries/discord/add_discord_watch.sql"))
                .bind::<BigInt, _>(discord_id)
                .bind::<Text, _>(kind)
                .bind::<Text, _>(&target_id)
                .get_result(&mut connection)
                .await?,
        )
    }

    pub async fn remove_discord_watch(
        &self,
        discord_id: i64,
        id: i64,
    ) -> Result<Option<DiscordWatch>> {
        let mut connection = self.connection().await?;
        Ok(
            sql_query(include_str!("../queries/discord/remove_discord_watch.sql"))
                .bind::<BigInt, _>(discord_id)
                .bind::<BigInt, _>(id)
                .get_result(&mut connection)
                .await
                .optional()?,
        )
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
