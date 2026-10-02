use crate::{
    backend::{TournamentSnapshot, TournamentStanding},
    media::thumbnail_url,
};
use serenity::builder::{
    CreateActionRow, CreateButton, CreateContainerComponent, CreateSection, CreateSectionAccessory,
    CreateSectionComponent, CreateTextDisplay, CreateThumbnail, CreateUnfurledMediaItem,
};

pub(crate) fn container_components(
    snapshot: &TournamentSnapshot,
    standings: &[TournamentStanding],
    frontend_url: &reqwest::Url,
    footer: &str,
) -> Vec<CreateContainerComponent<'static>> {
    let (name, route, label) = if snapshot.tournament_type == 0 {
        ("Track of the Week", "totw", "TOTW")
    } else {
        ("Track of the Month", "totm", "TOTM")
    };
    let ends = snapshot.end_at.parse::<jiff::Timestamp>().map_or_else(
        |_| snapshot.end_at.clone(),
        |timestamp| format!("<t:{}:R>", timestamp.as_second()),
    );
    let details = CreateTextDisplay::new(format!(
        "## {name} • {}\nCurrent competition standings\n### Tournament details\n**Level**  {}\n**Entries**  {}\n**Ends**  {ends}",
        snapshot.tournament_slug, snapshot.level_name, snapshot.entries,
    ));
    let header = match snapshot.image_url.as_deref().and_then(thumbnail_url) {
        Some(url) => CreateContainerComponent::Section(CreateSection::new(
            vec![CreateSectionComponent::TextDisplay(details)],
            CreateSectionAccessory::Thumbnail(
                CreateThumbnail::new(CreateUnfurledMediaItem::new(url))
                    .description(snapshot.level_name.clone()),
            ),
        )),
        None => CreateContainerComponent::TextDisplay(details),
    };
    let leaderboard = if standings.is_empty() {
        "No submitted times yet.".to_owned()
    } else {
        standings
            .iter()
            .map(|standing| {
                let milliseconds = (standing.time * 1_000.0).round() as i64;
                format!(
                    "**{}.** {} • {:02}:{:02}.{:03} • {} pts",
                    standing.rank,
                    standing.steam_name.as_deref().unwrap_or("Unknown player"),
                    milliseconds / 60_000,
                    milliseconds / 1_000 % 60,
                    milliseconds % 1_000,
                    standing.points,
                )
            })
            .collect::<Vec<_>>()
            .join("\n")
    };
    let target = frontend_url
        .join(&format!("/{route}/{}", snapshot.tournament_slug).to_ascii_lowercase())
        .map(|url| url.to_string())
        .unwrap_or_else(|_| frontend_url.to_string());
    let playlist = frontend_url
        .join(&format!(
            "/api/tournaments/playlist?type={}&slug={}",
            snapshot.tournament_type, snapshot.tournament_slug
        ))
        .map(|url| url.to_string())
        .unwrap_or_else(|_| frontend_url.to_string());
    vec![
        header,
        CreateContainerComponent::TextDisplay(CreateTextDisplay::new(format!(
            "### Leaderboard\n{leaderboard}\n{footer}"
        ))),
        CreateContainerComponent::ActionRow(CreateActionRow::buttons(vec![
            CreateButton::new_link(target).label(format!("Open {label}")),
            CreateButton::new_link(playlist).label("Download level playlist"),
        ])),
    ]
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use serde_json::{Value, json};

    pub(crate) fn snapshot() -> TournamentSnapshot {
        serde_json::from_value(json!({
            "tournamentId": 42,
            "tournamentType": 0,
            "tournamentSlug": "2026-W40",
            "endAt": "2026-10-05T06:00:00.000Z",
            "levelName": "Fixture track",
            "imageUrl": "https://example.com/track.jpg",
            "entries": 1,
            "standings": [{
                "userId": 1, "steamName": "Fixture player", "discordId": null,
                "time": 49.332, "rank": 1, "points": 1000
            }]
        }))
        .unwrap()
    }

    fn render(snapshot: &TournamentSnapshot) -> Value {
        serde_json::to_value(container_components(
            snapshot,
            &snapshot.standings,
            &"https://zeepki.st".parse().unwrap(),
            "-# ZeepCentraal",
        ))
        .unwrap()
    }

    #[test]
    fn weekly_details_have_thumbnail_relative_end_and_lowercase_link() {
        let snapshot = snapshot();
        let value = render(&snapshot);
        assert_eq!(value[0]["type"], 9);
        assert_eq!(value[0]["accessory"]["type"], 11);
        assert_eq!(
            value[0]["accessory"]["media"]["url"],
            snapshot.image_url.unwrap()
        );
        assert_eq!(value[0]["accessory"]["description"], "Fixture track");
        let details = value[0]["components"][0]["content"].as_str().unwrap();
        assert!(details.contains("Track of the Week • 2026-W40"));
        assert!(details.contains("**Ends**  <t:1791180000:R>"));
        assert!(!details.contains("### Leaderboard"));
        assert!(
            value[1]["content"]
                .as_str()
                .unwrap()
                .contains("00:49.332 • 1000 pts")
        );
        assert_eq!(
            value[2]["components"][0]["url"],
            "https://zeepki.st/totw/2026-w40"
        );
        assert_eq!(value[2]["components"][0]["label"], "Open TOTW");
        assert_eq!(
            value[2]["components"][1]["url"],
            "https://zeepki.st/api/tournaments/playlist?type=0&slug=2026-W40"
        );
    }

    #[test]
    fn stored_thumbnail_keys_render_as_cdn_urls_for_both_tournament_types() {
        for tournament_type in [0, 1] {
            let mut snapshot = snapshot();
            snapshot.tournament_type = tournament_type;
            for key in ["thumbnails/track.jpg", "/thumbnails/track.jpg"] {
                snapshot.image_url = Some(key.into());
                let value = render(&snapshot);
                assert_eq!(
                    value[0]["accessory"]["media"]["url"],
                    "https://cdn.zeepki.st/thumbnails/track.jpg"
                );
            }
        }
    }

    #[test]
    fn invalid_thumbnail_does_not_block_tournament_details() {
        let mut snapshot = snapshot();
        for image in [
            "not a URL",
            "https://[invalid]/track.jpg",
            "file:///track.jpg",
        ] {
            snapshot.image_url = Some(image.into());
            let value = render(&snapshot);
            assert_eq!(value[0]["type"], 10);
            assert!(
                value[0]["content"]
                    .as_str()
                    .unwrap()
                    .contains("Fixture track")
            );
            assert!(value[1]["content"].as_str().unwrap().contains("00:49.332"));
            assert_eq!(value[2]["components"][0]["label"], "Open TOTW");
        }
    }

    #[test]
    fn absent_thumbnail_and_empty_monthly_standings_still_render() {
        let mut snapshot = snapshot();
        snapshot.tournament_type = 1;
        snapshot.tournament_slug = "2026-10".into();
        snapshot.standings.clear();
        for image in [None, Some(String::new()), Some("  ".into())] {
            snapshot.image_url = image;
            let value = render(&snapshot);
            assert_eq!(value[0]["type"], 10);
            assert!(
                value[0]["content"]
                    .as_str()
                    .unwrap()
                    .contains("Track of the Month • 2026-10")
            );
            assert!(
                value[1]["content"]
                    .as_str()
                    .unwrap()
                    .contains("No submitted times yet.")
            );
            assert_eq!(
                value[2]["components"][0]["url"],
                "https://zeepki.st/totm/2026-10"
            );
            assert_eq!(value[2]["components"][0]["label"], "Open TOTM");
        }
    }

    #[test]
    fn end_timestamp_handles_offsets_fractions_and_invalid_input() {
        let mut snapshot = snapshot();
        for end in ["2026-10-05T06:00:00.999Z", "2026-10-05T08:00:00+02:00"] {
            snapshot.end_at = end.into();
            assert!(render(&snapshot).to_string().contains("<t:1791180000:R>"));
        }
        snapshot.end_at = "invalid end".into();
        assert!(
            render(&snapshot)
                .to_string()
                .contains("**Ends**  invalid end")
        );
    }
}
