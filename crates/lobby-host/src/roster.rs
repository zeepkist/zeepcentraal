use std::collections::HashMap;
use zc_core::zeepnet::{GameHostPacket, GameHostPlayer};

#[derive(Default)]
pub struct RoomRoster {
    players: HashMap<u32, GameHostPlayer>,
}

impl RoomRoster {
    pub fn observe(&mut self, packet: &GameHostPacket) {
        match packet {
            GameHostPacket::Initial { players, .. } => {
                self.players = players.iter().cloned().map(|p| (p.uid, p)).collect();
            }
            GameHostPacket::PlayerConnected { player, .. } => {
                self.players.insert(player.uid, player.clone());
            }
            GameHostPacket::PlayerDisconnected(uid) => {
                self.players.remove(uid);
            }
            _ => {}
        }
    }

    pub fn all(&self) -> Vec<GameHostPlayer> {
        let mut players: Vec<_> = self.players.values().cloned().collect();
        players.sort_by_key(|player| player.uid);
        players
    }

    pub fn names(&self) -> HashMap<u32, String> {
        self.players
            .iter()
            .map(|(uid, player)| {
                let name = player
                    .username
                    .as_deref()
                    .map(str::trim)
                    .filter(|name| !name.is_empty())
                    .unwrap_or(&player.backup_name);
                (*uid, format!("{}{}", player.player_tag, name))
            })
            .collect()
    }

    pub fn clear(&mut self) {
        self.players.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn player(uid: u32, steam_id: u64) -> GameHostPlayer {
        GameHostPlayer {
            backup_name: format!("p{uid}"),
            player_tag: "[ZC]".into(),
            steam_id,
            uid,
            username: None,
        }
    }

    #[test]
    fn replaces_and_updates_roster() {
        let mut roster = RoomRoster::default();
        roster.observe(&GameHostPacket::Initial {
            is_host: true,
            players: vec![player(2, 20), player(1, 10)],
        });
        roster.observe(&GameHostPacket::PlayerConnected {
            player: player(3, 30),
            is_host: false,
            has_host_powers: false,
        });
        roster.observe(&GameHostPacket::PlayerDisconnected(2));
        assert_eq!(
            roster.all().iter().map(|p| p.uid).collect::<Vec<_>>(),
            [1, 3]
        );
        assert_eq!(roster.names()[&1], "[ZC]p1");
    }
}
