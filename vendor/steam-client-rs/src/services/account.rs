//! Account management.
//!
//! This module provides functionality to manage Steam account settings
//! including email validation, Steam Guard details, and privacy settings.

use crate::{error::SteamError, SteamClient};

/// Steam Guard authentication details.
#[derive(Debug, Clone)]
pub struct SteamGuardDetails {
    /// Whether Steam Guard is enabled.
    pub is_steamguard_enabled: bool,
    /// Whether email authentication is enabled.
    pub is_email_auth_enabled: bool,
    /// Whether mobile authenticator is enabled.
    pub is_mobile_auth_enabled: bool,
    /// The timestamp when Steam Guard was enabled.
    pub timestamp_steamguard_enabled: Option<u64>,
    /// The timestamp when two-factor was enabled.
    pub timestamp_two_factor_enabled: Option<u64>,
    /// Session data (machine tokens, etc).
    pub machine_sessions: Vec<MachineSession>,
}

/// A machine session for Steam Guard.
#[derive(Debug, Clone)]
pub struct MachineSession {
    /// Machine name.
    pub machine_name: String,
    /// Timestamp of first login.
    pub first_login: u64,
    /// Timestamp of last login.
    pub last_login: u64,
    /// IP address of last login.
    pub last_ip: Option<String>,
}

/// Account privacy settings.
#[derive(Debug, Clone)]
pub struct PrivacySettings {
    /// Profile privacy state (1=private, 2=friends only, 3=public).
    pub privacy_state: u32,
    /// Inventory privacy state.
    pub privacy_state_inventory: u32,
    /// Gifts privacy state.
    pub privacy_state_gifts: u32,
    /// Owned games privacy state.
    pub privacy_state_owned_games: u32,
    /// Playtime privacy state.
    pub privacy_state_playtime: u32,
    /// Friends list privacy state.
    pub privacy_state_friends_list: u32,
}

/// Account limitations information.
#[derive(Debug, Clone)]
pub struct AccountLimitations {
    /// Whether this is a limited account.
    pub is_limited: bool,
    /// Whether the account is community banned.
    pub is_community_banned: bool,
    /// Whether the account is locked.
    pub is_locked: bool,
    /// Whether limited accounts can invite friends.
    pub can_invite_friends: bool,
}

/// Email information for the account.
#[derive(Debug, Clone)]
pub struct EmailInfo {
    /// Email address.
    pub address: String,
    /// Whether the email is validated.
    pub validated: bool,
}

/// VAC ban status.
#[derive(Debug, Clone)]
pub struct VacBans {
    /// Number of VAC bans.
    pub num_bans: u32,
    /// App IDs with bans.
    pub app_ids: Vec<u32>,
}

/// Wallet information.
#[derive(Debug, Clone)]
pub struct WalletInfo {
    /// Whether the account has a wallet.
    pub has_wallet: bool,
    /// Wallet balance in cents.
    pub balance: i32,
    /// Currency code.
    pub currency: i32,
}

impl SteamClient {
    /// Request a validation email be sent to the account's email address.
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// client.request_validation_email().await?;
    /// tracing::info!("Validation email sent!");
    /// ```
    pub async fn request_validation_email(&mut self) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let request = steam_protos::CMsgClientRequestValidationEmail {};
        self.send_message(steam_enums::EMsg::ClientRequestValidationMail, &request).await
    }

    /// Get Steam Guard status and details.
    ///
    /// # Returns
    ///
    /// Returns Steam Guard status including whether mobile authenticator is
    /// enabled.
    ///
    /// # Note
    ///
    /// This requires the unified message infrastructure.
    pub async fn get_steam_guard_details(&mut self) -> Result<SteamGuardDetails, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let request = steam_protos::CCredentialsGetSteamGuardDetailsRequest::default();
        self.send_service_method("Credentials.GetSteamGuardDetails#1", &request).await?;

        // TODO: Response handling requires async event correlation.
        // For now, return default values as placeholder.
        Ok(SteamGuardDetails {
            is_steamguard_enabled: false,
            is_email_auth_enabled: false,
            is_mobile_auth_enabled: false,
            timestamp_steamguard_enabled: None,
            timestamp_two_factor_enabled: None,
            machine_sessions: Vec::new(),
        })
    }

    /// Get the account's profile privacy settings.
    ///
    /// # Returns
    ///
    /// Returns the privacy settings for various profile sections.
    ///
    /// # Note
    ///
    ///
    /// The request is sent via unified messages and awaited asynchronously.
    pub async fn get_privacy_settings(&mut self) -> Result<PrivacySettings, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        // Send request and wait for response
        let request = steam_protos::CPlayerGetPrivacySettingsRequest {};
        let response: steam_protos::CPlayerGetPrivacySettingsResponse = self.send_unified_request_and_wait("Player.GetPrivacySettings#1", &request).await?;

        if let Some(settings) = response.privacy_settings {
            Ok(PrivacySettings {
                privacy_state: settings.privacy_state.unwrap_or(0) as u32,
                privacy_state_inventory: settings.privacy_state_inventory.unwrap_or(0) as u32,
                privacy_state_gifts: settings.privacy_state_gifts.unwrap_or(0) as u32,
                privacy_state_owned_games: settings.privacy_state_ownedgames.unwrap_or(0) as u32,
                privacy_state_playtime: settings.privacy_state_playtime.unwrap_or(0) as u32,
                privacy_state_friends_list: settings.privacy_state_friendslist.unwrap_or(0) as u32,
            })
        } else {
            Err(SteamError::Other("No privacy settings returned".into()))
        }
    }

    /// Get account limitations.
    ///
    /// # Returns
    ///
    /// Returns account limitations like community ban status, etc.
    pub fn get_account_limitations(&self) -> Result<AccountLimitations, SteamError> {
        if let Some(limitations) = self.account.read().limitations.clone() {
            Ok(AccountLimitations {
                is_limited: limitations.limited,
                is_community_banned: limitations.community_banned,
                is_locked: limitations.locked,
                can_invite_friends: limitations.can_invite_friends,
            })
        } else {
            Err(SteamError::Other("Account limitations not available yet".into()))
        }
    }

    /// Get VAC ban status.
    ///
    /// # Returns
    ///
    /// Returns VAC ban status.
    pub fn get_vac_bans(&self) -> Result<VacBans, SteamError> {
        if let Some(vac) = self.account.read().vac.clone() {
            Ok(VacBans { num_bans: vac.num_bans, app_ids: vac.appids.clone() })
        } else {
            Err(SteamError::Other("VAC status not available yet".into()))
        }
    }

    /// Get credential change times (password, email changes).
    ///
    /// # Returns
    ///
    /// Returns timestamps for when credentials were last changed.
    ///
    /// # Note
    ///
    /// This requires the unified message infrastructure.
    pub async fn get_credential_change_times(&mut self) -> Result<CredentialChangeTimes, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let request = steam_protos::CCredentialsLastCredentialChangeTimeRequest { user_changes_only: Some(true) };
        let response: steam_protos::CCredentialsLastCredentialChangeTimeResponse = self.send_unified_request_and_wait("Credentials.GetCredentialChangeTimeDetails#1", &request).await?;

        Ok(CredentialChangeTimes {
            password_last_changed: response.timestamp_last_password_change.map(|t| t as u64),
            email_last_changed: response.timestamp_last_email_change.map(|t| t as u64),
        })
    }

    /// Get account authentication secret.
    ///
    /// # Returns
    ///
    /// Returns the secret ID and secret key.
    pub async fn get_auth_secret(&mut self) -> Result<(i32, Vec<u8>), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let request = steam_protos::CCredentialsGetAccountAuthSecretRequest::default();
        let response: steam_protos::CCredentialsGetAccountAuthSecretResponse = self.send_unified_request_and_wait("Credentials.GetAccountAuthSecret#1", &request).await?;

        Ok((response.secret_id.unwrap_or(0), response.secret.unwrap_or_default()))
    }
}

/// Credential change timestamps.
#[derive(Debug, Clone)]
pub struct CredentialChangeTimes {
    /// Timestamp of last password change.
    pub password_last_changed: Option<u64>,
    /// Timestamp of last email change.
    pub email_last_changed: Option<u64>,
}

/// Account info received from Steam.
#[derive(Debug, Clone)]
pub struct AccountInfo {
    /// Persona name.
    pub name: String,
    /// IP country code.
    pub country: String,
    /// Number of authorized computers.
    pub authed_machines: i32,
    /// Account flags.
    pub flags: u32,
    /// Facebook ID if linked.
    pub facebook_id: Option<u64>,
    /// Facebook name if linked.
    pub facebook_name: Option<String>,
    /// Whether phone is verified.
    pub phone_verified: bool,
    /// Two-factor state.
    pub two_factor_state: u32,
}

impl From<&steam_protos::CMsgClientAccountInfo> for AccountInfo {
    fn from(msg: &steam_protos::CMsgClientAccountInfo) -> Self {
        Self {
            name: msg.persona_name.clone().unwrap_or_default(),
            country: msg.ip_country.clone().unwrap_or_default(),
            authed_machines: msg.count_authed_computers.unwrap_or(0),
            flags: msg.account_flags.unwrap_or(0),
            facebook_id: msg.facebook_id,
            facebook_name: msg.facebook_name.clone(),
            phone_verified: msg.is_phone_verified.unwrap_or(false),
            two_factor_state: msg.two_factor_state.unwrap_or(0),
        }
    }
}
