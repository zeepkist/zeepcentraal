//! Shared primitives for the migration evaluation. Not yet a replacement for TS core.
pub mod binary;
use anyhow::{bail, Context, Result};
use std::net::{IpAddr, Ipv4Addr, SocketAddr};

pub struct PreviewConfig {
    pub database_url: String,
    pub address: SocketAddr,
    pub pool_max: u32,
    pub postrust_pool_max: u32,
    pub preview_features: bool,
}

/// Evaluation binaries must never silently inherit the production DATABASE_URL.
pub fn validate_preview_database(value: &str) -> Result<()> {
    let url =
        url::Url::parse(value).map_err(|_| anyhow::anyhow!("Invalid preview database URL"))?;
    if !matches!(url.scheme(), "postgres" | "postgresql")
        || !matches!(url.path(), "/zc_rust_sqlx" | "/zc_rust_diesel")
        || !matches!(url.host_str(), Some("127.0.0.1" | "localhost" | "postgres"))
    {
        bail!("Preview requires a local zc_rust_sqlx or zc_rust_diesel database");
    }
    Ok(())
}

impl PreviewConfig {
    pub fn from_env() -> Result<Self> {
        let database_url = std::env::var("ZC_PREVIEW_DATABASE_URL")
            .context("ZC_PREVIEW_DATABASE_URL is required; production DATABASE_URL is ignored")?;
        validate_preview_database(&database_url)?;
        let port = std::env::var("ZC_PREVIEW_PORT")
            .unwrap_or_else(|_| "4310".into())
            .parse()?;
        let pool_max: u32 = std::env::var("ZC_PREVIEW_POOL_MAX")
            .unwrap_or_else(|_| "5".into())
            .parse()?;
        if !(2..=32).contains(&pool_max) {
            bail!("Preview pool limit must be between 2 and 32");
        }
        let postrust_pool_max: u32 = std::env::var("ZC_PREVIEW_POSTRUST_POOL_MAX")
            .unwrap_or_else(|_| pool_max.to_string())
            .parse()?;
        if !(2..=32).contains(&postrust_pool_max) {
            bail!("Postrust pool limit must be between 2 and 32");
        }
        let preview_features = match std::env::var("ZC_PREVIEW_FEATURES").as_deref() {
            Err(std::env::VarError::NotPresent) | Ok("true") => true,
            Ok("false") => false,
            _ => bail!("ZC_PREVIEW_FEATURES must be true or false"),
        };
        Ok(Self {
            database_url,
            address: SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), port),
            pool_max,
            postrust_pool_max,
            preview_features,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_production_and_remote_databases_without_echoing_credentials() {
        for url in [
            "postgres://fake:secret@example.org/zc_rust_sqlx",
            "postgres://fake:secret@localhost/production",
            "invalid",
        ] {
            let error = validate_preview_database(url).unwrap_err().to_string();
            assert!(!error.contains("secret"));
        }
        assert!(validate_preview_database("postgres://fake:fake@localhost/zc_rust_sqlx").is_ok());
    }
}
