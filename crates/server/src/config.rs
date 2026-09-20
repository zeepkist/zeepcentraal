use anyhow::{Context, Result, ensure};
use std::{net::SocketAddr, path::PathBuf, sync::Arc, time::Duration};

#[derive(Clone)]
pub struct ServerConfig {
    pub runtime: zc_core::RuntimeConfig,
    pub object_storage: zc_core::config::ObjectStorageConfig,
    pub jwt: zc_core::jwt::JwtIssuer,
    pub steam: Option<zc_core::steam::SteamClient>,
    pub trigger_job_token: Arc<str>,
    pub discord_bot_api_token: Arc<str>,
    pub discord_client_id: Option<String>,
    pub discord_client_secret: Option<String>,
    pub discord_redirect_uri: Option<String>,
    pub body_limit: usize,
    pub cors_origins: Vec<String>,
    pub frontend_url: String,
    pub backend_url: String,
    pub trust_proxy: bool,
    pub rate_limits: RateLimits,
    pub turnstile_secret: Arc<str>,
    pub turnstile_hostnames: Vec<String>,
    pub lobby: LobbyRuntimeConfig,
}

#[derive(Clone)]
pub struct LobbyRuntimeConfig {
    pub enabled: bool,
    pub app_id: u32,
    pub master: Option<SocketAddr>,
    pub build: Option<i32>,
    pub refresh_token_file: PathBuf,
    pub broker: Option<RoomBrokerConfig>,
}

#[derive(Clone)]
pub struct RoomBrokerConfig {
    pub address: SocketAddr,
    pub token: Arc<str>,
}

#[derive(Clone, Copy)]
pub struct RateLimits {
    pub auth: u32,
    pub record: u32,
    pub mutation: u32,
    pub job: u32,
}

impl ServerConfig {
    pub fn from_env() -> Result<Self> {
        let runtime = zc_core::RuntimeConfig::from_env(5)?;
        let object_storage = zc_core::config::ObjectStorageConfig::from_env()?;
        let secret = zc_core::config::required("JWT_SECRET")?;
        let trigger_job_token = zc_core::config::required("TRIGGER_JOB_TOKEN")?;
        let discord_bot_api_token = zc_core::config::required("DISCORD_BOT_API_TOKEN")?;
        ensure!(
            discord_bot_api_token.len() >= 32,
            "DISCORD_BOT_API_TOKEN must contain at least 32 characters"
        );
        zc_core::config::require_strong_production_secrets(
            runtime.environment,
            &secret,
            &trigger_job_token,
        )?;
        let access_ttl = duration("JWT_ACCESS_TTL", "15m")?;
        let refresh_ttl = duration("JWT_REFRESH_TTL", "7d")?;
        let jwt = zc_core::jwt::JwtIssuer::new(
            secret,
            std::env::var("JWT_AUDIENCE").unwrap_or_else(|_| "zeepki.st".to_owned()),
            std::env::var("JWT_ISSUER").unwrap_or_else(|_| "https://zeepki.st".to_owned()),
            access_ttl,
            refresh_ttl,
        )?;
        let steam_app_id: u32 = std::env::var("STEAM_APP_ID")
            .unwrap_or_else(|_| "1440670".to_owned())
            .parse()
            .context("STEAM_APP_ID must be a positive integer")?;
        ensure!(steam_app_id > 0, "STEAM_APP_ID must be a positive integer");
        let steam = std::env::var("STEAM_API_KEY")
            .ok()
            .filter(|value| !value.is_empty())
            .map(|key| zc_core::steam::SteamClient::new(key, steam_app_id))
            .transpose()?;
        let frontend_url =
            std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:4000".to_owned());
        let backend_url =
            std::env::var("BACKEND_URL").unwrap_or_else(|_| "http://localhost:3000".to_owned());
        url::Url::parse(&frontend_url).context("FRONTEND_URL must be a URL")?;
        url::Url::parse(&backend_url).context("BACKEND_URL must be a URL")?;
        let cors_origins: Vec<String> = std::env::var("CORS_ALLOWED_ORIGINS")
            .unwrap_or_else(|_| frontend_url.clone())
            .split(',')
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_owned)
            .collect();
        let body_limit = std::env::var("SERVER_MAX_REQUEST_BODY_SIZE")
            .unwrap_or_else(|_| (32 * 1024 * 1024).to_string())
            .parse()
            .context("SERVER_MAX_REQUEST_BODY_SIZE must be an integer")?;
        ensure!(
            body_limit > 0,
            "SERVER_MAX_REQUEST_BODY_SIZE must be positive"
        );
        let trust_proxy = boolean("TRUST_PROXY", false)?;
        let rate_limits = RateLimits {
            auth: positive("RATE_LIMIT_AUTH_PER_MINUTE", 60)?,
            record: positive("RATE_LIMIT_RECORD_PER_MINUTE", 120)?,
            mutation: positive("RATE_LIMIT_MUTATION_PER_MINUTE", 300)?,
            job: positive("RATE_LIMIT_JOB_PER_MINUTE", 60)?,
        };
        let turnstile_secret = zc_core::config::required("TURNSTILE_SECRET_KEY")?;
        let turnstile_hostnames = cors_origins
            .iter()
            .filter_map(|origin| url::Url::parse(origin).ok())
            .filter_map(|origin| origin.host_str().map(str::to_lowercase))
            .collect();
        let lobby_enabled = boolean("ZEEPKIST_LOBBY_ENABLED", false)?;
        let lobby_master = match (
            optional("ZEEPKIST_LOBBY_HOST"),
            optional("ZEEPKIST_LOBBY_PORT"),
        ) {
            (Some(host), Some(port)) => Some(
                format!("{host}:{port}")
                    .parse()
                    .context("ZEEPKIST_LOBBY_HOST or ZEEPKIST_LOBBY_PORT is invalid")?,
            ),
            (None, None) if !lobby_enabled => None,
            _ => anyhow::bail!(
                "ZEEPKIST_LOBBY_HOST and ZEEPKIST_LOBBY_PORT are required when lobby feed is enabled"
            ),
        };
        let lobby_build = optional("ZEEPKIST_LOBBY_BUILD")
            .map(|value| {
                value
                    .parse::<i32>()
                    .context("ZEEPKIST_LOBBY_BUILD must be positive")
            })
            .transpose()?;
        if lobby_enabled {
            ensure!(
                lobby_build.is_some_and(|value| value > 0),
                "ZEEPKIST_LOBBY_BUILD is required when lobby feed is enabled"
            );
        }
        let broker_enabled = boolean("ZEEPKIST_ROOM_BROKER_ENABLED", false)?;
        ensure!(
            !broker_enabled || lobby_enabled,
            "ZEEPKIST_LOBBY_ENABLED is required when room broker is enabled"
        );
        let broker = if broker_enabled {
            let token = zc_core::config::required("ZEEPKIST_ROOM_BROKER_TOKEN")?;
            ensure!(
                token.len() >= 32,
                "ZEEPKIST_ROOM_BROKER_TOKEN must contain at least 32 characters"
            );
            let host =
                std::env::var("ZEEPKIST_ROOM_BROKER_HOST").unwrap_or_else(|_| "0.0.0.0".to_owned());
            let port =
                std::env::var("ZEEPKIST_ROOM_BROKER_PORT").unwrap_or_else(|_| "3001".to_owned());
            Some(RoomBrokerConfig {
                address: format!("{host}:{port}")
                    .parse()
                    .context("ZEEPKIST_ROOM_BROKER_HOST or ZEEPKIST_ROOM_BROKER_PORT is invalid")?,
                token: token.into(),
            })
        } else {
            None
        };
        Ok(Self {
            runtime,
            object_storage,
            jwt,
            steam,
            trigger_job_token: trigger_job_token.into(),
            discord_bot_api_token: discord_bot_api_token.into(),
            discord_client_id: optional("DISCORD_CLIENT_ID"),
            discord_client_secret: optional("DISCORD_CLIENT_SECRET"),
            discord_redirect_uri: optional("DISCORD_REDIRECT_URI"),
            body_limit,
            cors_origins,
            frontend_url,
            backend_url,
            trust_proxy,
            rate_limits,
            turnstile_secret: turnstile_secret.into(),
            turnstile_hostnames,
            lobby: LobbyRuntimeConfig {
                enabled: lobby_enabled,
                app_id: steam_app_id,
                master: lobby_master,
                build: lobby_build,
                refresh_token_file: optional("ZEEPKIST_STEAM_REFRESH_TOKEN_FILE")
                    .unwrap_or_default()
                    .into(),
                broker,
            },
        })
    }
}

fn optional(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|value| !value.is_empty())
}

fn positive(name: &str, default: u32) -> Result<u32> {
    let value = std::env::var(name)
        .unwrap_or_else(|_| default.to_string())
        .parse()
        .with_context(|| format!("{name} must be a positive integer"))?;
    ensure!(value > 0, "{name} must be a positive integer");
    Ok(value)
}

fn boolean(name: &str, default: bool) -> Result<bool> {
    match std::env::var(name) {
        Ok(value) if matches!(value.as_str(), "true" | "1") => Ok(true),
        Ok(value) if matches!(value.as_str(), "false" | "0") => Ok(false),
        Ok(_) => anyhow::bail!("{name} must be true or false"),
        Err(std::env::VarError::NotPresent) => Ok(default),
        Err(error) => Err(error.into()),
    }
}

fn duration(name: &str, default: &str) -> Result<Duration> {
    zc_core::config::parse_duration(&std::env::var(name).unwrap_or_else(|_| default.to_owned()))
}
