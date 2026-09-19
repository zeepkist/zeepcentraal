use crate::Database;
use anyhow::Result;
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{BigInt, Bool, Integer, Nullable, Text},
};
use diesel_async::{AsyncConnection, RunQueryDsl};

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
}
