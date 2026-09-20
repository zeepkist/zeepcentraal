use crate::AppState;
use axum::{
    extract::State,
    http::{HeaderMap, HeaderValue, header},
    response::{
        IntoResponse, Json, Sse,
        sse::{Event, KeepAlive},
    },
};
use serde::{Deserialize, Serialize};
use std::{sync::Arc, time::Duration};
use tokio::sync::watch;
use tokio_stream::{StreamExt, wrappers::WatchStream};
use utoipa::ToSchema;

#[derive(Clone, Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LobbySnapshot {
    pub status: LobbyStatus,
    pub updated_at: Option<String>,
    pub stale_since: Option<String>,
    pub stats: LobbyStats,
    pub lobbies: Vec<Lobby>,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum LobbyStatus {
    Connecting,
    Live,
    Stale,
    Unavailable,
}

#[derive(Clone, Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LobbyStats {
    pub online_players: Option<u64>,
    pub lobby_count: Option<u64>,
    pub players_in_lobbies: Option<u64>,
}

#[derive(Clone, Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Lobby {
    pub title: String,
    pub is_public: bool,
    pub host: LobbyHost,
    pub players: u32,
    pub player_limit: u32,
}

#[derive(Clone, Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LobbyHost {
    pub name: String,
    pub steam_id: String,
}

#[derive(Clone)]
pub struct LobbySnapshotStore {
    sender: watch::Sender<Arc<LobbySnapshot>>,
}

impl Default for LobbySnapshotStore {
    fn default() -> Self {
        let (sender, _) = watch::channel(Arc::new(LobbySnapshot {
            status: LobbyStatus::Unavailable,
            updated_at: None,
            stale_since: None,
            stats: LobbyStats {
                online_players: None,
                lobby_count: None,
                players_in_lobbies: None,
            },
            lobbies: Vec::new(),
        }));
        Self { sender }
    }
}

impl LobbySnapshotStore {
    pub fn get(&self) -> Arc<LobbySnapshot> {
        self.sender.borrow().clone()
    }
    pub fn set(&self, snapshot: LobbySnapshot) {
        self.sender.send_replace(Arc::new(snapshot));
    }
    fn subscribe(&self) -> watch::Receiver<Arc<LobbySnapshot>> {
        self.sender.subscribe()
    }
}

#[utoipa::path(get, path = "/lobby", responses((status = 200, body = LobbySnapshot)))]
pub async fn snapshot(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let mut headers = HeaderMap::new();
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    (headers, Json((*state.lobby.get()).clone()))
}

#[utoipa::path(get, path = "/lobby/events", responses((status = 200, content_type = "text/event-stream")))]
pub async fn events(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let stream = WatchStream::new(state.lobby.subscribe())
        .map(|snapshot| Event::default().event("snapshot").json_data(&*snapshot));
    let mut headers = HeaderMap::new();
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    headers.insert(header::CONNECTION, HeaderValue::from_static("keep-alive"));
    (
        headers,
        Sse::new(stream).keep_alive(
            KeepAlive::new()
                .interval(Duration::from_secs(15))
                .text("heartbeat"),
        ),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unavailable_snapshot_matches_wire_contract() {
        let snapshot = LobbySnapshotStore::default().get();
        let value = serde_json::to_value(&*snapshot).unwrap();
        assert_eq!(
            value,
            serde_json::json!({
                "status":"unavailable", "updatedAt":null, "staleSince":null,
                "stats":{"onlinePlayers":null,"lobbyCount":null,"playersInLobbies":null}, "lobbies":[]
            })
        );
    }
}
