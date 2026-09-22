//! Trait definitions for Steam connection abstractions.
//!
//! These traits enable dependency injection for testing purposes,
//! allowing mock implementations to be used instead of real network
//! connections.
use async_trait::async_trait;
use bytes::Bytes;

use super::CmServer;
use crate::error::SteamError;

/// Trait for Steam CM server connections.
///
/// This trait abstracts the connection to a Steam CM server, enabling
/// mock implementations for unit testing.
#[async_trait]
pub trait SteamConnection: Send + Sync {
    /// Send binary data to the Steam server.
    async fn send(&mut self, data: Vec<u8>) -> Result<(), SteamError>;

    /// Receive binary data from the Steam server.
    ///
    /// Returns `Ok(None)` if the connection is closed or no data is available.
    async fn recv(&mut self) -> Result<Option<Bytes>, SteamError>;

    /// Close the connection.
    async fn close(self: Box<Self>) -> Result<(), SteamError>;

    /// Get information about the connected server.
    #[allow(dead_code)]
    fn server(&self) -> &CmServer;

    /// Set the session key for encryption.
    ///
    /// This allows the client to update the encryption key after a handshake.
    #[allow(dead_code)]
    fn set_session_key(&mut self, key: Option<Vec<u8>>);
}

#[async_trait]
pub trait CmServerProvider: Send + Sync {
    /// Get a CM server to connect to.
    ///
    /// Implementations may fetch from Steam API, use cached values,
    /// or return predefined servers for testing.
    async fn get_server(&self) -> Result<CmServer, SteamError>;
}

#[async_trait]
impl<H, R> CmServerProvider for steam_cm_provider::HttpCmServerProvider<H, R>
where
    H: steam_cm_provider::HttpClient + Clone + 'static,
    R: steam_cm_provider::CmRng + Send + Sync + Clone + 'static,
{
    async fn get_server(&self) -> Result<CmServer, SteamError> {
        let provider: &dyn steam_cm_provider::CmServerProvider = self as &dyn steam_cm_provider::CmServerProvider;
        Ok(provider.get_server().await?)
    }
}

impl steam_cm_provider::CmRng for dyn crate::utils::rng::Rng {
    fn gen_u32(&self) -> u32 {
        self.gen_u32()
    }

    fn gen_usize(&self, max: usize) -> usize {
        self.gen_usize(max)
    }
}
