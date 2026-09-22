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
    error::Error,
    fmt,
    future::Future,
    sync::Arc,
    time::{Duration, Instant},
};
use subtle::ConstantTimeEq;
use tokio::sync::{mpsc, oneshot, watch};
use zc_core::zeepnet::{
    BitReader, LidgrenClient, LidgrenClientOptions, LidgrenError, LobbyOperation, LobbyPacket,
    MasterRoomResponse, WireLobby, create_lobby_packet, join_lobby_packet, master_hail,
    parse_lobby_packet, parse_master_room_response,
};

const ROOM_TIMEOUT: Duration = Duration::from_secs(15);
const FIRST_SNAPSHOT_TIMEOUT: Duration = Duration::from_secs(15);
const RETRY_MAX: Duration = Duration::from_secs(60);
const MIN_TICKET_INTERVAL: Duration = Duration::from_secs(60);
const TICKET_USER_DATA: u32 = 21_572;
const LOBBY_HOST_NAME: &str = "ZeepCentraal";

#[derive(Clone)]
pub struct RoomBroker {
    sender: mpsc::Sender<AssignmentCommand>,
}

pub struct LobbyRuntime {
    shutdown: watch::Sender<bool>,
    tasks: Vec<tokio::task::JoinHandle<()>>,
    assignment_sender: Option<mpsc::Sender<AssignmentCommand>>,
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
    deadline: Instant,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum MasterExit {
    Handoff,
    Shutdown,
}

#[derive(Debug)]
struct SteamSessionLost;

impl fmt::Display for SteamSessionLost {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("Steam session lost")
    }
}

impl Error for SteamSessionLost {}

#[derive(Debug)]
struct MasterRecycle;

impl fmt::Display for MasterRecycle {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("Master connection remained assigned to previous room")
    }
}

impl Error for MasterRecycle {}

trait SteamEventSource {
    fn poll_event(
        &mut self,
    ) -> impl Future<Output = Result<Option<steam_client::SteamEvent>, steam_client::SteamError>> + Send;
}

impl SteamEventSource for steam_client::SteamClient {
    fn poll_event(
        &mut self,
    ) -> impl Future<Output = Result<Option<steam_client::SteamEvent>, steam_client::SteamError>> + Send
    {
        steam_client::SteamClient::poll_event(self)
    }
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
                assignment_sender: None,
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
        let broker = RoomBroker {
            sender: sender.clone(),
        };
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
        Ok(Self {
            shutdown,
            tasks,
            assignment_sender: Some(sender),
        })
    }

    pub async fn stop(self) {
        self.shutdown.send_replace(true);
        for task in self.tasks {
            let _ = task.await;
        }
        drop(self.assignment_sender);
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
    let deadline = Instant::now() + ROOM_TIMEOUT;
    if state
        .broker
        .sender
        .send(AssignmentCommand {
            request,
            response: response_tx,
            deadline,
        })
        .await
        .is_err()
    {
        return broker_response(
            StatusCode::SERVICE_UNAVAILABLE,
            "Room assignment unavailable",
        );
    }
    match tokio::time::timeout_at(deadline.into(), response_rx).await {
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
    let mut last_ticket_request = None;
    store.set(empty_snapshot(LobbyStatus::Connecting));
    while !*shutdown.borrow() {
        let result = run_steam_session(
            &config,
            &store,
            &mut requests,
            &persistence,
            &mut shutdown,
            &mut last_ticket_request,
            &mut retry,
        )
        .await;
        if *shutdown.borrow() {
            break;
        }
        if let Err(error) = result {
            if error.is::<SteamSessionLost>() {
                tracing::warn!("Zeepkist Steam session failed; recreating");
            } else {
                tracing::warn!(%error, "Zeepkist lobby collector disconnected");
            }
        }
        mark_stale(&store);
        tokio::select! {
            _ = tokio::time::sleep(jittered(retry)) => {},
            _ = shutdown.changed() => break,
        }
        retry = next_retry(retry);
    }
}

fn jittered(delay: Duration) -> Duration {
    let random_bits = uuid::Uuid::new_v4().as_u128() & ((1u128 << 48) - 1);
    let fraction = random_bits as f64 / (1u64 << 48) as f64;
    Duration::from_secs_f64(delay.as_secs_f64() * (0.8 + fraction * 0.4))
}

fn next_retry(delay: Duration) -> Duration {
    (delay * 2).min(RETRY_MAX)
}

async fn run_steam_session(
    config: &LobbyRuntimeConfig,
    store: &LobbySnapshotStore,
    requests: &mut mpsc::Receiver<AssignmentCommand>,
    persistence: &mpsc::UnboundedSender<(LobbyPacket, String)>,
    shutdown: &mut watch::Receiver<bool>,
    last_ticket_request: &mut Option<Instant>,
    steam_retry: &mut Duration,
) -> Result<()> {
    let refresh_token = tokio::fs::read_to_string(&config.refresh_token_file)
        .await
        .context("read Zeepkist Steam refresh token")?;
    ensure!(
        !refresh_token.trim().is_empty(),
        "Steam refresh token file is empty"
    );
    let steam_options = steam_client::SteamOptions {
        auto_relogin: false,
        renew_refresh_tokens: true,
        enable_pics_cache: false,
        ..Default::default()
    };
    let mut steam = steam_client::SteamClient::new(steam_options);
    let result = async {
        let details = steam_client::LogOnDetails {
            refresh_token: Some(refresh_token.trim().to_owned()),
            machine_name: Some("ZeepCentraal Rust lobby collector".into()),
            ..Default::default()
        };
        let response = tokio::select! {
            response = steam.log_on(details) => response.map_err(|error| {
                tracing::warn!(error = %safe_steam_event_error(&error), "Steam login failed");
                SteamSessionLost
            })?,
            _ = shutdown.changed() => return Ok(()),
        };
        tracing::info!("Steam login accepted");
        let steam_id = response.steam_id.steam_id64();
        let mut cached_ticket: Option<(Instant, Vec<u8>)> = None;
        let mut master_retry = Duration::from_secs(1);
        while !*shutdown.borrow() {
            let ticket = if let Some((created, ticket)) = &cached_ticket
                && created.elapsed() < MIN_TICKET_INTERVAL
            {
                ticket.clone()
            } else {
                tracing::info!("Requesting Steam encrypted app ticket");
                let ticket = spaced_ticket_request(
                    async {
                        steam
                            .create_encrypted_app_ticket(
                                config.app_id,
                                Some(&TICKET_USER_DATA.to_le_bytes()),
                            )
                            .await
                            .map_err(ticket_request_error)
                    },
                    last_ticket_request,
                    shutdown,
                    MIN_TICKET_INTERVAL,
                    ROOM_TIMEOUT,
                )
                .await?;
                ensure!(
                    !ticket.is_empty(),
                    "Steam returned an empty encrypted app ticket"
                );
                tracing::info!("Steam encrypted app ticket acquired");
                *steam_retry = Duration::from_secs(1);
                cached_ticket = Some((Instant::now(), ticket.clone()));
                ticket
            };
            match run_master(
                config,
                store,
                requests,
                persistence,
                shutdown,
                &mut steam,
                steam_id,
                &ticket,
            )
            .await
            {
                Ok(MasterExit::Shutdown) => break,
                Ok(MasterExit::Handoff) => {
                    master_retry = Duration::from_secs(1);
                    tracing::info!("Master room assignment handed off");
                }
                Err(error) if error.is::<SteamSessionLost>() => return Err(error),
                Err(error) => {
                    if let Some(LidgrenError::RemoteDisconnect { category, .. }) =
                        error.downcast_ref::<LidgrenError>()
                    {
                        tracing::warn!(
                            ?category,
                            "Zeepkist master rejected lobby collector; retrying"
                        );
                    } else {
                        tracing::warn!(%error, "Zeepkist master connection failed; retrying");
                    }
                }
            }
            if *shutdown.borrow() {
                break;
            }
            mark_stale(store);
            if !wait_for_master_retry(
                &mut steam,
                &config.refresh_token_file,
                shutdown,
                jittered(master_retry),
            )
            .await?
            {
                break;
            }
            master_retry = next_retry(master_retry);
        }
        Ok(())
    }
    .await;
    let _ = tokio::time::timeout(Duration::from_secs(2), steam.log_off()).await;
    result
}

async fn spaced_ticket_request(
    request: impl Future<Output = Result<Vec<u8>>>,
    last_request: &mut Option<Instant>,
    shutdown: &mut watch::Receiver<bool>,
    minimum_interval: Duration,
    timeout: Duration,
) -> Result<Vec<u8>> {
    if let Some(wait) =
        last_request.and_then(|instant| minimum_interval.checked_sub(instant.elapsed()))
    {
        tokio::select! {
            _ = tokio::time::sleep(wait) => {},
            _ = shutdown.changed() => bail!("Server shutdown"),
        }
    }
    *last_request = Some(Instant::now());
    bounded_ticket_request(request, shutdown, timeout).await
}

fn ticket_request_error(error: steam_client::SteamError) -> anyhow::Error {
    match error {
        steam_client::SteamError::SteamResult(result) => {
            anyhow::anyhow!("Steam rejected encrypted app ticket: {result:?}")
        }
        steam_client::SteamError::NotConnected => {
            anyhow::anyhow!("Steam disconnected during encrypted app ticket request")
        }
        steam_client::SteamError::Timeout => {
            anyhow::anyhow!("Steam encrypted app ticket request timed out")
        }
        _ => anyhow::anyhow!("Steam encrypted app ticket request failed"),
    }
}

async fn bounded_ticket_request(
    request: impl Future<Output = Result<Vec<u8>>>,
    shutdown: &mut watch::Receiver<bool>,
    timeout: Duration,
) -> Result<Vec<u8>> {
    tokio::select! {
        ticket = tokio::time::timeout(timeout, request) =>
            ticket.context("Steam encrypted app ticket request timed out")?,
        _ = shutdown.changed() => bail!("Server shutdown"),
    }
}

#[allow(clippy::too_many_arguments)]
async fn run_master(
    config: &LobbyRuntimeConfig,
    store: &LobbySnapshotStore,
    requests: &mut mpsc::Receiver<AssignmentCommand>,
    persistence: &mpsc::UnboundedSender<(LobbyPacket, String)>,
    shutdown: &mut watch::Receiver<bool>,
    steam: &mut impl SteamEventSource,
    steam_id: u64,
    ticket: &[u8],
) -> Result<MasterExit> {
    let remote = config.master.context("Missing Zeepkist master address")?;
    tracing::info!(%remote, "Connecting Zeepkist lobby collector to master");
    let hail = collector_hail(
        config.build.context("Missing Zeepkist build")?,
        steam_id,
        ticket,
    )?;
    let client = LidgrenClient::start(LidgrenClientOptions::load_balancer(remote, hail)).await?;
    let result = run_master_connected(
        config,
        store,
        requests,
        persistence,
        shutdown,
        steam,
        remote,
        steam_id,
        &client,
        FIRST_SNAPSHOT_TIMEOUT,
    )
    .await;
    let reason = match &result {
        Ok(MasterExit::Handoff) => "Room assignment handed off",
        Ok(MasterExit::Shutdown) => "Server shutdown",
        Err(_) => "Master connection retrying",
    };
    let _ = tokio::time::timeout(Duration::from_secs(2), client.close(reason)).await;
    result
}

#[allow(clippy::too_many_arguments)]
async fn run_master_connected(
    config: &LobbyRuntimeConfig,
    store: &LobbySnapshotStore,
    requests: &mut mpsc::Receiver<AssignmentCommand>,
    persistence: &mpsc::UnboundedSender<(LobbyPacket, String)>,
    shutdown: &mut watch::Receiver<bool>,
    steam: &mut impl SteamEventSource,
    remote: std::net::SocketAddr,
    steam_id: u64,
    client: &LidgrenClient,
    snapshot_timeout: Duration,
) -> Result<MasterExit> {
    let remote_hail = tokio::time::timeout(ROOM_TIMEOUT, async {
        loop {
            tokio::select! {
                hail = client.connect() => break hail.map_err(anyhow::Error::from),
                event = steam.poll_event() => handle_steam_event(event, &config.refresh_token_file).await?,
                _ = shutdown.changed() => return Ok(Vec::new()),
            }
        }
    }).await??;
    if *shutdown.borrow() {
        return Ok(MasterExit::Shutdown);
    }
    let mut hail_reader = BitReader::new(&remote_hail);
    let player_uid = hail_reader.read_u32()?;
    let token = hail_reader.read_string(4_096)?;
    let mut state = LobbyState::default();
    let first_snapshot = tokio::time::sleep(snapshot_timeout);
    tokio::pin!(first_snapshot);
    let mut received_snapshot = false;
    tracing::info!(%remote, "Zeepkist lobby collector connected");
    loop {
        tokio::select! {
            payload = client.recv() => {
                let Some(payload) = payload else {
                    client.wait_for_close().await?;
                    bail!("Master connection closed")
                };
                if apply_payload(&payload, &mut state, store, persistence)? && !received_snapshot {
                    received_snapshot = true;
                    tracing::info!(%remote, "Initial Zeepkist lobby snapshot received");
                }
            }
            command = requests.recv() => {
                let Some(command) = command else { return Ok(MasterExit::Shutdown) };
                if !assignment_active(&command) {
                    continue;
                }
                let result = assign_on_master(
                    client, &mut state, store, persistence, command.request, player_uid, steam_id, &token,
                ).await;
                if !received_snapshot && matches!(store.get().status, LobbyStatus::Live) {
                    received_snapshot = true;
                    tracing::info!(%remote, "Initial Zeepkist lobby snapshot received");
                }
                let handed_off = result.is_ok();
                let recycle = result.as_ref().is_err_and(|error| error.is::<MasterRecycle>());
                if handed_off {
                    return finish_master_handoff(
                        client.close("Room assignment handed off"),
                        result,
                        command.response,
                    ).await;
                }
                if recycle {
                    let _ = tokio::time::timeout(
                        Duration::from_secs(2),
                        client.close("Master connection remained assigned to previous room"),
                    ).await;
                    let _ = command.response.send(result);
                    tracing::warn!("Master rejected room creation on assigned connection; recycling");
                    bail!(MasterRecycle);
                }
                let _ = command.response.send(result);
            }
            _ = shutdown.changed() => {
                return Ok(MasterExit::Shutdown);
            }
            event = steam.poll_event() => handle_steam_event(event, &config.refresh_token_file).await?,
            _ = &mut first_snapshot, if !received_snapshot => {
                bail!("Master server did not send an initial lobby snapshot");
            }
        }
    }
}

fn assignment_active(command: &AssignmentCommand) -> bool {
    !command.response.is_closed() && Instant::now() < command.deadline
}

async fn finish_master_handoff(
    close: impl Future<Output = std::result::Result<(), LidgrenError>>,
    result: Result<RoomAssignment>,
    response: oneshot::Sender<Result<RoomAssignment>>,
) -> Result<MasterExit> {
    if !matches!(
        tokio::time::timeout(Duration::from_secs(2), close).await,
        Ok(Ok(()))
    ) {
        let _ = response.send(Err(anyhow::anyhow!("Master handoff close failed")));
        bail!("Master handoff close failed");
    }
    let _ = response.send(result);
    Ok(MasterExit::Handoff)
}

async fn handle_steam_event(
    event: Result<Option<steam_client::SteamEvent>, steam_client::SteamError>,
    refresh_token_file: &std::path::Path,
) -> Result<()> {
    let event = event.map_err(|error| {
        tracing::warn!(error = %safe_steam_event_error(&error), "Steam session event failed");
        SteamSessionLost
    })?;
    let Some(event) = event else {
        bail!(SteamSessionLost);
    };
    if matches!(
        event,
        steam_client::SteamEvent::Connection(
            steam_client::ConnectionEvent::Disconnected { .. }
                | steam_client::ConnectionEvent::ReconnectFailed { .. }
        )
    ) {
        tracing::warn!("Steam session disconnected");
        bail!(SteamSessionLost);
    }
    if let Err(error) = persist_refresh_token(event, refresh_token_file).await {
        tracing::error!(%error, "Steam refresh token persistence failed");
    }
    Ok(())
}

async fn wait_for_master_retry(
    steam: &mut impl SteamEventSource,
    refresh_token_file: &std::path::Path,
    shutdown: &mut watch::Receiver<bool>,
    delay: Duration,
) -> Result<bool> {
    let sleep = tokio::time::sleep(delay);
    tokio::pin!(sleep);
    loop {
        tokio::select! {
            _ = &mut sleep => return Ok(true),
            _ = shutdown.changed() => return Ok(false),
            event = steam.poll_event() => handle_steam_event(event, refresh_token_file).await?,
        }
    }
}

fn safe_steam_event_error(error: &steam_client::SteamError) -> &'static str {
    match error {
        steam_client::SteamError::ConnectionError(_) => "Steam connection error",
        steam_client::SteamError::SteamResult(_) => "Steam rejected request",
        steam_client::SteamError::Timeout => "Steam connection timed out",
        steam_client::SteamError::NotConnected => "Steam client disconnected",
        _ => "Steam client error",
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
    client
        .send_reliable_ordered(
            collector_create_lobby_packet(
                request.room.max_players,
                &room_name,
                request.room.is_public,
            )?,
            0,
        )
        .await?;
    let MasterRoomResponse::Create { result, join_id } =
        wait_room_response(client, state, store, persistence, true).await?
    else {
        bail!("Unexpected master response")
    };
    if result == 2 {
        bail!(MasterRecycle);
    }
    if result != 1 || join_id.is_empty() {
        tracing::warn!(result, "Master rejected room creation");
    }
    ensure!(result == 1 && !join_id.is_empty(), "Room create rejected");
    let MasterRoomResponse::Join { result, host, port } =
        wait_room_response(client, state, store, persistence, false).await?
    else {
        bail!("Unexpected master response")
    };
    if result != 1 {
        tracing::warn!(result, "Master rejected created room join");
    }
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
            let payload = match client.recv().await {
                Some(payload) => payload,
                None => {
                    client.wait_for_close().await?;
                    bail!("Master connection closed");
                }
            };
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

fn collector_hail(build: i32, steam_id: u64, ticket: &[u8]) -> Result<Vec<u8>> {
    master_hail(build, steam_id, LOBBY_HOST_NAME, ticket)
}

fn collector_create_lobby_packet(
    max_players: i32,
    room_name: &str,
    is_public: bool,
) -> Result<Vec<u8>> {
    create_lobby_packet(max_players, room_name, is_public, LOBBY_HOST_NAME)
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
    use tokio::net::UdpSocket;

    struct MockSteam;

    impl SteamEventSource for MockSteam {
        fn poll_event(
            &mut self,
        ) -> impl Future<
            Output = Result<Option<steam_client::SteamEvent>, steam_client::SteamError>,
        > + Send {
            std::future::pending()
        }
    }

    #[derive(Clone, Copy)]
    enum MockMasterMode {
        Silent,
        AlreadyOnline,
        Snapshot,
    }

    async fn mock_connected_master(
        mode: MockMasterMode,
    ) -> (
        LidgrenClient,
        tokio::task::JoinHandle<()>,
        std::net::SocketAddr,
    ) {
        let server = UdpSocket::bind("127.0.0.1:0").await.unwrap();
        let remote = server.local_addr().unwrap();
        let client = LidgrenClient::start(LidgrenClientOptions::load_balancer(remote, vec![]))
            .await
            .unwrap();
        let master = tokio::spawn(async move {
            let mut bytes = [0; 2048];
            let (_, peer) = server.recv_from(&mut bytes).await.unwrap();
            assert_eq!(bytes[0], 131);
            let mut handshake = zc_core::zeepnet::BitWriter::new();
            handshake.write_string("LoadBalancer").unwrap();
            handshake.int64(0);
            handshake.float32(0.0);
            let mut hail = zc_core::zeepnet::BitWriter::new();
            hail.write_u32(7);
            hail.write_string("fake-token").unwrap();
            handshake.write_bytes(&hail.into_bytes());
            server
                .send_to(&mock_datagram(132, 0, &handshake.into_bytes()), peer)
                .await
                .unwrap();
            let _ = server.recv_from(&mut bytes).await.unwrap(); // ConnectionEstablished
            match mode {
                MockMasterMode::AlreadyOnline => {
                    let mut reason = zc_core::zeepnet::BitWriter::new();
                    reason.write_string("already-online").unwrap();
                    server
                        .send_to(&mock_datagram(135, 0, &reason.into_bytes()), peer)
                        .await
                        .unwrap();
                }
                MockMasterMode::Snapshot => {
                    let mut snapshot = zc_core::zeepnet::BitWriter::new();
                    snapshot.write_u16(zc_core::zeepnet::LOBBY_LIST);
                    snapshot.write_i32(0);
                    server
                        .send_to(&mock_datagram(67, 0, &snapshot.into_bytes()), peer)
                        .await
                        .unwrap();
                }
                MockMasterMode::Silent => {}
            }
            tokio::time::sleep(Duration::from_millis(250)).await;
        });
        (client, master, remote)
    }

    async fn run_mock_master(
        mode: MockMasterMode,
        snapshot_timeout: Duration,
        close_after: Option<Duration>,
    ) -> (Result<MasterExit>, LobbySnapshotStore) {
        let (client, master, remote) = mock_connected_master(mode).await;
        let config = LobbyRuntimeConfig {
            enabled: true,
            app_id: 1,
            master: Some(remote),
            build: Some(18),
            refresh_token_file: "unused".into(),
            broker: None,
        };
        let store = LobbySnapshotStore::default();
        let (requests, mut request_rx) = mpsc::channel(1);
        let (persistence, _packets) = mpsc::unbounded_channel();
        let (shutdown_tx, mut shutdown_rx) = watch::channel(false);
        let closer = close_after.map(|delay| {
            let shutdown_tx = shutdown_tx.clone();
            tokio::spawn(async move {
                tokio::time::sleep(delay).await;
                shutdown_tx.send_replace(true);
            })
        });
        let mut steam = MockSteam;
        let result = tokio::time::timeout(
            Duration::from_secs(1),
            run_master_connected(
                &config,
                &store,
                &mut request_rx,
                &persistence,
                &mut shutdown_rx,
                &mut steam,
                remote,
                1,
                &client,
                snapshot_timeout,
            ),
        )
        .await
        .expect("mock master run should finish");
        drop(requests);
        let _ = client.close("Test complete").await;
        master.abort();
        if let Some(closer) = closer {
            closer.abort();
        }
        (result, store)
    }

    fn mock_datagram(message_type: u8, sequence: u16, payload: &[u8]) -> Vec<u8> {
        let bits = (payload.len() * 8) as u16;
        let mut bytes = vec![
            message_type,
            (sequence << 1) as u8,
            (sequence >> 7) as u8,
            bits as u8,
            (bits >> 8) as u8,
        ];
        bytes.extend_from_slice(payload);
        bytes
    }

    fn fixture_request() -> AssignmentRequest {
        AssignmentRequest {
            key: "room".into(),
            join_id: None,
            room: RoomRequest {
                name: "Room".into(),
                is_public: true,
                max_players: 64,
            },
        }
    }

    async fn mock_master_assignment(create_result: u16) -> Result<RoomAssignment> {
        let server = UdpSocket::bind("127.0.0.1:0").await?;
        let client = LidgrenClient::start(LidgrenClientOptions::load_balancer(
            server.local_addr()?,
            vec![],
        ))
        .await?;
        let master = async {
            let mut bytes = [0; 2048];
            let (_, remote) = server.recv_from(&mut bytes).await.unwrap();
            assert_eq!(bytes[0], 131); // Connect
            let mut handshake = zc_core::zeepnet::BitWriter::new();
            handshake.write_string("LoadBalancer").unwrap();
            handshake.int64(0);
            handshake.write_f32(0.0);
            server
                .send_to(&mock_datagram(132, 0, &handshake.into_bytes()), remote)
                .await
                .unwrap();
            loop {
                let (length, _) = server.recv_from(&mut bytes).await.unwrap();
                if bytes[0] != 67 {
                    continue;
                }
                assert_eq!(
                    &bytes[5..length],
                    collector_create_lobby_packet(64, "Room", true).unwrap()
                );
                let sequence = ((u16::from(bytes[1]) >> 1) | (u16::from(bytes[2]) << 7)) & 1023;
                server
                    .send_to(
                        &mock_datagram(134, 0, &[67, sequence as u8, (sequence >> 8) as u8]),
                        remote,
                    )
                    .await
                    .unwrap();
                let mut response = zc_core::zeepnet::BitWriter::new();
                response.write_u16(zc_core::zeepnet::CREATE_LOBBY_RESPONSE);
                response.write_u16(create_result);
                response
                    .write_string(if create_result == 1 { "join-id" } else { "" })
                    .unwrap();
                server
                    .send_to(&mock_datagram(67, 0, &response.into_bytes()), remote)
                    .await
                    .unwrap();
                if create_result == 1 {
                    let mut joined = zc_core::zeepnet::BitWriter::new();
                    joined.write_u16(zc_core::zeepnet::JOIN_LOBBY_RESPONSE);
                    joined.write_u16(1);
                    joined.write_string("127.0.0.1").unwrap();
                    joined.write_i32(7777);
                    server
                        .send_to(&mock_datagram(67, 1, &joined.into_bytes()), remote)
                        .await
                        .unwrap();
                }
                break;
            }
        };
        let assignment = async {
            client.connect().await?;
            let store = LobbySnapshotStore::default();
            let (persistence, _receiver) = mpsc::unbounded_channel();
            assign_on_master(
                &client,
                &mut LobbyState::default(),
                &store,
                &persistence,
                fixture_request(),
                7,
                1,
                "fake-token",
            )
            .await
        };
        let ((), result) = tokio::time::timeout(Duration::from_secs(2), async {
            tokio::join!(master, assignment)
        })
        .await?;
        let _ = client.close("Test complete").await;
        result
    }

    #[tokio::test]
    async fn ticket_request_times_out_without_hanging_collector() {
        let (_sender, mut shutdown) = watch::channel(false);
        let result = bounded_ticket_request(
            std::future::pending::<Result<Vec<u8>>>(),
            &mut shutdown,
            Duration::from_millis(1),
        )
        .await;
        assert_eq!(
            result.unwrap_err().to_string(),
            "Steam encrypted app ticket request timed out"
        );
    }

    #[tokio::test]
    async fn ticket_request_stops_on_shutdown() {
        let (sender, mut shutdown) = watch::channel(false);
        sender.send_replace(true);
        let result = bounded_ticket_request(
            std::future::pending::<Result<Vec<u8>>>(),
            &mut shutdown,
            Duration::from_secs(15),
        )
        .await;
        assert_eq!(result.unwrap_err().to_string(), "Server shutdown");
    }

    #[tokio::test]
    async fn ticket_requests_remain_spaced_across_sessions() {
        let (_sender, mut shutdown) = watch::channel(false);
        let mut last_request = Some(Instant::now());
        let called = std::cell::Cell::new(false);
        let request = spaced_ticket_request(
            async {
                called.set(true);
                Ok(vec![1])
            },
            &mut last_request,
            &mut shutdown,
            Duration::from_millis(50),
            Duration::from_secs(1),
        );
        tokio::pin!(request);
        tokio::select! {
            result = &mut request => panic!("request ran too soon: {result:?}"),
            _ = tokio::time::sleep(Duration::from_millis(20)) => {},
        }
        assert!(!called.get());
        assert_eq!(request.await.unwrap(), vec![1]);
        assert!(called.get());
    }

    #[test]
    fn master_retry_starts_at_one_second_and_caps_at_sixty() {
        let mut retry = Duration::from_secs(1);
        for expected in [2, 4, 8, 16, 32, 60, 60] {
            let jitter = jittered(retry);
            assert!(jitter >= retry.mul_f64(0.8));
            assert!(jitter <= retry.mul_f64(1.2));
            retry = next_retry(retry);
            assert_eq!(retry, Duration::from_secs(expected));
        }
    }

    #[test]
    fn expired_or_abandoned_broker_requests_never_start() {
        let (response, receiver) = oneshot::channel();
        let mut command = AssignmentCommand {
            request: fixture_request(),
            response,
            deadline: Instant::now() + Duration::from_secs(1),
        };
        assert!(assignment_active(&command));
        command.deadline = Instant::now() - Duration::from_millis(1);
        assert!(!assignment_active(&command));
        command.deadline = Instant::now() + Duration::from_secs(1);
        drop(receiver);
        assert!(!assignment_active(&command));
    }

    #[test]
    fn collector_keeps_assignment_channel_open_without_broker() {
        let (sender, mut receiver) = mpsc::channel(1);
        let (shutdown, _) = watch::channel(false);
        let runtime = LobbyRuntime {
            shutdown,
            tasks: Vec::new(),
            assignment_sender: Some(sender),
        };
        assert!(matches!(
            receiver.try_recv(),
            Err(mpsc::error::TryRecvError::Empty)
        ));
        drop(runtime);
        assert!(matches!(
            receiver.try_recv(),
            Err(mpsc::error::TryRecvError::Disconnected)
        ));
    }

    #[tokio::test]
    async fn mock_master_response_two_recycles_connection() {
        let error = mock_master_assignment(2).await.unwrap_err();
        assert!(error.is::<MasterRecycle>(), "{error}");
    }

    #[tokio::test]
    async fn mock_master_create_and_join_hands_off_room() {
        let assignment = mock_master_assignment(1).await.unwrap();
        assert_eq!(assignment.join_id, "join-id");
        assert_eq!(assignment.port, 7777);
        assert!(assignment.room_created);
    }

    #[tokio::test]
    async fn room_assignment_waits_for_master_disconnect() {
        let (close_tx, close_rx) = oneshot::channel();
        let (response_tx, mut response_rx) = oneshot::channel();
        let room = RoomAssignment {
            host: "127.0.0.1".into(),
            join_id: "join-id".into(),
            key: "room".into(),
            player_uid: 7,
            port: 7777,
            room_created: true,
            steam_id: "1".into(),
            token: "fake-token".into(),
        };
        let handoff = finish_master_handoff(
            async {
                close_rx.await.unwrap();
                Ok(())
            },
            Ok(room),
            response_tx,
        );
        tokio::pin!(handoff);
        tokio::select! {
            result = &mut handoff => panic!("handoff completed before disconnect: {result:?}"),
            result = &mut response_rx => panic!("broker received room before disconnect: {result:?}"),
            _ = tokio::time::sleep(Duration::from_millis(20)) => {},
        }
        close_tx.send(()).unwrap();
        assert_eq!(handoff.await.unwrap(), MasterExit::Handoff);
        assert_eq!(response_rx.await.unwrap().unwrap().join_id, "join-id");
    }

    #[tokio::test]
    async fn three_sequential_mock_room_assignments_succeed() {
        for _ in 0..3 {
            assert_eq!(mock_master_assignment(1).await.unwrap().join_id, "join-id");
        }
    }

    #[tokio::test]
    async fn already_online_disconnect_is_master_error() {
        let (result, _) = run_mock_master(
            MockMasterMode::AlreadyOnline,
            Duration::from_millis(200),
            None,
        )
        .await;
        let error = result.unwrap_err();
        assert!(matches!(
            error.downcast_ref::<LidgrenError>(),
            Some(LidgrenError::RemoteDisconnect { .. })
        ));
        assert!(!error.is::<SteamSessionLost>());
    }

    #[tokio::test]
    async fn missing_first_snapshot_forces_reconnect() {
        let (result, store) =
            run_mock_master(MockMasterMode::Silent, Duration::from_millis(30), None).await;
        assert_eq!(
            result.unwrap_err().to_string(),
            "Master server did not send an initial lobby snapshot"
        );
        assert!(!matches!(store.get().status, LobbyStatus::Live));
    }

    #[tokio::test]
    async fn first_snapshot_and_shutdown_are_distinct_exits() {
        let (result, store) = run_mock_master(
            MockMasterMode::Snapshot,
            Duration::from_millis(200),
            Some(Duration::from_millis(40)),
        )
        .await;
        assert_eq!(result.unwrap(), MasterExit::Shutdown);
        assert!(matches!(store.get().status, LobbyStatus::Live));
    }

    #[tokio::test]
    async fn mock_master_rejection_keeps_error_specific() {
        let error = mock_master_assignment(3).await.unwrap_err();
        assert_eq!(error.to_string(), "Room create rejected");
    }

    #[tokio::test]
    async fn cm_reset_is_classified_as_steam_session_failure() {
        let error = handle_steam_event(
            Err(steam_client::SteamError::ConnectionError(
                "No CM servers available".into(),
            )),
            std::path::Path::new("unused"),
        )
        .await
        .unwrap_err();
        assert!(error.is::<SteamSessionLost>());
        assert_eq!(
            safe_steam_event_error(&steam_client::SteamError::ConnectionError("secret".into())),
            "Steam connection error"
        );
    }

    #[tokio::test]
    async fn refresh_token_storage_failure_keeps_live_steam_session() {
        let missing = std::env::temp_dir()
            .join(format!("zc-missing-token-parent-{}", uuid::Uuid::new_v4()))
            .join("refresh-token");
        let event = steam_client::SteamEvent::Auth(steam_client::AuthEvent::RefreshToken {
            token: "fake-token".into(),
            account_name: "Fake Bot".into(),
        });
        assert!(handle_steam_event(Ok(Some(event)), &missing).await.is_ok());
    }

    #[test]
    fn ticket_request_errors_have_safe_phase_diagnostics() {
        assert_eq!(
            ticket_request_error(steam_client::SteamError::NotConnected).to_string(),
            "Steam disconnected during encrypted app ticket request"
        );
        assert_eq!(
            ticket_request_error(steam_client::SteamError::Timeout).to_string(),
            "Steam encrypted app ticket request timed out"
        );
    }

    #[test]
    fn collector_wire_uses_fixed_host_name() {
        let hail = collector_hail(18, 76_561_198_000_000_000, &[1, 2, 3]).unwrap();
        let mut reader = BitReader::new(&hail);
        assert_eq!(reader.read_i32().unwrap(), 18);
        assert_eq!(reader.read_u64().unwrap(), 76_561_198_000_000_000);
        assert_eq!(reader.read_string(100).unwrap(), "ZeepCentraal");
        assert_eq!(reader.read_string(100).unwrap(), "");
        assert_eq!(reader.read_string(100).unwrap(), "ZeepCentraal");

        let packet = collector_create_lobby_packet(64, "Test room", true).unwrap();
        let mut reader = BitReader::new(&packet);
        assert_eq!(reader.read_u16().unwrap(), zc_core::zeepnet::CREATE_LOBBY);
        assert_eq!(reader.read_i32().unwrap(), 64);
        assert_eq!(reader.read_string(100).unwrap(), "Test room");
        assert!(reader.read_bool().unwrap());
        assert_eq!(reader.read_string(100).unwrap(), "ZeepCentraal");
    }

    #[test]
    fn collector_hail_create_and_join_match_bun_wire_fixtures() {
        // Fixed bytes from the pre-Rust Bun BitWriter and lobby packet layout.
        fn fixture(bytes: &str) -> Vec<u8> {
            bytes
                .split_whitespace()
                .map(|byte| u8::from_str_radix(byte, 16).unwrap())
                .collect()
        }
        assert_eq!(
            collector_hail(18, 1, &[1, 2]).unwrap(),
            fixture(
                "12 00 00 00 01 00 00 00 00 00 00 00 0c 5a 65 65 70 43 65 6e 74 72 61 61 6c 00 0c 5a 65 65 70 43 65 6e 74 72 61 61 6c 02 00 00 00 01 02 02 00 00 00"
            )
        );
        assert_eq!(
            collector_create_lobby_packet(64, "Room", true).unwrap(),
            fixture("74 46 40 00 00 00 04 52 6f 6f 6d 19 b4 ca ca e0 86 ca dc e8 e4 c2 c2 d8 00")
        );
        assert_eq!(
            join_lobby_packet("abc").unwrap(),
            fixture("06 5e 03 61 62 63")
        );
    }

    #[tokio::test]
    async fn renewed_token_is_persisted_from_steam_event() {
        let directory =
            std::env::temp_dir().join(format!("zc-lobby-token-test-{}", uuid::Uuid::new_v4()));
        tokio::fs::create_dir(&directory).await.unwrap();
        let token_file = directory.join("refresh-token");
        let event = steam_client::SteamEvent::Auth(steam_client::AuthEvent::RefreshToken {
            token: "fake-renewed-token".into(),
            account_name: "Lobby Bot".into(),
        });
        persist_refresh_token(event, &token_file).await.unwrap();
        assert_eq!(
            tokio::fs::read_to_string(&token_file).await.unwrap(),
            "fake-renewed-token\n"
        );
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                tokio::fs::metadata(&token_file)
                    .await
                    .unwrap()
                    .permissions()
                    .mode()
                    & 0o777,
                0o600
            );
        }
        tokio::fs::remove_dir_all(directory).await.unwrap();
    }

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
