//! Steam authentication and session management.
//!
//! This crate provides login session management, Steam Guard handling, and
//! token management.

mod auth_client;
mod cookies;
mod crypto;
mod error;
pub mod helpers;
mod http_client;
mod login_approver;
mod login_session;
mod transport;
mod types;
mod validation;

pub use auth_client::{AuthenticationClient, EncryptedPassword, PollLoginStatusResponse, RsaKeyResponse};
pub use cookies::{add_session_id_cookies, build_cookie_with_domain, build_simple_cookies, build_transfer_form_params, check_finalize_error, execute_single_transfer, execute_transfers_with_retry, extract_cookie_domains, extract_domain_from_url, extract_steam_login_cookies, filter_session_id_cookies, parse_cookies_from_header, parse_transfer_info, TransferInfo, TransferResult};
pub use crypto::rsa_encrypt_password;
pub use error::SessionError;
pub use helpers::{decode_jwt, is_refresh_token};
pub use http_client::{HttpClient, HttpResponse, MultipartForm};
pub use login_approver::{ApproverOptions, LoginApprover, LoginApproverBuilder};
pub use login_session::{LoginSession, LoginSessionBuilder};
// Re-export commonly used enums from steam-protos
pub use steam_protos::{CAuthenticationGetAuthSessionInfoResponse, EAuthSessionGuardType, EAuthSessionSecurityHistory, EAuthTokenPlatformType, ESessionPersistence};
pub use transport::{ApiRequest, ApiResponse, Transport, WebApiTransport, WebSocketCMTransport};
pub use types::{AllowedConfirmation, ApproveAuthSessionRequest, CredentialsDetails, LoginSessionOptions, PollResult, StartAuthSessionResponse, StartSessionResponse, ValidAction};
pub use validation::{determine_required_code_type, determine_valid_actions, generate_session_id, process_confirmations, validate_access_token, validate_refresh_token, ProcessConfirmationsResult, ValidatedRefreshToken};
