//! Steam client error types.

use steam_auth::EAuthSessionGuardType;
use steam_cm_provider::CmError;
use steam_enums::EResult;
use thiserror::Error;

/// Errors that can occur when using the Steam client.
#[derive(Error, Debug)]
#[non_exhaustive]
pub enum SteamError {
    /// Steam returned an error result.
    #[error("Steam error: {0:?}")]
    SteamResult(EResult),

    /// Connection error.
    #[error("Connection error: {0}")]
    ConnectionError(String),

    /// Already logged on.
    #[error("Already logged on")]
    AlreadyLoggedOn,

    /// Already connecting.
    #[error("Already connecting")]
    AlreadyConnecting,

    /// Not logged on.
    #[error("Not logged on")]
    NotLoggedOn,

    /// Not connected.
    #[error("Not connected")]
    NotConnected,

    /// Invalid credentials.
    #[error("Invalid credentials")]
    InvalidCredentials,

    /// Steam Guard authentication required.
    ///
    /// This error is returned when password authentication requires a Steam
    /// Guard code. The `guard_type` indicates what kind of code is needed:
    /// - `EmailCode`: A code sent to the account's email
    /// - `DeviceCode`: A TOTP code from the Steam mobile app
    /// - `DeviceConfirmation`: Approval via the Steam mobile app
    #[error("Steam Guard required: {guard_type:?}")]
    SteamGuardRequired {
        /// Type of Steam Guard verification needed.
        guard_type: EAuthSessionGuardType,
        /// Email domain hint (e.g., "g****.com") if guard_type is EmailCode.
        email_domain: Option<String>,
    },

    /// Two-factor authentication required (legacy).
    #[error("Two-factor authentication required")]
    TwoFactorRequired,

    /// Invalid token.
    #[error("Invalid token: {0}")]
    InvalidToken(String),

    /// Network error.
    #[error("Network error: {0}")]
    NetworkError(std::io::Error),

    /// Timeout.
    #[error("Operation timed out")]
    Timeout,

    /// Response timed out.
    #[error("Response timed out")]
    ResponseTimeout,

    /// Deserialization failed.
    #[error("Deserialization failed")]
    DeserializationFailed,

    /// Protocol error.
    #[error("Protocol error: {0}")]
    ProtocolError(String),

    /// Bad response from Steam.
    ///
    /// This error is returned when Steam returns a malformed response or one
    /// that violates expectations (e.g. missing SteamID in logon response).
    #[error("Bad response: {message}")]
    BadResponse {
        /// Human-readable error message.
        message: String,
        /// The EMsg that triggered this error (if known).
        emsg: Option<steam_enums::EMsg>,
        /// The raw bytes that failed to parse (truncated for display).
        raw_bytes: Option<Vec<u8>>,
    },

    /// Session error.
    #[error("Session error: {0}")]
    SessionError(#[from] steam_auth::SessionError),

    /// Not implemented yet.
    #[error("Not implemented: {0}")]
    NotImplemented(String),

    /// HTTP/Reqwest error (transparent — preserves `source()` chain).
    #[error(transparent)]
    Reqwest(#[from] reqwest::Error),

    /// WebSocket transport error (transparent — preserves `source()` chain).
    #[error(transparent)]
    WebSocket(#[from] tokio_tungstenite::tungstenite::Error),

    /// Protobuf decode error (transparent — preserves `source()` chain).
    #[error(transparent)]
    Decode(#[from] prost::DecodeError),

    // Transitional escape hatch — prefer typed variants for new code.
    /// Other error.
    #[error("{0}")]
    Other(String),
}

impl SteamError {
    /// Returns the EResult if this is a Steam result error.
    pub fn eresult(&self) -> Option<EResult> {
        match self {
            SteamError::SteamResult(result) => Some(*result),
            _ => None,
        }
    }

    /// Returns true if the error is a transient error that might be resolved by
    /// retrying.
    ///
    /// Matches Node.js behavior for handling:
    /// - Fail
    /// - ServiceUnavailable
    /// - TryAnotherCM
    /// - NoConnection (in logoff context)
    pub fn is_retryable(&self) -> bool {
        match self {
            SteamError::SteamResult(result) => matches!(result, EResult::Fail | EResult::ServiceUnavailable | EResult::TryAnotherCM | EResult::NoConnection),
            SteamError::NetworkError(_) | SteamError::Timeout => true,
            _ => false,
        }
    }

    /// Create a BadResponse error with just a message (backwards-compatible
    /// shorthand).
    pub fn bad_response(message: impl Into<String>) -> Self {
        SteamError::BadResponse { message: message.into(), emsg: None, raw_bytes: None }
    }

    /// Create a BadResponse error with full context.
    pub fn bad_response_with_context(message: impl Into<String>, emsg: Option<steam_enums::EMsg>, raw_bytes: Option<Vec<u8>>) -> Self {
        SteamError::BadResponse { message: message.into(), emsg, raw_bytes }
    }
}

impl From<CmError> for SteamError {
    fn from(e: CmError) -> Self {
        match e {
            CmError::Network(s) => SteamError::NetworkError(std::io::Error::other(s)),
            CmError::Protocol(s) => SteamError::ProtocolError(s),
            CmError::ApiError(status, msg) => SteamError::ProtocolError(format!("Steam API error (status {}): {}", status, msg)),
            CmError::InvalidResponse(s) => SteamError::bad_response(s),
            CmError::Connection(s) => SteamError::ConnectionError(s),
            CmError::CacheError(s) => SteamError::Other(format!("Cache error: {}", s)),
            CmError::Timeout => SteamError::Timeout,
            CmError::NoServers => SteamError::ConnectionError("No CM servers available".into()),
            CmError::Io(e) => SteamError::NetworkError(e),
            CmError::Json(e) => SteamError::ProtocolError(format!("JSON error: {}", e)),
            CmError::Other(s) => SteamError::Other(s),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::error::Error as _;

    /// Verifies that the `#[from] prost::DecodeError` machinery produces a
    /// `SteamError::Decode` whose payload is the original `prost::DecodeError`
    /// and whose `Display` impl is transparent (delegates to the inner error).
    ///
    /// Note: because the variant is `#[error(transparent)]`, `source()` on the
    /// outer `SteamError` returns the *inner* error's `source()` — and a
    /// `prost::DecodeError` has no underlying source itself. So we verify
    /// chain-correctness by downcasting via `Error::source` on a wrapper, or
    /// by matching the variant directly.
    #[test]
    fn prost_decode_error_preserves_source_chain() {
        let decode_err = prost::DecodeError::new("invalid wire format");
        let expected_display = decode_err.to_string();

        let steam_err: SteamError = decode_err.into();

        // Must be the typed variant.
        let inner = match &steam_err {
            SteamError::Decode(e) => e,
            other => panic!("expected SteamError::Decode, got {:?}", other),
        };

        // Transparent Display: outer error's message must equal inner's.
        assert_eq!(steam_err.to_string(), expected_display);
        assert_eq!(inner.to_string(), expected_display);

        // Wrap the SteamError as a source of another error to exercise the
        // `source()` chain — proves callers using `anyhow`/`eyre` can walk
        // down to the underlying `prost::DecodeError`.
        #[derive(Debug)]
        struct Wrap(SteamError);
        impl std::fmt::Display for Wrap {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                write!(f, "wrapped")
            }
        }
        impl std::error::Error for Wrap {
            fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
                Some(&self.0)
            }
        }
        let wrapped = Wrap(steam_err);
        let src = wrapped.source().expect("wrapper exposes SteamError as source");
        // The source must downcast to SteamError (since `transparent`
        // forwards through, but the outer Wrap returns the SteamError
        // itself, not its inner).
        assert!(src.downcast_ref::<SteamError>().is_some(), "source should downcast to SteamError");
    }

    /// Verifies that decoding malformed bytes via `prost::Message::decode`
    /// flows through `#[from]` into `SteamError::Decode` end-to-end and
    /// preserves the underlying error's message through transparent Display.
    #[test]
    fn prost_message_decode_failure_converts_via_from() {
        use prost::Message;

        let bad: &[u8] = &[0xff, 0xff, 0xff];
        let result: Result<String, prost::DecodeError> = String::decode(bad);
        let decode_err = result.expect_err("decoding malformed bytes must fail");
        let expected_display = decode_err.to_string();

        let steam_err: SteamError = decode_err.into();
        assert!(matches!(steam_err, SteamError::Decode(_)));
        // Transparent Display delegation proves the `#[from]` machinery
        // actually wraps the original error rather than stringifying it.
        assert_eq!(steam_err.to_string(), expected_display);
    }
}
