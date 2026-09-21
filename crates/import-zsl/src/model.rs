use serde::{
    Deserialize, Deserializer,
    de::{MapAccess, Visitor},
};
use std::fmt;

pub type SuperLeagueMetadata = Vec<(String, SeasonMetadata)>;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SeasonMetadata {
    #[serde(deserialize_with = "ordered_events")]
    pub events: Vec<(String, EventMetadata)>,
}

fn ordered_events<'de, D>(deserializer: D) -> Result<Vec<(String, EventMetadata)>, D::Error>
where
    D: Deserializer<'de>,
{
    struct OrderedEvents;

    impl<'de> Visitor<'de> for OrderedEvents {
        type Value = Vec<(String, EventMetadata)>;

        fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
            formatter.write_str("an object of Super League events")
        }

        fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
        where
            A: MapAccess<'de>,
        {
            let mut entries = Vec::with_capacity(map.size_hint().unwrap_or(0));
            while let Some(entry) = map.next_entry()? {
                entries.push(entry);
            }
            Ok(entries)
        }
    }

    deserializer.deserialize_map(OrderedEvents)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventMetadata {
    pub name: String,
    #[serde(default)]
    pub workshop_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SeasonStanding {
    pub steam_id: String,
    pub total_points: i32,
}

#[derive(Debug, Deserialize)]
pub struct TournamentEvent {
    pub levels: Vec<TournamentLevel>,
    pub users: Vec<TournamentUser>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TournamentUser {
    pub steam_id: String,
    pub total_points: i32,
}

#[derive(Debug, Deserialize)]
pub struct TournamentLevel {
    pub level: String,
    pub standings: Vec<TournamentStanding>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TournamentStanding {
    pub points: i32,
    pub steam_id: String,
    pub time: Option<f32>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn event_order_matches_json_insertion_order() {
        let season: SeasonMetadata = serde_json::from_str(
            r#"{"events":{"2025-03-01":{"name":"third"},"2025-01-01":{"name":"first"}}}"#,
        )
        .expect("season metadata");
        assert_eq!(season.events[0].0, "2025-03-01");
        assert_eq!(season.events[1].0, "2025-01-01");
    }
}
