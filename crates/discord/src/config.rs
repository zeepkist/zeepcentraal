use anyhow::{Context, Result, ensure};
use std::{net::SocketAddr, str::FromStr};

#[derive(Clone, Debug)]
pub struct DiscordConfig {
    pub bot_token: String,
    pub api_token: String,
    pub backend_url: reqwest::Url,
    pub frontend_url: reqwest::Url,
    pub development_guild_id: Option<u64>,
    pub health_address: SocketAddr,
    pub register_commands: bool,
}

impl DiscordConfig {
    pub fn from_env() -> Result<Self> {
        let host = std::env::var("DISCORD_HOST").unwrap_or_else(|_| "0.0.0.0".to_owned());
        let port = parse_positive::<u16>("DISCORD_PORT", 3_000)?;
        let api_token = zc_core::config::required("DISCORD_BOT_API_TOKEN")?;
        ensure!(
            api_token.len() >= 32,
            "DISCORD_BOT_API_TOKEN must contain at least 32 characters"
        );
        Ok(Self {
            bot_token: zc_core::config::required("DISCORD_BOT_TOKEN")?,
            api_token,
            backend_url: url("DISCORD_BACKEND_URL", "https://backend.zeepki.st")?,
            frontend_url: url("DISCORD_FRONTEND_URL", "https://zeepki.st")?,
            development_guild_id: optional_u64("DISCORD_DEVELOPMENT_GUILD_ID")?,
            health_address: format!("{host}:{port}")
                .parse()
                .context("DISCORD_HOST or DISCORD_PORT is invalid")?,
            register_commands: bool_value("DISCORD_REGISTER_COMMANDS", true)?,
        })
    }
}

fn url(name: &str, default: &str) -> Result<reqwest::Url> {
    std::env::var(name)
        .unwrap_or_else(|_| default.to_owned())
        .parse()
        .with_context(|| format!("{name} must be a URL"))
}

fn optional_u64(name: &str) -> Result<Option<u64>> {
    std::env::var(name)
        .ok()
        .filter(|value| !value.is_empty())
        .map(|value| {
            value
                .parse()
                .with_context(|| format!("{name} must be an integer"))
        })
        .transpose()
}

fn parse_positive<T>(name: &str, default: T) -> Result<T>
where
    T: FromStr + PartialOrd + Copy + std::fmt::Display,
    T::Err: std::error::Error + Send + Sync + 'static,
{
    let value = std::env::var(name)
        .unwrap_or_else(|_| default.to_string())
        .parse::<T>()?;
    ensure!(value > default_from_zero()?, "{name} must be positive");
    Ok(value)
}

fn default_from_zero<T>() -> Result<T>
where
    T: FromStr,
    T::Err: std::error::Error + Send + Sync + 'static,
{
    Ok("0".parse()?)
}

fn bool_value(name: &str, default: bool) -> Result<bool> {
    match std::env::var(name).ok().as_deref() {
        None => Ok(default),
        Some("1" | "true" | "yes" | "on") => Ok(true),
        Some("0" | "false" | "no" | "off") => Ok(false),
        Some(_) => anyhow::bail!("{name} must be a boolean"),
    }
}
