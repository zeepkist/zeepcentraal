# steam-client-rs

[![Crates.io](https://img.shields.io/crates/v/steam-client-rs.svg)](https://crates.io/crates/steam-client-rs)
[![Docs.rs](https://docs.rs/steam-client-rs/badge.svg)](https://docs.rs/steam-client-rs)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A comprehensive Steam client library for Rust, providing Individual and Anonymous user account types. This crate handles connection management, authentication, and communication with Steam's CM (Connection Manager) servers via WebSocket.

## Disclaimer

This library facilitates automated interactions with Steam, including game idling, bulk free-license activation, and similar activities that **may violate the [Steam Subscriber Agreement](https://store.steampowered.com/subscriber_agreement/)**. You are solely responsible for understanding Steam's Terms of Service and for using this library in a manner consistent with them. The authors take no responsibility for account restrictions, bans, or other consequences arising from misuse.

This library is provided "as is", without warranty of any kind. It is not affiliated with or endorsed by Valve Corporation.

## Features

- **Multiple Authentication Methods**
  - Refresh token login (persistent sessions)
  - Password login with Steam Guard support (email, TOTP, mobile confirmation)
  - Anonymous login for public data access

- **Connection Management**
  - WebSocket-based connections to Steam CM servers
  - Automatic reconnection with exponential backoff
  - Server load balancing and blacklisting
  - Heartbeat keep-alive
  - **Smart Server Refresh**: Self-healing mechanism that automatically updates the server list every 7 days from WebAPI, ensuring reliable connections even after long periods of inactivity.

- **Friends & Social**
  - Friends list management
  - Persona states (Online, Away, Busy, Offline, etc.)
  - Friend nicknames and levels
  - Friend messages and typing indicators

- **Games & Apps**
  - Set playing status (up to 32 games)
  - Support for Non-Steam games with custom names
  - **Auto-Idler**: Built-in utility for automatic game idling with randomized intervals
  - Rich presence data
  - App info and PICS (Package Info Cache System)
  - License/ownership information
  - Free license requests

- **Economy & Trading**
  - Asset class info
  - Trade URLs
  - Trade restrictions
  - Emoticons and profile items

- **Content Delivery**
  - Content server discovery
  - Depot decryption keys
  - Manifest parsing

- **Advanced Features**
  - Game Coordinator (GC) messaging with request-response pattern
  - Family sharing management
  - Chat rooms and group chats
  - Notification system
  - Two-factor authentication management
  - Gift redemption
  - Store tag metadata and localization
  - App ownership tickets and encrypted app tickets
  - Persona cache with configurable TTL
  - Automatic cache population from events
  - Thread-safe with size limits

- **CS:GO/CS2 Integration**
  - Game Coordinator communication
  - Party search
  - Lobby management (create, join, leave, update)
  - Rich presence / fake score
  - Player profiles

## Installation

```toml
[dependencies]
steam-client-rs = "0.1"
tokio = { version = "1", features = ["full"] }
```

The crate is imported as `steam_client` in your code (the package name is `steam-client-rs` because `steam-client` is taken on crates.io).

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           SteamClient                               │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │  Connection │  │    Jobs     │  │   GC Jobs   │  │ Reconnect  │  │
│  │   Manager   │  │   Manager   │  │   Manager   │  │  Manager   │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                          Cache Layer                                │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                      PersonaCache                            │    │
│  └─────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────┤
│                         Services Layer                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │ Friends │ │  Apps   │ │   CDN   │ │  Chat   │ │  Econ   │        │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌─────────┐       │
│  │ChatRoom │ │ CS:GO   │ │TwoFactor│ │ Account  │ │ Trading │       │
│  └─────────┘ └─────────┘ └─────────┘ └──────────┘ └─────────┘       │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌─────────┐       │
│  │  Gifts  │ │   GC    │ │  Store  │ │  Idler   │ │ PubFiles│       │
│  └─────────┘ └─────────┘ └─────────┘ └──────────┘ └─────────┘       │
└─────────────────────────────────────────────────────────────────────┘
```

## Prior Art / Why This Crate

| Library | Language | Notes |
|---------|----------|-------|
| [`steam-vent`](https://github.com/nickelc/steam-vent) | Rust | Active Rust CM client; lower-level, closer to raw protobufs. Good choice if you need fine-grained control or a production-hardened foundation. |
| [`node-steam-user`](https://github.com/nickalverson/node-steam-user) | JavaScript | The primary API inspiration for this crate. `steam-client-rs` deliberately mirrors its struct names, method names, and event model so that existing `node-steam-user` experience transfers directly. |
| [`SteamKit2`](https://github.com/SteamRE/SteamKit) | C# | The canonical reference implementation that most Steam client libraries (including `node-steam-user`) build on. |

**When to use this crate:** you want a `node-steam-user`-style ergonomic Rust API and are comfortable with an actively-developed but pre-1.0 library. If you need a battle-tested production client today, evaluate `steam-vent` as well.

## Quick Start

### Login with Refresh Token

```rust,no_run
use steam_client::{SteamClient, LogOnDetails, EPersonaState};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut client = SteamClient::new(Default::default());

    let response = client.log_on(LogOnDetails {
        refresh_token: Some("your_refresh_token".to_string()),
        ..Default::default()
    }).await?;

    println!("Logged in as: {}", response.steam_id.steam3());
    println!("Public IP: {:?}", response.public_ip);
    println!("Cell ID: {}", response.cell_id);

    // Set online status
    client.set_persona(EPersonaState::Online, None).await?;

    Ok(())
}
```

### Anonymous Login

```rust,no_run
use steam_client::{SteamClient, LogOnDetails};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut client = SteamClient::new(Default::default());

    // Anonymous login - useful for public data access (app info, player counts, etc.)
    let response = client.log_on(LogOnDetails::anonymous()).await?;
    println!("Connected as anonymous user: {}", response.steam_id.steam3());

    // Anonymous sessions can still query public data
    // but cannot access friend lists, chat, etc.

    Ok(())
}
```

### Password Login with Steam Guard

```rust,no_run
// EAuthSessionGuardType re-exported from the steam_auth crate.
use steam_client::{SteamClient, SteamError};
use steam_auth::EAuthSessionGuardType;

async fn login_with_password() -> Result<(), Box<dyn std::error::Error>> {
    let mut client = SteamClient::new(Default::default());

    match client.log_on_with_password("username", "password", None, None).await {
        Ok(response) => {
            println!("Logged in: {}", response.steam_id.steam3());
        }
        Err(SteamError::SteamGuardRequired { guard_type, email_domain }) => {
            match guard_type {
                EAuthSessionGuardType::KEAuthSessionGuardTypeEmailCode => {
                    println!("Check your email at {}!", email_domain.unwrap_or_default());
                    // Get code from user...
                    let code = "ABC123";
                    let response = client.submit_steam_guard_code(code).await?;
                    println!("Logged in: {}", response.steam_id.steam3());
                }
                EAuthSessionGuardType::KEAuthSessionGuardTypeDeviceCode => {
                    println!("Enter your Steam Mobile Authenticator code:");
                    // Get TOTP code from user or generate with steam-totp...
                    let code = "12345";
                    let response = client.submit_steam_guard_code(code).await?;
                    println!("Logged in: {}", response.steam_id.steam3());
                }
                _ => {
                    println!("Unsupported guard type: {:?}", guard_type);
                }
            }
        }
        Err(e) => return Err(e.into()),
    }

    Ok(())
}
```

### Cookie Login

Logs onto the CM using existing `steamcommunity.com` web session cookies. The
cookies themselves never reach the CM — they are exchanged at
`https://steamcommunity.com/chat/clientjstoken` for a short-lived web logon
token, which (together with the account name and SteamID returned by that
endpoint) authenticates the CM logon.

```rust,no_run
use steam_client::SteamClient;

async fn login_with_cookies() -> Result<(), Box<dyn std::error::Error>> {
    let mut client = SteamClient::new(Default::default());

    // Must contain at least `steamLoginSecure` for the calling account.
    let cookies = "sessionid=...; steamLoginSecure=...";

    let response = client.log_on_with_cookies(cookies).await?;
    println!("Logged in as: {}", response.steam_id.steam3());

    Ok(())
}
```

### Refresh Token Persistence

The most common real-world flow: save the refresh token after first login and reuse it on subsequent runs. `TokenStore` handles serialisation to disk atomically.

```rust,no_run
use steam_client::{SteamClient, SteamEvent, AuthEvent, TokenStore};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut client = SteamClient::new(Default::default());
    let store = TokenStore::new("steam_tokens.json");

    // Attempt to load a previously saved session.
    // Falls back to an anonymous/empty LogOnDetails on first run.
    let details = if let Some(saved) = store.load(None) {
        saved
    } else {
        // First run: log in with a password to obtain a refresh token.
        // The token will arrive as an AuthEvent::RefreshToken event below.
        client.log_on_with_password("myaccount", "mypassword", None, None).await?;
        return Ok(());  // restart the process; token is now saved
    };

    client.log_on(details).await?;

    loop {
        match client.poll_event_timeout(std::time::Duration::from_secs(30)).await? {
            Some(SteamEvent::Auth(AuthEvent::RefreshToken { token, account_name })) => {
                // Persist the new token so the next run skips password login.
                let steam_id = 0u64; // replace with client.steam_id().steam_id64() if available
                store.save(account_name, token, steam_id)?;
            }
            Some(SteamEvent::Auth(AuthEvent::LoggedOff { .. })) => break,
            None => { /* poll timeout — send heartbeat or do periodic work */ }
            _ => {}
        }
    }

    Ok(())
}
```

## Configuration

### SteamOptions

```rust,no_run
// EConnectionProtocol lives in steam_client::options; use Default::default() for
// the common case or construct SteamOptions directly for fine-grained control.
use steam_client::{SteamClient, SteamOptions, ReconnectConfig, HeartbeatOptions};
use std::time::Duration;

fn main() {
    let options = SteamOptions {
        // Web compatibility mode (WebSocket only, port 443)
        web_compatibility_mode: false,

        // HTTP proxy URL
        http_proxy: None,

        // Automatically renew refresh tokens
        renew_refresh_tokens: false,

        // Machine name reported to Steam
        machine_name: Some("MyRustBot".to_string()),

        // Reconnection settings
        reconnect: ReconnectConfig {
            enabled: true,
            max_attempts: 5,
            initial_delay: Duration::from_secs(1),
            max_delay: Duration::from_secs(30),
            backoff_multiplier: 2.0,
        },

        // Heartbeat settings
        heartbeat: HeartbeatOptions {
            enabled: true,
            interval: Duration::from_secs(30),
        },

        ..Default::default()
    };

    let _client = SteamClient::new(options);
}
```

### LogOnDetails

```rust,no_run
use steam_client::LogOnDetails;

fn main() {
    // Refresh token login (recommended)
    let _details = LogOnDetails {
        refresh_token: Some("your_refresh_token".to_string()),
        ..Default::default()
    };

    // Anonymous login
    let _details = LogOnDetails::anonymous();

    // Full login details
    let _details = LogOnDetails {
        anonymous: false,
        refresh_token: Some("token".to_string()),
        account_name: Some("username".to_string()),
        password: Some("password".to_string()),
        auth_code: None,                          // Email Steam Guard code
        two_factor_code: None,                    // TOTP code
        machine_auth_token: None,                 // Machine auth for Steam Guard
        logon_id: Some(12345),                    // Avoid "logged in elsewhere"
        machine_name: Some("MyBot".to_string()),  // Machine name
    };
}
```

## Event System

The client uses a categorized event system for type-safe event handling:

### Event Categories

| Category | Description | Events |
|----------|-------------|--------|
| `Auth` | Authentication | `LoggedOn`, `LoggedOff`, `RefreshToken` |
| `Connection` | Connection lifecycle | `Connected`, `Disconnected`, `ReconnectAttempt`, `ReconnectFailed` |
| `Friends` | Social features | `FriendsList`, `PersonaState`, `FriendRelationship` |
| `Chat` | Messaging | `FriendMessage`, `FriendTyping` |
| `Apps` | Games/licenses | `LicenseList`, `ProductInfoResponse`, `PICSChanges`, `GCReceived` |
| `Content` | Content delivery | `RichPresence` |
| `System` | Debug/errors | `Debug`, `Error` |

### Event Loop

```rust,no_run
use steam_client::{SteamClient, SteamEvent, AuthEvent, FriendsEvent, ChatEvent, ConnectionEvent, AppsEvent};
use std::time::Duration;

async fn event_loop(client: &mut SteamClient) -> Result<(), Box<dyn std::error::Error>> {
    loop {
        match client.poll_event_timeout(Duration::from_secs(30)).await? {
            Some(event) => match event {
                // Authentication events
                SteamEvent::Auth(AuthEvent::LoggedOn { steam_id }) => {
                    println!("✅ Logged in as {}", steam_id.steam3());
                }
                SteamEvent::Auth(AuthEvent::RefreshToken { token, account_name }) => {
                    // Save this token for future logins!
                    println!("💾 New refresh token for {}", account_name);
                    save_token(&account_name, &token);
                }
                SteamEvent::Auth(AuthEvent::LoggedOff { result }) => {
                    println!("👋 Logged off: {:?}", result);
                    break;
                }

                // Friends events
                SteamEvent::Friends(FriendsEvent::FriendsList { friends, .. }) => {
                    println!("👥 Friends list: {} friends", friends.len());
                }
                SteamEvent::Friends(FriendsEvent::PersonaState(persona)) => {
                    println!("👤 {} is {:?}", persona.player_name, persona.persona_state);
                }

                // Chat events
                SteamEvent::Chat(ChatEvent::FriendMessage { sender, message, .. }) => {
                    println!("💬 {}: {}", sender.steam3(), message);
                }
                SteamEvent::Chat(ChatEvent::FriendTyping { sender }) => {
                    println!("✏️ {} is typing...", sender.steam3());
                }

                // Apps events
                SteamEvent::Apps(AppsEvent::LicenseList { licenses }) => {
                    println!("📦 {} licenses owned", licenses.len());
                }

                // Connection events
                SteamEvent::Connection(ConnectionEvent::Disconnected { reason, will_reconnect }) => {
                    println!("🔌 Disconnected: {:?}", reason);
                    if !will_reconnect {
                        break;
                    }
                }
                SteamEvent::Connection(ConnectionEvent::ReconnectAttempt { attempt, max_attempts, delay }) => {
                    println!("🔄 Reconnecting {}/{} (delay: {:?})", attempt, max_attempts, delay);
                }

                _ => {}
            },
            None => {
                // Timeout - no event received
                println!("⏰ Heartbeat");
            }
        }
    }
    Ok(())
}

fn save_token(account: &str, token: &str) {
    // Implement your token storage here
}
```

### Event Helpers

```rust,ignore
// Assumes `event: SteamEvent` is in scope (e.g. from poll_event_timeout).
use steam_client::SteamEvent;

// Check event category
event.is_auth();        // Authentication event?
event.is_connection();  // Connection event?
event.is_friends();     // Friends event?
event.is_chat();        // Chat event?
event.is_apps();        // Apps event?
event.is_content();     // Content event?
event.is_system();      // System event?

// Get chat sender
if let Some(sender) = event.chat_sender() {
    println!("Message from: {}", sender.steam3());
}
```

## Services

### Friends Service

```rust,no_run
use steam_client::{SteamClient, EPersonaState};
use steamid::SteamID;

async fn friends_example(client: &mut SteamClient) -> Result<(), Box<dyn std::error::Error>> {
    // Set your persona state and name
    client.set_persona(EPersonaState::Online, Some("Playing Rust 🦀".to_string())).await?;

    // Get persona info for users
    let steam_ids = vec![SteamID::from_steam_id64(76561198000000000)];
    let personas = client.get_personas(&steam_ids).await?;

    // Add a friend
    let result = client.add_friend(steam_ids[0]).await?;
    println!("Add friend result: {:?}", result);

    // Get friend nicknames
    let nicknames = client.get_nicknames().await?;

    // Set a nickname
    client.set_nickname(steam_ids[0], "My Friend").await?;

    // Get Steam levels
    let levels = client.get_steam_levels(&steam_ids).await?;

    // Remove friend
    client.remove_friend(steam_ids[0]).await?;

    Ok(())
}
```

### Chat Service

```rust,no_run
use steam_client::SteamClient;
use steamid::SteamID;

async fn chat_example(client: &mut SteamClient) -> Result<(), Box<dyn std::error::Error>> {
    let friend = SteamID::from_steam_id64(76561198000000000);

    // Send a message
    let result = client.send_friend_message(friend, "Hello from Rust! 🦀").await?;
    println!("Message sent, timestamp: {:?}", result.modified_timestamp);

    // Send typing indicator
    client.send_friend_typing(friend).await?;

    // Get chat history
    let history = client.get_recent_messages(friend, 50).await?;
    for msg in history {
        println!("[{}] {}: {}", msg.timestamp, msg.sender.steam3(), msg.message);
    }

    // Get active message sessions
    let sessions = client.get_active_message_sessions().await?;

    Ok(())
}
```

### Games Service

```rust,no_run
use steam_client::SteamClient;
use steamid::SteamID;
use std::collections::HashMap;

async fn games_example(client: &mut SteamClient) -> Result<(), Box<dyn std::error::Error>> {
    // Play a single game
    client.games_played(vec![440]).await?;  // TF2

    // Play multiple games (up to 32)
    client.games_played(vec![440, 730, 570]).await?;  // TF2, CS2, Dota 2

    // Stop playing
    client.games_played(vec![]).await?;

    // Set rich presence
    let mut presence = HashMap::new();
    presence.insert("status".to_string(), "In Queue".to_string());
    presence.insert("steam_display".to_string(), "#Status_InGame".to_string());
    client.upload_rich_presence(440, presence).await?;

    // Clear rich presence
    client.clear_rich_presence(440).await?;

    // Get rich presence for other users
    let steam_ids = vec![SteamID::from_steam_id64(76561198000000000)];
    let _presence = client.request_rich_presence(440, &steam_ids).await?;

    Ok(())
}
```

### Idler Service

The `IdlerHandle` provides a way to automatically refresh your playing status at random intervals (15-30 minutes) to avoid bot detection patterns.

```rust,no_run
use steam_client::{SteamClient, IdlerHandle};

async fn idler_example(client: &mut SteamClient) -> Result<(), Box<dyn std::error::Error>> {
    // idle CS:GO (730) and TF2 (440)
    let mut idler = IdlerHandle::new(vec![730, 440]);

    // Set initial Playing status
    client.games_played(idler.app_ids().to_vec()).await?;

    // In your main event loop
    loop {
        tokio::select! {
            _ = idler.tick() => {
                // Time to refresh playing status
                if client.is_logged_in() {
                    println!("Refreshing idler status...");
                    client.games_played(idler.app_ids().to_vec()).await?;
                }
            }
            // ... handle other events ...
        }
    }
}
```

### Apps Service

```rust,no_run
use steam_client::{SteamClient, AppInfoRequest};

async fn apps_example(client: &mut SteamClient) -> Result<(), Box<dyn std::error::Error>> {
    // Get app info (metadata, launch options, etc.)
    let apps = vec![
        AppInfoRequest { appid: 440, access_token: 0 },   // TF2
        AppInfoRequest { appid: 730, access_token: 0 },   // CS2
    ];
    let info = client.request_product_info(&apps, &[]).await?;

    // Get owned apps
    let owned = client.get_owned_apps().await?;
    println!("You own {} apps", owned.len());

    // Get player count for a game
    let count = client.get_player_count(440).await?;
    println!("TF2 has {} players online", count);

    // Get PICS changes since a change number
    let changes = client.get_product_changes(0).await?;

    // Request free licenses (e.g. free-to-play games)
    let app_ids = vec![440, 730]; // TF2, CS2
    let response = client.request_free_license(app_ids).await?;
    println!("Granted apps: {:?}", response.granted_appids);

    // Auto-request free licenses from a list (with filtering and shuffling)
    // Useful for bulk activation of free packages
    let free_apps = vec![440, 730, 570];
    client.auto_request_free_license(free_apps, 10).await?;

    Ok(())
}
```

### Store Service

```rust,no_run
use steam_client::SteamClient;

async fn store_example(client: &mut SteamClient) -> Result<(), Box<dyn std::error::Error>> {
    // Get localized names for store tags
    let tag_ids = vec![19, 21, 122]; // Action, Adventure, RPG
    let tags = client.get_store_tag_names("english", &tag_ids).await?;

    for tag in tags {
        println!("Tag {}: {}", tag.tagid, tag.name);
    }

    Ok(())
}
```

### App Auth Service

```rust,no_run
use steam_client::SteamClient;

async fn auth_ticket_example(client: &mut SteamClient) -> Result<(), Box<dyn std::error::Error>> {
    let app_id = 440; // TF2

    // Get app ownership ticket (for game servers)
    let ticket = client.get_app_ownership_ticket(app_id).await?;
    println!("Got ownership ticket: {} bytes", ticket.len());

    // Create encrypted app ticket (for 3rd party backend validation)
    let encrypted_ticket = client.create_encrypted_app_ticket(app_id, None).await?;
    println!("Got encrypted ticket: {} bytes", encrypted_ticket.len());

    Ok(())
}
```

### CDN Service

```rust,no_run
use steam_client::SteamClient;

// Note: get_manifest requires a ContentServer reference and depot key obtained
// from the preceding calls; the full signature is shown below.
async fn cdn_example(client: &mut SteamClient) -> Result<(), Box<dyn std::error::Error>> {
    let app_id = 440;
    let depot_id = 441;
    let manifest_id: u64 = 1234567890123456789;

    // Get content servers
    let servers = client.get_content_servers(Some(app_id)).await?;
    println!("Found {} content servers", servers.len());

    // Get depot decryption key
    let depot_key = client.get_depot_decryption_key(app_id, depot_id).await?;

    // Get CDN auth token
    let _token = client.get_cdn_auth_token(app_id, depot_id, &servers[0].host).await?;

    // Get manifest (requires a server reference and the depot decryption key)
    let manifest = client.get_manifest(
        app_id,
        depot_id,
        manifest_id,
        Some("public".to_string()), // branch_name
        None,                        // branch_password
        &servers[0],
        &depot_key,
    ).await?;
    println!("Manifest contains {} files", manifest.files.len());

    Ok(())
}
```

### Account Service

```rust,no_run
use steam_client::SteamClient;

async fn account_example(client: &mut SteamClient) -> Result<(), Box<dyn std::error::Error>> {
    // Get account info
    let info = client.get_account_info().await?;
    println!("Account: {}", info.persona_name);

    // Get Steam Guard details
    let guard = client.get_steam_guard_details().await?;
    println!("Steam Guard enabled: {}", guard.is_steamguard_enabled);

    // Get wallet info
    let wallet = client.get_wallet_details().await?;
    println!("Balance: {} {}", wallet.balance, wallet.currency);

    // Get privacy settings
    let privacy = client.get_privacy_settings().await?;

    // Get account limitations (cached)
    let limits = client.get_account_limitations()?;
    println!("Limited account: {}", limits.is_limited);

    // Get VAC bans (cached)
    let vac = client.get_vac_bans()?;
    println!("VAC bans: {} (apps: {:?})", vac.num_bans, vac.app_ids);

    // Get credential change timestamps
    let creds = client.get_credential_change_times().await?;
    println!("Password last changed: {:?}", creds.password_last_changed);

    // Get account auth secret
    let (secret_id, secret) = client.get_auth_secret().await?;
    println!("Auth secret ID: {}", secret_id);

    // Get email info
    let email = client.get_email_info().await?;
    println!("Email: {} (verified: {})", email.email, email.validated);

    Ok(())
}
```

### Two-Factor Service

```rust,no_run
use steam_client::SteamClient;

async fn twofactor_example(client: &mut SteamClient) -> Result<(), Box<dyn std::error::Error>> {
    // Enable 2FA (mobile authenticator)
    let secrets = client.enable_two_factor().await?;
    println!("Shared secret: {}", secrets.shared_secret);
    println!("Revocation code: {}", secrets.revocation_code);
    // IMPORTANT: Save these securely!

    // Finalize with SMS code
    client.finalize_two_factor(&secrets, "123456").await?;

    // Remove 2FA (requires revocation code)
    client.remove_two_factor("R12345").await?;

    Ok(())
}
```

### Game Coordinator Service

```rust,no_run
use steam_client::{SteamClient, GCSendOptions};

async fn gc_example(client: &mut SteamClient) -> Result<(), Box<dyn std::error::Error>> {
    let app_id = 730; // CS2

    // Send a GC message
    let msg_type = 4006; // ClientHello
    let payload = vec![]; // Your protobuf-encoded message

    client.send_gc_message(app_id, msg_type, &payload, GCSendOptions::default()).await?;

    // GC responses come as AppsEvent::GCReceived events in the event loop

    Ok(())
}
```

### CS:GO/CS2 Service

```rust,no_run
use steam_client::{SteamClient, LobbyConfig};
use steam_client::services::csgo::CSGOClient;
use steamid::SteamID;

async fn csgo_example(client: &mut SteamClient) -> Result<(), Box<dyn std::error::Error>> {
    let mut csgo = CSGOClient::new(client);

    // Send hello to GC
    csgo.send_hello().await?;

    // Party search
    let parties = csgo.party_search(true, 0).await?;
    for party in parties {
        println!("Party {} has {} members", party.id, party.members.len());
    }

    // Create a lobby
    let lobby_id = csgo.create_lobby(10, 0).await?;
    println!("Created lobby: {}", lobby_id);

    // Update lobby settings
    let config = LobbyConfig::new()
        .max_members(5)
        .lobby_type(1);
    csgo.update_lobby(lobby_id, &config).await?;

    // Invite a friend
    let friend_id = SteamID::from_steam_id64(76561198000000000);
    csgo.invite_to_lobby(lobby_id, friend_id).await?;

    // Join an existing lobby
    let lobby_info = csgo.join_lobby(lobby_id).await?;
    println!("Lobby owner: {:?}", lobby_info.owner_id);

    // Get lobby data
    let data = csgo.get_lobby_data(lobby_id).await?;
    println!("Members: {:?}", data.members);

    // Leave lobby
    csgo.leave_lobby(lobby_id).await?;

    Ok(())
}
```

### Gift Service

```rust,no_run
use steam_client::SteamClient;

async fn gift_example(client: &SteamClient, cookies: &str) -> Result<(), Box<dyn std::error::Error>> {
    let gift_id = "1234567890";

    // Get gift details before redeeming
    let details = client.get_gift_details(gift_id, cookies).await?;
    println!("Gift: {} for {}", details.gift_name, details.app_name);

    if details.owned {
        println!("Warning: You already own this game!");
    } else {
        // Redeem the gift
        client.redeem_gift(gift_id, cookies).await?;
        println!("Gift redeemed successfully!");
    }

    Ok(())
}
```

### Persona Cache

```rust,no_run
use steam_client::{SteamClient, cache::PersonaCache, cache::PersonaCacheConfig};
use steamid::SteamID;
use std::time::Duration;

async fn cache_example(client: &mut SteamClient) -> Result<(), Box<dyn std::error::Error>> {
    let steam_ids = vec![
        SteamID::from_steam_id64(76561198000000000),
        SteamID::from_steam_id64(76561198000000001),
    ];

    // Get personas with caching (uses internal cache)
    // Only queries Steam for missing/expired entries
    let personas = client.get_personas_cached(steam_ids.clone(), false).await?;
    println!("Got {} personas", personas.len());

    // Force refresh (bypasses cache)
    let personas = client.get_personas_cached(steam_ids, true).await?;

    // Direct cache access for advanced usage
    let config = PersonaCacheConfig {
        ttl: Duration::from_secs(300),    // 5 minute TTL
        max_entries: 1000,
    };
    let cache = PersonaCache::new(config);

    // Bulk lookup
    let (found, missing) = cache.get_many(&steam_ids);
    println!("Found: {}, Missing: {}", found.len(), missing.len());

    // Clear expired entries
    cache.evict_expired();

    Ok(())
}
```

## Error Handling

```rust,no_run
use steam_client::{SteamClient, SteamError, EResult, LogOnDetails};

async fn handle_errors(client: &mut SteamClient) {
    let details = LogOnDetails {
        refresh_token: Some("your_refresh_token".to_string()),
        ..Default::default()
    };
    match client.log_on(details).await {
        Ok(response) => {
            println!("Success!");
        }
        Err(SteamError::SteamResult(result)) => {
            // Steam returned an error code
            match result {
                EResult::InvalidPassword => println!("Wrong password"),
                EResult::AccountDisabled => println!("Account is disabled"),
                EResult::RateLimitExceeded => println!("Too many attempts"),
                _ => println!("Steam error: {:?}", result),
            }
        }
        Err(SteamError::SteamGuardRequired { guard_type, email_domain }) => {
            println!("Need Steam Guard code: {:?}", guard_type);
        }
        Err(SteamError::ConnectionError(msg)) => {
            println!("Connection failed: {}", msg);
        }
        Err(SteamError::Timeout) => {
            println!("Operation timed out");
        }
        Err(SteamError::NotConnected) => {
            println!("Not connected to Steam");
        }
        Err(e) => {
            println!("Other error: {:?}", e);
        }
    }
}
```

## LogOnResponse

After successful login, you receive:

```rust,ignore
pub struct LogOnResponse {
    pub eresult: EResult,           // Result code (OK on success)
    pub steam_id: SteamID,          // Your SteamID
    pub public_ip: Option<String>,  // Your public IP as seen by Steam
    pub cell_id: u32,               // Cell ID for content servers
    pub vanity_url: Option<String>, // Your vanity URL
    pub email_domain: Option<String>, // Email domain hint
    pub steam_guard_required: bool, // Whether Steam Guard is enabled
}
```

## Examples

Run the examples with:

```bash
# Basic bot - login, set status, play game
REFRESH_TOKEN="your_token" cargo run --example basic_bot

# Chat bot - respond to messages
REFRESH_TOKEN="your_token" cargo run --example chat_bot

# Friends list - dump all friends info
REFRESH_TOKEN="your_token" cargo run --example friends_list

# Anonymous login - no credentials needed
cargo run --example anonymous_login

# Password login - interactive with Steam Guard
cargo run --example password_login

# Cookie login - mint a web logon token from steamcommunity.com cookies
STEAM_COOKIES="sessionid=...; steamLoginSecure=..." cargo run --example cookie_login

# Licenses dumper - show owned games/packages
REFRESH_TOKEN="your_token" cargo run --example licenses_dumper

# Rich presence - set custom game status
REFRESH_TOKEN="your_token" cargo run --example rich_presence

# Token dumper - get refresh token from password login
cargo run --example token_dumper
```

## Services Summary

| Service | Module | Key Types |
|---------|--------|-----------|
| Account | `services::account` | `AccountInfo`, `AccountLimitations`, `WalletInfo`, `VacBans`, `PrivacySettings` |
| App Auth | `services::appauth` | `AuthSessionTicket`, `AuthSessionResult` |
| Apps | `services::apps` | `AppInfo`, `PackageInfo`, `OwnedApp` |
| CDN | `services::cdn` | `ContentServer`, `DepotManifest`, `ManifestFile`, `CdnAuthToken` |
| Chat | `services::chat` | `ChatMessage`, `HistoryMessage`, `SendMessageResult` |
| Chat Rooms | `services::chatroom` | `ChatRoom`, `ChatRoomGroup`, `ChatRoomMember`, `ChatRole` |
| CS:GO/CS2 | `services::csgo` | `CSGOClient`, `LobbyConfig`, `LobbyData`, `JoinLobbyResult`, `LobbyMetadata` |
| Economy | `services::econ` | `AssetClass`, `AssetClassInfo`, `TradeUrl`, `Emoticon`, `ProfileItem` |
| Family Sharing | `services::familysharing` | `AuthorizedBorrower`, `AuthorizedDevice` |
| Friends | `services::friends` | `Friend`, `FriendsGroup`, `AddFriendResult` |
| Game Coordinator | `services::gc` | `GCMessage`, `GCProtoHeader`, `GCSendOptions`, `GCJobManager` |
| Game Servers | `services::gameservers` | `GameServer` |
| Gifts | `services::gifts` | `GiftDetails` |
| Idler | `services::idler` | `IdlerService` |
| Notifications | `services::notifications` | `Notification`, `NotificationType` |
| Persona Cache | `cache::persona` | `PersonaCache`, `PersonaCacheConfig`, `CachedPersona` |
| Published Files | `services::pubfiles` | `PublishedFileDetails`, `VoteData` |
| Rich Presence | `services::rich_presence` | `RichPresenceData` |
| Store | `services::store` | `StoreTag` |
| Trading | `services::trading` | `TradeRestrictions` |
| Two-Factor | `services::twofactor` | `TwoFactorSecrets` |

## Related Crates

| Crate | Description |
|-------|-------------|
| [`steamid-rs`](https://crates.io/crates/steamid-rs) | Steam ID parsing and formatting |
| [`steam-enums`](https://crates.io/crates/steam-enums) | Steam protocol enumerations |
| [`steam-protos`](https://crates.io/crates/steam-protos) | Protobuf message definitions |
| [`steam-crypto-rs`](https://crates.io/crates/steam-crypto-rs) | Cryptographic utilities (AES, RSA) |
| [`steam-auth-rs`](https://crates.io/crates/steam-auth-rs) | Authentication session management |
| [`steam-totp-rs`](https://crates.io/crates/steam-totp-rs) | TOTP code generation for Steam Guard |
| [`steam-cm-provider`](https://crates.io/crates/steam-cm-provider) | CM server discovery |
| [`steam-friend-code`](https://crates.io/crates/steam-friend-code) | CS2 friend code encoding/decoding |

## Testing

The crate includes comprehensive testing infrastructure:

```rust,no_run
use steam_client::{SteamClient, SteamClientBuilder, MockClock, MockHttpClient, MockRng};
use std::time::Duration;

fn setup_test_client() {
    // Create client with mock dependencies for testing
    let (client, mocks) = SteamClient::builder()
        .with_options(Default::default())
        .build_with_mocks();

    // Control mocks in tests
    if let Some(clock) = mocks.clock {
        clock.advance(Duration::from_secs(10));
    }
}
```

## License

MIT

## Acknowledgements

This crate's API is deliberately modelled after [**node-steam-user**](https://github.com/nickalverson/node-steam-user) by Nick Alverson — the struct names, method names, and event model are intentional mirrors of that library so that existing JS experience transfers directly to Rust.

The underlying Steam protocol knowledge comes largely from [**SteamKit2**](https://github.com/SteamRE/SteamKit) (SteamRE), the canonical open-source C# reference implementation that the broader Steam ecosystem builds on.

No source code from either project was copied. Credit is given here because the design clearly stands on their shoulders.
