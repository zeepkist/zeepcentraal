use anyhow::{Context, Result, bail};
use reqwest::{Client, Method, Url};
use serde::{Deserialize, de::DeserializeOwned};
use serde_json::{Value, json};

#[derive(Clone)]
pub struct Backend {
    client: Client,
    base_url: Url,
    api_token: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserState {
    pub linked_user: Option<Value>,
    pub preference: Option<Value>,
    #[serde(default)]
    pub watches: Vec<Watch>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Watch {
    pub id: String,
    pub kind: String,
    pub target_id: String,
    pub paused: bool,
}

impl Backend {
    pub fn new(base_url: Url, api_token: String) -> Result<Self> {
        Ok(Self {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()?,
            base_url,
            api_token,
        })
    }

    async fn request<T: DeserializeOwned>(
        &self,
        method: Method,
        path: &str,
        body: Option<Value>,
    ) -> Result<T> {
        let url = self
            .base_url
            .join(path)
            .context("Invalid Discord backend path")?;
        let mut request = self
            .client
            .request(method.clone(), url)
            .bearer_auth(&self.api_token);
        if let Some(body) = body {
            request = request.json(&body);
        }
        let response = request
            .send()
            .await
            .context("Discord backend unavailable")?;
        let status = response.status();
        if !status.is_success() {
            let detail = response.text().await.unwrap_or_default();
            bail!(
                "Discord backend {method} {path} returned {status}: {}",
                detail.chars().take(300).collect::<String>()
            );
        }
        response
            .json()
            .await
            .context("Discord backend returned invalid JSON")
    }

    pub async fn ready(&self) -> Result<()> {
        let response = self
            .client
            .get(self.base_url.join("/healthz")?)
            .send()
            .await?;
        anyhow::ensure!(
            response.status().is_success(),
            "backend health returned {}",
            response.status()
        );
        Ok(())
    }

    pub async fn user(&self, discord_id: u64) -> Result<UserState> {
        self.request(
            Method::GET,
            &format!("/discord-bot/users/{discord_id}"),
            None,
        )
        .await
    }

    pub async fn guild(&self, guild_id: u64) -> Result<Value> {
        self.request(
            Method::GET,
            &format!("/discord-bot/guilds/{guild_id}"),
            None,
        )
        .await
    }

    pub async fn redeem(&self, code: &str, discord_id: u64) -> Result<Value> {
        self.request(
            Method::POST,
            "/discord-bot/link/redeem",
            Some(json!({"code":code,"discordId":discord_id.to_string()})),
        )
        .await
    }

    pub async fn unlink(&self, discord_id: u64) -> Result<Value> {
        self.request(
            Method::DELETE,
            &format!("/discord-bot/users/{discord_id}/link"),
            None,
        )
        .await
    }

    pub async fn preference(&self, discord_id: u64, enabled: bool) -> Result<Value> {
        self.request(
            Method::PATCH,
            &format!("/discord-bot/users/{discord_id}/preferences"),
            Some(json!({"pingOnWorldRecordLoss":enabled})),
        )
        .await
    }

    pub async fn set_feed(
        &self,
        guild_id: u64,
        kind: &str,
        channel_id: u64,
        enabled: bool,
    ) -> Result<Value> {
        self.request(
            Method::PUT,
            &format!("/discord-bot/guilds/{guild_id}/feeds/{kind}"),
            Some(json!({"channelId":channel_id.to_string(),"enabled":enabled})),
        )
        .await
    }

    pub async fn add_watch(&self, discord_id: u64, kind: &str, target_id: &str) -> Result<Value> {
        self.request(
            Method::POST,
            &format!("/discord-bot/users/{discord_id}/watches"),
            Some(json!({"kind":kind,"targetId":target_id})),
        )
        .await
    }

    pub async fn remove_watch(&self, discord_id: u64, watch_id: &str) -> Result<Value> {
        self.request(
            Method::DELETE,
            &format!("/discord-bot/users/{discord_id}/watches/{watch_id}"),
            None,
        )
        .await
    }
}
