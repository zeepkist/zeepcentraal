use crate::twitch::Stream;
use serde::{Deserialize, Serialize};
use serenity::{
    all::MessageFlags,
    builder::{
        CreateActionRow, CreateAllowedMentions, CreateButton, CreateComponent, CreateContainer,
        CreateContainerComponent, CreateMediaGallery, CreateMediaGalleryItem, CreateTextDisplay,
        CreateUnfurledMediaItem,
    },
};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct Snapshot {
    pub stream: Stream,
    pub peak_viewers: i32,
    pub ended_at: Option<i64>,
    pub thumbnail_revision: i64,
}

impl Snapshot {
    pub fn live(stream: Stream, peak: i32, now: i64) -> Self {
        Self {
            peak_viewers: peak.max(stream.viewer_count),
            stream,
            ended_at: None,
            thumbnail_revision: now / 300,
        }
    }
    pub fn finish(mut self, now: i64) -> Self {
        self.ended_at = Some(now);
        self.stream.viewer_count = 0;
        self
    }
    pub fn components(&self) -> Vec<CreateComponent<'static>> {
        let live = self.ended_at.is_none();
        let started = self
            .stream
            .started_at
            .parse::<jiff::Timestamp>()
            .map(|t| t.as_second())
            .unwrap_or(0);
        let status = if live {
            "LIVE ON TWITCH"
        } else {
            "STREAM FINISHED"
        };
        let timing = match self.ended_at {
            Some(end) => format!(
                "**Time live** {} · Finished <t:{end}:R>",
                duration(end.saturating_sub(started))
            ),
            None => format!("**Time live** Started <t:{started}:R>"),
        };
        let mut children = vec![CreateContainerComponent::TextDisplay(
            CreateTextDisplay::new(format!(
                "-# {status} · {}\n## {}\n**{}**\n{timing}\n**Current viewers** {}  ·  **Peak viewers** {}",
                escape(&self.stream.game_name),
                escape(&self.stream.title),
                escape(&self.stream.user_name),
                self.stream.viewer_count,
                self.peak_viewers,
            )),
        )];
        if let Some(image) = thumbnail(&self.stream.thumbnail_url, self.thumbnail_revision) {
            children.push(CreateContainerComponent::MediaGallery(
                CreateMediaGallery::new(vec![
                    CreateMediaGalleryItem::new(CreateUnfurledMediaItem::new(image))
                        .description("Stream preview"),
                ]),
            ));
        }
        let url = format!("https://www.twitch.tv/{}", self.stream.user_login);
        children.push(CreateContainerComponent::ActionRow(
            CreateActionRow::buttons(vec![CreateButton::new_link(url).label(if live {
                "Watch stream"
            } else {
                "Visit channel"
            })]),
        ));
        children.push(CreateContainerComponent::TextDisplay(
            CreateTextDisplay::new("-# Streamkist · Peak viewers observed while tracking"),
        ));
        vec![CreateComponent::Container(
            CreateContainer::new(children).accent_color(if live { 0x9146ff } else { 0x586570 }),
        )]
    }
}

pub fn flags() -> MessageFlags {
    MessageFlags::IS_COMPONENTS_V2
}
pub fn mentions() -> CreateAllowedMentions<'static> {
    CreateAllowedMentions::new()
}

pub fn notice(title: &str, text: &str, error: bool) -> Vec<CreateComponent<'static>> {
    vec![CreateComponent::Container(
        CreateContainer::new(vec![CreateContainerComponent::TextDisplay(
            CreateTextDisplay::new(format!("## {title}\n{text}\n-# Streamkist")),
        )])
        .accent_color(if error { 0xed4245 } else { 0x9146ff }),
    )]
}

fn thumbnail(template: &str, revision: i64) -> Option<String> {
    let mut url: reqwest::Url = template
        .replace("{width}", "1280")
        .replace("{height}", "720")
        .parse()
        .ok()?;
    if !matches!(url.scheme(), "http" | "https") {
        return None;
    }
    url.query_pairs_mut()
        .append_pair("streamkist", &revision.to_string());
    Some(url.into())
}

pub fn escape(text: &str) -> String {
    text.chars()
        .flat_map(|c| {
            if "\\*_~`|[]<>".contains(c) {
                vec!['\\', c]
            } else {
                vec![c]
            }
        })
        .collect()
}

fn duration(seconds: i64) -> String {
    let seconds = seconds.max(0);
    format!("{}h {}m", seconds / 3600, seconds / 60 % 60)
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    pub fn stream() -> Stream {
        serde_json::from_value(serde_json::json!({"id":"123", "user_id":"42", "user_login":"fixture", "user_name":"Fixture", "game_id":"9", "game_name":"Zeepkist", "title":"Racing", "viewer_count":12, "started_at":"2026-10-10T12:00:00Z", "thumbnail_url":"https://example.com/{width}x{height}.jpg"})).unwrap()
    }
    #[test]
    fn live_card_has_large_image_stats_relative_time_and_watch_button() {
        let card = Snapshot::live(stream(), 20, 1791637200);
        let value = serde_json::to_value(card.components()).unwrap();
        assert_eq!(value[0]["type"], 17);
        assert_eq!(value[0]["accent_color"], 0x9146ff);
        let children = &value[0]["components"];
        assert!(
            children[0]["content"]
                .as_str()
                .unwrap()
                .contains("**Current viewers** 12  ·  **Peak viewers** 20")
        );
        assert!(children[0]["content"].as_str().unwrap().contains(":R>"));
        assert_eq!(children[1]["type"], 12);
        assert!(
            children[1]["items"][0]["media"]["url"]
                .as_str()
                .unwrap()
                .contains("1280x720")
        );
        assert_eq!(
            children[2]["components"][0]["url"],
            "https://www.twitch.tv/fixture"
        );
        assert_eq!(children[2]["components"][0]["label"], "Watch stream");
        assert_eq!(
            serde_json::to_value(mentions()).unwrap()["parse"],
            serde_json::json!([])
        );
    }
    #[test]
    fn finished_card_freezes_duration_and_peak() {
        let card = Snapshot::live(stream(), 20, 1791637200).finish(1791637200);
        let value = serde_json::to_value(card.components()).unwrap();
        let text = value[0]["components"][0]["content"].as_str().unwrap();
        assert!(text.contains("STREAM FINISHED"));
        assert!(text.contains("1h 0m"));
        assert!(text.contains("**Current viewers** 0  ·  **Peak viewers** 20"));
        assert_eq!(
            value[0]["components"][2]["components"][0]["label"],
            "Visit channel"
        );
    }
}
