use crate::Database;
use anyhow::Result;
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{Array, BigInt, Bool, Integer, Jsonb, Nullable, Text},
};
use diesel_async::{AsyncConnection, RunQueryDsl};
use serde_json::Value;

const SELECT_WATCH_LIMIT_GUILDS: &str =
    include_str!("../queries/streamkist/select_watch_limit_guilds.sql");

#[derive(Clone, Debug, QueryableByName)]
pub struct Watch {
    #[diesel(sql_type = BigInt)]
    pub id: i64,
    #[diesel(sql_type = Text)]
    pub guild_id: String,
    #[diesel(sql_type = Text)]
    pub channel_id: String,
    #[diesel(sql_type = Text)]
    pub game_id: String,
    #[diesel(sql_type = Text)]
    pub game_name: String,
    #[diesel(sql_type = Integer)]
    pub minimum_viewers: i32,
    #[diesel(sql_type = Bool)]
    pub allow_category_switches: bool,
    #[diesel(sql_type = Integer)]
    pub stream_limit: i32,
}

#[derive(Clone, Debug, QueryableByName)]
pub struct StreamMessage {
    #[diesel(sql_type = BigInt)]
    pub id: i64,
    #[diesel(sql_type = Text)]
    pub stream_id: String,
    #[diesel(sql_type = Text)]
    pub user_id: String,
    #[diesel(sql_type = Nullable<Text>)]
    pub message_id: Option<String>,
    #[diesel(sql_type = Jsonb)]
    pub snapshot: Value,
    #[diesel(sql_type = Integer)]
    pub peak_viewers: i32,
    #[diesel(sql_type = Bool)]
    pub is_live: bool,
    #[diesel(sql_type = Text)]
    pub guild_id: String,
    #[diesel(sql_type = Text)]
    pub channel_id: String,
    #[diesel(sql_type = BigInt)]
    pub policy_watch_id: i64,
    #[diesel(sql_type = Bool)]
    pub canonical: bool,
    #[diesel(sql_type = Text)]
    pub tracking_state: String,
    #[diesel(sql_type = Bool)]
    pub activation_pending: bool,
}

#[derive(Debug, PartialEq, Eq)]
pub enum AddWatch {
    Added,
    Updated,
    LimitReached,
}

#[derive(Clone, Copy, Debug, Default)]
pub struct WatchSettings {
    pub minimum_viewers: Option<i32>,
    pub allow_category_switches: Option<bool>,
}

#[derive(QueryableByName)]
struct GuildLimit {
    #[diesel(sql_type = Integer)]
    watch_limit: i32,
}
#[derive(QueryableByName)]
struct Count {
    #[diesel(sql_type = BigInt)]
    count: i64,
}

const MESSAGE_COLUMNS: &str = include_str!("../queries/streamkist/message_columns.sql");

/// Historical totals, deduplicated across Discord guilds and channels.
#[derive(
    Clone, Copy, Debug, PartialEq, Eq, serde::Serialize, utoipa::ToSchema, QueryableByName,
)]
pub struct StreamkistStats {
    #[diesel(sql_type = BigInt)]
    pub streams: i64,
    #[diesel(sql_type = BigInt)]
    pub streamers: i64,
    #[diesel(sql_type = BigInt)]
    pub categories: i64,
    #[diesel(sql_type = BigInt)]
    pub guilds: i64,
}

impl Database {
    pub async fn streamkist_stats(&self) -> Result<StreamkistStats> {
        let mut connection = self.connection().await?;
        Ok(sql_query(include_str!("../queries/streamkist/stats.sql"))
            .get_result(&mut connection)
            .await?)
    }

    pub async fn streamkist_add_watch(
        &self,
        guild: &str,
        channel: &str,
        game: &str,
        name: &str,
        settings: WatchSettings,
    ) -> Result<AddWatch> {
        let WatchSettings {
            minimum_viewers,
            allow_category_switches,
        } = settings;
        anyhow::ensure!(
            minimum_viewers.is_none_or(|value| value >= 0),
            "Minimum viewers cannot be negative"
        );
        let mut connection = self.connection().await?;
        connection
            .transaction::<_, anyhow::Error, _>(async move |connection| {
                sql_query(include_str!(
                    "../queries/streamkist/add_watch_insert_guilds.sql"
                ))
                .bind::<Text, _>(guild)
                .execute(connection)
                .await?;
                let limit: GuildLimit = sql_query(SELECT_WATCH_LIMIT_GUILDS)
                    .bind::<Text, _>(guild)
                    .get_result(connection)
                    .await?;
                let duplicate: Count = sql_query(include_str!(
                    "../queries/streamkist/add_watch_count_channels.sql"
                ))
                .bind::<Text, _>(guild)
                .bind::<Text, _>(channel)
                .bind::<Text, _>(game)
                .get_result(connection)
                .await?;
                if duplicate.count > 0 {
                    sql_query(include_str!(
                        "../queries/streamkist/set_minimum_viewers_channels.sql"
                    ))
                    .bind::<Text, _>(guild)
                    .bind::<Text, _>(channel)
                    .bind::<Text, _>(game)
                    .bind::<Nullable<Integer>, _>(minimum_viewers)
                    .bind::<Nullable<Bool>, _>(allow_category_switches)
                    .execute(connection)
                    .await?;
                    return Ok(AddWatch::Updated);
                }
                let count: Count = sql_query(include_str!(
                    "../queries/streamkist/add_watch_count_channels_by_guild_id.sql"
                ))
                .bind::<Text, _>(guild)
                .get_result(connection)
                .await?;
                if count.count >= i64::from(limit.watch_limit) {
                    return Ok(AddWatch::LimitReached);
                }
                sql_query(include_str!(
                    "../queries/streamkist/insert_twitch_categories.sql"
                ))
                .bind::<Text, _>(game)
                .bind::<Text, _>(name)
                .execute(connection)
                .await?;
                sql_query(include_str!(
                    "../queries/streamkist/add_watch_insert_channels.sql"
                ))
                .bind::<Text, _>(guild)
                .bind::<Text, _>(channel)
                .bind::<Text, _>(game)
                .bind::<Integer, _>(minimum_viewers.unwrap_or(0))
                .bind::<Bool, _>(allow_category_switches.unwrap_or(false))
                .execute(connection)
                .await?;
                Ok(AddWatch::Added)
            })
            .await
    }

    pub async fn streamkist_watches(&self, guild: Option<&str>) -> Result<Vec<Watch>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(include_str!("../queries/streamkist/watches.sql"))
            .bind::<Nullable<Text>, _>(guild)
            .load(&mut connection)
            .await?)
    }

    pub async fn streamkist_remove_watch(&self, guild: &str, id: i64) -> Result<bool> {
        let mut connection = self.connection().await?;
        // Serialize removal with quota checks for this guild.
        connection
            .transaction::<_, anyhow::Error, _>(async move |connection| {
                sql_query(include_str!(
                    "../queries/streamkist/select_guild_id_guilds.sql"
                ))
                .bind::<Text, _>(guild)
                .execute(connection)
                .await?;
                Ok(sql_query(include_str!(
                    "../queries/streamkist/set_deleted_at_channels.sql"
                ))
                .bind::<Text, _>(guild)
                .bind::<BigInt, _>(id)
                .execute(connection)
                .await?
                    > 0)
            })
            .await
    }

    pub async fn streamkist_messages(&self) -> Result<Vec<StreamMessage>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(
            include_str!("../queries/streamkist/messages.sql")
                .replace("{{message_columns}}", MESSAGE_COLUMNS.trim_end()),
        )
        .load(&mut connection)
        .await?)
    }

    pub async fn streamkist_terminal_messages(
        &self,
        streams: &[String],
    ) -> Result<Vec<StreamMessage>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(
            include_str!("../queries/streamkist/terminal_messages.sql")
                .replace("{{message_columns}}", MESSAGE_COLUMNS.trim_end()),
        )
        .bind::<Array<Text>, _>(streams)
        .load(&mut connection)
        .await?)
    }

    pub async fn streamkist_reserve_message(
        &self,
        watch: &Watch,
        stream: &str,
        user: &str,
        snapshot: &Value,
        viewers: i32,
    ) -> Result<Option<StreamMessage>> {
        let mut connection = self.connection().await?;
        connection
            .transaction::<_, anyhow::Error, _>(async move |connection| {
                let limit: GuildLimit = sql_query(SELECT_WATCH_LIMIT_GUILDS)
                    .bind::<Text, _>(&watch.guild_id)
                    .get_result(connection)
                    .await?;
                let current: Vec<Watch> =
                    sql_query(include_str!("../queries/streamkist/select_id_channels.sql"))
                        .bind::<BigInt, _>(watch.id)
                        .load(connection)
                        .await?;
                let Some(current) = current.as_slice().first() else {
                    return Ok(None);
                };
                if current.guild_id != watch.guild_id || current.channel_id != watch.channel_id {
                    return Ok(None);
                }
                let existing: Option<StreamMessage> = sql_query(
                    include_str!("../queries/streamkist/lock_canonical_message.sql")
                        .replace("{{message_columns}}", MESSAGE_COLUMNS.trim_end()),
                )
                .bind::<Text, _>(&watch.guild_id)
                .bind::<Text, _>(&watch.channel_id)
                .bind::<Text, _>(stream)
                .get_result(connection)
                .await
                .optional()?;
                if existing
                    .as_ref()
                    .is_some_and(|row| row.tracking_state == "finished")
                {
                    return Ok(None);
                }
                if existing.as_ref().is_none_or(|row| row.message_id.is_none())
                    && viewers < current.minimum_viewers
                {
                    return Ok(None);
                }
                let occupied: Count = sql_query(include_str!(
                    "../queries/streamkist/reserve_message_count_streams.sql"
                ))
                .bind::<Text, _>(&watch.guild_id)
                .get_result(connection)
                .await?;
                let same: Count = sql_query(include_str!(
                    "../queries/streamkist/reserve_message_count_streams_by_guild_id.sql"
                ))
                .bind::<Text, _>(&watch.guild_id)
                .bind::<Text, _>(stream)
                .get_result(connection)
                .await?;
                if same.count == 0 && occupied.count >= if limit.watch_limit == 1 { 15 } else { 30 }
                {
                    return Ok(None);
                }
                let row = match existing {
                    Some(row) => {
                        sql_query(
                            include_str!("../queries/streamkist/mark_activation_pending.sql")
                                .replace("{{message_columns}}", MESSAGE_COLUMNS.trim_end()),
                        )
                        .bind::<BigInt, _>(row.id)
                        .get_result(connection)
                        .await?
                    }
                    None => {
                        sql_query(
                            include_str!("../queries/streamkist/reserve_message.sql")
                                .replace("{{message_columns}}", MESSAGE_COLUMNS.trim_end()),
                        )
                        .bind::<BigInt, _>(watch.id)
                        .bind::<Text, _>(&watch.guild_id)
                        .bind::<Text, _>(&watch.channel_id)
                        .bind::<Text, _>(stream)
                        .bind::<Text, _>(user)
                        .bind::<Jsonb, _>(snapshot)
                        .bind::<Integer, _>(viewers)
                        .get_result(connection)
                        .await?
                    }
                };
                Ok(Some(row))
            })
            .await
    }

    pub async fn streamkist_save_message(
        &self,
        id: i64,
        message: Option<&str>,
        snapshot: &Value,
        peak: i32,
        state: &str,
        policy_watch_id: i64,
    ) -> Result<()> {
        let mut connection = self.connection().await?;
        sql_query(include_str!("../queries/streamkist/save_message.sql"))
            .bind::<BigInt, _>(id)
            .bind::<Nullable<Text>, _>(message)
            .bind::<Jsonb, _>(snapshot)
            .bind::<Integer, _>(peak)
            .bind::<Text, _>(state)
            .bind::<BigInt, _>(policy_watch_id)
            .execute(&mut connection)
            .await?;
        Ok(())
    }

    pub async fn streamkist_claim_poll(&self, owner: &str) -> Result<bool> {
        let mut connection = self.connection().await?;
        Ok(
            sql_query(include_str!("../queries/streamkist/claim_poll.sql"))
                .bind::<Text, _>(owner)
                .execute(&mut connection)
                .await?
                > 0,
        )
    }

    pub async fn streamkist_release_poll(&self, owner: &str) -> Result<()> {
        let mut connection = self.connection().await?;
        sql_query(include_str!("../queries/streamkist/release_poll.sql"))
            .bind::<Text, _>(owner)
            .execute(&mut connection)
            .await?;
        Ok(())
    }

    pub async fn streamkist_log_command(
        &self,
        command: &str,
        guild: Option<&str>,
        channel: Option<&str>,
        elapsed_ms: i64,
        options: &Value,
    ) -> Result<()> {
        let mut connection = self.connection().await?;
        connection
            .transaction::<_, anyhow::Error, _>(async move |connection| {
                sql_query(include_str!(
                    "../queries/streamkist/insert_command_usage.sql"
                ))
                .bind::<Text, _>(command)
                .execute(connection)
                .await?;
                sql_query(include_str!("../queries/streamkist/insert_command_log.sql"))
                    .bind::<Text, _>(command)
                    .bind::<Nullable<Text>, _>(guild)
                    .bind::<Nullable<Text>, _>(channel)
                    .bind::<BigInt, _>(elapsed_ms)
                    .bind::<Jsonb, _>(options)
                    .execute(connection)
                    .await?;
                Ok(())
            })
            .await
    }
}
