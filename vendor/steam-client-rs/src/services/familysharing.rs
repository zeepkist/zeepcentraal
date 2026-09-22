//! Family sharing functionality for Steam client.
//!
//! This module provides management of Steam Family Library Sharing,
//! including authorized borrowers and sharing devices.

use steam_enums::EMsg;
use steamid::SteamID;

use crate::{error::SteamError, SteamClient};

/// An authorized borrower for family sharing.
#[derive(Debug, Clone)]
pub struct AuthorizedBorrower {
    /// Borrower's SteamID.
    pub steamid: SteamID,
    /// Whether the authorization is pending.
    pub is_pending: bool,
    /// Whether the authorization was canceled.
    pub is_canceled: bool,
    /// Time the authorization was created (Unix timestamp).
    pub time_created: u32,
}

/// An authorized sharing device.
#[derive(Debug, Clone)]
pub struct AuthorizedDevice {
    /// Device token.
    pub device_token: u64,
    /// Device name.
    pub device_name: String,
    /// Whether the authorization is pending.
    pub is_pending: bool,
    /// Whether the authorization was canceled.
    pub is_canceled: bool,
    /// Whether the device is limited.
    pub is_limited: bool,
    /// Last time the device was used (Unix timestamp).
    pub last_time_used: Option<u32>,
    /// Last borrower who used this device.
    pub last_borrower: Option<SteamID>,
    /// Last app played on this device.
    pub last_app_played: Option<u32>,
}

impl SteamClient {
    /// Add new borrowers to your family sharing.
    ///
    /// # Arguments
    /// * `borrowers` - SteamIDs of users to authorize as borrowers
    pub async fn add_authorized_borrowers(&mut self, borrowers: Vec<SteamID>) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CDeviceAuthAddAuthorizedBorrowersRequest {
            steamid: self.steam_id.as_ref().map(|s| s.steam_id64()),
            steamid_borrower: borrowers.iter().map(|s| s.steam_id64()).collect(),
        };

        let _: steam_protos::CDeviceAuthAddAuthorizedBorrowersResponse = self.send_unified_request_and_wait("DeviceAuth.AddAuthorizedBorrowers#1", &msg).await?;

        Ok(())
    }

    /// Remove borrowers from your family sharing.
    ///
    /// # Arguments
    /// * `borrowers` - SteamIDs of borrowers to remove
    pub async fn remove_authorized_borrowers(&mut self, borrowers: Vec<SteamID>) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CDeviceAuthRemoveAuthorizedBorrowersRequest {
            steamid: self.steam_id.as_ref().map(|s| s.steam_id64()),
            steamid_borrower: borrowers.iter().map(|s| s.steam_id64()).collect(),
        };

        let _: steam_protos::CDeviceAuthRemoveAuthorizedBorrowersResponse = self.send_unified_request_and_wait("DeviceAuth.RemoveAuthorizedBorrowers#1", &msg).await?;

        Ok(())
    }

    /// Get a list of Steam accounts authorized to borrow your library.
    ///
    /// # Arguments
    /// * `include_canceled` - Include canceled authorizations
    /// * `include_pending` - Include pending authorizations
    pub async fn get_authorized_borrowers(&mut self, include_canceled: bool, include_pending: bool) -> Result<Vec<AuthorizedBorrower>, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CDeviceAuthGetAuthorizedBorrowersRequest {
            steamid: self.steam_id.as_ref().map(|s| s.steam_id64()),
            include_canceled: Some(include_canceled),
            include_pending: Some(include_pending),
        };

        let response: steam_protos::CDeviceAuthGetAuthorizedBorrowersResponse = self.send_unified_request_and_wait("DeviceAuth.GetAuthorizedBorrowers#1", &msg).await?;

        let borrowers = response
            .borrowers
            .into_iter()
            .map(|b| AuthorizedBorrower {
                steamid: SteamID::from(b.steamid.unwrap_or(0)),
                is_pending: b.is_pending.unwrap_or(false),
                is_canceled: b.is_canceled.unwrap_or(false),
                time_created: b.time_created.unwrap_or(0),
            })
            .collect();

        Ok(borrowers)
    }

    /// Get a list of devices you have authorized for sharing.
    ///
    /// # Arguments
    /// * `include_canceled` - Include canceled authorizations
    pub async fn get_authorized_sharing_devices(&mut self, include_canceled: bool) -> Result<Vec<AuthorizedDevice>, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CDeviceAuthGetOwnAuthorizedDevicesRequest { steamid: self.steam_id.as_ref().map(|s| s.steam_id64()), include_canceled: Some(include_canceled) };

        let response: steam_protos::CDeviceAuthGetOwnAuthorizedDevicesResponse = self.send_unified_request_and_wait("DeviceAuth.GetOwnAuthorizedDevices#1", &msg).await?;

        let devices = response
            .devices
            .into_iter()
            .map(|d| AuthorizedDevice {
                device_token: d.auth_device_token.unwrap_or(0),
                device_name: d.device_name.unwrap_or_default(),
                is_pending: d.is_pending.unwrap_or(false),
                is_canceled: d.is_canceled.unwrap_or(false),
                is_limited: d.is_limited.unwrap_or(false),
                last_time_used: d.last_time_used,
                last_borrower: d.last_borrower_id.map(SteamID::from),
                last_app_played: d.last_app_played,
            })
            .collect();

        Ok(devices)
    }

    /// Authorize the local device for library sharing.
    ///
    /// # Arguments
    /// * `device_name` - Name for this device
    ///
    /// # Returns
    /// The device token for the newly authorized device.
    pub async fn authorize_local_sharing_device(&mut self, device_name: &str) -> Result<u64, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgClientAuthorizeLocalDeviceRequest {
            device_description: Some(device_name.to_string()),
            owner_account_id: Some(self.steam_id.as_ref().map(|s| s.account_id).unwrap_or(0)),
            local_device_token: None,
        };

        let response: steam_protos::CMsgClientAuthorizeLocalDevice = self.send_request_and_wait(EMsg::ClientAuthorizeLocalDeviceRequest, &msg).await?;

        if let Some(result) = response.eresult {
            if result != 1 {
                return Err(SteamError::SteamResult(steam_enums::EResult::from_i32(result).unwrap_or(steam_enums::EResult::Fail)));
            }
        }

        Ok(response.authed_device_token.unwrap_or(0))
    }

    /// Deauthorize a sharing device.
    ///
    /// # Arguments
    /// * `device_token` - The device token to deauthorize
    pub async fn deauthorize_sharing_device(&mut self, device_token: u64) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgClientDeauthorizeDeviceRequest {
            deauthorization_account_id: Some(self.steam_id.as_ref().map(|s| s.account_id).unwrap_or(0)),
            deauthorization_device_token: Some(device_token),
        };

        let response: steam_protos::CMsgClientDeauthorizeDevice = self.send_request_and_wait(EMsg::ClientDeauthorizeDeviceRequest, &msg).await?;

        if let Some(result) = response.eresult {
            if result != 1 {
                return Err(SteamError::SteamResult(steam_enums::EResult::from_i32(result).unwrap_or(steam_enums::EResult::Fail)));
            }
        }

        Ok(())
    }

    /// Use local device authorizations to allow usage of shared licenses.
    ///
    /// # Arguments
    /// * `owner_steam_id` - The SteamID of the library owner
    /// * `device_token` - The device token authorized by the owner
    pub async fn use_sharing_authorization(&mut self, owner_steam_id: SteamID, device_token: u64) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgClientUseLocalDeviceAuthorizations {
            authorization_account_id: vec![owner_steam_id.account_id],
            device_tokens: vec![steam_protos::c_msg_client_use_local_device_authorizations::DeviceToken { owner_account_id: Some(owner_steam_id.account_id), token_id: Some(device_token) }],
        };

        self.send_message(EMsg::ClientUseLocalDeviceAuthorizations, &msg).await
    }

    /// Deactivate family sharing authorizations.
    pub async fn deactivate_sharing_authorization(&mut self) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgClientUseLocalDeviceAuthorizations { authorization_account_id: vec![], device_tokens: vec![] };

        self.send_message(EMsg::ClientUseLocalDeviceAuthorizations, &msg).await
    }
}
