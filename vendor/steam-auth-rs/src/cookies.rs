//! Cookie handling utilities for Steam web authentication.
//!
//! This module provides pure functions for parsing and building cookies,
//! extracted from `LoginSession::get_web_cookies` to enable easier unit
//! testing.

use std::collections::{HashMap, HashSet};

use crate::error::SessionError;

/// Transfer endpoint information from finalize login response.
#[derive(Debug, Clone)]
pub struct TransferInfo {
    /// The URL to post the transfer request to.
    pub url: String,
    /// The nonce value for the transfer.
    pub nonce: Option<String>,
    /// The auth value for the transfer.
    pub auth: Option<String>,
}

/// Parse transfer info from finalize login JSON response.
///
/// # Arguments
/// * `json` - The parsed JSON value from the finalize login response
///
/// # Returns
/// * `Ok(Vec<TransferInfo>)` - List of transfer endpoints
/// * `Err(SessionError)` - If the transfer_info field is missing or malformed
///
/// # Example
/// ```rust,ignore
/// let json: serde_json::Value = response.json()?;
/// let transfers = parse_transfer_info(&json)?;
/// for transfer in transfers {
///     println!("Transfer to: {}", transfer.url);
/// }
/// ```
pub fn parse_transfer_info(json: &serde_json::Value) -> Result<Vec<TransferInfo>, SessionError> {
    let transfer_info = json["transfer_info"].as_array().ok_or(SessionError::NetworkError("No transfer_info in response".into()))?;

    let mut result = Vec::new();
    for transfer in transfer_info {
        let url = transfer["url"].as_str().ok_or(SessionError::NetworkError("Missing transfer URL".into()))?.to_string();

        let params = &transfer["params"];
        let nonce = params["nonce"].as_str().map(String::from);
        let auth = params["auth"].as_str().map(String::from);

        result.push(TransferInfo { url, nonce, auth });
    }

    Ok(result)
}

/// Extract the domain from a URL for cookie setting.
///
/// # Arguments
/// * `url` - The URL to extract the domain from
///
/// # Returns
/// * `Some(String)` - The domain (host) extracted from the URL
/// * `None` - If the URL cannot be parsed or has no host
pub fn extract_domain_from_url(url: &str) -> Option<String> {
    url::Url::parse(url).ok().and_then(|parsed| parsed.host_str().map(String::from))
}

/// Build a cookie string with domain attached.
///
/// If the cookie already has a Domain attribute, returns it as-is.
/// Otherwise, appends the domain from the URL.
///
/// # Arguments
/// * `cookie_str` - The raw cookie string from the Set-Cookie header
/// * `url` - The URL the cookie came from (for domain extraction)
///
/// # Returns
/// * `Some(String)` - The cookie with domain attached
/// * `None` - If the URL has no valid domain
pub fn build_cookie_with_domain(cookie_str: &str, url: &str) -> Option<String> {
    let domain = extract_domain_from_url(url)?;

    if cookie_str.to_lowercase().contains("domain=") {
        Some(cookie_str.to_string())
    } else {
        Some(format!("{}; Domain={}", cookie_str, domain))
    }
}

/// Parse cookies from a Set-Cookie header value.
///
/// Handles both comma-separated and newline-separated cookies.
///
/// # Arguments
/// * `header_value` - The value of the Set-Cookie header
/// * `url` - The URL the cookies came from (for domain extraction)
///
/// # Returns
/// A vector of cookie strings with domains attached
pub fn parse_cookies_from_header(header_value: &str, url: &str) -> Vec<String> {
    let mut cookies = Vec::new();
    let mut seen = std::collections::HashSet::new();

    // First split by newlines, then by ", " for each line
    for line in header_value.split('\n') {
        for cookie_str in line.split(", ") {
            let cookie_str = cookie_str.trim();
            if cookie_str.starts_with("steamLoginSecure=") {
                if let Some(cookie) = build_cookie_with_domain(cookie_str, url) {
                    // Deduplicate cookies
                    if !seen.contains(&cookie) {
                        seen.insert(cookie.clone());
                        cookies.push(cookie);
                    }
                }
            }
        }
    }

    cookies
}

/// Extract unique domains from a list of cookies.
///
/// Parses the Domain= attribute from each cookie and returns unique domains,
/// excluding login.steampowered.com.
///
/// # Arguments
/// * `cookies` - List of cookie strings
///
/// # Returns
/// A set of unique domain strings
pub fn extract_cookie_domains(cookies: &[String]) -> HashSet<String> {
    cookies.iter().filter_map(|c| c.split("Domain=").nth(1).map(|d| d.split(';').next().unwrap_or(d).to_string())).filter(|d| d != "login.steampowered.com").collect()
}

/// Add sessionid cookies for all domains.
///
/// Creates sessionid cookies for each domain with proper attributes.
///
/// # Arguments
/// * `cookies` - Mutable list of cookies to append to
/// * `session_id` - The session ID value to use
/// * `domains` - Set of domains to create cookies for
pub fn add_session_id_cookies(cookies: &mut Vec<String>, session_id: &str, domains: &HashSet<String>) {
    for domain in domains {
        cookies.push(format!("sessionid={}; Path=/; Secure; SameSite=None; Domain={}", session_id, domain));
    }
}

/// Filter out sessionid cookies from a list.
///
/// Removes any existing sessionid cookies to prepare for adding fresh ones.
///
/// # Arguments
/// * `cookies` - Mutable list of cookies to filter
pub fn filter_session_id_cookies(cookies: &mut Vec<String>) {
    cookies.retain(|c| !c.starts_with("sessionid="));
}

/// Build cookies for non-WebBrowser platforms (MobileApp, SteamClient).
///
/// Creates a simple cookie set with steamLoginSecure and sessionid.
///
/// # Arguments
/// * `steam_id` - The user's Steam ID
/// * `access_token` - The access token
/// * `session_id` - The generated session ID
///
/// # Returns
/// A vector containing the two required cookies
pub fn build_simple_cookies(steam_id: u64, access_token: &str, session_id: &str) -> Vec<String> {
    let cookie_value = format!("{}||{}", steam_id, access_token);
    let encoded = urlencoding::encode(&cookie_value);

    vec![format!("steamLoginSecure={}", encoded), format!("sessionid={}", session_id)]
}

/// Check for errors in finalize login response.
///
/// # Arguments
/// * `json` - The parsed JSON response
///
/// # Returns
/// * `Ok(())` - If no error is present
/// * `Err(SessionError)` - If an error is found in the response
pub fn check_finalize_error(json: &serde_json::Value) -> Result<(), SessionError> {
    if let Some(error) = json.get("error") {
        if !error.is_null() {
            let eresult_val = json["eresult"].as_i64().or_else(|| json["error"].as_i64()).unwrap_or(2) as i32; // Default to EResult::Fail

            return Err(SessionError::from_eresult(eresult_val, Some(error.to_string())));
        }
    }
    Ok(())
}
/// Extract steamLoginSecure cookies from a Set-Cookie header.
///
/// This function is specifically optimized for extracting authentication
/// cookies from Steam's login flow responses.
///
/// # Arguments
/// * `cookie_header` - The raw Set-Cookie header value (may contain multiple
///   cookies)
/// * `url` - The URL the cookies came from (for domain extraction)
///
/// # Returns
/// A vector of steamLoginSecure cookie strings with domains attached
///
/// # Example
/// ```rust,ignore
/// let header = "steamLoginSecure=abc123; Path=/; HttpOnly";
/// let cookies = extract_steam_login_cookies(header, "https://store.steampowered.com/");
/// assert_eq!(cookies.len(), 1);
/// ```
pub fn extract_steam_login_cookies(cookie_header: &str, url: &str) -> Vec<String> {
    let mut cookies = Vec::new();
    let mut seen = std::collections::HashSet::new();

    // First split by newlines, then by ", " for each line
    for line in cookie_header.split('\n') {
        for cookie_str in line.split(", ") {
            let cookie_str = cookie_str.trim();
            if cookie_str.starts_with("steamLoginSecure=") {
                if let Some(cookie) = build_cookie_with_domain(cookie_str, url) {
                    // Deduplicate cookies
                    if !seen.contains(&cookie) {
                        seen.insert(cookie.clone());
                        cookies.push(cookie);
                    }
                }
            }
        }
    }

    cookies
}

/// Build form parameters for a transfer request.
///
/// Creates a HashMap of form fields required for Steam's token transfer
/// endpoint.
///
/// # Arguments
/// * `transfer` - The TransferInfo containing nonce and auth values
/// * `steam_id` - The user's Steam ID
///
/// # Returns
/// A HashMap containing the form fields (steamID, and optionally nonce/auth)
///
/// # Example
/// ```rust,ignore
/// let transfer = TransferInfo { url: "...", nonce: Some("n123".into()), auth: Some("a456".into()) };
/// let params = build_transfer_form_params(&transfer, 76561198000000000);
/// assert_eq!(params.get("steamID"), Some(&"76561198000000000".to_string()));
/// ```
pub fn build_transfer_form_params(transfer: &TransferInfo, steam_id: u64) -> HashMap<String, String> {
    let mut params = HashMap::new();
    params.insert("steamID".to_string(), steam_id.to_string());

    if let Some(ref nonce) = transfer.nonce {
        params.insert("nonce".to_string(), nonce.clone());
    }
    if let Some(ref auth) = transfer.auth {
        params.insert("auth".to_string(), auth.clone());
    }

    params
}

// ============================================================================
// Transfer execution functions (extracted from LoginSession::get_web_cookies)
// ============================================================================

use std::time::Duration;

use crate::http_client::{HttpClient, MultipartForm};

/// Result of executing a single transfer request.
///
/// This enum represents the possible outcomes of a transfer attempt,
/// allowing the caller to decide whether to retry or handle the result.
#[derive(Debug)]
pub enum TransferResult {
    /// Transfer succeeded with extracted cookies.
    Success(Vec<String>),
    /// Transfer failed but should be retried (e.g., 429 Too Many Requests).
    Retry,
    /// Transfer failed with a fatal error that should not be retried.
    Error(SessionError),
}

/// Execute a single transfer request and extract cookies from the response.
pub async fn execute_single_transfer(http_client: &HttpClient, transfer: &TransferInfo, steam_id: u64) -> TransferResult {
    // Build form data
    let form = MultipartForm::new().text("steamID", steam_id.to_string());

    let form = if let Some(ref nonce) = transfer.nonce { form.text("nonce", nonce.clone()) } else { form };

    let form = if let Some(ref auth) = transfer.auth { form.text("auth", auth.clone()) } else { form };

    // Execute request
    let result = http_client.post_multipart(&transfer.url, form, HashMap::new()).await;

    match result {
        Ok(response) if response.is_success() => {
            // Extract cookies from response
            let cookies = if let Some(cookie_header) = response.get_header("set-cookie") {
                extract_steam_login_cookies(cookie_header, &transfer.url)
            } else {
                // Also check for multiple Set-Cookie headers
                let headers = response.get_all_headers("set-cookie");
                let mut all_cookies = Vec::new();
                for header in headers {
                    all_cookies.extend(extract_steam_login_cookies(header, &transfer.url));
                }
                all_cookies
            };
            TransferResult::Success(cookies)
        }
        Ok(response) => {
            // Non-success status (e.g., 429 Too Many Requests)
            tracing::debug!("Transfer to {} returned status {}, will retry", transfer.url, response.status);
            TransferResult::Retry
        }
        Err(e) => {
            tracing::debug!("Transfer to {} failed with error: {:?}", transfer.url, e);
            TransferResult::Retry
        }
    }
}

/// Execute all transfers with retry logic.
pub async fn execute_transfers_with_retry(http_client: &HttpClient, transfers: &[TransferInfo], steam_id: u64, max_retries: usize, retry_delay: Duration) -> Result<Vec<String>, SessionError> {
    let mut all_cookies = Vec::new();

    for transfer in transfers {
        let mut last_status = None;

        for attempt in 0..max_retries {
            match execute_single_transfer(http_client, transfer, steam_id).await {
                TransferResult::Success(cookies) => {
                    all_cookies.extend(cookies);
                    break;
                }
                TransferResult::Retry if attempt < max_retries - 1 => {
                    // Wait before retrying
                    tokio::time::sleep(retry_delay).await;
                }
                TransferResult::Retry => {
                    // Final retry attempt failed
                    last_status = Some("retry limit exceeded");
                }
                TransferResult::Error(e) => {
                    return Err(e);
                }
            }
        }

        if let Some(status) = last_status {
            return Err(SessionError::NetworkError(format!("Transfer to {} failed: {} after {} attempts", transfer.url, status, max_retries)));
        }
    }

    Ok(all_cookies)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_domain_from_url() {
        assert_eq!(extract_domain_from_url("https://store.steampowered.com/login"), Some("store.steampowered.com".to_string()));
        assert_eq!(extract_domain_from_url("https://steamcommunity.com/"), Some("steamcommunity.com".to_string()));
        assert_eq!(extract_domain_from_url("invalid-url"), None);
    }

    #[test]
    fn test_build_cookie_with_domain() {
        let cookie = "steamLoginSecure=abc123";
        let url = "https://store.steampowered.com/login";

        let result = build_cookie_with_domain(cookie, url);
        assert_eq!(result, Some("steamLoginSecure=abc123; Domain=store.steampowered.com".to_string()));
    }

    #[test]
    fn test_build_cookie_with_existing_domain() {
        let cookie = "steamLoginSecure=abc123; Domain=steampowered.com";
        let url = "https://store.steampowered.com/login";

        let result = build_cookie_with_domain(cookie, url);
        assert_eq!(result, Some("steamLoginSecure=abc123; Domain=steampowered.com".to_string()));
    }

    #[test]
    fn test_parse_cookies_from_header() {
        let header = "steamLoginSecure=abc123, steamLoginSecure=def456";
        let url = "https://store.steampowered.com/";

        let cookies = parse_cookies_from_header(header, url);
        assert_eq!(cookies.len(), 2);
        assert!(cookies[0].contains("steamLoginSecure=abc123"));
        assert!(cookies[0].contains("Domain=store.steampowered.com"));
    }

    #[test]
    fn test_parse_cookies_ignores_non_login_cookies() {
        // Multiple Set-Cookie headers are comma-separated or newline-separated
        let header = "sessionid=xyz, steamLoginSecure=abc123";
        let url = "https://store.steampowered.com/";

        let cookies = parse_cookies_from_header(header, url);
        assert_eq!(cookies.len(), 1);
        assert!(cookies[0].contains("steamLoginSecure=abc123"));
    }

    #[test]
    fn test_extract_cookie_domains() {
        let cookies = vec![
            "steamLoginSecure=abc; Domain=store.steampowered.com".to_string(),
            "steamLoginSecure=def; Domain=steamcommunity.com".to_string(),
            "steamLoginSecure=ghi; Domain=login.steampowered.com".to_string(), // Should be excluded
        ];

        let domains = extract_cookie_domains(&cookies);
        assert_eq!(domains.len(), 2);
        assert!(domains.contains("store.steampowered.com"));
        assert!(domains.contains("steamcommunity.com"));
        assert!(!domains.contains("login.steampowered.com"));
    }

    #[test]
    fn test_add_session_id_cookies() {
        let mut cookies = Vec::new();
        let mut domains = HashSet::new();
        domains.insert("store.steampowered.com".to_string());
        domains.insert("steamcommunity.com".to_string());

        add_session_id_cookies(&mut cookies, "sess123", &domains);

        assert_eq!(cookies.len(), 2);
        for cookie in &cookies {
            assert!(cookie.starts_with("sessionid=sess123"));
            assert!(cookie.contains("Path=/"));
            assert!(cookie.contains("Secure"));
        }
    }

    #[test]
    fn test_filter_session_id_cookies() {
        let mut cookies = vec!["sessionid=old".to_string(), "steamLoginSecure=abc".to_string(), "sessionid=another".to_string()];

        filter_session_id_cookies(&mut cookies);

        assert_eq!(cookies.len(), 1);
        assert_eq!(cookies[0], "steamLoginSecure=abc");
    }

    #[test]
    fn test_build_simple_cookies() {
        let cookies = build_simple_cookies(76561198000000000, "access_token_here", "sess123");

        assert_eq!(cookies.len(), 2);
        assert!(cookies[0].starts_with("steamLoginSecure="));
        assert!(cookies[0].contains("76561198000000000"));
        assert_eq!(cookies[1], "sessionid=sess123");
    }

    #[test]
    fn test_parse_transfer_info() {
        let json: serde_json::Value = serde_json::from_str(
            r#"{
            "transfer_info": [
                {
                    "url": "https://store.steampowered.com/login/settoken",
                    "params": {
                        "nonce": "nonce123",
                        "auth": "auth456"
                    }
                },
                {
                    "url": "https://steamcommunity.com/login/settoken",
                    "params": {
                        "nonce": "nonce789"
                    }
                }
            ]
        }"#,
        )
        .unwrap();

        let result = parse_transfer_info(&json).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].url, "https://store.steampowered.com/login/settoken");
        assert_eq!(result[0].nonce, Some("nonce123".to_string()));
        assert_eq!(result[0].auth, Some("auth456".to_string()));
        assert_eq!(result[1].url, "https://steamcommunity.com/login/settoken");
        assert!(result[1].auth.is_none());
    }

    #[test]
    fn test_parse_transfer_info_missing() {
        let json: serde_json::Value = serde_json::from_str("{}").unwrap();

        let result = parse_transfer_info(&json);
        assert!(result.is_err());
    }

    #[test]
    fn test_check_finalize_error_no_error() {
        let json: serde_json::Value = serde_json::from_str(
            r#"{
            "transfer_info": []
        }"#,
        )
        .unwrap();

        assert!(check_finalize_error(&json).is_ok());
    }

    #[test]
    fn test_check_finalize_error_with_error() {
        let json: serde_json::Value = serde_json::from_str(
            r#"{
            "error": "Invalid token"
        }"#,
        )
        .unwrap();

        let result = check_finalize_error(&json);
        assert!(result.is_err());
    }

    #[test]
    fn test_check_finalize_error_null_error() {
        let json: serde_json::Value = serde_json::from_str(
            r#"{
            "error": null,
            "transfer_info": []
        }"#,
        )
        .unwrap();

        assert!(check_finalize_error(&json).is_ok());
    }

    #[test]
    fn test_extract_steam_login_cookies_single() {
        let header = "steamLoginSecure=abc123; Path=/; HttpOnly";
        let url = "https://store.steampowered.com/";

        let cookies = extract_steam_login_cookies(header, url);
        assert_eq!(cookies.len(), 1);
        assert!(cookies[0].contains("steamLoginSecure=abc123"));
        assert!(cookies[0].contains("Domain=store.steampowered.com"));
    }

    #[test]
    fn test_extract_steam_login_cookies_multiple() {
        let header = "steamLoginSecure=abc123, steamLoginSecure=def456";
        let url = "https://store.steampowered.com/";

        let cookies = extract_steam_login_cookies(header, url);
        assert_eq!(cookies.len(), 2);
    }

    #[test]
    fn test_extract_steam_login_cookies_with_newlines() {
        let header = "other=cookie\nsteamLoginSecure=abc123";
        let url = "https://store.steampowered.com/";

        let cookies = extract_steam_login_cookies(header, url);
        assert_eq!(cookies.len(), 1);
        assert!(cookies[0].contains("steamLoginSecure=abc123"));
    }

    #[test]
    fn test_extract_steam_login_cookies_ignores_other() {
        let header = "sessionid=xyz; Path=/";
        let url = "https://store.steampowered.com/";

        let cookies = extract_steam_login_cookies(header, url);
        assert!(cookies.is_empty());
    }

    #[test]
    fn test_build_transfer_form_params_full() {
        let transfer = TransferInfo { url: "https://test.com".to_string(), nonce: Some("nonce123".to_string()), auth: Some("auth456".to_string()) };

        let params = build_transfer_form_params(&transfer, 76561198000000000);

        assert_eq!(params.get("steamID"), Some(&"76561198000000000".to_string()));
        assert_eq!(params.get("nonce"), Some(&"nonce123".to_string()));
        assert_eq!(params.get("auth"), Some(&"auth456".to_string()));
    }

    #[test]
    fn test_build_transfer_form_params_nonce_only() {
        let transfer = TransferInfo { url: "https://test.com".to_string(), nonce: Some("nonce123".to_string()), auth: None };

        let params = build_transfer_form_params(&transfer, 12345);

        assert_eq!(params.get("steamID"), Some(&"12345".to_string()));
        assert_eq!(params.get("nonce"), Some(&"nonce123".to_string()));
        assert!(!params.contains_key("auth"));
    }

    #[test]
    fn test_build_transfer_form_params_minimal() {
        let transfer = TransferInfo { url: "https://test.com".to_string(), nonce: None, auth: None };

        let params = build_transfer_form_params(&transfer, 99999);

        assert_eq!(params.len(), 1);
        assert_eq!(params.get("steamID"), Some(&"99999".to_string()));
    }
}
