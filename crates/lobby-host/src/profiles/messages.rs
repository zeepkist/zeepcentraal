use crate::config::TournamentType;
use anyhow::{Context, Result};
use jiff::Timestamp;
use regex::Regex;
use std::sync::OnceLock;
use zc_database::services::lobby_assets::{TournamentLobbyPlayerContext, TournamentLobbySnapshot};

pub const HOSTNAME: &str = "<#f9cc15>HOST</color>";

pub fn chat_message(heading: &str, color: &str, body: &str) -> String {
    let color_tag = if color.starts_with('#') {
        format!("<{color}>")
    } else {
        format!("<color={color}>")
    };
    format!(
        "<size=85%><#dedede><b><size=100%>{color_tag}{heading}</color></size></b>{body}</color></size>"
    )
}

pub fn chat_notice(heading: &str, body: &str) -> String {
    chat_message(heading, "#4ad9ff", &format!("<br>{body}"))
}

pub fn server_row(label: &str, value: impl std::fmt::Display) -> String {
    format!("<#B8B8B8>{label}</color><pos=7em><b>{value}</b>")
}

pub fn server_message(duration: u64, heading: &str, body: &str) -> String {
    format!(
        "/servermessage white {duration} <size=150%><align=left><b><size=200%><#ffd21c>Zeepkist</color> <#4ad9ff>{heading}</color></size></b><br>{body}</align></size>"
    )
}

pub const UNATTENDED_NOTICE: &str =
    "<size=80%><#B8B8B8>This room is unattended. Report issues to Akane on Discord.</color></size>";

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct StandingResult {
    pub rank: i32,
    pub time: f32,
    pub points: i32,
}

pub fn escape_text(value: &str) -> String {
    // TextMeshPro does not decode HTML entities. Shield each tag opening separately
    // so literal </noparse> text cannot end protection for the rest of the value.
    value.replace('<', "<noparse><</noparse>")
}

// Reference commands: `/cm1`, `/cm2`, `/cm3`, `/cm26`
pub fn join_message(
    kind: TournamentType,
    player_name: &str,
    context: &TournamentLobbyPlayerContext,
) -> String {
    let (event, cadence, route) = match kind {
        TournamentType::Daily => ("Track of the Day", "day", "totd"),
        TournamentType::Weekly => ("Track of the Week", "week", "totw"),
        TournamentType::Monthly => ("Track of the Month", "month", "totm"),
    };
    let mut body = format!(
        "Welcome, <b>{}</b>! Race a different track each {cadence}.<br><br><b>Leaderboard:</b> <#4ad9ff><u>zeepki.st/{route}</u></color>",
        display_name(Some(player_name))
    );
    if !context.user_exists || !context.recent_record {
        let minimum = gtr_version(context.minimum_gtr_version.as_deref());
        let requirement = if minimum.is_empty() {
            "<br>Install <b>GTR</b> to join the leaderboard.".to_owned()
        } else {
            format!(
                "<br>Install <b>GTR {minimum}+</b> with <b>Modkist</b> (<#4ad9ff><u>zeepki.st/wiki/setup-modkist</u></color>) to join the leaderboard."
            )
        };
        body.push_str(&requirement);
    }
    if let Some((rank, time)) = context.standing {
        body.push_str(&format!(
            "<br>Your standing: <b>#{rank}</b> <b>{}</b>",
            format_time(time)
        ));
    }
    body.push_str("<br><br>");
    body.push_str(UNATTENDED_NOTICE);
    chat_notice(event, &body)
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
    let heading = match kind {
        TournamentType::Daily => "Track of the Day",
        TournamentType::Weekly => "Track of the Week",
        TournamentType::Monthly => "Track of the Month",
    };
    let period = tournament_period(kind, slug);
    let remaining = overlay_remaining(end_at, now)?;
    let entries = snapshot
        .map(|s| s.entries.to_string())
        .unwrap_or_else(|| "…".into());
    // Reference commands: `/sm1`, `/sm2`, `/sm3`
    let leaderboard = match snapshot {
        // Reference command: `/sm1`
        None => "<#B8B8B8><i>Leaderboard loading…</i></color>".into(),
        // Reference command: `/sm3`
        Some(s) if s.standings.is_empty() => {
            "<#B8B8B8><i>Set a time with GTR to appear on the leaderboard!</i></color>".into()
        }
        // Reference command: `/sm2`
        Some(s) => {
            let cell = |index: usize, position: &str, time_position: u8| {
                let row = &s.standings[index];
                let color = ["#FFD700", "#C0C0C0", "#CD7F32"]
                    .get(index)
                    .copied()
                    .unwrap_or("#FFFFFF");
                let name = bounded_display_name(row.steam_name.as_deref(), 10);
                format!(
                    "{position}<{color}>{}. {name}<pos={time_position}em>{}</color>",
                    row.rank,
                    format_time(row.time)
                )
            };
            (0..s.standings.len().min(6))
                .map(|left| {
                    let mut row = cell(left, "", 13);
                    if left + 6 < s.standings.len() {
                        row.push_str(&cell(left + 6, "<pos=22em>", 35));
                    }
                    row
                })
                .collect::<Vec<_>>()
                .join("<br>")
        }
    };
    let body = format!(
        "{}<br>{}<br>{}<br><br><b>Leaderboard</b><br>{leaderboard}",
        server_row(
            "Period",
            escape_text(
                period
                    .strip_prefix(heading)
                    .and_then(|value| value.strip_prefix(": "))
                    .unwrap_or(&period)
            )
        ),
        server_row("Entries", entries),
        server_row("Ends in", remaining.trim_start_matches("Ends in "))
    );
    Ok(server_message(round_time, heading, &body))
}

fn overlay_remaining(end_at: &str, now: Timestamp) -> Result<String> {
    let end: Timestamp = end_at.parse().context("Tournament end time is invalid")?;
    let milliseconds = (end.as_millisecond() - now.as_millisecond()).max(0);
    let minute = 60_000;
    let hour = 60 * minute;
    let day = 24 * hour;
    let result = if milliseconds >= 7 * day {
        let days = (milliseconds + day - 1) / day;
        format!("{}w {}d", days / 7, days % 7)
    } else if milliseconds >= day {
        let hours = (milliseconds + hour - 1) / hour;
        format!("{}d {}h", hours / 24, hours % 24)
    } else {
        let minutes = (milliseconds + minute - 1) / minute;
        if milliseconds >= hour {
            format!("{}h {}m", minutes / 60, minutes % 60)
        } else {
            format!("{minutes}m")
        }
    };
    Ok(result)
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

pub fn standing_message(previous: Option<StandingResult>, current: StandingResult) -> String {
    let (heading, color) = match previous {
        // Reference command: `/cm20`
        None => ("You're on the board!", "#4ad9ff"),
        // Reference commands: `/cm4`, `/cm28`
        Some(previous) if current.time < previous.time => ("New Personal Best!", "#4ad9ff"),
        // Reference command: `/cm21`
        Some(previous) if current.rank < previous.rank => ("Rank improved!", "#fca5a5"),
        // Reference command: `/cm22`
        Some(_) => ("Rank dropped", "#fca5a5"),
    };
    let mut rank = format!("#{}", current.rank);
    let mut time = format_time(current.time);
    let mut points = current.points.to_string();
    if let Some(previous) = previous {
        let rank_delta = i64::from(current.rank) - i64::from(previous.rank);
        let time_delta = ((f64::from(current.time) * 1_000.0).round()
            - (f64::from(previous.time) * 1_000.0).round())
            / 1_000.0;
        let points_delta = i64::from(current.points) - i64::from(previous.points);
        for (value, delta, improved) in [
            (
                &mut rank,
                (rank_delta != 0).then(|| format!("{rank_delta:+}")),
                rank_delta < 0,
            ),
            (
                &mut time,
                (time_delta != 0.0).then(|| format!("{time_delta:+.3}s")),
                time_delta < 0.0,
            ),
            (
                &mut points,
                (points_delta != 0).then(|| format!("{points_delta:+}")),
                points_delta > 0,
            ),
        ] {
            if let Some(delta) = delta {
                value.push(' ');
                value.push_str(&improvement(&delta, improved));
            }
        }
    }
    chat_message(
        heading,
        color,
        &format!(
            "<br><#B8B8B8>Rank:</color> <b>{rank}</b>  <#B8B8B8>Points:</color> <b>{points}</b><br><#B8B8B8>Time:</color> <b>{time}</b>"
        ),
    )
}

fn improvement(value: &str, improved: bool) -> String {
    let color = if improved { "#86efac" } else { "#fca5a5" };
    format!("<{color}>{value}</color>")
}

// Reference command: `/sm4`
pub fn submission_message(entries: usize, position: usize, round_time: u64) -> String {
    server_message(
        round_time,
        "ZSL Level Contest",
        &submission_rows(entries, position),
    )
}

fn submission_rows(entries: usize, position: usize) -> String {
    format!(
        "{}<br>{}",
        server_row("Entries", format_args!("{entries} valid submissions")),
        server_row("Submission", format_args!("{position} of {entries}"))
    )
}

// Reference commands: `/sm5`, `/sm6`
pub fn scheduled_submission_message(
    entries: usize,
    position: usize,
    round_time: u64,
    submission_end: &str,
    vote_end: &str,
    now: Timestamp,
) -> Result<String> {
    let deadline: Timestamp = submission_end.parse()?;
    let (label, action, remaining) = if now < deadline {
        (
            "Submissions",
            "Close in",
            tournament_remaining(submission_end, now)?,
        )
    } else {
        ("Voting", "Closes in", tournament_remaining(vote_end, now)?)
    };
    let start = submission_end
        .get(..16)
        .unwrap_or(submission_end)
        .replace('T', " ");
    let end = vote_end.get(..16).unwrap_or(vote_end).replace('T', " ");
    let body = format!(
        "{}<br>{}<br><br><b>Voting window</b><br>{} to {} UTC<br><#4ad9ff>https://zeepki.st/super-league/vote</color>",
        submission_rows(entries, position),
        server_row(
            label,
            format_args!("{action} {}", remaining.trim_start_matches("Ends in "))
        ),
        escape_text(&start),
        escape_text(&end)
    );
    Ok(server_message(round_time, "ZSL Level Contest", &body))
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
        TournamentType::Daily => format!("Track of the Day: {slug}"),
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
    bounded_display_name(value, 24)
}

fn bounded_display_name(value: Option<&str>, max_chars: usize) -> String {
    let sanitized = control_or_format().replace_all(value.unwrap_or_default(), " ");
    let collapsed = sanitized.split_whitespace().collect::<Vec<_>>().join(" ");
    let name = if collapsed.is_empty() {
        "Unknown player"
    } else {
        &collapsed
    };
    let mut chars = name.chars();
    let prefix = chars.by_ref().take(max_chars - 1).collect::<String>();
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

    #[test]
    fn daily_messages_use_daily_label_period_and_route() {
        assert_eq!(
            tournament_period(TournamentType::Daily, "2026-11-11"),
            "Track of the Day: 2026-11-11"
        );
        let message = join_message(TournamentType::Daily, "Player One", &context());
        assert!(message.contains("Track of the Day"));
        assert!(message.contains("/totd"));
    }

    #[test]
    fn literal_text_preserves_punctuation_unicode_and_entity_looking_names() {
        for value in [
            "",
            "Rock & Roll",
            "\"Alice's\" > café 雪 🏁",
            "&amp; &lt; &#60; &#x3C;",
        ] {
            assert_eq!(escape_text(value), value);
        }
    }

    #[test]
    fn literal_text_shields_rich_text_tags_and_noparse_delimiters() {
        for (value, expected) in [
            ("<>", "<noparse><</noparse>>"),
            ("<size=200%>", "<noparse><</noparse>size=200%>"),
            ("<color=red>", "<noparse><</noparse>color=red>"),
            ("<noparse>", "<noparse><</noparse>noparse>"),
            (
                "</noparse><b>X</b>",
                "<noparse><</noparse>/noparse><noparse><</noparse>b>X<noparse><</noparse>/b>",
            ),
            ("<<", "<noparse><</noparse><noparse><</noparse>"),
        ] {
            assert_eq!(escape_text(value), expected);
        }
    }

    #[test]
    fn submission_overlay_switches_to_vote_countdown() -> Result<()> {
        let close = "2026-09-27T17:00:00Z";
        let vote_end = "2026-10-04T17:00:00Z";
        let before = scheduled_submission_message(
            14,
            3,
            300,
            close,
            vote_end,
            "2026-09-27T16:59:01Z".parse()?,
        )?;
        assert!(before.contains("Submissions</color><pos=7em><b>Close in 0d 0h 1m"));
        assert!(before.contains("Voting window</b><br>2026-09-27 17:00 to 2026-10-04 17:00 UTC"));
        let after = scheduled_submission_message(
            14,
            3,
            300,
            close,
            vote_end,
            "2026-09-27T17:00:00Z".parse()?,
        )?;
        assert!(after.contains("Voting</color><pos=7em><b>Closes in 7d 0h 0m"));
        assert!(after.contains("https://zeepki.st/super-league/vote"));
        Ok(())
    }
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
            "<size=85%><#dedede><b><size=100%><#4ad9ff>Track of the Week</color></size></b><br>Welcome, <b>Player One</b>! Race a different track each week.<br><br><b>Leaderboard:</b> <#4ad9ff><u>zeepki.st/totw</u></color><br><br><size=80%><#B8B8B8>This room is unattended. Report issues to Akane on Discord.</color></size></color></size>"
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
        assert!(
            message
                .contains("Welcome, <b><noparse><</noparse>b>Alice<noparse><</noparse>/b> Second")
        );
        assert!(message.contains("Race a different track each month."));
        assert!(message.contains("<u>zeepki.st/totm</u>"));
        assert!(
            message.contains("Install <b>GTR <noparse><</noparse>1.17&>+</b> with <b>Modkist</b>")
        );
        assert!(message.contains("Your standing: <b>#12</b> <b>00:34.234</b>"));
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
        assert!(fallback.contains(&format!("Welcome, <b>{}…", "😀".repeat(23))));
        assert!(fallback.contains("Install <b>GTR</b> to join the leaderboard."));
    }

    #[test]
    fn tournament_overlay_uses_positioned_columns() -> Result<()> {
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
            "/servermessage white 900 <size=150%><align=left><b><size=200%><#ffd21c>Zeepkist</color> <#4ad9ff>Track of the Week</color></size></b><br><#B8B8B8>Period</color><pos=7em><b>2026 Week 33</b><br><#B8B8B8>Entries</color><pos=7em><b>42</b><br><#B8B8B8>Ends in</color><pos=7em><b>6d 4h</b><br><br><b>Leaderboard</b><br><#FFD700>1. <noparse><</noparse>Winner><pos=13em>01:01.234</color></align></size>"
        );
        Ok(())
    }

    #[test]
    fn overlay_wire_fixtures_and_fragmentation() -> Result<()> {
        let now: Timestamp = "2026-11-27T09:00:00Z".parse()?;
        let end = "2026-11-28T18:00:00Z";
        let mut expected = include_str!("../../tests/fixtures/tournament-overlay.hex").lines();
        for (label, count, name) in [
            ("loading", None, ""),
            ("empty", Some(0), ""),
            ("one", Some(1), "Player"),
            ("six", Some(6), "Player"),
            ("seven", Some(7), "Player"),
            ("twelve", Some(12), "Player"),
            ("unicode", Some(12), "日本語🧼"),
            ("escaped", Some(12), "<<<<<<<<<"),
            ("boundary-1195", Some(12), "日本語🧼"),
            ("boundary-1196", Some(12), "日本語🧼"),
        ] {
            let snapshot = count.map(|count| TournamentLobbySnapshot {
                entries: 42,
                standings: (1..=count)
                    .map(|rank| TournamentLobbyStanding {
                        user_id: rank,
                        record_id: rank + 10,
                        steam_id: i64::from(rank),
                        steam_name: Some(if label.starts_with("boundary-") {
                            let extra = if label == "boundary-1195" { 49 } else { 50 };
                            format!(
                                "{name}{}",
                                "x".repeat((extra - 5 * (rank - 1)).clamp(0, 5) as usize)
                            )
                        } else {
                            name.into()
                        }),
                        time: 61.234,
                        rank,
                        points: 630,
                    })
                    .collect(),
                connected_players: vec![],
            });
            let mut command = tournament_message_at(
                TournamentType::Daily,
                "2026-11-27",
                end,
                snapshot.as_ref(),
                900,
                now,
            )?;
            assert_eq!(
                command.matches("<pos=22em>").count(),
                (count.unwrap_or(0) - 6).max(0) as usize
            );
            if let Some(boundary) = label.strip_prefix("boundary-") {
                let bytes = zc_core::zeepnet::chat_message_packet(&command)?.len();
                command.push_str(&" ".repeat(boundary.parse::<usize>()? - bytes));
            }
            let packet = zc_core::zeepnet::chat_message_packet(&command)?;
            if label == "one" {
                assert!(packet.len() <= 1195);
            }
            if label == "escaped" {
                assert!(packet.len() > 1195);
            }
            if let Some(boundary) = label.strip_prefix("boundary-") {
                assert_eq!(packet.len(), boundary.parse::<usize>()?, "{label}");
            }
            let (expected_label, expected_hex) = expected
                .next()
                .context("Missing overlay fixture")?
                .split_once(' ')
                .context("Invalid overlay fixture")?;
            assert_eq!(expected_label, label);
            assert!(
                hex::encode(packet) == expected_hex,
                "Overlay fixture {label} differs"
            );
        }
        assert!(expected.next().is_none());
        Ok(())
    }

    #[test]
    fn overlay_countdown_rounds_up_at_each_display_unit() -> Result<()> {
        let now: Timestamp = "2026-11-27T09:00:00Z".parse()?;
        for (seconds, expected) in [
            (0, "0m"),
            (1, "1m"),
            (421, "8m"),
            (3599, "60m"),
            (3600, "1h 0m"),
            (16680, "4h 38m"),
            (86400, "1d 0h"),
            (446400, "5d 4h"),
            (604800, "1w 0d"),
            (2160000, "3w 4d"),
            (2160001, "3w 5d"),
        ] {
            let end = now + jiff::SignedDuration::from_secs(seconds);
            assert_eq!(overlay_remaining(&end.to_string(), now)?, expected);
        }
        Ok(())
    }

    #[test]
    fn standing_notifications_use_compact_signed_deltas() {
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
        let message = standing_message(Some(previous), current);
        assert!(message.contains("<#4ad9ff>New Personal Best!</color>"));
        assert!(message.contains("<#86efac>-3</color>"));
        assert!(message.contains("<#86efac>-0.516s</color>"));
        assert!(message.contains("<#86efac>+26</color>"));
        assert!(message.contains("-3</color></b>  <#B8B8B8>Points:"));
        assert!(message.contains("</b><br><#B8B8B8>Time:"));
        let drop = standing_message(
            Some(previous),
            StandingResult {
                rank: 16,
                time: 34.75,
                points: 620,
            },
        );
        assert!(drop.contains("<#fca5a5>Rank dropped</color>"));
        assert!(drop.contains("<#fca5a5>+1</color>"));
        assert!(drop.contains("Time:</color> <b>00:34.750</b>"));
        assert!(drop.contains("<#fca5a5>-10</color>"));
        assert!(standing_message(None, previous).contains("You're on the board!"));
    }
}
