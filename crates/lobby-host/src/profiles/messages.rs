use crate::config::TournamentType;
use zc_database::services::lobby_assets::TournamentLobbySnapshot;

pub fn escape_text(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

pub fn tournament_message(
    tournament_type: TournamentType,
    slug: &str,
    end_at: &str,
    snapshot: Option<&TournamentLobbySnapshot>,
    round_time: u64,
) -> String {
    let period = tournament_period(tournament_type, slug);
    let entries = snapshot
        .map(|value| value.entries.to_string())
        .unwrap_or_else(|| "…".into());
    let leaderboard = match snapshot {
        None => "Leaderboard loading…".into(),
        Some(snapshot) if snapshot.standings.is_empty() => {
            "Set a time with GTR to appear on the leaderboard!".into()
        }
        Some(snapshot) => snapshot
            .standings
            .iter()
            .enumerate()
            .map(|(index, row)| {
                let color = ["#FFD700", "#C0C0C0", "#CD7F32"]
                    .get(index)
                    .copied()
                    .unwrap_or("#FFFFFF");
                let name = sanitize_name(row.steam_name.as_deref());
                format!(
                    "<color={color}>{}. {name} — {}</color>",
                    row.rank,
                    format_time(row.time)
                )
            })
            .collect::<Vec<_>>()
            .join("\n"),
    };
    format!(
        "/servermessage yellow {round_time} <size=160%><b>{}</b>\n{entries} Entries Ends at {}\n{leaderboard}</size>",
        escape_text(&period),
        escape_text(end_at)
    )
}

pub fn submission_message(entries: usize, round_time: u64) -> String {
    format!(
        "/servermessage yellow {round_time} <b>ZSL Level Contest Submissions</b>\n{entries} valid submissions"
    )
}

pub fn format_time(seconds: f32) -> String {
    let milliseconds = (seconds * 1_000.0).round() as i64;
    let minutes = milliseconds / 60_000;
    let remainder = milliseconds - minutes * 60_000;
    format!(
        "{minutes:02}:{:02}.{:03}",
        remainder / 1_000,
        remainder % 1_000
    )
}

fn tournament_period(tournament_type: TournamentType, slug: &str) -> String {
    match tournament_type {
        TournamentType::Weekly => slug
            .split_once("-w")
            .and_then(|(year, week)| Some((year.parse::<u16>().ok()?, week.parse::<u8>().ok()?)))
            .map_or_else(
                || format!("Track of the Week: {slug}"),
                |(year, week)| format!("Track of the Week: {year} Week {week}"),
            ),
        TournamentType::Monthly => format!("Track of the Month: {slug}"),
    }
}

fn sanitize_name(value: Option<&str>) -> String {
    let mut value = value
        .unwrap_or("Unknown player")
        .chars()
        .map(|character| {
            if character.is_control() {
                ' '
            } else {
                character
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    if value.is_empty() {
        value.push_str("Unknown player");
    }
    let mut characters = value.chars();
    let prefix = characters.by_ref().take(23).collect::<String>();
    if characters.next().is_some() {
        value = format!("{prefix}…");
    }
    escape_text(&value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_time_and_escapes_names() {
        assert_eq!(format_time(61.2346), "01:01.235");
        assert_eq!(
            sanitize_name(Some("<b>A&B</b>")),
            "&lt;b&gt;A&amp;B&lt;/b&gt;"
        );
    }
}
