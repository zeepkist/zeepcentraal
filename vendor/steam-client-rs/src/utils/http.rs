//! HTTP client abstraction for dependency injection.
//!
//! This module provides an HTTP client trait that can be mocked for testing,
//! along with a default implementation using `reqwest`.
//!
//! # Example
//!
//! ```rust,ignore
//! // Using the default client
//! let client = ReqwestHttpClient::new();
//!
//! // Or in tests, use the mock
//! let mock = MockHttpClient::new()
//!     .with_response(HttpResponse::ok(b"response body".to_vec()));
//! ```

use std::{
    collections::{HashMap, VecDeque},
    sync::{Arc, Mutex},
};

use async_trait::async_trait;

use crate::error::SteamError;

/// HTTP response from a request.
#[derive(Debug, Clone)]
pub struct HttpResponse {
    /// HTTP status code.
    pub status: u16,
    /// Response body.
    pub body: Vec<u8>,
    /// Response headers (lowercase keys).
    pub headers: HashMap<String, String>,
}

impl HttpResponse {
    /// Create a successful response (200 OK).
    pub fn ok(body: Vec<u8>) -> Self {
        Self { status: 200, body, headers: HashMap::new() }
    }

    /// Create an error response.
    pub fn error(status: u16, body: Vec<u8>) -> Self {
        Self { status, body, headers: HashMap::new() }
    }

    /// Check if the response indicates success (2xx status).
    pub fn is_success(&self) -> bool {
        (200..300).contains(&self.status)
    }

    /// Parse the body as JSON.
    pub fn json<T: serde::de::DeserializeOwned>(&self) -> Result<T, SteamError> {
        serde_json::from_slice(&self.body).map_err(|e| SteamError::ProtocolError(format!("Failed to parse JSON: {}", e)))
    }

    /// Get body as string.
    pub fn text(&self) -> Result<String, SteamError> {
        String::from_utf8(self.body.clone()).map_err(|e| SteamError::ProtocolError(format!("Invalid UTF-8: {}", e)))
    }
}

/// HTTP client trait for making web requests.
///
/// This trait abstracts HTTP operations, enabling mock implementations
/// for unit testing without actual network calls.
#[async_trait]
pub trait HttpClient: Send + Sync {
    /// Perform a GET request.
    ///
    /// # Arguments
    /// * `url` - The URL to request
    async fn get(&self, url: &str) -> Result<HttpResponse, SteamError>;

    /// Perform a GET request with query parameters.
    ///
    /// # Arguments
    /// * `url` - The base URL
    /// * `query` - Query parameters as key-value pairs
    async fn get_with_query(&self, url: &str, query: &[(&str, &str)]) -> Result<HttpResponse, SteamError>;

    /// Perform a POST request with a body.
    ///
    /// # Arguments
    /// * `url` - The URL to post to
    /// * `body` - The request body
    /// * `content_type` - The content type header value
    async fn post(&self, url: &str, body: Vec<u8>, content_type: &str) -> Result<HttpResponse, SteamError>;

    /// Perform a POST request with form data.
    ///
    /// # Arguments
    /// * `url` - The URL to post to
    /// * `form` - Form fields as key-value pairs
    async fn post_form(&self, url: &str, form: &[(&str, &str)]) -> Result<HttpResponse, SteamError>;

    /// Perform a GET request carrying a raw `Cookie` header value.
    ///
    /// Default implementation delegates to `get(url)` and ignores cookies, so
    /// existing mock/test implementations keep compiling. Real HTTP clients
    /// should override this to attach the cookie header.
    ///
    /// # Arguments
    /// * `url` - The URL to request
    /// * `cookies` - Raw `Cookie` header value (e.g. `"sessionid=...; steamLoginSecure=..."`)
    async fn get_with_cookies(&self, url: &str, cookies: &str) -> Result<HttpResponse, SteamError> {
        let _ = cookies;
        self.get(url).await
    }

    /// Perform a POST form request carrying a raw `Cookie` header value.
    ///
    /// Default implementation delegates to `post_form(url, form)` and ignores
    /// cookies, so existing mock/test implementations keep compiling. Real HTTP
    /// clients should override this to attach the cookie header.
    async fn post_form_with_cookies(&self, url: &str, form: &[(&str, &str)], cookies: &str) -> Result<HttpResponse, SteamError> {
        let _ = cookies;
        self.post_form(url, form).await
    }
}

/// Default HTTP client implementation using `reqwest`.
///
/// Uses connection pooling for better performance.
#[derive(Clone)]
pub struct ReqwestHttpClient {
    client: reqwest::Client,
}

impl ReqwestHttpClient {
    /// Create a new HTTP client with optimized settings.
    ///
    /// Configures connection pooling with:
    /// - 10 idle connections per host
    /// - 60 second idle timeout
    /// - 5 second request timeout (matching Node.js implementation)
    /// - Custom User-Agent and default headers
    pub fn new() -> Self {
        use std::time::Duration;

        use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, ACCEPT_CHARSET, USER_AGENT};

        let mut headers = HeaderMap::new();
        headers.insert(USER_AGENT, HeaderValue::from_static("Valve/Steam HTTP Client 1.0"));
        headers.insert(ACCEPT, HeaderValue::from_static("text/html,*/*;q=0.9"));
        headers.insert(ACCEPT_CHARSET, HeaderValue::from_static("ISO-8859-1,utf-8,*;q=0.7"));

        // Bumped overall request timeout from 5s to 30s for slower Steam web endpoints; connect_timeout caps DNS+TCP+TLS setup.
        let client = reqwest::Client::builder().default_headers(headers).pool_max_idle_per_host(10).pool_idle_timeout(Duration::from_secs(60)).connect_timeout(Duration::from_secs(30)).timeout(Duration::from_secs(30)).gzip(true).build().unwrap_or_else(|_| reqwest::Client::new());

        Self { client }
    }

    /// Create with a custom `reqwest::Client`.
    pub fn with_client(client: reqwest::Client) -> Self {
        Self { client }
    }

    /// Convert reqwest response to our HttpResponse.
    async fn convert_response(resp: reqwest::Response) -> Result<HttpResponse, SteamError> {
        let status = resp.status().as_u16();
        let mut headers = HashMap::new();

        for (key, value) in resp.headers() {
            if let Ok(v) = value.to_str() {
                headers.insert(key.as_str().to_lowercase(), v.to_string());
            }
        }

        let body = resp.bytes().await.map_err(|e| SteamError::NetworkError(std::io::Error::other(e)))?.to_vec();

        Ok(HttpResponse { status, body, headers })
    }
}

impl Default for ReqwestHttpClient {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl HttpClient for ReqwestHttpClient {
    async fn get(&self, url: &str) -> Result<HttpResponse, SteamError> {
        let resp = self.client.get(url).send().await.map_err(|e| SteamError::NetworkError(std::io::Error::other(e)))?;

        Self::convert_response(resp).await
    }

    async fn get_with_query(&self, url: &str, query: &[(&str, &str)]) -> Result<HttpResponse, SteamError> {
        let resp = self.client.get(url).query(query).send().await.map_err(|e| SteamError::NetworkError(std::io::Error::other(e)))?;

        Self::convert_response(resp).await
    }

    async fn post(&self, url: &str, body: Vec<u8>, content_type: &str) -> Result<HttpResponse, SteamError> {
        let resp = self.client.post(url).header("Content-Type", content_type).body(body).send().await.map_err(|e| SteamError::NetworkError(std::io::Error::other(e)))?;

        Self::convert_response(resp).await
    }

    async fn post_form(&self, url: &str, form: &[(&str, &str)]) -> Result<HttpResponse, SteamError> {
        let resp = self.client.post(url).form(form).send().await.map_err(|e| SteamError::NetworkError(std::io::Error::other(e)))?;

        Self::convert_response(resp).await
    }

    async fn get_with_cookies(&self, url: &str, cookies: &str) -> Result<HttpResponse, SteamError> {
        let client = build_cookie_client(cookies)?;
        let resp = client.get(url).send().await.map_err(|e| SteamError::NetworkError(std::io::Error::other(e)))?;
        Self::convert_response(resp).await
    }

    async fn post_form_with_cookies(&self, url: &str, form: &[(&str, &str)], cookies: &str) -> Result<HttpResponse, SteamError> {
        let client = build_cookie_client(cookies)?;
        let resp = client.post(url).form(form).send().await.map_err(|e| SteamError::NetworkError(std::io::Error::other(e)))?;
        Self::convert_response(resp).await
    }
}

/// Build a transient `reqwest::Client` with a `Cookie` header (marked sensitive)
/// and a 10-second timeout. Used for one-off cookie-authenticated web requests.
fn build_cookie_client(cookies: &str) -> Result<reqwest::Client, SteamError> {
    use std::time::Duration;

    use reqwest::header::{HeaderMap, HeaderValue, COOKIE};

    let mut cookie_value: HeaderValue = cookies.parse().map_err(|_| SteamError::Other("Invalid cookie header".to_string()))?;
    cookie_value.set_sensitive(true);

    let mut headers = HeaderMap::new();
    headers.insert(COOKIE, cookie_value);

    reqwest::Client::builder()
        .user_agent("Valve/Steam HTTP Client 1.0")
        .default_headers(headers)
        .connect_timeout(Duration::from_secs(30))
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| SteamError::Other(format!("Failed to build HTTP client: {}", e)))
}

#[async_trait]
impl steam_cm_provider::HttpClient for dyn HttpClient {
    async fn get_with_query(&self, url: &str, query: &[(&str, &str)]) -> Result<steam_cm_provider::HttpResponse, steam_cm_provider::CmError> {
        let resp = self.get_with_query(url, query).await.map_err(|e| steam_cm_provider::CmError::Network(e.to_string()))?;

        Ok(steam_cm_provider::HttpResponse { status: resp.status, body: resp.body })
    }
}

#[async_trait]
impl steam_cm_provider::HttpClient for ReqwestHttpClient {
    async fn get_with_query(&self, url: &str, query: &[(&str, &str)]) -> Result<steam_cm_provider::HttpResponse, steam_cm_provider::CmError> {
        let resp = crate::utils::http::HttpClient::get_with_query(self, url, query).await.map_err(|e| steam_cm_provider::CmError::Network(e.to_string()))?;

        Ok(steam_cm_provider::HttpResponse { status: resp.status, body: resp.body })
    }
}

/// Mock HTTP client for testing.
///
/// Queues responses to be returned by subsequent requests.
/// Tracks all requests made for assertions.
///
/// # Example
///
/// ```rust,ignore
/// let mut mock = MockHttpClient::new();
/// mock.queue_response(HttpResponse::ok(r#"{"key": "value"}"#.as_bytes().to_vec()));
///
/// let response = mock.get("https://example.com").await?;
/// assert_eq!(response.status, 200);
///
/// // Verify the request was made
/// assert_eq!(mock.requests()[0].url, "https://example.com");
/// ```
pub struct MockHttpClient {
    /// Queued responses to return.
    responses: Arc<Mutex<VecDeque<Result<HttpResponse, SteamError>>>>,
    /// Recorded requests.
    requests: Arc<Mutex<Vec<MockRequest>>>,
}

/// A recorded HTTP request made to the mock client.
#[derive(Debug, Clone)]
pub struct MockRequest {
    /// HTTP method.
    pub method: String,
    /// Request URL.
    pub url: String,
    /// Query parameters (for get_with_query).
    pub query: Vec<(String, String)>,
    /// Request body (for POST).
    pub body: Option<Vec<u8>>,
    /// Content type (for POST).
    pub content_type: Option<String>,
}

impl MockHttpClient {
    /// Create a new mock HTTP client.
    pub fn new() -> Self {
        Self { responses: Arc::new(Mutex::new(VecDeque::new())), requests: Arc::new(Mutex::new(Vec::new())) }
    }

    /// Queue a response to be returned by the next request.
    pub fn queue_response(&self, response: HttpResponse) {
        self.responses.lock().expect("failed to get mock value").push_back(Ok(response));
    }

    /// Queue an error to be returned by the next request.
    pub fn queue_error(&self, error: SteamError) {
        self.responses.lock().expect("failed to get mock value").push_back(Err(error));
    }

    /// Queue multiple responses.
    pub fn queue_responses(&self, responses: Vec<HttpResponse>) {
        let mut queue = self.responses.lock().expect("failed to get mock value");
        for resp in responses {
            queue.push_back(Ok(resp));
        }
    }

    /// Get all recorded requests.
    pub fn requests(&self) -> Vec<MockRequest> {
        self.requests.lock().expect("failed to get mock value").clone()
    }

    /// Get the last request made.
    pub fn last_request(&self) -> Option<MockRequest> {
        self.requests.lock().expect("failed to get mock value").last().cloned()
    }

    /// Clear all recorded requests.
    pub fn clear_requests(&self) {
        self.requests.lock().expect("failed to get mock value").clear();
    }

    /// Get the number of requests made.
    pub fn request_count(&self) -> usize {
        self.requests.lock().expect("failed to get mock value").len()
    }

    /// Pop the next response from the queue.
    fn pop_response(&self) -> Result<HttpResponse, SteamError> {
        self.responses.lock().expect("failed to get mock value").pop_front().unwrap_or_else(|| Err(SteamError::Other("MockHttpClient: No response queued".to_string())))
    }

    /// Record a request.
    fn record_request(&self, request: MockRequest) {
        self.requests.lock().expect("failed to get mock value").push(request);
    }
}

impl Default for MockHttpClient {
    fn default() -> Self {
        Self::new()
    }
}

impl Clone for MockHttpClient {
    fn clone(&self) -> Self {
        Self { responses: Arc::clone(&self.responses), requests: Arc::clone(&self.requests) }
    }
}

#[async_trait]
impl HttpClient for MockHttpClient {
    async fn get(&self, url: &str) -> Result<HttpResponse, SteamError> {
        self.record_request(MockRequest { method: "GET".to_string(), url: url.to_string(), query: Vec::new(), body: None, content_type: None });
        self.pop_response()
    }

    async fn get_with_query(&self, url: &str, query: &[(&str, &str)]) -> Result<HttpResponse, SteamError> {
        self.record_request(MockRequest {
            method: "GET".to_string(),
            url: url.to_string(),
            query: query.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
            body: None,
            content_type: None,
        });
        self.pop_response()
    }

    async fn post(&self, url: &str, body: Vec<u8>, content_type: &str) -> Result<HttpResponse, SteamError> {
        self.record_request(MockRequest {
            method: "POST".to_string(),
            url: url.to_string(),
            query: Vec::new(),
            body: Some(body),
            content_type: Some(content_type.to_string()),
        });
        self.pop_response()
    }

    async fn post_form(&self, url: &str, form: &[(&str, &str)]) -> Result<HttpResponse, SteamError> {
        // Encode form data as body for tracking
        let form_body: String = form.iter().map(|(k, v)| format!("{}={}", k, v)).collect::<Vec<_>>().join("&");

        self.record_request(MockRequest {
            method: "POST".to_string(),
            url: url.to_string(),
            query: form.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
            body: Some(form_body.into_bytes()),
            content_type: Some("application/x-www-form-urlencoded".to_string()),
        });
        self.pop_response()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_mock_http_client_get() {
        let mock = MockHttpClient::new();
        mock.queue_response(HttpResponse::ok(b"test response".to_vec()));

        let response = mock.get("https://example.com/test").await.expect("failed to get mock value");

        assert_eq!(response.status, 200);
        assert_eq!(response.body, b"test response");
        assert!(response.is_success());

        let requests = mock.requests();
        assert_eq!(requests.len(), 1);
        assert_eq!(requests[0].method, "GET");
        assert_eq!(requests[0].url, "https://example.com/test");
    }

    #[tokio::test]
    async fn test_mock_http_client_get_with_query() {
        let mock = MockHttpClient::new();
        mock.queue_response(HttpResponse::ok(b"{}".to_vec()));

        let query = [("key", "value"), ("foo", "bar")];
        let response = mock.get_with_query("https://api.example.com", &query).await.expect("failed to get mock value");

        assert!(response.is_success());

        let request = mock.last_request().expect("failed to get mock value");
        assert_eq!(request.query.len(), 2);
        assert_eq!(request.query[0], ("key".to_string(), "value".to_string()));
    }

    #[tokio::test]
    async fn test_mock_http_client_post() {
        let mock = MockHttpClient::new();
        mock.queue_response(HttpResponse::ok(b"created".to_vec()));

        let body = b"request body".to_vec();
        let response = mock.post("https://api.example.com/create", body.clone(), "text/plain").await.expect("failed to get mock value");

        assert!(response.is_success());

        let request = mock.last_request().expect("failed to get mock value");
        assert_eq!(request.method, "POST");
        assert_eq!(request.body, Some(body));
        assert_eq!(request.content_type, Some("text/plain".to_string()));
    }

    #[tokio::test]
    async fn test_mock_http_client_error() {
        let mock = MockHttpClient::new();
        mock.queue_error(SteamError::Timeout);

        let result = mock.get("https://example.com").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_mock_http_client_no_response_queued() {
        let mock = MockHttpClient::new();

        let result = mock.get("https://example.com").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_http_response_json() {
        let response = HttpResponse::ok(br#"{"key": "value"}"#.to_vec());
        let json: serde_json::Value = response.json().expect("failed to get mock value");

        assert_eq!(json["key"], "value");
    }

    #[tokio::test]
    async fn test_http_response_is_success() {
        assert!(HttpResponse::ok(vec![]).is_success());
        assert!(HttpResponse { status: 201, body: vec![], headers: HashMap::new() }.is_success());
        assert!(!HttpResponse::error(404, vec![]).is_success());
        assert!(!HttpResponse::error(500, vec![]).is_success());
    }
}
