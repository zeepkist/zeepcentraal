use anyhow::{Result, ensure};
use reqwest::{Client, Method, StatusCode, Url};
use serde_json::Value;
use std::time::Duration;
#[derive(Clone)]
pub struct DiscordRest {
    client: Client,
    token: String,
    api_root: Url,
}
#[derive(Debug, thiserror::Error)]
#[error("Discord HTTP {status}")]
pub struct DeliveryError {
    pub status: u16,
    pub retry_after: i64,
}
impl DiscordRest {
    pub fn new(token: String) -> Result<Self> {
        Self::with_root(token, Url::parse("https://discord.com/api/v10/")?)
    }
    pub fn with_root(token: String, api_root: Url) -> Result<Self> {
        ensure!(!token.is_empty(), "Inspector Discord token is required");
        Ok(Self {
            client: Client::builder().timeout(Duration::from_secs(30)).build()?,
            token,
            api_root,
        })
    }
    pub async fn request(
        &self,
        path: &str,
        method: Method,
        payload: Option<&Value>,
    ) -> Result<Value> {
        let mut request = self
            .client
            .request(method, self.api_root.join(path)?)
            .header("Authorization", format!("Bot {}", self.token));
        if let Some(payload) = payload {
            request = request.json(payload)
        }
        let response = request.send().await?;
        let status = response.status();
        if !status.is_success() {
            let retry_after = if status == StatusCode::TOO_MANY_REQUESTS {
                response
                    .json::<Value>()
                    .await
                    .ok()
                    .and_then(|r| r["retry_after"].as_f64())
                    .unwrap_or(60.0)
                    .ceil() as i64
            } else {
                60
            };
            return Err(DeliveryError {
                status: status.as_u16(),
                retry_after,
            }
            .into());
        }
        if status == StatusCode::NO_CONTENT {
            return Ok(Value::Null);
        }
        Ok(response.json().await?)
    }
    // Bounded history recovery supplements nonce deduplication after uncertain POSTs.
    pub async fn recover_message(&self, channel: &str, marker: &str) -> Result<Option<String>> {
        let bot = self.request("users/@me", Method::GET, None).await?;
        let bot_id = bot["id"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Discord bot ID missing"))?;
        let mut before = String::new();
        for _ in 0..10 {
            let suffix = if before.is_empty() {
                String::new()
            } else {
                format!("&before={before}")
            };
            let page = self
                .request(
                    &format!("channels/{channel}/messages?limit=100{suffix}"),
                    Method::GET,
                    None,
                )
                .await?;
            let messages = page
                .as_array()
                .ok_or_else(|| anyhow::anyhow!("Invalid Discord history"))?;
            for message in messages {
                if matches_submission_message(message, bot_id, marker) {
                    return Ok(message["id"].as_str().map(str::to_owned));
                }
            }
            if messages.len() < 100 {
                return Ok(None);
            }
            before = messages
                .last()
                .and_then(|m| m["id"].as_str())
                .unwrap_or_default()
                .to_owned();
            ensure!(!before.is_empty(), "Invalid Discord history cursor");
        }
        // Do not create a duplicate when marker may exist beyond bounded history.
        anyhow::bail!("Notification recovery exceeded channel history bound")
    }
}

fn matches_submission_message(message: &Value, bot_id: &str, marker: &str) -> bool {
    let footer = format!("-# {marker}");
    message["author"]["id"].as_str() == Some(bot_id)
        && message["components"].as_array().is_some_and(|components| {
            components.iter().any(|container| {
                container["type"] == 17
                    && container["components"].as_array().is_some_and(|children| {
                        children.iter().any(|component| {
                            component["type"] == 10
                                && component["content"].as_str() == Some(footer.as_str())
                        })
                    })
            })
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn recovery_requires_exact_footer_and_bot_identity() {
        let mut message = json!({"author":{"id":"bot"},"components":[{"type":17,"components":[{"type":10,"content":"-# zc-submission:420"}]}]});
        assert!(!matches_submission_message(
            &message,
            "bot",
            "zc-submission:42"
        ));
        message["components"][0]["components"][0]["content"] = "-# zc-submission:42".into();
        assert!(matches_submission_message(
            &message,
            "bot",
            "zc-submission:42"
        ));
        assert!(!matches_submission_message(
            &message,
            "other",
            "zc-submission:42"
        ));
        message["components"][0]["components"][0]["content"] = "## zc-submission:42".into();
        assert!(!matches_submission_message(
            &message,
            "bot",
            "zc-submission:42"
        ));
    }
}
