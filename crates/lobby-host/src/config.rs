use anyhow::{Result, ensure};
use serde::Deserialize;
use std::collections::HashSet;

const DAY_SECONDS: u64 = 24 * 60 * 60;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct LobbyHostFileConfig {
    pub version: u8,
    pub rooms: Vec<ManagedRoomConfig>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct ManagedRoomConfig {
    pub key: String,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    pub profile: RoomProfile,
    pub room: RoomSettings,
    pub round_time_seconds: u64,
    pub asset_poll_ms: u64,
    pub reconnect_max_ms: u64,
    pub message_refresh_ms: u64,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(tag = "type", deny_unknown_fields)]
pub enum RoomProfile {
    #[serde(rename = "track-tournament", rename_all = "camelCase")]
    TrackTournament { tournament_type: TournamentType },
    #[serde(rename = "zsl-submissions", rename_all = "camelCase")]
    ZslSubmissions { round_id: i32 },
    #[serde(rename = "zsl-practice", rename_all = "camelCase")]
    ZslPractice { round_id: i32, playlist: String },
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TournamentType {
    Weekly,
    Monthly,
}

#[derive(Clone, Debug, Deserialize, serde::Serialize, Eq, PartialEq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct RoomSettings {
    pub name: String,
    pub is_public: bool,
    pub max_players: u8,
}

fn default_enabled() -> bool {
    true
}

impl LobbyHostFileConfig {
    pub fn parse(source: &str) -> Result<Self> {
        let config: Self = serde_json::from_str(source)?;
        config.validate()?;
        Ok(config)
    }

    pub fn validate(&self) -> Result<()> {
        ensure!(self.version == 1, "Unsupported lobby host config version");
        ensure!(
            (1..=32).contains(&self.rooms.len()),
            "Lobby host must contain between 1 and 32 rooms"
        );
        let mut keys = HashSet::new();
        for room in &self.rooms {
            room.validate()?;
            ensure!(
                keys.insert(&room.key),
                "Duplicate managed room key: {}",
                room.key
            );
        }
        Ok(())
    }
}

impl ManagedRoomConfig {
    fn validate(&self) -> Result<()> {
        validate_key(&self.key)?;
        let name = self.room.name.trim();
        ensure!(
            !name.is_empty() && name.len() <= 256,
            "Room name must contain between 1 and 256 UTF-8 bytes"
        );
        ensure!(
            (2..=64).contains(&self.room.max_players),
            "Invalid room player limit"
        );
        ensure!(
            (60..=DAY_SECONDS).contains(&self.round_time_seconds),
            "Invalid round time"
        );
        ensure!(
            (5_000..=1_800_000).contains(&self.asset_poll_ms),
            "Invalid asset poll interval"
        );
        ensure!(
            (5_000..=600_000).contains(&self.reconnect_max_ms),
            "Invalid reconnect interval"
        );
        ensure!(
            (60_000..=1_800_000).contains(&self.message_refresh_ms),
            "Invalid message refresh interval"
        );
        if let RoomProfile::ZslPractice { playlist, .. } = &self.profile {
            zc_core::practice::validate_playlist_url(playlist)?;
        }
        if let RoomProfile::ZslSubmissions { round_id }
        | RoomProfile::ZslPractice { round_id, .. } = &self.profile
        {
            ensure!(*round_id > 0, "Invalid ZSL round ID");
        }
        Ok(())
    }
}

fn validate_key(key: &str) -> Result<()> {
    ensure!(
        !key.is_empty()
            && key.len() <= 64
            && key
                .as_bytes()
                .first()
                .is_some_and(u8::is_ascii_alphanumeric)
            && key.as_bytes().last().is_some_and(u8::is_ascii_alphanumeric)
            && key.bytes().all(|byte| byte.is_ascii_lowercase()
                || byte.is_ascii_digit()
                || byte == b'_'
                || byte == b'-'),
        "Invalid managed room key"
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn room(key: &str) -> String {
        format!(
            r#"{{"key":"{key}","profile":{{"type":"track-tournament","tournamentType":"weekly"}},"room":{{"name":"Room","isPublic":true,"maxPlayers":64}},"roundTimeSeconds":900,"assetPollMs":30000,"reconnectMaxMs":60000,"messageRefreshMs":60000}}"#
        )
    }

    #[test]
    fn accepts_current_file_contract_and_rejects_duplicate_keys() {
        let source = format!(r#"{{"version":1,"rooms":[{}]}}"#, room("totw"));
        assert!(LobbyHostFileConfig::parse(&source).is_ok());
        let duplicate = format!(
            r#"{{"version":1,"rooms":[{},{}]}}"#,
            room("totw"),
            room("totw")
        );
        assert!(
            LobbyHostFileConfig::parse(&duplicate)
                .unwrap_err()
                .to_string()
                .contains("Duplicate")
        );
    }

    #[test]
    fn rejects_unknown_fields_and_invalid_boundaries() {
        assert!(LobbyHostFileConfig::parse(r#"{"version":1,"rooms":[],"extra":true}"#).is_err());
        let source = format!(r#"{{"version":1,"rooms":[{}]}}"#, room("BAD KEY"));
        assert!(LobbyHostFileConfig::parse(&source).is_err());
    }
    #[test]
    fn enabled_defaults_and_disabled_profiles_are_validated() -> Result<()> {
        let base = room("practice");
        let parse = |room: &str| {
            LobbyHostFileConfig::parse(&format!(r#"{{"version":1,"rooms":[{room}]}}"#))
        };
        assert!(parse(&base)?.rooms[0].enabled);
        for enabled in [true, false] {
            let explicit = base.replacen("\"key\":", &format!("\"enabled\":{enabled},\"key\":"), 1);
            assert_eq!(parse(&explicit)?.rooms[0].enabled, enabled);
        }
        assert!(parse(&base.replacen("\"key\":", "\"enabled\":\"false\",\"key\":", 1)).is_err());
        let practice = base.replace(r#"{"type":"track-tournament","tournamentType":"weekly"}"#,
            r#"{"type":"zsl-practice","roundId":50,"playlist":"https://cdn.example.com/practice.zeeplist"}"#)
            .replacen("\"key\":", "\"enabled\":false,\"key\":", 1);
        assert!(!parse(&practice)?.rooms[0].enabled);
        assert!(parse(&practice.replace("\"roundId\":50", "\"roundId\":0")).is_err());
        assert!(parse(&practice.replace("https://cdn.example.com", "file:///tmp")).is_err());
        Ok(())
    }
}
