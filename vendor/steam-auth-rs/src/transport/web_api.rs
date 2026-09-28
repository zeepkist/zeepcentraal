//! WebAPI transport for browser and mobile app authentication.

use base64::{engine::general_purpose::STANDARD, Engine};
use reqwest::Client;

use crate::{
    error::SessionError,
    transport::{ApiRequest, ApiResponse},
};

const WEBAPI_BASE: &str = "https://api.steampowered.com";

/// Requests that use GET instead of POST.
const GET_REQUESTS: &[&str] = &["IAuthenticationService/GetPasswordRSAPublicKey/v1/"];

/// WebAPI transport for Steam authentication.
#[derive(Debug, Clone)]
pub struct WebApiTransport {
    client: Client,
}

impl WebApiTransport {
    /// Create a new WebAPI transport.
    pub fn new() -> Result<Self, SessionError> {
        Ok(Self { client: Client::builder().user_agent(crate::helpers::default_user_agent()).build()? })
    }

    /// Create a new WebAPI transport with custom client.
    pub fn with_client(client: Client) -> Self {
        Self { client }
    }
}

impl Default for WebApiTransport {
    fn default() -> Self {
        Self::new().unwrap_or_else(|_| Self { client: Client::new() })
    }
}

impl WebApiTransport {
    /// Send a request and receive a response.
    pub async fn send_request(&self, request: ApiRequest) -> Result<ApiResponse, SessionError> {
        let url_path = format!("I{}Service/{}/v{}/", request.api_interface, request.api_method, request.api_version);
        let url = format!("{}/{}", WEBAPI_BASE, url_path);
        let is_get = GET_REQUESTS.contains(&url_path.as_str());

        // Build request
        let mut req_builder = if is_get { self.client.get(&url) } else { self.client.post(&url) };

        // Add default headers
        req_builder = req_builder.header("Accept", "application/json, text/plain, */*").header("Sec-Fetch-Site", "cross-site").header("Sec-Fetch-Mode", "cors").header("Sec-Fetch-Dest", "empty");

        // Add custom headers
        for (key, value) in &request.headers {
            req_builder = req_builder.header(key, value);
        }

        // Add access token to query string if present
        if let Some(ref token) = request.access_token {
            req_builder = req_builder.query(&[("access_token", token)]);
        }

        // Add request data
        if let Some(ref data) = request.request_data {
            let encoded = STANDARD.encode(data);
            if is_get {
                req_builder = req_builder.query(&[("input_protobuf_encoded", &encoded)]);
            } else {
                // Use multipart form for POST (matches the TypeScript implementation)
                let form = reqwest::multipart::Form::new().text("input_protobuf_encoded", encoded);
                req_builder = req_builder.multipart(form);
            }
        }

        // Check for mobile app request
        if request.headers.get("cookie").is_some_and(|c| c.contains("mobileClientVersion=")) && is_get {
            req_builder = req_builder.query(&[("origin", "SteamMobile")]);
        }

        tracing::debug!("Sending {} request to {}", if is_get { "GET" } else { "POST" }, url);

        let response = req_builder.send().await?;

        let status = response.status();
        if !status.is_success() {
            return Err(SessionError::NetworkError(format!("WebAPI error {}", status)));
        }

        // Extract EResult from headers
        let eresult = response.headers().get("x-eresult").and_then(|v| v.to_str().ok()).and_then(|v| v.parse().ok());

        let error_message = response.headers().get("x-error_message").and_then(|v| v.to_str().ok()).map(String::from);

        let body = response.bytes().await?;

        Ok(ApiResponse { result: eresult, error_message, response_data: if body.is_empty() { None } else { Some(body.to_vec()) } })
    }
}
