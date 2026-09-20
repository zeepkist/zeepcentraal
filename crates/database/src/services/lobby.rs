use crate::Database;
use anyhow::{Context, Result};
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{BigInt, Bool, Integer, Jsonb, Text},
};
use diesel_async::{AsyncConnection, AsyncPgConnection, RunQueryDsl};
use serde::Serialize;
use std::collections::HashMap;
use zc_core::zeepnet::{LobbyOperation, LobbyPacket, WireLobby};

const STATS_LOCK_KEY: &str = "zeepcentraal:lobby:stats";
const LOBBY_LOCK_KEY: &str = "zeepcentraal:lobby:rooms";

#[derive(QueryableByName)]
struct ExistingLobby {
    #[diesel(sql_type = BigInt)]
    id: i64,
    #[diesel(sql_type = Text)]
    master_id: String,
    #[diesel(sql_type = Text)]
    room_name: String,
    #[diesel(sql_type = BigInt)]
    host_id: i64,
    #[diesel(sql_type = Integer)]
    players: i32,
    #[diesel(sql_type = Integer)]
    player_limit: i32,
    #[diesel(sql_type = Bool)]
    is_public: bool,
    #[diesel(sql_type = Bool)]
    closed: bool,
}

#[derive(QueryableByName)]
struct LobbyId {
    #[diesel(sql_type = BigInt)]
    id: i64,
    #[diesel(sql_type = Text)]
    master_id: String,
}

#[derive(QueryableByName)]
struct Statistics {
    #[diesel(sql_type = Integer)]
    players: i32,
    #[diesel(sql_type = Integer)]
    rooms: i32,
    #[diesel(sql_type = Integer)]
    players_in_rooms: i32,
}

#[derive(Serialize)]
struct LobbyValue<'a> {
    master_id: &'a str,
    room_name: &'a str,
    host_id: i64,
    host_name: &'a str,
    players: i32,
    player_limit: i32,
    is_public: bool,
}

#[derive(Serialize)]
struct HistoryValue<'a> {
    lobby_id: i64,
    host_id: i64,
    change_type: &'a str,
    room_name: &'a str,
    players: i32,
    player_limit: i32,
    is_public: bool,
}

impl Database {
    pub async fn persist_lobby_packet(
        &self,
        packet: &LobbyPacket,
        observed_at: &str,
    ) -> Result<()> {
        match packet {
            LobbyPacket::Statistics {
                online_players,
                lobby_count,
                players_in_lobbies,
            } => {
                self.persist_lobby_statistics(
                    (*online_players).try_into()?,
                    (*lobby_count).try_into()?,
                    (*players_in_lobbies).try_into()?,
                    observed_at,
                )
                .await
            }
            LobbyPacket::List(entries) => {
                self.persist_active_lobbies(entries, observed_at, true)
                    .await
            }
            LobbyPacket::Update {
                operation: LobbyOperation::Removed,
                lobby,
            } => self.persist_closed_lobby(lobby, observed_at).await,
            LobbyPacket::Update { lobby, .. } => {
                self.persist_active_lobbies(std::slice::from_ref(lobby), observed_at, false)
                    .await
            }
        }
    }

    async fn persist_lobby_statistics(
        &self,
        players: i32,
        rooms: i32,
        players_in_rooms: i32,
        observed_at: &str,
    ) -> Result<()> {
        let mut connection = self.connection().await?;
        connection
            .transaction::<(), anyhow::Error, _>(|connection| {
                Box::pin(async move {
                    advisory_lock(connection, STATS_LOCK_KEY).await?;
                    let previous: Option<Statistics> = sql_query(
                        "SELECT players,rooms,players_in_rooms FROM public.lobby_stats ORDER BY id DESC LIMIT 1",
                    )
                    .get_result(connection)
                    .await
                    .optional()?;
                    if previous.as_ref().is_some_and(|value| {
                        value.players == players
                            && value.rooms == rooms
                            && value.players_in_rooms == players_in_rooms
                    }) {
                        return Ok(());
                    }
                    sql_query(
                        "INSERT INTO public.lobby_stats(players,rooms,players_in_rooms,date_created,date_updated) VALUES($1,$2,$3,$4::timestamptz,$4::timestamptz)",
                    )
                    .bind::<Integer, _>(players)
                    .bind::<Integer, _>(rooms)
                    .bind::<Integer, _>(players_in_rooms)
                    .bind::<Text, _>(observed_at)
                    .execute(connection)
                    .await?;
                    Ok(())
                })
            })
            .await
    }

    async fn persist_active_lobbies(
        &self,
        entries: &[WireLobby],
        observed_at: &str,
        authoritative: bool,
    ) -> Result<()> {
        let entries = entries
            .iter()
            .cloned()
            .map(|entry| (entry.id.clone(), entry))
            .collect::<HashMap<_, _>>()
            .into_values()
            .collect::<Vec<_>>();
        let values = lobby_values(&entries)?;
        let ids = serde_json::Value::Array(
            entries
                .iter()
                .map(|entry| serde_json::Value::String(entry.id.clone()))
                .collect(),
        );
        let mut connection = self.connection().await?;
        connection
            .transaction::<(), anyhow::Error, _>(|connection| {
                Box::pin(async move {
                    advisory_lock(connection, LOBBY_LOCK_KEY).await?;
                    upsert_hosts(connection, &values, observed_at).await?;
                    let existing: Vec<ExistingLobby> = sql_query(
                        "SELECT id,master_id,room_name,host_id,players,player_limit,is_public,closed_at IS NOT NULL AS closed \
                         FROM public.lobby WHERE CASE WHEN $2 THEN master_id IN (SELECT jsonb_array_elements_text($1)) OR closed_at IS NULL \
                         ELSE master_id IN (SELECT jsonb_array_elements_text($1)) END",
                    )
                    .bind::<Jsonb, _>(&ids)
                    .bind::<Bool, _>(authoritative)
                    .load(connection)
                    .await?;
                    let upserted: Vec<LobbyId> = sql_query(
                        "INSERT INTO public.lobby(master_id,room_name,host_id,players,player_limit,is_public,peak_players,peak_time,first_seen,last_seen,closed_at,date_created,date_updated) \
                         SELECT value.master_id,value.room_name,value.host_id,value.players,value.player_limit,value.is_public,value.players,$2::timestamptz,$2::timestamptz,$2::timestamptz,NULL,$2::timestamptz,$2::timestamptz \
                         FROM jsonb_to_recordset($1) AS value(master_id text,room_name text,host_id bigint,host_name text,players integer,player_limit integer,is_public boolean) \
                         ON CONFLICT(master_id) DO UPDATE SET room_name=excluded.room_name,host_id=excluded.host_id,players=excluded.players,player_limit=excluded.player_limit,is_public=excluded.is_public, \
                         peak_players=CASE WHEN excluded.players>lobby.peak_players THEN excluded.players ELSE lobby.peak_players END, \
                         peak_time=CASE WHEN excluded.players>lobby.peak_players THEN excluded.last_seen ELSE lobby.peak_time END, \
                         last_seen=excluded.last_seen,closed_at=NULL,date_updated=excluded.date_updated RETURNING id,master_id",
                    )
                    .bind::<Jsonb, _>(&values)
                    .bind::<Text, _>(observed_at)
                    .load(connection)
                    .await?;

                    let existing_by_id = existing
                        .iter()
                        .map(|row| (row.master_id.as_str(), row))
                        .collect::<HashMap<_, _>>();
                    let id_by_master = upserted
                        .iter()
                        .map(|row| (row.master_id.as_str(), row.id))
                        .collect::<HashMap<_, _>>();
                    let mut history = Vec::new();
                    for entry in &entries {
                        let previous = existing_by_id.get(entry.id.as_str()).copied();
                        let change_type = match previous {
                            None => Some("opened"),
                            Some(value) if value.closed => Some("reopened"),
                            Some(value) if materially_changed(value, entry)? => Some("updated"),
                            _ => None,
                        };
                        if let (Some(change_type), Some(lobby_id)) =
                            (change_type, id_by_master.get(entry.id.as_str()).copied())
                        {
                            history.push(history_value(lobby_id, entry, change_type)?);
                        }
                    }

                    let current = entries
                        .iter()
                        .map(|entry| entry.id.as_str())
                        .collect::<std::collections::HashSet<_>>();
                    let missing = existing
                        .iter()
                        .filter(|row| authoritative && !row.closed && !current.contains(row.master_id.as_str()))
                        .collect::<Vec<_>>();
                    for row in &missing {
                        history.push(HistoryValue {
                            lobby_id: row.id,
                            host_id: row.host_id,
                            change_type: "closed",
                            room_name: &row.room_name,
                            players: row.players,
                            player_limit: row.player_limit,
                            is_public: row.is_public,
                        });
                    }
                    insert_history(connection, &history, observed_at).await?;
                    if !missing.is_empty() {
                        let missing_ids = missing.iter().map(|row| row.id).collect::<Vec<_>>();
                        sql_query("UPDATE public.lobby SET closed_at=$2::timestamptz,date_updated=$2::timestamptz WHERE id=ANY($1)")
                            .bind::<diesel::sql_types::Array<BigInt>, _>(missing_ids)
                            .bind::<Text, _>(observed_at)
                            .execute(connection)
                            .await?;
                    }
                    Ok(())
                })
            })
            .await
    }

    async fn persist_closed_lobby(&self, entry: &WireLobby, observed_at: &str) -> Result<()> {
        let values = lobby_values(std::slice::from_ref(entry))?;
        let ids = serde_json::json!([entry.id]);
        let mut connection = self.connection().await?;
        connection
            .transaction::<(), anyhow::Error, _>(|connection| {
                Box::pin(async move {
                    advisory_lock(connection, LOBBY_LOCK_KEY).await?;
                    upsert_hosts(connection, &values, observed_at).await?;
                    let previous: Option<ExistingLobby> = sql_query(
                        "SELECT id,master_id,room_name,host_id,players,player_limit,is_public,closed_at IS NOT NULL AS closed FROM public.lobby WHERE master_id IN (SELECT jsonb_array_elements_text($1)) LIMIT 1",
                    )
                    .bind::<Jsonb, _>(&ids)
                    .get_result(connection)
                    .await
                    .optional()?;
                    let row: LobbyId = sql_query(
                        "INSERT INTO public.lobby(master_id,room_name,host_id,players,player_limit,is_public,peak_players,peak_time,first_seen,last_seen,closed_at,date_created,date_updated) \
                         SELECT value.master_id,value.room_name,value.host_id,value.players,value.player_limit,value.is_public,value.players,$2::timestamptz,$2::timestamptz,$2::timestamptz,$2::timestamptz,$2::timestamptz,$2::timestamptz \
                         FROM jsonb_to_recordset($1) AS value(master_id text,room_name text,host_id bigint,host_name text,players integer,player_limit integer,is_public boolean) \
                         ON CONFLICT(master_id) DO UPDATE SET room_name=excluded.room_name,host_id=excluded.host_id,players=excluded.players,player_limit=excluded.player_limit,is_public=excluded.is_public, \
                         peak_players=CASE WHEN excluded.players>lobby.peak_players THEN excluded.players ELSE lobby.peak_players END, \
                         peak_time=CASE WHEN excluded.players>lobby.peak_players THEN excluded.last_seen ELSE lobby.peak_time END, \
                         last_seen=excluded.last_seen,closed_at=excluded.closed_at,date_updated=excluded.date_updated RETURNING id,master_id",
                    )
                    .bind::<Jsonb, _>(&values)
                    .bind::<Text, _>(observed_at)
                    .get_result(connection)
                    .await?;
                    if previous.as_ref().is_none_or(|value| !value.closed) {
                        insert_history(connection, &[history_value(row.id, entry, "closed")?], observed_at).await?;
                    }
                    Ok(())
                })
            })
            .await
    }
}

async fn advisory_lock(connection: &mut AsyncPgConnection, key: &str) -> Result<()> {
    sql_query("SELECT pg_advisory_xact_lock(hashtext($1))")
        .bind::<Text, _>(key)
        .execute(connection)
        .await?;
    Ok(())
}

fn lobby_values(entries: &[WireLobby]) -> Result<serde_json::Value> {
    Ok(serde_json::to_value(
        entries
            .iter()
            .map(|entry| {
                Ok(LobbyValue {
                    master_id: &entry.id,
                    room_name: &entry.title,
                    host_id: entry
                        .host_steam_id
                        .try_into()
                        .context("Lobby host Steam ID exceeds PostgreSQL bigint")?,
                    host_name: &entry.host_name,
                    players: entry
                        .players
                        .try_into()
                        .context("Lobby player count exceeds PostgreSQL integer")?,
                    player_limit: entry
                        .player_limit
                        .try_into()
                        .context("Lobby player limit exceeds PostgreSQL integer")?,
                    is_public: entry.is_public,
                })
            })
            .collect::<Result<Vec<_>>>()?,
    )?)
}

async fn upsert_hosts(
    connection: &mut AsyncPgConnection,
    values: &serde_json::Value,
    observed_at: &str,
) -> Result<()> {
    sql_query(
        "INSERT INTO public.\"user\"(steam_id,steam_name,banned,date_created,date_updated) \
         SELECT DISTINCT ON (value.host_id) value.host_id,left(value.host_name,255),false,$2::timestamptz,$2::timestamptz \
         FROM jsonb_to_recordset($1) AS value(host_id bigint,host_name text) ORDER BY value.host_id \
         ON CONFLICT(steam_id) DO UPDATE SET steam_name=excluded.steam_name,date_updated=excluded.date_updated \
         WHERE \"user\".steam_name IS DISTINCT FROM excluded.steam_name",
    )
    .bind::<Jsonb, _>(values)
    .bind::<Text, _>(observed_at)
    .execute(connection)
    .await?;
    Ok(())
}

fn materially_changed(previous: &ExistingLobby, entry: &WireLobby) -> Result<bool> {
    Ok(previous.room_name != entry.title
        || previous.host_id != i64::try_from(entry.host_steam_id)?
        || previous.players != i32::try_from(entry.players)?
        || previous.player_limit != i32::try_from(entry.player_limit)?
        || previous.is_public != entry.is_public)
}

fn history_value<'a>(
    lobby_id: i64,
    entry: &'a WireLobby,
    change_type: &'a str,
) -> Result<HistoryValue<'a>> {
    Ok(HistoryValue {
        lobby_id,
        host_id: entry.host_steam_id.try_into()?,
        change_type,
        room_name: &entry.title,
        players: entry.players.try_into()?,
        player_limit: entry.player_limit.try_into()?,
        is_public: entry.is_public,
    })
}

async fn insert_history(
    connection: &mut AsyncPgConnection,
    history: &[HistoryValue<'_>],
    observed_at: &str,
) -> Result<()> {
    if history.is_empty() {
        return Ok(());
    }
    sql_query(
        "INSERT INTO public.lobby_history(lobby_id,host_id,change_type,room_name,players,player_limit,is_public,observed_at,date_created) \
         SELECT value.lobby_id,value.host_id,value.change_type,value.room_name,value.players,value.player_limit,value.is_public,$2::timestamptz,$2::timestamptz \
         FROM jsonb_to_recordset($1) AS value(lobby_id bigint,host_id bigint,change_type text,room_name text,players integer,player_limit integer,is_public boolean)",
    )
    .bind::<Jsonb, _>(serde_json::to_value(history)?)
    .bind::<Text, _>(observed_at)
    .execute(connection)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lobby() -> WireLobby {
        WireLobby {
            id: "room-1".into(),
            title: "Room".into(),
            host_name: "Host".into(),
            host_steam_id: 76_561_198_000_000_000,
            players: 2,
            player_limit: 12,
            is_public: true,
        }
    }

    #[test]
    fn persistence_json_uses_postgresql_column_names() {
        let value = lobby_values(&[lobby()]).unwrap();
        assert_eq!(value[0]["master_id"], "room-1");
        assert_eq!(value[0]["host_id"], 76_561_198_000_000_000_i64);
        assert!(value[0].get("masterId").is_none());
    }

    #[test]
    fn material_change_matches_drizzle_fields() {
        let entry = lobby();
        let previous = ExistingLobby {
            id: 1,
            master_id: entry.id.clone(),
            room_name: entry.title.clone(),
            host_id: entry.host_steam_id as i64,
            players: entry.players as i32,
            player_limit: entry.player_limit as i32,
            is_public: entry.is_public,
            closed: false,
        };
        assert!(!materially_changed(&previous, &entry).unwrap());
        let changed = WireLobby {
            players: 3,
            ..entry
        };
        assert!(materially_changed(&previous, &changed).unwrap());
    }
}
