use crate::submissions::SourceMessage;
use anyhow::{Context, Result, bail, ensure};
use reqwest::{Client, Method, StatusCode, Url, multipart};
use serde::{Deserialize, de::DeserializeOwned};
use std::time::Duration;

const API_ROOT: &str = "https://discord.com/api/v10/";
const PAGE_LIMIT: usize = 1_000;

#[derive(Clone)]
pub struct DiscordRest {
    client: Client,
    token: String,
    api_root: Url,
}

#[derive(Clone, Debug, Deserialize)]
pub struct ForumThread {
    pub guild_id: String,
    pub id: String,
    pub name: String,
    pub parent_id: String,
    pub thread_metadata: ThreadMetadata,
    #[serde(rename = "type")]
    pub channel_type: u8,
}

#[derive(Clone, Debug, Deserialize)]
pub struct ThreadMetadata {
    pub locked: bool,
    pub archived: bool,
    pub archive_timestamp: String,
}

#[derive(Deserialize)]
struct ThreadPage {
    threads: Vec<ForumThread>,
    #[serde(default)]
    has_more: bool,
}

impl DiscordRest {
    pub fn new(token: String) -> Result<Self> {
        Self::with_root(token, Url::parse(API_ROOT)?)
    }

    pub fn with_root(token: String, api_root: Url) -> Result<Self> {
        ensure!(!token.is_empty(), "Inspector Discord token is required");
        Ok(Self {
            client: Client::builder().timeout(Duration::from_secs(30)).build()?,
            token,
            api_root,
        })
    }

    pub async fn request<T: DeserializeOwned>(&self, path: &str, method: Method) -> Result<T> {
        for attempt in 0..5 {
            let response = self
                .client
                .request(method.clone(), self.url(path)?)
                .header("Authorization", format!("Bot {}", self.token))
                .send()
                .await?;
            if response.status() == StatusCode::TOO_MANY_REQUESTS
                || response.status().is_server_error()
            {
                if method == Method::POST && response.status() != StatusCode::TOO_MANY_REQUESTS {
                    bail!("Discord publication outcome uncertain");
                }
                let delay = if response.status() == StatusCode::TOO_MANY_REQUESTS {
                    let retry = response
                        .json::<serde_json::Value>()
                        .await
                        .ok()
                        .and_then(|value| value.get("retry_after")?.as_f64())
                        .unwrap_or(1.0);
                    Duration::from_millis((retry * 1_000.0).clamp(1_000.0, 60_000.0) as u64)
                } else {
                    Duration::from_secs(1 << attempt)
                };
                tokio::time::sleep(delay).await;
                continue;
            }
            ensure!(
                response.status().is_success(),
                "Discord request failed: HTTP {}",
                response.status()
            );
            if response.status() == StatusCode::NO_CONTENT {
                return serde_json::from_value(serde_json::Value::Null)
                    .context("Discord empty response did not match expected type");
            }
            return Ok(response.json().await?);
        }
        bail!("Discord retry limit reached")
    }

    pub async fn messages(&self, thread_id: &str) -> Result<Vec<SourceMessage>> {
        let mut all = Vec::new();
        let mut before = String::new();
        for _ in 0..PAGE_LIMIT {
            let suffix = if before.is_empty() {
                String::new()
            } else {
                format!("&before={before}")
            };
            let messages: Vec<SourceMessage> = self
                .request(
                    &format!("channels/{thread_id}/messages?limit=100{suffix}"),
                    Method::GET,
                )
                .await?;
            if messages.is_empty() {
                return Ok(all);
            }
            let next = messages.last().expect("nonempty messages").id.clone();
            ensure!(next != before, "Discord pagination did not advance");
            before = next;
            all.extend(messages);
        }
        bail!("Discord message page limit reached")
    }

    pub async fn discover(&self, guild_id: &str, forum_id: &str) -> Result<Vec<ForumThread>> {
        let active: ThreadPage = self
            .request(&format!("guilds/{guild_id}/threads/active"), Method::GET)
            .await?;
        let mut threads: Vec<_> = active
            .threads
            .into_iter()
            .filter(|thread| thread.parent_id == forum_id)
            .collect();
        let mut before = String::new();
        for _ in 0..PAGE_LIMIT {
            let suffix = if before.is_empty() {
                String::new()
            } else {
                format!("&before={}", encode_path(&before))
            };
            let archived: ThreadPage = self
                .request(
                    &format!("channels/{forum_id}/threads/archived/public?limit=100{suffix}"),
                    Method::GET,
                )
                .await?;
            threads.extend(archived.threads.iter().cloned());
            if !archived.has_more {
                return Ok(threads);
            }
            let next = archived
                .threads
                .last()
                .map(|thread| thread.thread_metadata.archive_timestamp.clone())
                .context("Discord archive pagination did not advance")?;
            ensure!(next != before, "Discord archive pagination did not advance");
            before = next;
        }
        bail!("Discord archive page limit reached")
    }

    pub async fn reaction(
        &self,
        thread_id: &str,
        message: &SourceMessage,
        valid: Option<bool>,
    ) -> Result<()> {
        for emoji in ["✅", "❌"] {
            let desired = valid.is_some_and(|valid| valid == (emoji == "✅"));
            let current = message
                .reactions
                .iter()
                .any(|reaction| reaction.me && reaction.emoji.name == emoji);
            if desired != current {
                let _: serde_json::Value = self
                    .request(
                        &format!(
                            "channels/{thread_id}/messages/{}/reactions/{}/@me",
                            message.id,
                            encode_path(emoji)
                        ),
                        if desired { Method::PUT } else { Method::DELETE },
                    )
                    .await?;
            }
        }
        Ok(())
    }

    pub async fn post_attachment(
        &self,
        thread_id: &str,
        payload: &serde_json::Value,
        filename: &str,
        contents: &[u8],
    ) -> Result<String> {
        ensure!(
            !filename.is_empty(),
            "Discord attachment filename is required"
        );
        let path = format!("channels/{thread_id}/messages");
        for _attempt in 0..5 {
            let file = multipart::Part::bytes(contents.to_vec())
                .file_name(filename.to_owned())
                .mime_str("application/json")?;
            let form = multipart::Form::new()
                .text("payload_json", serde_json::to_string(payload)?)
                .part("files[0]", file);
            let response = self
                .client
                .post(self.url(&path)?)
                .header("Authorization", format!("Bot {}", self.token))
                .multipart(form)
                .send()
                .await?;
            if response.status() == StatusCode::TOO_MANY_REQUESTS {
                let retry = response
                    .json::<serde_json::Value>()
                    .await
                    .ok()
                    .and_then(|value| value.get("retry_after")?.as_f64())
                    .unwrap_or(1.0);
                tokio::time::sleep(Duration::from_millis(
                    (retry * 1_000.0).clamp(1_000.0, 60_000.0) as u64,
                ))
                .await;
                continue;
            }
            if response.status().is_server_error() {
                bail!("Discord publication outcome uncertain");
            }
            ensure!(
                response.status().is_success(),
                "Discord request failed: HTTP {}",
                response.status()
            );
            let message: CreatedMessage = response.json().await?;
            ensure!(
                !message.id.is_empty(),
                "Discord response omitted message ID"
            );
            return Ok(message.id);
        }
        bail!("Discord retry limit reached after attachment upload")
    }

    pub async fn delete_message(&self, thread_id: &str, message_id: &str) -> Result<()> {
        let _: serde_json::Value = self
            .request(
                &format!("channels/{thread_id}/messages/{message_id}"),
                Method::DELETE,
            )
            .await?;
        Ok(())
    }

    fn url(&self, path: &str) -> Result<Url> {
        Ok(self.api_root.join(path.trim_start_matches('/'))?)
    }
}

#[derive(Deserialize)]
struct CreatedMessage {
    id: String,
}

fn encode_path(value: &str) -> String {
    url::form_urlencoded::byte_serialize(value.as_bytes()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_token_and_encodes_reaction_paths() {
        assert!(DiscordRest::with_root(String::new(), Url::parse(API_ROOT).unwrap()).is_err());
        assert_eq!(encode_path("✅"), "%E2%9C%85");
    }
}
