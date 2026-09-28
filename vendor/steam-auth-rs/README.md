# steam-auth-rs

[![Crates.io](https://img.shields.io/crates/v/steam-auth-rs.svg)](https://crates.io/crates/steam-auth-rs)
[![Docs.rs](https://docs.rs/steam-auth-rs/badge.svg)](https://docs.rs/steam-auth-rs)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Steam authentication and session management for Rust.

This crate provides a complete implementation for authenticating with Steam, supporting multiple login methods including password-based authentication, QR code login, and session resumption via refresh tokens.

## Overview

| Feature | Description |
|---------|-------------|
| Password Login | Credential-based authentication with RSA encryption |
| QR Code Login | Scan QR code to authenticate from mobile app |
| Steam Guard | Email and TOTP (Authenticator) code support |
| Machine Auth | Bypass email codes on trusted devices |
| Token Management | Access token refresh and renewal |
| Web Cookies | Generate browser session cookies |
| Login Approver | Approve/deny QR logins from another device |

## Installation

```toml
[dependencies]
steam-auth-rs = "0.1"
tokio = { version = "1", features = ["full"] }
```

The crate is imported as `steam_auth` in your code (the package name is `steam-auth-rs` because `steam-auth` is taken on crates.io).

## Usage

### Password Login

```rust
use steam_auth::{LoginSession, CredentialsDetails, EAuthTokenPlatformType};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create a new login session
    let mut session = LoginSession::new(EAuthTokenPlatformType::SteamClient, None)?;

    // Start login with credentials
    let response = session.start_with_credentials(CredentialsDetails {
        account_name: "username".to_string(),
        password: "password".to_string(),
        steam_guard_code: None,
        steam_guard_machine_token: None,
    }).await?;

    // Check if Steam Guard is required
    if response.action_required {
        println!("Steam Guard code required!");
        // Get code from user...
        session.submit_steam_guard_code("ABC123").await?;
    }

    // Poll for completion
    let result = session.poll().await?;

    println!("Logged in! SteamID: {:?}", session.steam_id());
    println!("Refresh Token: {:?}", session.refresh_token());

    Ok(())
}
```

### QR Code Login

```rust
use steam_auth::{LoginSession, EAuthTokenPlatformType};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut session = LoginSession::new(EAuthTokenPlatformType::SteamClient, None)?;

    // Start QR login
    let response = session.start_with_qr().await?;

    println!("Scan this URL with Steam mobile app:");
    println!("{}", response.qr_challenge_url.unwrap());

    // Poll until user scans QR
    loop {
        match session.poll().await {
            Ok(result) => {
                println!("Login successful!");
                println!("Refresh Token: {:?}", session.refresh_token());
                break;
            }
            Err(e) => {
                // Check remote interaction
                if session.had_remote_interaction().await {
                    println!("QR scanned, waiting for approval...");
                }
                tokio::time::sleep(session.poll_interval()).await;
            }
        }
    }

    Ok(())
}
```

### Resume Session with Refresh Token

```rust
use steam_auth::{LoginSession, EAuthTokenPlatformType};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let refresh_token = "your_saved_refresh_token";

    // Create session from refresh token
    let mut session = LoginSession::from_refresh_token(
        EAuthTokenPlatformType::SteamClient,
        refresh_token,
        None,
    )?;

    // Refresh access token
    session.refresh_access_token().await?;

    println!("Access Token: {:?}", session.access_token());

    Ok(())
}
```

### Get Web Cookies

```rust
use steam_auth::{LoginSession, EAuthTokenPlatformType};

async fn get_cookies(session: &mut LoginSession) -> Result<(), Box<dyn std::error::Error>> {
    // After successful authentication...
    let cookies = session.get_web_cookies().await?;

    for cookie in cookies {
        println!("Cookie: {}", cookie);
    }

    Ok(())
}
```

### Approve QR Login (Mobile Simulation)

```rust
use steam_auth::{LoginApprover, ApproverOptions, ESessionPersistence};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let access_token = "your_access_token";
    let shared_secret = "your_authenticator_shared_secret";

    let approver = LoginApprover::new(
        access_token,
        shared_secret,
        ApproverOptions::default(),
    )?;

    // QR URL from another device
    let qr_url = "https://s.team/q/1/1234567890";

    // Get session info
    let info = approver.get_auth_session_info(qr_url).await?;
    println!("Login from: {} ({})", info.ip, info.city);

    // Approve the login
    approver.approve_auth_session(qr_url, true, ESessionPersistence::Persistent).await?;

    Ok(())
}
```

## API Reference

### Core Types

| Type | Description |
|------|-------------|
| `LoginSession` | Main session manager for authentication flows |
| `LoginApprover` | Approve/deny QR login requests from another device |
| `AuthenticationClient` | Low-level Steam authentication API client |
| `SessionError` | Comprehensive error type for all operations |

### LoginSession Methods

| Method | Description |
|--------|-------------|
| `new(platform, options)` | Create session for specified platform |
| `from_refresh_token(platform, token, options)` | Resume session from refresh token |
| `steam_id()` | Get authenticated SteamID |
| `account_name()` | Get account name |
| `access_token()` | Get current access token |
| `refresh_token()` | Get current refresh token |
| `start_with_credentials(details)` | Start password login |
| `start_with_qr()` | Start QR code login |
| `submit_steam_guard_code(code)` | Submit Steam Guard code |
| `poll()` | Poll for authentication completion |
| `poll_interval()` | Get recommended poll interval |
| `refresh_access_token()` | Refresh expired access token |
| `renew_refresh_token()` | Renew refresh token |
| `get_web_cookies()` | Get web session cookies |
| `cancel_login_attempt()` | Cancel ongoing login |
| `force_poll()` | Force immediate poll |
| `had_remote_interaction()` | Check if QR was scanned |

### Configuration Types

| Type | Description |
|------|-------------|
| `LoginSessionOptions` | Session config (user_agent, machine_id) |
| `CredentialsDetails` | Login credentials with optional Steam Guard |
| `ApproverOptions` | Approver config (machine_id, device_name) |

### Response Types

| Type | Description |
|------|-------------|
| `StartSessionResponse` | Start response with required actions and QR URL |
| `ValidAction` | Required action type with details |
| `PollResult` | Successful auth with tokens |
| `AuthSessionInfo` | QR session info (IP, location, device) |

### Error Variants

| Variant | Description |
|---------|-------------|
| `InvalidCredentials` | Wrong username/password |
| `SteamGuardRequired` | Email code needed |
| `TwoFactorRequired` | TOTP code needed |
| `InvalidSteamGuardCode` | Wrong email code |
| `InvalidTwoFactorCode` | Wrong TOTP code |
| `RateLimited` | Too many attempts |
| `SessionExpired` | Session no longer valid |
| `Timeout` | Login timed out |
| `InvalidState` | Invalid operation for current state |
| `NetworkError(String)` | Connection issues |
| `TokenError(String)` | Token validation failed |

## Platform Types

Steam supports different authentication platforms:

| Platform | Transport | Use Case |
|----------|-----------|----------|
| `SteamClient` | WebSocket CM | Desktop Steam client simulation |
| `WebBrowser` | HTTP WebAPI | Browser-based authentication |
| `MobileApp` | HTTP WebAPI | Mobile app simulation |

## Transport Layer

The crate supports two transport mechanisms:

| Transport | Description |
|-----------|-------------|
| `WebApiTransport` | HTTP-based transport for `api.steampowered.com` |
| `WebSocketCMTransport` | Binary WebSocket for direct CM server communication |

## Helper Functions

| Function | Description |
|----------|-------------|
| `decode_jwt(jwt)` | Decode JWT payload (no signature validation) |
| `is_jwt_valid_for_audience(jwt, audience)` | Check JWT audience |
| `is_refresh_token(jwt)` | Check if JWT is a refresh token |

## Dependencies

| Crate | Purpose |
|-------|---------|
| `reqwest` | HTTP client for WebAPI |
| `tokio-tungstenite` | WebSocket client for CM servers |
| `rsa` | RSA password encryption |
| `prost` | Protobuf serialization |
| `hmac`, `sha2` | HMAC-SHA256 for mobile confirmation |
| `base64` | Base64 encoding/decoding |

## Source

This crate is a Rust port of [node-steam-session](https://github.com/DoctorMcKay/node-steam-session).

## License

MIT
