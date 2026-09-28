//! Session error types.

use steam_enums::EResult;
use thiserror::Error;

/// Errors that can occur during Steam authentication.
#[derive(Error, Debug)]
pub enum SessionError {
    #[error("Invalid credentials")]
    InvalidCredentials,

    #[error("Steam Guard code required")]
    SteamGuardRequired,

    #[error("Two-factor code required")]
    TwoFactorRequired,

    #[error("Invalid Steam Guard code")]
    InvalidSteamGuardCode,

    #[error("Invalid two-factor code")]
    InvalidTwoFactorCode,

    #[error("Rate limited")]
    RateLimited,

    #[error("Session expired")]
    SessionExpired,

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Token error: {0}")]
    TokenError(String),

    #[error("Steam error: {0} (EResult: {1:?})")]
    SteamError(String, EResult),

    #[error("Invalid JWT format")]
    InvalidJwt,

    #[error("Invalid QR code URL: {0}")]
    InvalidQrUrl(String),

    #[error("Login session not started")]
    NotStarted,

    #[error("Login attempt canceled")]
    Canceled,

    #[error("Login timeout")]
    Timeout,

    #[error("Cannot use this method with current login state")]
    InvalidState,

    #[error("Protobuf encode error: {0}")]
    ProtobufEncode(#[from] prost::EncodeError),

    #[error("Protobuf decode error: {0}")]
    ProtobufDecode(#[from] prost::DecodeError),

    #[error("RSA encryption error: {0}")]
    RsaError(#[from] rsa::errors::Error),

    #[error("Crypto error: {0}")]
    CryptoError(String),

    #[error("HTTP error: {0}")]
    HttpError(#[from] reqwest::Error),

    #[error("WebSocket error: {0}")]
    WebSocketError(Box<tokio_tungstenite::tungstenite::Error>),

    #[error("Protocol error: {0}")]
    ProtocolError(String),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Base64 error: {0}")]
    Base64(#[from] base64::DecodeError),

    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
}

impl From<tokio_tungstenite::tungstenite::Error> for SessionError {
    fn from(err: tokio_tungstenite::tungstenite::Error) -> Self {
        SessionError::WebSocketError(Box::new(err))
    }
}

impl SessionError {
    /// Create a Steam error from an EResult code.
    pub fn from_eresult(result: i32, message: Option<String>) -> Self {
        let eresult = match EResult::from_i32(result) {
            Some(e) => e,
            None => {
                tracing::warn!("Unknown EResult code: {}", result);
                EResult::Invalid
            }
        };
        let msg = message.unwrap_or_else(|| format!("{:?}", eresult));
        SessionError::SteamError(msg, eresult)
    }
}
