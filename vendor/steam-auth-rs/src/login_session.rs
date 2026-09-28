//! Steam login session management.

use std::time::{Duration, Instant};

use steam_protos::{EAuthTokenPlatformType, ESessionPersistence};
use steamid::SteamID;

use crate::{
    auth_client::AuthenticationClient,
    cookies::{add_session_id_cookies, build_simple_cookies, check_finalize_error, execute_transfers_with_retry, extract_cookie_domains, filter_session_id_cookies, parse_transfer_info},
    error::SessionError,
    helpers::decode_jwt,
    http_client::{HttpClient, MultipartForm},
    transport::{Transport, WebApiTransport},
    types::{CredentialsDetails, LoginSessionOptions, PollResult, StartAuthSessionResponse, StartSessionResponse},
    validation::{determine_required_code_type, generate_session_id, process_confirmations, validate_access_token, validate_refresh_token},
};

/// The primary interface for Steam authentication.
pub struct LoginSession {
    platform_type: EAuthTokenPlatformType,
    handler: AuthenticationClient,
    http_client: HttpClient,

    // Session state
    steam_id: Option<SteamID>,
    account_name: Option<String>,
    access_token: Option<String>,
    refresh_token: Option<String>,
    steam_guard_machine_token: Option<String>,

    // Internal state
    start_session_response: Option<StartAuthSessionResponse>,
    polling_started_time: Option<Instant>,
    login_timeout: Duration,
    steam_guard_code: Option<String>,
    had_remote_interaction: bool,
    polling_canceled: bool,
}

/// Builder for creating `LoginSession` instances.
pub struct LoginSessionBuilder {
    platform_type: EAuthTokenPlatformType,
    transport: Option<Transport>,
    http_client: Option<HttpClient>,
    auth_client: Option<AuthenticationClient>,
    options: LoginSessionOptions,
}

impl LoginSessionBuilder {
    pub fn new(platform_type: EAuthTokenPlatformType) -> Self {
        Self {
            platform_type,
            transport: None,
            http_client: None,
            auth_client: None,
            options: LoginSessionOptions::default(),
        }
    }

    pub fn with_transport(mut self, transport: Transport) -> Self {
        self.transport = Some(transport);
        self
    }

    pub fn with_http_client(mut self, client: HttpClient) -> Self {
        self.http_client = Some(client);
        self
    }

    pub fn with_auth_client(mut self, client: AuthenticationClient) -> Self {
        self.auth_client = Some(client);
        self
    }

    pub fn with_options(mut self, options: LoginSessionOptions) -> Self {
        self.options = options;
        self
    }

    pub fn build(self) -> LoginSession {
        let http_client = self.http_client.unwrap_or_default();

        let handler = if let Some(auth_client) = self.auth_client {
            auth_client
        } else {
            let transport = self.transport.unwrap_or_else(|| Transport::WebApi(WebApiTransport::default()));
            AuthenticationClient::new(transport, self.platform_type, self.options.machine_id, self.options.machine_friendly_name)
        };

        LoginSession {
            platform_type: self.platform_type,
            handler,
            http_client,
            steam_id: None,
            account_name: None,
            access_token: None,
            refresh_token: None,
            steam_guard_machine_token: None,
            start_session_response: None,
            polling_started_time: None,
            login_timeout: Duration::from_secs(60),
            steam_guard_code: None,
            had_remote_interaction: false,
            polling_canceled: false,
        }
    }
}

impl LoginSession {
    pub fn new(platform_type: EAuthTokenPlatformType, options: Option<LoginSessionOptions>) -> Self {
        LoginSessionBuilder::new(platform_type).with_options(options.unwrap_or_default()).build()
    }

    pub fn builder(platform_type: EAuthTokenPlatformType) -> LoginSessionBuilder {
        LoginSessionBuilder::new(platform_type)
    }

    pub fn from_refresh_token(token: String) -> Result<Self, SessionError> {
        let platform_type = if let Ok(payload) = decode_jwt(&token) {
            if payload.aud.contains(&"client".to_string()) {
                EAuthTokenPlatformType::KEAuthTokenPlatformTypeSteamClient
            } else if payload.aud.contains(&"mobile".to_string()) {
                EAuthTokenPlatformType::KEAuthTokenPlatformTypeMobileApp
            } else if payload.aud.contains(&"web".to_string()) {
                EAuthTokenPlatformType::KEAuthTokenPlatformTypeWebBrowser
            } else {
                EAuthTokenPlatformType::KEAuthTokenPlatformTypeSteamClient
            }
        } else {
            EAuthTokenPlatformType::KEAuthTokenPlatformTypeSteamClient
        };

        let mut session = Self::new(platform_type, None);
        session.set_refresh_token(&token)?;
        Ok(session)
    }

    pub fn steam_id(&self) -> Option<&SteamID> {
        self.steam_id.as_ref()
    }

    pub fn account_name(&self) -> Option<&str> {
        self.account_name.as_deref()
    }

    pub fn access_token(&self) -> Option<&str> {
        self.access_token.as_deref()
    }

    pub fn refresh_token(&self) -> Option<&str> {
        self.refresh_token.as_deref()
    }

    pub fn steam_guard_machine_token(&self) -> Option<&str> {
        self.steam_guard_machine_token.as_deref()
    }

    pub fn set_login_timeout(&mut self, timeout: Duration) -> Result<(), SessionError> {
        if self.polling_started_time.is_some() {
            return Err(SessionError::InvalidState);
        }
        self.login_timeout = timeout;
        Ok(())
    }

    pub fn set_refresh_token(&mut self, token: &str) -> Result<(), SessionError> {
        let validated = validate_refresh_token(token, self.platform_type)?;
        self.steam_id = Some(validated.steam_id);
        self.refresh_token = Some(validated.token);
        Ok(())
    }

    pub fn set_access_token(&mut self, token: &str) -> Result<(), SessionError> {
        let validated = validate_access_token(token, self.steam_id.as_ref())?;
        self.access_token = Some(validated);
        Ok(())
    }

    pub async fn start_with_credentials(&mut self, details: CredentialsDetails) -> Result<StartSessionResponse, SessionError> {
        if self.start_session_response.is_some() {
            return Err(SessionError::InvalidState);
        }

        self.had_remote_interaction = false;
        self.steam_guard_code = details.steam_guard_code.clone();

        if let Some(ref token) = details.steam_guard_machine_token {
            self.steam_guard_machine_token = Some(token.clone());
        }

        let encrypted = self.handler.encrypt_password(&details.account_name, &details.password).await?;

        let response = self.handler.start_session_with_credentials(&details.account_name, &encrypted.encrypted_password, encrypted.key_timestamp, details.persistence.unwrap_or(ESessionPersistence::KESessionPersistencePersistent), details.steam_guard_machine_token.as_deref()).await?;

        if let Some(steam_id64) = response.steam_id {
            self.steam_id = Some(SteamID::from(steam_id64));
        }

        self.start_session_response = Some(response);
        self.polling_canceled = false;

        self.process_start_session_response().await
    }

    pub async fn start_with_qr(&mut self) -> Result<StartSessionResponse, SessionError> {
        if self.start_session_response.is_some() {
            return Err(SessionError::InvalidState);
        }

        self.had_remote_interaction = false;

        let response = self.handler.start_session_with_qr().await?;

        self.start_session_response = Some(response);
        self.polling_canceled = false;

        self.process_start_session_response().await
    }

    pub async fn submit_steam_guard_code(&mut self, code: &str) -> Result<(), SessionError> {
        let response = self.start_session_response.as_ref().ok_or(SessionError::NotStarted)?;

        if self.polling_canceled {
            return Err(SessionError::Canceled);
        }

        let steam_id = self.steam_id.as_ref().ok_or(SessionError::InvalidState)?.steam_id64();

        let code_type = determine_required_code_type(&response.allowed_confirmations).ok_or(SessionError::InvalidState)?;

        self.handler.submit_steam_guard_code(response.client_id, steam_id, code, code_type).await?;

        Ok(())
    }

    pub async fn poll(&mut self) -> Result<Option<PollResult>, SessionError> {
        if self.polling_canceled {
            return Err(SessionError::Canceled);
        }

        let response = self.start_session_response.as_mut().ok_or(SessionError::NotStarted)?;

        if let Some(started) = self.polling_started_time {
            if Instant::now().duration_since(started) >= self.login_timeout {
                self.polling_canceled = true;
                return Err(SessionError::Timeout);
            }
        } else {
            self.polling_started_time = Some(Instant::now());
        }

        let poll_response = match self.handler.poll_login_status(response.client_id, &response.request_id).await {
            Ok(res) => res,
            Err(SessionError::HttpError(e)) if e.is_request() || e.is_connect() => {
                tracing::warn!("Transient HTTP error during polling: {:?}. Retrying later.", e);
                return Ok(None);
            }
            Err(e) => return Err(e),
        };

        if let Some(new_id) = poll_response.new_client_id {
            response.client_id = new_id;
        }

        if poll_response.had_remote_interaction && !self.had_remote_interaction {
            self.had_remote_interaction = true;
        }

        if let Some(ref token) = poll_response.new_steam_guard_machine_auth {
            self.steam_guard_machine_token = Some(token.clone());
        }

        if let Some(ref refresh_token) = poll_response.refresh_token {
            self.account_name = poll_response.account_name.clone();
            self.set_refresh_token(refresh_token)?;

            if let Some(ref access_token) = poll_response.access_token {
                self.set_access_token(access_token)?;
            }

            return Ok(Some(PollResult {
                account_name: poll_response.account_name.unwrap_or_default(),
                refresh_token: refresh_token.clone(),
                access_token: poll_response.access_token,
                new_guard_data: poll_response.new_steam_guard_machine_auth,
            }));
        }

        Ok(None)
    }

    pub fn poll_interval(&self) -> f32 {
        self.start_session_response.as_ref().map(|r| r.poll_interval).unwrap_or(5.0)
    }

    pub fn cancel_login_attempt(&mut self) -> bool {
        self.polling_canceled = true;
        self.polling_started_time.is_some()
    }

    pub async fn refresh_access_token(&mut self) -> Result<(), SessionError> {
        let refresh_token = self.refresh_token.as_ref().ok_or(SessionError::TokenError("No refresh token set".into()))?;

        let steam_id = self.steam_id.as_ref().ok_or(SessionError::InvalidState)?.steam_id64();

        let (access_token, _) = self.handler.generate_access_token(refresh_token, steam_id, false).await?;

        self.access_token = Some(access_token);
        Ok(())
    }

    pub async fn renew_refresh_token(&mut self) -> Result<bool, SessionError> {
        let refresh_token = self.refresh_token.as_ref().ok_or(SessionError::TokenError("No refresh token set".into()))?;

        let steam_id = self.steam_id.as_ref().ok_or(SessionError::InvalidState)?.steam_id64();

        let (access_token, new_refresh_token) = self.handler.generate_access_token(refresh_token, steam_id, true).await?;

        self.access_token = Some(access_token);

        if let Some(new_token) = new_refresh_token {
            self.refresh_token = Some(new_token);
            Ok(true)
        } else {
            Ok(false)
        }
    }

    pub async fn get_web_cookies(&mut self) -> Result<Vec<String>, SessionError> {
        let refresh_token = self.refresh_token.as_ref().ok_or(SessionError::TokenError("No refresh token available".into()))?.clone();

        let steam_id = self.steam_id.as_ref().ok_or(SessionError::InvalidState)?.steam_id64();

        let random_bytes: [u8; 24] = rand::random();
        let session_id = generate_session_id(&random_bytes);

        if matches!(self.platform_type, EAuthTokenPlatformType::KEAuthTokenPlatformTypeSteamClient | EAuthTokenPlatformType::KEAuthTokenPlatformTypeMobileApp) {
            if self.access_token.is_none() {
                self.refresh_access_token().await?;
            }

            let access_token = self.access_token.as_ref().ok_or(SessionError::TokenError("No access token available".into()))?;

            return Ok(build_simple_cookies(steam_id, access_token, &session_id));
        }

        let mut headers = std::collections::HashMap::new();
        headers.insert("Origin".to_string(), "https://steamcommunity.com".to_string());
        headers.insert("Referer".to_string(), "https://steamcommunity.com/".to_string());
        headers.insert("Accept".to_string(), "application/json, text/plain, */*".to_string());

        let form = MultipartForm::new().text("nonce", refresh_token).text("sessionid", session_id.clone()).text("redir", "https://steamcommunity.com/login/home/?goto=");

        let finalize_response = self.http_client.post_multipart("https://login.steampowered.com/jwt/finalizelogin", form, headers).await?;

        let finalize_json: serde_json::Value = finalize_response.json()?;
        check_finalize_error(&finalize_json)?;
        let transfers = parse_transfer_info(&finalize_json)?;

        let mut cookies = execute_transfers_with_retry(&self.http_client, &transfers, steam_id, 5, Duration::from_millis(500)).await?;

        filter_session_id_cookies(&mut cookies);
        let domains = extract_cookie_domains(&cookies);
        add_session_id_cookies(&mut cookies, &session_id, &domains);

        Ok(cookies)
    }

    pub async fn force_poll(&mut self) -> Result<Option<PollResult>, SessionError> {
        if self.polling_started_time.is_none() {
            return Err(SessionError::NotStarted);
        }
        self.poll().await
    }

    pub fn had_remote_interaction(&self) -> bool {
        self.had_remote_interaction
    }

    async fn process_start_session_response(&mut self) -> Result<StartSessionResponse, SessionError> {
        let (allowed_confirmations, challenge_url) = {
            let response = self.start_session_response.as_ref().ok_or(SessionError::NotStarted)?;
            (response.allowed_confirmations.clone(), response.challenge_url.clone())
        };

        let has_presupplied_code = self.steam_guard_code.is_some();
        let result = process_confirmations(&allowed_confirmations, challenge_url, has_presupplied_code);

        if result.should_submit_presupplied_code {
            if let Some(ref code) = self.steam_guard_code.clone() {
                if self.submit_steam_guard_code(code).await.is_ok() {
                    return Ok(StartSessionResponse { action_required: false, valid_actions: None, qr_challenge_url: None });
                }
            }
        }

        if !result.requires_action && !result.should_submit_presupplied_code {
            return Ok(StartSessionResponse { action_required: false, valid_actions: None, qr_challenge_url: None });
        }

        if result.requires_action && result.valid_actions.is_none() {
            return Err(SessionError::InvalidState);
        }

        Ok(StartSessionResponse {
            action_required: result.requires_action,
            valid_actions: result.valid_actions,
            qr_challenge_url: result.qr_challenge_url,
        })
    }
}

impl Default for LoginSession {
    fn default() -> Self {
        Self::new(EAuthTokenPlatformType::KEAuthTokenPlatformTypeWebBrowser, None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(serde::Serialize)]
    struct JwtHeader {
        alg: String,
        typ: String,
    }

    #[derive(serde::Serialize)]
    struct JwtPayload<'a> {
        sub: &'a str,
        aud: &'a [&'a str],
        exp: u64,
    }

    fn make_test_jwt(sub: &str, audiences: &[&str]) -> String {
        use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};

        let header = JwtHeader { alg: "HS256".to_string(), typ: "JWT".to_string() };
        let payload = JwtPayload { sub, aud: audiences, exp: 9999999999 };

        let header_json = serde_json::to_string(&header).unwrap();
        let payload_json = serde_json::to_string(&payload).unwrap();

        let encoded_header = URL_SAFE_NO_PAD.encode(header_json);
        let encoded_payload = URL_SAFE_NO_PAD.encode(payload_json);
        format!("{}.{}.signature", encoded_header, encoded_payload)
    }

    #[test]
    fn test_set_login_timeout_success() {
        let mut session = LoginSession::new(EAuthTokenPlatformType::KEAuthTokenPlatformTypeWebBrowser, None);
        let result = session.set_login_timeout(Duration::from_secs(120));
        assert!(result.is_ok());
    }

    #[test]
    fn test_set_login_timeout_fails_after_polling_started() {
        let mut session = LoginSession::new(EAuthTokenPlatformType::KEAuthTokenPlatformTypeWebBrowser, None);
        session.polling_started_time = Some(Instant::now());
        let result = session.set_login_timeout(Duration::from_secs(120));
        assert!(matches!(result, Err(SessionError::InvalidState)));
    }

    #[test]
    fn test_set_refresh_token_valid() {
        let mut session = LoginSession::new(EAuthTokenPlatformType::KEAuthTokenPlatformTypeWebBrowser, None);
        let token = make_test_jwt("76561198000000000", &["derive", "web"]);
        let result = session.set_refresh_token(&token);
        assert!(result.is_ok());
        assert!(session.steam_id().is_some());
        assert_eq!(session.steam_id().unwrap().steam_id64(), 76561198000000000);
    }

    #[test]
    fn test_set_refresh_token_invalid() {
        let mut session = LoginSession::new(EAuthTokenPlatformType::KEAuthTokenPlatformTypeWebBrowser, None);
        let result = session.set_refresh_token("invalid_token");
        assert!(result.is_err());
    }

    #[test]
    fn test_set_access_token_valid() {
        let mut session = LoginSession::new(EAuthTokenPlatformType::KEAuthTokenPlatformTypeWebBrowser, None);
        let refresh = make_test_jwt("76561198000000000", &["derive", "web"]);
        session.set_refresh_token(&refresh).unwrap();
        let access = make_test_jwt("76561198000000000", &["web", "mobile"]);
        let result = session.set_access_token(&access);
        assert!(result.is_ok());
    }

    #[test]
    fn test_set_access_token_steam_id_mismatch() {
        let mut session = LoginSession::new(EAuthTokenPlatformType::KEAuthTokenPlatformTypeWebBrowser, None);
        let refresh = make_test_jwt("76561198000000000", &["derive", "web"]);
        session.set_refresh_token(&refresh).unwrap();
        let access = make_test_jwt("76561198111111111", &["web"]);
        let result = session.set_access_token(&access);
        assert!(result.is_err());
    }

    #[test]
    fn test_getters_initially_none() {
        let session = LoginSession::new(EAuthTokenPlatformType::KEAuthTokenPlatformTypeWebBrowser, None);
        assert!(session.steam_id().is_none());
        assert!(session.account_name().is_none());
        assert!(session.access_token().is_none());
        assert!(session.refresh_token().is_none());
        assert!(session.steam_guard_machine_token().is_none());
    }

    #[test]
    fn test_cancel_login_before_polling() {
        let mut session = LoginSession::new(EAuthTokenPlatformType::KEAuthTokenPlatformTypeWebBrowser, None);
        let was_polling = session.cancel_login_attempt();
        assert!(!was_polling);
    }

    #[test]
    fn test_cancel_login_during_polling() {
        let mut session = LoginSession::new(EAuthTokenPlatformType::KEAuthTokenPlatformTypeWebBrowser, None);
        session.polling_started_time = Some(Instant::now());
        let was_polling = session.cancel_login_attempt();
        assert!(was_polling);
    }

    #[test]
    fn test_had_remote_interaction_initially_false() {
        let session = LoginSession::new(EAuthTokenPlatformType::KEAuthTokenPlatformTypeWebBrowser, None);
        assert!(!session.had_remote_interaction());
    }

    #[test]
    fn test_builder_creates_session() {
        let session = LoginSession::builder(EAuthTokenPlatformType::KEAuthTokenPlatformTypeMobileApp).build();
        assert!(session.steam_id().is_none());
    }

    #[tokio::test]
    async fn test_poll_not_started() {
        let mut session = LoginSession::new(EAuthTokenPlatformType::KEAuthTokenPlatformTypeWebBrowser, None);
        let result = session.poll().await;
        assert!(matches!(result, Err(SessionError::NotStarted)));
    }

    #[tokio::test]
    async fn test_poll_canceled() {
        let mut session = LoginSession::new(EAuthTokenPlatformType::KEAuthTokenPlatformTypeWebBrowser, None);
        session.polling_canceled = true;
        let result = session.poll().await;
        assert!(matches!(result, Err(SessionError::Canceled)));
    }

    #[test]
    fn test_default_creates_web_browser_session() {
        let session = LoginSession::default();
        assert!(session.steam_id().is_none());
    }
}
