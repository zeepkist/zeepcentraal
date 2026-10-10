use anyhow::{Result, ensure};

pub struct Config {
    pub discord_token: String,
    pub twitch_client_id: String,
    pub twitch_client_secret: String,
    pub development_guild_id: Option<u64>,
    pub poll_seconds: u64,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let poll_seconds = zc_core::environment::var("STREAMKIST_POLL_SECONDS")
            .unwrap_or_else(|_| "60".into())
            .parse::<u64>()?;
        ensure!(
            (30..=300).contains(&poll_seconds),
            "STREAMKIST_POLL_SECONDS must be between 30 and 300"
        );
        Ok(Self {
            discord_token: zc_core::config::required("STREAMKIST_DISCORD_TOKEN")?,
            twitch_client_id: zc_core::config::required("TWITCH_CLIENT_ID")?,
            twitch_client_secret: zc_core::config::required("TWITCH_CLIENT_SECRET")?,
            development_guild_id: zc_core::environment::var("STREAMKIST_DEVELOPMENT_GUILD_ID")
                .ok()
                .filter(|s| !s.is_empty())
                .map(|s| s.parse())
                .transpose()?,
            poll_seconds,
        })
    }
}
