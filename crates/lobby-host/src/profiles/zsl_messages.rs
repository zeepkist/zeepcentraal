use super::messages::{chat_notice, escape_text, server_message, server_row};
use zc_core::practice::PracticeBundle;
use zc_database::services::zsl_tournament::ZslEvent;

pub fn warmup_status(remaining_seconds: u64) -> String {
    if remaining_seconds == 0 {
        return "Zeepkist Super League starts after warmup. Stay in this room.".into();
    }
    let minutes = remaining_seconds.div_ceil(60);
    format!(
        "Zeepkist Super League is starting in {minutes} minute{}. Stay in this room.",
        if minutes == 1 { "" } else { "s" }
    )
}

pub fn warmup_countdown(remaining: u64) -> String {
    chat_notice("ZSL Warmup", &warmup_notice(remaining))
}

fn warmup_notice(remaining: u64) -> String {
    let start = if remaining == 0 {
        // Reference command: `/cm23`
        "Tournament starts after warmup.".to_owned()
    } else {
        // Reference commands: `/cm6`, `/cm27`
        let time = human_duration(remaining.div_ceil(60) * 60);
        format!("Tournament starts in <b><color=#ffd21c>{time}</color></b>.")
    };
    format!("{start}<br>Stay in this room to join automatically.")
}

pub fn welcome(event: &ZslEvent, player: &str, warmup: Option<u64>, locked: bool) -> String {
    let (heading, notice) = if let Some(remaining) = warmup {
        // Reference command: `/cm11`
        ("ZSL Warmup", warmup_notice(remaining))
    } else if locked {
        // Reference command: `/cm13`
        ("Timeslot 1 Result Locked", "You can race this level. Your time in Timeslot 2 will not replace your Timeslot 1 result.".to_owned())
    } else {
        // Reference command: `/cm12`
        ("ZSL Tournament", "Good luck and have fun!".to_owned())
    };
    chat_notice(
        heading,
        &format!(
            "Welcome, <b>{}</b>!<br>{}<br>{notice}",
            escape_text(player),
            season(event)
        ),
    )
}

pub fn season(event: &ZslEvent) -> String {
    format!(
        "Season {}: <b>{}</b>",
        event.season,
        escape_text(&event.name)
    )
}

// Reference commands: `/cm5`, `/cm24`, `/cm25`
pub fn practice_welcome(
    round: &str,
    player: &str,
    round_seconds: u64,
    remaining_seconds: u64,
) -> String {
    let countdown = if remaining_seconds == 0 {
        "<b>shortly</b>".to_owned()
    } else {
        format!(
            "in <b><color=#ffd21c>{}</color></b>",
            human_duration(remaining_seconds.div_ceil(60) * 60)
        )
    };
    let stay = if remaining_seconds <= 2 * 60 * 60 {
        "<br>Stay in this room to join automatically."
    } else {
        ""
    };
    chat_notice(
        "ZSL Practice",
        &format!(
            "Welcome, <b>{}</b>! Round: <b>{}</b>.<br>Practise each track for <b>{}</b>. The playlist repeats.<br><br>Warmup: {countdown}{stay}",
            escape_text(player),
            escape_text(round),
            human_duration(round_seconds)
        ),
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
                format!("<b><color=#00ffff>[{label}]</color></b>")
            } else if index < current {
                format!("<color=#00AA00>{label}</color>")
            } else {
                format!("<color=#CCCCCC>{label}</color>")
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}
// Reference commands: `/sm9`, `/sm10`, `/sm11`, `/sm12`
pub fn overlay(
    event: &ZslEvent,
    bundle: &PracticeBundle,
    current: usize,
    status: &str,
    warmup: bool,
    duration: u64,
) -> String {
    let author_time = bundle
        .levels
        .get(current)
        .and_then(|entry| entry.author_time)
        .unwrap_or_default();
    let heading = if warmup {
        "ZSL Warmup"
    } else {
        "ZSL Tournament"
    };
    let body = format!(
        "{}<br>{}<br><br><color=#B8B8B8><i>{}</i></color><br><br><b>Track order</b><br>{}",
        server_row(
            "Season",
            format_args!("{}: {}", event.season, escape_text(&event.name))
        ),
        server_row(
            "Author time",
            format_args!("<color=#d400b4>{author_time:.3}s</color>")
        ),
        escape_text(status),
        progress(bundle, current)
    );
    server_message(duration + 120, heading, &body)
}

pub fn thanks(event: &ZslEvent, published: bool) -> String {
    let (label, availability) = if published {
        // Reference command: `/cm19`
        ("ZSL Results", "")
    } else {
        // Reference command: `/cm7`
        ("Results", "<br>Available after Timeslot 2 finishes.")
    };
    chat_notice(
        "Thanks for Racing!",
        &format!(
            "ZSL Round {}: <b>{}</b><br>Vote for your favourite décor and track layouts: <color=#4ad9ff><u>zeepki.st/super-league/vote</u></color><br>{label}: <color=#4ad9ff><u>zeepki.st/super-league/season-{}/round-{}</u></color>{availability}",
            event.round,
            escape_text(&event.name),
            event.season,
            event.round
        ),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn warmup_countdown_uses_remaining_time() {
        assert!(warmup_countdown(1200).contains("<color=#ffd21c>20 minutes</color>"));
        assert!(warmup_countdown(61).contains("<color=#ffd21c>2 minutes</color>"));
        assert!(warmup_countdown(1).contains("<color=#ffd21c>1 minute</color>"));
        assert!(warmup_countdown(0).contains("Tournament starts after warmup."));
        assert!(warmup_status(1200).contains("starting in 20 minutes"));
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
        assert!(thanks(&event, true).contains("zeepki.st/super-league/season-8/round-1"));
    }
}
