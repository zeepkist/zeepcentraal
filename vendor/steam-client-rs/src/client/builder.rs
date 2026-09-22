//! Builder pattern for creating SteamClient instances.
//!
//! This module provides a fluent builder API for constructing `SteamClient`
//! instances with customized dependencies. This is particularly useful for
//! testing, where you want to inject mock implementations of external
//! dependencies.
//!
//! # Example
//!
//! ```rust,no_run
//! use std::sync::Arc;
//!
//! use steam_client::{
//!     HttpResponse, MockClock, MockHttpClient, MockRng, SteamClient, SteamClientBuilder,
//!     SteamOptions,
//! };
//!
//! // Create a fully mocked client for testing
//! let (client, mocks) = SteamClient::builder().with_all_mocks().build_with_mocks();
//!
//! // Or configure specific responses
//! let mock_http = MockHttpClient::new();
//! mock_http.queue_response(HttpResponse::ok(b"{}".to_vec()));
//!
//! let client = SteamClient::builder()
//!     .with_http_client(Arc::new(mock_http))
//!     .build();
//! ```

use std::sync::Arc;

use super::steam_client::SteamClient;
use crate::{
    options::SteamOptions,
    utils::{
        clock::{Clock, MockClock, SystemClock},
        http::{HttpClient, MockHttpClient, ReqwestHttpClient},
        rng::{MockRng, Rng, ThreadRng},
    },
};

/// Builder for creating `SteamClient` instances with customized dependencies.
///
/// Use this builder when you need to inject mock implementations for testing
/// or customize the behavior of the Steam client.
///
/// # Testing Example
///
/// ```rust,no_run
/// use steam_client::{SteamClient, SteamClientBuilder};
///
/// // Create a test client with mocked dependencies
/// let (client, mocks) = SteamClient::builder().with_mock_http().build_with_mocks();
///
/// assert!(!client.is_logged_in());
/// ```
///
/// # Production Example
///
/// ```rust
/// use steam_client::{SteamClient, SteamOptions};
///
/// // For production, just use SteamClient::new()
/// let client = SteamClient::new(SteamOptions::default());
/// ```
pub struct SteamClientBuilder {
    options: Option<SteamOptions>,
    http_client: Option<Arc<dyn HttpClient>>,
    clock: Option<Arc<dyn Clock>>,
    rng: Option<Arc<dyn Rng>>,

    // Store mocks for test inspection (using Arc for shared access)
    mock_http: Option<Arc<MockHttpClient>>,
    mock_clock: Option<Arc<MockClock>>,
    mock_rng: Option<Arc<MockRng>>,
}

impl Default for SteamClientBuilder {
    fn default() -> Self {
        Self::new()
    }
}

impl SteamClientBuilder {
    /// Create a new builder with default settings.
    ///
    /// The default configuration uses:
    /// - `SteamOptions::default()`
    /// - `HttpCmServerProvider::new_default()`
    /// - `ReqwestHttpClient` (lazy initialized in `build`)
    /// - `SystemClock` (lazy initialized in `build`)
    /// - `ThreadRng` (lazy initialized in `build`)
    pub fn new() -> Self {
        Self { options: None, http_client: None, clock: None, rng: None, mock_http: None, mock_clock: None, mock_rng: None }
    }

    /// Set the options for the Steam client.
    ///
    /// These options control high-level behavior like auto-relogin,
    /// proxy settings, and connection protocols.
    ///
    /// If not called, the client will be built using
    /// [`SteamOptions::default()`].
    pub fn with_options(mut self, mut options: SteamOptions) -> Self {
        // Normalize HTTP proxy URL if present
        if let Some(proxy) = &mut options.http_proxy {
            if !proxy.contains("://") {
                *proxy = format!("http://{}", proxy);
            }
        }
        self.options = Some(options);
        self
    }

    // ========================================
    // HTTP Client Configuration
    // ========================================

    /// Use a custom HTTP client.
    ///
    /// This is useful for providing a custom-configured `reqwest` client
    /// or a completely different implementation of the [`HttpClient`] trait.
    pub fn with_http_client(mut self, client: Arc<dyn HttpClient>) -> Self {
        self.http_client = Some(client);
        self.mock_http = None;
        self
    }

    /// Use a mock HTTP client for testing.
    ///
    /// Returns a client that records requests and returns queued responses.
    /// Use `build_with_mocks()` to get access to the mock for test assertions.
    pub fn with_mock_http(mut self) -> Self {
        let mock = Arc::new(MockHttpClient::new());
        self.mock_http = Some(mock.clone());
        self.http_client = Some(mock);
        self
    }

    /// Use a mock HTTP client with pre-queued responses.
    ///
    /// This is a convenience method for short tests that only need to verify
    /// sequence of HTTP responses.
    pub fn with_mock_http_responses(mut self, responses: Vec<crate::utils::http::HttpResponse>) -> Self {
        let mock = MockHttpClient::new();
        mock.queue_responses(responses);
        let mock = Arc::new(mock);
        self.mock_http = Some(mock.clone());
        self.http_client = Some(mock);
        self
    }

    // ========================================
    // Clock Configuration
    // ========================================

    /// Use a custom clock.
    ///
    /// The clock is used for timing heartbeats, measuring timeouts,
    /// and other time-sensitive logic.
    pub fn with_clock(mut self, clock: Arc<dyn Clock>) -> Self {
        self.clock = Some(clock);
        self.mock_clock = None;
        self
    }

    /// Use a mock clock for testing.
    ///
    /// The mock clock starts at time zero and can be advanced manually.
    /// Use `build_with_mocks()` to get access to the mock for time control.
    pub fn with_mock_clock(mut self) -> Self {
        let mock = Arc::new(MockClock::new());
        self.mock_clock = Some(mock.clone());
        self.clock = Some(mock);
        self
    }

    // ========================================
    // RNG Configuration
    // ========================================

    /// Use a custom random number generator.
    ///
    /// The RNG is used for generating session IDs, encryption keys,
    /// and other randomized values.
    pub fn with_rng(mut self, rng: Arc<dyn Rng>) -> Self {
        self.rng = Some(rng);
        self.mock_rng = None;
        self
    }

    /// Use a mock RNG for testing.
    ///
    /// The mock RNG returns deterministic values that can be set.
    /// Use `build_with_mocks()` to get access to the mock for value control.
    pub fn with_mock_rng(mut self) -> Self {
        let mock = Arc::new(MockRng::new());
        self.mock_rng = Some(mock.clone());
        self.rng = Some(mock);
        self
    }

    /// Use a mock RNG with specific initial values.
    ///
    /// Provides deterministic values for `usize`, `i32`, and `u32` requests.
    pub fn with_mock_rng_values(mut self, usize_val: usize, i32_val: i32, u32_val: u32) -> Self {
        let mock = Arc::new(MockRng::with_values(usize_val, i32_val, u32_val));
        self.mock_rng = Some(mock.clone());
        self.rng = Some(mock);
        self
    }

    // ========================================
    // Convenience Methods for Testing
    // ========================================

    /// Configure all other dependencies with mock implementations.
    ///
    /// Equivalent to calling `with_mock_http()`,
    /// `with_mock_clock()`, and `with_mock_rng()`.
    pub fn with_all_mocks(self) -> Self {
        self.with_mock_http().with_mock_clock().with_mock_rng()
    }

    // ========================================
    // Build Methods
    // ========================================

    /// Build the SteamClient instance.
    ///
    /// - Clock: [`SystemClock`]
    /// - RNG: [`ThreadRng`]
    /// - CM Provider: [`HttpCmServerProvider`]
    pub fn build(self) -> SteamClient {
        let mut options = self.options.unwrap_or_default();

        // Enforce web compatibility mode constraints
        if options.web_compatibility_mode && options.protocol == crate::options::EConnectionProtocol::Tcp {
            tracing::warn!("web_compatibility_mode is enabled so connection protocol is being forced to WebSocket");
            options.protocol = crate::options::EConnectionProtocol::WebSocket;
        }

        let http_client = self.http_client.unwrap_or_else(|| Arc::new(ReqwestHttpClient::new()));
        let clock = self.clock.unwrap_or_else(|| Arc::new(SystemClock));
        let rng = self.rng.unwrap_or_else(|| Arc::new(ThreadRng));
        SteamClient::with_all_providers(options, http_client, clock, rng)
    }

    /// Build the SteamClient and return handles to any mock dependencies.
    ///
    /// This is useful in tests where you need to control mock behavior
    /// or inspect recorded interactions.
    ///
    /// # Example
    ///
    /// ```rust
    /// use std::time::Duration;
    ///
    /// use steam_client::{utils::http::HttpResponse, SteamClient};
    ///
    /// let (client, mocks) = SteamClient::builder()
    ///     .with_mock_http()
    ///     .with_mock_clock()
    ///     .build_with_mocks();
    ///
    /// // Control the mock clock
    /// if let Some(clock) = &mocks.clock {
    ///     clock.advance(Duration::from_secs(10));
    /// }
    ///
    /// // Inspect HTTP requests
    /// if let Some(http) = &mocks.http {
    ///     assert_eq!(http.request_count(), 0);
    /// }
    /// ```
    pub fn build_with_mocks(self) -> (SteamClient, MockHandles) {
        let mocks = MockHandles { http: self.mock_http.clone(), clock: self.mock_clock.clone(), rng: self.mock_rng.clone() };

        (self.build(), mocks)
    }
}

/// Handles to mock dependencies for test inspection and control.
///
/// Returned by [`SteamClientBuilder::build_with_mocks()`].
///
/// These handles allow you to:
/// - [`MockHttpClient`]: Queue responses and inspect recorded requests.
/// - [`MockClock`]: Advance time manually to test timeouts and heartbeats.
/// - [`MockRng`]: Control random values for deterministic testing.
#[derive(Clone)]
pub struct MockHandles {
    /// Mock HTTP client, if configured with
    /// [`SteamClientBuilder::with_mock_http`].
    pub http: Option<Arc<MockHttpClient>>,

    /// Mock clock, if configured with [`SteamClientBuilder::with_mock_clock`].
    pub clock: Option<Arc<MockClock>>,

    /// Mock RNG, if configured with [`SteamClientBuilder::with_mock_rng`].
    pub rng: Option<Arc<MockRng>>,
}

impl MockHandles {
    /// Check if any mocks are configured.
    pub fn has_any(&self) -> bool {
        self.http.is_some() || self.clock.is_some() || self.rng.is_some()
    }

    /// Get the mock HTTP client or panic.
    ///
    /// # Panics
    ///
    /// Panics if no mock HTTP client was configured with
    /// [`SteamClientBuilder::with_mock_http`].
    pub fn http_or_panic(&self) -> &MockHttpClient {
        self.http.as_ref().expect("No mock HTTP client configured")
    }

    /// Get the mock clock or panic.
    ///
    /// # Panics
    ///
    /// Panics if no mock clock was configured with
    /// [`SteamClientBuilder::with_mock_clock`].
    pub fn clock_or_panic(&self) -> &MockClock {
        self.clock.as_ref().expect("No mock clock configured")
    }

    /// Get the mock RNG or panic.
    ///
    /// # Panics
    ///
    /// Panics if no mock RNG was configured with
    /// [`SteamClientBuilder::with_mock_rng`].
    pub fn rng_or_panic(&self) -> &MockRng {
        self.rng.as_ref().expect("No mock RNG configured")
    }
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::*;
    use crate::utils::http::HttpResponse;

    #[test]
    fn test_builder_default() {
        let client = SteamClientBuilder::new().build();
        assert!(!client.is_logged_in());
    }

    #[test]
    fn test_builder_with_options() {
        let options = SteamOptions { auto_relogin: false, ..Default::default() };

        let client = SteamClient::builder().with_options(options).build();

        assert!(!client.options.auto_relogin);
    }

    #[test]
    fn test_builder_with_mock_http() {
        let (client, mocks) = SteamClient::builder().with_mock_http().build_with_mocks();

        assert!(!client.is_logged_in());
        assert!(mocks.http.is_some());
        assert_eq!(mocks.http_or_panic().request_count(), 0);
    }

    #[test]
    fn test_builder_with_mock_clock() {
        let (client, mocks) = SteamClient::builder().with_mock_clock().build_with_mocks();

        assert!(!client.is_logged_in());
        assert!(mocks.clock.is_some());

        let clock = mocks.clock_or_panic();
        clock.advance(Duration::from_secs(30));
        assert_eq!(clock.current_offset(), Duration::from_secs(30));
    }

    #[test]
    fn test_builder_with_mock_rng() {
        let (client, mocks) = SteamClient::builder().with_mock_rng_values(42, -1, 100).build_with_mocks();

        assert!(!client.is_logged_in());
        assert!(mocks.rng.is_some());

        let rng = mocks.rng_or_panic();
        assert_eq!(rng.current_usize(), 42);
        assert_eq!(rng.current_i32(), -1);
        assert_eq!(rng.current_u32(), 100);
    }

    #[test]
    fn test_builder_with_all_mocks() {
        let (client, mocks) = SteamClient::builder().with_all_mocks().build_with_mocks();

        assert!(!client.is_logged_in());
        assert!(mocks.has_any());
        assert!(mocks.http.is_some());
        assert!(mocks.clock.is_some());
        assert!(mocks.rng.is_some());
    }

    #[test]
    fn test_builder_with_mock_http_responses() {
        let responses = vec![HttpResponse::ok(b"response1".to_vec()), HttpResponse::ok(b"response2".to_vec())];

        let (_, mocks) = SteamClient::builder().with_mock_http_responses(responses).build_with_mocks();

        assert!(mocks.http.is_some());
    }

    #[test]
    fn test_steam_client_builder_method() {
        // Verify the builder() method exists on SteamClient
        let client = SteamClient::builder().build();
        assert!(!client.is_logged_in());
    }

    #[test]
    fn test_mock_handles_clone() {
        let (_, mocks) = SteamClient::builder().with_mock_http().with_mock_clock().build_with_mocks();

        let cloned = mocks.clone();

        // Both should point to same mock
        mocks.clock_or_panic().advance(Duration::from_secs(5));
        assert_eq!(cloned.clock_or_panic().current_offset(), Duration::from_secs(5));
    }
}
