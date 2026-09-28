//! Steam CM server provider.
//!
//! This crate provides mechanisms for discovering Steam CM servers.

#[cfg(test)]
mod tests;
mod types;

use std::{
    fs::OpenOptions,
    io::{Read, Write},
    sync::Arc,
    time::{Duration, Instant},
};

use async_trait::async_trait;
use fd_lock::RwLock;
use futures::future::join_all;
use rand::Rng;
use tokio::{
    sync::{Mutex, Semaphore},
    time::timeout,
};
use tracing::{debug, warn};
pub use types::*;

/// Configuration for `HttpCmServerProvider`.
#[derive(Clone, Debug)]
pub struct HttpCmServerConfig {
    /// Path to the CM server list cache file.
    pub cache_path: Option<std::path::PathBuf>,
    /// Number of top servers to pick from after sorting by load/latency.
    pub selection_pool_size: usize,
    /// Timeout for server connectivity checks.
    pub connection_timeout: Duration,
    /// Maximum number of concurrent connectivity checks.
    pub max_concurrent_checks: usize,
}

impl Default for HttpCmServerConfig {
    fn default() -> Self {
        Self {
            cache_path: home::home_dir().map(|mut path| {
                path.push(".steam-rs");
                path.push("cm_servers.json");
                path
            }),
            selection_pool_size: 5,
            connection_timeout: Duration::from_millis(3000),
            max_concurrent_checks: 10,
        }
    }
}

/// Builder for `HttpCmServerProvider`.
pub struct HttpCmServerProviderBuilder<H = Arc<dyn HttpClient>, R = Arc<dyn CmRng>> {
    http: Option<H>,
    rng: Option<R>,
    checker: Option<Arc<dyn ConnectivityChecker>>,
    config: HttpCmServerConfig,
}

impl Default for HttpCmServerProviderBuilder {
    fn default() -> Self {
        Self::new()
    }
}

impl HttpCmServerProviderBuilder {
    pub fn new() -> Self {
        Self { http: None, rng: None, checker: None, config: HttpCmServerConfig::default() }
    }
}

impl<H, R> HttpCmServerProviderBuilder<H, R>
where
    H: HttpClient + Clone + 'static,
    R: CmRng + Clone + 'static,
{
    /// Set the HTTP client to use.
    pub fn http(mut self, http: H) -> Self {
        self.http = Some(http);
        self
    }

    /// Set the random number generator to use.
    pub fn rng(mut self, rng: R) -> Self {
        self.rng = Some(rng);
        self
    }

    /// Set the connectivity checker to use.
    pub fn checker(mut self, checker: Arc<dyn ConnectivityChecker>) -> Self {
        self.checker = Some(checker);
        self
    }

    /// Set the path to the CM server list cache file.
    pub fn cache_path(mut self, path: std::path::PathBuf) -> Self {
        self.config.cache_path = Some(path);
        self
    }

    /// Set the selection pool size.
    pub fn selection_pool_size(mut self, size: usize) -> Self {
        self.config.selection_pool_size = size;
        self
    }

    /// Set the connection timeout for checking servers.
    pub fn connection_timeout(mut self, timeout: Duration) -> Self {
        self.config.connection_timeout = timeout;
        self
    }

    /// Set the maximum number of concurrent connectivity checks.
    pub fn max_concurrent_checks(mut self, count: usize) -> Self {
        self.config.max_concurrent_checks = count;
        self
    }

    /// Build the `HttpCmServerProvider`.
    ///
    /// # Panics
    ///
    /// Panics if the HTTP client or RNG have not been set.
    pub fn build(self) -> HttpCmServerProvider<H, R> {
        let http = self.http.expect("HTTP client is required. Use builder().http(...) or HttpCmServerProvider::new_default()");
        let rng = self.rng.expect("RNG is required. Use builder().rng(...) or HttpCmServerProvider::new_default()");

        HttpCmServerProvider {
            http,
            rng,
            checker: self.checker.unwrap_or_else(|| Arc::new(RealConnectivityChecker)),
            config: self.config,
            lock: Mutex::new(()),
        }
    }
}

/// Default connectivity checker using tokio-tungstenite.
pub struct RealConnectivityChecker;

impl Default for RealConnectivityChecker {
    fn default() -> Self {
        Self::new()
    }
}

impl RealConnectivityChecker {
    /// Creates a new `RealConnectivityChecker`.
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ConnectivityChecker for RealConnectivityChecker {
    async fn check_connection(&self, url: &str, timeout_dur: Duration) -> Option<u128> {
        let start = Instant::now();
        let result = timeout(timeout_dur, tokio_tungstenite::connect_async(url)).await;

        match result {
            Ok(Ok(_)) => {
                let duration = start.elapsed().as_millis();
                debug!("[Open] {} connected in {} ms", url, duration);
                Some(duration)
            }
            Ok(Err(e)) => {
                debug!("[Error] {} failed: {}", url, e);
                None
            }
            Err(_) => {
                debug!("[Timeout] {} did not respond in {:?} ms", url, timeout_dur);
                None
            }
        }
    }
}

/// Default random number generator using `rand::thread_rng`.
pub struct DefaultRng;

impl CmRng for DefaultRng {
    fn gen_u32(&self) -> u32 {
        rand::rng().random::<u32>()
    }

    fn gen_usize(&self, max: usize) -> usize {
        if max == 0 {
            return 0;
        }
        rand::rng().random_range(0..max)
    }
}

impl<T: CmRng + ?Sized> CmRng for Arc<T> {
    fn gen_u32(&self) -> u32 {
        self.as_ref().gen_u32()
    }

    fn gen_usize(&self, max: usize) -> usize {
        self.as_ref().gen_usize(max)
    }
}

/// Default HTTP client using `reqwest`.
pub struct ReqwestHttpClient {
    client: reqwest::Client,
}

impl Default for ReqwestHttpClient {
    fn default() -> Self {
        Self::new()
    }
}

impl ReqwestHttpClient {
    pub fn new() -> Self {
        Self { client: reqwest::Client::new() }
    }
}

#[async_trait]
impl HttpClient for ReqwestHttpClient {
    async fn get_with_query(&self, url: &str, query: &[(&str, &str)]) -> Result<HttpResponse, CmError> {
        let resp = self.client.get(url).query(query).send().await.map_err(|e| CmError::Network(e.to_string()))?;

        let status = resp.status().as_u16();
        let body = resp.bytes().await.map_err(|e| CmError::Network(e.to_string()))?.to_vec();

        Ok(HttpResponse { status, body })
    }
}

#[async_trait]
impl<T: HttpClient + ?Sized> HttpClient for Arc<T> {
    async fn get_with_query(&self, url: &str, query: &[(&str, &str)]) -> Result<HttpResponse, CmError> {
        self.as_ref().get_with_query(url, query).await
    }
}

/// HTTP-based CM server provider using Steam's Web API.
pub struct HttpCmServerProvider<H = Arc<dyn HttpClient>, R = Arc<dyn CmRng>> {
    http: H,
    rng: R,
    checker: Arc<dyn ConnectivityChecker>,
    config: HttpCmServerConfig,
    lock: Mutex<()>,
}

impl Default for HttpCmServerProvider<Arc<dyn HttpClient>, Arc<dyn CmRng>> {
    fn default() -> Self {
        Self::new_default()
    }
}

impl<H, R> HttpCmServerProvider<H, R>
where
    H: HttpClient + Clone + 'static,
    R: CmRng + Clone + 'static,
{
    pub fn new(http: H, rng: R, checker: Arc<dyn ConnectivityChecker>) -> Self {
        Self::builder().http(http).rng(rng).checker(checker).build()
    }
}

impl HttpCmServerProvider<Arc<dyn HttpClient>, Arc<dyn CmRng>> {
    pub fn new_default() -> Self {
        HttpCmServerProviderBuilder::<Arc<dyn HttpClient>, Arc<dyn CmRng>>::new().http(Arc::new(ReqwestHttpClient::new()) as Arc<dyn HttpClient>).rng(Arc::new(DefaultRng) as Arc<dyn CmRng>).build()
    }
}

impl<H, R> HttpCmServerProvider<H, R>
where
    H: HttpClient + Clone + 'static,
    R: CmRng + Clone + 'static,
{
    pub fn builder() -> HttpCmServerProviderBuilder<H, R> {
        HttpCmServerProviderBuilder { http: None, rng: None, checker: None, config: HttpCmServerConfig::default() }
    }

    /// Returns the path to the CM server list cache file.
    fn get_cache_path(&self) -> Option<std::path::PathBuf> {
        self.config.cache_path.clone()
    }

    async fn fetch_server_list(&self) -> Result<Vec<CmServer>, CmError> {
        debug!("Fetching CM server list from Steam API");
        let url = "https://api.steampowered.com/ISteamDirectory/GetCMListForConnect/v1/";
        let resp = self.http.get_with_query(url, &[("format", "json"), ("cmtype", "websockets"), ("cellid", "0")]).await?;

        if !resp.is_success() {
            return Err(CmError::ApiError(resp.status, format!("HTTP status {}", resp.status)));
        }

        let api_response: ApiResponse = resp.json()?;
        let mut server_list: Vec<CmServer> = api_response.response.serverlist.into_iter().filter(|s| s.realm == "steamglobal").filter(|s| s.server_type == "websockets").collect();

        if server_list.is_empty() {
            return Err(CmError::InvalidResponse("Steam API returned an empty server list".to_string()));
        }

        server_list.sort_by(|a, b| a.load.partial_cmp(&b.load).unwrap_or(std::cmp::Ordering::Equal));

        Ok(server_list)
    }

    pub async fn load_from_disk(&self) -> Option<Vec<CmServer>> {
        let path = self.get_cache_path()?;

        tokio::task::spawn_blocking(move || {
            let file = OpenOptions::new().read(true).open(&path).map_err(|e| debug!("Failed to open CM cache at {:?} for reading: {}", path, e)).ok()?;

            let lock = RwLock::new(file);
            let lock_guard = lock.read().map_err(|e| debug!("Failed to acquire read lock on CM cache at {:?}: {}", path, e)).ok()?;

            let mut bytes = Vec::new();
            let mut reader = &*lock_guard;
            reader.read_to_end(&mut bytes).ok()?;

            if let Ok(cached) = serde_json::from_slice::<CachedServerList>(&bytes) {
                if let Ok(elapsed) = cached.fetched_at.elapsed() {
                    if elapsed < CACHE_TTL && !cached.servers.is_empty() {
                        return Some(cached.servers);
                    }
                }
            }
            None
        })
        .await
        .ok()?
    }

    pub async fn save_to_disk(&self, servers: Vec<CmServer>) {
        if let Some(path) = self.get_cache_path() {
            let cached = CachedServerList { servers, fetched_at: std::time::SystemTime::now() };

            if let Ok(json) = serde_json::to_vec_pretty(&cached) {
                let _ = tokio::task::spawn_blocking(move || {
                    if let Some(parent) = path.parent() {
                        let _ = std::fs::create_dir_all(parent);
                    }

                    #[allow(clippy::suspicious_open_options)]
                    let file = OpenOptions::new().write(true).create(true).open(&path).map_err(|e| debug!("Failed to open CM cache at {:?} for writing: {}", path, e)).ok()?;

                    let mut lock = RwLock::new(file);
                    let mut lock_guard = match lock.write() {
                        Ok(g) => g,
                        Err(e) => {
                            warn!("Failed to acquire exclusive lock on CM cache at {:?}: {}", path, e);
                            return None;
                        }
                    };

                    // Now that we have the lock, truncate the file manually.
                    if let Err(e) = lock_guard.set_len(0) {
                        warn!("Failed to truncate CM cache: {}", e);
                        return None;
                    }

                    if let Err(e) = lock_guard.write_all(&json) {
                        warn!("Failed to write CM cache to disk: {}", e);
                    }
                    Some(())
                })
                .await;
            }
        }
    }

    /// Checks and sorts a list of servers by connectivity.
    ///
    /// This is a public utility that acquires the internal lock.
    pub async fn check_server_list(&self, servers: Vec<CmServer>) -> Vec<CmServer> {
        let _guard = self.lock.lock().await;
        self.check_server_list_internal(servers).await
    }

    /// Internal version of check_server_list that doesn't acquire the lock.
    async fn check_server_list_internal(&self, servers: Vec<CmServer>) -> Vec<CmServer> {
        debug!("Checking connectivity for {} servers...", servers.len());

        let semaphore = Arc::new(Semaphore::new(self.config.max_concurrent_checks));
        let mut futures = Vec::new();

        for server in servers {
            let sem = semaphore.clone();
            futures.push(async move {
                let _permit = sem.acquire().await.ok();
                self.check_single_server(server).await
            });
        }

        let results = join_all(futures).await;
        let mut reachable: Vec<(CmServer, u128)> = results.into_iter().flatten().collect();

        // Sort by latency (connection time)
        reachable.sort_by_key(|(_, latency)| *latency);

        debug!("Checked servers: found {} reachable servers", reachable.len());

        // Return just the servers
        reachable.into_iter().map(|(s, _)| s).collect()
    }

    async fn check_single_server(&self, server: CmServer) -> Option<(CmServer, u128)> {
        let url = format!("wss://{}/cmsocket/", server.endpoint);
        self.checker.check_connection(&url, self.config.connection_timeout).await.map(|duration| (server, duration))
    }

    fn select_server(&self, servers: Vec<CmServer>) -> Option<CmServer> {
        if servers.is_empty() {
            return None;
        }

        let count = std::cmp::min(servers.len(), self.config.selection_pool_size);
        let idx = self.rng.gen_usize(count);
        let server = servers[idx].clone();

        debug!("Selected CM server: {} (load: {})", server.endpoint, server.load);
        Some(server)
    }
}

#[async_trait]
impl<H, R> CmServerProvider for HttpCmServerProvider<H, R>
where
    H: HttpClient + Clone + 'static,
    R: CmRng + Send + Sync + Clone + 'static,
{
    async fn get_server(&self) -> Result<CmServer, CmError> {
        // 1. Try to load from disk without locking the async mutex
        if let Some(cached_servers) = self.load_from_disk().await {
            if let Some(server) = self.select_server(cached_servers) {
                debug!("Using disk cached CM servers (fast path)");
                return Ok(server);
            }
        }

        // 2. Cache miss, acquire the async mutex to fetch from API
        let _guard = self.lock.lock().await;

        // 3. Double-check cache in case another task filled it while we waited for the
        //    lock
        if let Some(cached_servers) = self.load_from_disk().await {
            if let Some(server) = self.select_server(cached_servers) {
                debug!("Using disk cached CM servers (double-check hit)");
                return Ok(server);
            }
        }

        // 4. Truly empty/expired, fetch from API
        let fetch_result = self.fetch_server_list().await?;

        // 5. Verify connectivity for the fetched servers to ensure we cache good ones
        let verified_servers = self.check_server_list_internal(fetch_result).await;

        if verified_servers.is_empty() {
            return Err(CmError::NoServers);
        }

        self.save_to_disk(verified_servers.clone()).await;

        self.select_server(verified_servers).ok_or(CmError::NoServers)
    }
}
