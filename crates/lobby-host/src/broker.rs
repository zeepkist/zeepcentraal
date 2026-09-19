use crate::config::ManagedRoomConfig;
use anyhow::{Context, Result, ensure};
use reqwest::{Client, Url};
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Clone)]
pub struct RoomBrokerClient {
    client: Client,
    url: Url,
    token: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RoomAssignment {
    pub host: String,
    pub join_id: String,
    pub key: String,
    pub player_uid: u32,
    pub port: u16,
    pub room_created: bool,
    pub steam_id: String,
    pub token: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AssignmentRequest<'a> {
    key: &'a str,
    join_id: Option<&'a str>,
    room: &'a crate::config::RoomSettings,
}

impl RoomBrokerClient {
    pub fn new(url: &str, token: String) -> Result<Self> {
        ensure!(
            token.len() >= 32,
            "Room broker token must contain at least 32 characters"
        );
        let client = Client::builder()
            .timeout(Duration::from_secs(120))
            .build()?;
        let mut url = Url::parse(url).context("ZEEPKIST_ROOM_BROKER_URL is invalid")?;
        ensure!(
            matches!(url.scheme(), "http" | "https"),
            "Room broker URL must use HTTP(S)"
        );
        url.set_path("/v1/rooms/assignment");
        url.set_query(None);
        url.set_fragment(None);
        Ok(Self { client, url, token })
    }

    pub async fn assign(
        &self,
        config: &ManagedRoomConfig,
        join_id: Option<&str>,
    ) -> Result<RoomAssignment> {
        let response = self
            .client
            .post(self.url.clone())
            .bearer_auth(&self.token)
            .json(&AssignmentRequest {
                key: &config.key,
                join_id,
                room: &config.room,
            })
            .send()
            .await?;
        ensure!(
            response.status().is_success(),
            "Room broker returned HTTP {}",
            response.status()
        );
        let assignment: RoomAssignment = response
            .json()
            .await
            .context("Room broker response is invalid")?;
        assignment.validate()?;
        ensure!(
            assignment.key == config.key,
            "Room broker returned mismatched key"
        );
        Ok(assignment)
    }
}

impl RoomAssignment {
    pub fn validate(&self) -> Result<()> {
        ensure!(
            !self.host.is_empty() && self.host.len() <= 1_024,
            "Room broker response is invalid"
        );
        ensure!(
            !self.join_id.is_empty() && self.join_id.len() <= 1_024,
            "Room broker response is invalid"
        );
        ensure!(
            !self.key.is_empty() && self.key.len() <= 64,
            "Room broker response is invalid"
        );
        ensure!(
            (17..=20).contains(&self.steam_id.len())
                && self.steam_id.bytes().all(|byte| byte.is_ascii_digit()),
            "Room broker response is invalid"
        );
        ensure!(
            !self.token.is_empty() && self.token.len() <= 4_096,
            "Room broker response is invalid"
        );
        Ok(())
    }

    pub fn steam_id(&self) -> Result<u64> {
        Ok(self.steam_id.parse()?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_assignment_boundaries() {
        let valid = RoomAssignment {
            host: "127.0.0.1".into(),
            join_id: "room".into(),
            key: "totw".into(),
            player_uid: 1,
            port: 1234,
            room_created: true,
            steam_id: "76561198000000000".into(),
            token: "ticket".into(),
        };
        assert!(valid.validate().is_ok());
        assert_eq!(valid.steam_id().unwrap(), 76_561_198_000_000_000);
        let mut invalid = valid;
        invalid.steam_id = "not-a-steam-id".into();
        assert!(invalid.validate().is_err());
    }
}
