use crate::profiles::messages::leaderboard_name;
use crate::roster::connected_player;
use anyhow::Result;
use std::collections::{HashMap, HashSet};
use zc_core::zeepnet::{
    GameHostPacket, GameHostPlayer, LeaderboardOverrides, player_leaderboard_overrides_packet,
    player_leaderboard_time_packet,
};

#[derive(Clone, Debug)]
pub struct DesiredPlayerStanding {
    pub overrides: LeaderboardOverrides,
    pub steam_id: u64,
    pub time: Option<f32>,
}

/// Room-local projection. Steam identities never leave this process through telemetry.
pub struct PlayerLeaderboard {
    roster: HashMap<u32, GameHostPlayer>,
    results: HashMap<u64, DesiredPlayerStanding>,
    times: HashMap<u64, f32>,
    overrides: HashMap<u64, LeaderboardOverrides>,
    clearing: HashSet<u64>,
    local_steam_id: u64,
    ready: bool,
    scope_id: Option<String>,
    level_uid: Option<String>,
}

impl PlayerLeaderboard {
    pub fn new(local_steam_id: u64) -> Self {
        Self {
            roster: HashMap::new(),
            results: HashMap::new(),
            times: HashMap::new(),
            overrides: HashMap::new(),
            clearing: HashSet::new(),
            local_steam_id,
            ready: false,
            scope_id: None,
            level_uid: None,
        }
    }

    pub fn set_scope(&mut self, scope_id: impl Into<String>, level_uid: impl Into<String>) {
        let scope_id = scope_id.into();
        if self.scope_id.as_deref() != Some(&scope_id) {
            self.clear_standings();
            self.scope_id = Some(scope_id);
        }
        self.level_uid = Some(level_uid.into());
    }

    pub fn clear_standings(&mut self) {
        self.clearing.extend(self.overrides.keys().copied());
        self.results.clear();
        self.times.clear();
    }

    pub fn set_ready(&mut self, ready: bool) {
        self.ready = ready;
    }

    pub fn set_desired(&mut self, results: Vec<DesiredPlayerStanding>) {
        self.results = results
            .into_iter()
            .map(|result| (result.steam_id, result))
            .collect();
    }

    pub fn roster_steam_ids(&self) -> Vec<u64> {
        let mut ids: Vec<_> = self.roster.values().map(|player| player.steam_id).collect();
        ids.sort_unstable();
        ids
    }

    pub fn roster_players(&self) -> Vec<GameHostPlayer> {
        let mut players: Vec<_> = self.roster.values().cloned().collect();
        players.sort_by_key(|player| player.uid);
        players
    }

    pub fn observe(&mut self, packet: &GameHostPacket) {
        match packet {
            GameHostPacket::Initial { players, .. } => self.set_roster(players),
            GameHostPacket::PlayerConnected { player, .. }
                if player.steam_id > 0 && player.steam_id != self.local_steam_id =>
            {
                if self.roster.contains_key(&player.uid) || self.roster.len() < 64 {
                    let player = connected_player(player, self.roster.get(&player.uid));
                    self.roster.insert(player.uid, player);
                    self.trim_state();
                }
            }
            GameHostPacket::PlayerDisconnected(uid) => {
                self.roster.remove(uid);
                self.trim_state();
            }
            GameHostPacket::PlayerCosmetics { uid, chat_color } => {
                if let Some(player) = self.roster.get_mut(uid) {
                    player.chat_color = *chat_color;
                }
            }
            GameHostPacket::Leaderboard {
                packet_type,
                times,
                overrides,
            } => {
                if matches!(packet_type, 0 | 1) {
                    self.times = times
                        .iter()
                        .map(|item| (item.steam_id, item.time))
                        .collect();
                }
                if matches!(packet_type, 0 | 2) {
                    self.overrides = overrides
                        .iter()
                        .map(|item| {
                            (
                                item.steam_id,
                                LeaderboardOverrides {
                                    time: item.time.clone(),
                                    position: item.position.clone(),
                                    name: item.name.clone(),
                                    points: item.points.clone(),
                                    points_won: item.points_won.clone(),
                                },
                            )
                        })
                        .collect();
                }
            }
            GameHostPacket::PlayerResult {
                uid,
                has_result,
                level_uid,
                time,
                ..
            } if !has_result || self.level_uid.as_deref() == Some(level_uid) => {
                if let Some(player) = self.roster.get(uid) {
                    if *has_result {
                        self.times.insert(player.steam_id, *time);
                    } else {
                        self.times.remove(&player.steam_id);
                    }
                }
            }
            _ => {}
        }
    }

    pub fn reconcile(&mut self) -> Result<Vec<Vec<u8>>> {
        self.reconcile_with_standings(self.ready)
    }

    pub fn reconcile_names(&mut self) -> Result<Vec<Vec<u8>>> {
        self.reconcile_with_standings(false)
    }

    fn reconcile_with_standings(&mut self, standings_ready: bool) -> Result<Vec<Vec<u8>>> {
        let mut players: Vec<_> = self.roster.values().cloned().collect();
        players.sort_by_key(|player| player.uid);
        let mut packets = Vec::new();
        for player in players {
            let id = player.steam_id;
            let clearing = self.clearing.remove(&id);
            let result = standings_ready.then(|| self.results.get(&id)).flatten();
            let mut overrides = if let Some(result) = result {
                result.overrides.clone()
            } else if clearing {
                LeaderboardOverrides::default()
            } else {
                self.overrides.get(&id).cloned().unwrap_or_default()
            };
            overrides.name = player_leaderboard_name(&player);
            if let Some(time) = result.and_then(|result| result.time) {
                let time = time.min(36_000.0);
                if self.times.get(&id).copied() != Some(time) {
                    self.times.insert(id, time);
                    packets.push(player_leaderboard_time_packet(id, time, false)?);
                }
            }
            if self.overrides.get(&id) != Some(&overrides) {
                packets.push(player_leaderboard_overrides_packet(id, &overrides)?);
                self.overrides.insert(id, overrides);
            }
        }
        Ok(packets)
    }

    fn set_roster(&mut self, players: &[GameHostPlayer]) {
        self.roster = players
            .iter()
            .filter(|player| player.steam_id > 0 && player.steam_id != self.local_steam_id)
            .take(64)
            .cloned()
            .map(|player| (player.uid, player))
            .collect();
        self.trim_state();
    }

    fn trim_state(&mut self) {
        let ids: HashSet<_> = self.roster.values().map(|player| player.steam_id).collect();
        self.times.retain(|id, _| ids.contains(id));
        self.overrides.retain(|id, _| ids.contains(id));
        self.clearing.retain(|id| ids.contains(id));
        self.results.retain(|id, _| ids.contains(id));
    }
}

fn player_leaderboard_name(player: &GameHostPlayer) -> String {
    let name = player
        .username
        .as_deref()
        .filter(|name| !name.trim().is_empty())
        .unwrap_or(&player.backup_name);
    let [r, g, b] = player.chat_color.unwrap_or([255; 3]);
    format!(
        "<color=#{r:02X}{g:02X}{b:02X}>{}</color>",
        leaderboard_name(&format!("{}{name}", player.player_tag))
    )
}

#[cfg(test)]
pub(crate) fn read_test_overrides(packet: &[u8]) -> Result<(u64, LeaderboardOverrides)> {
    let mut reader = zc_core::zeepnet::BitReader::new(packet);
    assert_eq!(reader.read_u16()?, zc_core::zeepnet::CUSTOM_LEADERBOARD);
    let steam_id = reader.read_u64()?;
    assert!(!reader.read_bool()?);
    reader.read_f32()?;
    reader.read_i32()?;
    assert!(!reader.read_bool()?);
    assert!(reader.read_bool()?);
    Ok((
        steam_id,
        LeaderboardOverrides {
            time: reader.read_string(4096)?,
            position: reader.read_string(4096)?,
            name: reader.read_string(4096)?,
            points: reader.read_string(4096)?,
            points_won: reader.read_string(4096)?,
        },
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn player(uid: u32, steam_id: u64) -> GameHostPlayer {
        GameHostPlayer {
            chat_color: None,
            backup_name: "p".into(),
            player_tag: String::new(),
            steam_id,
            uid,
            username: None,
        }
    }

    fn board_with_player(player: GameHostPlayer) -> PlayerLeaderboard {
        let mut board = PlayerLeaderboard::new(99);
        board.observe(&GameHostPacket::PlayerConnected {
            player,
            is_host: false,
            has_host_powers: false,
        });
        board
    }

    #[test]
    fn colors_names_without_standings_and_updates_only_changed_colors() -> Result<()> {
        let mut player = player(1, 10);
        player.player_tag = "[T]".into();
        player.backup_name = "<b>Fallback</b>".into();
        let mut board = board_with_player(player);
        let packets = board.reconcile()?;
        assert_eq!(packets.len(), 1);
        let (id, overrides) = read_test_overrides(&packets[0])?;
        assert_eq!(id, 10);
        assert_eq!(
            overrides.name,
            "<color=#FFFFFF><nobr>[T]&lt;b&gt;Fallback&lt;/b&gt;</nobr></color>"
        );
        assert_eq!(overrides.position, "");
        assert!(board.reconcile()?.is_empty());
        for (color, expected) in [
            (Some([18, 52, 86]), "#123456"),
            (Some([0, 0, 0]), "#000000"),
            (None, "#FFFFFF"),
        ] {
            let packet = GameHostPacket::PlayerCosmetics {
                uid: 1,
                chat_color: color,
            };
            board.observe(&packet);
            let packets = board.reconcile()?;
            assert_eq!(packets.len(), 1);
            assert!(read_test_overrides(&packets[0])?.1.name.contains(expected));
            board.observe(&packet);
            assert!(board.reconcile()?.is_empty());
        }
        Ok(())
    }

    #[test]
    fn bounds_and_escapes_live_name_and_tag() {
        let mut player = player(1, 10);
        player.player_tag = "<T>".into();
        player.username = Some(format!("Current&{}", "x".repeat(100)));
        player.chat_color = Some([1, 2, 3]);
        assert_eq!(
            player_leaderboard_name(&player),
            format!(
                "<color=#010203><nobr>&lt;T&gt;Current&amp;{}</nobr></color>",
                "x".repeat(69)
            )
        );
        player.username = Some(" \t ".into());
        assert_eq!(
            player_leaderboard_name(&player),
            "<color=#010203><nobr>&lt;T&gt;p</nobr></color>"
        );
    }

    #[test]
    fn readiness_gates_standings_but_preserves_fields_during_color_updates() -> Result<()> {
        let mut board = board_with_player(player(1, 10));
        board.set_scope("tournament", "level");
        board.set_desired(vec![DesiredPlayerStanding {
            steam_id: 10,
            time: Some(12.5),
            overrides: LeaderboardOverrides {
                position: "3".into(),
                time: "00:12.500".into(),
                points: "100".into(),
                points_won: "20".into(),
                name: "untrusted name".into(),
            },
        }]);
        let packets = board.reconcile()?;
        assert_eq!(packets.len(), 1);
        assert_eq!(read_test_overrides(&packets[0])?.1.position, "");
        board.set_ready(true);
        let packets = board.reconcile()?;
        assert_eq!(packets.len(), 2);
        let mut expected = read_test_overrides(&packets[1])?.1;
        assert_eq!(expected.position, "3");
        assert_eq!(expected.time, "00:12.500");
        assert_eq!(expected.points, "100");
        assert_eq!(expected.points_won, "20");
        assert_eq!(board.times[&10], 12.5);
        board.set_ready(false);
        board.observe(&GameHostPacket::PlayerCosmetics {
            uid: 1,
            chat_color: Some([255, 0, 0]),
        });
        let packets = board.reconcile()?;
        assert_eq!(packets.len(), 1);
        expected.name = "<color=#FF0000><nobr>p</nobr></color>".into();
        assert_eq!(read_test_overrides(&packets[0])?.1, expected);
        assert_eq!(board.times[&10], 12.5);
        board.set_ready(true);
        board.observe(&GameHostPacket::PlayerResult {
            uid: 1,
            has_result: true,
            level_uid: "level".into(),
            time: 10.0,
            checkpoints: 1,
        });
        assert!(board.reconcile_names()?.is_empty());
        assert_eq!(board.times[&10], 10.0);
        Ok(())
    }

    #[test]
    fn restores_names_after_server_reset_and_clears_scope_without_blank_name() -> Result<()> {
        let mut board = board_with_player(player(1, 10));
        board.set_scope("one", "level");
        board.set_ready(true);
        board.set_desired(vec![DesiredPlayerStanding {
            steam_id: 10,
            time: None,
            overrides: LeaderboardOverrides {
                position: "1".into(),
                ..Default::default()
            },
        }]);
        board.reconcile()?;
        board.observe(&GameHostPacket::Leaderboard {
            packet_type: 2,
            times: vec![],
            overrides: vec![],
        });
        let packets = board.reconcile()?;
        assert_eq!(packets.len(), 1);
        assert_eq!(read_test_overrides(&packets[0])?.1.position, "1");
        board.set_ready(false);
        board.set_scope("two", "next");
        let packets = board.reconcile()?;
        assert_eq!(packets.len(), 1);
        assert_eq!(
            read_test_overrides(&packets[0])?.1,
            LeaderboardOverrides {
                name: "<color=#FFFFFF><nobr>p</nobr></color>".into(),
                ..Default::default()
            }
        );
        assert!(board.reconcile()?.is_empty());
        Ok(())
    }

    #[test]
    fn disconnect_and_uid_reuse_do_not_reuse_color_or_overrides() -> Result<()> {
        let mut board = board_with_player(player(1, 10));
        board.observe(&GameHostPacket::PlayerCosmetics {
            uid: 100,
            chat_color: Some([1, 2, 3]),
        });
        assert_eq!(board.roster_players().len(), 1);
        board.observe(&GameHostPacket::PlayerCosmetics {
            uid: 1,
            chat_color: Some([1, 2, 3]),
        });
        board.reconcile()?;
        board.observe(&GameHostPacket::PlayerConnected {
            player: player(1, 10),
            is_host: true,
            has_host_powers: true,
        });
        assert!(board.reconcile()?.is_empty());
        assert_eq!(board.roster_players()[0].chat_color, Some([1, 2, 3]));
        board.observe(&GameHostPacket::PlayerDisconnected(1));
        assert!(board.reconcile()?.is_empty());
        assert!(board.overrides.is_empty());
        board.observe(&GameHostPacket::PlayerConnected {
            player: player(1, 20),
            is_host: false,
            has_host_powers: false,
        });
        let packets = board.reconcile()?;
        assert_eq!(
            read_test_overrides(&packets[0])?,
            (
                20,
                LeaderboardOverrides {
                    name: "<color=#FFFFFF><nobr>p</nobr></color>".into(),
                    ..Default::default()
                }
            )
        );
        Ok(())
    }

    #[test]
    fn reconciles_once_and_clears_old_scope() -> Result<()> {
        let mut board = PlayerLeaderboard::new(99);
        board.observe(&GameHostPacket::Initial {
            timing: zc_core::zeepnet::LobbyTiming {
                game_state: 0,
                round_time: 900.0,
                level_loaded_at: 0.0,
                uid: String::new(),
                workshop_id: 0,
            },
            is_host: true,
            players: vec![player(1, 10), player(2, 99)],
        });
        board.set_ready(true);
        board.set_scope("one", "level");
        board.set_desired(vec![DesiredPlayerStanding {
            steam_id: 10,
            time: Some(12.5),
            overrides: LeaderboardOverrides {
                position: "1".into(),
                ..Default::default()
            },
        }]);
        assert_eq!(board.reconcile()?.len(), 2);
        assert!(board.reconcile()?.is_empty());
        board.set_scope("two", "next");
        assert_eq!(board.reconcile()?.len(), 1);
        assert_eq!(board.roster_steam_ids(), [10]);
        Ok(())
    }
}
