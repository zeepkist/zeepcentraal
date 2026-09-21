use regex::Regex;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::LazyLock};
use url::Url;

static WORKSHOP_LINK: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"https://steamcommunity\.com/(?:sharedfiles|workshop)/filedetails/?\?[^\s<>]*")
        .expect("valid workshop link regex")
});

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SourceAuthor {
    pub id: String,
    #[serde(default)]
    pub bot: bool,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SourceMessage {
    pub id: String,
    pub content: String,
    pub author: SourceAuthor,
    pub timestamp: String,
    pub edited_timestamp: Option<String>,
    #[serde(default)]
    pub attachments: Vec<SourceAttachment>,
    #[serde(default)]
    pub reactions: Vec<SourceReaction>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SourceAttachment {
    pub filename: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SourceReaction {
    pub emoji: SourceEmoji,
    pub me: bool,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SourceEmoji {
    pub name: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SubmissionState {
    Selected,
    Superseded,
    Withdrawn,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SourceSubmission {
    pub author_id: String,
    pub message_created_at: String,
    pub message_edited_at: Option<String>,
    pub message_id: String,
    pub source_error: Option<String>,
    pub state: SubmissionState,
    pub workshop_id: u64,
}

pub fn workshop_links(content: &str) -> Vec<u64> {
    let mut ids = Vec::new();
    for matched in WORKSHOP_LINK.find_iter(content) {
        let trimmed = matched.as_str().trim_end_matches([')', ']', ',', '.', '!']);
        let Some(id) = Url::parse(trimmed)
            .ok()
            .and_then(|url| {
                url.query_pairs()
                    .find(|(key, _)| key == "id")
                    .and_then(|(_, value)| value.parse::<u64>().ok())
            })
            .filter(|id| *id > 0)
        else {
            continue;
        };
        if !ids.contains(&id) {
            ids.push(id);
        }
    }
    ids
}

pub fn reconcile_sources(
    messages: &[SourceMessage],
    previous: &[SourceSubmission],
) -> Vec<SourceSubmission> {
    let known: HashMap<_, _> = previous
        .iter()
        .map(|row| ((row.message_id.as_str(), row.workshop_id), row))
        .collect();
    let mut rows = Vec::new();
    for message in messages.iter().filter(|message| !message.author.bot) {
        let links = workshop_links(&message.content);
        for workshop_id in &links {
            let sticky = known
                .get(&(message.id.as_str(), *workshop_id))
                .is_some_and(|row| row.state == SubmissionState::Superseded);
            rows.push(SourceSubmission {
                author_id: message.author.id.clone(),
                message_created_at: message.timestamp.clone(),
                message_edited_at: message.edited_timestamp.clone(),
                message_id: message.id.clone(),
                source_error: (links.len() > 1).then(|| "multiple-workshop-links".into()),
                state: if sticky {
                    SubmissionState::Superseded
                } else {
                    SubmissionState::Selected
                },
                workshop_id: *workshop_id,
            });
        }
    }
    let mut by_author = HashMap::<String, Vec<usize>>::new();
    for (index, row) in rows.iter().enumerate() {
        by_author
            .entry(row.author_id.clone())
            .or_default()
            .push(index);
    }
    for indexes in by_author.values_mut() {
        indexes.sort_unstable_by(|left, right| {
            numeric_message_id(&rows[*right].message_id)
                .cmp(&numeric_message_id(&rows[*left].message_id))
        });
        let latest = indexes
            .iter()
            .copied()
            .find(|index| rows[*index].state != SubmissionState::Superseded)
            .map(|index| rows[index].message_id.clone());
        for index in indexes {
            if latest.as_deref() != Some(&rows[*index].message_id) {
                rows[*index].state = SubmissionState::Superseded;
            }
        }
    }
    rows
}

fn numeric_message_id(value: &str) -> u128 {
    value.parse().unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn message(id: &str, workshop: &str) -> SourceMessage {
        SourceMessage {
            id: id.into(),
            content: format!("https://steamcommunity.com/sharedfiles/filedetails/?id={workshop}"),
            author: SourceAuthor {
                id: "1".into(),
                bot: false,
            },
            timestamp: "2026-09-10T00:00:00Z".into(),
            edited_timestamp: None,
            attachments: Vec::new(),
            reactions: Vec::new(),
        }
    }

    #[test]
    fn extracts_only_distinct_bounded_workshop_links() {
        assert_eq!(
            workshop_links(
                "https://evil.test/?id=1 https://steamcommunity.com/workshop/filedetails/?id=123&x=1"
            ),
            vec![123]
        );
        assert!(
            workshop_links(
                "https://steamcommunity.com/workshop/filedetails/?id=18446744073709551616"
            )
            .is_empty()
        );
        assert_eq!(
            workshop_links("[Level](https://steamcommunity.com/sharedfiles/filedetails/?id=123)"),
            vec![123]
        );
    }

    #[test]
    fn preserves_sticky_supersession_and_rejects_ambiguous_messages() {
        let initial = reconcile_sources(&[message("2", "20"), message("1", "10")], &[]);
        assert_eq!(
            initial
                .iter()
                .find(|row| row.message_id == "1")
                .unwrap()
                .state,
            SubmissionState::Superseded
        );
        assert_eq!(
            reconcile_sources(&[message("1", "10")], &initial)[0].state,
            SubmissionState::Superseded
        );
        let mut ambiguous = message("3", "30");
        ambiguous
            .content
            .push_str(" https://steamcommunity.com/workshop/filedetails/?id=31");
        assert!(
            reconcile_sources(&[ambiguous], &[])
                .iter()
                .all(|row| row.source_error.as_deref() == Some("multiple-workshop-links"))
        );
    }
}
