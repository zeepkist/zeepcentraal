//! Helper utilities for Steam authentication.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use sha1::{Digest, Sha1};

use crate::error::SessionError;

/// Decoded JWT payload.
#[derive(Debug, Clone)]
pub struct JwtPayload {
    /// Subject (SteamID64 as string)
    pub sub: String,
    /// Audiences
    pub aud: Vec<String>,
    /// Expiration timestamp
    pub exp: Option<u64>,
    /// Issued at timestamp
    pub iat: Option<u64>,
    /// Issuer
    pub iss: Option<String>,
}

/// Decode a JWT token and extract its payload.
pub fn decode_jwt(jwt: &str) -> Result<JwtPayload, SessionError> {
    let parts: Vec<&str> = jwt.split('.').collect();
    if parts.len() != 3 {
        return Err(SessionError::InvalidJwt);
    }

    // Decode payload (base64url)
    let payload_bytes = URL_SAFE_NO_PAD.decode(parts[1]).map_err(|_| SessionError::InvalidJwt)?;

    let json: serde_json::Value = serde_json::from_slice(&payload_bytes).map_err(|_| SessionError::InvalidJwt)?;

    let sub = json["sub"].as_str().ok_or(SessionError::InvalidJwt)?.to_string();

    let aud = match &json["aud"] {
        serde_json::Value::Array(arr) => arr.iter().filter_map(|v| v.as_str().map(String::from)).collect(),
        serde_json::Value::String(s) => vec![s.clone()],
        _ => vec![],
    };

    let exp = json["exp"].as_u64();
    let iat = json["iat"].as_u64();
    let iss = json["iss"].as_str().map(String::from);

    Ok(JwtPayload { sub, aud, exp, iat, iss })
}

/// Check if a JWT is valid for a specific audience.
pub fn is_jwt_valid_for_audience(jwt: &str, audience: &str) -> bool {
    decode_jwt(jwt).map(|payload| payload.aud.contains(&audience.to_string())).unwrap_or(false)
}

/// Check if a JWT is a refresh token (has "derive" audience).
pub fn is_refresh_token(jwt: &str) -> bool {
    is_jwt_valid_for_audience(jwt, "derive")
}

/// Generate a spoofed hostname in the format DESKTOP-XXXXXXX.
pub fn get_spoofed_hostname() -> String {
    let hostname = hostname::get().map(|h| h.to_string_lossy().to_string()).unwrap_or_else(|_| "unknown".to_string());

    let mut hasher = Sha1::new();
    hasher.update(hostname.as_bytes());
    let sha1 = hasher.finalize();

    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    let mut output = String::from("DESKTOP-");
    for i in 0..7 {
        output.push(CHARS[(sha1[i] as usize) % CHARS.len()] as char);
    }

    output
}

/// Create a machine ID for Steam Client authentication.
pub fn create_machine_id(account_name: &str) -> Vec<u8> {
    let mut result = Vec::new();

    // MessageObject header
    result.push(0);
    result.extend_from_slice(b"MessageObject\0");

    // BB3 hash
    result.push(1);
    result.extend_from_slice(b"BB3\0");
    result.extend_from_slice(sha1_hex(&format!("SteamUser Hash BB3 {}", account_name)).as_bytes());
    result.push(0);

    // FF2 hash
    result.push(1);
    result.extend_from_slice(b"FF2\0");
    result.extend_from_slice(sha1_hex(&format!("SteamUser Hash FF2 {}", account_name)).as_bytes());
    result.push(0);

    // 3B3 hash
    result.push(1);
    result.extend_from_slice(b"3B3\0");
    result.extend_from_slice(sha1_hex(&format!("SteamUser Hash 3B3 {}", account_name)).as_bytes());
    result.push(0);

    // End markers
    result.push(8);
    result.push(8);

    result
}

fn sha1_hex(input: &str) -> String {
    let mut hasher = Sha1::new();
    hasher.update(input.as_bytes());
    let result = hasher.finalize();
    hex::encode(result)
}

/// Default User-Agent for web requests.
pub fn default_user_agent() -> String {
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_spoofed_hostname() {
        let hostname = get_spoofed_hostname();
        assert!(hostname.starts_with("DESKTOP-"));
        assert_eq!(hostname.len(), 15); // "DESKTOP-" + 7 chars
    }

    #[test]
    fn test_machine_id() {
        let machine_id = create_machine_id("testuser");
        assert!(!machine_id.is_empty());
        assert!(machine_id.starts_with(&[0]));
    }

    #[test]
    fn test_decode_jwt() {
        // This is a fake JWT for testing structure only
        let fake_jwt = "eyJ0eXAiOiJKV1QiLCJhbGciOiJFZERTQSJ9.eyJzdWIiOiI3NjU2MTE5ODAwMDAwMDAwMCIsImF1ZCI6WyJ3ZWIiLCJtb2JpbGUiXX0.fake_signature";
        let result = decode_jwt(fake_jwt);
        assert!(result.is_ok());
        let payload = result.unwrap();
        assert_eq!(payload.sub, "76561198000000000");
        assert!(payload.aud.contains(&"web".to_string()));
    }
}
