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
                let player = connected_player(player, self.players.get(&player.uid));
                self.players.insert(player.uid, player);
            }
            GameHostPacket::PlayerDisconnected(uid) => {
                self.players.remove(uid);
            }
            GameHostPacket::PlayerCosmetics { uid, chat_color } => {
                if let Some(player) = self.players.get_mut(uid) {
                    player.chat_color = *chat_color;
                }
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

pub(crate) fn connected_player(
    player: &GameHostPlayer,
    previous: Option<&GameHostPlayer>,
) -> GameHostPlayer {
    let mut player = player.clone();
    // Connected packets carry no colour, including repeated identity/permission updates.
    if player.chat_color.is_none()
        && let Some(previous) = previous.filter(|previous| previous.steam_id == player.steam_id)
    {
        player.chat_color = previous.chat_color;
    }
    player
}

#[cfg(test)]
mod tests {
    use super::*;

    fn player(uid: u32, steam_id: u64) -> GameHostPlayer {
        GameHostPlayer {
            chat_color: None,
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
            timing: zc_core::zeepnet::LobbyTiming {
                game_state: 0,
                round_time: 900.0,
                level_loaded_at: 0.0,
                uid: String::new(),
                workshop_id: 0,
            },
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

    #[test]
    fn retains_color_for_recovery_and_discards_disconnected_players() {
        let mut roster = RoomRoster::default();
        roster.observe(&GameHostPacket::PlayerConnected {
            player: player(1, 10),
            is_host: false,
            has_host_powers: false,
        });
        roster.observe(&GameHostPacket::PlayerCosmetics {
            uid: 2,
            chat_color: Some([9, 8, 7]),
        });
        assert_eq!(roster.all().len(), 1);
        roster.observe(&GameHostPacket::PlayerCosmetics {
            uid: 1,
            chat_color: Some([18, 52, 86]),
        });
        assert_eq!(roster.all()[0].chat_color, Some([18, 52, 86]));
        roster.observe(&GameHostPacket::PlayerConnected {
            player: player(1, 10),
            is_host: true,
            has_host_powers: true,
        });
        assert_eq!(roster.all()[0].chat_color, Some([18, 52, 86]));
        assert_eq!(roster.names()[&1], "[ZC]p1");
        let replay = GameHostPacket::Initial {
            is_host: true,
            players: roster.all(),
            timing: zc_core::zeepnet::LobbyTiming {
                game_state: 0,
                round_time: 900.0,
                level_loaded_at: 0.0,
                uid: String::new(),
                workshop_id: 0,
            },
        };
        let mut recovered = RoomRoster::default();
        recovered.observe(&replay);
        assert_eq!(recovered.all()[0].chat_color, Some([18, 52, 86]));
        roster.observe(&GameHostPacket::PlayerDisconnected(1));
        roster.observe(&GameHostPacket::PlayerCosmetics {
            uid: 1,
            chat_color: Some([0, 0, 0]),
        });
        assert!(roster.all().is_empty());
        roster.observe(&GameHostPacket::PlayerConnected {
            player: player(1, 20),
            is_host: false,
            has_host_powers: false,
        });
        assert_eq!(roster.all()[0].chat_color, None);
        roster.observe(&GameHostPacket::PlayerCosmetics {
            uid: 1,
            chat_color: None,
        });
        assert_eq!(roster.all()[0].chat_color, None);
        roster.clear();
        assert!(roster.all().is_empty());
    }
}
