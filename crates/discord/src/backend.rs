use anyhow::{Context, Result, bail};
use reqwest::{Client, Method, Url};
use serde::{Deserialize, Serialize, de::DeserializeOwned};
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

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GuildFeed {
    pub guild_id: String,
    pub kind: String,
    pub channel_id: String,
    pub enabled: bool,
    pub cursor_event_id: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkerCursor {
    pub cursor_event_id: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Delivery {
    pub status: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchingWatch {
    pub id: String,
    pub discord_id: String,
    pub last_delivery_key: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityEvent {
    pub id: String,
    pub kind: String,
    pub level_id: Option<i32>,
    pub user_id: Option<i32>,
    pub previous_user_id: Option<i32>,
    pub payload: Value,
    pub occurred_at: String,
    pub level: Option<ActivityLevel>,
    pub user: Option<ActivityUser>,
    pub previous_user: Option<ActivityUser>,
    pub record: Option<ActivityRecord>,
    pub previous_record: Option<ActivityRecord>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityLevel {
    pub id: i32,
    pub xx_hash: String,
    pub level_items: ActivityLevelItems,
    pub level_points: Option<ActivityLevelPoints>,
    pub personal_best_globals: ActivityCount,
}

#[derive(Clone, Debug, Deserialize)]
pub struct ActivityLevelItems {
    pub nodes: Vec<ActivityLevelItem>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityLevelItem {
    pub name: String,
    pub image_url: String,
    pub workshop_id: Option<String>,
    pub author: Option<ActivityUser>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct ActivityLevelPoints {
    pub points: i32,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityCount {
    pub total_count: i64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityUser {
    pub id: i32,
    pub steam_id: Option<String>,
    pub steam_name: Option<String>,
    pub discord_id: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityRecord {
    pub time: f32,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TournamentSnapshot {
    pub tournament_id: i32,
    pub tournament_type: i32,
    pub tournament_slug: String,
    pub end_at: String,
    pub level_name: String,
    pub image_url: Option<String>,
    pub entries: i64,
    pub standings: Vec<TournamentStanding>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TournamentStanding {
    pub user_id: i32,
    pub steam_name: Option<String>,
    pub discord_id: Option<String>,
    pub time: f32,
    pub rank: i32,
    pub points: i32,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GuildState {
    #[serde(default)]
    pub tournament_messages: Vec<TournamentMessage>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TournamentMessage {
    pub id_tournament: i32,
    pub channel_id: String,
    pub message_id: String,
    pub content_hash: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: i32,
    pub steam_id: Option<String>,
    pub steam_name: Option<String>,
    pub discord_id: Option<String>,
    pub points: i64,
    pub rank: i32,
    pub total_points: i64,
    pub world_records: i64,
    pub records: i64,
    pub personal_bests: i64,
    pub published_levels: i64,
    pub votes: i64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LevelProfile {
    pub id: i32,
    pub xx_hash: String,
    pub name: String,
    pub image_url: String,
    pub workshop_id: String,
    pub author_name: Option<String>,
    pub author_discord_id: Option<String>,
    pub points: i32,
    pub rating: f32,
    pub records: i64,
    pub personal_bests: i64,
    pub votes: i64,
    pub world_record: Option<LevelWorldRecord>,
    pub leaderboard: Vec<LevelStanding>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LevelWorldRecord {
    pub time: f32,
    pub steam_name: Option<String>,
    pub discord_id: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LevelStanding {
    pub rank: i64,
    pub time: f32,
    pub steam_name: Option<String>,
    pub discord_id: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct SearchChoice {
    pub name: String,
    pub value: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RandomLevel {
    pub xx_hash: String,
    pub name: String,
    pub points: i32,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserStatistics {
    pub steam_name: Option<String>,
    pub discord_id: String,
    pub records: i64,
    pub personal_bests: i64,
    pub world_records: i64,
    pub levels: i64,
    pub votes: i64,
    pub samples: i64,
    pub distance: f64,
    pub time: f64,
    pub average_speed: f64,
    pub average_gforce: f64,
    pub max_speed: f64,
    pub max_gforce: f64,
    pub distance_on_tarmac: f64,
    pub distance_on_grass: f64,
    pub distance_on_sand: f64,
    pub distance_on_soap: f64,
    pub distance_on_wood: f64,
    pub distance_on_mud: f64,
    pub distance_on_ice1: f64,
    pub distance_on_ice2: f64,
    pub distance_on_ice3: f64,
    pub distance_in_air: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistLevel {
    pub id: i32,
    pub xx_hash: String,
    pub workshop_id: String,
    pub file_uid: String,
    pub name: String,
    pub file_author: String,
    pub points: i32,
    pub records: i64,
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

    pub async fn guild_runtime(&self, guild_id: &str) -> Result<GuildState> {
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

    pub async fn enabled_feeds(&self) -> Result<Vec<GuildFeed>> {
        self.request(Method::GET, "/discord-bot/guild-feeds/enabled", None)
            .await
    }

    pub async fn worker_cursor(&self, key: &str) -> Result<WorkerCursor> {
        self.request(
            Method::GET,
            &format!("/discord-bot/workers/{key}/cursor"),
            None,
        )
        .await
    }

    pub async fn events_after(&self, cursor: i64) -> Result<Vec<ActivityEvent>> {
        self.request(
            Method::GET,
            &format!("/discord-bot/activity-events?after={cursor}&limit=500"),
            None,
        )
        .await
    }

    pub async fn current_tournaments(&self) -> Result<Vec<TournamentSnapshot>> {
        self.request(Method::GET, "/discord-bot/tournaments/current", None)
            .await
    }

    pub async fn profile(&self, kind: &str, identifier: &str) -> Result<Profile> {
        self.request(
            Method::GET,
            &format!("/discord-bot/profiles/{identifier}?kind={kind}"),
            None,
        )
        .await
    }

    pub async fn level(&self, query: &str) -> Result<LevelProfile> {
        self.request(
            Method::POST,
            "/discord-bot/levels/lookup",
            Some(json!({"query":query})),
        )
        .await
    }

    pub async fn level_search(&self, query: &str) -> Result<Vec<SearchChoice>> {
        self.request(
            Method::POST,
            "/discord-bot/levels/search",
            Some(json!({"query":query})),
        )
        .await
    }

    pub async fn random_level(&self, minimum_points: i64) -> Result<RandomLevel> {
        self.request(
            Method::GET,
            &format!("/discord-bot/levels/random?minimumPoints={minimum_points}"),
            None,
        )
        .await
    }

    pub async fn user_statistics(
        &self,
        discord_id: u64,
        range: &str,
        from: Option<&str>,
        to: Option<&str>,
    ) -> Result<UserStatistics> {
        let mut url = self
            .base_url
            .join(&format!("/discord-bot/users/{discord_id}/statistics"))?;
        {
            let mut query = url.query_pairs_mut();
            query.append_pair("range", range);
            if let Some(from) = from {
                query.append_pair("from", from);
            }
            if let Some(to) = to {
                query.append_pair("to", to);
            }
        }
        let response = self
            .client
            .get(url)
            .bearer_auth(&self.api_token)
            .send()
            .await
            .context("Discord backend unavailable")?;
        let status = response.status();
        if !status.is_success() {
            bail!(
                "Discord backend statistics returned {status}: {}",
                response
                    .text()
                    .await
                    .unwrap_or_default()
                    .chars()
                    .take(300)
                    .collect::<String>()
            );
        }
        Ok(response.json().await?)
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn playlist(
        &self,
        discord_id: u64,
        count: i64,
        sort: &str,
        without_wr: bool,
        without_pb: bool,
        no_records: bool,
    ) -> Result<Vec<PlaylistLevel>> {
        self.request(
            Method::POST,
            "/discord-bot/playlists",
            Some(json!({
                "discordId":discord_id.to_string(),"count":count,"sort":sort,
                "withoutWr":without_wr,"withoutPb":without_pb,"noRecords":no_records,
            })),
        )
        .await
    }

    pub async fn recommended_playlist(
        &self,
        discord_id: u64,
        count: i64,
    ) -> Result<Vec<PlaylistLevel>> {
        self.request(
            Method::POST,
            "/discord-bot/playlists/recommended",
            Some(json!({"discordId":discord_id.to_string(),"count":count})),
        )
        .await
    }

    pub async fn advance_worker(&self, key: &str, event_id: &str) -> Result<Value> {
        self.request(
            Method::POST,
            &format!("/discord-bot/workers/{key}/cursor"),
            Some(json!({"eventId":event_id})),
        )
        .await
    }

    pub async fn advance_feed(&self, guild_id: &str, kind: &str, event_id: &str) -> Result<Value> {
        self.request(
            Method::POST,
            &format!("/discord-bot/guilds/{guild_id}/feeds/{kind}/cursor"),
            Some(json!({"eventId":event_id})),
        )
        .await
    }

    pub async fn delivery(&self, guild_id: &str, event_id: &str) -> Result<Option<Delivery>> {
        self.request(
            Method::GET,
            &format!("/discord-bot/guilds/{guild_id}/deliveries/{event_id}"),
            None,
        )
        .await
    }

    pub async fn set_delivery(
        &self,
        guild_id: &str,
        event_id: &str,
        channel_id: &str,
        message_id: Option<u64>,
        status: &str,
        last_error: Option<&str>,
    ) -> Result<Value> {
        self.request(
            Method::PUT,
            &format!("/discord-bot/guilds/{guild_id}/deliveries/{event_id}"),
            Some(json!({
                "channelId":channel_id,
                "messageId":message_id.map(|value| value.to_string()),
                "status":status,
                "lastError":last_error,
            })),
        )
        .await
    }

    pub async fn matching_watches(&self, event: &ActivityEvent) -> Result<Vec<MatchingWatch>> {
        let mut player = Vec::new();
        for user in [event.user.as_ref(), event.previous_user.as_ref()]
            .into_iter()
            .flatten()
        {
            player.push(user.id.to_string());
            if let Some(id) = &user.steam_id {
                player.push(id.clone());
            }
            if let Some(name) = &user.steam_name {
                player.push(name.clone());
            }
        }
        let mut level = Vec::new();
        let mut author = Vec::new();
        if let Some(value) = &event.level {
            level.push(value.id.to_string());
            level.push(value.xx_hash.clone());
            if let Some(item) = value.level_items.nodes.first() {
                level.push(item.name.clone());
                if let Some(value) = &item.author {
                    author.push(value.id.to_string());
                    if let Some(id) = &value.steam_id {
                        author.push(id.clone());
                    }
                    if let Some(name) = &value.steam_name {
                        author.push(name.clone());
                    }
                }
            }
        }
        let changes = event
            .payload
            .get("changes")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .filter_map(|change| change.get("idUser"))
            .map(|value| {
                value
                    .as_str()
                    .map_or_else(|| value.to_string(), str::to_owned)
            });
        player.extend(changes);
        self.matching_watch_targets(json!([
            {"kind":"player","targetIds":player},
            {"kind":"level","targetIds":level},
            {"kind":"author","targetIds":author},
        ]))
        .await
    }

    pub async fn matching_watch_targets(&self, targets: Value) -> Result<Vec<MatchingWatch>> {
        self.request(
            Method::POST,
            "/discord-bot/watches/matches",
            Some(json!({"targets":targets})),
        )
        .await
    }

    pub async fn update_watch(
        &self,
        watch_id: &str,
        paused: bool,
        last_error: Option<&str>,
        delivery_key: Option<&str>,
    ) -> Result<Value> {
        self.request(
            Method::PATCH,
            &format!("/discord-bot/watches/{watch_id}/delivery"),
            Some(json!({
                "paused":paused,
                "lastError":last_error,
                "deliveryKey":delivery_key,
            })),
        )
        .await
    }

    pub async fn set_tournament_message(
        &self,
        guild_id: &str,
        tournament_id: i32,
        channel_id: &str,
        message_id: u64,
        content_hash: &str,
    ) -> Result<Value> {
        self.request(
            Method::PUT,
            &format!("/discord-bot/guilds/{guild_id}/tournaments/{tournament_id}/message"),
            Some(json!({
                "channelId":channel_id,
                "messageId":message_id.to_string(),
                "contentHash":content_hash,
            })),
        )
        .await
    }
}
