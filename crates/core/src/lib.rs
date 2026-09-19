//! Shared primitives for the migration evaluation. Not yet a replacement for TS core.
pub mod binary;
use anyhow::{bail, Context, Result};
use std::net::{IpAddr, Ipv4Addr, SocketAddr};

pub struct PreviewConfig {
    pub database_url: String,
    pub address: SocketAddr,
    pub pool_max: u32,
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
            .unwrap_or_else(|_| "4".into())
            .parse()?;
        if !(2..=32).contains(&pool_max) {
            bail!("Preview pool limit must be between 2 and 32");
        }
        Ok(Self {
            database_url,
            address: SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), port),
            pool_max,
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
