use crate::config::TournamentType;
use anyhow::{Context, Result};
use jiff::Timestamp;
use regex::Regex;
use std::sync::OnceLock;
use zc_database::services::lobby_assets::{TournamentLobbyPlayerContext, TournamentLobbySnapshot};

pub const HOSTNAME: &str = "<color=#f9cc15>HOST</color>";

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct StandingResult {
    pub rank: i32,
    pub time: f32,
    pub points: i32,
}

pub fn escape_text(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

pub fn join_message(
    kind: TournamentType,
    player_name: &str,
    context: &TournamentLobbyPlayerContext,
) -> String {
    let (event, cadence, route) = match kind {
        TournamentType::Weekly => ("Track of the Week", "week", "totw"),
        TournamentType::Monthly => ("Track of the Month", "month", "totm"),
    };
    let mut paragraphs = vec![
        format!("Welcome to {event}, {}", display_name(Some(player_name))),
        format!("A time attack tournament featuring a unique level each {cadence}."),
        format!("View the full tournament leaderboard on <u>zeepki.st/{route}</u>!"),
    ];
    if !context.user_exists || !context.recent_record {
        let minimum = gtr_version(context.minimum_gtr_version.as_deref());
        paragraphs.push(if minimum.is_empty() {
            "You need GTR installed to join the tournament leaderboard.".into()
        } else {
            format!("You need GTR {minimum}+ installed to join the tournament leaderboard.")
        });
    }
    if let Some((rank, time)) = context.standing {
        paragraphs.push(format!(
            "You are currently #{rank} on the tournament leaderboard with {}.",
            format_time(time)
        ));
    }
    paragraphs.push("<size=65%>This is an unattended room, so chat is not monitored. If you find something wrong, please contact Akane on Discord.</size>".into());
    format!(
        "<size=85%><color=#dedede>{}</color></size>",
        paragraphs.join("<br><br>")
    )
}

pub fn tournament_message(
    kind: TournamentType,
    slug: &str,
    end_at: &str,
    snapshot: Option<&TournamentLobbySnapshot>,
    round_time: u64,
) -> Result<String> {
    tournament_message_at(kind, slug, end_at, snapshot, round_time, Timestamp::now())
}

fn tournament_message_at(
    kind: TournamentType,
    slug: &str,
    end_at: &str,
    snapshot: Option<&TournamentLobbySnapshot>,
    round_time: u64,
    now: Timestamp,
) -> Result<String> {
    let period = tournament_period(kind, slug);
    let remaining = tournament_remaining(end_at, now)?;
    let entries = snapshot
        .map(|s| s.entries.to_string())
        .unwrap_or_else(|| "…".into());
    let leaderboard = match snapshot {
        None => "Leaderboard loading…".into(),
        Some(s) if s.standings.is_empty() => {
            "Set a time with GTR to appear on the leaderboard!".into()
        }
        Some(s) => s
            .standings
            .iter()
            .take(6)
            .enumerate()
            .map(|(index, row)| {
                let color = ["#FFD700", "#C0C0C0", "#CD7F32"]
                    .get(index)
                    .copied()
                    .unwrap_or("#FFFFFF");
                let name = display_name(row.steam_name.as_deref());
                format!(
                    "<color={color}>{}. {name} — {}</color>",
                    row.rank,
                    format_time(row.time)
                )
            })
            .collect::<Vec<_>>()
            .join("\n"),
    };
    Ok(format!(
        "/servermessage yellow {round_time} <size=160%><b>{}</b>\n{entries} Entries {remaining}\n{leaderboard}</size>",
        escape_text(&period)
    ))
}

pub fn tournament_remaining(end_at: &str, now: Timestamp) -> Result<String> {
    let end: Timestamp = end_at.parse().context("Tournament end time is invalid")?;
    let milliseconds = (end.as_millisecond() - now.as_millisecond()).max(0);
    let total_minutes = milliseconds.saturating_add(59_999) / 60_000;
    Ok(format!(
        "Ends in {}d {}h {}m",
        total_minutes / 1_440,
        total_minutes % 1_440 / 60,
        total_minutes % 60
    ))
}

pub fn standing_message(
    kind: TournamentType,
    previous: Option<StandingResult>,
    current: StandingResult,
) -> String {
    let label = match kind {
        TournamentType::Weekly => "Track of the Week",
        TournamentType::Monthly => "Track of the Month",
    };
    let heading = match previous {
        None => "You're on the board!",
        Some(previous) if current.time < previous.time => "New PB!",
        Some(previous) if current.rank < previous.rank => "Rank improved!",
        Some(_) => "Rank dropped",
    };
    let rank = match previous {
        None => format!("#{}", current.rank),
        Some(previous) => {
            let delta = previous.rank - current.rank;
            if delta == 0 {
                format!("#{} (unchanged)", current.rank)
            } else {
                let direction = if delta > 0 { "up" } else { "down" };
                let noun = if delta.abs() == 1 {
                    "position"
                } else {
                    "positions"
                };
                format!(
                    "#{} ({})",
                    current.rank,
                    improvement(&format!("{direction} {} {noun}", delta.abs()), delta > 0)
                )
            }
        }
    };
    let time = match previous {
        None => format_time(current.time),
        Some(previous) => {
            let delta = (f64::from(current.time) * 1_000.0).round() as i64
                - (f64::from(previous.time) * 1_000.0).round() as i64;
            if delta == 0 {
                format!("{} (unchanged)", format_time(current.time))
            } else {
                format!(
                    "{} ({})",
                    format_time(current.time),
                    improvement(&format!("{:.3}s", delta.abs() as f64 / 1_000.0), delta < 0)
                )
            }
        }
    };
    let points = match previous {
        None => format!("{} pts", current.points),
        Some(previous) => {
            let delta = current.points - previous.points;
            if delta == 0 {
                format!("{} pts (unchanged)", current.points)
            } else {
                let sign = if delta > 0 { "+" } else { "−" };
                format!(
                    "{} pts ({})",
                    current.points,
                    improvement(&format!("{sign}{}", delta.abs()), delta > 0)
                )
            }
        }
    };
    format!(
        "<size=85%><color=#dedede><b>{label}: {heading}</b><br>{rank} · {time} · {points}</color></size>"
    )
}

fn improvement(value: &str, improved: bool) -> String {
    let color = if improved { "#86efac" } else { "#fca5a5" };
    format!("<color={color}>{value}</color>")
}

pub fn submission_message(entries: usize, round_time: u64) -> String {
    format!(
        "/servermessage yellow {round_time} <b>ZSL Level Contest Submissions</b>\n{entries} valid submissions"
    )
}

pub fn format_time(seconds: f32) -> String {
    let milliseconds = (f64::from(seconds) * 1_000.0).round() as i64;
    let minutes = milliseconds / 60_000;
    let remainder = milliseconds - minutes * 60_000;
    format!(
        "{minutes:02}:{:02}.{:03}",
        remainder / 1_000,
        remainder % 1_000
    )
}

fn tournament_period(kind: TournamentType, slug: &str) -> String {
    let fallback = || match kind {
        TournamentType::Weekly => format!("Track of the Week: {slug}"),
        TournamentType::Monthly => format!("Track of the Month: {slug}"),
    };
    let bytes = slug.as_bytes();
    match kind {
        TournamentType::Weekly
            if bytes.len() == 8
                && bytes[..4].iter().all(u8::is_ascii_digit)
                && &bytes[4..6] == b"-w"
                && bytes[6..].iter().all(u8::is_ascii_digit) =>
        {
            format!(
                "Track of the Week: {} Week {}",
                &slug[..4],
                slug[6..].parse::<u8>().unwrap_or_default()
            )
        }
        TournamentType::Monthly
            if bytes.len() == 7
                && bytes[..4].iter().all(u8::is_ascii_digit)
                && bytes[4] == b'-'
                && bytes[5..].iter().all(u8::is_ascii_digit) =>
        {
            const MONTHS: [&str; 12] = [
                "January",
                "February",
                "March",
                "April",
                "May",
                "June",
                "July",
                "August",
                "September",
                "October",
                "November",
                "December",
            ];
            let month = slug[5..].parse::<usize>().unwrap_or_default();
            match month.checked_sub(1).and_then(|index| MONTHS.get(index)) {
                Some(name) => format!("Track of the Month: {name} {}", &slug[..4]),
                None => fallback(),
            }
        }
        _ => fallback(),
    }
}

fn control_or_format() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| Regex::new(r"[\p{Cc}\p{Cf}]").expect("valid Unicode category regex"))
}

fn display_name(value: Option<&str>) -> String {
    let sanitized = control_or_format().replace_all(value.unwrap_or_default(), " ");
    let collapsed = sanitized.split_whitespace().collect::<Vec<_>>().join(" ");
    let name = if collapsed.is_empty() {
        "Unknown player"
    } else {
        &collapsed
    };
    let mut chars = name.chars();
    let prefix = chars.by_ref().take(23).collect::<String>();
    let bounded = if chars.next().is_some() {
        format!("{prefix}…")
    } else {
        name.into()
    };
    escape_text(&bounded)
}

pub fn leaderboard_name(value: &str) -> String {
    let sanitized = control_or_format().replace_all(value, "");
    let bounded = sanitized.chars().take(80).collect::<String>();
    format!("<nobr>{}</nobr>", escape_text(&bounded))
}

fn gtr_version(value: Option<&str>) -> String {
    let sanitized = control_or_format().replace_all(value.unwrap_or_default(), "");
    let collapsed = sanitized.split_whitespace().collect::<Vec<_>>().join(" ");
    escape_text(&collapsed.trim().chars().take(32).collect::<String>())
}

#[cfg(test)]
mod tests {
    use super::*;
    use zc_core::zeepnet::{BitReader, CUSTOM_CHAT_MESSAGE, targeted_chat_message_packet};
    use zc_database::services::lobby_assets::TournamentLobbyStanding;

    fn context() -> TournamentLobbyPlayerContext {
        TournamentLobbyPlayerContext {
            minimum_gtr_version: Some("1.2.3".into()),
            user_exists: true,
            recent_record: true,
            standing: None,
        }
    }

    #[test]
    fn exact_weekly_join_message_and_target_packet() -> Result<()> {
        let message = join_message(TournamentType::Weekly, "Player One", &context());
        assert_eq!(
            message,
            "<size=85%><color=#dedede>Welcome to Track of the Week, Player One<br><br>A time attack tournament featuring a unique level each week.<br><br>View the full tournament leaderboard on <u>zeepki.st/totw</u>!<br><br><size=65%>This is an unattended room, so chat is not monitored. If you find something wrong, please contact Akane on Discord.</size></color></size>"
        );
        let packet = targeted_chat_message_packet(42, &message, HOSTNAME)?;
        let mut reader = BitReader::new(&packet);
        assert_eq!(reader.read_u16()?, CUSTOM_CHAT_MESSAGE);
        assert_eq!(reader.read_u64()?, 42);
        assert_eq!(reader.read_string(4_096)?, message);
        assert_eq!(reader.read_string(4_096)?, HOSTNAME);
        Ok(())
    }

    #[test]
    fn monthly_join_conditions_and_escaping() {
        let message = join_message(
            TournamentType::Monthly,
            "<b>Alice</b>\r\nSecond",
            &TournamentLobbyPlayerContext {
                minimum_gtr_version: Some("<1.17&>".into()),
                user_exists: true,
                recent_record: false,
                standing: Some((12, 34.234)),
            },
        );
        assert!(message.contains("Welcome to Track of the Month, &lt;b&gt;Alice&lt;/b&gt; Second"));
        assert!(message.contains("a unique level each month."));
        assert!(message.contains("<u>zeepki.st/totm</u>!"));
        assert!(message.contains(
            "You need GTR &lt;1.17&amp;&gt;+ installed to join the tournament leaderboard."
        ));
        assert!(
            message.contains("You are currently #12 on the tournament leaderboard with 00:34.234.")
        );
        assert!(!message.contains('\n'));
        assert!(message.len() < 4_097);
        let fallback = join_message(
            TournamentType::Weekly,
            &"😀".repeat(30),
            &TournamentLobbyPlayerContext {
                minimum_gtr_version: None,
                user_exists: false,
                recent_record: false,
                standing: None,
            },
        );
        assert!(fallback.contains(&format!(
            "Welcome to Track of the Week, {}…",
            "😀".repeat(23)
        )));
        assert!(fallback.contains("You need GTR installed to join the tournament leaderboard."));
    }

    #[test]
    fn titles_countdown_and_server_overlay_match_bun() -> Result<()> {
        let now: Timestamp = "2026-08-30T12:00:00Z".parse()?;
        let end: Timestamp = "2026-09-05T15:38:00Z".parse()?;
        assert_eq!(
            tournament_period(TournamentType::Weekly, "2026-w33"),
            "Track of the Week: 2026 Week 33"
        );
        assert_eq!(
            tournament_period(TournamentType::Monthly, "2026-08"),
            "Track of the Month: August 2026"
        );
        assert_eq!(
            tournament_period(TournamentType::Weekly, "custom"),
            "Track of the Week: custom"
        );
        assert_eq!(format_time(61.234), "01:01.234");
        assert_eq!(format_time(59.9996), "01:00.000");
        assert_eq!(
            tournament_remaining(&end.to_string(), now)?,
            "Ends in 6d 3h 38m"
        );
        assert_eq!(
            tournament_remaining(&end.to_string(), now + jiff::SignedDuration::from_secs(60))?,
            "Ends in 6d 3h 37m"
        );
        assert_eq!(
            tournament_remaining(&end.to_string(), end + jiff::SignedDuration::from_millis(1))?,
            "Ends in 0d 0h 0m"
        );
        assert!(tournament_remaining("invalid", now).is_err());
        let snapshot = TournamentLobbySnapshot {
            entries: 42,
            standings: vec![TournamentLobbyStanding {
                user_id: 1,
                record_id: 10,
                steam_id: 42,
                steam_name: Some("<Winner>".into()),
                time: 61.234,
                rank: 1,
                points: 630,
            }],
            connected_players: vec![],
        };
        let command = tournament_message_at(
            TournamentType::Weekly,
            "2026-w33",
            &end.to_string(),
            Some(&snapshot),
            900,
            now,
        )?;
        assert_eq!(
            command,
            "/servermessage yellow 900 <size=160%><b>Track of the Week: 2026 Week 33</b>\n42 Entries Ends in 6d 3h 38m\n<color=#FFD700>1. &lt;Winner&gt; — 01:01.234</color></size>"
        );
        Ok(())
    }

    #[test]
    fn standing_notifications_match_bun_words_and_deltas() {
        let previous = StandingResult {
            rank: 15,
            time: 34.75,
            points: 630,
        };
        let current = StandingResult {
            rank: 12,
            time: 34.234,
            points: 656,
        };
        let message = standing_message(TournamentType::Weekly, Some(previous), current);
        assert!(message.contains("<b>Track of the Week: New PB!</b>"));
        assert!(message.contains("<color=#86efac>up 3 positions</color>"));
        assert!(message.contains("<color=#86efac>0.516s</color>"));
        assert!(message.contains("<color=#86efac>+26</color>"));
        let drop = standing_message(
            TournamentType::Monthly,
            Some(previous),
            StandingResult {
                rank: 16,
                time: 34.75,
                points: 620,
            },
        );
        assert!(drop.contains("Track of the Month: Rank dropped"));
        assert!(drop.contains("<color=#fca5a5>down 1 position</color>"));
        assert!(drop.contains("00:34.750 (unchanged)"));
        assert!(drop.contains("−10"));
        assert!(
            standing_message(TournamentType::Weekly, None, previous)
                .contains("You're on the board!")
        );
    }
}
