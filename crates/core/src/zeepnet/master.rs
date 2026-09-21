use super::{
    BitReader, BitWriter,
    packets::{CREATE_LOBBY_RESPONSE, JOIN_LOBBY_RESPONSE},
};
use anyhow::{Result, ensure};

pub const LOBBY_LIST: u16 = 5_326;
pub const LOBBY_UPDATE: u16 = 62_071;
pub const SERVER_STATISTICS: u16 = 37_660;
const MAX_LOBBIES: usize = 4_096;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WireLobby {
    pub id: String,
    pub title: String,
    pub host_name: String,
    pub host_steam_id: u64,
    pub players: u32,
    pub player_limit: u32,
    pub is_public: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LobbyOperation {
    Added,
    Removed,
    Updated,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum LobbyPacket {
    List(Vec<WireLobby>),
    Update {
        operation: LobbyOperation,
        lobby: WireLobby,
    },
    Statistics {
        online_players: u32,
        lobby_count: u32,
        players_in_lobbies: u32,
    },
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MasterRoomResponse {
    Create {
        result: u16,
        join_id: String,
    },
    Join {
        result: u16,
        host: String,
        port: i32,
    },
}

pub fn master_hail(build: i32, steam_id: u64, name: &str, ticket: &[u8]) -> Result<Vec<u8>> {
    ensure!(build > 0, "Master build must be positive");
    ensure!(steam_id > 0, "Steam ID must be positive");
    ensure!(
        ticket.len() <= i32::MAX as usize,
        "Steam ticket is too large"
    );
    let mut writer = BitWriter::new();
    writer.write_i32(build);
    writer.write_u64(steam_id);
    writer.write_string(name)?;
    writer.write_string("")?;
    writer.write_string(name)?;
    writer.write_i32(ticket.len() as i32);
    writer.write_bytes(ticket);
    writer.write_i32(ticket.len() as i32);
    Ok(writer.into_bytes())
}

pub fn parse_master_room_response(payload: &[u8]) -> Result<Option<MasterRoomResponse>> {
    let mut reader = BitReader::new(payload);
    Ok(match reader.read_u16()? {
        CREATE_LOBBY_RESPONSE => Some(MasterRoomResponse::Create {
            result: reader.read_u16()?,
            join_id: reader.read_string(1_024)?,
        }),
        JOIN_LOBBY_RESPONSE => Some(MasterRoomResponse::Join {
            result: reader.read_u16()?,
            host: reader.read_string(1_024)?,
            port: reader.read_i32()?,
        }),
        _ => None,
    })
}

pub fn parse_lobby_packet(payload: &[u8]) -> Result<Option<LobbyPacket>> {
    let mut reader = BitReader::new(payload);
    Ok(match reader.read_u16()? {
        LOBBY_LIST => {
            let count = non_negative(reader.read_i32()?, "lobby count")? as usize;
            ensure!(count <= MAX_LOBBIES, "Lobby count exceeds {MAX_LOBBIES}");
            let mut lobbies = Vec::with_capacity(count);
            for _ in 0..count {
                lobbies.push(read_lobby(&mut reader)?);
            }
            Some(LobbyPacket::List(lobbies))
        }
        LOBBY_UPDATE => {
            let operation = match reader.read_u8()? {
                0 => LobbyOperation::Added,
                1 => LobbyOperation::Removed,
                2 => LobbyOperation::Updated,
                _ => anyhow::bail!("Unknown lobby update operation"),
            };
            Some(LobbyPacket::Update {
                operation,
                lobby: read_lobby(&mut reader)?,
            })
        }
        SERVER_STATISTICS => Some(LobbyPacket::Statistics {
            online_players: non_negative(reader.read_i32()?, "online player count")?,
            lobby_count: non_negative(reader.read_i32()?, "lobby count")?,
            players_in_lobbies: non_negative(reader.read_i32()?, "players in lobbies")?,
        }),
        _ => None,
    })
}

fn non_negative(value: i32, label: &str) -> Result<u32> {
    ensure!(value >= 0, "Invalid {label}");
    Ok(value as u32)
}

fn read_lobby(reader: &mut BitReader<'_>) -> Result<WireLobby> {
    Ok(WireLobby {
        id: reader.read_string(1_024)?,
        title: reader.read_string(4_096)?,
        host_name: reader.read_string(1_024)?,
        host_steam_id: reader.read_u64()?,
        players: non_negative(reader.read_i32()?, "lobby player count")?,
        player_limit: non_negative(reader.read_i32()?, "lobby player limit")?,
        is_public: reader.read_bool()?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_lobby_list_and_room_responses() {
        let mut packet = BitWriter::new();
        packet.write_u16(LOBBY_LIST);
        packet.write_i32(1);
        packet.write_string("room-id").unwrap();
        packet.write_string("Room").unwrap();
        packet.write_string("Host").unwrap();
        packet.write_u64(76_561_198_000_000_000);
        packet.write_i32(2);
        packet.write_i32(12);
        packet.write_bool(true);
        let parsed = parse_lobby_packet(&packet.into_bytes()).unwrap().unwrap();
        let LobbyPacket::List(lobbies) = parsed else {
            panic!("expected list")
        };
        assert_eq!(lobbies[0].players, 2);

        let mut response = BitWriter::new();
        response.write_u16(CREATE_LOBBY_RESPONSE);
        response.write_u16(1);
        response.write_string("join-id").unwrap();
        assert_eq!(
            parse_master_room_response(&response.into_bytes()).unwrap(),
            Some(MasterRoomResponse::Create {
                result: 1,
                join_id: "join-id".into()
            })
        );
    }

    #[test]
    fn hail_repeats_ticket_length() {
        let hail = master_hail(18, 76_561_198_000_000_000, "Zeep", &[1, 2, 3]).unwrap();
        let mut reader = BitReader::new(&hail);
        assert_eq!(reader.read_i32().unwrap(), 18);
        assert_eq!(reader.read_u64().unwrap(), 76_561_198_000_000_000);
        assert_eq!(reader.read_string(100).unwrap(), "Zeep");
        assert_eq!(reader.read_string(100).unwrap(), "");
        assert_eq!(reader.read_string(100).unwrap(), "Zeep");
        assert_eq!(reader.read_i32().unwrap(), 3);
        assert_eq!(reader.read_bytes(3).unwrap(), [1, 2, 3]);
        assert_eq!(reader.read_i32().unwrap(), 3);
    }
}
