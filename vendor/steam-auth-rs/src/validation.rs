//! Pure validation functions for token and session handling.
//!
//! These functions are extracted from LoginSession to enable easier unit
//! testing without requiring full session state.

use steam_protos::{EAuthSessionGuardType, EAuthTokenPlatformType};
use steamid::SteamID;

use crate::{
    error::SessionError,
    helpers::decode_jwt,
    types::{AllowedConfirmation, ValidAction},
};

/// Result of validating a refresh token.
#[derive(Debug, Clone)]
pub struct ValidatedRefreshToken {
    /// The SteamID extracted from the token.
    pub steam_id: SteamID,
    /// The validated token string.
    pub token: String,
}

/// Validate a refresh token for the given platform.
///
/// # Arguments
/// * `token` - The JWT refresh token to validate
/// * `platform_type` - The platform type to validate against
///
/// # Returns
/// * `Ok(ValidatedRefreshToken)` if valid
/// * `Err(SessionError)` if the token is invalid or doesn't match the platform
pub fn validate_refresh_token(token: &str, platform_type: EAuthTokenPlatformType) -> Result<ValidatedRefreshToken, SessionError> {
    let decoded = decode_jwt(token)?;

    // Verify it's a refresh token (has "derive" audience)
    if !decoded.aud.contains(&"derive".to_string()) {
        return Err(SessionError::TokenError("Provided token is an access token, not a refresh token".into()));
    }

    // Verify platform audience
    let required_audience = match platform_type {
        EAuthTokenPlatformType::KEAuthTokenPlatformTypeSteamClient => "client",
        EAuthTokenPlatformType::KEAuthTokenPlatformTypeMobileApp => "mobile",
        EAuthTokenPlatformType::KEAuthTokenPlatformTypeWebBrowser => "web",
        _ => "unknown",
    };

    if !decoded.aud.contains(&required_audience.to_string()) {
        return Err(SessionError::TokenError(format!("Token platform type mismatch (required audience \"{}\")", required_audience)));
    }

    // Parse SteamID
    let steam_id64: u64 = decoded.sub.parse().map_err(|_| SessionError::TokenError("Invalid SteamID in token".into()))?;

    Ok(ValidatedRefreshToken { steam_id: SteamID::from(steam_id64), token: token.to_string() })
}

/// Validate an access token.
///
/// # Arguments
/// * `token` - The JWT access token to validate
/// * `existing_steam_id` - Optional existing SteamID to verify against
///
/// # Returns
/// * `Ok(String)` - The validated token string
/// * `Err(SessionError)` if the token is invalid or SteamID doesn't match
pub fn validate_access_token(token: &str, existing_steam_id: Option<&SteamID>) -> Result<String, SessionError> {
    let decoded = decode_jwt(token)?;

    // Verify it's NOT a refresh token
    if decoded.aud.contains(&"derive".to_string()) {
        return Err(SessionError::TokenError("Provided token is a refresh token, not an access token".into()));
    }

    // Verify SteamID matches if we have one
    if let Some(existing) = existing_steam_id {
        let steam_id64: u64 = decoded.sub.parse().map_err(|_| SessionError::TokenError("Invalid SteamID in token".into()))?;
        if existing.steam_id64() != steam_id64 {
            return Err(SessionError::TokenError("Token belongs to a different account".into()));
        }
    }

    Ok(token.to_string())
}

/// Determine valid actions from allowed confirmations.
///
/// # Arguments
/// * `confirmations` - List of allowed confirmations from the auth response
///
/// # Returns
/// * `None` if no action is required (KEAuthSessionGuardTypeNone present)
/// * `Some(Vec<ValidAction>)` with the valid actions to take
pub fn determine_valid_actions(confirmations: &[AllowedConfirmation]) -> Option<Vec<ValidAction>> {
    let mut valid_actions = Vec::new();

    for confirmation in confirmations {
        match confirmation.confirmation_type {
            EAuthSessionGuardType::KEAuthSessionGuardTypeNone => {
                // No guard required
                return None;
            }
            EAuthSessionGuardType::KEAuthSessionGuardTypeEmailCode | EAuthSessionGuardType::KEAuthSessionGuardTypeDeviceCode => {
                valid_actions.push(ValidAction { guard_type: confirmation.confirmation_type, detail: confirmation.message.clone() });
            }
            EAuthSessionGuardType::KEAuthSessionGuardTypeDeviceConfirmation | EAuthSessionGuardType::KEAuthSessionGuardTypeEmailConfirmation => {
                valid_actions.push(ValidAction { guard_type: confirmation.confirmation_type, detail: None });
            }
            _ => {}
        }
    }

    if valid_actions.is_empty() {
        None
    } else {
        Some(valid_actions)
    }
}

/// Generate a session ID from random bytes.
///
/// # Arguments
/// * `random_bytes` - 24 bytes of random data
///
/// # Returns
/// A 24-character hex session ID
pub fn generate_session_id(random_bytes: &[u8]) -> String {
    random_bytes.iter().take(24).map(|b| format!("{:x}", b % 16)).collect()
}

/// Result of processing allowed confirmations.
///
/// This struct is returned by [`process_confirmations`] to indicate what
/// actions are required to complete authentication.
#[derive(Debug, Clone)]
pub struct ProcessConfirmationsResult {
    /// Whether user action is required to complete authentication.
    pub requires_action: bool,
    /// List of valid actions the user can take (if action required).
    pub valid_actions: Option<Vec<ValidAction>>,
    /// Whether a pre-supplied Steam Guard code should be submitted.
    pub should_submit_presupplied_code: bool,
    /// QR code challenge URL (for QR login flows).
    pub qr_challenge_url: Option<String>,
}

/// Process allowed confirmations and determine required actions.
///
/// This is a pure function extracted from
/// `LoginSession::process_start_session_response` to enable easier unit testing
/// without requiring full session state.
///
/// # Arguments
/// * `confirmations` - List of allowed confirmations from the auth response
/// * `challenge_url` - Optional QR code challenge URL
/// * `has_presupplied_code` - Whether a Steam Guard code was pre-supplied
///
/// # Returns
/// A [`ProcessConfirmationsResult`] indicating what actions are needed
///
/// # Example
/// ```rust,ignore
/// use steam_auth::validation::{process_confirmations, AllowedConfirmation};
///
/// let confirmations = vec![AllowedConfirmation {
///     confirmation_type: EAuthSessionGuardType::KEAuthSessionGuardTypeNone,
///     message: None,
/// }];
///
/// let result = process_confirmations(&confirmations, None, false);
/// assert!(!result.requires_action);
/// ```
pub fn process_confirmations(confirmations: &[AllowedConfirmation], challenge_url: Option<String>, has_presupplied_code: bool) -> ProcessConfirmationsResult {
    let mut valid_actions = Vec::new();
    let mut should_submit_presupplied_code = false;

    for confirmation in confirmations {
        match confirmation.confirmation_type {
            EAuthSessionGuardType::KEAuthSessionGuardTypeNone => {
                // No guard required, we can poll immediately
                return ProcessConfirmationsResult { requires_action: false, valid_actions: None, should_submit_presupplied_code: false, qr_challenge_url: None };
            }
            EAuthSessionGuardType::KEAuthSessionGuardTypeEmailCode | EAuthSessionGuardType::KEAuthSessionGuardTypeDeviceCode => {
                // Check if we have a pre-supplied code
                if has_presupplied_code {
                    should_submit_presupplied_code = true;
                }
                valid_actions.push(ValidAction { guard_type: confirmation.confirmation_type, detail: confirmation.message.clone() });
            }
            EAuthSessionGuardType::KEAuthSessionGuardTypeDeviceConfirmation | EAuthSessionGuardType::KEAuthSessionGuardTypeEmailConfirmation => {
                valid_actions.push(ValidAction { guard_type: confirmation.confirmation_type, detail: None });
            }
            _ => {}
        }
    }

    if valid_actions.is_empty() {
        // No valid actions found - this is an error state
        ProcessConfirmationsResult {
            requires_action: true,
            valid_actions: None,
            should_submit_presupplied_code: false,
            qr_challenge_url: challenge_url,
        }
    } else {
        ProcessConfirmationsResult {
            requires_action: !should_submit_presupplied_code,
            valid_actions: Some(valid_actions),
            should_submit_presupplied_code,
            qr_challenge_url: challenge_url,
        }
    }
}

/// Determine which Steam Guard code type is required from confirmations.
///
/// This is a pure function that examines the allowed confirmations and
/// determines if an email code or device (TOTP) code is needed.
///
/// # Arguments
/// * `confirmations` - List of allowed confirmations from the auth response
///
/// # Returns
/// * `Some(EAuthSessionGuardType)` - The code type required (email or device)
/// * `None` - If no code is required
///
/// # Example
/// ```rust,ignore
/// use steam_auth::validation::determine_required_code_type;
///
/// let confirmations = vec![AllowedConfirmation {
///     confirmation_type: EAuthSessionGuardType::KEAuthSessionGuardTypeEmailCode,
///     message: Some("test@example.com".to_string()),
/// }];
///
/// let code_type = determine_required_code_type(&confirmations);
/// assert_eq!(code_type, Some(EAuthSessionGuardType::KEAuthSessionGuardTypeEmailCode));
/// ```
pub fn determine_required_code_type(confirmations: &[AllowedConfirmation]) -> Option<EAuthSessionGuardType> {
    let needs_email = confirmations.iter().any(|c| c.confirmation_type == EAuthSessionGuardType::KEAuthSessionGuardTypeEmailCode);
    let needs_totp = confirmations.iter().any(|c| c.confirmation_type == EAuthSessionGuardType::KEAuthSessionGuardTypeDeviceCode);

    if needs_email {
        Some(EAuthSessionGuardType::KEAuthSessionGuardTypeEmailCode)
    } else if needs_totp {
        Some(EAuthSessionGuardType::KEAuthSessionGuardTypeDeviceCode)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};

    use super::*;

    #[derive(serde::Serialize)]
    struct JwtPayload<'a> {
        sub: &'a str,
        aud: &'a [&'a str],
    }

    /// Create a fake JWT for testing.
    fn make_test_jwt(sub: &str, audiences: &[&str]) -> String {
        let header = URL_SAFE_NO_PAD.encode(r#"{"typ":"JWT","alg":"EdDSA"}"#);

        let payload = JwtPayload { sub, aud: audiences };

        // Use to_string directly on the struct, simpler than creating Value then
        // to_string
        let payload_json = serde_json::to_string(&payload).unwrap();
        let payload_encoded = URL_SAFE_NO_PAD.encode(payload_json);
        format!("{}.{}.fake_signature", header, payload_encoded)
    }

    #[test]
    fn test_validate_refresh_token_valid() {
        let token = make_test_jwt("76561198000000000", &["derive", "client"]);
        let result = validate_refresh_token(&token, EAuthTokenPlatformType::KEAuthTokenPlatformTypeSteamClient);

        assert!(result.is_ok());
        let validated = result.unwrap();
        assert_eq!(validated.steam_id.steam_id64(), 76561198000000000);
    }

    #[test]
    fn test_validate_refresh_token_rejects_access_token() {
        let token = make_test_jwt("76561198000000000", &["client"]); // No "derive"
        let result = validate_refresh_token(&token, EAuthTokenPlatformType::KEAuthTokenPlatformTypeSteamClient);

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), SessionError::TokenError(_)));
    }

    #[test]
    fn test_validate_refresh_token_platform_mismatch() {
        let token = make_test_jwt("76561198000000000", &["derive", "web"]);
        let result = validate_refresh_token(
            &token,
            EAuthTokenPlatformType::KEAuthTokenPlatformTypeSteamClient, // Expects "client"
        );

        assert!(result.is_err());
    }

    #[test]
    fn test_validate_access_token_valid() {
        let token = make_test_jwt("76561198000000000", &["client"]);
        let result = validate_access_token(&token, None);

        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_access_token_rejects_refresh_token() {
        let token = make_test_jwt("76561198000000000", &["derive", "client"]);
        let result = validate_access_token(&token, None);

        assert!(result.is_err());
    }

    #[test]
    fn test_validate_access_token_steam_id_mismatch() {
        let token = make_test_jwt("76561198000000001", &["client"]);
        let existing = SteamID::from(76561198000000000u64);
        let result = validate_access_token(&token, Some(&existing));

        assert!(result.is_err());
    }

    #[test]
    fn test_validate_access_token_steam_id_matches() {
        let token = make_test_jwt("76561198000000000", &["client"]);
        let existing = SteamID::from(76561198000000000u64);
        let result = validate_access_token(&token, Some(&existing));

        assert!(result.is_ok());
    }

    #[test]
    fn test_determine_valid_actions_none_guard() {
        let confirmations = vec![AllowedConfirmation { confirmation_type: EAuthSessionGuardType::KEAuthSessionGuardTypeNone, message: None }];

        let result = determine_valid_actions(&confirmations);
        assert!(result.is_none());
    }

    #[test]
    fn test_determine_valid_actions_email_code() {
        let confirmations = vec![AllowedConfirmation {
            confirmation_type: EAuthSessionGuardType::KEAuthSessionGuardTypeEmailCode,
            message: Some("test@example.com".to_string()),
        }];

        let result = determine_valid_actions(&confirmations);
        assert!(result.is_some());
        let actions = result.unwrap();
        assert_eq!(actions.len(), 1);
        assert_eq!(actions[0].guard_type, EAuthSessionGuardType::KEAuthSessionGuardTypeEmailCode);
    }

    #[test]
    fn test_generate_session_id() {
        let bytes: Vec<u8> = (0..24).collect();
        let session_id = generate_session_id(&bytes);

        assert_eq!(session_id.len(), 24);
        // First 16 bytes become 0-f
        assert_eq!(&session_id[..16], "0123456789abcdef");
    }

    #[test]
    fn test_generate_session_id_deterministic() {
        let bytes = vec![0x0a, 0x0b, 0x0c, 0x0d];
        let id1 = generate_session_id(&bytes);
        let id2 = generate_session_id(&bytes);

        assert_eq!(id1, id2);
    }

    // Tests for process_confirmations

    #[test]
    fn test_process_confirmations_no_guard_required() {
        let confirmations = vec![AllowedConfirmation { confirmation_type: EAuthSessionGuardType::KEAuthSessionGuardTypeNone, message: None }];

        let result = process_confirmations(&confirmations, None, false);

        assert!(!result.requires_action);
        assert!(result.valid_actions.is_none());
        assert!(!result.should_submit_presupplied_code);
        assert!(result.qr_challenge_url.is_none());
    }

    #[test]
    fn test_process_confirmations_email_code_required() {
        let confirmations = vec![AllowedConfirmation {
            confirmation_type: EAuthSessionGuardType::KEAuthSessionGuardTypeEmailCode,
            message: Some("t***@example.com".to_string()),
        }];

        let result = process_confirmations(&confirmations, None, false);

        assert!(result.requires_action);
        assert!(result.valid_actions.is_some());
        let actions = result.valid_actions.unwrap();
        assert_eq!(actions.len(), 1);
        assert_eq!(actions[0].guard_type, EAuthSessionGuardType::KEAuthSessionGuardTypeEmailCode);
        assert_eq!(actions[0].detail, Some("t***@example.com".to_string()));
        assert!(!result.should_submit_presupplied_code);
    }

    #[test]
    fn test_process_confirmations_with_presupplied_code() {
        let confirmations = vec![AllowedConfirmation { confirmation_type: EAuthSessionGuardType::KEAuthSessionGuardTypeDeviceCode, message: None }];

        let result = process_confirmations(&confirmations, None, true);

        // When code is presupplied, action is not required (we'll auto-submit)
        assert!(!result.requires_action);
        assert!(result.valid_actions.is_some());
        assert!(result.should_submit_presupplied_code);
    }

    #[test]
    fn test_process_confirmations_device_confirmation() {
        let confirmations = vec![AllowedConfirmation { confirmation_type: EAuthSessionGuardType::KEAuthSessionGuardTypeDeviceConfirmation, message: None }];

        let result = process_confirmations(&confirmations, Some("https://qr.example.com".to_string()), false);

        assert!(result.requires_action);
        let actions = result.valid_actions.unwrap();
        assert_eq!(actions.len(), 1);
        assert_eq!(actions[0].guard_type, EAuthSessionGuardType::KEAuthSessionGuardTypeDeviceConfirmation);
        assert_eq!(result.qr_challenge_url, Some("https://qr.example.com".to_string()));
    }

    #[test]
    fn test_process_confirmations_multiple_options() {
        let confirmations = vec![
            AllowedConfirmation {
                confirmation_type: EAuthSessionGuardType::KEAuthSessionGuardTypeEmailCode,
                message: Some("t***@example.com".to_string()),
            },
            AllowedConfirmation { confirmation_type: EAuthSessionGuardType::KEAuthSessionGuardTypeDeviceCode, message: None },
        ];

        let result = process_confirmations(&confirmations, None, false);

        assert!(result.requires_action);
        let actions = result.valid_actions.unwrap();
        assert_eq!(actions.len(), 2);
    }

    #[test]
    fn test_process_confirmations_empty_list() {
        let confirmations: Vec<AllowedConfirmation> = vec![];

        let result = process_confirmations(&confirmations, None, false);

        // Empty list means error state
        assert!(result.requires_action);
        assert!(result.valid_actions.is_none());
    }

    // Tests for determine_required_code_type

    #[test]
    fn test_determine_required_code_type_email() {
        let confirmations = vec![AllowedConfirmation {
            confirmation_type: EAuthSessionGuardType::KEAuthSessionGuardTypeEmailCode,
            message: Some("t***@example.com".to_string()),
        }];

        let result = determine_required_code_type(&confirmations);
        assert_eq!(result, Some(EAuthSessionGuardType::KEAuthSessionGuardTypeEmailCode));
    }

    #[test]
    fn test_determine_required_code_type_totp() {
        let confirmations = vec![AllowedConfirmation { confirmation_type: EAuthSessionGuardType::KEAuthSessionGuardTypeDeviceCode, message: None }];

        let result = determine_required_code_type(&confirmations);
        assert_eq!(result, Some(EAuthSessionGuardType::KEAuthSessionGuardTypeDeviceCode));
    }

    #[test]
    fn test_determine_required_code_type_email_priority() {
        // When both email and TOTP are available, email takes priority
        let confirmations = vec![
            AllowedConfirmation { confirmation_type: EAuthSessionGuardType::KEAuthSessionGuardTypeDeviceCode, message: None },
            AllowedConfirmation {
                confirmation_type: EAuthSessionGuardType::KEAuthSessionGuardTypeEmailCode,
                message: Some("t***@example.com".to_string()),
            },
        ];

        let result = determine_required_code_type(&confirmations);
        assert_eq!(result, Some(EAuthSessionGuardType::KEAuthSessionGuardTypeEmailCode));
    }

    #[test]
    fn test_determine_required_code_type_none() {
        let confirmations = vec![AllowedConfirmation { confirmation_type: EAuthSessionGuardType::KEAuthSessionGuardTypeNone, message: None }];

        let result = determine_required_code_type(&confirmations);
        assert!(result.is_none());
    }

    #[test]
    fn test_determine_required_code_type_device_confirmation_not_code() {
        // Device confirmation (push notification) is different from device code (TOTP)
        let confirmations = vec![AllowedConfirmation { confirmation_type: EAuthSessionGuardType::KEAuthSessionGuardTypeDeviceConfirmation, message: None }];

        let result = determine_required_code_type(&confirmations);
        assert!(result.is_none());
    }
}
