use crate::Database;
use anyhow::Result;
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{Array, BigInt, Bool, Integer, Jsonb, Nullable, Text},
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

const MESSAGE_COLUMNS: &str = "id,stream_id,user_id,message_id,snapshot,peak_viewers,is_live,guild_id,channel_id,policy_watch_id,canonical,tracking_state,activation_pending";

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
        Ok(sql_query(
            "SELECT count(DISTINCT stream_id) AS streams, count(DISTINCT user_id) AS streamers, \
             (SELECT count(*) FROM streamkist.twitch_categories) AS categories, \
             (SELECT count(*) FROM streamkist.guilds) AS guilds FROM streamkist.streams",
        )
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
        connection.transaction::<_, anyhow::Error, _>(async move |connection| {
            sql_query("INSERT INTO streamkist.guilds(guild_id) VALUES($1) ON CONFLICT DO NOTHING")
                .bind::<Text,_>(guild).execute(connection).await?;
            let limit: GuildLimit = sql_query("SELECT watch_limit FROM streamkist.guilds WHERE guild_id=$1 FOR UPDATE")
                .bind::<Text,_>(guild).get_result(connection).await?;
            let duplicate: Count = sql_query("SELECT count(*) FROM streamkist.channels WHERE guild_id=$1 AND channel_id=$2 AND game_id=$3 AND deleted_at IS NULL")
                .bind::<Text,_>(guild).bind::<Text,_>(channel).bind::<Text,_>(game).get_result(connection).await?;
            if duplicate.count > 0 {
                sql_query("UPDATE streamkist.channels SET minimum_viewers=COALESCE($4,minimum_viewers),allow_category_switches=COALESCE($5,allow_category_switches) WHERE guild_id=$1 AND channel_id=$2 AND game_id=$3 AND deleted_at IS NULL")
                    .bind::<Text,_>(guild).bind::<Text,_>(channel).bind::<Text,_>(game)
                    .bind::<Nullable<Integer>,_>(minimum_viewers).bind::<Nullable<Bool>,_>(allow_category_switches).execute(connection).await?;
                return Ok(AddWatch::Updated);
            }
            let count: Count = sql_query("SELECT count(*) FROM streamkist.channels WHERE guild_id=$1 AND deleted_at IS NULL")
                .bind::<Text,_>(guild).get_result(connection).await?;
            if count.count >= i64::from(limit.watch_limit) { return Ok(AddWatch::LimitReached); }
            sql_query("INSERT INTO streamkist.twitch_categories(game_id,name) VALUES($1,$2) ON CONFLICT(game_id) DO UPDATE SET name=EXCLUDED.name,updated_at=now()")
                .bind::<Text,_>(game).bind::<Text,_>(name).execute(connection).await?;
            sql_query("INSERT INTO streamkist.channels(guild_id,channel_id,game_id,minimum_viewers,allow_category_switches) VALUES($1,$2,$3,$4,$5)")
                .bind::<Text,_>(guild).bind::<Text,_>(channel).bind::<Text,_>(game)
                .bind::<Integer,_>(minimum_viewers.unwrap_or(0)).bind::<Bool,_>(allow_category_switches.unwrap_or(false)).execute(connection).await?;
            Ok(AddWatch::Added)
        }).await
    }

    pub async fn streamkist_watches(&self, guild: Option<&str>) -> Result<Vec<Watch>> {
        let mut connection = self.connection().await?;
        Ok(sql_query("SELECT c.id,c.guild_id,c.channel_id,c.game_id,t.name AS game_name,c.minimum_viewers,c.allow_category_switches,CASE WHEN g.watch_limit=1 THEN 15 ELSE 30 END AS stream_limit FROM streamkist.channels c JOIN streamkist.twitch_categories t USING(game_id) JOIN streamkist.guilds g USING(guild_id) WHERE c.deleted_at IS NULL AND ($1::text IS NULL OR c.guild_id=$1) ORDER BY c.id")
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

    pub async fn streamkist_messages(&self) -> Result<Vec<StreamMessage>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(format!("SELECT {MESSAGE_COLUMNS} FROM streamkist.streams s WHERE (tracking_state<>'finished' OR activation_pending) AND EXISTS(SELECT 1 FROM streamkist.channels c WHERE c.guild_id=s.guild_id AND c.channel_id=s.channel_id AND c.deleted_at IS NULL) ORDER BY id"))
            .load(&mut connection).await?)
    }

    pub async fn streamkist_terminal_messages(
        &self,
        streams: &[String],
    ) -> Result<Vec<StreamMessage>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(format!("SELECT {MESSAGE_COLUMNS} FROM streamkist.streams WHERE canonical AND tracking_state='finished' AND stream_id=ANY($1)"))
            .bind::<Array<Text>,_>(streams).load(&mut connection).await?)
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
        connection.transaction::<_, anyhow::Error, _>(async move |connection| {
            let limit: GuildLimit = sql_query("SELECT watch_limit FROM streamkist.guilds WHERE guild_id=$1 FOR UPDATE")
                .bind::<Text,_>(&watch.guild_id).get_result(connection).await?;
            let current: Vec<Watch> = sql_query("SELECT c.id,c.guild_id,c.channel_id,c.game_id,t.name AS game_name,c.minimum_viewers,c.allow_category_switches,0::integer AS stream_limit FROM streamkist.channels c JOIN streamkist.twitch_categories t USING(game_id) WHERE c.id=$1 AND c.deleted_at IS NULL")
                .bind::<BigInt,_>(watch.id).load(connection).await?;
            let Some(current) = current.as_slice().first() else { return Ok(None); };
            if current.guild_id != watch.guild_id || current.channel_id != watch.channel_id { return Ok(None); }
            let existing: Option<StreamMessage> = sql_query(format!("SELECT {MESSAGE_COLUMNS} FROM streamkist.streams WHERE guild_id=$1 AND channel_id=$2 AND stream_id=$3 AND canonical FOR UPDATE"))
                .bind::<Text,_>(&watch.guild_id).bind::<Text,_>(&watch.channel_id).bind::<Text,_>(stream).get_result(connection).await.optional()?;
            if existing.as_ref().is_some_and(|row| row.tracking_state=="finished") { return Ok(None); }
            if existing.as_ref().is_none_or(|row| row.message_id.is_none()) && viewers < current.minimum_viewers { return Ok(None); }
            let occupied: Count = sql_query("SELECT count(DISTINCT stream_id) FROM streamkist.streams s WHERE guild_id=$1 AND (tracking_state='active' OR activation_pending) AND EXISTS(SELECT 1 FROM streamkist.channels c WHERE c.guild_id=s.guild_id AND c.channel_id=s.channel_id AND c.deleted_at IS NULL)")
                .bind::<Text,_>(&watch.guild_id).get_result(connection).await?;
            let same: Count = sql_query("SELECT count(*) FROM streamkist.streams s WHERE guild_id=$1 AND stream_id=$2 AND (tracking_state='active' OR activation_pending) AND EXISTS(SELECT 1 FROM streamkist.channels c WHERE c.guild_id=s.guild_id AND c.channel_id=s.channel_id AND c.deleted_at IS NULL)")
                .bind::<Text,_>(&watch.guild_id).bind::<Text,_>(stream).get_result(connection).await?;
            if same.count==0 && occupied.count>=if limit.watch_limit==1 {15} else {30} {return Ok(None);}
            let row = match existing {
                Some(row) => sql_query(format!("UPDATE streamkist.streams SET activation_pending=true WHERE id=$1 RETURNING {MESSAGE_COLUMNS}"))
                    .bind::<BigInt,_>(row.id).get_result(connection).await?,
                None => sql_query(format!("INSERT INTO streamkist.streams(watch_id,policy_watch_id,guild_id,channel_id,stream_id,user_id,snapshot,peak_viewers,is_live,tracking_state,activation_pending) VALUES($1,$1,$2,$3,$4,$5,$6,$7,false,'limit_paused',true) RETURNING {MESSAGE_COLUMNS}"))
                    .bind::<BigInt,_>(watch.id).bind::<Text,_>(&watch.guild_id).bind::<Text,_>(&watch.channel_id).bind::<Text,_>(stream).bind::<Text,_>(user).bind::<Jsonb,_>(snapshot).bind::<Integer,_>(viewers).get_result(connection).await?,
            };
            Ok(Some(row))
        }).await
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
        sql_query("UPDATE streamkist.streams SET message_id=$2,snapshot=$3,peak_viewers=GREATEST(peak_viewers,$4),is_live=($5='active'),tracking_state=$5,policy_watch_id=$6,activation_pending=false,updated_at=now() WHERE id=$1")
            .bind::<BigInt,_>(id).bind::<Nullable<Text>,_>(message).bind::<Jsonb,_>(snapshot).bind::<Integer,_>(peak).bind::<Text,_>(state).bind::<BigInt,_>(policy_watch_id)
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
