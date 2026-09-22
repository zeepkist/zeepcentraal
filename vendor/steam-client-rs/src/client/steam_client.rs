//! Main Steam client implementation.

mod polling;
mod reconnect;
mod state;

use std::{
    collections::{HashMap, VecDeque},
    pin::Pin,
    sync::Arc,
    time::Duration,
};

use chrono::{DateTime, Utc};
use prost::Message;
use steam_auth::{CredentialsDetails, EAuthSessionGuardType, EAuthTokenPlatformType, LoginSession, LoginSessionOptions};
use steam_enums::{EMsg, EPersonaState, EResult};
use steam_protos::{CMsgClientHello, CMsgClientLogOff, CMsgClientLogon, CMsgClientLogonResponse, PROTOCOL_VERSION};
use steamid::SteamID;
use tracing::{debug, error, info, info_span, warn, Instrument};

use crate::{
    connection::{CmServer, CmServerProvider, HttpCmServerProvider, SteamConnection, WebSocketConnection},
    error::SteamError,
    options::SteamOptions,
    protocol::SteamMessage,
    types::{AccountInfo, EmailInfo, Limitations, LogOnDetails, LogOnResponse, VacStatus, WalletInfo},
};

/// User persona information.
#[derive(Debug, Clone)]
pub struct UserPersona {
    pub steam_id: SteamID,
    pub player_name: String,
    pub persona_state: EPersonaState,
    pub persona_state_flags: u32,
    pub avatar_hash: Option<String>,
    pub game_name: Option<String>,
    pub game_id: Option<u64>,
    pub last_logon: Option<DateTime<Utc>>,
    pub last_logoff: Option<DateTime<Utc>>,
    pub last_seen_online: Option<DateTime<Utc>>,
    pub rich_presence: HashMap<String, String>,
    /// Steam player group ID (lobby/party) from rich presence
    pub steam_player_group: Option<String>,
    /// Status string from rich presence (e.g. "Competitive Mirage [ 3 : 6 ]")
    pub rich_presence_status: Option<String>,
    /// Map name from rich presence (e.g. "de_mirage")
    pub game_map: Option<String>,
    /// Game score from rich presence (e.g. "[ 3 : 6 ]")
    pub game_score: Option<String>,
    /// Number of players/slots in lobby/party from rich presence
    pub num_players: Option<u32>,
    pub unread_count: u32,
    pub last_message_time: u32,
}

impl Default for UserPersona {
    fn default() -> Self {
        Self {
            steam_id: SteamID::default(),
            player_name: String::new(),
            persona_state: EPersonaState::Offline,
            persona_state_flags: 0,
            avatar_hash: None,
            game_name: None,
            game_id: None,
            last_logon: None,
            last_logoff: None,
            last_seen_online: None,
            rich_presence: HashMap::new(),
            steam_player_group: None,
            rich_presence_status: None,
            game_map: None,
            game_score: None,
            num_players: None,
            unread_count: 0,
            last_message_time: 0,
        }
    }
}

impl UserPersona {
    /// Get the URL for the user's avatar.
    ///
    /// Size can be "icon" (32x32), "medium" (64x64), or "full" (184x184).
    pub fn avatar_url(&self, size: &str) -> Option<String> {
        let hash = self.avatar_hash.as_ref()?;
        let size_suffix = match size {
            "medium" => "_medium.jpg",
            "full" => "_full.jpg",
            _ => ".jpg",
        };
        Some(format!("https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/{}/{}{}", &hash[0..2], hash, size_suffix))
    }

    /// Merge another persona data into this one, overwriting only
    /// non-empty/Some values.
    pub fn merge(&mut self, other: &UserPersona) {
        if !other.player_name.is_empty() {
            self.player_name = other.player_name.clone();
        }
        self.persona_state = other.persona_state;
        if other.persona_state_flags != 0 {
            self.persona_state_flags = other.persona_state_flags;
        }
        if other.avatar_hash.is_some() {
            self.avatar_hash = other.avatar_hash.clone();
        }
        if other.game_name.is_some() {
            self.game_name = other.game_name.clone();
        }
        if other.game_id.is_some() && other.game_id != Some(0) {
            self.game_id = other.game_id;
        }
        if other.last_logon.is_some() {
            self.last_logon = other.last_logon;
        }
        if other.last_logoff.is_some() {
            self.last_logoff = other.last_logoff;
        }
        if other.last_seen_online.is_some() {
            self.last_seen_online = other.last_seen_online;
        }
        for (k, v) in &other.rich_presence {
            self.rich_presence.insert(k.clone(), v.clone());
        }
        if other.steam_player_group.is_some() {
            self.steam_player_group = other.steam_player_group.clone();
        }
        if other.rich_presence_status.is_some() {
            self.rich_presence_status = other.rich_presence_status.clone();
        }
        if other.game_map.is_some() {
            self.game_map = other.game_map.clone();
        }
        if other.game_score.is_some() {
            self.game_score = other.game_score.clone();
        }
        // Only update unread count and last message time if they are non-zero in the
        // other persona
        if other.unread_count > 0 {
            self.unread_count = other.unread_count;
        }
        if other.last_message_time > 0 {
            self.last_message_time = other.last_message_time;
        }
    }
}

use std::time::Instant;

use bytes::Bytes;
use tokio::sync::{mpsc, oneshot};

/// Background tasks that can be triggered without awaiting.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum BackgroundTask {
    FriendsList,
    OfflineMessages(SteamID),
}

/// Message queued for sending.
#[derive(Debug)]
pub(crate) struct QueuedMessage {
    pub friend: SteamID,
    pub message: String,
    pub entry_type: steam_enums::EChatEntryType,
    pub contains_bbcode: bool,
    pub respond_to: oneshot::Sender<Result<crate::services::chat::SendMessageResult, SteamError>>,
}

/// Wall-clock timeout for waiting on a `ClientLogOnResponse` after sending
/// `ClientLogon`. Steam usually responds within ~1s; 15s leaves headroom for
/// slow links and Multi-message decoding.
const LOGON_RESPONSE_TIMEOUT: Duration = Duration::from_secs(15);
/// Heartbeat interval in seconds.
const HEARTBEAT_INTERVAL_SECONDS: u64 = 30;

/// Per-account state populated from the login response and account-info
/// service calls. Cleared on logoff.
#[derive(Debug, Default, Clone)]
pub(crate) struct AccountState {
    pub(crate) public_ip: Option<String>,
    pub(crate) cell_id: Option<u32>,
    pub(crate) vanity_url: Option<String>,
    pub(crate) info: Option<AccountInfo>,
    pub(crate) email: Option<EmailInfo>,
    pub(crate) limitations: Option<Limitations>,
    pub(crate) vac: Option<VacStatus>,
    pub(crate) wallet: Option<WalletInfo>,
}

/// Apps and licenses cached on this client.
#[derive(Debug, Default)]
pub(crate) struct AppsState {
    /// App information cache (AppID -> Info), populated from PICS responses.
    pub(crate) info: HashMap<u32, super::events::AppInfoData>,
    /// Account licenses (packages owned).
    pub(crate) licenses: Vec<super::events::LicenseEntry>,
    /// App IDs that need PICS info fetching.
    pub(crate) pending: rustc_hash::FxHashSet<u32>,
    /// Whether Steam has blocked us from setting a "Playing" status.
    pub(crate) playing_blocked: bool,
    /// App IDs currently set via `games_played`.
    pub(crate) playing_app_ids: Vec<u32>,
}

/// Friends, personas, chat read state, and persona cache.
#[derive(Debug, Default)]
pub(crate) struct SocialState {
    /// Friends list (SteamID -> relationship).
    pub(crate) friends: HashMap<SteamID, u32>,
    /// User personas (live state map).
    pub(crate) users: HashMap<SteamID, UserPersona>,
    /// Chat last view timestamps (SteamID -> unix timestamp).
    pub(crate) chat_last_view: HashMap<SteamID, u32>,
    /// Persona cache with TTL expiration.
    pub(crate) persona_cache: crate::cache::PersonaCache,
}

/// Outbound chat-message queue, rate-limit state, and the JoinSet of
/// in-flight chat-send tasks. Fields are accessed split (`&mut self.chat.rx`
/// vs `self.chat.tasks.join_next()`) inside `tokio::select!`; Rust's
/// disjoint-field borrow analysis keeps this sound.
pub(crate) struct ChatQueueState {
    pub(crate) tx: mpsc::UnboundedSender<QueuedMessage>,
    pub(crate) rx: mpsc::UnboundedReceiver<QueuedMessage>,
    pub(crate) rate_limit_until: Option<Instant>,
    pub(crate) pending_retry_message: Option<QueuedMessage>,
    pub(crate) tasks: tokio::task::JoinSet<(QueuedMessage, Result<crate::services::chat::SendMessageResult, SteamError>)>,
}

/// Authentication & connection-lifecycle state. Updated during
/// `log_on`/`log_off`/reconnect; cleared on logoff.
#[derive(Default)]
pub(crate) struct AuthState {
    pub(crate) login_session: Option<LoginSession>,
    pub(crate) logon_details: Option<LogOnDetails>,
    pub(crate) session_id: i32,
    pub(crate) connecting: bool,
    pub(crate) logging_off: bool,
    pub(crate) relogging: bool,
    pub(crate) temp_steam_id: Option<SteamID>,
    pub(crate) auth_seq_me: u32,
    pub(crate) auth_seq_them: u32,
    pub(crate) last_cm_server: Option<CmServer>,
}

/// The main Steam client.
///
/// State fields are `pub(crate)` and read via accessor methods (`steam_id()`,
/// `cell_id()`, etc.). Direct field access was retired in the 0.2.x cycle to
/// stabilize the public surface for the road to 1.0.
pub struct SteamClient {
    /// Client options (kept `pub` because it's user-supplied configuration).
    pub options: SteamOptions,

    /// The logged-in SteamID (None if not logged in).
    pub(crate) steam_id: Option<SteamID>,

    /// Account-derived state (IP, cell, account info, wallet, VAC, …).
    ///
    /// Wrapped in `Arc<parking_lot::RwLock>` so `&self` accessor methods
    /// (`account_info`, `wallet`, `vac_status`, …) can read without exclusive
    /// access to the whole client. Never hold a guard across `.await`.
    pub(crate) account: Arc<parking_lot::RwLock<AccountState>>,

    /// Apps & licenses (PICS cache, owned licenses, playing status).
    ///
    /// Wrapped in `Arc<parking_lot::RwLock>` so `&self` accessor methods
    /// (`licenses`, `get_app_name`, `format_rich_presence`) can read without
    /// exclusive access. Methods that need long-lived references to inner
    /// `AppInfoData` should bind `let apps = self.apps.read();` at the top
    /// of the (synchronous) function. Never hold across `.await`.
    pub(crate) apps: Arc<parking_lot::RwLock<AppsState>>,

    /// Friends, personas, chat read state, persona cache.
    ///
    /// Wrapped in `Arc<parking_lot::RwLock>` so `&self` accessor methods
    /// (`friend_relationship`, `persona`, `friends`) work without exclusive
    /// access to the whole client. **Never hold a guard across an `.await`** —
    /// `parking_lot::RwLockReadGuard` is `Send`, so the compiler won't catch
    /// it, but a held lock blocks all other accessors until the await resolves.
    pub(crate) social: Arc<parking_lot::RwLock<SocialState>>,

    // Connection stats
    pub(crate) connect_time: u64,
    pub(crate) connection_count: u32,

    /// Authentication & connection-lifecycle state.
    ///
    /// Wrapped in `Arc<parking_lot::RwLock>` for symmetry with the other
    /// sub-structs. Note: most reads are quick value extractions; methods
    /// that need `&mut LoginSession` across an `.await` (`get_web_session`)
    /// `take()` the session, do the I/O, then re-insert it.
    pub(crate) auth: Arc<parking_lot::RwLock<AuthState>>,

    pub(crate) h_steam_pipe: u32,
    pub(crate) gc_tokens: Vec<Vec<u8>>,
    pub(crate) active_tickets: Vec<crate::services::appauth::AuthSessionTicket>,

    /// Last time this account successfully registered for a CSGO party
    /// (in-memory)
    pub(crate) last_time_party_register: Option<i64>,

    /// Outbound chat queue + in-flight send tasks.
    pub(crate) chat: ChatQueueState,

    // Internal state (crate-visible)
    pub(crate) connection: Option<Box<dyn SteamConnection>>,
    pub(crate) event_queue: VecDeque<super::events::SteamEvent>,
    // Events handled while awaiting a job response must still reach callers.
    deferred_job_events: VecDeque<super::events::SteamEvent>,

    // Reconnection state
    pub(crate) reconnect_manager: crate::internal::reconnect::ReconnectManager,
    pub(crate) heartbeat_manager: crate::internal::heartbeat::HeartbeatManager,

    // Job manager for request-response correlation
    pub(crate) job_manager: crate::internal::jobs::JobManager,

    // GC job manager for GC message request-response correlation
    pub(crate) gc_jobs: crate::services::gc::GCJobManager,

    /// Mapping of Job IDs to specific background tasks
    pub(crate) background_job_tasks: HashMap<u64, BackgroundTask>,

    /// Channel for background job results
    pub(crate) background_job_results_tx: mpsc::Sender<(u64, Result<Bytes, SteamError>)>,
    pub(crate) background_job_results_rx: mpsc::Receiver<(u64, Result<Bytes, SteamError>)>,

    // Session recovery helper
    pub(crate) session_recovery: crate::services::SessionRecovery,

    // Dependency injection for testing
    pub(crate) http_client: Arc<dyn crate::utils::http::HttpClient>,
    pub(crate) clock: Arc<dyn crate::utils::clock::Clock>,
    pub(crate) rng: Arc<dyn crate::utils::rng::Rng>,
}

impl SteamClient {
    /// Create a builder for constructing a SteamClient instance.
    ///
    /// The builder allows injecting mock dependencies for testing.
    /// For production use, prefer `SteamClient::new()` instead.
    ///
    /// # Example
    ///
    /// ```rust
    /// use steam_client::SteamClient;
    ///
    /// // For testing with mocked dependencies
    /// let (client, mocks) = SteamClient::builder()
    ///     .with_mock_http()
    ///     .with_mock_clock()
    ///     .build_with_mocks();
    ///
    /// // Control the mock clock in tests
    /// if let Some(clock) = mocks.clock {
    ///     clock.advance(std::time::Duration::from_secs(10));
    /// }
    /// ```
    pub fn builder() -> super::builder::SteamClientBuilder {
        super::builder::SteamClientBuilder::new()
    }

    /// Create a new Steam client with the given options.
    pub fn new(options: SteamOptions) -> Self {
        Self::builder().with_options(options).build()
    }

    /// Create a new Steam client with all custom providers.
    ///
    /// This is primarily useful for testing, allowing all mock providers to be
    /// injected.
    pub(crate) fn with_all_providers(options: SteamOptions, http_client: Arc<dyn crate::utils::http::HttpClient>, clock: Arc<dyn crate::utils::clock::Clock>, rng: Arc<dyn crate::utils::rng::Rng>) -> Self {
        let reconnect_config = options.reconnect.clone();
        let (chat_queue_tx, chat_queue_rx) = mpsc::unbounded_channel();
        let (bg_tx, bg_rx) = mpsc::channel(100);

        Self {
            options,
            steam_id: None,
            account: Arc::new(parking_lot::RwLock::new(AccountState::default())),
            apps: Arc::new(parking_lot::RwLock::new(AppsState::default())),
            social: Arc::new(parking_lot::RwLock::new(SocialState::default())),
            auth: Arc::new(parking_lot::RwLock::new(AuthState::default())),
            connect_time: 0,
            connection_count: 0,
            h_steam_pipe: (rng.gen_u32() % 1000000) + 1,
            gc_tokens: Vec::new(),
            active_tickets: Vec::new(),
            last_time_party_register: None,
            chat: ChatQueueState {
                tx: chat_queue_tx,
                rx: chat_queue_rx,
                rate_limit_until: None,
                pending_retry_message: None,
                tasks: tokio::task::JoinSet::new(),
            },
            connection: None,
            event_queue: VecDeque::new(),
            deferred_job_events: VecDeque::new(),
            reconnect_manager: crate::internal::reconnect::ReconnectManager::new(reconnect_config),
            heartbeat_manager: crate::internal::heartbeat::HeartbeatManager::new(HEARTBEAT_INTERVAL_SECONDS),
            job_manager: crate::internal::jobs::JobManager::new(),
            gc_jobs: crate::services::gc::GCJobManager::new(),
            background_job_tasks: HashMap::new(),
            background_job_results_tx: bg_tx,
            background_job_results_rx: bg_rx,
            session_recovery: crate::services::SessionRecovery::new(),
            http_client,
            clock,
            rng,
        }
    }

    /// Log on to Steam.
    pub async fn log_on(&mut self, details: LogOnDetails) -> Result<LogOnResponse, SteamError> {
        if self.steam_id.is_some() {
            return Err(SteamError::AlreadyLoggedOn);
        }

        if self.auth.read().connecting {
            return Err(SteamError::AlreadyConnecting);
        }

        self.auth.write().connecting = true;

        match self.execute_logon(details).await {
            Ok(response) => Ok(response),
            Err(e) => {
                match &e {
                    SteamError::SteamResult(steam_enums::EResult::AccountLoginDeniedThrottle) => {
                        crate::internal::limiter::penalize_abuse(std::time::Duration::from_secs(60), "AccountLoginDeniedThrottle");
                    }
                    SteamError::SteamResult(steam_enums::EResult::ServiceUnavailable) => {
                        crate::internal::limiter::penalize_abuse(std::time::Duration::from_secs(5), "ServiceUnavailable");
                    }
                    SteamError::SteamResult(steam_enums::EResult::TryAnotherCM) => {
                        crate::internal::limiter::penalize_abuse(std::time::Duration::from_secs(5), "TryAnotherCM");
                    }
                    _ => {}
                }
                self.auth.write().connecting = false;
                Err(e)
            }
        }
    }

    async fn execute_logon(&mut self, details: LogOnDetails) -> Result<LogOnResponse, SteamError> {
        self.auth.write().logging_off = false;

        info!("Starting Steam login...");
        crate::internal::limiter::wait_for_permit(crate::internal::limiter::LoginType::CMConnection).await;

        // Store logon details
        self.auth.write().logon_details = Some(details.clone());

        // Determine login type
        let is_web_logon = details.web_logon_token.is_some() && details.steam_id.is_some();
        let is_anonymous = !is_web_logon && details.anonymous || (details.account_name.is_none() && details.refresh_token.is_none() && !is_web_logon);

        // Set up temporary SteamID
        let mut temp_sid = SteamID::new();
        temp_sid.universe = steamid::Universe::Public;

        if is_web_logon {
            // Web logon token login (from clientjstoken)
            info!("Logging in with web logon token");
            if let Some(sid) = details.steam_id {
                temp_sid = sid;
            }
            temp_sid.account_type = steamid::AccountType::Individual;
        } else if is_anonymous {
            info!("Logging in anonymously");
            temp_sid.account_type = steamid::AccountType::AnonUser;
        } else if let Some(ref token) = details.refresh_token {
            info!("Logging in with refresh token");
            // Create login session from refresh token
            match LoginSession::from_refresh_token(token.clone()) {
                Ok(session) => {
                    if let Some(sid) = session.steam_id().cloned() {
                        temp_sid = sid;
                    }
                    self.auth.write().login_session = Some(session);
                }
                Err(e) => {
                    return Err(SteamError::InvalidToken(e.to_string()));
                }
            }
        } else if details.account_name.is_some() && details.password.is_some() {
            info!("Logging in with account name and password");
            temp_sid.account_type = steamid::AccountType::Individual;
        }

        self.auth.write().temp_steam_id = Some(temp_sid);

        // Get CM server list
        let provider = HttpCmServerProvider::new(self.http_client.clone(), self.rng.clone(), Arc::new(steam_cm_provider::RealConnectivityChecker));
        let server = provider.get_server().await?;
        info!("Connecting to CM server: {}", server.endpoint);
        let start_time = Instant::now();

        // Connect to CM
        let mut connection: Box<dyn SteamConnection> = Box::new(WebSocketConnection::connect(server).await?);
        debug!("WebSocket connection established in {}ms", start_time.elapsed().as_millis());

        // Generate session ID
        self.auth.write().session_id = (self.rng.gen_u32() & 0x7FFF_FFFF) as i32;

        // Send ClientHello (only if not using refresh token or web_logon_token,
        // matching node-steam-user behavior)
        let skip_hello = details.refresh_token.is_some() || details.web_logon_token.is_some();
        if !skip_hello {
            let hello = CMsgClientHello { protocol_version: Some(PROTOCOL_VERSION) };
            let hello_msg = self.create_proto_message(EMsg::ClientHello, &hello);
            connection.send(hello_msg.encode()).await?;
            debug!("Sent ClientHello");
        }

        // Build and send ClientLogon
        let logon = self.build_logon_message(&details, is_anonymous);
        let logon_msg = self.create_proto_message(EMsg::ClientLogon, &logon);
        connection.send(logon_msg.encode()).await?;
        debug!("Sent ClientLogon");

        // Wait for response
        let response = self.wait_for_logon_response(&mut *connection).await?;

        self.connection = Some(connection);
        self.auth.write().connecting = false;

        // Handle response
        let eresult = EResult::from_i32(response.eresult.unwrap_or(2)).unwrap_or(EResult::Fail);

        if eresult != EResult::OK {
            self.steam_id = None;
            return Err(SteamError::SteamResult(eresult));
        }

        // Success!
        let steam_id = if let Some(sid) = response.client_supplied_steamid {
            SteamID::from(sid)
        } else if let Some(sid) = self.auth.read().temp_steam_id {
            sid
        } else {
            return Err(SteamError::bad_response("Logon response missing client_supplied_steamid"));
        };

        self.steam_id = Some(steam_id);
        {
            let mut account = self.account.write();
            account.cell_id = response.cell_id;
            account.vanity_url = response.vanity_url.clone();

            if let Some(ref ip) = response.public_ip {
                if let Some(steam_protos::cmsg_ip_address::Ip::V4(v4)) = &ip.ip {
                    account.public_ip = Some(format!("{}.{}.{}.{}", (v4 >> 24) & 0xFF, (v4 >> 16) & 0xFF, (v4 >> 8) & 0xFF, v4 & 0xFF));
                }
            }
        }

        // Initialize heartbeat
        if let Some(secs) = response.heartbeat_seconds {
            if secs > 0 {
                self.heartbeat_manager.set_interval(secs as u64);
            }
        }
        self.heartbeat_manager.reset();

        let username = details.account_name.as_deref().unwrap_or("Unknown");
        info!("Logged on as steam_id: {}, username: {}", steam_id.steam_id64(), username);

        Ok(LogOnResponse {
            eresult,
            steam_id,
            public_ip: self.account.read().public_ip.clone(),
            cell_id: self.account.read().cell_id.unwrap_or(0),
            vanity_url: self.account.read().vanity_url.clone(),
            email_domain: response.email_domain.clone(),
            steam_guard_required: false,
            heartbeat_seconds: response.heartbeat_seconds,
            server_time: response.rtime32_server_time,
            account_flags: response.account_flags,
            user_country: response.user_country.clone(),
            ip_country_code: response.ip_country_code.clone(),
            client_instance_id: response.client_instance_id,
            token_id: response.token_id,
            family_group_id: response.family_group_id,
            eresult_extended: response.eresult_extended,
            cell_id_ping_threshold: response.cell_id_ping_threshold,
            force_client_update_check: response.force_client_update_check,
            agreement_session_url: response.agreement_session_url.clone(),
            legacy_out_of_game_heartbeat_seconds: response.legacy_out_of_game_heartbeat_seconds,
            parental_settings: response.parental_settings.clone(),
            parental_setting_signature: response.parental_setting_signature.clone(),
            count_loginfailures_to_migrate: response.count_loginfailures_to_migrate,
            count_disconnects_to_migrate: response.count_disconnects_to_migrate,
            ogs_data_report_time_window: response.ogs_data_report_time_window,
            steam2_ticket: response.steam2_ticket.clone(),
        })
    }

    /// Build the ClientLogon protobuf message.
    fn build_logon_message(&self, details: &LogOnDetails, is_anonymous: bool) -> CMsgClientLogon {
        use crate::protocol::messages::{build_client_logon, LogonConfig};

        // Generate machine name if not provided and not anonymous
        let machine_name = if details.machine_name.is_some() {
            details.machine_name.clone()
        } else if !is_anonymous {
            Some(format!("DESKTOP-{:06}", self.rng.gen_u32() % 1000000))
        } else {
            None
        };

        let identifier = if let Some(ref name) = details.account_name { Some(name.clone()) } else { self.auth.read().temp_steam_id.as_ref().map(|sid| sid.steam_id64().to_string()) };

        // Build config from current state
        let config = LogonConfig::new().with_cell_id(self.account.read().cell_id).with_machine_name(machine_name).with_identifier(identifier);

        // Delegate to pure function
        build_client_logon(&config, details, is_anonymous)
    }

    /// Wait for and parse the logon response.
    ///
    /// Drives `connection.recv()` (already async) inside a wall-clock timeout.
    /// Previously this used a bounded iteration count with a 100ms sleep
    /// between recvs, which (a) added up to 100ms of unnecessary latency to
    /// every logon and (b) made the effective timeout depend on incoming
    /// message rate. `tokio::time::timeout` gives a real 15s deadline regardless
    /// of how many Multi sub-messages we have to walk through.
    async fn wait_for_logon_response(&self, connection: &mut dyn SteamConnection) -> Result<CMsgClientLogonResponse, SteamError> {
        use std::io::Read;

        use flate2::read::GzDecoder;

        let work = async {
            loop {
                let data = match connection.recv().await? {
                    Some(d) => d,
                    None => return Err(SteamError::ConnectionError("Connection closed by server during login".into())),
                };

                let msg = SteamMessage::decode_from_bytes(&data)?;
                debug!("Received message: {:?}", msg.msg);

                if msg.msg == EMsg::ClientLogOnResponse {
                    return msg.decode_body::<CMsgClientLogonResponse>();
                }

                // Multi messages may contain the logon response nested inside.
                if msg.msg == EMsg::Multi {
                    let multi = match msg.decode_body::<steam_protos::CMsgMulti>() {
                        Ok(m) => m,
                        Err(e) => {
                            warn!("Failed to decode Multi message: {}", e);
                            continue;
                        }
                    };
                    let body = multi.message_body.unwrap_or_default();
                    let payload = if multi.size_unzipped.unwrap_or(0) > 0 {
                        // Gzip compressed — offload decompression to a blocking task
                        // to avoid stalling the async runtime.
                        let decompressed_result = tokio::task::spawn_blocking(move || {
                            let mut decoder = GzDecoder::new(&body[..]);
                            let mut decompressed = Vec::new();
                            if decoder.read_to_end(&mut decompressed).is_ok() {
                                Some(decompressed)
                            } else {
                                None
                            }
                        })
                        .await
                        .map_err(|e| SteamError::Other(format!("Task join error: {}", e)))?;

                        match decompressed_result {
                            Some(d) => d,
                            None => {
                                error!("Failed to decompress Multi message");
                                continue;
                            }
                        }
                    } else {
                        body
                    };

                    // Iterate over sub-messages
                    let mut offset = 0;
                    while offset + 4 <= payload.len() {
                        let sub_size = u32::from_le_bytes([payload[offset], payload[offset + 1], payload[offset + 2], payload[offset + 3]]) as usize;
                        offset += 4;

                        if offset + sub_size > payload.len() {
                            break;
                        }

                        let sub_data = &payload[offset..offset + sub_size];
                        match SteamMessage::decode_from_bytes(sub_data) {
                            Ok(sub_msg) => {
                                debug!("Received sub-message inside Multi: {:?}", sub_msg.msg);
                                if sub_msg.msg == EMsg::ClientLogOnResponse {
                                    return sub_msg.decode_body::<CMsgClientLogonResponse>();
                                }
                            }
                            Err(e) => {
                                warn!("Failed to decode sub-message inside Multi: {}", e);
                            }
                        }
                        offset += sub_size;
                    }
                }
            }
        };

        match tokio::time::timeout(LOGON_RESPONSE_TIMEOUT, work).await {
            Ok(result) => result,
            Err(_) => Err(SteamError::Timeout),
        }
    }

    /// Create a protobuf message with header.
    fn create_proto_message<T: Message>(&self, msg: EMsg, body: &T) -> SteamMessage {
        use crate::protocol::messages::{build_proto_header, create_steam_message};

        let steam_id = self.auth.read().temp_steam_id.as_ref().map(|s| s.steam_id64()).unwrap_or(0);
        let header = build_proto_header(self.auth.read().session_id, steam_id, u64::MAX, u64::MAX);

        create_steam_message(msg, header, body)
    }

    /// Log off from Steam.
    pub async fn log_off(&mut self) -> Result<(), SteamError> {
        if self.steam_id.is_none() {
            return Err(SteamError::NotLoggedOn);
        }

        info!("Logging off from Steam");
        self.auth.write().logging_off = true;

        // Create logoff message first (before borrowing connection)
        let logoff = CMsgClientLogOff::default();
        let msg = self.create_proto_message(EMsg::ClientLogOff, &logoff);

        // Send logoff message
        if let Some(ref mut conn) = self.connection {
            let _ = conn.send(msg.encode()).await;
        }

        // Close connection (capture result; always clear state regardless of outcome)
        let close_result = if let Some(conn) = self.connection.take() { conn.close().await } else { Ok(()) };

        // Clear state
        self.steam_id = None;
        *self.account.write() = AccountState::default();
        self.social.write().friends.clear();
        self.auth.write().logon_details = None;
        self.auth.write().session_id = 0;

        self.auth.write().logging_off = false;

        close_result
    }

    /// Log on with username and password using steam-session.
    ///
    /// This method handles the full password authentication flow including:
    /// - RSA password encryption
    /// - Starting an auth session with Steam
    /// - Obtaining a refresh token
    ///
    /// If Steam Guard is required, returns `SteamError::SteamGuardRequired`
    /// with details about what code is needed. Use
    /// [`submit_steam_guard_code`] to provide the code and complete
    /// authentication.
    ///
    /// On success, emits a `RefreshToken` event with the token that can be
    /// saved for future logins.
    ///
    /// # Example
    /// ```rust,ignore
    /// let result = client.log_on_with_password("username", "password", None, None).await;
    /// match result {
    ///     Ok(response) => tracing::info!("Logged in as {}", response.steam_id.steam3()),
    ///     Err(SteamError::SteamGuardRequired { guard_type, email_domain }) => {
    ///         tracing::info!("Need Steam Guard code: {:?}", guard_type);
    ///         // Get code from user, then call submit_steam_guard_code
    ///     }
    ///     Err(e) => tracing::info!("Login failed: {:?}", e),
    /// }
    /// ```
    pub async fn log_on_with_password(&mut self, account_name: &str, password: &str, steam_guard_code: Option<&str>, machine_auth_token: Option<&str>) -> Result<LogOnResponse, SteamError> {
        if self.steam_id.is_some() {
            return Err(SteamError::AlreadyLoggedOn);
        }

        if self.auth.read().connecting {
            return Err(SteamError::AlreadyConnecting);
        }

        debug!("Starting password authentication for {}", account_name);
        crate::internal::limiter::wait_for_permit(crate::internal::limiter::LoginType::WebAuth).await;

        // Create login session for Steam Client platform
        let mut session = LoginSession::new(EAuthTokenPlatformType::KEAuthTokenPlatformTypeSteamClient, Some(LoginSessionOptions { machine_friendly_name: Some(format!("DESKTOP-{}", self.rng.gen_u32() % 1000000)), ..Default::default() }));

        // Start authentication with credentials
        let credentials = CredentialsDetails {
            account_name: account_name.to_string(),
            password: password.to_string(),
            persistence: None,
            steam_guard_machine_token: machine_auth_token.map(|s| s.to_string()),
            steam_guard_code: steam_guard_code.map(|s| s.to_string()),
        };

        let start_result = match session.start_with_credentials(credentials).await {
            Ok(res) => res,
            Err(e) => {
                if let steam_auth::SessionError::SteamError(_, steam_enums::EResult::AccountLoginDeniedThrottle) = e {
                    crate::internal::limiter::penalize_abuse(std::time::Duration::from_secs(60), "AccountLoginDeniedThrottle");
                }
                return Err(SteamError::SessionError(e));
            }
        };

        // Check if action (Steam Guard) is required
        if start_result.action_required {
            if let Some(ref actions) = start_result.valid_actions {
                // Find the best action to report to user
                // Priority: EmailCode > DeviceCode > DeviceConfirmation
                let action = actions.iter().find(|a| matches!(a.guard_type, EAuthSessionGuardType::KEAuthSessionGuardTypeEmailCode)).or_else(|| actions.iter().find(|a| matches!(a.guard_type, EAuthSessionGuardType::KEAuthSessionGuardTypeDeviceCode))).or_else(|| actions.first());

                if let Some(action) = action {
                    debug!("Steam Guard required: {:?}", action.guard_type);

                    // Store session for later submission
                    self.auth.write().login_session = Some(session);

                    return Err(SteamError::SteamGuardRequired { guard_type: action.guard_type, email_domain: action.detail.clone() });
                }
            }

            // Shouldn't happen, but handle gracefully
            warn!("Action required but no valid actions returned");
            return Err(SteamError::InvalidCredentials);
        }

        // No Steam Guard needed, continue polling for result
        self.complete_password_auth(session, account_name).await
    }

    /// Submit a Steam Guard code to complete password authentication.
    ///
    /// Call this after [`log_on_with_password`] returns
    /// `SteamError::SteamGuardRequired`.
    ///
    /// # Example
    /// ```rust,ignore
    /// // After receiving SteamGuardRequired error:
    /// let code = get_code_from_user();
    /// let response = client.submit_steam_guard_code(&code).await?;
    /// tracing::info!("Logged in as {}", response.steam_id.steam3());
    /// ```
    pub async fn submit_steam_guard_code(&mut self, code: &str) -> Result<LogOnResponse, SteamError> {
        let session = self.auth.write().login_session.take().ok_or_else(|| SteamError::Other("No pending login session".to_string()))?;

        let account_name = session.account_name().map(|s| s.to_string()).unwrap_or_default();

        let mut session = session;
        session.submit_steam_guard_code(code).await?;

        self.complete_password_auth(session, &account_name).await
    }

    /// Complete password authentication by polling for tokens.
    async fn complete_password_auth(&mut self, mut session: LoginSession, account_name: &str) -> Result<LogOnResponse, SteamError> {
        // Poll for authentication result
        let poll_result = loop {
            match session.poll().await? {
                Some(result) => break result,
                None => {
                    // Wait before polling again
                    let interval = session.poll_interval();
                    self.clock.sleep(Duration::from_secs_f32(interval)).await;
                }
            }
        };

        debug!("Password authentication successful, got refresh token");
        debug!("Refresh token account: {}", poll_result.account_name);

        // Store machine token if we got one
        if let Some(ref _guard_data) = poll_result.new_guard_data {
            debug!("Received new Steam Guard machine token");
            // Store for future use (could be saved to disk by the user)
            self.auth.write().login_session = Some(session);
        }

        // Queue RefreshToken event
        self.event_queue.push_back(super::events::SteamEvent::Auth(super::events::AuthEvent::RefreshToken { token: poll_result.refresh_token.clone(), account_name: poll_result.account_name.clone() }));

        // Now log on with the refresh token
        self.log_on(LogOnDetails {
            refresh_token: Some(poll_result.refresh_token),
            account_name: Some(account_name.to_string()),
            ..Default::default()
        })
        .await
    }

    /// Log on to Steam using web session cookies.
    ///
    /// The cookies themselves are never sent to the CM. Instead, they are used
    /// to mint a short-lived web logon token via Steam's
    /// `/chat/clientjstoken` endpoint, and that token (together with the
    /// account name and SteamID returned by the endpoint) is what authenticates
    /// the CM logon.
    ///
    /// # Arguments
    /// * `cookies` - Web session cookies for steamcommunity.com (must contain
    ///   at least `steamLoginSecure`, e.g.
    ///   `"sessionid=xxx; steamLoginSecure=yyy"`).
    ///
    /// # Errors
    /// - `SteamError::InvalidCredentials` if the cookies are not logged in or
    ///   the endpoint returns no token.
    /// - `SteamError::NetworkError` / `SteamError::ProtocolError` on HTTP or
    ///   parsing failures.
    ///
    /// # Example
    /// ```rust,ignore
    /// let cookies = "sessionid=...; steamLoginSecure=...";
    /// let response = client.log_on_with_cookies(cookies).await?;
    /// tracing::info!("Logged in as {}", response.steam_id);
    /// ```
    pub async fn log_on_with_cookies(&mut self, cookies: &str) -> Result<LogOnResponse, SteamError> {
        if self.steam_id.is_some() {
            return Err(SteamError::AlreadyLoggedOn);
        }
        if self.auth.read().connecting {
            return Err(SteamError::AlreadyConnecting);
        }

        crate::internal::limiter::wait_for_permit(crate::internal::limiter::LoginType::WebAuth).await;

        let (web_logon_token, account_name, steam_id) = fetch_client_js_token(self.http_client.as_ref(), cookies).await?;

        debug!("Minted web logon token for {} ({})", account_name, steam_id);

        self.log_on(LogOnDetails {
            web_logon_token: Some(web_logon_token),
            account_name: Some(account_name),
            steam_id: Some(steam_id),
            ..Default::default()
        })
        .await
    }

    /// Force reset the connecting state.
    /// Use this if a connection attempt is cancelled externally (e.g. by a
    /// timeout).
    pub fn reset_connecting_state(&mut self) {
        self.auth.write().connecting = false;
    }

    /// Get web session cookies for Steam web APIs.
    ///
    /// This method fetches cookies that can be used to authenticate with Steam
    /// web services like steamcommunity.com and store.steampowered.com. It
    /// requires a valid login session with a refresh token (not available
    /// for web_logon_token or anonymous logins).
    ///
    /// On success, this also queues a `WebSession` event with the session data.
    ///
    /// # Returns
    /// - `Ok((session_id, cookies))` - The session ID and cookies for web
    ///   authentication.
    /// - `Err(SteamError::NotLoggedOn)` - If not logged in.
    /// - `Err(SteamError::Other)` - If no login session is available (e.g.,
    ///   web_logon_token login).
    ///
    /// # Example
    /// ```rust,ignore
    /// let (session_id, cookies) = client.get_web_session().await?;
    /// tracing::info!("Session ID: {}", session_id);
    /// for cookie in &cookies {
    ///     tracing::info!("Cookie: {}", cookie);
    /// }
    /// ```
    pub async fn get_web_session(&mut self) -> Result<(String, Vec<String>), SteamError> {
        if self.steam_id.is_none() {
            return Err(SteamError::NotLoggedOn);
        }

        // Take the session out (we can't hold the write guard across the HTTP
        // `.await`), run the call, then put it back.
        let mut session = self.auth.write().login_session.take().ok_or_else(|| SteamError::Other("No login session available. Web session requires refresh token login.".to_string()))?;

        let cookies_result = session.get_web_cookies().await;
        self.auth.write().login_session = Some(session);
        let cookies = cookies_result.map_err(|e| SteamError::Other(format!("Failed to get web cookies: {}", e)))?;

        // Extract session ID from cookies
        let session_id = cookies.iter().find(|c| c.starts_with("sessionid=")).and_then(|c| c.strip_prefix("sessionid=")).and_then(|c| c.split(';').next()).map(|s| s.to_string()).unwrap_or_else(|| {
            // Generate a session ID if not in cookies
            format!("{:x}", self.rng.gen_u64())
        });

        // Queue WebSession event
        self.event_queue.push_back(super::events::SteamEvent::Auth(super::events::AuthEvent::WebSession { session_id: session_id.clone(), cookies: cookies.clone() }));

        Ok((session_id, cookies))
    }

    /// Helper to send a binary message.
    pub(crate) async fn send_binary_message(&mut self, msg_type: EMsg, body: &[u8]) -> Result<(), SteamError> {
        use crate::protocol::{ExtendedMessageHeader, MessageHeader, SteamMessage};

        let header = ExtendedMessageHeader {
            header_size: 36,
            header_version: 2,
            target_job_id: u64::MAX,
            source_job_id: u64::MAX,
            header_canary: 239,
            steam_id: self.steam_id.as_ref().map(|s| s.steam_id64()).unwrap_or(0),
            session_id: self.auth.read().session_id,
        };

        let msg = SteamMessage {
            msg: msg_type,
            is_proto: false,
            header: MessageHeader::Extended(header),
            body: bytes::Bytes::copy_from_slice(body),
        };

        if let Some(ref mut conn) = self.connection {
            conn.send(msg.encode()).await?;
        }

        Ok(())
    }

    /// Helper to send a protobuf message.
    pub(crate) async fn send_message<T: Message>(&mut self, msg_type: EMsg, body: &T) -> Result<(), SteamError> {
        use crate::protocol::{ProtobufMessageHeader, SteamMessage};

        let header = ProtobufMessageHeader {
            header_length: 0,
            session_id: self.auth.read().session_id,
            steam_id: self.steam_id.as_ref().map(|s| s.steam_id64()).unwrap_or(0),
            job_id_source: u64::MAX,
            job_id_target: u64::MAX,
            target_job_name: None,
            routing_appid: None,
        };

        let msg = SteamMessage::new_proto(msg_type, header, body);

        if let Some(ref mut conn) = self.connection {
            conn.send(msg.encode()).await?;
        }

        Ok(())
    }

    /// Helper to send a protobuf message with routing app ID.
    pub(crate) async fn send_message_with_routing<T: Message>(&mut self, msg_type: EMsg, routing_appid: u32, body: &T) -> Result<(), SteamError> {
        use crate::protocol::{ProtobufMessageHeader, SteamMessage};

        let header = ProtobufMessageHeader {
            header_length: 0,
            session_id: self.auth.read().session_id,
            steam_id: self.steam_id.as_ref().map(|s| s.steam_id64()).unwrap_or(0),
            job_id_source: u64::MAX,
            job_id_target: u64::MAX,
            target_job_name: None,
            routing_appid: Some(routing_appid),
        };

        let msg = SteamMessage::new_proto(msg_type, header, body);

        if let Some(ref mut conn) = self.connection {
            conn.send(msg.encode()).await?;
        }

        Ok(())
    }

    /// Helper to send a protobuf message with job tracking for request-response
    /// correlation.
    ///
    /// Returns a receiver that will receive the response body when Steam
    /// replies. The job ID is automatically set in the message header.
    pub(crate) async fn send_message_with_job<T: Message>(&mut self, msg_type: EMsg, body: &T) -> Result<tokio::sync::oneshot::Receiver<crate::internal::jobs::JobResponse>, SteamError> {
        use crate::protocol::{ProtobufMessageHeader, SteamMessage};

        // Create a job to track this request
        let (job_id, response_rx) = self.job_manager.create_job().await;
        info!("[SteamClient] send_message_with_job: Created JobID={} for EMsg::{:?}", job_id, msg_type);

        let header = ProtobufMessageHeader {
            header_length: 0,
            session_id: self.auth.read().session_id,
            steam_id: self.steam_id.as_ref().map(|s| s.steam_id64()).unwrap_or(0),
            job_id_source: job_id,
            job_id_target: u64::MAX,
            target_job_name: None,
            routing_appid: None,
        };

        let msg = SteamMessage::new_proto(msg_type, header, body);

        if let Some(ref mut conn) = self.connection {
            conn.send(msg.encode()).await?;
        }

        Ok(response_rx)
    }

    /// Process a queued message.
    async fn process_queued_message(&mut self, msg: QueuedMessage) {
        info!("[SteamClient] process_queued_message: Processing message to {}", msg.friend);

        // Match JS behavior: escape [ chars if contains_bbcode
        let processed_message = if msg.contains_bbcode { msg.message.replace('[', "\\[") } else { msg.message.clone() };

        debug!("[SteamClient] process_queued_message: Original len={}, Processed len={}", msg.message.len(), processed_message.len());

        let request = steam_protos::CFriendMessagesSendMessageRequest {
            steamid: Some(msg.friend.steam_id64()),
            chat_entry_type: Some(msg.entry_type as i32),
            message: Some(processed_message),
            contains_bbcode: Some(msg.contains_bbcode),
            ..Default::default()
        };

        info!("[SteamClient] process_queued_message: Sending FriendMessages.SendMessage#1 to Steam");

        // Send the request and get a job receiver
        match self.send_service_method_with_job("FriendMessages.SendMessage#1", &request).await {
            Ok(rx) => {
                info!("[SteamClient] process_queued_message: Request sent, waiting for response...");
                let friend_id = msg.friend;
                let original_message = msg.message.clone();

                // Spawn task into JoinSet with timeout and tracing span
                self.chat.tasks.spawn(
                    async move {
                        const CHAT_TIMEOUT_SECS: u64 = 30;

                        debug!("[SteamClient] chat_task: Waiting for response (timeout: {}s)", CHAT_TIMEOUT_SECS);

                        let res = match tokio::time::timeout(std::time::Duration::from_secs(CHAT_TIMEOUT_SECS), rx).await {
                            Ok(Ok(crate::internal::jobs::JobResponse::Success(body))) => {
                                info!("[SteamClient] chat_task: Received Success response, body len={}", body.len());
                                steam_protos::CFriendMessagesSendMessageResponse::decode(&body[..])
                                    .map(|response| {
                                        info!("[SteamClient] chat_task: Decoded response - server_ts={}, ordinal={}", response.server_timestamp.unwrap_or(0), response.ordinal.unwrap_or(0));
                                        crate::services::chat::SendMessageResult {
                                            modified_message: response.modified_message.unwrap_or(original_message),
                                            server_timestamp: response.server_timestamp.unwrap_or(0),
                                            ordinal: response.ordinal.unwrap_or(0),
                                        }
                                    })
                                    .map_err(|e| {
                                        error!("[SteamClient] chat_task: Failed to decode response: {:?}", e);
                                        SteamError::DeserializationFailed
                                    })
                            }
                            Ok(Ok(crate::internal::jobs::JobResponse::Timeout)) => {
                                error!("[SteamClient] chat_task: Job response timeout (Steam didn't respond)");
                                Err(SteamError::ResponseTimeout)
                            }
                            Ok(Ok(crate::internal::jobs::JobResponse::Error(e))) => {
                                error!("[SteamClient] chat_task: Job response error: {}", e);
                                Err(SteamError::ProtocolError(e))
                            }
                            Ok(Err(e)) => {
                                error!("[SteamClient] chat_task: Job channel closed: {:?}", e);
                                Err(SteamError::Other("Job response channel closed".into()))
                            }
                            Err(_) => {
                                // Timeout elapsed
                                error!("[SteamClient] chat_task: Tokio timeout elapsed after {}s", CHAT_TIMEOUT_SECS);
                                Err(SteamError::ResponseTimeout)
                            }
                        };

                        match &res {
                            Ok(r) => info!("[SteamClient] chat_task: Final result SUCCESS - ts={}", r.server_timestamp),
                            Err(e) => error!("[SteamClient] chat_task: Final result ERROR - {:?}", e),
                        }

                        (msg, res)
                    }
                    .instrument(info_span!("chat_send", friend = %friend_id)),
                );
            }
            Err(e) => {
                // Failed to even send the request (maybe disconnected)
                error!("[SteamClient] process_queued_message: Failed to send request to Steam: {:?}", e);
                let _ = msg.respond_to.send(Err(e));
            }
        }
    }

    /// Send a unified service method request and wait for the response.
    ///
    /// This handles the common pattern of sending a request with job tracking,
    /// waiting for the response, decoding it, and mapping errors.
    pub async fn send_unified_request_and_wait<T, R>(&mut self, method: &str, request: &T) -> Result<R, SteamError>
    where
        T: prost::Message,
        R: prost::Message + Default,
    {
        use crate::internal::jobs::JobResponse;

        // Send with job tracking
        let response_rx = self.send_service_method_with_job(method, request).await?;

        // Wait for response
        match response_rx.await {
            Ok(JobResponse::Success(body)) => R::decode(&body[..]).map_err(|e| SteamError::ProtocolError(format!("Failed to decode response: {}", e))),
            Ok(JobResponse::Timeout) => Err(SteamError::Timeout),
            Ok(JobResponse::Error(e)) => Err(SteamError::Other(e)),
            Err(_) => Err(SteamError::Other("Job response channel closed".into())),
        }
    }

    /// Send a protobuf request and wait for the response.
    ///
    /// This handles the common pattern of sending a request with job tracking,
    /// waiting for the response, decoding it, and mapping errors.
    pub async fn send_request_and_wait<T, R>(&mut self, emsg: EMsg, request: &T) -> Result<R, SteamError>
    where
        T: prost::Message,
        R: prost::Message + Default,
    {
        // Send with job tracking
        let response_rx = self.send_message_with_job(emsg, request).await?;

        // The connection has no background reader. Drive it until the matching
        // job response arrives, retaining unrelated events for the caller.
        let mut response_rx = response_rx;
        loop {
            tokio::select! {
                biased;
                response = &mut response_rx => {
                    return match response {
                        Ok(crate::internal::jobs::JobResponse::Success(body)) => R::decode(&body[..]).map_err(|e| SteamError::ProtocolError(format!("Failed to decode response: {}", e))),
                        Ok(crate::internal::jobs::JobResponse::Timeout) => Err(SteamError::Timeout),
                        Ok(crate::internal::jobs::JobResponse::Error(e)) => Err(SteamError::Other(e)),
                        Err(_) => Err(SteamError::Other("Job response channel closed".into())),
                    };
                }
                event = self.poll_connection_event() => {
                    match event? {
                        Some(event @ super::events::SteamEvent::Connection(super::events::ConnectionEvent::Disconnected { .. })) => {
                            self.deferred_job_events.push_back(event);
                            return Err(SteamError::NotConnected);
                        }
                        Some(event) => self.deferred_job_events.push_back(event),
                        None => return Err(SteamError::NotConnected),
                    }
                }
            }
        }
    }

    /// Poll for incoming events.
    ///
    /// This method receives messages from the Steam connection and returns
    /// decoded events. Call this in a loop to process incoming messages.
    /// It also handles automatic reconnection when disconnected.
    ///
    /// # Example
    /// ```rust,ignore
    /// loop {
    ///     if let Some(event) = client.poll_event().await? {
    ///         match event {
    ///             SteamEvent::FriendMessage { sender, message, .. } => {
    ///                 tracing::info!("{} says: {}", sender, message);
    ///             }
    ///             SteamEvent::PersonaState(persona) => {
    ///                 tracing::info!("{} is now {:?}", persona.player_name, persona.persona_state);
    ///             }
    ///             SteamEvent::ReconnectAttempt { attempt, max_attempts, .. } => {
    ///                 tracing::info!("Reconnecting... attempt {}/{}", attempt, max_attempts);
    ///             }
    ///             SteamEvent::Disconnected { will_reconnect, .. } => {
    ///                 if !will_reconnect {
    ///                     break; // Exit loop on permanent disconnect
    ///                 }
    ///             }
    ///             _ => {}
    ///         }
    ///     }
    /// }
    /// ```
    pub async fn poll_event(&mut self) -> Result<Option<super::events::SteamEvent>, SteamError> {
        if let Some(event) = self.deferred_job_events.pop_front() {
            return Ok(Some(event));
        }
        self.poll_connection_event().await
    }

    async fn poll_connection_event(&mut self) -> Result<Option<super::events::SteamEvent>, SteamError> {
        use super::events::{ConnectionEvent, SteamEvent};

        // First check if we have queued events from a previous Multi message
        if let Some(mut event) = self.event_queue.pop_front() {
            self.handle_event(&mut event);
            self.post_process_event(&event).await;
            return Ok(Some(event));
        }

        // Cleanup expired jobs
        self.job_manager.cleanup_expired().await;

        // Check if we should attempt reconnection
        if self.reconnect_manager.is_reconnecting() {
            if let Some(attempt) = self.reconnect_manager.check_ready() {
                let delay = self.reconnect_manager.current_delay();
                let max_attempts = self.reconnect_manager.max_attempts();

                // Queue the reconnect attempt event
                self.event_queue.push_back(SteamEvent::Connection(ConnectionEvent::ReconnectAttempt { attempt, max_attempts, delay }));

                // Attempt reconnection
                match self.attempt_reconnect().await {
                    Ok(()) => {
                        // Successful reconnection - reset manager and continue
                        self.reconnect_manager.record_success();
                        info!("Reconnection successful");

                        // Restore session state
                        if let Err(e) = self.restore_session_state().await {
                            warn!("Failed to restore session state: {}", e);
                        }
                    }
                    Err(e) => {
                        // Failed reconnection attempt
                        warn!("Reconnection attempt {} failed: {:?}", attempt, e);

                        let server = self.auth.write().last_cm_server.take();
                        let should_continue = self.reconnect_manager.record_failure(server.as_ref());

                        if !should_continue {
                            // Max attempts reached
                            let reason = self.reconnect_manager.last_disconnect_reason();
                            let attempts = self.reconnect_manager.attempt();

                            return Ok(Some(SteamEvent::Connection(ConnectionEvent::ReconnectFailed { reason, attempts })));
                        }
                    }
                }
            } else if let Some(wait_time) = self.reconnect_manager.time_until_next_attempt() {
                // Still waiting for backoff - sleep briefly and return no event
                // We don't want to block the full backoff period, so use a short sleep
                let sleep_time = wait_time.min(Duration::from_millis(100));
                self.clock.sleep(sleep_time).await;
            }
        }

        // Process queued events first
        if let Some(mut event) = self.event_queue.pop_front() {
            self.handle_event(&mut event);
            self.post_process_event(&event).await;
            return Ok(Some(event));
        }

        loop {
            // Check retry message first (priority over network?)
            // We check it at start of loop.
            if let Some(msg) = self.chat.pending_retry_message.take() {
                let rate_limited = self.chat.rate_limit_until.map(|t| t > self.clock.now()).unwrap_or(false);

                if !rate_limited {
                    self.process_queued_message(msg).await;
                    // Loop again to process effects or next
                } else {
                    // Put it back
                    self.chat.pending_retry_message = Some(msg);
                }
            }

            // Determine if we can process queue
            let rate_limited = self.chat.rate_limit_until.map(|t| t > self.clock.now()).unwrap_or(false);
            let can_process_queue = !rate_limited && self.chat.pending_retry_message.is_none();

            // Check connection
            if self.connection.is_none() {
                return Ok(None);
            }

            // Calculate timeout for recv (heartbeat)
            let now = self.clock.now();
            let hb_timeout = self.heartbeat_manager.time_until_next_heartbeat(now);

            // Check if immediate heartbeat needed
            if let Some(timeout) = hb_timeout {
                if timeout == Duration::ZERO {
                    debug!("Sending heartbeat");
                    let msg = crate::internal::heartbeat::HeartbeatManager::build_heartbeat_message(self.auth.read().session_id, self.steam_id.as_ref().map(|s| s.steam_id64()).unwrap_or(0));

                    // We wrap send in block to limit borrow scope
                    let result = {
                        if let Some(conn) = self.connection.as_mut() {
                            conn.send(msg.encode()).await
                        } else {
                            Err(SteamError::NotConnected)
                        }
                    };

                    if let Err(e) = result {
                        warn!("Failed to send heartbeat: {}", e);
                        // Connection likely dead
                        let reason = match &e {
                            SteamError::SteamResult(r) => Some(*r),
                            _ => Some(EResult::NoConnection),
                        };
                        return self.handle_connection_close(reason);
                    }

                    self.heartbeat_manager.record_heartbeat(self.clock.now());
                    continue;
                }
            }

            enum PollResult {
                Packet(Option<bytes::Bytes>),
                Queue(QueuedMessage),
                ChatResponse(QueuedMessage, Result<crate::services::chat::SendMessageResult, SteamError>),
                BackgroundResult(u64, Result<Bytes, SteamError>),
                Timeout,
            }

            let poll_res: Result<PollResult, SteamError> = {
                let conn = self.connection.as_mut().unwrap();
                let queue = &mut self.chat.rx;

                let recv_fut = conn.recv();

                // Determine timeout duration
                // We want to wake up for:
                // 1. Next heartbeat
                // 2. Next rate limit expiration (if we have a pending retry or want to process
                //    queue)
                let rate_limit_timeout = self.chat.rate_limit_until.map(|t| {
                    let now = self.clock.now();
                    if t > now {
                        t - now
                    } else {
                        Duration::ZERO
                    }
                });

                let sleep_duration = match (hb_timeout, rate_limit_timeout) {
                    (Some(hb), Some(rl)) => Some(hb.min(rl)),
                    (Some(hb), None) => Some(hb),
                    (None, Some(rl)) => Some(rl),
                    (None, None) => None,
                };

                tokio::select! {
                    res = recv_fut => {
                        Ok(PollResult::Packet(res?))
                    }
                    Some(msg) = queue.recv(), if can_process_queue => {
                        Ok(PollResult::Queue(msg))
                    }
                    Some(join_result) = self.chat.tasks.join_next() => {
                        match join_result {
                            Ok((msg, res)) => Ok(PollResult::ChatResponse(msg, res)),
                            Err(e) => {
                                // Task panicked or was cancelled
                                warn!("Chat task failed: {:?}", e);
                                Ok(PollResult::Timeout) // Treat as a non-event
                            }
                        }
                    }
                    res = self.background_job_results_rx.recv() => {
                        match res {
                            Some((job_id, result)) => Ok(PollResult::BackgroundResult(job_id, result)),
                            None => Ok(PollResult::Timeout),
                        }
                    }
                    _ = async {
                         if let Some(d) = sleep_duration {
                             tokio::time::sleep(d).await;
                         } else {
                             std::future::pending::<()>().await;
                         }
                    } => {
                        Ok(PollResult::Timeout)
                    }
                }
            };

            match poll_res {
                Ok(PollResult::Packet(Some(data))) => {
                    // Decode the message(s)
                    let messages = super::events::MessageHandler::decode_packet(&data);

                    for decoded in messages {
                        // Complete any pending job if this is a response
                        if let Some(job_id) = decoded.job_id_target {
                            info!("[SteamClient] poll_event: Completing job {} via job_manager", job_id);
                            self.job_manager.complete_job_success(job_id, decoded.body).await;
                        }

                        // Check for GC events and complete pending GC jobs
                        for event in &decoded.events {
                            if let super::events::SteamEvent::Apps(super::events::AppsEvent::GCReceived(gc_msg)) = event {
                                self.gc_jobs.try_complete(gc_msg.appid, gc_msg.msg_type, gc_msg.payload.clone());
                            }
                        }

                        // Queue all events
                        self.event_queue.extend(decoded.events);
                    }

                    // Return the first event if available
                    if let Some(mut event) = self.event_queue.pop_front() {
                        self.handle_event(&mut event);
                        self.post_process_event(&event).await;
                        return Ok(Some(event));
                    }
                }
                Ok(PollResult::Packet(None)) => {
                    // Connection closed
                    return self.handle_connection_close(None);
                }
                Ok(PollResult::Queue(msg)) => {
                    info!("[SteamClient] poll_event: Dequeued message from chat_queue_rx for {}", msg.friend);
                    self.process_queued_message(msg).await;
                    // Loop to process next
                }
                Ok(PollResult::ChatResponse(msg, result)) => {
                    info!("[SteamClient] poll_event: Received ChatResponse for {}", msg.friend);
                    match result {
                        Ok(res) => {
                            info!("[SteamClient] poll_event: ChatResponse SUCCESS - server_ts={}", res.server_timestamp);
                            let _ = msg.respond_to.send(Ok(res));
                        }
                        Err(SteamError::SteamResult(steam_enums::EResult::RateLimitExceeded)) => {
                            warn!("[SteamClient] poll_event: Rate limit exceeded for chat message, backing off for 60 seconds");
                            crate::internal::limiter::penalize_abuse(std::time::Duration::from_secs(60), "RateLimitExceeded");
                            self.chat.rate_limit_until = Some(self.clock.now() + std::time::Duration::from_secs(60));
                            self.chat.pending_retry_message = Some(msg);
                        }
                        Err(e) => {
                            error!("[SteamClient] poll_event: ChatResponse ERROR - {:?}", e);
                            let _ = msg.respond_to.send(Err(e));
                        }
                    }
                }
                Ok(PollResult::BackgroundResult(job_id, result)) => {
                    debug!("[SteamClient] poll_event: Received BackgroundResult for job {}", job_id);
                    if let Some(task) = self.background_job_tasks.remove(&job_id) {
                        match task {
                            BackgroundTask::FriendsList => match result {
                                Ok(body) => {
                                    debug!("[SteamClient] poll_event: Decoding FriendsList response (len={})", body.len());
                                    match steam_protos::CFriendsListGetFriendsListResponse::decode(&body[..]) {
                                        Ok(response) => {
                                            debug!("[SteamClient] poll_event: Successfully decoded FriendsList, processing...");
                                            self.handle_friends_list_unified_response(response).await;
                                        }
                                        Err(e) => {
                                            error!("[SteamClient] poll_event: Failed to decode FriendsList response: {:?}", e);
                                        }
                                    }
                                }
                                Err(e) => {
                                    error!("[SteamClient] poll_event: Background FriendsList job failed: {:?}", e);
                                }
                            },
                            BackgroundTask::OfflineMessages(friend_id) => match result {
                                Ok(body) => {
                                    debug!("[SteamClient] poll_event: Decoding OfflineMessages response for {} (len={})", friend_id, body.len());
                                    match steam_protos::CFriendMessagesGetRecentMessagesResponse::decode(&body[..]) {
                                        Ok(response) => {
                                            debug!("[SteamClient] poll_event: Successfully decoded OfflineMessages, processing...");
                                            let last_view_timestamp = self.social.read().chat_last_view.get(&friend_id).copied().unwrap_or(0);

                                            let messages = response
                                                .messages
                                                .into_iter()
                                                .map(|m| crate::services::chat::HistoryMessage {
                                                    sender: SteamID::from_steam_id64(m.accountid.unwrap_or(0) as u64),
                                                    timestamp: m.timestamp.unwrap_or(0),
                                                    ordinal: m.ordinal.unwrap_or(0),
                                                    message: m.message.unwrap_or_default(),
                                                    unread: m.timestamp.unwrap_or(0) > last_view_timestamp,
                                                })
                                                .collect();

                                            self.event_queue.push_back(crate::client::events::SteamEvent::Chat(crate::client::events::ChatEvent::OfflineMessagesFetched { friend_id, messages }));
                                        }
                                        Err(e) => {
                                            error!("[SteamClient] poll_event: Failed to decode OfflineMessages response: {:?}", e);
                                        }
                                    }
                                }
                                Err(e) => {
                                    error!("[SteamClient] poll_event: Background OfflineMessages job failed for {}: {:?}", friend_id, e);
                                }
                            },
                        }

                        // Check if the background task added events to the queue (e.g., FriendsList
                        // event)
                        if let Some(mut event) = self.event_queue.pop_front() {
                            self.handle_event(&mut event);
                            self.post_process_event(&event).await;
                            return Ok(Some(event));
                        }
                    } else {
                        warn!("[SteamClient] poll_event: Received BackgroundResult for unknown job {}", job_id);
                    }
                }
                Ok(PollResult::Timeout) => {
                    // Heartbeat deadline reached, loop will handle it
                }
                Err(e) => {
                    // Connection error
                    let reason = match &e {
                        SteamError::SteamResult(r) => Some(*r),
                        _ => Some(EResult::NoConnection),
                    };
                    return self.handle_connection_close(reason);
                }
            }
        }
    }

    /// Handle a connection close and decide whether to reconnect.
    fn handle_connection_close(&mut self, reason: Option<EResult>) -> Result<Option<super::events::SteamEvent>, SteamError> {
        use super::events::{ConnectionEvent, SteamEvent};

        debug!("Handling connection close, reason: {:?}", reason);

        // Clean up connection state
        self.connection = None;
        self.auth.write().connecting = false;

        // Determine if we should reconnect
        let should_reconnect = !self.auth.read().logging_off && self.options.auto_relogin && reason.map(|r| self.reconnect_manager.should_reconnect(r)).unwrap_or(true);

        if should_reconnect && self.auth.read().logon_details.is_some() {
            // Start reconnection sequence
            let eresult = reason.unwrap_or(EResult::NoConnection);
            self.reconnect_manager.start_reconnection(eresult);

            // Blacklist the last server if available
            if let Some(server) = self.auth.read().last_cm_server.clone() {
                self.reconnect_manager.blacklist_server(&server.endpoint);
            }

            info!("Connection lost, will attempt reconnection");
        } else {
            // Not reconnecting - clear state
            self.steam_id = None;
            self.reconnect_manager.reset();
            self.auth.write().relogging = false;
            self.auth.write().logging_off = false;
        }

        Ok(Some(SteamEvent::Connection(ConnectionEvent::Disconnected { reason, will_reconnect: should_reconnect })))
    }

    /// Restore session state (games played, rich presence, etc.) after
    /// reconnection.
    async fn restore_session_state(&mut self) -> Result<(), SteamError> {
        info!("Restoring session state...");

        // Restore games played
        let app_ids = self.session_recovery.last_playing_app_ids.clone();
        if !app_ids.is_empty() {
            debug!("Restoring games played: {:?}", app_ids);
            self.games_played_with_extra(app_ids, self.session_recovery.last_custom_game_name.clone()).await?;
        }

        // Restore persona state
        if let Some(state) = self.session_recovery.last_persona_state {
            debug!("Restoring persona state: {:?}", state);
            self.set_persona(state, self.session_recovery.last_player_name.clone()).await?;
        }

        // Restore rich presence
        let rp_data = self.session_recovery.last_rich_presence.clone();
        for (app_id, data) in rp_data {
            debug!("Restoring rich presence for app {}", app_id);
            self.upload_rich_presence(app_id, &data).await?;
        }

        Ok(())
    }

    /// Attempt to reconnect to Steam.
    async fn attempt_reconnect(&mut self) -> Result<(), SteamError> {
        // Get stored logon details
        let details = self.auth.read().logon_details.clone().ok_or_else(|| SteamError::Other("No logon details available for reconnection".to_string()))?;

        debug!("Attempting reconnection with stored credentials");

        // Get CM server list
        let provider = HttpCmServerProvider::new(self.http_client.clone(), self.rng.clone(), Arc::new(steam_cm_provider::RealConnectivityChecker));
        let server = provider.get_server().await?;
        self.auth.write().last_cm_server = Some(server.clone());

        info!("Reconnecting to CM server: {}", server.endpoint);

        // Connect to CM
        let mut connection: Box<dyn SteamConnection> = Box::new(WebSocketConnection::connect(server).await?);
        debug!("WebSocket connection established");

        // Generate new session ID
        self.auth.write().session_id = (self.rng.gen_u32() & 0x7FFF_FFFF) as i32;

        // Send ClientHello (only if not using refresh token)
        if details.refresh_token.is_none() {
            let hello = CMsgClientHello { protocol_version: Some(PROTOCOL_VERSION) };
            let hello_msg = self.create_proto_message(EMsg::ClientHello, &hello);
            connection.send(hello_msg.encode()).await?;
        }

        // Determine login type
        let is_anonymous = details.anonymous || (details.account_name.is_none() && details.refresh_token.is_none());

        // Build and send ClientLogon
        let logon = self.build_logon_message(&details, is_anonymous);
        let logon_msg = self.create_proto_message(EMsg::ClientLogon, &logon);
        connection.send(logon_msg.encode()).await?;

        // Wait for response
        let response = self.wait_for_logon_response(&mut *connection).await?;

        // Handle response
        let eresult = EResult::from_i32(response.eresult.unwrap_or(2)).unwrap_or(EResult::Fail);

        if eresult != EResult::OK {
            return Err(SteamError::SteamResult(eresult));
        }

        // Success! Update connection state
        self.connection = Some(connection);
        self.auth.write().connecting = false;

        // Update SteamID
        if let Some(sid) = response.client_supplied_steamid {
            self.steam_id = Some(SteamID::from(sid));
        }

        {
            let mut account = self.account.write();
            account.cell_id = response.cell_id;
            account.vanity_url = response.vanity_url.clone();

            if let Some(ref ip) = response.public_ip {
                if let Some(steam_protos::cmsg_ip_address::Ip::V4(v4)) = &ip.ip {
                    account.public_ip = Some(format!("{}.{}.{}.{}", (v4 >> 24) & 0xFF, (v4 >> 16) & 0xFF, (v4 >> 8) & 0xFF, v4 & 0xFF));
                }
            }
        }

        info!("Successfully reconnected");
        Ok(())
    }

    /// Poll all available events.
    ///
    /// This is useful for processing all events at once, including all
    /// sub-messages from Multi messages.
    pub async fn poll_events(&mut self) -> Result<Vec<super::events::SteamEvent>, SteamError> {
        let mut all_events = Vec::new();

        while let Some(event) = self.poll_event().await? {
            all_events.push(event);

            // If no more queued events, break to avoid blocking
            if self.event_queue.is_empty() {
                break;
            }
        }

        Ok(all_events)
    }

    /// Handle an event internally to update client state.
    fn handle_event(&mut self, event: &mut super::events::SteamEvent) {
        use super::events::{AppsEvent, AuthEvent, ConnectionEvent, FriendsEvent, SteamEvent};

        match event {
            SteamEvent::Auth(AuthEvent::LoggedOn { steam_id }) => {
                self.steam_id = Some(*steam_id);
                self.auth.write().connecting = false;
                // Reset reconnection state on successful login
                self.reconnect_manager.record_success();
            }
            SteamEvent::Auth(AuthEvent::LoggedOff { .. }) => {
                self.steam_id = None;
            }
            SteamEvent::Auth(AuthEvent::GameConnectTokens { tokens }) => {
                self.gc_tokens.extend(tokens.clone());
            }
            SteamEvent::Friends(FriendsEvent::FriendsList { friends, .. }) => {
                for friend in friends {
                    if friend.relationship == steam_enums::EFriendRelationship::None {
                        self.social.write().friends.remove(&friend.steam_id);
                    } else {
                        self.social.write().friends.insert(friend.steam_id, friend.relationship as u32);
                    }
                }
            }
            SteamEvent::Friends(FriendsEvent::PersonaState(persona)) => {
                let mut persona = *persona.clone();
                if let Some(game_id) = persona.game_id {
                    let app_id = game_id as u32;
                    if app_id != 0 {
                        // If we don't have the app info, mark it as pending
                        if !self.apps.read().info.contains_key(&app_id) {
                            self.apps.write().pending.insert(app_id);
                        } else if persona.game_name.is_none() || persona.game_name.as_ref().map(|s| s.is_empty()).unwrap_or(true) {
                            // If we have the app info but game_name is missing, try to resolve it
                            if let Some(name) = self.get_app_name(app_id) {
                                persona.game_name = Some(name);
                            }
                        }
                    }
                }

                // Update the users HashMap
                self.social.write().users.entry(persona.steam_id).and_modify(|existing| existing.merge(&persona)).or_insert_with(|| persona.clone());

                // Also update the TTL-based persona cache
                self.social.read().persona_cache.insert(persona.steam_id, persona);
            }
            SteamEvent::Apps(AppsEvent::PlayingState { playing_app, blocked }) => {
                let mut apps = self.apps.write();
                apps.playing_blocked = *blocked;
                if *playing_app != 0 {
                    if !apps.info.contains_key(playing_app) {
                        apps.pending.insert(*playing_app);
                    }
                    apps.info.entry(*playing_app).or_insert_with(|| super::events::AppInfoData { app_id: *playing_app, change_number: 0, missing_token: false, app_info: None });
                }
            }
            SteamEvent::Apps(AppsEvent::ProductInfoResponse { apps: new_apps, .. }) => {
                let mut apps = self.apps.write();
                for (app_id, data) in new_apps {
                    apps.info.insert(*app_id, data.clone());
                    apps.pending.remove(app_id);
                }
            }
            SteamEvent::Connection(ConnectionEvent::Disconnected { will_reconnect, .. }) => {
                // Only clear steam_id if not reconnecting
                if !*will_reconnect {
                    self.steam_id = None;
                }
                self.connection = None;
                self.auth.write().connecting = false;
            }
            SteamEvent::Connection(ConnectionEvent::ReconnectFailed { .. }) => {
                // Clear all state on permanent reconnection failure
                self.steam_id = None;
                self.connection = None;
                self.auth.write().connecting = false;
                self.reconnect_manager.reset();
            }
            SteamEvent::Apps(super::events::AppsEvent::LicenseList { licenses }) => {
                self.apps.write().licenses = licenses.clone();
            }
            _ => {}
        }
    }

    /// Post-process events to trigger automatic actions (like fetching
    /// personas).
    async fn post_process_event(&mut self, event: &super::events::SteamEvent) {
        use super::events::{FriendsEvent, SteamEvent};

        if let SteamEvent::Friends(FriendsEvent::FriendsList { incremental: false, .. }) = event {
            let friends: Vec<SteamID> = self.social.read().friends.iter().filter(|&(_, &rel)| rel == steam_enums::EFriendRelationship::Friend as u32).map(|(&id, _)| id).collect();

            if !friends.is_empty() {
                debug!("Auto-fetching personas for {} friends", friends.len());
                if let Err(e) = self.get_personas(friends).await {
                    warn!("Failed to auto-fetch personas: {}", e);
                }
            }
        }
    }

    /// Format a user's rich presence into a localized string.
    ///
    /// # Arguments
    /// * `steam_id` - The user's SteamID
    /// * `language` - The language for localization (e.g., "english")
    pub fn format_rich_presence(&self, steam_id: SteamID, language: &str) -> Option<String> {
        // Clone the persona out so we don't hold the social read guard across
        // the apps lookup further down.
        let user = self.social.read().users.get(&steam_id).cloned()?;
        let app_id = user.game_id? as u32;
        // Hold the apps read guard for the rest of the (sync) function so we
        // can borrow into the VDF without cloning it.
        let apps = self.apps.read();
        let app_info = apps.info.get(&app_id)?;
        let app_vdf = app_info.app_info.as_ref()?;

        // Get rich presence localization for the given language
        let localization = app_vdf.get("common").and_then(|c| c.get("rich_presence")).and_then(|rp| rp.get("localization")).and_then(|loc| loc.get(language))?;

        // Get the display token
        let display_token = user.rich_presence.get("steam_display")?;
        let mut formatted = localization.get_str(display_token)?.to_string();

        // Replace placeholders (e.g., %map%, %status%)
        for (key, value) in &user.rich_presence {
            if key == "steam_display" {
                continue;
            }
            let placeholder = format!("%{}%", key);
            // The value itself might be a token that needs localization
            let localized_value = localization.get_str(value).unwrap_or(value);
            formatted = formatted.replace(&placeholder, localized_value);
        }

        Some(formatted)
    }

    /// Get an app's name from cache.
    pub fn get_app_name(&self, app_id: u32) -> Option<String> {
        // First check the bundled static AppList (only built with the
        // `static-app-list` feature; binary search on a sorted static array).
        #[cfg(feature = "static-app-list")]
        {
            if let Ok(idx) = crate::client::static_app_list::APP_LIST.binary_search_by_key(&app_id, |&(id, _)| id) {
                return Some(crate::client::static_app_list::APP_LIST[idx].1.to_string());
            }
        }

        // Then check PICS cache
        let apps = self.apps.read();
        let info = apps.info.get(&app_id)?;
        if let Some(vdf) = &info.app_info {
            vdf.get("common").and_then(|c| c.get_str("name")).or_else(|| vdf.get_str("name")).map(|s| s.to_string())
        } else {
            None
        }
    }

    /// Fetch info for apps that are currently in the pending queue.
    ///
    /// This is used for proactive caching of app names and rich presence
    /// localization.
    pub async fn fetch_pending_app_info(&mut self) -> Result<(), SteamError> {
        if self.apps.read().pending.is_empty() {
            return Ok(());
        }

        let app_ids: Vec<u32> = self.apps.read().pending.iter().copied().collect();
        // Clear pending apps to prevent duplicate requests
        self.apps.write().pending.clear();
        self.get_product_info(app_ids).await
    }

    /// Fetch and update active friend message sessions.
    ///
    /// This updates the local `users` cache with unread counts and last message
    /// timestamps from active chat sessions.
    pub async fn update_friend_sessions(&mut self) -> Result<(), SteamError> {
        let sessions = self.get_active_friend_sessions().await?;

        // Acquire one write guard for the whole batch — never held across an .await.
        {
            let mut social = self.social.write();
            for session in sessions {
                social
                    .users
                    .entry(session.friend)
                    .and_modify(|user| {
                        user.unread_count = session.unread_count;
                        user.last_message_time = session.time_last_message;
                    })
                    .or_insert_with(|| UserPersona {
                        steam_id: session.friend,
                        unread_count: session.unread_count,
                        last_message_time: session.time_last_message,
                        ..Default::default()
                    });
            }
        }

        Ok(())
    }

    /// Get the CS:GO service.
    pub fn csgo(&mut self) -> crate::services::CSGOClient<'_> {
        crate::services::CSGOClient::new(self)
    }

    /// Helper to send a unified service method call and wait for response.
    pub(crate) async fn send_service_method_and_wait<Req: prost::Message, Resp: prost::Message + Default>(&mut self, method: &str, body: &Req) -> Result<Resp, SteamError> {
        let rx = self.send_service_method_with_job(method, body).await?;

        // Wait for response
        let job_response = rx.await.map_err(|_| SteamError::ResponseTimeout)?;

        let body = match job_response {
            crate::internal::jobs::JobResponse::Success(bytes) => bytes,
            crate::internal::jobs::JobResponse::Timeout => return Err(SteamError::ResponseTimeout),
            crate::internal::jobs::JobResponse::Error(msg) => return Err(SteamError::ProtocolError(msg)),
        };

        Resp::decode(&body[..]).map_err(|_| SteamError::DeserializationFailed)
    }
}

//=============================================================================
// Stream Implementation for SteamClient
//=============================================================================

use std::task::{Context, Poll};

use futures::Stream;

/// A stream of Steam events.
///
/// Created by calling [`SteamClient::into_stream`].
///
/// **Note**: This stream only yields queued events synchronously. For full
/// async event polling (including network I/O), use [`poll_event`] in a loop
/// or with `futures::stream::unfold`.
///
/// # Example
/// ```rust,ignore
/// use futures::StreamExt;
///
/// // Using as a stream (queued events only)
/// let mut stream = client.into_stream();
///
/// // Process queued events
/// while let Some(Ok(event)) = stream.next().await {
///     tracing::info!("Event: {:?}", event);
/// }
///
/// // For full network I/O, use unfold:
/// use futures::stream::unfold;
///
/// let stream = unfold(client, |mut client| async move {
///     match client.poll_event().await {
///         Ok(Some(event)) => Some((Ok(event), client)),
///         Ok(None) => Some((Ok(SteamEvent::System(SystemEvent::Debug("no event".into()))), client)),
///         Err(e) => Some((Err(e), client)),
///     }
/// });
/// ```
pub struct SteamEventStream<'a> {
    client: &'a mut SteamClient,
}

impl SteamClient {
    /// Convert this client into an event stream for queued events.
    ///
    /// Returns a `Stream` that yields queued `SteamEvent`s. This is useful
    /// for draining the event queue using stream combinators.
    ///
    /// **Note**: This stream only yields already-queued events. It does not
    /// perform network I/O. For full async event polling, use [`poll_event`]
    /// in a loop or create a stream with `futures::stream::unfold`.
    ///
    /// # Example
    /// ```rust,ignore
    /// use futures::StreamExt;
    ///
    /// // Drain queued events
    /// let mut stream = client.into_stream();
    /// while let Some(Ok(event)) = stream.next().await {
    ///     handle_event(event);
    /// }
    /// ```
    /// Send a unified service method call in the background.
    ///
    /// The response will be automatically handled when it arrives by checking
    /// the background job tasks in `poll_event`.
    pub(crate) async fn send_service_method_background<T: prost::Message>(&mut self, method: &str, body: &T, task: BackgroundTask) -> Result<(), SteamError> {
        let (job_id, rx) = self.job_manager.create_job().await;

        self.send_service_method_with_job_id(method, body, job_id).await?;

        self.background_job_tasks.insert(job_id, task);

        let tx = self.background_job_results_tx.clone();
        tokio::spawn(async move {
            match rx.await {
                Ok(crate::internal::jobs::JobResponse::Success(bytes)) => {
                    let _ = tx.send((job_id, Ok(bytes))).await;
                }
                Ok(crate::internal::jobs::JobResponse::Timeout) => {
                    let _ = tx.send((job_id, Err(SteamError::Timeout))).await;
                }
                Ok(crate::internal::jobs::JobResponse::Error(e)) => {
                    let _ = tx.send((job_id, Err(SteamError::Other(e)))).await;
                }
                Err(_) => {
                    // Receiver closed
                }
            }
        });

        Ok(())
    }

    /// Helper to send a unified service method call with a specific job ID.
    async fn send_service_method_with_job_id<T: prost::Message>(&mut self, method: &str, body: &T, job_id: u64) -> Result<(), SteamError> {
        use crate::protocol::{ProtobufMessageHeader, SteamMessage};

        let header = ProtobufMessageHeader {
            header_length: 0,
            session_id: self.auth.read().session_id,
            steam_id: self.steam_id.as_ref().map(|s| s.steam_id64()).unwrap_or(0),
            job_id_source: job_id,
            job_id_target: u64::MAX,
            target_job_name: Some(method.to_string()),
            routing_appid: None,
        };

        let msg = SteamMessage::new_proto(steam_enums::EMsg::ServiceMethodCallFromClient, header, body);

        if let Some(ref mut conn) = self.connection {
            conn.send(msg.encode()).await?;
        } else {
            return Err(SteamError::NotConnected);
        }

        Ok(())
    }

    pub fn into_stream(&mut self) -> SteamEventStream<'_> {
        SteamEventStream { client: self }
    }
}

impl<'a> Stream for SteamEventStream<'a> {
    type Item = Result<super::events::SteamEvent, SteamError>;

    fn poll_next(mut self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        // Only yield queued events - does not perform network I/O
        // For full async polling, use poll_event() in a loop
        if let Some(event) = self.client.deferred_job_events.pop_front() {
            return Poll::Ready(Some(Ok(event)));
        }
        if let Some(mut event) = self.client.event_queue.pop_front() {
            self.client.handle_event(&mut event);
            Poll::Ready(Some(Ok(event)))
        } else {
            // No more queued events
            Poll::Ready(None)
        }
    }
}

/// Response shape of `https://steamcommunity.com/chat/clientjstoken`.
#[derive(Debug, serde::Deserialize)]
struct ClientJsTokenResponse {
    #[serde(default)]
    logged_in: bool,
    #[serde(default)]
    steamid: Option<String>,
    #[serde(default)]
    account_name: Option<String>,
    #[serde(default)]
    token: Option<String>,
}

/// Call Steam's `chat/clientjstoken` endpoint using the supplied cookies and
/// return `(web_logon_token, account_name, steam_id)`.
async fn fetch_client_js_token(http_client: &dyn crate::utils::http::HttpClient, cookies: &str) -> Result<(String, String, SteamID), SteamError> {
    let response = http_client.get_with_cookies("https://steamcommunity.com/chat/clientjstoken", cookies).await?;

    if !response.is_success() {
        return Err(SteamError::Other(format!("clientjstoken HTTP error: {}", response.status)));
    }

    let body: ClientJsTokenResponse = response.json().map_err(|e| SteamError::ProtocolError(format!("Failed to parse clientjstoken response: {}", e)))?;

    if !body.logged_in {
        return Err(SteamError::InvalidCredentials);
    }

    let token = body.token.filter(|s| !s.is_empty()).ok_or_else(|| SteamError::ProtocolError("clientjstoken returned no token".to_string()))?;
    let account_name = body.account_name.filter(|s| !s.is_empty()).ok_or_else(|| SteamError::ProtocolError("clientjstoken returned no account_name".to_string()))?;
    let steamid_str = body.steamid.filter(|s| !s.is_empty()).ok_or_else(|| SteamError::ProtocolError("clientjstoken returned no steamid".to_string()))?;
    let steamid_u64: u64 = steamid_str.parse().map_err(|_| SteamError::ProtocolError(format!("clientjstoken returned malformed steamid: {}", steamid_str)))?;
    let steam_id = SteamID::from(steamid_u64);

    Ok((token, account_name, steam_id))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::client::events::{AuthEvent, ConnectionEvent, SteamEvent};
    use async_trait::async_trait;
    use bytes::Bytes;
    use std::collections::VecDeque;

    struct ScriptedConnection {
        server: CmServer,
        incoming: VecDeque<Option<Bytes>>,
    }

    impl ScriptedConnection {
        fn new(incoming: impl IntoIterator<Item = Option<Bytes>>) -> Self {
            Self {
                server: CmServer {
                    endpoint: "localhost:1".into(),
                    legacy_endpoint: String::new(),
                    server_type: "websocket".into(),
                    dc: String::new(),
                    realm: String::new(),
                    load: 0.0,
                },
                incoming: incoming.into_iter().collect(),
            }
        }
    }

    #[async_trait]
    impl SteamConnection for ScriptedConnection {
        async fn send(&mut self, _: Vec<u8>) -> Result<(), SteamError> {
            Ok(())
        }

        async fn recv(&mut self) -> Result<Option<Bytes>, SteamError> {
            match self.incoming.pop_front() {
                Some(packet) => Ok(packet),
                None => std::future::pending().await,
            }
        }

        async fn close(self: Box<Self>) -> Result<(), SteamError> {
            Ok(())
        }

        fn server(&self) -> &CmServer {
            &self.server
        }

        fn set_session_key(&mut self, _: Option<Vec<u8>>) {}
    }

    fn successful_ticket_response() -> steam_protos::CMsgClientEncryptedAppTicketResponse {
        steam_protos::CMsgClientEncryptedAppTicketResponse {
            app_id: Some(123),
            eresult: Some(1),
            encrypted_ticket: Some(steam_protos::EncryptedAppTicket {
                ticket_version_no: Some(4),
                crc_encryptedticket: Some(0x1234),
                cb_encrypteduserdata: Some(4),
                cb_encrypted_appownershipticket: Some(9),
                encrypted_ticket: Some(vec![1, 2, 3]),
            }),
        }
    }

    fn ticket_response_packet(body: steam_protos::CMsgClientEncryptedAppTicketResponse) -> Bytes {
        let header = crate::protocol::ProtobufMessageHeader {
            job_id_source: u64::MAX,
            job_id_target: 1,
            ..Default::default()
        };
        Bytes::from(SteamMessage::new_proto(EMsg::ClientRequestEncryptedAppTicketResponse, header, &body).encode())
    }

    async fn request_ticket_from(body: steam_protos::CMsgClientEncryptedAppTicketResponse) -> Result<Vec<u8>, SteamError> {
        let mut client = SteamClient::new(SteamOptions::default());
        client.steam_id = Some(test_steam_id());
        client.connection = Some(Box::new(ScriptedConnection::new([Some(ticket_response_packet(body))])));
        tokio::time::timeout(Duration::from_millis(250), client.create_encrypted_app_ticket(123, None))
            .await
            .expect("ticket request must poll Steam")
    }

    #[tokio::test]
    async fn ticket_request_polls_response_and_preserves_other_events_once() {
        let mut client = SteamClient::new(SteamOptions::default());
        client.steam_id = Some(test_steam_id());
        client.connection = Some(Box::new(ScriptedConnection::new([Some(ticket_response_packet(successful_ticket_response()))])));
        client.event_queue.push_back(SteamEvent::Auth(AuthEvent::RefreshToken {
            token: "test-refresh-token".into(),
            account_name: "test-account".into(),
        }));
        client.event_queue.push_back(SteamEvent::Auth(AuthEvent::GameConnectTokens { tokens: vec![vec![42]] }));

        let ticket = tokio::time::timeout(
            Duration::from_millis(250),
            client.create_encrypted_app_ticket(123, None),
        )
        .await
        .expect("ticket request must poll Steam")
        .expect("ticket response must succeed");
        // Same protobuf envelope that steam-user forwards to the Zeepkist master.
        assert_eq!(ticket, [0x08, 0x04, 0x10, 0xb4, 0x24, 0x18, 0x04, 0x20, 0x09, 0x2a, 0x03, 1, 2, 3]);
        assert_eq!(client.gc_tokens, [vec![42]]);

        assert!(matches!(
            client.poll_event().await,
            Ok(Some(SteamEvent::Auth(AuthEvent::RefreshToken { token, .. }))) if token == "test-refresh-token"
        ));
        assert!(matches!(
            client.poll_event().await,
            Ok(Some(SteamEvent::Auth(AuthEvent::GameConnectTokens { .. })))
        ));
        assert_eq!(client.gc_tokens, [vec![42]], "deferred event must not be handled twice");
    }

    #[tokio::test]
    async fn ticket_request_rejects_wrong_app_id() {
        let mut response = successful_ticket_response();
        response.app_id = Some(456);
        assert!(matches!(
            request_ticket_from(response).await,
            Err(SteamError::ProtocolError(message)) if message == "Steam returned an encrypted app ticket for a different app"
        ));
    }

    #[tokio::test]
    async fn ticket_request_rejects_missing_or_empty_ciphertext() {
        let mut response = successful_ticket_response();
        response.encrypted_ticket = None;
        assert!(matches!(
            request_ticket_from(response).await,
            Err(SteamError::ProtocolError(message)) if message == "Steam returned no encrypted app ticket"
        ));

        let mut response = successful_ticket_response();
        response.encrypted_ticket.as_mut().expect("fixture has a ticket").encrypted_ticket = Some(Vec::new());
        assert!(matches!(
            request_ticket_from(response).await,
            Err(SteamError::ProtocolError(message)) if message == "Steam returned an empty encrypted app ticket"
        ));
    }

    #[tokio::test]
    async fn ticket_request_rejects_steam_error() {
        let mut response = successful_ticket_response();
        response.eresult = Some(2);
        assert!(matches!(request_ticket_from(response).await, Err(SteamError::SteamResult(steam_enums::EResult::Fail))));
    }

    #[tokio::test]
    async fn ticket_request_reports_connection_close() {
        let mut client = SteamClient::new(SteamOptions::default());
        client.steam_id = Some(test_steam_id());
        client.connection = Some(Box::new(ScriptedConnection::new([None])));

        assert!(matches!(
            client.create_encrypted_app_ticket(123, None).await,
            Err(SteamError::NotConnected)
        ));
        assert!(matches!(
            client.poll_event().await,
            Ok(Some(SteamEvent::Connection(ConnectionEvent::Disconnected { .. })))
        ));
    }

    fn test_steam_id() -> SteamID {
        SteamID::from_steam_id64(76561198000000000)
    }

    #[test]
    fn test_user_persona_merge_rich_presence() {
        let mut persona1 = UserPersona {
            steam_id: test_steam_id(),
            rich_presence: {
                let mut map = HashMap::new();
                map.insert("status".to_string(), "Online".to_string());
                map.insert("game".to_string(), "CS:GO".to_string());
                map
            },
            ..Default::default()
        };

        let persona2 = UserPersona {
            steam_id: test_steam_id(),
            rich_presence: {
                let mut map = HashMap::new();
                map.insert("status".to_string(), "In-Game".to_string());
                map.insert("party".to_string(), "Open".to_string());
                map
            },
            ..Default::default()
        };

        persona1.merge(&persona2);

        assert_eq!(persona1.rich_presence.get("status"), Some(&"In-Game".to_string()));
        assert_eq!(persona1.rich_presence.get("game"), Some(&"CS:GO".to_string()));
        assert_eq!(persona1.rich_presence.get("party"), Some(&"Open".to_string()));
    }

    #[test]
    fn test_user_persona_merge_unread_count() {
        let mut persona1 = UserPersona { steam_id: test_steam_id(), unread_count: 5, last_message_time: 100, ..Default::default() };

        let persona2 = UserPersona { steam_id: test_steam_id(), unread_count: 10, last_message_time: 200, ..Default::default() };

        persona1.merge(&persona2);

        assert_eq!(persona1.unread_count, 10);
        assert_eq!(persona1.last_message_time, 200);
    }

    #[test]
    fn test_user_persona_merge_unread_count_zero() {
        let mut persona1 = UserPersona { steam_id: test_steam_id(), unread_count: 5, last_message_time: 100, ..Default::default() };

        // Merging with 0 should NOT overwrite existing values
        let persona2 = UserPersona { steam_id: test_steam_id(), unread_count: 0, last_message_time: 0, ..Default::default() };

        persona1.merge(&persona2);

        assert_eq!(persona1.unread_count, 5);
        assert_eq!(persona1.last_message_time, 100);
    }
}
