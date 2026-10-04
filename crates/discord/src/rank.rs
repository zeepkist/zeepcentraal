use crate::backend::{ActivityEvent, RankUser};
use serde::Deserialize;
use serenity::{
    all::MessageFlags,
    builder::{
        CreateAllowedMentions, CreateComponent, CreateContainer, CreateContainerComponent,
        CreateMessage, CreateTextDisplay,
    },
};
use std::collections::BTreeSet;

pub(crate) const DISPLAY_LIMIT: usize = 50;

fn bounded_name(name: &str, limit: usize) -> String {
    let mut length = 0;
    name.chars()
        .map(|character| {
            if matches!(character, '\r' | '\n' | '\t') {
                ' '
            } else {
                character
            }
        })
        .take_while(|character| {
            length += character.len_utf16();
            length <= limit
        })
        .collect()
}

fn row(change: &RankChange, users: &[RankUser], compact: bool) -> String {
    let user = users.iter().find(|user| user.id == change.id_user);
    let name = bounded_name(
        user.and_then(|user| user.steam_name.as_deref())
            .unwrap_or("Unknown player"),
        if compact { 24 } else { 40 },
    );
    let mention = user
        .and_then(|user| user.discord_id.as_deref())
        .and_then(|id| id.parse::<u64>().ok())
        .filter(|id| *id > 0)
        .map(|id| format!("<@{id}>"));
    let points = user.and_then(|user| user.points);
    if compact {
        let player = mention.unwrap_or(name);
        let points = points.map_or_else(|| "unknown".into(), |points| points.to_string());
        format!(
            "{player} {} → {} · {points}",
            rank_label(change.previous_rank),
            rank_label(change.rank)
        )
    } else {
        let player = mention.map_or(name.clone(), |mention| format!("{name} ({mention})"));
        let up =
            change.rank != -1 && (change.previous_rank == -1 || change.rank < change.previous_rank);
        let arrow = if up {
            "<:up:1535467505831780455>"
        } else {
            "<:down:1535467431655637072>"
        };
        let points = points.map_or_else(|| "unknown".into(), points_label);
        format!(
            "{arrow} {player}: {} → {} ({points} pts)",
            rank_label(change.previous_rank),
            rank_label(change.rank)
        )
    }
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RankChange {
    pub id_user: i32,
    previous_rank: i32,
    rank: i32,
}

pub(crate) fn changes(event: &ActivityEvent) -> Vec<RankChange> {
    let mut changes = event
        .payload
        .get("changes")
        .and_then(serde_json::Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|value| serde_json::from_value::<RankChange>(value.clone()).ok())
        .filter(|change| {
            change.id_user > 0
                && valid_rank(change.previous_rank)
                && valid_rank(change.rank)
                && change.previous_rank != change.rank
        })
        .collect::<Vec<_>>();
    changes.sort_by_key(|change| {
        (
            if change.rank == -1 {
                i64::MAX
            } else {
                i64::from(change.rank)
            },
            change.id_user,
        )
    });
    changes
}

pub(crate) fn for_watches(changes: &[RankChange], watched: &BTreeSet<i32>) -> Vec<RankChange> {
    let mut selected = watched.clone();
    let mut intervals = changes
        .iter()
        .map(|change| {
            let (start, end) = match (change.previous_rank, change.rank) {
                (-1, rank) | (rank, -1) => (rank, rank),
                (previous, rank) => (previous.min(rank), previous.max(rank)),
            };
            (start, end, change)
        })
        .collect::<Vec<_>>();
    intervals.sort_unstable_by_key(|(start, end, change)| (*start, *end, change.id_user));
    let mut group = Vec::new();
    let mut group_end = 0;
    let mut group_watched = false;
    for (start, end, change) in intervals {
        if start > group_end {
            if group_watched {
                selected.extend(group.drain(..));
            } else {
                group.clear();
            }
            group_watched = false;
            group_end = end;
        } else {
            group_end = group_end.max(end);
        }
        // Entry/exit watches select their own row, without expanding the group.
        group_watched |=
            watched.contains(&change.id_user) && change.previous_rank > 0 && change.rank > 0;
        group.push(change.id_user);
    }
    if group_watched {
        selected.extend(group);
    }
    let mut seen = BTreeSet::new();
    changes
        .iter()
        .filter(|change| selected.contains(&change.id_user) && seen.insert(change.id_user))
        .cloned()
        .collect()
}

fn valid_rank(rank: i32) -> bool {
    rank == -1 || rank > 0
}

fn rank_label(rank: i32) -> String {
    if rank == -1 {
        "Unranked".into()
    } else {
        format!("#{rank}")
    }
}

fn points_label(points: i64) -> String {
    let digits = points.unsigned_abs().to_string();
    let mut formatted = if points < 0 {
        "-".into()
    } else {
        String::new()
    };
    for (index, digit) in digits.chars().enumerate() {
        if index > 0 && (digits.len() - index).is_multiple_of(3) {
            formatted.push(',');
        }
        formatted.push(digit);
    }
    formatted
}

pub(crate) fn message(
    event: &ActivityEvent,
    changes: &[RankChange],
    users: &[RankUser],
) -> Option<CreateMessage<'static>> {
    if changes.is_empty() {
        return None;
    }
    let occurred = event.occurred_at.parse::<jiff::Timestamp>().map_or_else(
        |_| event.occurred_at.clone(),
        |timestamp| format!("<t:{}:R>", timestamp.as_second()),
    );
    let count = changes.len();
    let movement = if count == 1 {
        "player moved"
    } else {
        "players moved"
    };
    let mut header =
        format!("## Rank changes\n{count} {movement} after ranking recalculation.\n### Movements");
    let footer = format!("-# ZeepCentraal • {occurred}");
    let mut rows = changes
        .iter()
        .take(DISPLAY_LIMIT)
        .map(|change| row(change, users, false))
        .collect::<Vec<_>>();
    let more = (changes.len() > DISPLAY_LIMIT)
        .then(|| format!("…and {} more", changes.len() - DISPLAY_LIMIT));
    let text_length = header.encode_utf16().count()
        + footer.encode_utf16().count()
        + rows
            .iter()
            .map(|row| row.encode_utf16().count() + 1)
            .sum::<usize>()
        + more
            .as_ref()
            .map_or(0, |more| more.encode_utf16().count() + 1)
        + 2;
    if text_length > 4000 {
        header.push_str(" • points");
        rows = changes
            .iter()
            .take(DISPLAY_LIMIT)
            .map(|change| row(change, users, true))
            .collect();
    }
    if let Some(more) = more {
        rows.push(more);
    }
    // Ten rows per text display; compact fallback retains all fifty movements.
    let mut components = vec![CreateContainerComponent::TextDisplay(
        CreateTextDisplay::new(header),
    )];
    for chunk in rows.chunks(10) {
        components.push(CreateContainerComponent::TextDisplay(
            CreateTextDisplay::new(chunk.join("\n")),
        ));
    }
    components.push(CreateContainerComponent::TextDisplay(
        CreateTextDisplay::new(footer),
    ));
    Some(
        CreateMessage::new()
            .components(vec![CreateComponent::Container(
                CreateContainer::new(components).accent_color(0x3b82f6),
            )])
            .flags(MessageFlags::IS_COMPONENTS_V2)
            .allowed_mentions(CreateAllowedMentions::new().replied_user(false)),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{Value, json};

    fn event(payload: Value) -> ActivityEvent {
        serde_json::from_value(json!({"id":"1","kind":"rank_batch","payload":payload,
            "occurredAt":"2026-10-05T06:00:00Z"}))
        .unwrap()
    }

    fn text(message: &Value) -> String {
        message["components"][0]["components"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|value| value["content"].as_str())
            .collect::<Vec<_>>()
            .join("\n")
    }

    fn selected_ids(changes: &[RankChange], watched: &[i32]) -> Vec<i32> {
        for_watches(changes, &watched.iter().copied().collect())
            .iter()
            .map(|change| change.id_user)
            .collect()
    }

    #[test]
    fn akane_watch_keeps_only_two_related_movements_from_twenty_seven() {
        let movements = [
            (24, 23),
            (23, 24),
            (70, 69),
            (69, 70),
            (101, 100),
            (100, 101),
            (176, 175),
            (175, 176),
            (181, 180),
            (182, 181),
            (183, 182),
            (184, 183),
            (185, 184),
            (180, 185),
            (211, 210),
            (212, 211),
            (210, 212),
            (285, 284),
            (286, 285),
            (284, 286),
            (309, 308),
            (308, 309),
            (353, 352),
            (352, 353),
            (377, 376),
            (378, 377),
            (376, 378),
        ];
        let event = event(
            json!({"changes":movements.iter().enumerate().map(|(index,(previous,rank))|
            json!({"idUser":index+1,"previousRank":previous,"rank":rank})).collect::<Vec<_>>()}),
        );
        let changes = changes(&event);
        let selected = for_watches(&changes, &BTreeSet::from([8]));
        assert_eq!(changes.len(), 27);
        assert_eq!(selected_ids(&changes, &[8]), vec![7, 8]);
        let users = vec![
            RankUser {
                id: 7,
                steam_name: Some("Kilandor".into()),
                discord_id: Some("123".into()),
                points: Some(93828),
            },
            RankUser {
                id: 8,
                steam_name: Some("Akane".into()),
                discord_id: Some("456".into()),
                points: Some(93756),
            },
        ];
        let rendered = serde_json::to_value(message(&event, &selected, &users).unwrap()).unwrap();
        let text = text(&rendered);
        assert!(text.contains("2 players moved after ranking recalculation."));
        assert!(text.contains("Kilandor (<@123>): #176 → #175 (93,828 pts)"));
        assert!(text.contains("Akane (<@456>): #175 → #176 (93,756 pts)"));
        assert!(!text.contains("Unknown player"));
    }

    #[test]
    fn watches_expand_transitive_groups_with_shared_endpoints_but_not_adjacent_groups() {
        let event = event(json!({"changes":[
            {"idUser":1,"previousRank":10,"rank":11},
            {"idUser":2,"previousRank":11,"rank":13},
            {"idUser":3,"previousRank":14,"rank":13},
            {"idUser":4,"previousRank":15,"rank":16},
            {"idUser":5,"previousRank":16,"rank":15},
            {"idUser":6,"previousRank":12,"rank":13},
            {"idUser":3,"previousRank":14,"rank":13}
        ]}));
        let changes = changes(&event);
        assert_eq!(selected_ids(&changes, &[1]), vec![1, 2, 3, 6]);
        assert_eq!(selected_ids(&changes, &[3]), vec![1, 2, 3, 6]);
        assert_eq!(selected_ids(&changes, &[5]), vec![5, 4]);
        assert_eq!(selected_ids(&changes, &[1, 3, 5]), vec![1, 2, 3, 6, 5, 4]);
        assert!(selected_ids(&changes, &[99]).is_empty());
        assert!(selected_ids(&changes, &[]).is_empty());
    }

    #[test]
    fn entry_exit_watches_stay_isolated_and_other_entries_use_finite_position() {
        let event = event(json!({"changes":[
            {"idUser":1,"previousRank":10,"rank":11},
            {"idUser":2,"previousRank":-1,"rank":10},
            {"idUser":3,"previousRank":11,"rank":-1},
            {"idUser":4,"previousRank":12,"rank":13},
            {"idUser":5,"previousRank":-1,"rank":12},
            {"idUser":6,"previousRank":-1,"rank":100}
        ]}));
        let changes = changes(&event);
        assert_eq!(selected_ids(&changes, &[2]), vec![2]);
        assert_eq!(selected_ids(&changes, &[3]), vec![3]);
        assert_eq!(selected_ids(&changes, &[1]), vec![2, 1, 3]);
        assert_eq!(selected_ids(&changes, &[4]), vec![5, 4]);
        assert_eq!(selected_ids(&changes, &[1, 6]), vec![2, 1, 6, 3]);
    }

    #[test]
    fn restores_sorted_movements_points_and_safe_mentions() {
        let event = event(json!({"changes":[
            {"idUser":10,"previousRank":7,"rank":-1},
            {"idUser":8,"previousRank":2,"rank":5},
            {"idUser":7,"previousRank":4,"rank":2},
            {"idUser":9,"previousRank":-1,"rank":6},
            {"idUser":11,"previousRank":3,"rank":3},
            {"idUser":"bad","previousRank":3,"rank":2},
            {"idUser":0,"previousRank":1,"rank":2},
            {"idUser":12,"previousRank":0,"rank":2}
        ]}));
        let users = vec![
            RankUser {
                id: 7,
                steam_name: Some("Seven".into()),
                discord_id: Some("123456789012345678".into()),
                points: Some(456789),
            },
            RankUser {
                id: 8,
                steam_name: Some("Eight".into()),
                discord_id: Some("-1".into()),
                points: Some(123000),
            },
            RankUser {
                id: 9,
                steam_name: None,
                discord_id: None,
                points: None,
            },
        ];
        let value =
            serde_json::to_value(message(&event, &changes(&event), &users).unwrap()).unwrap();
        let text = text(&value);
        assert!(text.contains("4 players moved"));
        assert!(text.contains("Seven (<@123456789012345678>): #4 → #2 (456,789 pts)"));
        assert!(text.contains("Eight: #2 → #5 (123,000 pts)"));
        assert!(text.contains("Unranked → #6 (unknown pts)"));
        assert!(text.contains("#7 → Unranked (unknown pts)"));
        assert!(text.find("#4 → #2").unwrap() < text.find("#2 → #5").unwrap());
        assert!(text.find("#2 → #5").unwrap() < text.find("Unranked → #6").unwrap());
        assert!(text.find("Unranked → #6").unwrap() < text.find("#7 → Unranked").unwrap());
        assert!(text.contains("<:up:1535467505831780455>"));
        assert!(text.contains("<:down:1535467431655637072>"));
        assert!(text.contains("<t:1791180000:R>"));
        assert_eq!(value["flags"], 32768);
        assert_eq!(value["allowed_mentions"]["parse"], json!([]));
    }

    #[test]
    fn validates_empty_batches_and_bounds_output_with_rank_ties() {
        for payload in [
            Value::Null,
            json!({"changes":[]}),
            json!({"changes":[null, {"idUser":1,"previousRank":2.5,"rank":1}]}),
        ] {
            let event = event(payload);
            assert!(message(&event, &changes(&event), &[]).is_none());
        }
        let event = event(
            json!({"changes":(1..=55).rev().map(|id|json!({"idUser":id,"previousRank":3,"rank":2})).collect::<Vec<_>>()}),
        );
        let changes = changes(&event);
        assert_eq!(changes[0].id_user, 1);
        assert_eq!(changes[29].id_user, 30);
        assert_eq!(changes[49].id_user, 50);
        let normal = serde_json::to_value(message(&event, &changes, &[]).unwrap()).unwrap();
        assert!(text(&normal).contains("…and 5 more"));
        let users = (1..=55)
            .map(|id| RankUser {
                id,
                steam_name: Some("🚀".repeat(1000)),
                discord_id: Some(u64::MAX.to_string()),
                points: Some(i64::MAX),
            })
            .collect::<Vec<_>>();
        let value = serde_json::to_value(message(&event, &changes, &users).unwrap()).unwrap();
        assert!(text(&value).contains("…and "));
        assert!(text(&value).contains("9223372036854775807"));
        assert!(text(&value).contains("### Movements • points"));
        assert_eq!(text(&value).matches("#3 → #2").count(), 50);
        assert!(text(&value).encode_utf16().count() < 4000);
        assert_eq!(points_label(i64::MIN), "-9,223,372,036,854,775,808");
    }

    #[test]
    fn all_fifty_movements_fit_with_maximum_numbers_and_unicode_names() {
        let event = event(json!({"changes":(1..=50).map(|id|json!({
            "idUser":id,"previousRank":i32::MAX,"rank":i32::MAX-1
        })).collect::<Vec<_>>()}));
        let users = (1..=50)
            .map(|id| RankUser {
                id,
                steam_name: Some("🚀\n".repeat(1000)),
                discord_id: (id % 2 == 0).then(|| u64::MAX.to_string()),
                points: Some(i64::MIN),
            })
            .collect::<Vec<_>>();
        let value =
            serde_json::to_value(message(&event, &changes(&event), &users).unwrap()).unwrap();
        let text = text(&value);
        assert_eq!(text.matches("#2147483647 → #2147483646").count(), 50);
        assert_eq!(text.matches("-9223372036854775808").count(), 50);
        assert!(!text.contains("…and"));
        assert!(text.encode_utf16().count() <= 4000);
        assert_eq!(value["allowed_mentions"]["parse"], json!([]));
        assert_eq!(bounded_name("🚀🚀🚀", 5), "🚀🚀");
    }
}
