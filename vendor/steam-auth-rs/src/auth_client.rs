//! Authentication client for Steam's auth API.

use std::collections::HashMap;

use prost::Message;
use steam_protos::{
    CAuthenticationAccessTokenGenerateForAppRequest, CAuthenticationAccessTokenGenerateForAppResponse, CAuthenticationBeginAuthSessionViaCredentialsRequest, CAuthenticationBeginAuthSessionViaCredentialsResponse, CAuthenticationBeginAuthSessionViaQRRequest, CAuthenticationBeginAuthSessionViaQRResponse, CAuthenticationDeviceDetails, CAuthenticationGetAuthSessionInfoRequest, CAuthenticationGetAuthSessionInfoResponse, CAuthenticationGetPasswordRSAPublicKeyRequest, CAuthenticationGetPasswordRSAPublicKeyResponse, CAuthenticationPollAuthSessionStatusRequest,
    CAuthenticationPollAuthSessionStatusResponse, CAuthenticationUpdateAuthSessionWithMobileConfirmationRequest, CAuthenticationUpdateAuthSessionWithSteamGuardCodeRequest, EAuthSessionGuardType, EAuthTokenPlatformType, ESessionPersistence, ETokenRenewalType,
};

use crate::{
    crypto::rsa_encrypt_password,
    error::SessionError,
    helpers::{default_user_agent, get_spoofed_hostname},
    transport::{ApiRequest, Transport},
    types::{AllowedConfirmation, DeviceDetails, PlatformData, StartAuthSessionResponse},
};

/// Result of RSA key fetch.
#[derive(Debug, Clone)]
pub struct RsaKeyResponse {
    pub public_key_mod: String,
    pub public_key_exp: String,
    pub timestamp: u64,
}

/// Result of password encryption.
#[derive(Debug, Clone)]
pub struct EncryptedPassword {
    pub encrypted_password: String,
    pub key_timestamp: u64,
}

/// Poll response from auth status.
#[derive(Debug, Clone)]
pub struct PollLoginStatusResponse {
    pub new_client_id: Option<u64>,
    pub new_challenge_url: Option<String>,
    pub refresh_token: Option<String>,
    pub access_token: Option<String>,
    pub had_remote_interaction: bool,
    pub account_name: Option<String>,
    pub new_steam_guard_machine_auth: Option<String>,
}

/// Authentication client for communicating with Steam's auth service.
pub struct AuthenticationClient {
    transport: Transport,
    platform_type: EAuthTokenPlatformType,
    web_user_agent: String,
    machine_id: Option<Vec<u8>>,
    client_friendly_name: Option<String>,
}

impl AuthenticationClient {
    /// Create a new authentication client.
    pub fn new(transport: Transport, platform_type: EAuthTokenPlatformType, machine_id: Option<Vec<u8>>, client_friendly_name: Option<String>) -> Self {
        Self { transport, platform_type, web_user_agent: default_user_agent(), machine_id, client_friendly_name }
    }

    /// Get RSA public key for password encryption.
    pub async fn get_rsa_key(&self, account_name: &str) -> Result<RsaKeyResponse, SessionError> {
        let request = CAuthenticationGetPasswordRSAPublicKeyRequest { account_name: Some(account_name.to_string()) };

        let response: CAuthenticationGetPasswordRSAPublicKeyResponse = self.send_request("Authentication", "GetPasswordRSAPublicKey", 1, &request, None).await?;

        Ok(RsaKeyResponse {
            public_key_mod: response.publickey_mod.unwrap_or_default(),
            public_key_exp: response.publickey_exp.unwrap_or_default(),
            timestamp: response.timestamp.unwrap_or(0),
        })
    }

    /// Encrypt a password using RSA.
    ///
    /// This method fetches Steam's RSA public key and uses it to encrypt the
    /// password. The actual encryption is performed by the pure function
    /// [`rsa_encrypt_password`].
    pub async fn encrypt_password(&self, account_name: &str, password: &str) -> Result<EncryptedPassword, SessionError> {
        let rsa_info = self.get_rsa_key(account_name).await?;

        // Use the pure encryption function from crypto module
        let encrypted_password = rsa_encrypt_password(password, &rsa_info.public_key_mod, &rsa_info.public_key_exp)?;

        Ok(EncryptedPassword { encrypted_password, key_timestamp: rsa_info.timestamp })
    }

    /// Start an auth session with credentials.
    pub async fn start_session_with_credentials(&self, account_name: &str, encrypted_password: &str, key_timestamp: u64, persistence: ESessionPersistence, steam_guard_machine_token: Option<&str>) -> Result<StartAuthSessionResponse, SessionError> {
        let platform_data = self.get_platform_data();

        let device_details = CAuthenticationDeviceDetails {
            device_friendly_name: Some(platform_data.device_details.device_friendly_name.clone()),
            platform_type: Some(self.platform_type as i32),
            os_type: platform_data.device_details.os_type,
            gaming_device_type: platform_data.device_details.gaming_device_type,
            client_count: None,
            machine_id: platform_data.device_details.machine_id.clone(),
            app_type: None,
        };

        let mut request = CAuthenticationBeginAuthSessionViaCredentialsRequest {
            account_name: Some(account_name.to_string()),
            encrypted_password: Some(encrypted_password.to_string()),
            encryption_timestamp: Some(key_timestamp),
            remember_login: Some(persistence == ESessionPersistence::KESessionPersistencePersistent),
            persistence: Some(persistence as i32),
            website_id: Some(platform_data.website_id.clone()),
            device_details: Some(device_details),
            device_friendly_name: None,
            platform_type: Some(self.platform_type as i32),
            guard_data: None,
            language: None,
            qos_level: Some(2),
        };

        // Add machine token if provided
        if let Some(token) = steam_guard_machine_token {
            request.guard_data = Some(token.to_string());
        }

        let response: CAuthenticationBeginAuthSessionViaCredentialsResponse = self.send_request("Authentication", "BeginAuthSessionViaCredentials", 1, &request, None).await?;

        Ok(StartAuthSessionResponse {
            client_id: response.client_id.unwrap_or(0),
            request_id: response.request_id.unwrap_or_default(),
            poll_interval: response.interval.unwrap_or(5.0),
            allowed_confirmations: response
                .allowed_confirmations
                .into_iter()
                .map(|c| AllowedConfirmation {
                    confirmation_type: EAuthSessionGuardType::try_from(c.confirmation_type.unwrap_or(0)).unwrap_or(EAuthSessionGuardType::KEAuthSessionGuardTypeUnknown),
                    message: c.associated_message,
                })
                .collect(),
            steam_id: response.steamid,
            weak_token: response.weak_token,
            challenge_url: None,
            version: None,
        })
    }

    /// Start a QR code auth session.
    pub async fn start_session_with_qr(&self) -> Result<StartAuthSessionResponse, SessionError> {
        let platform_data = self.get_platform_data();

        let device_details = CAuthenticationDeviceDetails {
            device_friendly_name: Some(platform_data.device_details.device_friendly_name.clone()),
            platform_type: Some(self.platform_type as i32),
            os_type: platform_data.device_details.os_type,
            gaming_device_type: platform_data.device_details.gaming_device_type,
            client_count: None,
            machine_id: platform_data.device_details.machine_id.clone(),
            app_type: None,
        };

        let request = CAuthenticationBeginAuthSessionViaQRRequest {
            device_friendly_name: Some(platform_data.device_details.device_friendly_name.clone()),
            platform_type: Some(self.platform_type as i32),
            device_details: Some(device_details),
            website_id: Some("Unknown".to_string()),
        };

        let response: CAuthenticationBeginAuthSessionViaQRResponse = self.send_request("Authentication", "BeginAuthSessionViaQR", 1, &request, None).await?;

        Ok(StartAuthSessionResponse {
            client_id: response.client_id.unwrap_or(0),
            request_id: response.request_id.unwrap_or_default(),
            poll_interval: response.interval.unwrap_or(5.0),
            allowed_confirmations: response
                .allowed_confirmations
                .into_iter()
                .map(|c| AllowedConfirmation {
                    confirmation_type: EAuthSessionGuardType::try_from(c.confirmation_type.unwrap_or(0)).unwrap_or(EAuthSessionGuardType::KEAuthSessionGuardTypeUnknown),
                    message: c.associated_message,
                })
                .collect(),
            steam_id: None,
            weak_token: None,
            challenge_url: response.challenge_url,
            version: response.version,
        })
    }

    /// Submit a Steam Guard code.
    pub async fn submit_steam_guard_code(&self, client_id: u64, steam_id: u64, code: &str, code_type: EAuthSessionGuardType) -> Result<(), SessionError> {
        let request = CAuthenticationUpdateAuthSessionWithSteamGuardCodeRequest {
            client_id: Some(client_id),
            steamid: Some(steam_id),
            code: Some(code.to_string()),
            code_type: Some(code_type as i32),
        };

        let _: () = self.send_request_no_response("Authentication", "UpdateAuthSessionWithSteamGuardCode", 1, &request, None).await?;

        Ok(())
    }

    /// Poll the auth session status.
    pub async fn poll_login_status(&self, client_id: u64, request_id: &[u8]) -> Result<PollLoginStatusResponse, SessionError> {
        let request = CAuthenticationPollAuthSessionStatusRequest { client_id: Some(client_id), request_id: Some(request_id.to_vec()), token_to_revoke: None };

        let response: CAuthenticationPollAuthSessionStatusResponse = self.send_request("Authentication", "PollAuthSessionStatus", 1, &request, None).await?;

        Ok(PollLoginStatusResponse {
            new_client_id: response.new_client_id,
            new_challenge_url: response.new_challenge_url,
            refresh_token: response.refresh_token,
            access_token: response.access_token,
            had_remote_interaction: response.had_remote_interaction.unwrap_or(false),
            account_name: response.account_name,
            new_steam_guard_machine_auth: response.new_guard_data,
        })
    }

    /// Generate an access token from a refresh token.
    pub async fn generate_access_token(&self, refresh_token: &str, steam_id: u64, renew: bool) -> Result<(String, Option<String>), SessionError> {
        let request = CAuthenticationAccessTokenGenerateForAppRequest {
            refresh_token: Some(refresh_token.to_string()),
            steamid: Some(steam_id),
            renewal_type: Some(if renew { ETokenRenewalType::KETokenRenewalTypeAllow as i32 } else { ETokenRenewalType::KETokenRenewalTypeNone as i32 }),
        };

        let response: CAuthenticationAccessTokenGenerateForAppResponse = self.send_request("Authentication", "GenerateAccessTokenForApp", 1, &request, None).await?;

        Ok((response.access_token.unwrap_or_default(), response.refresh_token))
    }

    /// Get information about an auth session (for QR approval).
    pub async fn get_auth_session_info(&self, access_token: &str, client_id: u64) -> Result<CAuthenticationGetAuthSessionInfoResponse, SessionError> {
        let request = CAuthenticationGetAuthSessionInfoRequest { client_id: Some(client_id) };

        self.send_request("Authentication", "GetAuthSessionInfo", 1, &request, Some(access_token)).await
    }

    /// Submit mobile confirmation to approve/deny a login.
    #[allow(clippy::too_many_arguments)]
    pub async fn submit_mobile_confirmation(&self, access_token: &str, version: i32, client_id: u64, steam_id: u64, signature: &[u8], confirm: bool, persistence: ESessionPersistence) -> Result<(), SessionError> {
        let request = CAuthenticationUpdateAuthSessionWithMobileConfirmationRequest {
            version: Some(version),
            client_id: Some(client_id),
            steamid: Some(steam_id),
            signature: Some(signature.to_vec()),
            confirm: Some(confirm),
            persistence: Some(persistence as i32),
        };

        self.send_request_no_response("Authentication", "UpdateAuthSessionWithMobileConfirmation", 1, &request, Some(access_token)).await
    }

    /// Send a protobuf request and decode the response.
    async fn send_request<Req: Message, Resp: Message + Default>(&self, interface: &str, method: &str, version: u32, request: &Req, access_token: Option<&str>) -> Result<Resp, SessionError> {
        let platform_data = self.get_platform_data();
        let request_data = request.encode_to_vec();

        let api_request = ApiRequest {
            api_interface: interface.to_string(),
            api_method: method.to_string(),
            api_version: version,
            access_token: access_token.map(String::from),
            request_data: Some(request_data),
            headers: platform_data.headers,
        };

        let response = self.transport.send_request(api_request).await?;

        // Check for errors
        if let Some(result) = response.result {
            if result != 1 {
                // EResult::OK = 1
                return Err(SessionError::from_eresult(result, response.error_message));
            }
        }

        // Decode response
        let response_data = response.response_data.unwrap_or_default();
        Ok(Resp::decode(response_data.as_slice())?)
    }

    /// Send a protobuf request with no response body.
    async fn send_request_no_response<Req: Message>(&self, interface: &str, method: &str, version: u32, request: &Req, access_token: Option<&str>) -> Result<(), SessionError> {
        let platform_data = self.get_platform_data();
        let request_data = request.encode_to_vec();

        let api_request = ApiRequest {
            api_interface: interface.to_string(),
            api_method: method.to_string(),
            api_version: version,
            access_token: access_token.map(String::from),
            request_data: Some(request_data),
            headers: platform_data.headers,
        };

        let response = self.transport.send_request(api_request).await?;

        // Check for errors
        if let Some(result) = response.result {
            if result != 1 {
                return Err(SessionError::from_eresult(result, response.error_message));
            }
        }

        Ok(())
    }

    /// Get platform-specific data for requests.
    fn get_platform_data(&self) -> PlatformData {
        match self.platform_type {
            EAuthTokenPlatformType::KEAuthTokenPlatformTypeSteamClient => {
                let machine_name = self.client_friendly_name.clone().unwrap_or_else(get_spoofed_hostname);

                PlatformData {
                    website_id: "Unknown".to_string(),
                    headers: HashMap::from([("user-agent".to_string(), "Mozilla/5.0 (Windows; U; Windows NT 10.0; en-US; Valve Steam Client/default/1665786434; ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36".to_string()), ("origin".to_string(), "https://steamloopback.host".to_string())]),
                    device_details: DeviceDetails {
                        device_friendly_name: machine_name,
                        platform_type: EAuthTokenPlatformType::KEAuthTokenPlatformTypeSteamClient,
                        os_type: Some(20), // EOSType::Win11
                        gaming_device_type: Some(1),
                        machine_id: self.machine_id.clone(),
                    },
                }
            }
            EAuthTokenPlatformType::KEAuthTokenPlatformTypeWebBrowser => PlatformData {
                website_id: "Community".to_string(),
                headers: HashMap::from([("user-agent".to_string(), self.web_user_agent.clone()), ("origin".to_string(), "https://steamcommunity.com".to_string()), ("referer".to_string(), "https://steamcommunity.com".to_string())]),
                device_details: DeviceDetails {
                    device_friendly_name: self.web_user_agent.clone(),
                    platform_type: EAuthTokenPlatformType::KEAuthTokenPlatformTypeWebBrowser,
                    os_type: None,
                    gaming_device_type: None,
                    machine_id: None,
                },
            },
            EAuthTokenPlatformType::KEAuthTokenPlatformTypeMobileApp => PlatformData {
                website_id: "Mobile".to_string(),
                headers: HashMap::from([("user-agent".to_string(), "okhttp/4.9.2".to_string()), ("cookie".to_string(), "mobileClient=android; mobileClientVersion=777777 3.10.3".to_string())]),
                device_details: DeviceDetails {
                    device_friendly_name: "Galaxy S25".to_string(),
                    platform_type: EAuthTokenPlatformType::KEAuthTokenPlatformTypeMobileApp,
                    os_type: Some(-500), // EOSType::AndroidUnknown
                    gaming_device_type: Some(528),
                    machine_id: None,
                },
            },
            _ => PlatformData {
                website_id: "Community".to_string(),
                headers: HashMap::new(),
                device_details: DeviceDetails {
                    device_friendly_name: "Unknown".to_string(),
                    platform_type: EAuthTokenPlatformType::KEAuthTokenPlatformTypeUnknown,
                    os_type: None,
                    gaming_device_type: None,
                    machine_id: None,
                },
            },
        }
    }
}
