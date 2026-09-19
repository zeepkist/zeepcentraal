use anyhow::{Context, Result, ensure};
use std::{sync::Arc, time::Duration};

#[derive(Clone)]
pub struct ServerConfig {
    pub runtime: zc_core::RuntimeConfig,
    pub jwt: zc_core::jwt::JwtIssuer,
    pub steam: Option<zc_core::steam::SteamClient>,
    pub trigger_job_token: Arc<str>,
    pub body_limit: usize,
    pub cors_origins: Vec<String>,
    pub frontend_url: String,
    pub backend_url: String,
    pub trust_proxy: bool,
    pub rate_limits: RateLimits,
    pub turnstile_secret: Arc<str>,
    pub turnstile_hostnames: Vec<String>,
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
        let secret = zc_core::config::required("JWT_SECRET")?;
        let trigger_job_token = zc_core::config::required("TRIGGER_JOB_TOKEN")?;
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
        let steam = std::env::var("STEAM_API_KEY")
            .ok()
            .filter(|value| !value.is_empty())
            .map(|key| {
                let app_id = std::env::var("STEAM_APP_ID")
                    .unwrap_or_else(|_| "1440670".to_owned())
                    .parse()
                    .context("STEAM_APP_ID must be a positive integer")?;
                zc_core::steam::SteamClient::new(key, app_id)
            })
            .transpose()?;
        let frontend_url =
            std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:4000".to_owned());
        let backend_url =
            std::env::var("BACKEND_URL").unwrap_or_else(|_| "http://localhost:3000".to_owned());
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
        Ok(Self {
            runtime,
            jwt,
            steam,
            trigger_job_token: trigger_job_token.into(),
            body_limit,
            cors_origins,
            frontend_url,
            backend_url,
            trust_proxy,
            rate_limits,
            turnstile_secret: turnstile_secret.into(),
            turnstile_hostnames,
        })
    }
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
