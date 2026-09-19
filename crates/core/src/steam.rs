use anyhow::{Context, Result, bail};
use reqwest::Client;
use serde::Deserialize;

pub const STEAM_VISIBILITY_PUBLIC: i32 = 0;
pub const STEAM_VISIBILITY_FRIENDS_ONLY: i32 = 1;
pub const STEAM_VISIBILITY_HIDDEN: i32 = 2;
pub const STEAM_VISIBILITY_UNLISTED: i32 = 3;

pub const fn can_download_workshop_item(visibility: i32) -> bool {
    matches!(
        visibility,
        STEAM_VISIBILITY_PUBLIC | STEAM_VISIBILITY_UNLISTED
    )
}

#[derive(Clone)]
pub struct SteamClient {
    client: Client,
    api_key: String,
    app_id: u32,
}

#[derive(Debug, Deserialize)]
struct TicketEnvelope {
    response: TicketResponse,
}

#[derive(Debug, Deserialize)]
struct TicketResponse {
    params: Option<TicketParams>,
}

#[derive(Debug, Deserialize)]
struct TicketParams {
    result: String,
    steamid: String,
    ownersteamid: String,
    vacbanned: bool,
    publisherbanned: bool,
}

#[derive(Debug, Deserialize)]
struct PlayersEnvelope {
    response: PlayersResponse,
}

#[derive(Debug, Deserialize)]
struct PlayersResponse {
    players: Vec<SteamUser>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct SteamUser {
    pub personaname: String,
    pub steamid: String,
}

impl SteamClient {
    pub fn new(api_key: String, app_id: u32) -> Result<Self> {
        anyhow::ensure!(!api_key.is_empty(), "Steam API key is not configured");
        anyhow::ensure!(app_id > 0, "Steam app ID must be positive");
        Ok(Self {
            client: Client::builder().build()?,
            api_key,
            app_id,
        })
    }

    pub async fn authenticate_ticket(&self, ticket: &str) -> Result<String> {
        let app_id = self.app_id.to_string();
        let envelope: TicketEnvelope = self
            .client
            .get("https://api.steampowered.com/ISteamUserAuth/AuthenticateUserTicket/v1/")
            .query(&[
                ("key", self.api_key.as_str()),
                ("appid", app_id.as_str()),
                ("ticket", ticket),
            ])
            .send()
            .await
            .context("Steam authentication request failed")?
            .error_for_status()
            .context("Steam authentication request failed")?
            .json()
            .await
            .context("Steam authentication response was invalid")?;
        let params = envelope
            .response
            .params
            .context("Steam API returned an error")?;
        if params.result != "OK" || params.vacbanned || params.publisherbanned {
            bail!("Steam authentication failed");
        }
        if !params.ownersteamid.is_empty() && params.ownersteamid != params.steamid {
            bail!("Steam ownership mismatch");
        }
        Ok(params.steamid)
    }

    pub async fn user(&self, steam_id: &str) -> Result<SteamUser> {
        let envelope: PlayersEnvelope = self
            .client
            .get("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/")
            .query(&[("key", self.api_key.as_str()), ("steamids", steam_id)])
            .send()
            .await
            .context("Steam user request failed")?
            .error_for_status()
            .context("Steam user request failed")?
            .json()
            .await
            .context("Steam user response was invalid")?;
        envelope
            .response
            .players
            .into_iter()
            .next()
            .context("Steam user not found")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn workshop_visibility_matches_steam_contract() {
        assert!(can_download_workshop_item(STEAM_VISIBILITY_PUBLIC));
        assert!(can_download_workshop_item(STEAM_VISIBILITY_UNLISTED));
        assert!(!can_download_workshop_item(STEAM_VISIBILITY_FRIENDS_ONLY));
        assert!(!can_download_workshop_item(STEAM_VISIBILITY_HIDDEN));
    }
}
