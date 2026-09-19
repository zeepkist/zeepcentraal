use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use serenity::builder::{AutocompleteChoice, CreateAutocompleteResponse};
use std::{
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tokio::sync::Mutex;
use zc_discord_evaluation::{message, Display, Sessions};

#[derive(Clone)]
struct App {
    http: reqwest::Client,
    sessions: Arc<Mutex<Sessions>>,
    feed: Arc<Mutex<()>>,
    pending: Arc<AtomicUsize>,
    peak: Arc<AtomicUsize>,
}
struct Pending(Arc<AtomicUsize>);
impl Drop for Pending {
    fn drop(&mut self) {
        self.0.fetch_sub(1, Ordering::Relaxed);
    }
}
#[derive(Deserialize)]
struct Event {
    kind: String,
    id: u64,
    #[serde(default = "owner")]
    owner: String,
}
fn owner() -> String {
    "fixture-owner".into()
}
fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}
const FIXTURE: &str = "http://127.0.0.1:4321";

async fn send(app: &App, path: &str, body: &Value) -> anyhow::Result<Value> {
    for attempt in 0..3 {
        let response = app
            .http
            .post(format!("{FIXTURE}{path}"))
            .json(body)
            .send()
            .await?;
        if response.status().as_u16() == 429 || response.status().is_server_error() {
            anyhow::ensure!(attempt < 2, "Fixture retry exhausted");
            tokio::time::sleep(Duration::from_millis(10)).await;
            continue;
        }
        anyhow::ensure!(response.status().is_success(), "Fixture permanent failure");
        return Ok(response.json().await?);
    }
    unreachable!()
}

async fn process(app: &App, event: Event) -> anyhow::Result<Value> {
    anyhow::ensure!(
        ["profile", "autocomplete", "page", "feed"].contains(&event.kind.as_str()),
        "Unknown event"
    );
    let started = Instant::now();
    let mut ack_ms = None;
    let _pending = if event.kind == "feed" {
        let count = app.pending.fetch_add(1, Ordering::Relaxed) + 1;
        app.peak.fetch_max(count, Ordering::Relaxed);
        Some(Pending(app.pending.clone()))
    } else {
        None
    };
    // Serialize delivery/cursor transitions like the single feed drain in the current bot.
    let _feed_guard = if event.kind == "feed" {
        Some(app.feed.lock().await)
    } else {
        None
    };
    let envelope = json!({"id":event.id, "kind":event.kind});
    if event.kind == "feed" {
        let delivered = send(app, "/backend/delivery", &envelope).await?;
        if delivered["delivered"] == true {
            return Ok(json!({"ok":true,"duplicate":true}));
        }
    } else if event.kind != "autocomplete" {
        send(
            app,
            "/discord/ack",
            &json!({"type":if event.kind=="page" {6} else {5},"id":event.id}),
        )
        .await?;
    }
    if event.kind == "profile" || event.kind == "page" {
        ack_ms = Some(started.elapsed().as_secs_f64() * 1000.0);
    }
    let documents: Value = serde_json::from_str(include_str!("../fixtures/documents.json"))?;
    let data = send(
        app,
        if event.kind == "feed" {
            "/activity"
        } else {
            "/graphql"
        },
        &json!({"id":event.id,"kind":event.kind,"query":documents[&event.kind]}),
    )
    .await?;
    let payload = if event.kind == "autocomplete" {
        let choices = data["choices"]
            .as_array()
            .ok_or_else(|| anyhow::anyhow!("Missing choices"))?;
        let choices: Vec<_> = choices
            .iter()
            .take(25)
            .map(|v| {
                AutocompleteChoice::new(
                    v["name"].as_str().unwrap_or("").to_owned(),
                    v["value"].as_str().unwrap_or("").to_owned(),
                )
            })
            .collect();
        json!({"type":8,"data":serde_json::to_value(CreateAutocompleteResponse::new().set_choices(choices))?})
    } else {
        let display: Display = serde_json::from_value(data["display"].clone())?;
        let payload = message(&display)?;
        if event.kind == "page" {
            let mut sessions = app.sessions.lock().await;
            let session = event.id % 256;
            sessions.put(session, event.owner.clone(), now(), payload);
            sessions.get(session, &event.owner, now())?
        } else {
            payload
        }
    };
    send(
        app,
        "/discord/deliver",
        &json!({"id":event.id,"kind":event.kind,"payload":payload}),
    )
    .await?;
    if event.kind == "feed" {
        send(app, "/backend/advance", &envelope).await?;
    }
    if event.kind == "autocomplete" {
        ack_ms = Some(started.elapsed().as_secs_f64() * 1000.0);
    }
    Ok(json!({"ok":true,"ackMs":ack_ms}))
}
async fn replay(
    State(app): State<App>,
    Json(event): Json<Event>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    process(&app, event).await.map(Json).map_err(|_| {
        (
            StatusCode::BAD_GATEWAY,
            Json(json!({"error":"Evaluation failed"})),
        )
    })
}
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Fixed loopback fixture endpoint: this executable cannot send Discord messages.
    let sessions = Arc::new(Mutex::new(Sessions::default()));
    let clean = sessions.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(60)).await;
            clean.lock().await.cleanup(now());
        }
    });
    let app = App {
        http: reqwest::Client::builder()
            .timeout(Duration::from_secs(5))
            .build()?,
        sessions,
        feed: Arc::new(Mutex::new(())),
        pending: Arc::new(AtomicUsize::new(0)),
        peak: Arc::new(AtomicUsize::new(0)),
    };
    let routes = Router::new()
        .route("/healthz", get(|| async { Json(json!({"status":"ok"})) }))
        .route("/evaluation/discord", post(replay))
        .route(
            "/stats",
            get(|State(app): State<App>| async move {
                Json(json!({"sessions":app.sessions.lock().await.len(),"pendingFeeds":app.pending.load(Ordering::Relaxed),"peakPendingFeeds":app.peak.load(Ordering::Relaxed)}))
            }),
        )
        .with_state(app);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:4310").await?;
    axum::serve(listener, routes).await?;
    Ok(())
}
