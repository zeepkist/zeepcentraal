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
    pub async fn discord_profile(&self, kind: &str, identifier: &str) -> Result<Option<Value>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "SELECT jsonb_build_object( \
             'id',account.id,'steamId',account.steam_id::text,'steamName',account.steam_name, \
             'discordId',account.discord_id::text,'points',COALESCE(points.points,0), \
             'rank',COALESCE(points.rank,-1),'totalPoints',COALESCE(points.total_points,0), \
             'worldRecords',(SELECT count(*) FROM public.world_record_global wr WHERE wr.id_user=account.id), \
             'records',(SELECT count(*) FROM public.record record WHERE record.id_user=account.id), \
             'personalBests',(SELECT count(*) FROM public.personal_best_global pb WHERE pb.id_user=account.id), \
             'publishedLevels',(SELECT count(*) FROM public.level_item item WHERE item.author_id=account.steam_id \
               AND item.deleted=false), \
             'votes',(SELECT count(*) FROM public.vote vote WHERE vote.id_user=account.id)) AS value \
             FROM public.\"user\" account LEFT JOIN public.user_points points ON points.id_user=account.id \
             WHERE CASE $1 WHEN 'discord' THEN account.discord_id::text=$2 \
               WHEN 'steam' THEN account.steam_id::text=$2 WHEN 'id' THEN account.id::text=$2 \
               ELSE false END LIMIT 1",
        )
        .bind::<Text, _>(kind)
        .bind::<Text, _>(identifier)
        .get_result::<JsonRow>(&mut connection)
        .await
        .optional()?
        .map(|row| row.value))
    }

    pub async fn discord_level_lookup(&self, query: &str) -> Result<Option<Value>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "WITH selected AS MATERIALIZED (SELECT level.id,level.xx_hash FROM public.level level \
             JOIN LATERAL (SELECT source.* FROM public.level_item source WHERE source.id_level=level.id \
               AND source.deleted=false ORDER BY source.updated_at DESC,source.id DESC LIMIT 1) item ON true \
             LEFT JOIN public.\"user\" author ON author.steam_id=item.author_id \
             WHERE level.publicly_visible=true AND (level.xx_hash ILIKE $1 OR level.id::text=$1 \
               OR item.name ILIKE '%'||$1||'%' OR author.steam_name ILIKE '%'||$1||'%') \
             ORDER BY (level.xx_hash=$1) DESC,(level.id::text=$1) DESC,(lower(item.name)=lower($1)) DESC, \
               similarity(item.name,$1) DESC,level.id DESC LIMIT 1) \
             SELECT jsonb_build_object('id',level.id,'xxHash',level.xx_hash,'name',item.name, \
               'imageUrl',item.image_url,'workshopId',item.workshop_id::text,'authorName',author.steam_name, \
               'authorDiscordId',author.discord_id::text,'points',COALESCE(points.points,0), \
               'rating',COALESCE(points.rating,0),'records',(SELECT count(*) FROM public.record r WHERE r.id_level=level.id), \
               'personalBests',(SELECT count(*) FROM public.personal_best_global pb WHERE pb.id_level=level.id), \
               'votes',(SELECT count(*) FROM public.vote vote WHERE vote.id_level=level.id), \
               'worldRecord',CASE WHEN wr.id IS NULL THEN NULL ELSE jsonb_build_object('time',wr_record.time, \
                 'steamName',wr_user.steam_name,'discordId',wr_user.discord_id::text) END, \
               'leaderboard',COALESCE((SELECT jsonb_agg(jsonb_build_object('rank',ranked.rank, \
                 'time',ranked.time,'steamName',ranked.steam_name,'discordId',ranked.discord_id::text) \
                 ORDER BY ranked.rank) FROM (SELECT row_number() OVER(ORDER BY record.time,record.id) AS rank, \
                 record.time,account.steam_name,account.discord_id FROM public.personal_best_global pb \
                 JOIN public.record record ON record.id=pb.id_record JOIN public.\"user\" account ON account.id=pb.id_user \
                 WHERE pb.id_level=level.id ORDER BY record.time,record.id LIMIT 10) ranked),'[]'::jsonb)) AS value \
             FROM selected JOIN public.level level USING(id) JOIN LATERAL (SELECT source.* FROM public.level_item source \
               WHERE source.id_level=level.id AND source.deleted=false ORDER BY source.updated_at DESC,source.id DESC LIMIT 1) item ON true \
             LEFT JOIN public.\"user\" author ON author.steam_id=item.author_id \
             LEFT JOIN public.level_points points ON points.id_level=level.id \
             LEFT JOIN public.world_record_global wr ON wr.id_level=level.id \
             LEFT JOIN public.record wr_record ON wr_record.id=wr.id_record \
             LEFT JOIN public.\"user\" wr_user ON wr_user.id=wr.id_user",
        )
        .bind::<Text, _>(query)
        .get_result::<JsonRow>(&mut connection)
        .await
        .optional()?
        .map(|row| row.value))
    }

    pub async fn discord_level_search(&self, query: &str) -> Result<Vec<Value>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "SELECT jsonb_build_object('name',item.name,'value',level.xx_hash) AS value \
             FROM public.level level JOIN LATERAL (SELECT source.* FROM public.level_item source \
               WHERE source.id_level=level.id AND source.deleted=false ORDER BY source.updated_at DESC,source.id DESC LIMIT 1) item ON true \
             LEFT JOIN public.\"user\" author ON author.steam_id=item.author_id \
             WHERE level.publicly_visible=true AND (level.xx_hash ILIKE $1||'%' OR item.name ILIKE '%'||$1||'%' \
               OR author.steam_name ILIKE '%'||$1||'%') ORDER BY (level.xx_hash=$1) DESC, \
               (lower(item.name)=lower($1)) DESC,similarity(item.name,$1) DESC,level.id DESC LIMIT 25",
        )
        .bind::<Text, _>(query)
        .load::<JsonRow>(&mut connection)
        .await?
        .into_iter()
        .map(|row| row.value)
        .collect())
    }

    pub async fn discord_random_level(&self, minimum_points: i32) -> Result<Option<Value>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "WITH candidates AS MATERIALIZED (SELECT level.xx_hash,item.name,points.points FROM public.level level \
             JOIN public.level_points points ON points.id_level=level.id AND points.points>=$1 \
             JOIN LATERAL (SELECT source.* FROM public.level_item source WHERE source.id_level=level.id \
               AND source.deleted=false ORDER BY source.updated_at DESC,source.id DESC LIMIT 1) item ON true \
             WHERE level.publicly_visible=true ORDER BY level.id DESC LIMIT 100) \
             SELECT jsonb_build_object('xxHash',xx_hash,'name',name,'points',points) AS value \
             FROM candidates ORDER BY random() LIMIT 1",
        )
        .bind::<Integer, _>(minimum_points)
        .get_result::<JsonRow>(&mut connection)
        .await
        .optional()?
        .map(|row| row.value))
    }

    pub async fn discord_user_statistics(
        &self,
        discord_id: i64,
        range: &str,
        custom_from: Option<&str>,
        custom_to: Option<&str>,
    ) -> Result<Option<Value>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "WITH local_time AS MATERIALIZED (SELECT timezone('Europe/London',clock_timestamp()) AS now), \
             bounds_local AS MATERIALIZED (SELECT CASE $2 \
               WHEN 'today' THEN date_trunc('day',now) WHEN 'yesterday' THEN date_trunc('day',now)-interval '1 day' \
               WHEN 'this-week' THEN date_trunc('week',now) WHEN 'last-week' THEN date_trunc('week',now)-interval '1 week' \
               WHEN 'this-month' THEN date_trunc('month',now) WHEN 'last-month' THEN date_trunc('month',now)-interval '1 month' \
               WHEN 'this-year' THEN date_trunc('year',now) WHEN 'last-year' THEN date_trunc('year',now)-interval '1 year' \
               WHEN 'all-time' THEN timestamp '2000-01-01' WHEN 'custom' THEN $3::date::timestamp END AS from_local, \
               CASE $2 WHEN 'today' THEN date_trunc('day',now)+interval '1 day' WHEN 'yesterday' THEN date_trunc('day',now) \
               WHEN 'this-week' THEN now+interval '1 day' WHEN 'last-week' THEN date_trunc('week',now) \
               WHEN 'this-month' THEN now+interval '1 day' WHEN 'last-month' THEN date_trunc('month',now) \
               WHEN 'this-year' THEN now+interval '1 day' WHEN 'last-year' THEN date_trunc('year',now) \
               WHEN 'all-time' THEN now+interval '1 day' WHEN 'custom' THEN ($4::date+1)::timestamp END AS to_local \
               FROM local_time), bounds AS MATERIALIZED (SELECT from_local AT TIME ZONE 'Europe/London' AS from_at, \
               to_local AT TIME ZONE 'Europe/London' AS to_at FROM bounds_local), \
             account AS MATERIALIZED (SELECT id,steam_name,discord_id FROM public.\"user\" \
               WHERE discord_id=$1 AND discord_id>0 LIMIT 1) \
             SELECT jsonb_build_object('steamName',account.steam_name,'discordId',account.discord_id::text, \
               'records',(SELECT count(*) FROM public.record value WHERE value.id_user=account.id \
                 AND value.date_created >= bounds.from_at AND value.date_created < bounds.to_at), \
               'personalBests',(SELECT count(*) FROM public.personal_best_global value WHERE value.id_user=account.id \
                 AND value.date_created >= bounds.from_at AND value.date_created < bounds.to_at), \
               'worldRecords',(SELECT count(*) FROM public.world_record_global value WHERE value.id_user=account.id \
                 AND value.date_created >= bounds.from_at AND value.date_created < bounds.to_at), \
               'levels',(SELECT count(*) FROM public.level_item value JOIN public.\"user\" author ON author.steam_id=value.author_id \
                 WHERE author.id=account.id AND value.deleted=false AND value.created_at >= bounds.from_at \
                 AND value.created_at < bounds.to_at), \
               'votes',(SELECT count(*) FROM public.vote value WHERE value.id_user=account.id \
                 AND value.date_created >= bounds.from_at AND value.date_created < bounds.to_at), \
               'samples',statistics.samples,'distance',statistics.distance,'time',statistics.time, \
               'averageSpeed',statistics.average_speed,'averageGforce',statistics.average_gforce, \
               'maxSpeed',statistics.max_speed,'maxGforce',statistics.max_gforce, \
               'distanceOnTarmac',statistics.tarmac,'distanceOnGrass',statistics.grass, \
               'distanceOnSand',statistics.sand,'distanceOnSoap',statistics.soap, \
               'distanceOnWood',statistics.wood,'distanceOnMud',statistics.mud, \
               'distanceOnIce1',statistics.ice1,'distanceOnIce2',statistics.ice2, \
               'distanceOnIce3',statistics.ice3,'distanceInAir',statistics.air) AS value \
             FROM account CROSS JOIN bounds CROSS JOIN LATERAL (SELECT count(statistic.id_record) AS samples, \
               COALESCE(sum(statistic.distance),0) AS distance,COALESCE(sum(statistic.time),0) AS time, \
               COALESCE(avg(statistic.average_speed),0) AS average_speed, \
               COALESCE(avg(statistic.average_gforce),0) AS average_gforce, \
               COALESCE(max(statistic.max_speed),0) AS max_speed,COALESCE(max(statistic.max_gforce),0) AS max_gforce, \
               COALESCE(sum(statistic.distance_on_tarmac),0) AS tarmac,COALESCE(sum(statistic.distance_on_grass),0) AS grass, \
               COALESCE(sum(statistic.distance_on_sand),0) AS sand,COALESCE(sum(statistic.distance_on_soap),0) AS soap, \
               COALESCE(sum(statistic.distance_on_wood),0) AS wood,COALESCE(sum(statistic.distance_on_mud),0) AS mud, \
               COALESCE(sum(statistic.distance_on_ice1),0) AS ice1,COALESCE(sum(statistic.distance_on_ice2),0) AS ice2, \
               COALESCE(sum(statistic.distance_on_ice3),0) AS ice3,COALESCE(sum(statistic.distance_in_air),0) AS air \
               FROM public.record_statistic statistic JOIN public.record record ON record.id=statistic.id_record \
               WHERE record.id_user=account.id AND record.date_created >= bounds.from_at \
                 AND record.date_created < bounds.to_at) statistics",
        )
        .bind::<BigInt, _>(discord_id)
        .bind::<Text, _>(range)
        .bind::<Nullable<Text>, _>(custom_from)
        .bind::<Nullable<Text>, _>(custom_to)
        .get_result::<JsonRow>(&mut connection)
        .await
        .optional()?
        .map(|row| row.value))
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn discord_playlist_levels(
        &self,
        discord_id: i64,
        count: i64,
        sort: &str,
        without_wr: bool,
        without_pb: bool,
        no_records: bool,
    ) -> Result<Vec<Value>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "WITH account AS MATERIALIZED (SELECT id FROM public.\"user\" WHERE discord_id=$1 AND discord_id>0), \
             candidates AS MATERIALIZED (SELECT level.id,level.xx_hash,item.workshop_id,item.file_uid,item.name,item.file_author, \
               COALESCE(points.points,0) AS points,(SELECT count(*) FROM public.record value WHERE value.id_level=level.id) AS records, \
               (SELECT count(*) FROM public.record value WHERE value.id_level=level.id \
                 AND value.date_created>=clock_timestamp()-interval '30 days') AS popularity,item.created_at,item.updated_at \
               FROM public.level level JOIN LATERAL (SELECT source.* FROM public.level_item source WHERE source.id_level=level.id \
                 AND source.deleted=false ORDER BY source.updated_at DESC,source.id DESC LIMIT 1) item ON true \
               LEFT JOIN public.level_points points ON points.id_level=level.id \
               LEFT JOIN public.world_record_global wr ON wr.id_level=level.id LEFT JOIN account ON true \
               WHERE level.publicly_visible=true AND (NOT $4 OR wr.id_user IS DISTINCT FROM account.id) \
                 AND (NOT $5 OR NOT EXISTS(SELECT 1 FROM public.personal_best_global pb \
                   WHERE pb.id_level=level.id AND pb.id_user=account.id)) \
                 AND (NOT $6 OR NOT EXISTS(SELECT 1 FROM public.record value WHERE value.id_level=level.id))) \
             SELECT jsonb_build_object('id',id,'xxHash',xx_hash,'workshopId',workshop_id::text, \
               'fileUid',file_uid,'name',name,'fileAuthor',file_author,'points',points,'records',records) AS value \
             FROM candidates ORDER BY CASE $2 WHEN 'points' THEN points WHEN 'records' THEN records \
               WHEN 'popularity' THEN popularity ELSE NULL END DESC NULLS LAST, \
               CASE $2 WHEN 'created' THEN created_at WHEN 'updated' THEN updated_at ELSE NULL END DESC NULLS LAST,id ASC LIMIT $3",
        )
        .bind::<BigInt, _>(discord_id)
        .bind::<Text, _>(sort)
        .bind::<BigInt, _>(count)
        .bind::<Bool, _>(without_wr)
        .bind::<Bool, _>(without_pb)
        .bind::<Bool, _>(no_records)
        .load::<JsonRow>(&mut connection)
        .await?
        .into_iter()
        .map(|row| row.value)
        .collect())
    }

    pub async fn discord_recommended_levels(
        &self,
        discord_id: i64,
        count: i64,
    ) -> Result<Vec<Value>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "SELECT jsonb_build_object('id',level.id,'xxHash',level.xx_hash,'workshopId',item.workshop_id::text, \
               'fileUid',item.file_uid,'name',item.name,'fileAuthor',item.file_author, \
               'points',contribution.level_points,'records',(SELECT count(*) FROM public.record value WHERE value.id_level=level.id)) AS value \
             FROM public.\"user\" account JOIN public.user_point_contribution contribution ON contribution.id_user=account.id \
             JOIN public.level level ON level.id=contribution.id_level AND level.publicly_visible=true \
             JOIN LATERAL (SELECT source.* FROM public.level_item source WHERE source.id_level=level.id AND source.deleted=false \
               ORDER BY source.updated_at DESC,source.id DESC LIMIT 1) item ON true \
             WHERE account.discord_id=$1 AND contribution.level_position>1 \
               AND contribution.level_points-contribution.player_decayed_points >= \
                 greatest(100,contribution.level_points*0.15) \
             ORDER BY contribution.level_points-contribution.player_decayed_points DESC,level.id LIMIT $2",
        )
        .bind::<BigInt, _>(discord_id)
        .bind::<BigInt, _>(count)
        .load::<JsonRow>(&mut connection)
        .await?
        .into_iter()
        .map(|row| row.value)
        .collect())
    }

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
