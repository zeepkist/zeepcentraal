use crate::{
    config::{LobbyRuntimeConfig, RoomBrokerConfig},
    lobby::{Lobby, LobbyHost, LobbySnapshot, LobbySnapshotStore, LobbyStats, LobbyStatus},
};
use anyhow::{Context, Result, bail, ensure};
use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, State, rejection::JsonRejection},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
    routing::post,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, Instant},
};
use subtle::ConstantTimeEq;
use tokio::sync::{mpsc, oneshot, watch};
use zc_core::zeepnet::{
    BitReader, LidgrenClient, LidgrenClientOptions, LobbyOperation, LobbyPacket,
    MasterRoomResponse, WireLobby, create_lobby_packet, join_lobby_packet, master_hail,
    parse_lobby_packet, parse_master_room_response,
};

const ROOM_TIMEOUT: Duration = Duration::from_secs(15);
const FIRST_SNAPSHOT_TIMEOUT: Duration = Duration::from_secs(15);
const RETRY_MAX: Duration = Duration::from_secs(60);
const MIN_TICKET_INTERVAL: Duration = Duration::from_secs(60);
const TICKET_USER_DATA: u32 = 21_572;

#[derive(Clone)]
pub struct RoomBroker {
    sender: mpsc::Sender<AssignmentCommand>,
}

pub struct LobbyRuntime {
    shutdown: watch::Sender<bool>,
    tasks: Vec<tokio::task::JoinHandle<()>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AssignmentRequest {
    key: String,
    join_id: Option<String>,
    room: RoomRequest,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RoomRequest {
    name: String,
    is_public: bool,
    max_players: i32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RoomAssignment {
    host: String,
    join_id: String,
    key: String,
    player_uid: u32,
    port: u16,
    room_created: bool,
    steam_id: String,
    token: String,
}

struct AssignmentCommand {
    request: AssignmentRequest,
    response: oneshot::Sender<Result<RoomAssignment>>,
}

#[derive(Clone)]
struct BrokerState {
    broker: RoomBroker,
    token: Arc<str>,
}

#[derive(Default)]
struct LobbyState {
    lobbies: HashMap<String, WireLobby>,
    stats: LobbyStats,
}

impl LobbyRuntime {
    pub async fn start(
        config: LobbyRuntimeConfig,
        store: LobbySnapshotStore,
        database: zc_database::Database,
    ) -> Result<Self> {
        let (shutdown, shutdown_rx) = watch::channel(false);
        if !config.enabled {
            return Ok(Self {
                shutdown,
                tasks: Vec::new(),
            });
        }
        let broker_listener = if let Some(broker_config) = config.broker.clone() {
            Some((
                tokio::net::TcpListener::bind(broker_config.address)
                    .await
                    .context("bind Zeepkist room broker")?,
                broker_config,
            ))
        } else {
            None
        };
        let (sender, receiver) = mpsc::channel(16);
        let (persistence, persistence_rx) = mpsc::unbounded_channel();
        let broker = RoomBroker { sender };
        let mut tasks = vec![
            tokio::spawn(run_collector(
                config.clone(),
                store,
                receiver,
                persistence,
                shutdown_rx.clone(),
            )),
            tokio::spawn(run_persistence(database, persistence_rx)),
        ];
        if let Some((listener, broker_config)) = broker_listener {
            tasks.push(tokio::spawn(async move {
                if let Err(error) = run_broker(listener, broker_config, broker, shutdown_rx).await {
                    tracing::error!(%error, "Zeepkist room broker stopped");
                }
            }));
        }
        Ok(Self { shutdown, tasks })
    }

    pub async fn stop(self) {
        self.shutdown.send_replace(true);
        for task in self.tasks {
            let _ = task.await;
        }
    }
}

async fn run_broker(
    listener: tokio::net::TcpListener,
    config: RoomBrokerConfig,
    broker: RoomBroker,
    mut shutdown: watch::Receiver<bool>,
) -> Result<()> {
    tracing::info!(address = %listener.local_addr()?, "Zeepkist room broker ready");
    let state = BrokerState {
        broker,
        token: config.token,
    };
    let app = Router::new()
        .route("/v1/rooms/assignment", post(assign_room))
        .fallback(not_found)
        .layer(DefaultBodyLimit::max(16 * 1024))
        .with_state(state);
    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            while !*shutdown.borrow() && shutdown.changed().await.is_ok() {}
        })
        .await?;
    Ok(())
}

async fn assign_room(
    State(state): State<BrokerState>,
    headers: HeaderMap,
    body: Result<Json<AssignmentRequest>, JsonRejection>,
) -> Response {
    if !authorized(&headers, &state.token) {
        return broker_response(StatusCode::UNAUTHORIZED, "Unauthorized");
    }
    let Ok(Json(request)) = body else {
        return broker_response(StatusCode::BAD_REQUEST, "Invalid request");
    };
    if !valid_assignment(&request) {
        return broker_response(StatusCode::BAD_REQUEST, "Invalid request");
    }
    let (response_tx, response_rx) = oneshot::channel();
    if state
        .broker
        .sender
        .send(AssignmentCommand {
            request,
            response: response_tx,
        })
        .await
        .is_err()
    {
        return broker_response(
            StatusCode::SERVICE_UNAVAILABLE,
            "Room assignment unavailable",
        );
    }
    match tokio::time::timeout(ROOM_TIMEOUT, response_rx).await {
        Ok(Ok(Ok(assignment))) => no_store((StatusCode::OK, Json(assignment)).into_response()),
        _ => broker_response(
            StatusCode::SERVICE_UNAVAILABLE,
            "Room assignment unavailable",
        ),
    }
}

async fn not_found() -> Response {
    broker_response(StatusCode::NOT_FOUND, "Not found")
}

fn broker_response(status: StatusCode, error: &'static str) -> Response {
    no_store((status, Json(serde_json::json!({ "error": error }))).into_response())
}

fn no_store(mut response: Response) -> Response {
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response
}

fn authorized(headers: &HeaderMap, token: &str) -> bool {
    let Some(value) = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
    else {
        return false;
    };
    let expected = format!("Bearer {token}");
    value.len() == expected.len() && value.as_bytes().ct_eq(expected.as_bytes()).into()
}

fn valid_assignment(request: &AssignmentRequest) -> bool {
    let key = request.key.as_bytes();
    let key_valid = (1..=64).contains(&key.len())
        && key.iter().all(|byte| {
            byte.is_ascii_lowercase() || byte.is_ascii_digit() || matches!(byte, b'_' | b'-')
        })
        && key.first().is_some_and(u8::is_ascii_alphanumeric)
        && key.last().is_some_and(u8::is_ascii_alphanumeric);
    key_valid
        && request
            .join_id
            .as_ref()
            .is_none_or(|value| (1..=1_024).contains(&value.len()))
        && (1..=256).contains(&request.room.name.trim().len())
        && (2..=64).contains(&request.room.max_players)
}

async fn run_collector(
    config: LobbyRuntimeConfig,
    store: LobbySnapshotStore,
    mut requests: mpsc::Receiver<AssignmentCommand>,
    persistence: mpsc::UnboundedSender<(LobbyPacket, String)>,
    mut shutdown: watch::Receiver<bool>,
) {
    let mut retry = Duration::from_secs(1);
    while !*shutdown.borrow() {
        store.set(empty_snapshot(LobbyStatus::Connecting));
        let result =
            run_steam_session(&config, &store, &mut requests, &persistence, &mut shutdown).await;
        if *shutdown.borrow() {
            break;
        }
        if let Err(error) = result {
            tracing::warn!(%error, "Zeepkist lobby collector disconnected");
        }
        mark_stale(&store);
        tokio::select! {
            _ = tokio::time::sleep(retry) => {},
            _ = shutdown.changed() => break,
        }
        retry = (retry * 2).min(RETRY_MAX);
    }
}

async fn run_steam_session(
    config: &LobbyRuntimeConfig,
    store: &LobbySnapshotStore,
    requests: &mut mpsc::Receiver<AssignmentCommand>,
    persistence: &mpsc::UnboundedSender<(LobbyPacket, String)>,
    shutdown: &mut watch::Receiver<bool>,
) -> Result<()> {
    let refresh_token = tokio::fs::read_to_string(&config.refresh_token_file)
        .await
        .context("read Zeepkist Steam refresh token")?;
    ensure!(
        !refresh_token.trim().is_empty(),
        "Steam refresh token file is empty"
    );
    let steam_options = steam_client::SteamOptions {
        renew_refresh_tokens: true,
        enable_pics_cache: false,
        ..Default::default()
    };
    let mut steam = steam_client::SteamClient::new(steam_options);
    let details = steam_client::LogOnDetails {
        refresh_token: Some(refresh_token.trim().to_owned()),
        machine_name: Some("ZeepCentraal Rust lobby collector".into()),
        ..Default::default()
    };
    let response = tokio::select! {
        response = steam.log_on(details) => response?,
        _ = shutdown.changed() => return Ok(()),
    };
    let steam_id = response.steam_id.steam_id64();
    let identity_name = account_name(&mut steam, &config.refresh_token_file, shutdown).await?;
    let mut cached_ticket: Option<(Instant, Vec<u8>)> = None;
    loop {
        let ticket = if let Some((created, ticket)) = &cached_ticket
            && created.elapsed() < MIN_TICKET_INTERVAL
        {
            ticket.clone()
        } else {
            let ticket = steam
                .create_encrypted_app_ticket(config.app_id, Some(&TICKET_USER_DATA.to_le_bytes()))
                .await?;
            ensure!(
                !ticket.is_empty(),
                "Steam returned an empty encrypted app ticket"
            );
            cached_ticket = Some((Instant::now(), ticket.clone()));
            ticket
        };
        run_master(
            config,
            store,
            requests,
            persistence,
            shutdown,
            &mut steam,
            steam_id,
            &identity_name,
            &ticket,
        )
        .await?;
        if *shutdown.borrow() {
            break;
        }
    }
    let _ = steam.log_off().await;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
async fn run_master(
    config: &LobbyRuntimeConfig,
    store: &LobbySnapshotStore,
    requests: &mut mpsc::Receiver<AssignmentCommand>,
    persistence: &mpsc::UnboundedSender<(LobbyPacket, String)>,
    shutdown: &mut watch::Receiver<bool>,
    steam: &mut steam_client::SteamClient,
    steam_id: u64,
    identity_name: &str,
    ticket: &[u8],
) -> Result<()> {
    let remote = config.master.context("Missing Zeepkist master address")?;
    let hail = master_hail(
        config.build.context("Missing Zeepkist build")?,
        steam_id,
        identity_name,
        ticket,
    )?;
    let client = LidgrenClient::start(LidgrenClientOptions::load_balancer(remote, hail)).await?;
    let remote_hail = tokio::time::timeout(ROOM_TIMEOUT, client.connect()).await??;
    let mut hail_reader = BitReader::new(&remote_hail);
    let player_uid = hail_reader.read_u32()?;
    let token = hail_reader.read_string(4_096)?;
    let mut state = LobbyState::default();
    let first_snapshot = tokio::time::sleep(FIRST_SNAPSHOT_TIMEOUT);
    tokio::pin!(first_snapshot);
    let mut received_snapshot = false;
    tracing::info!(%remote, "Zeepkist lobby collector connected");
    loop {
        tokio::select! {
            payload = client.recv() => {
                let Some(payload) = payload else { bail!("Master connection closed") };
                received_snapshot |= apply_payload(&payload, &mut state, store, persistence)?;
            }
            command = requests.recv() => {
                let Some(command) = command else { return Ok(()) };
                let result = assign_on_master(
                    &client, &mut state, store, persistence, command.request, player_uid, steam_id, &token, identity_name,
                ).await;
                let handed_off = result.is_ok();
                let _ = command.response.send(result);
                if handed_off {
                    let _ = client.close("Room assignment handed off").await;
                    return Ok(());
                }
            }
            _ = shutdown.changed() => {
                let _ = client.close("Server shutdown").await;
                return Ok(());
            }
            event = steam.poll_event() => {
                let Some(event) = event? else {
                    let _ = client.close("Steam session closed").await;
                    bail!("Steam session closed");
                };
                persist_refresh_token(event, &config.refresh_token_file).await?;
            }
            _ = &mut first_snapshot, if !received_snapshot => {
                let _ = client.close("Lobby snapshot timed out").await;
                bail!("Master server did not send an initial lobby snapshot");
            }
        }
    }
}

#[allow(clippy::too_many_arguments)]
async fn assign_on_master(
    client: &LidgrenClient,
    state: &mut LobbyState,
    store: &LobbySnapshotStore,
    persistence: &mpsc::UnboundedSender<(LobbyPacket, String)>,
    request: AssignmentRequest,
    player_uid: u32,
    steam_id: u64,
    token: &str,
    identity_name: &str,
) -> Result<RoomAssignment> {
    if let Some(join_id) = request.join_id.as_deref() {
        client
            .send_reliable_ordered(join_lobby_packet(join_id)?, 0)
            .await?;
        let MasterRoomResponse::Join { result, host, port } =
            wait_room_response(client, state, store, persistence, false).await?
        else {
            bail!("Unexpected master response")
        };
        if result == 1 {
            return assignment(
                request.key,
                join_id.to_owned(),
                host,
                port,
                false,
                player_uid,
                steam_id,
                token,
            );
        }
        ensure!(result == 4, "Stored room join rejected");
    }
    let room_name = sanitize_lobby_text(&request.room.name, "ZeepCentraal");
    let host_name = sanitize_lobby_text(identity_name, "ZeepCentraal");
    client
        .send_reliable_ordered(
            create_lobby_packet(
                request.room.max_players,
                &room_name,
                request.room.is_public,
                &host_name,
            )?,
            0,
        )
        .await?;
    let MasterRoomResponse::Create { result, join_id } =
        wait_room_response(client, state, store, persistence, true).await?
    else {
        bail!("Unexpected master response")
    };
    ensure!(result == 1 && !join_id.is_empty(), "Room create rejected");
    let MasterRoomResponse::Join { result, host, port } =
        wait_room_response(client, state, store, persistence, false).await?
    else {
        bail!("Unexpected master response")
    };
    ensure!(result == 1, "Created room join rejected");
    assignment(
        request.key,
        join_id,
        host,
        port,
        true,
        player_uid,
        steam_id,
        token,
    )
}

#[allow(clippy::too_many_arguments)]
fn assignment(
    key: String,
    join_id: String,
    host: String,
    port: i32,
    room_created: bool,
    player_uid: u32,
    steam_id: u64,
    token: &str,
) -> Result<RoomAssignment> {
    Ok(RoomAssignment {
        host,
        join_id,
        key,
        player_uid,
        port: port
            .try_into()
            .context("Master returned invalid room port")?,
        room_created,
        steam_id: steam_id.to_string(),
        token: token.to_owned(),
    })
}

async fn wait_room_response(
    client: &LidgrenClient,
    state: &mut LobbyState,
    store: &LobbySnapshotStore,
    persistence: &mpsc::UnboundedSender<(LobbyPacket, String)>,
    create: bool,
) -> Result<MasterRoomResponse> {
    tokio::time::timeout(ROOM_TIMEOUT, async {
        loop {
            let payload = client.recv().await.context("Master connection closed")?;
            if let Some(response) = parse_master_room_response(&payload)?
                && matches!(
                    (&response, create),
                    (MasterRoomResponse::Create { .. }, true)
                        | (MasterRoomResponse::Join { .. }, false)
                )
            {
                return Ok(response);
            }
            apply_payload(&payload, state, store, persistence)?;
        }
    })
    .await
    .context("Master room response timed out")?
}

fn apply_payload(
    payload: &[u8],
    state: &mut LobbyState,
    store: &LobbySnapshotStore,
    persistence: &mpsc::UnboundedSender<(LobbyPacket, String)>,
) -> Result<bool> {
    let Some(packet) = parse_lobby_packet(payload)? else {
        return Ok(false);
    };
    let observed_at = jiff::Timestamp::now().to_string();
    state.apply(packet.clone());
    store.set(state.snapshot(&observed_at));
    let _ = persistence.send((packet, observed_at));
    Ok(true)
}

async fn account_name(
    steam: &mut steam_client::SteamClient,
    refresh_token_file: &std::path::Path,
    shutdown: &mut watch::Receiver<bool>,
) -> Result<String> {
    let wait = async {
        loop {
            if let Some(info) = steam.account_info()
                && !info.name.trim().is_empty()
            {
                return Ok(info.name);
            }
            let Some(event) = steam.poll_event().await? else {
                bail!("Steam session closed before account information arrived");
            };
            persist_refresh_token(event, refresh_token_file).await?;
        }
    };
    tokio::select! {
        name = tokio::time::timeout(ROOM_TIMEOUT, wait) =>
            name.context("Steam account information timed out")?,
        _ = shutdown.changed() => bail!("Server shutdown"),
    }
}

async fn persist_refresh_token(
    event: steam_client::SteamEvent,
    refresh_token_file: &std::path::Path,
) -> Result<()> {
    let steam_client::SteamEvent::Auth(steam_client::AuthEvent::RefreshToken { token, .. }) = event
    else {
        return Ok(());
    };
    let parent = refresh_token_file
        .parent()
        .context("Steam refresh token file has no parent directory")?;
    let temporary = parent.join(format!(".steam-refresh-token.{}.tmp", std::process::id()));
    tokio::fs::write(&temporary, format!("{token}\n"))
        .await
        .context("write renewed Steam refresh token")?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        tokio::fs::set_permissions(&temporary, std::fs::Permissions::from_mode(0o600)).await?;
    }
    tokio::fs::rename(&temporary, refresh_token_file)
        .await
        .context("replace Steam refresh token")?;
    Ok(())
}

async fn run_persistence(
    database: zc_database::Database,
    mut packets: mpsc::UnboundedReceiver<(LobbyPacket, String)>,
) {
    while let Some((packet, observed_at)) = packets.recv().await {
        if let Err(error) = database.persist_lobby_packet(&packet, &observed_at).await {
            tracing::warn!(%error, "Zeepkist lobby persistence failed; live feed continuing");
        }
    }
}

impl LobbyState {
    fn apply(&mut self, packet: LobbyPacket) {
        match packet {
            LobbyPacket::List(lobbies) => {
                self.lobbies = lobbies
                    .into_iter()
                    .map(|lobby| (lobby.id.clone(), lobby))
                    .collect()
            }
            LobbyPacket::Update {
                operation: LobbyOperation::Removed,
                lobby,
            } => {
                self.lobbies.remove(&lobby.id);
            }
            LobbyPacket::Update { lobby, .. } => {
                self.lobbies.insert(lobby.id.clone(), lobby);
            }
            LobbyPacket::Statistics {
                online_players,
                lobby_count,
                players_in_lobbies,
            } => {
                self.stats = LobbyStats {
                    online_players: Some(online_players.into()),
                    lobby_count: Some(lobby_count.into()),
                    players_in_lobbies: Some(players_in_lobbies.into()),
                };
            }
        }
    }

    fn snapshot(&self, observed_at: &str) -> LobbySnapshot {
        let mut lobbies = self
            .lobbies
            .values()
            .filter(|lobby| lobby.players > 0)
            .cloned()
            .collect::<Vec<_>>();
        lobbies.sort_by(|left, right| {
            right
                .players
                .cmp(&left.players)
                .then_with(|| left.title.cmp(&right.title))
                .then_with(|| left.host_name.cmp(&right.host_name))
        });
        LobbySnapshot {
            status: LobbyStatus::Live,
            updated_at: Some(observed_at.to_owned()),
            stale_since: None,
            stats: self.stats.clone(),
            lobbies: lobbies
                .into_iter()
                .map(|lobby| Lobby {
                    title: lobby.title,
                    is_public: lobby.is_public,
                    host: LobbyHost {
                        name: lobby.host_name,
                        steam_id: lobby.host_steam_id.to_string(),
                    },
                    players: lobby.players,
                    player_limit: lobby.player_limit,
                })
                .collect(),
        }
    }
}

fn empty_snapshot(status: LobbyStatus) -> LobbySnapshot {
    LobbySnapshot {
        status,
        updated_at: None,
        stale_since: None,
        stats: LobbyStats::default(),
        lobbies: Vec::new(),
    }
}

fn mark_stale(store: &LobbySnapshotStore) {
    let current = store.get();
    if matches!(current.status, LobbyStatus::Live | LobbyStatus::Stale) {
        let mut snapshot = (*current).clone();
        snapshot.status = LobbyStatus::Stale;
        snapshot.stale_since = Some(jiff::Timestamp::now().to_string());
        store.set(snapshot);
    } else {
        store.set(empty_snapshot(LobbyStatus::Unavailable));
    }
}

fn sanitize_lobby_text(value: &str, fallback: &str) -> String {
    let sanitized = value
        .chars()
        .filter(|character| !matches!(character, '\'' | '"' | '\\' | '/'))
        .collect::<String>();
    let value = sanitized.trim();
    if value.is_empty() {
        fallback.to_owned()
    } else {
        value.chars().take(256).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn broker_validation_matches_bun_boundaries() {
        let request = AssignmentRequest {
            key: "totw".into(),
            join_id: Some("private-room".into()),
            room: RoomRequest {
                name: " Track of the Week ".into(),
                is_public: true,
                max_players: 64,
            },
        };
        assert!(valid_assignment(&request));
        assert_eq!(sanitize_lobby_text(" 'Track/One' ", "fallback"), "TrackOne");
        assert_eq!(sanitize_lobby_text("///", "fallback"), "fallback");
    }

    #[test]
    fn broker_token_requires_exact_bearer_value() {
        let mut headers = HeaderMap::new();
        headers.insert(
            header::AUTHORIZATION,
            HeaderValue::from_static("Bearer secret"),
        );
        assert!(authorized(&headers, "secret"));
        assert!(!authorized(&headers, "secreu"));
        assert!(!authorized(&HeaderMap::new(), "secret"));
    }

    #[tokio::test]
    async fn broker_returns_lobby_host_wire_contract() {
        let (sender, mut receiver) = mpsc::channel::<AssignmentCommand>(1);
        tokio::spawn(async move {
            let command = receiver.recv().await.unwrap();
            assert!(
                command
                    .response
                    .send(Ok(RoomAssignment {
                        host: "127.0.0.1".into(),
                        join_id: "join-id".into(),
                        key: command.request.key,
                        player_uid: 7,
                        port: 7777,
                        room_created: true,
                        steam_id: "76561198000000000".into(),
                        token: "ephemeral".into(),
                    }))
                    .is_ok()
            );
        });
        let state = BrokerState {
            broker: RoomBroker { sender },
            token: "secret".into(),
        };
        let mut headers = HeaderMap::new();
        headers.insert(
            header::AUTHORIZATION,
            HeaderValue::from_static("Bearer secret"),
        );
        let response = assign_room(
            State(state),
            headers,
            Ok(Json(AssignmentRequest {
                key: "totw".into(),
                join_id: None,
                room: RoomRequest {
                    name: "Track of the Week".into(),
                    is_public: true,
                    max_players: 64,
                },
            })),
        )
        .await;
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.headers()[header::CACHE_CONTROL], "no-store");
        let body = axum::body::to_bytes(response.into_body(), 4_096)
            .await
            .unwrap();
        assert_eq!(
            serde_json::from_slice::<serde_json::Value>(&body).unwrap(),
            serde_json::json!({
                "host":"127.0.0.1",
                "joinId":"join-id",
                "key":"totw",
                "playerUid":7,
                "port":7777,
                "roomCreated":true,
                "steamId":"76561198000000000",
                "token":"ephemeral"
            })
        );
    }
}
