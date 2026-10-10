use anyhow::{Result, ensure};
use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use std::{
    collections::HashSet,
    time::{Duration, Instant},
};
use tokio::sync::Mutex;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct Game {
    pub id: String,
    pub name: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        Json, Router,
        extract::{Query, State},
        http::{HeaderMap, StatusCode as HttpStatus},
        response::IntoResponse,
        routing::{get, post},
    };
    use std::{
        collections::HashMap,
        sync::{
            Arc,
            atomic::{AtomicUsize, Ordering},
        },
    };

    #[derive(Default)]
    struct Mock {
        tokens: AtomicUsize,
        calls: AtomicUsize,
    }

    async fn token(State(state): State<Arc<Mock>>) -> Json<serde_json::Value> {
        let number = state.tokens.fetch_add(1, Ordering::SeqCst) + 1;
        Json(serde_json::json!({"access_token":format!("fixture-{number}"),"expires_in":3600}))
    }

    async fn streams(
        State(state): State<Arc<Mock>>,
        headers: HeaderMap,
        Query(query): Query<HashMap<String, String>>,
    ) -> axum::response::Response {
        let number = state.calls.fetch_add(1, Ordering::SeqCst);
        assert_eq!(headers["client-id"], "fixture-client");
        if number == 0 {
            return HttpStatus::UNAUTHORIZED.into_response();
        }
        assert_eq!(headers["authorization"], "Bearer fixture-2");
        let one = crate::cards::tests::stream();
        let mut two = one.clone();
        two.id = "456".into();
        if query.contains_key("user_id") {
            return Json(serde_json::json!({"data":[one],"pagination":{}})).into_response();
        }
        assert_eq!(query["game_id"], "9");
        assert_eq!(query["first"], "100");
        if query.contains_key("after") {
            assert_eq!(query["after"], "second-page");
            Json(serde_json::json!({"data":[one,two],"pagination":{}})).into_response()
        } else {
            Json(serde_json::json!({"data":[one],"pagination":{"cursor":"second-page"}}))
                .into_response()
        }
    }

    #[tokio::test]
    async fn refreshes_unauthorized_token_paginates_deduplicates_and_reuses_token() {
        let state = Arc::new(Mock::default());
        let router = Router::new()
            .route("/token", post(token))
            .route("/helix/streams", get(streams))
            .with_state(state.clone());
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            axum::serve(listener, router).await.unwrap();
        });
        let mut twitch = Twitch::new("fixture-client".into(), "fixture-secret".into()).unwrap();
        twitch.api_url = format!("http://{address}/helix");
        twitch.token_url = format!("http://{address}/token");
        assert_eq!(twitch.game_streams("9").await.unwrap().len(), 2);
        assert_eq!(twitch.user_streams(&["42".into()]).await.unwrap().len(), 1);
        assert!(twitch.user_streams(&[]).await.unwrap().is_empty());
        assert_eq!(state.tokens.load(Ordering::SeqCst), 2);
        assert_eq!(state.calls.load(Ordering::SeqCst), 4);
        server.abort();
    }

    #[tokio::test]
    async fn failed_requests_return_error_instead_of_empty_offline_result() {
        let router = Router::new()
            .route(
                "/token",
                post(|| async {
                    Json(serde_json::json!({"access_token":"fixture","expires_in":3600}))
                }),
            )
            .route(
                "/helix/streams",
                get(|| async { HttpStatus::TOO_MANY_REQUESTS }),
            );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            axum::serve(listener, router).await.unwrap();
        });
        let mut twitch = Twitch::new("fixture-client".into(), "fixture-secret".into()).unwrap();
        twitch.api_url = format!("http://{address}/helix");
        twitch.token_url = format!("http://{address}/token");
        let error = twitch
            .user_streams(&["42".into()])
            .await
            .unwrap_err()
            .to_string();
        assert_eq!(error, "Twitch API failed: HTTP 429");
        assert!(!error.contains("fixture-secret"));
        server.abort();
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct Stream {
    pub id: String,
    pub user_id: String,
    pub user_login: String,
    pub user_name: String,
    pub game_id: String,
    pub game_name: String,
    pub title: String,
    pub viewer_count: i32,
    pub started_at: String,
    pub thumbnail_url: String,
}

#[derive(Deserialize)]
struct Page<T> {
    data: Vec<T>,
    #[serde(default)]
    pagination: Pagination,
}
#[derive(Default, Deserialize)]
struct Pagination {
    cursor: Option<String>,
}
#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    expires_in: u64,
}
struct Token {
    value: String,
    expires_at: Instant,
}

pub struct Twitch {
    http: Client,
    client_id: String,
    client_secret: String,
    token: Mutex<Option<Token>>,
    api_url: String,
    token_url: String,
}

impl Twitch {
    pub fn new(client_id: String, client_secret: String) -> Result<Self> {
        Ok(Self {
            http: Client::builder().timeout(Duration::from_secs(15)).build()?,
            client_id,
            client_secret,
            token: Mutex::new(None),
            api_url: "https://api.twitch.tv/helix".into(),
            token_url: "https://id.twitch.tv/oauth2/token".into(),
        })
    }

    async fn access_token(&self) -> Result<String> {
        let mut cached = self.token.lock().await;
        if let Some(token) = cached.as_ref().filter(|t| t.expires_at > Instant::now()) {
            return Ok(token.value.clone());
        }
        let response = self
            .http
            .post(&self.token_url)
            .form(&[
                ("client_id", self.client_id.as_str()),
                ("client_secret", self.client_secret.as_str()),
                ("grant_type", "client_credentials"),
            ])
            .send()
            .await
            .map_err(|_| anyhow::anyhow!("Twitch authentication transport failed"))?;
        ensure!(
            response.status().is_success(),
            "Twitch authentication failed: HTTP {}",
            response.status().as_u16()
        );
        let token: TokenResponse = response.json().await?;
        let value = token.access_token.clone();
        *cached = Some(Token {
            value: token.access_token,
            expires_at: Instant::now() + Duration::from_secs(token.expires_in.saturating_sub(60)),
        });
        Ok(value)
    }

    async fn get<T: DeserializeOwned>(
        &self,
        path: &str,
        query: &[(String, String)],
    ) -> Result<Page<T>> {
        for attempt in 0..2 {
            let token = self.access_token().await?;
            let response = self
                .http
                .get(format!("{}{path}", self.api_url))
                .header("Client-Id", &self.client_id)
                .bearer_auth(&token)
                .query(query)
                .send()
                .await
                .map_err(|_| anyhow::anyhow!("Twitch API transport failed"))?;
            if response.status() == StatusCode::UNAUTHORIZED && attempt == 0 {
                let mut cached = self.token.lock().await;
                if cached
                    .as_ref()
                    .is_some_and(|current| current.value == token)
                {
                    *cached = None;
                }
                continue;
            }
            ensure!(
                response.status().is_success(),
                "Twitch API failed: HTTP {}",
                response.status().as_u16()
            );
            return Ok(response.json().await?);
        }
        unreachable!()
    }

    pub async fn search_games(&self, query: &str) -> Result<Vec<Game>> {
        if query.trim().is_empty() {
            return Ok(Vec::new());
        }
        Ok(self
            .get::<Game>(
                "/search/categories",
                &[
                    ("query".into(), query.into()),
                    ("first".into(), "25".into()),
                ],
            )
            .await?
            .data)
    }

    pub async fn game(&self, input: &str) -> Result<Option<Game>> {
        let key = if input.bytes().all(|c| c.is_ascii_digit()) {
            "id"
        } else {
            "name"
        };
        Ok(self
            .get::<Game>("/games", &[(key.into(), input.into())])
            .await?
            .data
            .into_iter()
            .next())
    }

    pub async fn game_streams(&self, game: &str) -> Result<Vec<Stream>> {
        let mut streams = Vec::new();
        let mut cursor = String::new();
        let mut seen_cursors = HashSet::new();
        loop {
            let mut query = vec![
                ("game_id".into(), game.into()),
                ("first".into(), "100".into()),
                ("type".into(), "live".into()),
            ];
            if !cursor.is_empty() {
                query.push(("after".into(), cursor));
            }
            let page: Page<Stream> = self.get("/streams", &query).await?;
            streams.extend(page.data);
            match page.pagination.cursor.filter(|s| !s.is_empty()) {
                Some(next) => {
                    ensure!(
                        seen_cursors.insert(next.clone()),
                        "Twitch returned a repeated pagination cursor"
                    );
                    cursor = next;
                }
                None => break,
            }
        }
        // Twitch pagination can repeat streams as viewer counts change.
        let mut seen = HashSet::new();
        streams.retain(|stream| seen.insert(stream.id.clone()));
        Ok(streams)
    }

    pub async fn user_streams(&self, users: &[String]) -> Result<Vec<Stream>> {
        let mut streams = Vec::new();
        for chunk in users.chunks(100) {
            let mut query: Vec<_> = chunk
                .iter()
                .map(|id| ("user_id".into(), id.clone()))
                .collect();
            query.push(("first".into(), "100".into()));
            streams.extend(self.get::<Stream>("/streams", &query).await?.data);
        }
        Ok(streams)
    }
}
