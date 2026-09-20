//! Discord Components V2 presentation and bounded interaction sessions.
pub mod backend;
pub mod commands;
pub mod config;
pub mod feeds;
pub mod health;
pub mod pagination;
pub mod runtime;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use serenity::builder::*;
use serenity::model::channel::MessageFlags;
use std::collections::VecDeque;

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Display {
    pub title: String,
    pub description: String,
    #[serde(default)]
    pub sections: Vec<Section>,
    pub thumbnail: Option<String>,
    pub filename: Option<String>,
    pub button: Option<String>,
}
#[derive(Clone, Deserialize, Serialize)]
pub struct Section {
    pub heading: String,
    pub content: String,
}

/// The same display composition as packages/discord/src/display.ts, using native V2 builders.
pub fn message(input: &Display) -> anyhow::Result<Value> {
    let header = format!("## {}\n{}", input.title, input.description);
    let mut components = Vec::new();
    if let Some(url) = &input.thumbnail {
        components.push(CreateContainerComponent::Section(CreateSection::new(
            vec![CreateSectionComponent::TextDisplay(CreateTextDisplay::new(
                header,
            ))],
            CreateSectionAccessory::Thumbnail(
                CreateThumbnail::new(CreateUnfurledMediaItem::new(url.clone()))
                    .description("Evaluation thumbnail"),
            ),
        )));
    } else {
        components.push(CreateContainerComponent::TextDisplay(
            CreateTextDisplay::new(header),
        ));
    }
    for section in &input.sections {
        components.push(CreateContainerComponent::Separator(
            CreateSeparator::new()
                .divider(true)
                .spacing(serenity::model::application::SeparatorSpacingSize::Small),
        ));
        components.push(CreateContainerComponent::TextDisplay(
            CreateTextDisplay::new(format!("### {}\n{}", section.heading, section.content)),
        ));
    }
    if let Some(id) = &input.button {
        components.push(CreateContainerComponent::ActionRow(
            CreateActionRow::buttons(vec![
                CreateButton::new(id.clone())
                    .label("Next")
                    .style(serenity::model::application::ButtonStyle::Primary),
            ]),
        ));
    }
    if let Some(filename) = &input.filename {
        components.push(CreateContainerComponent::File(
            CreateFile::new(CreateUnfurledMediaItem::new(format!(
                "attachment://{filename}"
            )))
            .spoiler(false),
        ));
    }
    components.push(CreateContainerComponent::TextDisplay(
        CreateTextDisplay::new("-# ZeepCentraal"),
    ));
    let message = CreateMessage::new()
        .components(vec![CreateComponent::Container(
            CreateContainer::new(components).accent_color(0xfacc15),
        )])
        .flags(MessageFlags::IS_COMPONENTS_V2)
        .allowed_mentions(CreateAllowedMentions::new().replied_user(false));
    let mut value = serde_json::to_value(message)?;
    // These three fields are the outbound wire contract compared against discord.js.
    let map = value.as_object_mut().expect("message object");
    map.retain(|key, _| ["components", "flags", "allowed_mentions"].contains(&key.as_str()));
    Ok(value)
}

#[derive(Default)]
pub struct Sessions {
    pages: VecDeque<(u64, String, u64, Value)>,
}
impl Sessions {
    pub fn cleanup(&mut self, now: u64) {
        self.pages.retain(|p| p.2 > now);
    }
    pub fn put(&mut self, id: u64, owner: String, now: u64, value: Value) {
        self.cleanup(now);
        self.pages.retain(|p| p.0 != id);
        if self.pages.len() >= 256 {
            self.pages.pop_front();
        }
        self.pages.push_back((
            id,
            owner,
            now + std::env::var("DISCORD_SESSION_TTL_MS")
                .ok()
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(900_000),
            value,
        ));
    }
    pub fn get(&mut self, id: u64, owner: &str, now: u64) -> anyhow::Result<Value> {
        self.cleanup(now);
        let page = self
            .pages
            .iter()
            .find(|p| p.0 == id)
            .ok_or_else(|| anyhow::anyhow!("Expired page"))?;
        anyhow::ensure!(page.1 == owner, "Page belongs to another user");
        Ok(page.3.clone())
    }
    pub fn len(&self) -> usize {
        self.pages.len()
    }
    pub fn is_empty(&self) -> bool {
        self.pages.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn native_components_match_discord_js() {
        let fixtures: Vec<Value> =
            serde_json::from_str(include_str!("../fixtures/components.json")).unwrap();
        for fixture in fixtures {
            let input: Display = serde_json::from_value(fixture["input"].clone()).unwrap();
            assert_eq!(message(&input).unwrap(), fixture["expected"]);
        }
    }
    #[test]
    fn sessions_enforce_owner_capacity_and_expiry() {
        let mut sessions = Sessions::default();
        for id in 0..300 {
            sessions.put(id, "owner".into(), 0, json!({"page":id}));
        }
        assert_eq!(sessions.len(), 256);
        assert!(sessions.get(0, "owner", 0).is_err());
        assert!(sessions.get(299, "other", 0).is_err());
        assert_eq!(sessions.get(299, "owner", 899_999).unwrap()["page"], 299);
        assert!(sessions.get(299, "owner", 900_000).is_err());
        assert!(sessions.is_empty());
    }
}
