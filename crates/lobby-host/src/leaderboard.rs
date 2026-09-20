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
            self.clearing.extend(self.overrides.keys().copied());
            self.results.clear();
            self.times.clear();
            self.overrides.clear();
            self.scope_id = Some(scope_id);
        }
        self.level_uid = Some(level_uid.into());
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

    pub fn observe(&mut self, packet: &GameHostPacket) {
        match packet {
            GameHostPacket::Initial { players, .. } => self.set_roster(players),
            GameHostPacket::PlayerConnected { player, .. }
                if player.steam_id > 0 && player.steam_id != self.local_steam_id =>
            {
                if self.roster.contains_key(&player.uid) || self.roster.len() < 64 {
                    self.roster.insert(player.uid, player.clone());
                    self.trim_state();
                }
            }
            GameHostPacket::PlayerDisconnected(uid) => {
                self.roster.remove(uid);
                self.trim_state();
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
        if !self.ready {
            return Ok(Vec::new());
        }
        let mut players: Vec<_> = self.roster.values().cloned().collect();
        players.sort_by_key(|player| player.uid);
        let mut packets = Vec::new();
        for player in players {
            let id = player.steam_id;
            if self.clearing.remove(&id) {
                packets.push(player_leaderboard_overrides_packet(
                    id,
                    &LeaderboardOverrides::default(),
                )?);
            }
            let Some(result) = self.results.get(&id) else {
                continue;
            };
            if let Some(time) = result.time {
                let time = time.min(36_000.0);
                if self.times.get(&id).copied() != Some(time) {
                    self.times.insert(id, time);
                    packets.push(player_leaderboard_time_packet(
                        id,
                        result.time.unwrap_or_default(),
                        false,
                    )?);
                }
            }
            if self.overrides.get(&id) != Some(&result.overrides) {
                self.overrides.insert(id, result.overrides.clone());
                packets.push(player_leaderboard_overrides_packet(id, &result.overrides)?);
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

#[cfg(test)]
mod tests {
    use super::*;

    fn player(uid: u32, steam_id: u64) -> GameHostPlayer {
        GameHostPlayer {
            backup_name: "p".into(),
            player_tag: String::new(),
            steam_id,
            uid,
            username: None,
        }
    }

    #[test]
    fn reconciles_once_and_clears_old_scope() -> Result<()> {
        let mut board = PlayerLeaderboard::new(99);
        board.observe(&GameHostPacket::Initial {
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
