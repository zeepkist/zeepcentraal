//! Trading functionality for Steam client.
//!
//! This module provides trade request functionality. Note that trading through
//! the Steam UI has been deprecated in favor of trade offers, but this still
//! works between bots.

use steamid::SteamID;

use crate::{error::SteamError, SteamClient};

/// Trade restrictions that may apply.
#[derive(Debug, Clone, Default)]
pub struct TradeRestrictions {
    /// Days of Steam Guard required.
    pub steamguard_required_days: u32,
    /// Days of new device cooldown.
    pub new_device_cooldown_days: u32,
    /// Default password reset probation days.
    pub default_password_reset_probation_days: u32,
    /// Current password reset probation days.
    pub password_reset_probation_days: u32,
    /// Default email change probation days.
    pub default_email_change_probation_days: u32,
    /// Current email change probation days.
    pub email_change_probation_days: u32,
}

impl SteamClient {
    /// Send a trade request to another user.
    ///
    /// **Note**: Trading has been removed from the Steam UI in favor of trade
    /// offers. This still works between bots however.
    ///
    /// # Arguments
    /// * `steam_id` - The SteamID of the user to trade with
    pub async fn trade(&mut self, steam_id: SteamID) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgTradingInitiateTradeRequest { other_steamid: Some(steam_id.steam_id64()), ..Default::default() };

        self.send_message(steam_enums::EMsg::EconTrading_InitiateTradeRequest, &msg).await
    }

    /// Cancel an outstanding trade request we sent to another user.
    ///
    /// # Arguments
    /// * `steam_id` - The SteamID of the user to cancel the trade with
    pub async fn cancel_trade_request(&mut self, steam_id: SteamID) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CMsgTradingCancelTradeRequest { other_steamid: Some(steam_id.steam_id64()) };

        self.send_message(steam_enums::EMsg::EconTrading_CancelTradeRequest, &msg).await
    }

    /// Respond to a trade request.
    ///
    /// # Arguments
    /// * `trade_request_id` - The trade request ID from the TradeRequest event
    /// * `accept` - Whether to accept or decline the trade
    pub async fn respond_to_trade(&mut self, trade_request_id: u32, accept: bool) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let response = if accept { steam_enums::EEconTradeResponse::Accepted } else { steam_enums::EEconTradeResponse::Declined };

        let msg = steam_protos::CMsgTradingInitiateTradeResponse { trade_request_id: Some(trade_request_id), response: Some(response as u32), ..Default::default() };

        self.send_message(steam_enums::EMsg::EconTrading_InitiateTradeResponse, &msg).await
    }
}
