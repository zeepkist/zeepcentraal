//! HTTP client for Steam web authentication.
//!
//! This module provides an `HttpClient` implementation using reqwest.

use std::collections::HashMap;

use crate::error::SessionError;

/// HTTP response from a request.
#[derive(Debug, Clone)]
pub struct HttpResponse {
    /// HTTP status code.
    pub status: u16,
    /// Response headers.
    pub headers: HashMap<String, String>,
    /// Response body as bytes.
    pub body: Vec<u8>,
}

impl HttpResponse {
    /// Check if the response status is successful (2xx).
    pub fn is_success(&self) -> bool {
        (200..300).contains(&self.status)
    }

    /// Parse the body as JSON.
    pub fn json<T: serde::de::DeserializeOwned>(&self) -> Result<T, SessionError> {
        serde_json::from_slice(&self.body).map_err(|e| SessionError::NetworkError(format!("JSON parse error: {}", e)))
    }

    /// Get a header value by name (case-insensitive).
    pub fn get_header(&self, name: &str) -> Option<&String> {
        let lower = name.to_lowercase();
        self.headers.iter().find(|(k, _)| k.to_lowercase() == lower).map(|(_, v)| v)
    }

    /// Get all values for a header (for multi-value headers like Set-Cookie).
    pub fn get_all_headers(&self, name: &str) -> Vec<&String> {
        let lower = name.to_lowercase();
        self.headers.iter().filter(|(k, _)| k.to_lowercase() == lower).map(|(_, v)| v).collect()
    }
}

/// Multipart form field.
#[derive(Debug, Clone)]
pub struct FormField {
    /// Field name.
    pub name: String,
    /// Field value.
    pub value: String,
}

/// Multipart form for HTTP requests.
#[derive(Debug, Clone, Default)]
pub struct MultipartForm {
    /// Form fields.
    pub fields: Vec<FormField>,
}

impl MultipartForm {
    /// Create a new empty form.
    pub fn new() -> Self {
        Self::default()
    }

    /// Add a text field to the form.
    pub fn text(mut self, name: impl Into<String>, value: impl Into<String>) -> Self {
        self.fields.push(FormField { name: name.into(), value: value.into() });
        self
    }
}

/// Production HTTP client using reqwest.
#[derive(Debug, Clone)]
pub struct HttpClient {
    client: reqwest::Client,
}

impl HttpClient {
    /// Create a new HTTP client.
    pub fn new() -> Self {
        Self { client: reqwest::Client::new() }
    }

    /// Create a new HTTP client with a custom reqwest client.
    pub fn with_client(client: reqwest::Client) -> Self {
        Self { client }
    }

    /// Send a POST request with multipart form data.
    pub async fn post_multipart(&self, url: &str, form: MultipartForm, headers: HashMap<String, String>) -> Result<HttpResponse, SessionError> {
        let mut req_form = reqwest::multipart::Form::new();
        for field in form.fields {
            req_form = req_form.text(field.name, field.value);
        }

        let mut req = self.client.post(url).multipart(req_form);

        for (key, value) in &headers {
            req = req.header(key, value);
        }

        let response = req.send().await?;
        let status = response.status().as_u16();

        // Collect headers, handling multi-value headers
        let mut response_headers = HashMap::new();
        for (name, value) in response.headers() {
            if let Ok(v) = value.to_str() {
                // For Set-Cookie and similar, we need special handling
                // For now, just store the last value (or combine them)
                let key = name.to_string();
                response_headers.entry(key).and_modify(|existing: &mut String| existing.push_str(&format!(", {}", v))).or_insert_with(|| v.to_string());
            }
        }

        let body = response.bytes().await?.to_vec();

        Ok(HttpResponse { status, headers: response_headers, body })
    }

    /// Send a POST request with JSON body.
    pub async fn post_json(&self, url: &str, body: &[u8], headers: HashMap<String, String>) -> Result<HttpResponse, SessionError> {
        let mut req = self.client.post(url).body(body.to_vec());

        for (key, value) in &headers {
            req = req.header(key, value);
        }

        let response = req.send().await?;
        let status = response.status().as_u16();

        let mut response_headers = HashMap::new();
        for (name, value) in response.headers() {
            if let Ok(v) = value.to_str() {
                response_headers.insert(name.to_string(), v.to_string());
            }
        }

        let body = response.bytes().await?.to_vec();

        Ok(HttpResponse { status, headers: response_headers, body })
    }
}

impl Default for HttpClient {
    fn default() -> Self {
        Self::new()
    }
}
