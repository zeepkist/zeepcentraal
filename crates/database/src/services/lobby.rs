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
const PRIVATE_ROOM_NAME: &str = "Private room";

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
            .transaction::<(), anyhow::Error, _>(async move |connection| {
                advisory_lock(connection, STATS_LOCK_KEY).await?;
                let previous: Option<Statistics> = sql_query(include_str!(
                    "../queries/lobby/select_players_lobby_stats.sql"
                ))
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
                sql_query(include_str!("../queries/lobby/insert_lobby_stats.sql"))
                    .bind::<Integer, _>(players)
                    .bind::<Integer, _>(rooms)
                    .bind::<Integer, _>(players_in_rooms)
                    .bind::<Text, _>(observed_at)
                    .execute(connection)
                    .await?;
                Ok(())
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
        let levels = lobby_level_values(&entries)?;
        let ids = serde_json::Value::Array(
            entries
                .iter()
                .map(|entry| serde_json::Value::String(entry.id.clone()))
                .collect(),
        );
        let mut connection = self.connection().await?;
        connection
            .transaction::<(), anyhow::Error, _>(async move |connection| {
                advisory_lock(connection, LOBBY_LOCK_KEY).await?;
                upsert_hosts(connection, &values, observed_at).await?;
                let existing: Vec<ExistingLobby> =
                    sql_query(include_str!("../queries/lobby/read_current_lobbies.sql"))
                        .bind::<Jsonb, _>(&ids)
                        .bind::<Bool, _>(authoritative)
                        .load(connection)
                        .await?;
                let upserted: Vec<LobbyId> = sql_query(include_str!(
                    "../queries/lobby/persist_active_lobbies_insert_lobby.sql"
                ))
                .bind::<Jsonb, _>(&values)
                .bind::<Text, _>(observed_at)
                .load(connection)
                .await?;

                sql_query(include_str!("../queries/lobby/upsert_lobby_levels.sql"))
                    .bind::<Jsonb, _>(&levels)
                    .execute(connection)
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
                    .filter(|row| {
                        authoritative && !row.closed && !current.contains(row.master_id.as_str())
                    })
                    .collect::<Vec<_>>();
                for row in &missing {
                    history.push(HistoryValue {
                        lobby_id: row.id,
                        host_id: row.host_id,
                        change_type: "closed",
                        room_name: if row.is_public {
                            &row.room_name
                        } else {
                            PRIVATE_ROOM_NAME
                        },
                        players: row.players,
                        player_limit: row.player_limit,
                        is_public: row.is_public,
                    });
                }
                insert_history(connection, &history, observed_at).await?;
                if !missing.is_empty() {
                    let missing_ids = missing.iter().map(|row| row.id).collect::<Vec<_>>();
                    sql_query(include_str!("../queries/lobby/set_closed_at_lobby.sql"))
                        .bind::<diesel::sql_types::Array<BigInt>, _>(missing_ids)
                        .bind::<Text, _>(observed_at)
                        .execute(connection)
                        .await?;
                }
                Ok(())
            })
            .await
    }

    async fn persist_closed_lobby(&self, entry: &WireLobby, observed_at: &str) -> Result<()> {
        let ids = serde_json::json!([entry.id]);
        let mut connection = self.connection().await?;
        connection
            .transaction::<(), anyhow::Error, _>(async move |connection| {
                advisory_lock(connection, LOBBY_LOCK_KEY).await?;
                let previous: Option<ExistingLobby> =
                    sql_query(include_str!("../queries/lobby/read_last_lobby.sql"))
                        .bind::<Jsonb, _>(&ids)
                        .get_result(connection)
                        .await
                        .optional()?;
                if let Some(row) = previous.filter(|row| !row.closed) {
                    insert_history(
                        connection,
                        &[HistoryValue {
                            lobby_id: row.id,
                            host_id: row.host_id,
                            change_type: "closed",
                            room_name: if row.is_public {
                                &row.room_name
                            } else {
                                PRIVATE_ROOM_NAME
                            },
                            players: row.players,
                            player_limit: row.player_limit,
                            is_public: row.is_public,
                        }],
                        observed_at,
                    )
                    .await?;
                    sql_query(include_str!("../queries/lobby/set_closed_at_lobby.sql"))
                        .bind::<diesel::sql_types::Array<BigInt>, _>(vec![row.id])
                        .bind::<Text, _>(observed_at)
                        .execute(connection)
                        .await?;
                }
                Ok(())
            })
            .await
    }

    pub async fn pending_lobby_workshop_scans(&self) -> Result<Vec<i64>> {
        #[derive(QueryableByName)]
        struct Pending {
            #[diesel(sql_type = BigInt)]
            workshop_id: i64,
        }
        let mut connection = self.connection().await?;
        let pending: Vec<Pending> = sql_query(include_str!(
            "../queries/lobby/pending_lobby_workshop_scans.sql"
        ))
        .load(&mut connection)
        .await?;
        Ok(pending
            .into_iter()
            .map(|pending| pending.workshop_id)
            .collect())
    }

    pub async fn mark_lobby_workshop_scan(&self, workshop_id: i64) -> Result<()> {
        let mut connection = self.connection().await?;
        sql_query(include_str!(
            "../queries/lobby/mark_lobby_workshop_scan.sql"
        ))
        .bind::<BigInt, _>(workshop_id)
        .execute(&mut connection)
        .await?;
        Ok(())
    }

    pub async fn resolve_lobby_workshop_levels(&self, workshop_id: i64) -> Result<()> {
        let mut connection = self.connection().await?;
        connection
            .transaction::<(), anyhow::Error, _>(async move |connection| {
                advisory_lock(connection, LOBBY_LOCK_KEY).await?;
                sql_query(include_str!(
                    "../queries/lobby/resolve_lobby_workshop_levels.sql"
                ))
                .bind::<BigInt, _>(workshop_id)
                .execute(connection)
                .await?;
                Ok(())
            })
            .await
    }
}

async fn advisory_lock(connection: &mut AsyncPgConnection, key: &str) -> Result<()> {
    sql_query(include_str!("../queries/lobby/advisory_lock.sql"))
        .bind::<Text, _>(key)
        .execute(connection)
        .await?;
    Ok(())
}

fn lobby_level_values(entries: &[WireLobby]) -> Result<serde_json::Value> {
    let values = entries.iter().map(|entry| {
        let has_level = entry.is_public && !entry.level_uid.is_empty();
        let workshop_id = has_level.then(|| i64::try_from(entry.level_workshop_id)).transpose()?;
        let author_id = (has_level && entry.level_author_steam_id > 1)
            .then(|| i64::try_from(entry.level_author_steam_id)).transpose()?;
        anyhow::ensure!(!entry.is_public || (entry.round_time.is_finite() && entry.round_time >= 0.0), "Invalid lobby round time");
        Ok(serde_json::json!({
            "master_id": entry.id,
            "level_uid": has_level.then_some(&entry.level_uid),
            "workshop_id": workshop_id,
            "level_name": (has_level && !entry.level_name.is_empty()).then_some(&entry.level_name),
            "level_author": (has_level && !entry.level_author.is_empty()).then_some(&entry.level_author),
            "author_id": author_id,
            "round_time": (entry.is_public && entry.round_time > 0.0).then_some(entry.round_time),
            "game_state": entry.is_public.then_some(entry.game_state),
        }))
    }).collect::<Result<Vec<_>>>()?;
    Ok(serde_json::Value::Array(values))
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
    sql_query(include_str!("../queries/lobby/upsert_hosts.sql"))
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
    sql_query(include_str!("../queries/lobby/insert_history.sql"))
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
            ..Default::default()
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
