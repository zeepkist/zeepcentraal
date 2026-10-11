use super::messages::{escape_text, server_message, server_message_body};
use zc_core::practice::PracticeBundle;
use zc_database::services::zsl_tournament::ZslEvent;

pub fn warmup_countdown(remaining_seconds: u64) -> String {
    let minutes = remaining_seconds.div_ceil(60);
    format!(
        "Zeepkist Super League is starting in {minutes} minute{}. Stay in this room.",
        if minutes == 1 { "" } else { "s" }
    )
}

pub fn practice_welcome(
    round: &str,
    player: &str,
    round_seconds: u64,
    remaining_seconds: u64,
) -> String {
    let countdown = if remaining_seconds == 0 {
        "Tournament warm-up begins shortly.".to_owned()
    } else {
        format!(
            "Tournament warm-up begins in <b>{}</b>.",
            human_duration(remaining_seconds.div_ceil(60) * 60)
        )
    };
    let stay_message = if remaining_seconds <= 2 * 60 * 60 {
        "<br>Stay in this room to join the tournament automatically. You don't need to leave or rejoin."
    } else {
        ""
    };
    format!(
        "<size=85%><color=#dedede><b>Welcome, {}!</b><br>ZSL Practice: <b>{}</b><br><br>Practise the tournament tracks with <b>{}</b> on each track. The playlist repeats, so you can keep practising.<br><br>{countdown}{stay_message}</color></size>",
        escape_text(player),
        escape_text(round),
        human_duration(round_seconds)
    )
}

fn human_duration(seconds: u64) -> String {
    let mut parts: Vec<_> = [
        (seconds / 86400, "day"),
        (seconds % 86400 / 3600, "hour"),
        (seconds % 3600 / 60, "minute"),
        (seconds % 60, "second"),
    ]
    .into_iter()
    .filter(|(count, _)| *count > 0)
    .map(|(count, unit)| format!("{count} {unit}{}", if count == 1 { "" } else { "s" }))
    .collect();
    let last = parts.pop().unwrap_or_else(|| "0 seconds".to_owned());
    if parts.is_empty() {
        last
    } else {
        format!("{} and {last}", parts.join(", "))
    }
}

pub fn gradient(text: &str, colors: [&str; 2]) -> String {
    let characters: Vec<_> = text.chars().collect();
    let parse = |value: &str| {
        u32::from_str_radix(value.trim_start_matches('#'), 16).expect("static gradient color")
    };
    let first = parse(colors[0]);
    let last = parse(colors[1]);
    characters
        .iter()
        .enumerate()
        .map(|(index, character)| {
            let t = index as f64 / characters.len().saturating_sub(1).max(1) as f64;
            let mut color = 0;
            for shift in [16, 8, 0] {
                let a = ((first >> shift) & 255) as f64;
                let b = ((last >> shift) & 255) as f64;
                color |= ((a + (b - a) * t).round() as u32) << shift;
            }
            format!(
                "<color=#{color:06x}>{}</color>",
                escape_text(&character.to_string())
            )
        })
        .collect()
}
pub fn progress(bundle: &PracticeBundle, current: usize) -> String {
    let mut number = 0;
    bundle
        .levels
        .iter()
        .enumerate()
        .map(|(index, entry)| {
            let label = if entry.level.name.starts_with("ZSL") {
                number += 1;
                number.to_string()
            } else {
                "BREAK".into()
            };
            if index == current {
                format!(
                    "<b>{}</b>",
                    server_message_body(&format!("<color=#00ffff>[{label}]</color>"))
                )
            } else if index < current {
                server_message_body(&format!("<color=#00AA00>{label}</color>"))
            } else {
                server_message_body(&format!("<color=#CCCCCCCC>{label}</color>"))
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}
pub fn overlay(
    event: &ZslEvent,
    bundle: &PracticeBundle,
    current: usize,
    status: &str,
    duration: u64,
) -> String {
    let author_time = bundle
        .levels
        .get(current)
        .and_then(|entry| entry.author_time)
        .unwrap_or_default();
    let header = format!(
        "<color=#ffd21c>Zeepkist</color> {}",
        gradient("Super League", ["#4ad9ff", "#9833ff"])
    );
    let body = format!(
        "<align=left><b><size=250%>{header}</size></b><br>Season {}: {}<br>State<pos=7em>: <b>{}</b><br>Authortime<pos=7em>: <b><color=#d400b4>{author_time:.3}s</color></b><br>{}</align>",
        event.season,
        escape_text(&event.name),
        escape_text(status),
        progress(bundle, current)
    );
    server_message("white", duration + 120, &body)
}
pub fn thanks(event: &ZslEvent, published: bool) -> String {
    let url = format!(
        "https://zeepki.st/super-league/season-{}/round-{}",
        event.season, event.round
    );
    let results = if published {
        format!("Results are now available on <u>{url}</u>")
    } else {
        format!("Results will be available on <u>{url}</u> after Timeslot 2 finishes.")
    };
    format!(
        "Thank you for joining ZSL Round {}: {}!<br>Vote for your favourite decorated/track layout levels on <u>https://zeepki.st/super-league/vote</u><br>{results}",
        event.round,
        escape_text(&event.name)
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn warmup_countdown_uses_remaining_time() {
        assert_eq!(
            warmup_countdown(1200),
            "Zeepkist Super League is starting in 20 minutes. Stay in this room."
        );
        assert!(warmup_countdown(61).contains("2 minutes"));
        assert!(warmup_countdown(1).contains("1 minute."));
        assert!(!warmup_countdown(0).contains("has started"));
    }
    #[test]
    fn gradients_escape_player_text() {
        assert!(gradient("<>", ["#00aaff", "#88ffff"]).contains("&lt;"));
    }
    #[test]
    fn results_use_canonical_domain() {
        let event = ZslEvent {
            name: "Mixed Surfaces".into(),
            round: 1,
            season: 8,
            first: 1,
            second: 2,
            points: vec![100],
            minimum_points: 1,
            best_of: 4,
        };
        assert!(thanks(&event, false).contains("after Timeslot 2 finishes"));
        assert!(thanks(&event, true).contains("https://zeepki.st/super-league/season-8/round-1"));
    }
}
