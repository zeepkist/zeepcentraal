use crate::Database;
use anyhow::Result;
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{Array, BigInt, Bool, Integer, Jsonb, Nullable, Text},
};
use diesel_async::RunQueryDsl;
use serde_json::Value;
use std::collections::{BTreeSet, HashMap, HashSet};

#[derive(QueryableByName)]
struct JsonRow {
    #[diesel(sql_type = Jsonb)]
    value: Value,
}

impl Database {
    pub async fn discord_users_lookup(&self, user_ids: &[i32]) -> Result<Vec<Value>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(include_str!(
            "../queries/discord_runtime/discord_users_lookup.sql"
        ))
        .bind::<Array<Integer>, _>(user_ids)
        .load::<JsonRow>(&mut connection)
        .await?
        .into_iter()
        .map(|row| row.value)
        .collect())
    }

    pub async fn discord_profile(&self, kind: &str, identifier: &str) -> Result<Option<Value>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(include_str!(
            "../queries/discord_runtime/discord_profile.sql"
        ))
        .bind::<Text, _>(kind)
        .bind::<Text, _>(identifier)
        .get_result::<JsonRow>(&mut connection)
        .await
        .optional()?
        .map(|row| row.value))
    }

    pub async fn discord_level_lookup(&self, query: &str) -> Result<Option<Value>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(include_str!(
            "../queries/discord_runtime/discord_level_lookup.sql"
        ))
        .bind::<Text, _>(query)
        .get_result::<JsonRow>(&mut connection)
        .await
        .optional()?
        .map(|row| row.value))
    }

    pub async fn discord_level_search(&self, query: &str) -> Result<Vec<Value>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(include_str!(
            "../queries/discord_runtime/discord_level_search.sql"
        ))
        .bind::<Text, _>(query)
        .load::<JsonRow>(&mut connection)
        .await?
        .into_iter()
        .map(|row| row.value)
        .collect())
    }

    pub async fn discord_level_standings(
        &self,
        level_id: i32,
        limit: i64,
        offset: i64,
    ) -> Result<Value> {
        let mut connection = self.connection().await?;
        let row: JsonRow = sql_query(include_str!(
            "../queries/discord_runtime/discord_level_standings.sql"
        ))
        .bind::<Integer, _>(level_id)
        .bind::<BigInt, _>(limit)
        .bind::<BigInt, _>(offset)
        .get_result(&mut connection)
        .await?;
        Ok(row.value)
    }

    pub async fn discord_random_level(&self, minimum_points: i32) -> Result<Option<Value>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(include_str!(
            "../queries/discord_runtime/discord_random_level.sql"
        ))
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
        Ok(sql_query(include_str!(
            "../queries/discord_runtime/discord_user_statistics.sql"
        ))
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
        Ok(sql_query(include_str!(
            "../queries/discord_runtime/discord_playlist_levels.sql"
        ))
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
        Ok(sql_query(include_str!(
            "../queries/discord_runtime/discord_recommended_levels.sql"
        ))
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
        Ok(sql_query(include_str!(
            "../queries/discord_runtime/discord_activity_events_after.sql"
        ))
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
        Ok(sql_query(include_str!(
            "../queries/discord_runtime/discord_tournament_snapshots.sql"
        ))
        .load::<JsonRow>(&mut connection)
        .await?
        .into_iter()
        .map(|row| row.value)
        .collect())
    }

    pub async fn discord_tournament_standings(
        &self,
        tournament_id: i32,
        limit: i64,
        offset: i64,
    ) -> Result<Value> {
        let mut connection = self.connection().await?;
        let row: JsonRow = sql_query(include_str!(
            "../queries/discord_runtime/discord_tournament_standings.sql"
        ))
        .bind::<Integer, _>(tournament_id)
        .bind::<BigInt, _>(limit)
        .bind::<BigInt, _>(offset)
        .get_result(&mut connection)
        .await?;
        Ok(row.value)
    }

    pub async fn discord_guild_state(&self, guild_id: i64) -> Result<Value> {
        let mut connection = self.connection().await?;
        let row: JsonRow = sql_query(include_str!(
            "../queries/discord_runtime/discord_guild_state.sql"
        ))
        .bind::<BigInt, _>(guild_id)
        .get_result(&mut connection)
        .await?;
        Ok(row.value)
    }

    pub async fn enabled_discord_guild_feeds(&self) -> Result<Vec<Value>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(include_str!(
            "../queries/discord_runtime/enabled_discord_guild_feeds.sql"
        ))
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
        let row: JsonRow = sql_query(include_str!(
            "../queries/discord_runtime/set_discord_guild_linked_role.sql"
        ))
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
        let row: JsonRow = sql_query(include_str!(
            "../queries/discord_runtime/set_discord_guild_feed.sql"
        ))
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
        Ok(sql_query(include_str!(
            "../queries/discord_runtime/advance_discord_guild_feed_cursor.sql"
        ))
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
        let row: JsonRow = sql_query(include_str!(
            "../queries/discord_runtime/discord_worker_cursor.sql"
        ))
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
        Ok(sql_query(include_str!(
            "../queries/discord_runtime/advance_discord_worker_cursor.sql"
        ))
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
        let row: JsonRow = sql_query(include_str!(
            "../queries/discord_runtime/set_discord_digest.sql"
        ))
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
        let row: JsonRow = sql_query(include_str!(
            "../queries/discord_runtime/set_discord_delivery.sql"
        ))
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
        Ok(sql_query(include_str!(
            "../queries/discord_runtime/discord_delivery.sql"
        ))
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
        let row: JsonRow = sql_query(include_str!(
            "../queries/discord_runtime/set_discord_tournament_message.sql"
        ))
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
        let mut matches = HashMap::<i64, (Value, BTreeSet<i32>)>::new();
        for (kind, target_ids) in targets {
            let mut normalized: HashSet<String> = target_ids
                .iter()
                .map(|target| target.trim().to_lowercase())
                .collect();
            if normalized.is_empty() {
                continue;
            }
            let mut alias_players = HashMap::<String, BTreeSet<i32>>::new();
            if kind == "player" {
                let player_ids = normalized
                    .iter()
                    .filter_map(|target| target.parse::<i32>().ok())
                    .filter(|id| *id > 0)
                    .collect::<Vec<_>>();
                for target in &normalized {
                    if let Ok(id) = target.parse::<i32>()
                        && id > 0
                    {
                        alias_players.entry(target.clone()).or_default().insert(id);
                    }
                }
                if !player_ids.is_empty() {
                    let aliases = sql_query(include_str!(
                        "../queries/discord_runtime/select_id_user.sql"
                    ))
                    .bind::<Array<Integer>, _>(&player_ids)
                    .load::<WatchAliasRow>(&mut connection)
                    .await?;
                    // Match watch creation's Unicode normalization regardless of database locale.
                    for row in aliases {
                        if let Some(alias) = row.value {
                            let alias = alias.trim().to_lowercase();
                            if !alias.is_empty() {
                                normalized.insert(alias.clone());
                                alias_players.entry(alias).or_default().insert(row.id_user);
                            }
                        }
                    }
                }
            }
            let normalized = normalized.into_iter().collect::<Vec<_>>();
            let rows: Vec<(i64, Value)> = sql_query(include_str!(
                "../queries/discord_runtime/select_id_discord_watch.sql"
            ))
            .bind::<Text, _>(kind)
            .bind::<Array<Text>, _>(&normalized)
            .load::<WatchJsonRow>(&mut connection)
            .await?
            .into_iter()
            .map(|row| (row.value, row.payload))
            .collect();
            for (id, payload) in rows {
                let players = payload["targetId"]
                    .as_str()
                    .and_then(|target| alias_players.get(target))
                    .cloned()
                    .unwrap_or_default();
                matches
                    .entry(id)
                    .or_insert_with(|| (payload, BTreeSet::new()))
                    .1
                    .extend(players);
            }
        }
        let mut ids: Vec<_> = matches.keys().copied().collect();
        ids.sort_unstable();
        ids.into_iter()
            .filter_map(|id| matches.remove(&id))
            .map(|(mut payload, players)| {
                payload["matchedPlayerIds"] = serde_json::to_value(players)?;
                Ok(payload)
            })
            .collect()
    }

    pub async fn update_discord_watch_delivery(
        &self,
        id: i64,
        paused: bool,
        last_error: Option<&str>,
        delivery_key: Option<&str>,
    ) -> Result<Option<Value>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(include_str!(
            "../queries/discord_runtime/update_discord_watch_delivery.sql"
        ))
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

#[derive(QueryableByName)]
struct WatchAliasRow {
    #[diesel(sql_type = Integer)]
    id_user: i32,
    #[diesel(sql_type = Nullable<Text>)]
    value: Option<String>,
}
