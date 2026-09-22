//! Apps and games information.
//!
//! This module provides functionality for interacting with Steam apps:
//! - Requesting product info (PICS)
//! - Setting games as playing
//! - Getting player counts
//! - Managing access tokens

use steam_enums::{EAppType, ELicenseFlags};

use crate::{error::SteamError, SteamClient};

/// Special game ID used for non-Steam games in the games_played list.
/// This value signals to Steam that the game_extra_info field contains
/// a custom game name rather than an app ID.
const NON_STEAM_GAME_ID: u64 = 15190414816125648896;

/// App/game information.
#[derive(Debug, Clone)]
pub struct AppInfo {
    /// App ID.
    pub app_id: u32,
    /// App name.
    pub name: String,
    /// App type.
    pub app_type: EAppType,
    /// Developer.
    pub developer: Option<String>,
    /// Publisher.
    pub publisher: Option<String>,
    /// Icon hash.
    pub icon_hash: Option<String>,
    /// Logo hash.
    pub logo_hash: Option<String>,
}

/// Package/license information.
#[derive(Debug, Clone)]
pub struct PackageInfo {
    /// Package ID.
    pub package_id: u32,
    /// Package name.
    pub name: Option<String>,
    /// App IDs included.
    pub app_ids: Vec<u32>,
}

/// Owned app license.
#[derive(Debug, Clone)]
pub struct OwnedApp {
    /// App ID.
    pub app_id: u32,
    /// Package ID.
    pub package_id: u32,
    /// Time purchased.
    pub time_created: u32,
    /// License type.
    pub license_type: u32,
    /// License flags.
    pub flags: u32,
}

/// App info request with optional access token.
#[derive(Debug, Clone, Default)]
pub struct AppInfoRequest {
    /// App ID.
    pub app_id: u32,
    /// Access token (if needed for restricted apps).
    pub access_token: Option<u64>,
}

impl From<u32> for AppInfoRequest {
    fn from(app_id: u32) -> Self {
        Self { app_id, access_token: None }
    }
}

/// Package info request with optional access token.
#[derive(Debug, Clone, Default)]
pub struct PackageInfoRequest {
    /// Package ID.
    pub package_id: u32,
    /// Access token (if needed for restricted packages).
    pub access_token: Option<u64>,
}

impl From<u32> for PackageInfoRequest {
    fn from(package_id: u32) -> Self {
        Self { package_id, access_token: None }
    }
}

impl SteamClient {
    /// Get a list of owned apps for the logged-in user.
    ///
    /// This information comes from the ClientLicenseList message received
    /// after login. The licenses property contains package info.
    pub fn get_owned_apps(&self) -> Vec<OwnedApp> {
        // This would be populated from ClientLicenseList messages
        // For now, return empty - would need message handling loop
        Vec::new()
    }

    /// Request product/app info for one or more app IDs.
    ///
    /// The response will arrive as a `ProductInfoResponse` event.
    ///
    /// # Arguments
    /// * `app_ids` - The app IDs to get info for
    pub async fn get_product_info(&mut self, app_ids: Vec<u32>) -> Result<(), SteamError> {
        let requests: Vec<AppInfoRequest> = app_ids.into_iter().map(Into::into).collect();
        self.get_product_info_with_tokens(requests, Vec::new()).await
    }

    /// Request product info for apps and packages with optional access tokens.
    ///
    /// The response will arrive as a `ProductInfoResponse` event.
    ///
    /// # Arguments
    /// * `apps` - App info requests with optional tokens
    /// * `packages` - Package info requests with optional tokens
    pub async fn get_product_info_with_tokens(&mut self, apps: Vec<AppInfoRequest>, packages: Vec<PackageInfoRequest>) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgClientPICSProductInfoRequest {
            apps: apps.iter().map(|req| steam_protos::cmsg_client_pics_product_info_request::AppInfo { appid: Some(req.app_id), access_token: req.access_token, only_public_obsolete: None }).collect(),
            packages: packages.iter().map(|req| steam_protos::cmsg_client_pics_product_info_request::PackageInfo { packageid: Some(req.package_id), access_token: req.access_token }).collect(),
            meta_data_only: Some(false),
            ..Default::default()
        };

        self.send_message(steam_enums::EMsg::ClientPICSProductInfoRequest, &msg).await
    }

    /// Request package info for one or more package IDs.
    ///
    /// The response will arrive as a `ProductInfoResponse` event.
    ///
    /// # Arguments
    /// * `package_ids` - The package IDs to get info for
    pub async fn get_package_info(&mut self, package_ids: Vec<u32>) -> Result<(), SteamError> {
        let packages: Vec<PackageInfoRequest> = package_ids.into_iter().map(Into::into).collect();
        self.get_product_info_with_tokens(Vec::new(), packages).await
    }

    /// Request access tokens for app and/or package IDs.
    ///
    /// Access tokens are needed to retrieve info for some restricted
    /// apps/packages. The response will arrive as an `AccessTokensResponse`
    /// event.
    ///
    /// # Arguments
    /// * `app_ids` - The app IDs to get tokens for
    /// * `package_ids` - The package IDs to get tokens for
    pub async fn get_access_tokens(&mut self, app_ids: Vec<u32>, package_ids: Vec<u32>) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgClientPICSAccessTokenRequest { appids: app_ids, packageids: package_ids };

        self.send_message(steam_enums::EMsg::ClientPICSAccessTokenRequest, &msg).await
    }

    /// Request access tokens for app IDs (needed for some operations).
    ///
    /// # Arguments
    /// * `app_ids` - The app IDs to get tokens for
    pub async fn get_product_access_tokens(&mut self, app_ids: Vec<u32>) -> Result<(), SteamError> {
        self.get_access_tokens(app_ids, Vec::new()).await
    }

    /// Get a list of apps/packages that have changed since a given change
    /// number.
    ///
    /// The response will arrive as a `ProductChangesResponse` event.
    /// Use change number 0 to get the current change number without any
    /// changes.
    ///
    /// # Arguments
    /// * `since_change_number` - Get changes since this change number
    pub async fn get_product_changes(&mut self, since_change_number: u32) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgClientPICSChangesSinceRequest {
            since_change_number: Some(since_change_number),
            send_app_info_changes: Some(true),
            send_package_info_changes: Some(true),
            ..Default::default()
        };

        self.send_message(steam_enums::EMsg::ClientPICSChangesSinceRequest, &msg).await
    }

    /// Get the number of players currently playing a game.
    ///
    /// Use app ID 0 to get the total number of users connected to Steam.
    ///
    /// # Arguments
    /// * `app_id` - The app ID to get player count for
    pub async fn get_player_count(&mut self, app_id: u32) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgDpGetNumberOfCurrentPlayers { appid: Some(app_id) };

        self.send_message(steam_enums::EMsg::ClientGetNumberOfCurrentPlayersDP, &msg).await
    }

    /// Kick any other session logged into this account that is playing a game.
    ///
    /// Use this if you receive a `playingBlocked` event and want to force
    /// playing on this session.
    pub async fn kick_playing_session(&mut self) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgClientKickPlayingSession::default();
        self.send_message(steam_enums::EMsg::ClientKickPlayingSession, &msg).await
    }

    /// Set the games currently being played.
    ///
    /// # Arguments
    /// * `app_ids` - Up to 32 app IDs to set as playing (empty to stop)
    pub async fn games_played(&mut self, app_ids: Vec<u32>) -> Result<(), SteamError> {
        self.games_played_with_extra(app_ids, None).await
    }

    /// Set the games currently being played with a custom game name.
    ///
    /// # Arguments
    /// * `app_ids` - Up to 32 app IDs to set as playing (empty to stop)
    /// * `custom_game` - Optional custom/non-Steam game name
    pub async fn games_played_with_extra(&mut self, app_ids: Vec<u32>, custom_game: Option<String>) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let mut msg = steam_protos::CMsgClientGamesPlayed::default();

        // Add regular games
        let mut games: Vec<steam_protos::cmsg_client_games_played::GamePlayed> = app_ids.iter().take(32).map(|&id| steam_protos::cmsg_client_games_played::GamePlayed { game_id: Some(id as u64), ..Default::default() }).collect();

        // Add custom game if specified
        if let Some(ref name) = custom_game {
            // Non-Steam game uses a special game ID
            games.push(steam_protos::cmsg_client_games_played::GamePlayed { game_id: Some(NON_STEAM_GAME_ID), game_extra_info: Some(name.clone()), ..Default::default() });
        }

        msg.games_played = games;

        // Record for session recovery
        self.session_recovery.record_playing(app_ids, custom_game);

        self.send_message(steam_enums::EMsg::ClientGamesPlayedWithDataBlob, &msg).await
    }

    /// Redeem a product code on this account.
    ///
    /// # Arguments
    /// * `key` - The product code to redeem
    pub async fn redeem_key(&mut self, key: String) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgClientRegisterKey { key: Some(key) };

        self.send_message(steam_enums::EMsg::ClientRegisterKey, &msg).await
    }

    /// Request licenses for one or more free-on-demand apps.
    ///
    /// # Arguments
    /// * `app_ids` - The app IDs to request licenses for
    pub async fn request_free_license(&mut self, app_ids: Vec<u32>) -> Result<steam_protos::CMsgClientRequestFreeLicenseResponse, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgClientRequestFreeLicense { app_ids };

        self.send_request_and_wait(steam_enums::EMsg::ClientRequestFreeLicense, &msg).await
    }

    /// Automatically requests any missing licenses from a given list ("free
    /// apps").
    ///
    /// # Arguments
    /// * `free_app_list` - List of all possibly free app IDs.
    /// * `max_limit` - Maximum number to request in one go.
    pub async fn auto_request_free_license(&mut self, free_app_list: Vec<u32>, max_limit: usize) -> Result<steam_protos::CMsgClientRequestFreeLicenseResponse, SteamError> {
        use rand::seq::SliceRandom;

        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        // Filter out apps we already own (assuming AppID == PackageID for free apps
        // check or we just check if we have a package with that ID)
        let mut needed_apps: Vec<u32> = free_app_list.into_iter().filter(|&app_id| !self.owns_package(app_id)).collect();

        // Shuffle to avoid hammering the same apps if we are rate limited or doing
        // partial batches
        let mut rng = rand::rng();
        needed_apps.shuffle(&mut rng);

        // Limit the number of apps to request
        let request_apps: Vec<u32> = needed_apps.into_iter().take(max_limit).collect();

        if request_apps.is_empty() {
            // Return empty response if nothing to request
            return Ok(steam_protos::CMsgClientRequestFreeLicenseResponse { eresult: Some(steam_enums::EResult::OK as u32), granted_packageids: vec![], granted_appids: vec![] });
        }

        self.request_free_license(request_apps).await
    }

    /// Get a legacy CD key for a game.
    ///
    /// # Arguments
    /// * `app_id` - The app ID to get the key for
    pub async fn get_legacy_game_key(&mut self, app_id: u32) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgClientGetLegacyGameKey { app_id: Some(app_id) };

        self.send_message(steam_enums::EMsg::ClientGetLegacyGameKey, &msg).await
    }

    /// Get a list of package IDs owned by the user.
    ///
    /// This filters out expired licenses.
    pub fn get_owned_packages(&self) -> Vec<u32> {
        self.apps.read().licenses.iter().filter(|l| (l.flags & ELicenseFlags::Expired as u32) == 0).map(|l| l.package_id).collect()
    }

    /// Check if the user owns a specific package.
    pub fn owns_package(&self, package_id: u32) -> bool {
        self.get_owned_packages().contains(&package_id)
    }
}
