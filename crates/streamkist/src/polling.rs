use crate::{
    cards::{self, Snapshot},
    twitch::{Stream, Twitch},
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
    let watches = database.streamkist_watches(None).await?;
    let mut games = HashMap::new();
    let mut messages = HashMap::new();
    let mut users = HashSet::new();
    for watch in &watches {
        if !games.contains_key(&watch.game_id) {
            games.insert(
                watch.game_id.clone(),
                twitch.game_streams(&watch.game_id).await?,
            );
        }
        let rows = database.streamkist_messages(watch.id).await?;
        users.extend(rows.iter().map(|row| row.user_id.clone()));
        messages.insert(watch.id, rows);
    }
    // Query broadcasters directly. Missing category result can mean game changed, not offline.
    // Only a complete, successful response can finish an existing stream.
    let users: Vec<_> = users.into_iter().collect();
    let live: HashMap<_, _> = twitch
        .user_streams(&users)
        .await?
        .into_iter()
        .map(|stream| (stream.id.clone(), stream))
        .collect();
    let now = jiff::Timestamp::now().as_second();
    for watch in watches {
        let channel = ChannelId::new(watch.channel_id.parse()?);
        // Watch can be removed while Twitch requests run.
        if !database
            .streamkist_watches(Some(&watch.guild_id))
            .await?
            .iter()
            .any(|w| w.id == watch.id)
        {
            continue;
        }
        let existing = messages.remove(&watch.id).unwrap_or_default();
        let known: HashSet<_> = existing.iter().map(|row| row.stream_id.clone()).collect();
        for row in &existing {
            let old: Snapshot = serde_json::from_value(row.snapshot.clone())?;
            let next = next_snapshot(&old, live.get(&row.stream_id), now);
            if deliver(database, http, channel, row, next).await.is_err() {
                tracing::warn!(watch_id = watch.id, stream_id = %row.stream_id, "Stream card update failed");
            }
        }
        for stream in &games[&watch.game_id] {
            if known.contains(&stream.id) {
                continue;
            }
            let snapshot = Snapshot::live(stream.clone(), stream.viewer_count, now);
            if let Some(row) = database
                .streamkist_reserve_message(
                    watch.id,
                    &stream.id,
                    &stream.user_id,
                    &serde_json::to_value(&snapshot)?,
                    snapshot.peak_viewers,
                )
                .await?
                && let Err(_) = deliver(database, http, channel, &row, snapshot).await
            {
                tracing::warn!(watch_id = watch.id, stream_id = %stream.id, "Stream card delivery failed");
            }
        }
    }
    Ok(())
}

pub fn next_snapshot(previous: &Snapshot, live: Option<&Stream>, now: i64) -> Snapshot {
    // Terminal state never changes, even if called with a new live result.
    if previous.ended_at.is_some() {
        return previous.clone();
    }
    match live {
        Some(stream) => Snapshot::live(stream.clone(), previous.peak_viewers, now),
        None => previous.clone().finish(now),
    }
}

async fn deliver(
    database: &Database,
    http: &Http,
    channel: ChannelId,
    row: &StreamMessage,
    snapshot: Snapshot,
) -> Result<()> {
    let encoded = serde_json::to_value(&snapshot)?;
    if row.message_id.is_some() && row.snapshot == encoded {
        return Ok(());
    }
    let message = match &row.message_id {
        Some(id) => {
            let id = MessageId::new(id.parse()?);
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
            id
        }
        None => {
            channel
                .widen()
                .send_message(
                    http,
                    CreateMessage::new()
                        .components(snapshot.components())
                        .flags(cards::flags())
                        .allowed_mentions(cards::mentions())
                        .nonce(Nonce::Number(u64::try_from(row.id)?))
                        .enforce_nonce(true),
                )
                .await?
                .id
        }
    };
    database
        .streamkist_save_message(
            row.id,
            &message.to_string(),
            &encoded,
            snapshot.peak_viewers,
            snapshot.ended_at.is_none(),
        )
        .await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn updates_title_viewers_peak_and_game_without_new_message() {
        let old = Snapshot::live(cards::tests::stream(), 20, 1791637200);
        let mut live = old.stream.clone();
        live.title = "New title".into();
        live.viewer_count = 30;
        live.game_id = "10".into();
        live.game_name = "Other game".into();
        let updated = next_snapshot(&old, Some(&live), 1791637260);
        assert_eq!(updated.stream.title, "New title");
        assert_eq!(updated.stream.game_name, "Other game");
        assert_eq!(updated.peak_viewers, 30);
        live.viewer_count = 2;
        assert_eq!(
            next_snapshot(&updated, Some(&live), 1791637320).peak_viewers,
            30
        );
    }
    #[test]
    fn offline_is_terminal_and_unchanged_live_result_skips_edit() {
        let old = Snapshot::live(cards::tests::stream(), 20, 1791637200);
        assert_eq!(next_snapshot(&old, Some(&old.stream), 1791637260), old);
        let ended = next_snapshot(&old, None, 1791637300);
        assert_eq!(ended.ended_at, Some(1791637300));
        assert_eq!(next_snapshot(&ended, Some(&old.stream), 1791637400), ended);
    }
}
