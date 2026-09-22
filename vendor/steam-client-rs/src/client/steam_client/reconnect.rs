//! Reconnection control on `SteamClient`.

use steam_enums::EResult;
use tracing::info;

use super::SteamClient;
use crate::error::SteamError;
use crate::internal::reconnect::ReconnectState;

impl SteamClient {
    /// Manually trigger a reconnection.
    ///
    /// Closes the current connection (if any) and starts the reconnect sequence.
    ///
    /// # Errors
    /// - `NotLoggedOn` if not currently logged in.
    /// - `Other` if no stored credentials are available for relog.
    pub async fn relog(&mut self) -> Result<(), SteamError> {
        if self.steam_id.is_none() {
            return Err(SteamError::NotLoggedOn);
        }

        if self.auth.read().logon_details.is_none() {
            return Err(SteamError::Other("No stored credentials for relog".to_string()));
        }

        info!("Initiating manual relog");
        self.auth.write().relogging = true;

        if let Some(conn) = self.connection.take() {
            let _ = conn.close().await;
        }

        self.reconnect_manager.start_reconnection(EResult::NoConnection);

        Ok(())
    }

    /// Cancel any pending reconnection attempts.
    pub fn cancel_reconnect(&mut self) {
        self.reconnect_manager.reset();
        self.auth.write().relogging = false;
    }

    /// Check if currently attempting to reconnect.
    #[must_use]
    pub fn is_reconnecting(&self) -> bool {
        self.reconnect_manager.is_reconnecting()
    }

    /// Get the current reconnection state.
    #[must_use]
    pub fn reconnect_state(&self) -> ReconnectState {
        self.reconnect_manager.state()
    }
}
