use anyhow::{Context, Result, bail, ensure};
use serde::{Deserialize, Serialize};
use std::{net::SocketAddr, str::FromStr, time::Duration};

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Environment {
    Development,
    Test,
    Production,
}

impl FromStr for Environment {
    type Err = anyhow::Error;

    fn from_str(value: &str) -> Result<Self> {
        match value {
            "development" => Ok(Self::Development),
            "test" => Ok(Self::Test),
            "production" => Ok(Self::Production),
            _ => bail!("NODE_ENV must be development, test, or production"),
        }
    }
}

#[derive(Clone, Debug)]
pub struct DatabaseConfig {
    pub url: String,
    pub pool_max: u32,
    pub connect_timeout: Duration,
}

impl DatabaseConfig {
    pub fn from_env(default_pool_max: u32) -> Result<Self> {
        let url = required("DATABASE_URL")?;
        let parsed = url::Url::parse(&url).context("DATABASE_URL is invalid")?;
        ensure!(
            matches!(parsed.scheme(), "postgres" | "postgresql"),
            "DATABASE_URL must use PostgreSQL"
        );
        Ok(Self {
            url,
            pool_max: positive_u32("DATABASE_POOL_MAX", default_pool_max)?,
            connect_timeout: Duration::from_millis(positive_u64(
                "DATABASE_CONNECT_TIMEOUT_MS",
                5_000,
            )?),
        })
    }
}

#[derive(Clone, Debug)]
pub struct RuntimeConfig {
    pub environment: Environment,
    pub address: SocketAddr,
    pub database: DatabaseConfig,
}

impl RuntimeConfig {
    pub fn from_env(default_pool_max: u32) -> Result<Self> {
        let environment = std::env::var("NODE_ENV")
            .unwrap_or_else(|_| "development".to_owned())
            .parse()?;
        let host = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_owned());
        let port = positive_u32("PORT", 3_000)?;
        ensure!(port <= u16::MAX.into(), "PORT exceeds 65535");
        Ok(Self {
            environment,
            address: format!("{host}:{port}")
                .parse()
                .context("HOST or PORT is invalid")?,
            database: DatabaseConfig::from_env(default_pool_max)?,
        })
    }
}

pub fn required(name: &str) -> Result<String> {
    std::env::var(name)
        .ok()
        .filter(|value| !value.is_empty())
        .with_context(|| format!("{name} is required"))
}

pub fn parse_duration(value: &str) -> Result<Duration> {
    let split = value
        .find(|character: char| !character.is_ascii_digit())
        .unwrap_or(value.len());
    let (number, unit) = value.split_at(split);
    ensure!(!number.is_empty(), "Invalid duration: {value}");
    let amount: u64 = number
        .parse()
        .with_context(|| format!("Invalid duration: {value}"))?;
    let millis = match unit {
        "" | "ms" => Some(amount),
        "s" => amount.checked_mul(1_000),
        "m" => amount.checked_mul(60_000),
        "h" => amount.checked_mul(3_600_000),
        "d" => amount.checked_mul(86_400_000),
        _ => None,
    }
    .with_context(|| format!("Invalid duration: {value}"))?;
    Ok(Duration::from_millis(millis))
}

pub fn require_strong_production_secrets(
    environment: Environment,
    jwt_secret: &str,
    trigger_job_token: &str,
) -> Result<()> {
    if environment != Environment::Production {
        return Ok(());
    }
    ensure!(
        trigger_job_token.len() >= 32
            && !matches!(
                trigger_job_token,
                "replace-me" | "trigger-token" | "job-secret"
            ),
        "TRIGGER_JOB_TOKEN must contain at least 32 non-placeholder characters"
    );
    ensure!(
        !matches!(jwt_secret, "replace-me" | "trigger-token" | "job-secret"),
        "JWT_SECRET must not use a placeholder value"
    );
    Ok(())
}

fn positive_u32(name: &str, default: u32) -> Result<u32> {
    let value = std::env::var(name)
        .unwrap_or_else(|_| default.to_string())
        .parse()
        .with_context(|| format!("{name} must be an integer"))?;
    ensure!(value > 0, "{name} must be positive");
    Ok(value)
}

fn positive_u64(name: &str, default: u64) -> Result<u64> {
    let value = std::env::var(name)
        .unwrap_or_else(|_| default.to_string())
        .parse()
        .with_context(|| format!("{name} must be an integer"))?;
    ensure!(value > 0, "{name} must be positive");
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn environment_is_strict() {
        assert_eq!(
            "production".parse::<Environment>().unwrap(),
            Environment::Production
        );
        assert!("prod".parse::<Environment>().is_err());
    }

    #[test]
    fn duration_contract_matches_typescript() {
        assert_eq!(parse_duration("15m").unwrap(), Duration::from_secs(900));
        assert_eq!(parse_duration("250").unwrap(), Duration::from_millis(250));
        assert!(parse_duration("1.5s").is_err());
    }

    #[test]
    fn production_rejects_placeholder_secrets() {
        assert!(
            require_strong_production_secrets(
                Environment::Production,
                "replace-me",
                &"x".repeat(32)
            )
            .is_err()
        );
        assert!(
            require_strong_production_secrets(Environment::Development, "replace-me", "short")
                .is_ok()
        );
    }
}
