//! Delete/repost Components V2 playlist delivery with restart-safe attachment recovery.
use crate::{
    discord::{DeliveryError, DiscordRest},
    publication::escape_text,
};
use anyhow::{Context, Result, ensure};
use reqwest::Method;
use serde_json::Value;
use serenity::{
    builder::{
        CreateActionRow, CreateAllowedMentions, CreateButton, CreateComponent, CreateContainer,
        CreateContainerComponent, CreateFile, CreateMessage, CreateTextDisplay,
        CreateUnfurledMediaItem,
    },
    model::channel::MessageFlags,
};
use zc_core::object_storage::{DownloadConstraints, ObjectStorage};

fn marker(contest: i64, playlist: i64) -> String {
    format!("zc-playlist:{contest}:{playlist}")
}
pub fn playlist_payload(
    contest: i64,
    playlist: i64,
    name: &str,
    count: i64,
    filename: &str,
) -> Result<Value> {
    let message = CreateMessage::new().flags(MessageFlags::IS_COMPONENTS_V2)
        .allowed_mentions(CreateAllowedMentions::new().replied_user(false))
        .components(vec![CreateComponent::Container(CreateContainer::new(vec![
            CreateContainerComponent::TextDisplay(CreateTextDisplay::new(format!("## {} — Submissions\n**{count} valid submissions**\nDownload playlist to play submitted levels.", escape_text(name)))),
            CreateContainerComponent::File(CreateFile::new(CreateUnfurledMediaItem::new(format!("attachment://{filename}"))).spoiler(false)),
            CreateContainerComponent::ActionRow(CreateActionRow::buttons(vec![CreateButton::new_link("https://zeepki.st/super-league/submit-level").label("Submit your level")])),
            CreateContainerComponent::TextDisplay(CreateTextDisplay::new(format!("-# {}",marker(contest,playlist)))),
        ]).accent_color(0xfacc15))]);
    let mut payload = serde_json::to_value(message)?;
    // Serenity serializes builders; reqwest supplies attachment bytes as multipart.
    payload
        .as_object_mut()
        .context("Invalid message")?
        .retain(|key, _| ["components", "flags", "allowed_mentions"].contains(&key.as_str()));
    payload["attachments"] = serde_json::json!([{ "id":0,"filename":filename }]);
    payload["nonce"] = format!("zcp{playlist}").into();
    payload["enforce_nonce"] = true.into();
    Ok(payload)
}

async fn deliver(
    database: &zc_database::Database,
    discord: &DiscordRest,
    storage: &dyn ObjectStorage,
    channel: &str,
    row: &Value,
) -> Result<()> {
    let contest = row["contestId"]
        .as_i64()
        .context("Playlist contest missing")?;
    let playlist = row["playlistId"].as_i64().context("Playlist ID missing")?;
    let count = row["validCount"]
        .as_i64()
        .context("Playlist count missing")?;
    let filename = format!("zsl-submissions-{contest}.zeeplist");
    let mut payload = playlist_payload(
        contest,
        playlist,
        row["name"].as_str().unwrap_or("Zeepkist Super League"),
        count,
        &filename,
    )?;
    payload["nonce"] =
        crate::validation::sha256(format!("{contest}:{playlist}:{channel}").as_bytes())[..24]
            .into();
    // Preflight before destructive replacement. Published artifact digest includes validation identity,
    // so it is not a SHA256 checksum of these bytes.
    let bytes = if count > 0 {
        let bytes = storage
            .download(
                row["objectKey"]
                    .as_str()
                    .context("Playlist object missing")?,
                DownloadConstraints {
                    max_bytes: 2 * 1024 * 1024,
                    ..Default::default()
                },
            )
            .await?;
        let artifact: Value = serde_json::from_slice(&bytes)?;
        ensure!(
            artifact["amountOfLevels"].as_i64() == Some(count)
                && artifact["levels"]
                    .as_array()
                    .is_some_and(|entries| entries.len() == count as usize),
            "Published playlist count mismatch"
        );
        bytes
    } else {
        Vec::new()
    };
    let mut message = row["messageId"].as_str().map(str::to_owned);
    let mut previous_channel = row["channelId"].as_str().map(str::to_owned);
    let mut delivered = row["deliveredPlaylistId"].as_i64();
    if let Some(attempt) = row["attemptPlaylistId"].as_i64() {
        let attempted_channel = row["attemptChannelId"]
            .as_str()
            .context("Playlist attempt channel missing")?;
        message = discord
            .recover_message(attempted_channel, &marker(contest, attempt))
            .await?;
        database
            .recover_playlist_notification(contest, message.as_deref(), attempted_channel)
            .await?;
        delivered = message.as_ref().map(|_| attempt);
        previous_channel = Some(attempted_channel.to_owned());
    }
    if delivered == Some(playlist)
        && previous_channel.as_deref() == Some(channel)
        && (count == 0 || message.is_some())
    {
        return Ok(());
    }
    if let Some(existing) = message {
        let old_channel = previous_channel
            .as_deref()
            .context("Previous playlist channel missing")?;
        match discord
            .request(
                &format!("channels/{old_channel}/messages/{existing}"),
                Method::DELETE,
                None,
            )
            .await
        {
            Ok(_) => {}
            Err(error)
                if error
                    .downcast_ref::<DeliveryError>()
                    .is_some_and(|error| error.status == 404) => {}
            Err(error) => return Err(error),
        }
        database.clear_playlist_message(contest).await?;
    }
    if count == 0 {
        return database
            .finish_playlist_notification(contest, playlist, channel, None)
            .await;
    }
    database
        .begin_playlist_notification(contest, playlist, channel)
        .await?;
    let sent = discord
        .send_attachment(channel, &payload, &filename, bytes)
        .await?;
    let message = sent["id"].as_str().context("Discord message omitted ID")?;
    database
        .finish_playlist_notification(contest, playlist, channel, Some(message))
        .await
}

pub async fn deliver_playlist_notifications(
    database: &zc_database::Database,
    discord: &DiscordRest,
    storage: &dyn ObjectStorage,
    channel: &str,
    rounds: &[i32],
) -> Result<()> {
    database.sync_playlist_notifications(rounds).await?;
    for row in database
        .pending_playlist_notifications(rounds, channel)
        .await?
    {
        if let Err(error) = deliver(database, discord, storage, channel, &row).await {
            let contest = row["contestId"]
                .as_i64()
                .context("Playlist contest missing")?;
            let delay = error
                .downcast_ref::<DeliveryError>()
                .map_or(60, |error| error.retry_after);
            database.retry_playlist_notification(contest, delay).await?;
            tracing::warn!(contest_id=contest,%error,"Playlist notification deferred");
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn attachment_components_and_submission_link() {
        let payload =
            playlist_payload(42, 99, "@everyone **Theme**", 3, "submissions.zeeplist").unwrap();
        assert_eq!(payload["flags"], MessageFlags::IS_COMPONENTS_V2.bits());
        assert!(payload.get("content").is_none());
        assert!(payload.get("embeds").is_none());
        assert_eq!(payload["allowed_mentions"]["parse"], serde_json::json!([]));
        assert_eq!(
            payload["attachments"][0]["filename"],
            "submissions.zeeplist"
        );
        let components = &payload["components"][0]["components"];
        assert_eq!(components[1]["type"], 13);
        assert_eq!(
            components[1]["file"]["url"],
            "attachment://submissions.zeeplist"
        );
        assert_eq!(
            components[2]["components"][0]["url"],
            "https://zeepki.st/super-league/submit-level"
        );
        assert_eq!(components[3]["content"], "-# zc-playlist:42:99");
        assert!(!payload.to_string().contains("@everyone"));
    }
}
