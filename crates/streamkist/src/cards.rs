use crate::twitch::Stream;
use serde::{Deserialize, Serialize};
use serenity::{
    all::MessageFlags,
    builder::{
        CreateActionRow, CreateAllowedMentions, CreateButton, CreateComponent, CreateContainer,
        CreateContainerComponent, CreateSection, CreateSectionAccessory, CreateSectionComponent,
        CreateTextDisplay, CreateThumbnail, CreateUnfurledMediaItem,
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
        let status = if live { "Streaming" } else { "Streamed" };
        let timing = match self.ended_at {
            Some(end) => format!(
                "**Time live** {} · Finished <t:{end}:R>",
                duration(end.saturating_sub(started))
            ),
            None => format!("**Time live** Started <t:{started}:R>"),
        };
        let details = CreateTextDisplay::new(format!(
            "-# {status} {} on Twitch\n## {}\n**{}**\n{timing}\n**Current viewers** {}  ·  **Peak viewers** {}",
            escape(&self.stream.game_name),
            escape(&self.stream.title),
            escape(&self.stream.user_name),
            self.stream.viewer_count,
            self.peak_viewers,
        ));
        let header = match live
            .then(|| thumbnail(&self.stream.thumbnail_url, self.thumbnail_revision))
            .flatten()
        {
            Some(image) => CreateContainerComponent::Section(CreateSection::new(
                vec![CreateSectionComponent::TextDisplay(details)],
                CreateSectionAccessory::Thumbnail(CreateThumbnail::new(
                    CreateUnfurledMediaItem::new(image),
                )),
            )),
            None => CreateContainerComponent::TextDisplay(details),
        };
        let mut children = vec![header];
        let url = format!("https://www.twitch.tv/{}", self.stream.user_login);
        children.push(CreateContainerComponent::ActionRow(
            CreateActionRow::buttons(vec![CreateButton::new_link(url).label(if live {
                "Watch stream"
            } else {
                "Visit channel"
            })]),
        ));
        children.push(CreateContainerComponent::TextDisplay(
            CreateTextDisplay::new("-# Streamkist"),
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
        .replace("{width}", "320")
        .replace("{height}", "180")
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
    fn live_card_has_small_thumbnail_without_alt_text_and_watch_button() {
        let card = Snapshot::live(stream(), 20, 1791637200);
        let value = serde_json::to_value(card.components()).unwrap();
        assert_eq!(value[0]["type"], 17);
        assert_eq!(value[0]["accent_color"], 0x9146ff);
        let children = &value[0]["components"];
        let text = &children[0]["components"][0]["content"];
        assert!(
            text.as_str()
                .unwrap()
                .contains("**Current viewers** 12  ·  **Peak viewers** 20")
        );
        assert!(text.as_str().unwrap().contains(":R>"));
        assert!(
            text.as_str()
                .unwrap()
                .starts_with("-# Streaming Zeepkist on Twitch")
        );
        assert_eq!(children[0]["type"], 9);
        let image = &children[0]["accessory"];
        assert_eq!(image["type"], 11);
        assert!(
            image
                .get("description")
                .is_none_or(serde_json::Value::is_null)
        );
        assert!(
            image["media"]["url"]
                .as_str()
                .unwrap()
                .contains("320x180.jpg?streamkist=5972124")
        );
        assert_eq!(
            children[1]["components"][0]["url"],
            "https://www.twitch.tv/fixture"
        );
        assert_eq!(children[1]["components"][0]["label"], "Watch stream");
        assert_eq!(children[2]["content"], "-# Streamkist");
        assert_eq!(
            serde_json::to_value(mentions()).unwrap()["parse"],
            serde_json::json!([])
        );
    }
    #[test]
    fn live_card_without_valid_thumbnail_keeps_text_and_actions() {
        for url in ["", "not a URL", "file:///preview.jpg"] {
            let mut stream = stream();
            stream.thumbnail_url = url.to_owned();
            let value =
                serde_json::to_value(Snapshot::live(stream, 20, 1791637200).components()).unwrap();
            let children = &value[0]["components"];
            assert_eq!(children[0]["type"], 10);
            assert!(
                children[0]["content"]
                    .as_str()
                    .unwrap()
                    .contains("Streaming Zeepkist on Twitch")
            );
            assert_eq!(children[1]["components"][0]["label"], "Watch stream");
            assert_eq!(children[2]["content"], "-# Streamkist");
        }
    }
    #[test]
    fn finished_card_freezes_duration_and_peak() {
        let card = Snapshot::live(stream(), 20, 1791637200).finish(1791637200);
        let value = serde_json::to_value(card.components()).unwrap();
        let text = value[0]["components"][0]["content"].as_str().unwrap();
        assert!(text.starts_with("-# Streamed Zeepkist on Twitch"));
        assert_eq!(value[0]["components"][0]["type"], 10);
        assert!(!value.to_string().contains("example.com"));
        assert!(text.contains("1h 0m"));
        assert!(text.contains("**Current viewers** 0  ·  **Peak viewers** 20"));
        assert_eq!(
            value[0]["components"][1]["components"][0]["label"],
            "Visit channel"
        );
        assert_eq!(value[0]["components"][2]["content"], "-# Streamkist");
    }
}
