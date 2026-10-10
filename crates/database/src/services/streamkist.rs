use crate::Database;
use anyhow::Result;
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{BigInt, Bool, Integer, Jsonb, Nullable, Text},
};
use diesel_async::{AsyncConnection, RunQueryDsl};
use serde_json::Value;

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
}

#[derive(Debug, PartialEq, Eq)]
pub enum AddWatch {
    Added,
    Duplicate,
    LimitReached,
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

impl Database {
    pub async fn streamkist_add_watch(
        &self,
        guild: &str,
        channel: &str,
        game: &str,
        name: &str,
    ) -> Result<AddWatch> {
        let mut connection = self.connection().await?;
        connection.transaction::<_, anyhow::Error, _>(async move |connection| {
            sql_query("INSERT INTO streamkist.guilds(guild_id) VALUES($1) ON CONFLICT DO NOTHING")
                .bind::<Text,_>(guild).execute(connection).await?;
            let limit: GuildLimit = sql_query("SELECT watch_limit FROM streamkist.guilds WHERE guild_id=$1 FOR UPDATE")
                .bind::<Text,_>(guild).get_result(connection).await?;
            let duplicate: Count = sql_query("SELECT count(*) FROM streamkist.channels WHERE guild_id=$1 AND channel_id=$2 AND game_id=$3 AND deleted_at IS NULL")
                .bind::<Text,_>(guild).bind::<Text,_>(channel).bind::<Text,_>(game).get_result(connection).await?;
            if duplicate.count > 0 { return Ok(AddWatch::Duplicate); }
            let count: Count = sql_query("SELECT count(*) FROM streamkist.channels WHERE guild_id=$1 AND deleted_at IS NULL")
                .bind::<Text,_>(guild).get_result(connection).await?;
            if count.count >= i64::from(limit.watch_limit) { return Ok(AddWatch::LimitReached); }
            sql_query("INSERT INTO streamkist.twitch_categories(game_id,name) VALUES($1,$2) ON CONFLICT(game_id) DO UPDATE SET name=EXCLUDED.name,updated_at=now()")
                .bind::<Text,_>(game).bind::<Text,_>(name).execute(connection).await?;
            sql_query("INSERT INTO streamkist.channels(guild_id,channel_id,game_id) VALUES($1,$2,$3)")
                .bind::<Text,_>(guild).bind::<Text,_>(channel).bind::<Text,_>(game).execute(connection).await?;
            Ok(AddWatch::Added)
        }).await
    }

    pub async fn streamkist_watches(&self, guild: Option<&str>) -> Result<Vec<Watch>> {
        let mut connection = self.connection().await?;
        Ok(sql_query("SELECT c.id,c.guild_id,c.channel_id,c.game_id,t.name AS game_name FROM streamkist.channels c JOIN streamkist.twitch_categories t USING(game_id) WHERE c.deleted_at IS NULL AND ($1::text IS NULL OR c.guild_id=$1) ORDER BY c.id")
            .bind::<Nullable<Text>,_>(guild).load(&mut connection).await?)
    }

    pub async fn streamkist_remove_watch(&self, guild: &str, id: i64) -> Result<bool> {
        let mut connection = self.connection().await?;
        // Serialize removal with quota checks for this guild.
        connection.transaction::<_, anyhow::Error, _>(async move |connection| {
            sql_query("SELECT guild_id FROM streamkist.guilds WHERE guild_id=$1 FOR UPDATE")
                .bind::<Text,_>(guild).execute(connection).await?;
            Ok(sql_query("UPDATE streamkist.channels SET deleted_at=now() WHERE guild_id=$1 AND id=$2 AND deleted_at IS NULL")
                .bind::<Text,_>(guild).bind::<BigInt,_>(id).execute(connection).await? > 0)
        }).await
    }

    pub async fn streamkist_messages(&self, watch_id: i64) -> Result<Vec<StreamMessage>> {
        let mut connection = self.connection().await?;
        Ok(sql_query("SELECT id,stream_id,user_id,message_id,snapshot,peak_viewers,is_live FROM streamkist.streams WHERE watch_id=$1 AND is_live ORDER BY id")
            .bind::<BigInt,_>(watch_id).load(&mut connection).await?)
    }

    pub async fn streamkist_reserve_message(
        &self,
        watch_id: i64,
        stream: &str,
        user: &str,
        snapshot: &Value,
        viewers: i32,
    ) -> Result<Option<StreamMessage>> {
        let mut connection = self.connection().await?;
        Ok(sql_query("INSERT INTO streamkist.streams(watch_id,stream_id,user_id,snapshot,peak_viewers) SELECT $1,$2,$3,$4,$5 WHERE EXISTS(SELECT 1 FROM streamkist.channels WHERE id=$1 AND deleted_at IS NULL) ON CONFLICT(watch_id,stream_id) DO UPDATE SET stream_id=EXCLUDED.stream_id WHERE streamkist.streams.is_live RETURNING id,stream_id,user_id,message_id,snapshot,peak_viewers,is_live")
            .bind::<BigInt,_>(watch_id).bind::<Text,_>(stream).bind::<Text,_>(user).bind::<Jsonb,_>(snapshot).bind::<Integer,_>(viewers)
            .get_result(&mut connection).await.optional()?)
    }

    pub async fn streamkist_save_message(
        &self,
        id: i64,
        message: &str,
        snapshot: &Value,
        peak: i32,
        live: bool,
    ) -> Result<()> {
        let mut connection = self.connection().await?;
        sql_query("UPDATE streamkist.streams SET message_id=$2,snapshot=$3,peak_viewers=GREATEST(peak_viewers,$4),is_live=$5,updated_at=now() WHERE id=$1")
            .bind::<BigInt,_>(id).bind::<Text,_>(message).bind::<Jsonb,_>(snapshot).bind::<Integer,_>(peak).bind::<Bool,_>(live)
            .execute(&mut connection).await?;
        Ok(())
    }

    pub async fn streamkist_claim_poll(&self, owner: &str) -> Result<bool> {
        let mut connection = self.connection().await?;
        Ok(sql_query("INSERT INTO streamkist.poll_lease(id,owner,expires_at) VALUES(true,$1,now()+interval '3 minutes') ON CONFLICT(id) DO UPDATE SET owner=EXCLUDED.owner,expires_at=EXCLUDED.expires_at WHERE streamkist.poll_lease.expires_at<=now()")
            .bind::<Text,_>(owner).execute(&mut connection).await? > 0)
    }

    pub async fn streamkist_release_poll(&self, owner: &str) -> Result<()> {
        let mut connection = self.connection().await?;
        sql_query("DELETE FROM streamkist.poll_lease WHERE owner=$1")
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
        connection.transaction::<_, anyhow::Error, _>(async move |connection| {
            sql_query("INSERT INTO streamkist.command_usage(command_name,usage_count) VALUES($1,1) ON CONFLICT(command_name) DO UPDATE SET usage_count=streamkist.command_usage.usage_count+1,last_used=now()")
                .bind::<Text,_>(command).execute(connection).await?;
            sql_query("INSERT INTO streamkist.command_log(command_name,guild_id,channel_id,execution_time,options) VALUES($1,$2,$3,$4,$5)")
                .bind::<Text,_>(command).bind::<Nullable<Text>,_>(guild).bind::<Nullable<Text>,_>(channel).bind::<BigInt,_>(elapsed_ms).bind::<Jsonb,_>(options)
                .execute(connection).await?;
            Ok(())
        }).await
    }
}
