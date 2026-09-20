use crate::{
    backend::{ActivityEvent, Backend, GuildFeed, MatchingWatch, TournamentSnapshot},
    config::DiscordConfig,
};
use anyhow::{Context, Result};
use serenity::{
    all::{ChannelId, Http, MessageFlags, MessageId, UserId},
    builder::{
        CreateAllowedMentions, CreateButton, CreateComponent, CreateContainer,
        CreateContainerComponent, CreateMessage, CreateTextDisplay, EditMessage,
    },
    model::Colour,
};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};
use tokio::{sync::Notify, task::JoinHandle};

const WATCH_CURSOR: &str = "watch-events";

pub struct FeedService {
    backend: Backend,
    frontend_url: reqwest::Url,
    stopped: Arc<AtomicBool>,
    wake: Arc<Notify>,
    task: tokio::sync::Mutex<Option<JoinHandle<()>>>,
}

impl FeedService {
    pub fn new(backend: Backend, config: &DiscordConfig) -> Self {
        Self {
            backend,
            frontend_url: config.frontend_url.clone(),
            stopped: Arc::new(AtomicBool::new(false)),
            wake: Arc::new(Notify::new()),
            task: tokio::sync::Mutex::new(None),
        }
    }

    pub async fn start(&self, http: Arc<Http>) {
        let mut task = self.task.lock().await;
        if task.is_some() {
            return;
        }
        self.stopped.store(false, Ordering::Release);
        let backend = self.backend.clone();
        let frontend_url = self.frontend_url.clone();
        let stopped = self.stopped.clone();
        let wake = self.wake.clone();
        *task = Some(tokio::spawn(async move {
            let mut last_tournament_poll = tokio::time::Instant::now() - Duration::from_secs(60);
            while !stopped.load(Ordering::Acquire) {
                if let Err(error) = poll_activity(&http, &backend, &frontend_url).await {
                    tracing::error!(%error, "Discord activity feed poll failed");
                }
                if last_tournament_poll.elapsed() >= Duration::from_secs(60) {
                    if let Err(error) = poll_tournaments(&http, &backend, &frontend_url).await {
                        tracing::error!(%error, "Discord tournament feed poll failed");
                    }
                    last_tournament_poll = tokio::time::Instant::now();
                }
                tokio::select! {
                    _ = tokio::time::sleep(Duration::from_secs(5)) => {},
                    _ = wake.notified() => {},
                }
            }
        }));
    }

    pub async fn stop(&self) {
        self.stopped.store(true, Ordering::Release);
        self.wake.notify_waiters();
        if let Some(task) = self.task.lock().await.take() {
            let _ = task.await;
        }
    }
}

async fn poll_activity(http: &Http, backend: &Backend, frontend_url: &reqwest::Url) -> Result<()> {
    let feeds = backend.enabled_feeds().await?;
    let watch_cursor = backend.worker_cursor(WATCH_CURSOR).await?;
    let cursor = feeds
        .iter()
        .filter_map(|feed| feed.cursor_event_id.parse::<i64>().ok())
        .chain(watch_cursor.cursor_event_id.parse::<i64>())
        .min()
        .unwrap_or_default();
    let events = backend.events_after(cursor).await?;
    let mut watch_cursor = watch_cursor
        .cursor_event_id
        .parse::<i64>()
        .unwrap_or_default();
    let mut watch_blocked = false;
    let mut feed_cursors = feeds
        .iter()
        .filter_map(|feed| {
            Some((
                (feed.guild_id.clone(), feed.kind.clone()),
                feed.cursor_event_id.parse::<i64>().ok()?,
            ))
        })
        .collect::<BTreeMap<_, _>>();
    for event in events {
        let event_id = event
            .id
            .parse::<i64>()
            .context("Invalid activity event ID")?;
        if event_id > watch_cursor && !watch_blocked {
            match deliver_watches(http, backend, frontend_url, &event).await {
                Ok(()) => {
                    backend.advance_worker(WATCH_CURSOR, &event.id).await?;
                    watch_cursor = event_id;
                }
                Err(error) => {
                    watch_blocked = true;
                    tracing::error!(event_id = %event.id, %error, "Discord activity watch delivery failed");
                }
            }
        }
        for feed in &feeds {
            let key = (feed.guild_id.clone(), feed.kind.clone());
            let feed_cursor = feed_cursors.get(&key).copied().unwrap_or_default();
            if event_id <= feed_cursor || feed_kind(&event.kind) != Some(feed.kind.as_str()) {
                continue;
            }
            match deliver_feed(http, backend, frontend_url, feed, &event).await {
                Ok(()) => {
                    backend
                        .advance_feed(&feed.guild_id, &feed.kind, &event.id)
                        .await?;
                    feed_cursors.insert(key, event_id);
                }
                Err(error) => {
                    tracing::error!(
                        guild_id = %feed.guild_id,
                        channel_id = %feed.channel_id,
                        feed_kind = %feed.kind,
                        event_id = %event.id,
                        %error,
                        "Discord activity feed delivery failed"
                    );
                }
            }
        }
    }
    Ok(())
}

async fn poll_tournaments(
    http: &Http,
    backend: &Backend,
    frontend_url: &reqwest::Url,
) -> Result<()> {
    let feeds = backend.enabled_feeds().await?;
    let snapshots = backend.current_tournaments().await?;
    for snapshot in snapshots {
        let kind = match snapshot.tournament_type {
            0 => "totw",
            1 => "totm",
            _ => continue,
        };
        let content_hash = tournament_hash(&snapshot)?;
        deliver_tournament_watches(http, backend, frontend_url, &snapshot, kind, &content_hash)
            .await?;
        for feed in feeds
            .iter()
            .filter(|feed| feed.enabled && feed.kind == kind)
        {
            if let Err(error) =
                update_tournament_feed(http, backend, frontend_url, feed, &snapshot, &content_hash)
                    .await
            {
                tracing::error!(
                    guild_id = %feed.guild_id,
                    channel_id = %feed.channel_id,
                    feed_kind = kind,
                    %error,
                    "Discord tournament feed update failed"
                );
            }
        }
    }
    Ok(())
}

async fn update_tournament_feed(
    http: &Http,
    backend: &Backend,
    frontend_url: &reqwest::Url,
    feed: &GuildFeed,
    snapshot: &TournamentSnapshot,
    content_hash: &str,
) -> Result<()> {
    let state = backend.guild_runtime(&feed.guild_id).await?;
    let existing = state
        .tournament_messages
        .iter()
        .find(|message| message.id_tournament == snapshot.tournament_id);
    if existing.is_some_and(|message| {
        message.content_hash == content_hash && message.channel_id == feed.channel_id
    }) {
        return Ok(());
    }
    let channel_id = feed
        .channel_id
        .parse::<u64>()
        .context("Invalid Discord tournament channel ID")?;
    let components = tournament_components(snapshot, frontend_url);
    let message_id =
        if let Some(existing) = existing.filter(|message| message.channel_id == feed.channel_id) {
            let message_id = existing
                .message_id
                .parse::<u64>()
                .context("Invalid Discord tournament message ID")?;
            ChannelId::new(channel_id)
                .widen()
                .edit_message(
                    http,
                    MessageId::new(message_id),
                    EditMessage::new()
                        .components(components)
                        .flags(MessageFlags::IS_COMPONENTS_V2)
                        .allowed_mentions(CreateAllowedMentions::new()),
                )
                .await?
                .id
                .get()
        } else {
            ChannelId::new(channel_id)
                .widen()
                .send_message(
                    http,
                    CreateMessage::new()
                        .components(components)
                        .flags(MessageFlags::IS_COMPONENTS_V2)
                        .allowed_mentions(CreateAllowedMentions::new()),
                )
                .await?
                .id
                .get()
        };
    backend
        .set_tournament_message(
            &feed.guild_id,
            snapshot.tournament_id,
            &feed.channel_id,
            message_id,
            content_hash,
        )
        .await?;
    Ok(())
}

async fn deliver_tournament_watches(
    http: &Http,
    backend: &Backend,
    frontend_url: &reqwest::Url,
    snapshot: &TournamentSnapshot,
    kind: &str,
    content_hash: &str,
) -> Result<()> {
    let delivery_key = format!("tournament:{}:{content_hash}", snapshot.tournament_id);
    let watches = backend
        .matching_watch_targets(serde_json::json!([{
            "kind":"tournament",
            "targetIds":[snapshot.tournament_id.to_string(),snapshot.tournament_slug,kind]
        }]))
        .await?;
    let mut recipients = BTreeMap::<String, Vec<MatchingWatch>>::new();
    for watch in watches {
        if watch.last_delivery_key.as_deref() != Some(&delivery_key) {
            recipients
                .entry(watch.discord_id.clone())
                .or_default()
                .push(watch);
        }
    }
    for (discord_id, watches) in recipients {
        let user_id = discord_id
            .parse::<u64>()
            .context("Invalid Discord watch recipient")?;
        let result = async {
            let channel = UserId::new(user_id).create_dm_channel(http).await?;
            channel
                .id
                .widen()
                .send_message(
                    http,
                    CreateMessage::new()
                        .components(tournament_components(snapshot, frontend_url))
                        .flags(MessageFlags::IS_COMPONENTS_V2)
                        .allowed_mentions(CreateAllowedMentions::new()),
                )
                .await?;
            serenity::Result::<()>::Ok(())
        }
        .await;
        match result {
            Ok(()) => {
                for watch in watches {
                    backend
                        .update_watch(&watch.id, false, None, Some(&delivery_key))
                        .await?;
                }
            }
            Err(error) => {
                let paused = permanent_dm_failure(&error);
                let summary = bounded_error(&error);
                for watch in watches {
                    backend
                        .update_watch(&watch.id, paused, Some(&summary), None)
                        .await?;
                }
                if !paused {
                    return Err(error.into());
                }
            }
        }
    }
    Ok(())
}

fn tournament_hash(snapshot: &TournamentSnapshot) -> Result<String> {
    let digest = Sha256::digest(serde_json::to_vec(snapshot)?);
    Ok(digest.iter().map(|byte| format!("{byte:02x}")).collect())
}

pub(crate) fn tournament_components(
    snapshot: &TournamentSnapshot,
    frontend_url: &reqwest::Url,
) -> Vec<CreateComponent<'static>> {
    let name = if snapshot.tournament_type == 0 {
        "Track of the Week"
    } else {
        "Track of the Month"
    };
    let standings = if snapshot.standings.is_empty() {
        "No submitted times yet.".into()
    } else {
        snapshot
            .standings
            .iter()
            .map(|standing| {
                format!(
                    "**{}.** {} • {} • {} pts",
                    standing.rank,
                    standing.steam_name.as_deref().unwrap_or("Unknown player"),
                    format_time(standing.time),
                    standing.points
                )
            })
            .collect::<Vec<_>>()
            .join("\n")
    };
    let route = if snapshot.tournament_type == 0 {
        "totw"
    } else {
        "totm"
    };
    let target = frontend_url
        .join(&format!("/{route}/{}", snapshot.tournament_slug))
        .map(|url| url.to_string())
        .unwrap_or_else(|_| frontend_url.to_string());
    vec![CreateComponent::Container(
        CreateContainer::new(vec![
            CreateContainerComponent::TextDisplay(CreateTextDisplay::new(format!(
                "## {name} • {}\nCurrent competition standings\n### Tournament details\n**Level**  {}\n**Entries**  {}\n**Ends**  {}\n### Leaderboard\n{standings}\n-# ZeepCentraal",
                snapshot.tournament_slug,
                snapshot.level_name,
                snapshot.entries,
                snapshot.end_at,
            ))),
            CreateContainerComponent::ActionRow(
                serenity::builder::CreateActionRow::buttons(vec![
                    CreateButton::new_link(target).label(format!(
                        "Open {}",
                        if snapshot.tournament_type == 0 {
                            "TOTW"
                        } else {
                            "TOTM"
                        }
                    )),
                    CreateButton::new_link(
                        frontend_url
                            .join(&format!(
                                "/api/tournaments/playlist?type={}&slug={}",
                                snapshot.tournament_type, snapshot.tournament_slug
                            ))
                            .map(|url| url.to_string())
                            .unwrap_or_else(|_| frontend_url.to_string()),
                    )
                    .label("Download level playlist"),
                ]),
            ),
        ])
        .accent_color(Colour::DARK_GREEN),
    )]
}

async fn deliver_feed(
    http: &Http,
    backend: &Backend,
    frontend_url: &reqwest::Url,
    feed: &GuildFeed,
    event: &ActivityEvent,
) -> Result<()> {
    if !feed.enabled {
        return Ok(());
    }
    if backend
        .delivery(&feed.guild_id, &event.id)
        .await?
        .is_some_and(|delivery| delivery.status == "sent")
    {
        return Ok(());
    }
    backend
        .set_delivery(
            &feed.guild_id,
            &event.id,
            &feed.channel_id,
            None,
            "pending",
            None,
        )
        .await?;
    let channel_id = feed
        .channel_id
        .parse::<u64>()
        .context("Invalid Discord feed channel ID")?;
    match ChannelId::new(channel_id)
        .widen()
        .send_message(
            http,
            event_message(event, frontend_url, Some(backend)).await,
        )
        .await
    {
        Ok(message) => {
            backend
                .set_delivery(
                    &feed.guild_id,
                    &event.id,
                    &feed.channel_id,
                    Some(message.id.get()),
                    "sent",
                    None,
                )
                .await?;
            Ok(())
        }
        Err(error) => {
            let summary = bounded_error(&error);
            backend
                .set_delivery(
                    &feed.guild_id,
                    &event.id,
                    &feed.channel_id,
                    None,
                    "failed",
                    Some(&summary),
                )
                .await?;
            Err(error.into())
        }
    }
}

async fn deliver_watches(
    http: &Http,
    backend: &Backend,
    frontend_url: &reqwest::Url,
    event: &ActivityEvent,
) -> Result<()> {
    let delivery_key = format!("event:{}", event.id);
    let watches = backend.matching_watches(event).await?;
    let mut recipients = BTreeMap::<String, Vec<MatchingWatch>>::new();
    for watch in watches {
        if watch.last_delivery_key.as_deref() != Some(&delivery_key) {
            recipients
                .entry(watch.discord_id.clone())
                .or_default()
                .push(watch);
        }
    }
    for (discord_id, watches) in recipients {
        let user_id = discord_id
            .parse::<u64>()
            .context("Invalid Discord watch recipient")?;
        let result = async {
            let channel = UserId::new(user_id).create_dm_channel(http).await?;
            channel
                .id
                .widen()
                .send_message(http, event_message(event, frontend_url, None).await)
                .await?;
            serenity::Result::<()>::Ok(())
        }
        .await;
        match result {
            Ok(()) => {
                for watch in watches {
                    backend
                        .update_watch(&watch.id, false, None, Some(&delivery_key))
                        .await?;
                }
            }
            Err(error) => {
                let paused = permanent_dm_failure(&error);
                let summary = bounded_error(&error);
                for watch in watches {
                    backend
                        .update_watch(&watch.id, paused, Some(&summary), None)
                        .await?;
                }
                if !paused {
                    return Err(error.into());
                }
            }
        }
    }
    Ok(())
}

fn feed_kind(event: &str) -> Option<&'static str> {
    match event {
        "workshop" => Some("workshop"),
        "world_record" => Some("world_record"),
        "rank_batch" => Some("rank"),
        _ => None,
    }
}

async fn event_message(
    event: &ActivityEvent,
    frontend_url: &reqwest::Url,
    preference_backend: Option<&Backend>,
) -> CreateMessage<'static> {
    let item = event
        .level
        .as_ref()
        .and_then(|level| level.level_items.nodes.first());
    let level_name = item.map_or("Unknown level", |item| item.name.as_str());
    let player = event
        .user
        .as_ref()
        .and_then(|user| user.steam_name.as_deref())
        .unwrap_or("Unknown player");
    let title = match event.kind.as_str() {
        "workshop" => "New public workshop level",
        "personal_best" => "New personal best",
        "world_record" => "New world record",
        "rank_batch" => "Rankings updated",
        "vote" => "Level vote",
        _ => "ZeepCentraal activity",
    };
    let loss_ping = world_record_loss_ping(event, preference_backend).await;
    let detail = match event.kind.as_str() {
        "workshop" => format!(
            "**{level_name}**\nBy {}\nWorkshop ID: {}",
            item.and_then(|item| item.author.as_ref())
                .and_then(|user| user.steam_name.as_deref())
                .unwrap_or("Unknown author"),
            item.and_then(|item| item.workshop_id.as_deref())
                .unwrap_or("Unknown")
        ),
        "personal_best" => format!(
            "**{level_name}**\n{player} • {}",
            event
                .record
                .as_ref()
                .map_or_else(|| "Unknown time".into(), |record| format_time(record.time))
        ),
        "world_record" => format!(
            "{}**{level_name}**\n{player} • {}\n{}",
            loss_ping
                .map(|user| format!("<@{}> your world record was beaten.\n", user.get()))
                .unwrap_or_default(),
            event
                .record
                .as_ref()
                .map_or_else(|| "Unknown time".into(), |record| format_time(record.time)),
            world_record_context(event)
        ),
        "rank_batch" => format!(
            "{} player ranks changed.",
            event
                .payload
                .get("changes")
                .and_then(serde_json::Value::as_array)
                .map_or(0, Vec::len)
        ),
        "vote" => format!(
            "**{level_name}**\n{player} voted {}.",
            event
                .payload
                .get("value")
                .map_or_else(|| "Unknown".into(), ToString::to_string)
        ),
        _ => "New ZeepCentraal activity.".into(),
    };
    let mut components = vec![CreateContainerComponent::TextDisplay(
        CreateTextDisplay::new(format!(
            "## {title}\n{detail}\n-# ZeepCentraal • {}",
            event.occurred_at
        )),
    )];
    if let Some(level) = &event.level {
        let target = frontend_url
            .join(&format!("/level/{}", level.xx_hash))
            .map(|url| url.to_string())
            .unwrap_or_else(|_| frontend_url.to_string());
        components.push(CreateContainerComponent::ActionRow(
            serenity::builder::CreateActionRow::buttons(vec![
                CreateButton::new_link(target).label("Open level"),
            ]),
        ));
    }
    let allowed_mentions = loss_ping.map_or_else(CreateAllowedMentions::new, |user| {
        CreateAllowedMentions::new().push_user(user)
    });
    CreateMessage::new()
        .components(vec![CreateComponent::Container(
            CreateContainer::new(components).accent_color(Colour::DARK_GREEN),
        )])
        .flags(MessageFlags::IS_COMPONENTS_V2)
        .allowed_mentions(allowed_mentions)
}

async fn world_record_loss_ping(
    event: &ActivityEvent,
    backend: Option<&Backend>,
) -> Option<UserId> {
    if event.kind != "world_record"
        || event.previous_record.is_none()
        || event.user_id == event.previous_user_id
    {
        return None;
    }
    let discord_id = event.previous_user.as_ref()?.discord_id.as_deref()?;
    let user_id = discord_id.parse::<u64>().ok().filter(|id| *id > 0)?;
    let state = backend?.user(user_id).await.ok()?;
    state
        .preference
        .as_ref()
        .and_then(|value| value.get("pingOnWorldRecordLoss"))
        .and_then(serde_json::Value::as_bool)
        .filter(|enabled| *enabled)
        .map(|_| UserId::new(user_id))
}

fn world_record_context(event: &ActivityEvent) -> String {
    let Some(previous) = &event.previous_record else {
        return "First record set on this level.".into();
    };
    if event.user_id.is_some() && event.user_id == event.previous_user_id {
        return event.record.as_ref().map_or_else(
            || "Personal world record improved.".into(),
            |record| format!("Improved by {:.3}s", previous.time - record.time),
        );
    }
    format!(
        "Stolen from {} ({})",
        event
            .previous_user
            .as_ref()
            .and_then(|user| user.steam_name.as_deref())
            .unwrap_or("Unknown player"),
        format_time(previous.time)
    )
}

fn format_time(seconds: f32) -> String {
    let milliseconds = (seconds * 1_000.0).round() as i64;
    format!(
        "{:02}:{:02}.{:03}",
        milliseconds / 60_000,
        milliseconds / 1_000 % 60,
        milliseconds % 1_000
    )
}

fn permanent_dm_failure(error: &serenity::Error) -> bool {
    matches!(
        error,
        serenity::Error::Http(error)
            if error.status_code().is_some_and(|status| status.as_u16() == 403 || status.as_u16() == 404)
    )
}

fn bounded_error(error: &impl std::fmt::Display) -> String {
    error
        .to_string()
        .replace(['\r', '\n', '\t'], " ")
        .chars()
        .take(1_000)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_only_public_feed_event_kinds() {
        assert_eq!(feed_kind("workshop"), Some("workshop"));
        assert_eq!(feed_kind("world_record"), Some("world_record"));
        assert_eq!(feed_kind("rank_batch"), Some("rank"));
        assert_eq!(feed_kind("personal_best"), None);
    }

    #[test]
    fn formats_record_times() {
        assert_eq!(format_time(61.2346), "01:01.235");
    }
}
