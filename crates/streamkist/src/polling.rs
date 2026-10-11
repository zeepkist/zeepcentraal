use crate::{
    cards::{self, Snapshot},
    twitch::Twitch,
};
use anyhow::Result;
use serenity::{
    all::{ChannelId, MessageId, Nonce},
    builder::{CreateMessage, EditMessage},
    http::Http,
};
use std::{
    collections::{HashMap, HashSet},
    sync::Arc,
    time::Duration,
};
use zc_database::{Database, services::streamkist::StreamMessage};

pub async fn run(database: Database, twitch: Arc<Twitch>, http: Arc<Http>, seconds: u64) {
    let owner = uuid::Uuid::new_v4().to_string();
    let mut interval = tokio::time::interval(Duration::from_secs(seconds));
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    loop {
        interval.tick().await;
        match database.streamkist_claim_poll(&owner).await {
            Ok(true) => {}
            Ok(false) => continue,
            Err(_) => {
                tracing::warn!("Streamkist poll lease unavailable");
                continue;
            }
        }
        match tokio::time::timeout(Duration::from_secs(120), poll(&database, &twitch, &http)).await
        {
            Ok(Ok(())) => {}
            Ok(Err(_)) => tracing::warn!("Streamkist poll failed; retry next interval"),
            Err(_) => tracing::warn!("Streamkist poll exceeded 120 seconds"),
        }
        if database.streamkist_release_poll(&owner).await.is_err() {
            tracing::warn!("Streamkist poll lease release failed");
        }
    }
}

async fn poll(database: &Database, twitch: &Twitch, http: &Http) -> Result<()> {
    let initial_watches = database.streamkist_watches(None).await?;
    let mut rows = database.streamkist_messages().await?;
    let mut games = HashMap::new();
    for watch in &initial_watches {
        if !games.contains_key(&watch.game_id) {
            games.insert(
                watch.game_id.clone(),
                twitch.game_streams(&watch.game_id).await?,
            );
        }
    }
    let users: Vec<_> = rows
        .iter()
        .filter(|row| row.tracking_state != "finished")
        .map(|row| row.user_id.clone())
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();
    // No state changes until all category and broadcaster requests succeed.
    let live: HashMap<_, _> = twitch
        .user_streams(&users)
        .await?
        .into_iter()
        .map(|stream| (stream.id.clone(), stream))
        .collect();
    let watches = database.streamkist_watches(None).await?;
    for watch in &watches {
        if !games.contains_key(&watch.game_id) {
            games.insert(
                watch.game_id.clone(),
                twitch.game_streams(&watch.game_id).await?,
            );
        }
    }
    let stream_ids: Vec<_> = games
        .values()
        .flatten()
        .map(|stream| stream.id.clone())
        .collect();
    rows.extend(database.streamkist_terminal_messages(&stream_ids).await?);
    let candidates = crate::tracking::candidates(&watches, &rows, &games, &live);
    let selected = crate::tracking::select(&candidates, &rows);
    let terminal: HashSet<_> = rows
        .iter()
        .filter(|row| row.canonical && row.tracking_state == "finished")
        .map(|row| (row.guild_id.clone(), row.stream_id.clone()))
        .collect();
    let now = jiff::Timestamp::now().as_second();
    // Free slots only after Discord accepts inactive cards and DB records delivery.
    for row in &rows {
        if row.tracking_state == "finished" {
            continue;
        }
        if !watches
            .iter()
            .any(|watch| watch.guild_id == row.guild_id && watch.channel_id == row.channel_id)
        {
            continue;
        }
        let eligible = candidates.iter().any(|candidate| {
            candidate.watch.guild_id == row.guild_id
                && candidate.watch.channel_id == row.channel_id
                && candidate.stream.id == row.stream_id
        });
        if row.canonical
            && eligible
            && selected.contains(&(row.guild_id.clone(), row.stream_id.clone()))
        {
            continue;
        }
        let state = if !row.canonical
            || terminal.contains(&(row.guild_id.clone(), row.stream_id.clone()))
            || !live.contains_key(&row.stream_id)
        {
            "finished"
        } else if !eligible
            && live.get(&row.stream_id).is_some_and(|stream| {
                !watches.iter().any(|watch| {
                    watch.guild_id == row.guild_id
                        && watch.channel_id == row.channel_id
                        && watch.game_id == stream.game_id
                })
            })
        {
            "category_paused"
        } else {
            "limit_paused"
        };
        let mut old: Snapshot = serde_json::from_value(row.snapshot.clone())?;
        old.peak_viewers = old.peak_viewers.max(row.peak_viewers);
        let next = crate::tracking::stopped(&old, state, now);
        if deliver(database, http, row, next, state, row.policy_watch_id)
            .await
            .is_err()
        {
            tracing::warn!(stream_id=%row.stream_id,"Stream card pause failed; slot remains occupied");
        }
    }
    for candidate in candidates {
        if !selected.contains(&(
            candidate.watch.guild_id.clone(),
            candidate.stream.id.clone(),
        )) {
            continue;
        }
        let peak = rows
            .iter()
            .find(|row| {
                row.canonical
                    && row.guild_id == candidate.watch.guild_id
                    && row.channel_id == candidate.watch.channel_id
                    && row.stream_id == candidate.stream.id
            })
            .map_or(candidate.stream.viewer_count, |row| row.peak_viewers);
        let snapshot = Snapshot::live(candidate.stream.clone(), peak, now);
        if let Some(row) = database
            .streamkist_reserve_message(
                &candidate.watch,
                &candidate.stream.id,
                &candidate.stream.user_id,
                &serde_json::to_value(&snapshot)?,
                candidate.stream.viewer_count,
            )
            .await?
            && deliver(database, http, &row, snapshot, "active", candidate.watch.id)
                .await
                .is_err()
        {
            tracing::warn!(stream_id=%candidate.stream.id,"Stream card activation failed; reservation retained");
        }
    }
    Ok(())
}

async fn deliver(
    database: &Database,
    http: &Http,
    row: &StreamMessage,
    snapshot: Snapshot,
    state: &str,
    policy_watch_id: i64,
) -> Result<()> {
    let channel = ChannelId::new(row.channel_id.parse()?);
    let encoded = serde_json::to_value(&snapshot)?;
    let mut message = row
        .message_id
        .as_ref()
        .map(|id| id.parse::<u64>().map(MessageId::new))
        .transpose()?;
    let mut recovered = false;
    if message.is_none() && (state == "active" || row.activation_pending) {
        // A timed-out send may already exist. Recover its ID with the same nonce.
        let payload = if state == "active" {
            snapshot.clone()
        } else {
            serde_json::from_value(row.snapshot.clone())?
        };
        message = Some(
            channel
                .widen()
                .send_message(
                    http,
                    CreateMessage::new()
                        .components(payload.components())
                        .flags(cards::flags())
                        .allowed_mentions(cards::mentions())
                        .nonce(Nonce::Number(u64::try_from(row.id)?))
                        .enforce_nonce(true),
                )
                .await?
                .id,
        );
        recovered = true;
    }
    if let Some(id) = message
        && (recovered || row.snapshot != encoded)
    {
        channel
            .widen()
            .edit_message(
                http,
                id,
                EditMessage::new()
                    .components(snapshot.components())
                    .flags(cards::flags())
                    .allowed_mentions(cards::mentions()),
            )
            .await?;
    }
    let message = message.map(|id| id.to_string());
    database
        .streamkist_save_message(
            row.id,
            message.as_deref(),
            &encoded,
            snapshot.peak_viewers,
            state,
            policy_watch_id,
        )
        .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        Json, Router,
        extract::{Path, State},
        http::StatusCode,
        response::IntoResponse,
        routing::post,
    };
    use std::sync::{
        Mutex,
        atomic::{AtomicBool, Ordering},
    };
    use zc_database::services::streamkist::WatchSettings;

    #[derive(Default)]
    struct Discord {
        fail_edits: AtomicBool,
        sends: Mutex<Vec<serde_json::Value>>,
    }

    fn message(id: &str) -> serde_json::Value {
        serde_json::json!({
            "id":id,"channel_id":"10","author":{"id":"999","username":"Streamkist","discriminator":"0000","avatar":null},
            "content":"","timestamp":"2026-10-11T12:00:00Z","edited_timestamp":null,
            "tts":false,"mention_everyone":false,"mentions":[],"mention_roles":[],
            "attachments":[],"embeds":[],"pinned":false,"type":0
        })
    }

    async fn send(
        State(state): State<Arc<Discord>>,
        Json(payload): Json<serde_json::Value>,
    ) -> Json<serde_json::Value> {
        state.sends.lock().unwrap().push(payload);
        Json(message("500"))
    }

    async fn edit(
        State(state): State<Arc<Discord>>,
        Path((_channel, id)): Path<(String, String)>,
    ) -> axum::response::Response {
        if state.fail_edits.load(Ordering::SeqCst) {
            return (
                StatusCode::FORBIDDEN,
                Json(serde_json::json!({"code":50013,"message":"Missing Permissions"})),
            )
                .into_response();
        }
        Json(message(&id)).into_response()
    }

    #[tokio::test]
    #[ignore = "requires migrated disposable local PostgreSQL named streamkist_test"]
    async fn failed_discord_pause_retains_slot_and_nonce_retries_reuse_message() -> Result<()> {
        zc_core::environment::initialize()?;
        let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
        anyhow::ensure!(
            url.starts_with("postgres://streamkist_test:fixture-only@127.0.0.1:")
                && url.ends_with("/streamkist_test"),
            "Dedicated fixture required"
        );
        let database = Database::connect(&url, 4).await?;
        database
            .streamkist_add_watch(
                "delivery-fixture",
                "10",
                "9",
                "Zeepkist",
                WatchSettings::default(),
            )
            .await?;
        let watch = database
            .streamkist_watches(Some("delivery-fixture"))
            .await?
            .remove(0);
        let state = Arc::new(Discord::default());
        let router = Router::new()
            .route("/api/v10/channels/{channel}/messages", post(send))
            .route(
                "/api/v10/channels/{channel}/messages/{message}",
                axum::routing::patch(edit),
            )
            .with_state(state.clone());
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
        let address = listener.local_addr()?;
        let server = tokio::spawn(async move {
            axum::serve(listener, router).await.unwrap();
        });
        let http = serenity::http::HttpBuilder::without_token()
            .proxy(format!("http://{address}"))
            .ratelimiter_disabled(true)
            .build();
        let snapshot = Snapshot::live(cards::tests::stream(), 30, 100);
        let encoded = serde_json::to_value(&snapshot)?;
        let mut first = None;
        for number in 0..15 {
            let row = database
                .streamkist_reserve_message(
                    &watch,
                    &format!("delivery-{number}"),
                    "42",
                    &encoded,
                    20,
                )
                .await?
                .unwrap();
            database
                .streamkist_save_message(
                    row.id,
                    Some(&format!("{}", 100 + number)),
                    &encoded,
                    30,
                    "active",
                    watch.id,
                )
                .await?;
            if number == 0 {
                first = Some(row.id);
            }
        }
        let rows = database.streamkist_messages().await?;
        let row = rows.iter().find(|row| Some(row.id) == first).unwrap();
        state.fail_edits.store(true, Ordering::SeqCst);
        let paused = crate::tracking::stopped(&snapshot, "limit_paused", 200);
        assert!(
            deliver(
                &database,
                &http,
                row,
                paused.clone(),
                "limit_paused",
                watch.id
            )
            .await
            .is_err()
        );
        assert!(
            database
                .streamkist_reserve_message(&watch, "replacement", "42", &encoded, 100)
                .await?
                .is_none()
        );
        state.fail_edits.store(false, Ordering::SeqCst);
        deliver(&database, &http, row, paused, "limit_paused", watch.id).await?;
        let replacement = database
            .streamkist_reserve_message(&watch, "replacement", "42", &encoded, 100)
            .await?
            .unwrap();
        // Simulate a successful send followed by lost DB persistence: retry same pending row.
        deliver(
            &database,
            &http,
            &replacement,
            snapshot.clone(),
            "active",
            watch.id,
        )
        .await?;
        deliver(
            &database,
            &http,
            &replacement,
            snapshot.clone(),
            "active",
            watch.id,
        )
        .await?;
        {
            let sends = state.sends.lock().unwrap();
            assert_eq!(sends.len(), 2);
            assert_eq!(sends[0]["nonce"], sends[1]["nonce"]);
            assert_eq!(sends[0]["enforce_nonce"], true);
        }
        let row = database
            .streamkist_messages()
            .await?
            .into_iter()
            .find(|row| row.id == replacement.id)
            .unwrap();
        assert_eq!(row.message_id.as_deref(), Some("500"));
        let stopped = crate::tracking::stopped(&snapshot, "category_paused", 220);
        deliver(
            &database,
            &http,
            &row,
            stopped.clone(),
            "category_paused",
            watch.id,
        )
        .await?;
        let row = database
            .streamkist_reserve_message(&watch, "replacement", "42", &encoded, 0)
            .await?
            .unwrap();
        assert_eq!(row.message_id.as_deref(), Some("500"));
        deliver(&database, &http, &row, snapshot, "active", watch.id).await?;
        assert_eq!(state.sends.lock().unwrap().len(), 2);
        assert_eq!(crate::tracking::stopped(&stopped, "finished", 300), stopped);
        server.abort();
        Ok(())
    }
}
