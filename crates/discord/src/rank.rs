use crate::backend::{ActivityEvent, RankUser};
use serde::Deserialize;
use serenity::{
    all::MessageFlags,
    builder::{
        CreateAllowedMentions, CreateComponent, CreateContainer, CreateContainerComponent,
        CreateMessage, CreateTextDisplay,
    },
};

pub(crate) const DISPLAY_LIMIT: usize = 30;

#[derive(Deserialize)]
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
    let mut rows = Vec::new();
    let mut text_length = 0;
    for change in changes.iter().take(DISPLAY_LIMIT) {
        let up =
            change.rank != -1 && (change.previous_rank == -1 || change.rank < change.previous_rank);
        let arrow = if up {
            "<:up:1535467505831780455>"
        } else {
            "<:down:1535467431655637072>"
        };
        let user = users.iter().find(|user| user.id == change.id_user);
        // Bound user-supplied names so every movement fits Discord's text limits.
        let name = user
            .and_then(|user| user.steam_name.as_deref())
            .unwrap_or("Unknown player")
            .replace(['\r', '\n'], " ")
            .chars()
            .take(40)
            .collect::<String>();
        let player = match user
            .and_then(|user| user.discord_id.as_deref())
            .and_then(|id| id.parse::<u64>().ok())
            .filter(|id| *id > 0)
        {
            Some(id) => format!("{name} (<@{id}>)"),
            None => name,
        };
        let points = user
            .and_then(|user| user.points)
            .map_or_else(|| "unknown".into(), points_label);
        let row = format!(
            "{arrow} {player}: {} → {} ({points} pts)",
            rank_label(change.previous_rank),
            rank_label(change.rank)
        );
        text_length += row.encode_utf16().count() + 1;
        if text_length > 3000 {
            break;
        }
        rows.push(row);
    }
    if changes.len() > rows.len() {
        rows.push(format!("…and {} more", changes.len() - rows.len()));
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
    // Separate text displays keep bounded movement rows within component limits.
    let mut components = vec![CreateContainerComponent::TextDisplay(
        CreateTextDisplay::new(format!(
            "## Rank changes\n{count} {movement} after ranking recalculation.\n### Movements"
        )),
    )];
    for chunk in rows.chunks(10) {
        components.push(CreateContainerComponent::TextDisplay(
            CreateTextDisplay::new(chunk.join("\n")),
        ));
    }
    components.push(CreateContainerComponent::TextDisplay(
        CreateTextDisplay::new(format!("-# ZeepCentraal • {occurred}")),
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
            json!({"changes":(1..=35).rev().map(|id|json!({"idUser":id,"previousRank":3,"rank":2})).collect::<Vec<_>>()}),
        );
        let changes = changes(&event);
        assert_eq!(changes[0].id_user, 1);
        assert_eq!(changes[29].id_user, 30);
        let normal = serde_json::to_value(message(&event, &changes, &[]).unwrap()).unwrap();
        assert!(text(&normal).contains("…and 5 more"));
        let users = (1..=35)
            .map(|id| RankUser {
                id,
                steam_name: Some("🚀".repeat(1000)),
                discord_id: Some(u64::MAX.to_string()),
                points: Some(i64::MAX),
            })
            .collect::<Vec<_>>();
        let value = serde_json::to_value(message(&event, &changes, &users).unwrap()).unwrap();
        assert!(text(&value).contains("…and "));
        assert!(text(&value).contains("9,223,372,036,854,775,807 pts"));
        assert!(text(&value).encode_utf16().count() < 4000);
        assert_eq!(points_label(i64::MIN), "-9,223,372,036,854,775,808");
    }
}
