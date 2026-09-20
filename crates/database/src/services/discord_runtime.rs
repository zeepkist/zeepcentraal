use crate::Database;
use anyhow::Result;
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{Array, BigInt, Bool, Integer, Jsonb, Nullable, Text},
};
use diesel_async::RunQueryDsl;
use serde_json::Value;
use std::collections::{HashMap, HashSet};

#[derive(QueryableByName)]
struct JsonRow {
    #[diesel(sql_type = Jsonb)]
    value: Value,
}

impl Database {
    pub async fn discord_activity_events_after(
        &self,
        cursor: i64,
        limit: i64,
    ) -> Result<Vec<Value>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "SELECT jsonb_build_object( \
             'id',event.id::text,'kind',event.kind,'levelId',event.id_level,'userId',event.id_user, \
             'previousUserId',event.id_previous_user,'recordId',event.id_record, \
             'previousRecordId',event.id_previous_record,'payload',event.payload, \
             'occurredAt',to_char(event.occurred_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'), \
             'level',CASE WHEN level.id IS NULL THEN NULL ELSE jsonb_build_object( \
               'id',level.id,'xxHash',level.xx_hash,'levelItems',jsonb_build_object('nodes', \
                 CASE WHEN item.id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object( \
                   'name',item.name,'imageUrl',item.image_url,'workshopId',item.workshop_id::text, \
                   'author',CASE WHEN author.id IS NULL THEN NULL ELSE jsonb_build_object('id',author.id, \
                     'steamId',author.steam_id::text,'steamName',author.steam_name,'discordId',author.discord_id::text) END)) END), \
               'levelPoints',CASE WHEN points.id_level IS NULL THEN NULL ELSE jsonb_build_object( \
                 'points',points.points,'rating',points.rating) END, \
               'personalBestGlobals',jsonb_build_object('totalCount',(SELECT count(*) FROM public.personal_best_global pb \
                 WHERE pb.id_level=level.id))) END, \
             'user',CASE WHEN actor.id IS NULL THEN NULL ELSE jsonb_build_object('id',actor.id,'steamId', \
               actor.steam_id::text,'steamName',actor.steam_name,'discordId',actor.discord_id::text) END, \
             'previousUser',CASE WHEN previous_actor.id IS NULL THEN NULL ELSE jsonb_build_object( \
               'id',previous_actor.id,'steamId',previous_actor.steam_id::text,'steamName',previous_actor.steam_name, \
               'discordId',previous_actor.discord_id::text) END, \
             'record',CASE WHEN record.id IS NULL THEN NULL ELSE jsonb_build_object('id',record.id,'time',record.time, \
               'modVersion',record.mod_version) END, \
             'previousRecord',CASE WHEN previous_record.id IS NULL THEN NULL ELSE jsonb_build_object( \
               'id',previous_record.id,'time',previous_record.time,'modVersion',previous_record.mod_version) END) AS value \
             FROM public.discord_activity_event event \
             LEFT JOIN public.level ON level.id=event.id_level AND level.publicly_visible=true \
             LEFT JOIN LATERAL (SELECT * FROM public.level_item source WHERE source.id_level=level.id \
               AND source.deleted=false ORDER BY source.updated_at DESC,source.id DESC LIMIT 1) item ON true \
             LEFT JOIN public.\"user\" author ON author.steam_id=item.author_id \
             LEFT JOIN public.level_points points ON points.id_level=level.id \
             LEFT JOIN public.\"user\" actor ON actor.id=event.id_user \
             LEFT JOIN public.\"user\" previous_actor ON previous_actor.id=event.id_previous_user \
             LEFT JOIN public.record record ON record.id=event.id_record \
             LEFT JOIN public.record previous_record ON previous_record.id=event.id_previous_record \
             WHERE event.id>$1 AND (event.id_level IS NULL OR level.id IS NOT NULL) \
             ORDER BY event.id LIMIT $2",
        )
        .bind::<BigInt, _>(cursor)
        .bind::<BigInt, _>(limit)
        .load::<JsonRow>(&mut connection)
        .await?
        .into_iter()
        .map(|row| row.value)
        .collect())
    }

    pub async fn discord_tournament_snapshots(&self) -> Result<Vec<Value>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "WITH selected AS (SELECT DISTINCT ON (tournament.type) tournament.* \
             FROM public.track_tournament tournament WHERE tournament.type IN (0,1) \
             AND tournament.start_at<=clock_timestamp() ORDER BY tournament.type, \
             (tournament.end_at>clock_timestamp()) DESC,tournament.start_at DESC,tournament.id DESC) \
             SELECT jsonb_build_object('tournamentId',selected.id,'tournamentType',selected.type, \
             'tournamentSlug',selected.slug,'endAt',to_char(selected.end_at AT TIME ZONE 'UTC', \
             'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'),'levelName',COALESCE(item.name,'Unknown'), \
             'imageUrl',NULLIF(item.image_url,''),'entries',(SELECT count(*) FROM public.track_tournament_result \
             result WHERE result.id_tournament=selected.id),'standings',COALESCE((SELECT jsonb_agg( \
               jsonb_build_object('userId',ranked.id_user,'steamName',ranked.steam_name, \
               'discordId',ranked.discord_id::text,'time',ranked.time,'rank',ranked.rank,'points',ranked.points) \
               ORDER BY ranked.rank,ranked.time,ranked.id_record) FROM (SELECT result.id_user, \
               result.id_record,\"user\".steam_name,\"user\".discord_id,result.time,result.rank,result.points \
               FROM public.track_tournament_result result JOIN public.\"user\" ON \"user\".id=result.id_user \
               WHERE result.id_tournament=selected.id ORDER BY result.rank,result.time,result.id_record LIMIT 3) \
               ranked),'[]'::jsonb)) AS value FROM selected LEFT JOIN LATERAL (SELECT source.name, \
             source.image_url FROM public.level_item source WHERE source.id_level=selected.id_level \
             AND source.deleted=false ORDER BY source.updated_at DESC,source.id DESC LIMIT 1) item ON true \
             ORDER BY selected.type",
        )
        .load::<JsonRow>(&mut connection)
        .await?
        .into_iter()
        .map(|row| row.value)
        .collect())
    }

    pub async fn discord_guild_state(&self, guild_id: i64) -> Result<Value> {
        let mut connection = self.connection().await?;
        let row: JsonRow = sql_query(
            "SELECT jsonb_build_object( \
               'config',(SELECT jsonb_build_object('guildId',guild_id::text,'linkedRoleId', \
                 CASE WHEN linked_role_id IS NULL THEN NULL ELSE to_jsonb(linked_role_id::text) END, \
                 'dateCreated',to_char(date_created AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'), \
                 'dateUpdated',to_char(date_updated AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')) \
                 FROM zc_private.discord_guild_config WHERE guild_id=$1), \
               'feeds',COALESCE((SELECT jsonb_agg(jsonb_build_object('guildId',guild_id::text, \
                 'kind',kind,'channelId',channel_id::text,'enabled',enabled,'cursorEventId',cursor_event_id::text, \
                 'dateCreated',to_char(date_created AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'), \
                 'dateUpdated',to_char(date_updated AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')) ORDER BY kind) \
                 FROM zc_private.discord_guild_feed WHERE guild_id=$1),'[]'::jsonb), \
               'digest',(SELECT jsonb_build_object('guildId',guild_id::text,'channelId',channel_id::text, \
                 'dailyEnabled',daily_enabled,'weeklyEnabled',weekly_enabled,'deliveryHour',delivery_hour, \
                 'weeklyDay',weekly_day,'nextDeliveryAt',CASE WHEN next_delivery_at IS NULL THEN NULL ELSE \
                 to_jsonb(to_char(next_delivery_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')) END, \
                 'leaseUntil',CASE WHEN lease_until IS NULL THEN NULL ELSE to_jsonb(to_char(lease_until AT TIME ZONE 'UTC', \
                 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')) END,'dateUpdated',to_char(date_updated AT TIME ZONE 'UTC', \
                 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')) FROM zc_private.discord_digest WHERE guild_id=$1), \
               'tournamentMessages',COALESCE((SELECT jsonb_agg(jsonb_build_object('guildId',guild_id::text, \
                 'idTournament',id_tournament,'channelId',channel_id::text,'messageId',message_id::text, \
                 'contentHash',content_hash,'dateUpdated',to_char(date_updated AT TIME ZONE 'UTC', \
                 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'))) FROM zc_private.discord_tournament_message \
                 WHERE guild_id=$1),'[]'::jsonb)) AS value",
        )
        .bind::<BigInt, _>(guild_id)
        .get_result(&mut connection)
        .await?;
        Ok(row.value)
    }

    pub async fn enabled_discord_guild_feeds(&self) -> Result<Vec<Value>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "SELECT jsonb_build_object('guildId',guild_id::text,'kind',kind,'channelId',channel_id::text, \
             'enabled',enabled,'cursorEventId',cursor_event_id::text,'dateCreated',to_char(date_created AT TIME ZONE 'UTC', \
             'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'),'dateUpdated',to_char(date_updated AT TIME ZONE 'UTC', \
             'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')) AS value FROM zc_private.discord_guild_feed \
             WHERE enabled=true ORDER BY guild_id,kind",
        )
        .load::<JsonRow>(&mut connection)
        .await?
        .into_iter()
        .map(|row| row.value)
        .collect())
    }

    pub async fn set_discord_guild_linked_role(
        &self,
        guild_id: i64,
        role_id: Option<i64>,
    ) -> Result<Value> {
        let mut connection = self.connection().await?;
        let row: JsonRow = sql_query(
            "WITH row AS (INSERT INTO zc_private.discord_guild_config(guild_id,linked_role_id) VALUES($1,$2) \
             ON CONFLICT(guild_id) DO UPDATE SET linked_role_id=excluded.linked_role_id,date_updated=clock_timestamp() \
             RETURNING *) SELECT jsonb_build_object('guildId',guild_id::text,'linkedRoleId',CASE WHEN linked_role_id \
             IS NULL THEN NULL ELSE to_jsonb(linked_role_id::text) END,'dateCreated',to_char(date_created AT TIME ZONE 'UTC', \
             'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'),'dateUpdated',to_char(date_updated AT TIME ZONE 'UTC', \
             'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')) AS value FROM row",
        )
        .bind::<BigInt, _>(guild_id)
        .bind::<Nullable<BigInt>, _>(role_id)
        .get_result(&mut connection)
        .await?;
        Ok(row.value)
    }

    pub async fn set_discord_guild_feed(
        &self,
        guild_id: i64,
        kind: &str,
        channel_id: i64,
        enabled: bool,
    ) -> Result<Value> {
        let mut connection = self.connection().await?;
        let row: JsonRow = sql_query(
            "WITH row AS (INSERT INTO zc_private.discord_guild_feed \
             (guild_id,kind,channel_id,enabled,cursor_event_id) VALUES($1,$2,$3,$4, \
             (SELECT COALESCE(MAX(id),0) FROM public.discord_activity_event)) \
             ON CONFLICT(guild_id,kind) DO UPDATE SET channel_id=excluded.channel_id,enabled=excluded.enabled, \
             cursor_event_id=excluded.cursor_event_id,date_updated=clock_timestamp() RETURNING *) \
             SELECT jsonb_build_object('guildId',guild_id::text,'kind',kind,'channelId',channel_id::text, \
             'enabled',enabled,'cursorEventId',cursor_event_id::text,'dateCreated',to_char(date_created AT TIME ZONE 'UTC', \
             'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'),'dateUpdated',to_char(date_updated AT TIME ZONE 'UTC', \
             'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')) AS value FROM row",
        )
        .bind::<BigInt, _>(guild_id)
        .bind::<Text, _>(kind)
        .bind::<BigInt, _>(channel_id)
        .bind::<Bool, _>(enabled)
        .get_result(&mut connection)
        .await?;
        Ok(row.value)
    }

    pub async fn advance_discord_guild_feed_cursor(
        &self,
        guild_id: i64,
        kind: &str,
        event_id: i64,
    ) -> Result<Option<Value>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "WITH row AS (UPDATE zc_private.discord_guild_feed SET cursor_event_id=$3, \
             date_updated=clock_timestamp() WHERE guild_id=$1 AND kind=$2 AND cursor_event_id<$3 RETURNING *) \
             SELECT jsonb_build_object('guildId',guild_id::text,'kind',kind,'channelId',channel_id::text, \
             'enabled',enabled,'cursorEventId',cursor_event_id::text,'dateCreated',to_char(date_created AT TIME ZONE 'UTC', \
             'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'),'dateUpdated',to_char(date_updated AT TIME ZONE 'UTC', \
             'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')) AS value FROM row",
        )
        .bind::<BigInt, _>(guild_id)
        .bind::<Text, _>(kind)
        .bind::<BigInt, _>(event_id)
        .get_result::<JsonRow>(&mut connection)
        .await
        .optional()?
        .map(|row| row.value))
    }

    pub async fn discord_worker_cursor(&self, key: &str) -> Result<Value> {
        let mut connection = self.connection().await?;
        let row: JsonRow = sql_query(
            "WITH inserted AS (INSERT INTO zc_private.discord_worker_state(key,cursor_event_id) \
             VALUES($1,(SELECT COALESCE(MAX(id),0) FROM public.discord_activity_event)) \
             ON CONFLICT(key) DO NOTHING RETURNING *), row AS (SELECT * FROM inserted UNION ALL \
             SELECT * FROM zc_private.discord_worker_state WHERE key=$1 LIMIT 1) SELECT jsonb_build_object( \
             'key',key,'cursorEventId',cursor_event_id::text,'dateUpdated',to_char(date_updated AT TIME ZONE 'UTC', \
             'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')) AS value FROM row",
        )
        .bind::<Text, _>(key)
        .get_result(&mut connection)
        .await?;
        Ok(row.value)
    }

    pub async fn advance_discord_worker_cursor(
        &self,
        key: &str,
        event_id: i64,
    ) -> Result<Option<Value>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "WITH row AS (UPDATE zc_private.discord_worker_state SET cursor_event_id=$2, \
             date_updated=clock_timestamp() WHERE key=$1 AND cursor_event_id<$2 RETURNING *) \
             SELECT jsonb_build_object('key',key,'cursorEventId',cursor_event_id::text,'dateUpdated', \
             to_char(date_updated AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')) AS value FROM row",
        )
        .bind::<Text, _>(key)
        .bind::<BigInt, _>(event_id)
        .get_result::<JsonRow>(&mut connection)
        .await
        .optional()?
        .map(|row| row.value))
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn set_discord_digest(
        &self,
        guild_id: i64,
        channel_id: i64,
        daily_enabled: bool,
        weekly_enabled: bool,
        delivery_hour: i32,
        weekly_day: i32,
        next_delivery_at: Option<&str>,
    ) -> Result<Value> {
        let mut connection = self.connection().await?;
        let row: JsonRow = sql_query(
            "WITH row AS (INSERT INTO zc_private.discord_digest(guild_id,channel_id,daily_enabled, \
             weekly_enabled,delivery_hour,weekly_day,next_delivery_at) VALUES($1,$2,$3,$4,$5,$6,$7::timestamptz) \
             ON CONFLICT(guild_id) DO UPDATE SET channel_id=excluded.channel_id,daily_enabled=excluded.daily_enabled, \
             weekly_enabled=excluded.weekly_enabled,delivery_hour=excluded.delivery_hour,weekly_day=excluded.weekly_day, \
             next_delivery_at=excluded.next_delivery_at,date_updated=clock_timestamp() RETURNING *) \
             SELECT jsonb_build_object('guildId',guild_id::text,'channelId',channel_id::text,'dailyEnabled',daily_enabled, \
             'weeklyEnabled',weekly_enabled,'deliveryHour',delivery_hour,'weeklyDay',weekly_day,'nextDeliveryAt', \
             CASE WHEN next_delivery_at IS NULL THEN NULL ELSE to_jsonb(to_char(next_delivery_at AT TIME ZONE 'UTC', \
             'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')) END,'leaseUntil',CASE WHEN lease_until IS NULL THEN NULL ELSE \
             to_jsonb(to_char(lease_until AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')) END,'dateUpdated', \
             to_char(date_updated AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')) AS value FROM row",
        )
        .bind::<BigInt, _>(guild_id)
        .bind::<BigInt, _>(channel_id)
        .bind::<Bool, _>(daily_enabled)
        .bind::<Bool, _>(weekly_enabled)
        .bind::<Integer, _>(delivery_hour)
        .bind::<Integer, _>(weekly_day)
        .bind::<Nullable<Text>, _>(next_delivery_at)
        .get_result(&mut connection)
        .await?;
        Ok(row.value)
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn set_discord_delivery(
        &self,
        guild_id: i64,
        event_id: i64,
        channel_id: i64,
        message_id: Option<i64>,
        status: &str,
        last_error: Option<&str>,
    ) -> Result<Value> {
        let mut connection = self.connection().await?;
        let row: JsonRow = sql_query(
            "WITH row AS (INSERT INTO zc_private.discord_delivery(guild_id,event_id,channel_id,message_id,status,last_error) \
             VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(guild_id,event_id) DO UPDATE SET channel_id=excluded.channel_id, \
             message_id=excluded.message_id,status=excluded.status,last_error=excluded.last_error,date_updated=clock_timestamp() \
             RETURNING *) SELECT jsonb_build_object('guildId',guild_id::text,'eventId',event_id::text,'channelId', \
             channel_id::text,'messageId',CASE WHEN message_id IS NULL THEN NULL ELSE to_jsonb(message_id::text) END, \
             'status',status,'lastError',last_error,'dateUpdated',to_char(date_updated AT TIME ZONE 'UTC', \
             'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')) AS value FROM row",
        )
        .bind::<BigInt, _>(guild_id)
        .bind::<BigInt, _>(event_id)
        .bind::<BigInt, _>(channel_id)
        .bind::<Nullable<BigInt>, _>(message_id)
        .bind::<Text, _>(status)
        .bind::<Nullable<Text>, _>(last_error)
        .get_result(&mut connection)
        .await?;
        Ok(row.value)
    }

    pub async fn discord_delivery(&self, guild_id: i64, event_id: i64) -> Result<Option<Value>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "SELECT jsonb_build_object('guildId',guild_id::text,'eventId',event_id::text,'channelId',channel_id::text, \
             'messageId',CASE WHEN message_id IS NULL THEN NULL ELSE to_jsonb(message_id::text) END,'status',status, \
             'lastError',last_error,'dateUpdated',to_char(date_updated AT TIME ZONE 'UTC', \
             'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')) AS value FROM zc_private.discord_delivery \
             WHERE guild_id=$1 AND event_id=$2",
        )
        .bind::<BigInt, _>(guild_id)
        .bind::<BigInt, _>(event_id)
        .get_result::<JsonRow>(&mut connection)
        .await
        .optional()?
        .map(|row| row.value))
    }

    pub async fn set_discord_tournament_message(
        &self,
        guild_id: i64,
        id_tournament: i32,
        channel_id: i64,
        message_id: i64,
        content_hash: &str,
    ) -> Result<Value> {
        let mut connection = self.connection().await?;
        let row: JsonRow = sql_query(
            "WITH row AS (INSERT INTO zc_private.discord_tournament_message \
             (guild_id,id_tournament,channel_id,message_id,content_hash) VALUES($1,$2,$3,$4,$5) \
             ON CONFLICT(guild_id,id_tournament) DO UPDATE SET channel_id=excluded.channel_id, \
             message_id=excluded.message_id,content_hash=excluded.content_hash,date_updated=clock_timestamp() RETURNING *) \
             SELECT jsonb_build_object('guildId',guild_id::text,'idTournament',id_tournament,'channelId',channel_id::text, \
             'messageId',message_id::text,'contentHash',content_hash,'dateUpdated',to_char(date_updated AT TIME ZONE 'UTC', \
             'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')) AS value FROM row",
        )
        .bind::<BigInt, _>(guild_id)
        .bind::<Integer, _>(id_tournament)
        .bind::<BigInt, _>(channel_id)
        .bind::<BigInt, _>(message_id)
        .bind::<Text, _>(content_hash)
        .get_result(&mut connection)
        .await?;
        Ok(row.value)
    }

    pub async fn matching_discord_watches(
        &self,
        targets: &[(String, Vec<String>)],
    ) -> Result<Vec<Value>> {
        let mut connection = self.connection().await?;
        let mut matches = HashMap::<i64, Value>::new();
        for (kind, target_ids) in targets {
            let normalized: Vec<String> = target_ids
                .iter()
                .map(|target| target.to_lowercase())
                .collect::<HashSet<_>>()
                .into_iter()
                .collect();
            if normalized.is_empty() {
                continue;
            }
            let rows: Vec<(i64, Value)> = sql_query(
                "SELECT id AS value,jsonb_build_object('id',id::text,'discordId',discord_id::text,'kind',kind, \
                 'targetId',target_id,'paused',paused,'lastError',last_error,'lastDeliveryKey',last_delivery_key, \
                 'dateCreated',to_char(date_created AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'), \
                 'dateUpdated',to_char(date_updated AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')) AS payload \
                 FROM zc_private.discord_watch WHERE paused=false AND kind=$1 AND target_id=ANY($2)",
            )
            .bind::<Text, _>(kind)
            .bind::<Array<Text>, _>(&normalized)
            .load::<WatchJsonRow>(&mut connection)
            .await?
            .into_iter()
            .map(|row| (row.value, row.payload))
            .collect();
            matches.extend(rows);
        }
        let mut ids: Vec<_> = matches.keys().copied().collect();
        ids.sort_unstable();
        Ok(ids
            .into_iter()
            .filter_map(|id| matches.remove(&id))
            .collect())
    }

    pub async fn update_discord_watch_delivery(
        &self,
        id: i64,
        paused: bool,
        last_error: Option<&str>,
        delivery_key: Option<&str>,
    ) -> Result<Option<Value>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "WITH row AS (UPDATE zc_private.discord_watch SET paused=$2,last_error=$3,last_delivery_key=$4, \
             date_updated=clock_timestamp() WHERE id=$1 RETURNING *) SELECT jsonb_build_object('id',id::text, \
             'discordId',discord_id::text,'kind',kind,'targetId',target_id,'paused',paused,'lastError',last_error, \
             'lastDeliveryKey',last_delivery_key,'dateCreated',to_char(date_created AT TIME ZONE 'UTC', \
             'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'),'dateUpdated',to_char(date_updated AT TIME ZONE 'UTC', \
             'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')) AS value FROM row",
        )
        .bind::<BigInt, _>(id)
        .bind::<Bool, _>(paused)
        .bind::<Nullable<Text>, _>(last_error)
        .bind::<Nullable<Text>, _>(delivery_key)
        .get_result::<JsonRow>(&mut connection)
        .await
        .optional()?
        .map(|row| row.value))
    }
}

#[derive(QueryableByName)]
struct WatchJsonRow {
    #[diesel(sql_type = BigInt)]
    value: i64,
    #[diesel(sql_type = Jsonb)]
    payload: Value,
}
