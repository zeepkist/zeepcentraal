use super::{BitReader, BitWriter};
use anyhow::{Result, bail, ensure};

pub const CUSTOM_LEADERBOARD: u16 = 65_488;
pub const LEADERBOARD: u16 = 26_487;
pub const PLAYER_UPDATE_RESULT: u16 = 3_549;
pub const CHAT_MESSAGE: u16 = 48_137;
pub const CUSTOM_CHAT_MESSAGE: u16 = 37_243;
pub const CREATE_LOBBY: u16 = 18_036;
pub const CREATE_LOBBY_RESPONSE: u16 = 42_517;
pub const JOIN_LOBBY: u16 = 24_070;
pub const JOIN_LOBBY_RESPONSE: u16 = 2_983;
pub const INITIAL_STATE: u16 = 29_635;
pub const CHANGE_LOBBY_GAME_PROPERTIES: u16 = 44_133;
pub const CHANGE_LOBBY_GAME_STATE: u16 = 56_687;
pub const CHANGE_LOBBY_MASTER: u16 = 13_890;
pub const CHANGE_LOBBY_PLAYLIST: u16 = 60_338;
pub const CHANGE_LOBBY_PLAYLIST_INDEX: u16 = 18_192;
pub const CHANGE_LOBBY_VISIBILITY: u16 = 3_826;
pub const LEVEL_DATA: u16 = 22_792;
pub const LEVEL_LOADED: u16 = 29_603;
pub const PLAYER_CONNECTED: u16 = 8_162;
pub const PLAYER_DISCONNECTED: u16 = 48_658;
pub const SKIP_TO_LEVEL: u16 = 63_876;

const MAX_LEVEL_DATA_BYTES: usize = 64 * 1024 * 1024;
const MAX_PLAYLIST_LEVELS: usize = 1_001;
const MAX_CHAT_BYTES: usize = 4_096;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OnlineLevel {
    pub author: String,
    pub collaborators: String,
    pub name: String,
    pub override_author_name: String,
    pub uid: String,
    pub workshop_id: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OnlinePlaylistLevel {
    pub level: OnlineLevel,
    pub played: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub struct OnlinePlaylist {
    pub current_index: i32,
    pub is_random: bool,
    pub levels: Vec<OnlinePlaylistLevel>,
    pub next_index: i32,
    pub original_playlist_length: i32,
    pub round_time: f64,
    pub was_synced: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub enum GameHostPacket {
    GameState(i32),
    PlayerDisconnected(u32),
    Playlist(OnlinePlaylist),
    PlaylistIndex {
        current_index: i32,
        next_index: i32,
        select_next: bool,
    },
    LevelData {
        data: Vec<u8>,
        name: String,
        uid: String,
        workshop_id: u64,
    },
    LevelRequest {
        name: String,
        uid: String,
        workshop_id: u64,
    },
    Unknown(u16),
}

pub fn packet_id(full_name: &str) -> u16 {
    let mut hash = 23_i32;
    for character in full_name.encode_utf16() {
        hash = hash.wrapping_mul(31).wrapping_add(i32::from(character));
    }
    hash as u16
}

pub fn create_lobby_packet(
    maximum_players: i32,
    name: &str,
    is_public: bool,
    original_host_name: &str,
) -> Result<Vec<u8>> {
    write_packet(CREATE_LOBBY, |writer| {
        writer.write_i32(maximum_players);
        writer.write_string(name)?;
        writer.write_bool(is_public);
        writer.write_string(original_host_name)
    })
}

pub fn join_lobby_packet(join_id: &str) -> Result<Vec<u8>> {
    write_packet(JOIN_LOBBY, |writer| writer.write_string(join_id))
}

pub fn change_lobby_visibility_packet(is_public: bool) -> Result<Vec<u8>> {
    write_packet(CHANGE_LOBBY_VISIBILITY, |writer| {
        writer.write_bool(is_public);
        Ok(())
    })
}

pub fn chat_message_packet(message: &str) -> Result<Vec<u8>> {
    validate_chat(message, "Chat message")?;
    write_packet(CHAT_MESSAGE, |writer| {
        writer.write_u32(0);
        writer.write_string(message)?;
        writer.write_i32(0);
        Ok(())
    })
}

pub fn targeted_chat_message_packet(
    target_steam_id: u64,
    message: &str,
    hostname: &str,
) -> Result<Vec<u8>> {
    ensure!(target_steam_id > 0, "Target Steam ID must be positive");
    validate_chat(message, "Chat message")?;
    validate_chat(hostname, "Chat hostname")?;
    write_packet(CUSTOM_CHAT_MESSAGE, |writer| {
        writer.write_u64(target_steam_id);
        writer.write_string(message)?;
        writer.write_string(hostname)
    })
}

pub fn change_lobby_playlist_packet(level: &OnlineLevel, round_time: f64) -> Result<Vec<u8>> {
    change_lobby_levels_packet(std::slice::from_ref(level), round_time, 0, 0)
}

pub fn change_lobby_levels_packet(
    levels: &[OnlineLevel],
    round_time: f64,
    current_index: i32,
    next_index: i32,
) -> Result<Vec<u8>> {
    let count = i32::try_from(levels.len())?;
    ensure!(
        !levels.is_empty()
            && levels.len() <= MAX_PLAYLIST_LEVELS
            && (0..count).contains(&current_index)
            && (0..count).contains(&next_index)
            && round_time.is_finite()
            && round_time > 0.0,
        "Invalid managed playlist"
    );
    write_packet(CHANGE_LOBBY_PLAYLIST, |writer| {
        writer.write_f64(round_time);
        writer.write_bool(false);
        writer.write_i32(current_index);
        writer.write_i32(next_index);
        writer.write_i32(count);
        for level in levels {
            write_level(writer, level)?;
            writer.write_bool(false);
        }
        writer.write_bool(true);
        writer.write_i32(count);
        Ok(())
    })
}

pub fn skip_to_level_packet(level: &OnlineLevel) -> Result<Vec<u8>> {
    write_packet(SKIP_TO_LEVEL, |writer| {
        writer.write_string(&level.uid)?;
        writer.write_u64(level.workshop_id);
        Ok(())
    })
}

pub fn level_data_packet(
    name: &str,
    uid: &str,
    workshop_id: u64,
    compressed_data: &[u8],
) -> Result<Vec<u8>> {
    ensure!(
        compressed_data.len() <= MAX_LEVEL_DATA_BYTES,
        "Invalid level payload"
    );
    write_packet(LEVEL_DATA, |writer| {
        writer.write_i32(2);
        writer.write_string(name)?;
        writer.write_string(uid)?;
        writer.write_u64(workshop_id);
        writer.write_i32(i32::try_from(compressed_data.len())?);
        writer.write_bytes(compressed_data);
        Ok(())
    })
}

pub fn level_data_request_packet() -> Result<Vec<u8>> {
    level_data_packet_with_type(0, "", "", 0, &[])
}

pub fn level_loaded_packet() -> Result<Vec<u8>> {
    write_packet(LEVEL_LOADED, |_| Ok(()))
}

pub fn parse_game_host_packet(payload: &[u8]) -> Result<GameHostPacket> {
    let mut reader = BitReader::new(payload);
    let id = reader.read_u16()?;
    match id {
        CHANGE_LOBBY_PLAYLIST => Ok(GameHostPacket::Playlist(read_playlist(&mut reader)?)),
        CHANGE_LOBBY_PLAYLIST_INDEX => Ok(GameHostPacket::PlaylistIndex {
            current_index: reader.read_i32()?,
            next_index: reader.read_i32()?,
            select_next: reader.read_bool()?,
        }),
        CHANGE_LOBBY_GAME_STATE => Ok(GameHostPacket::GameState(reader.read_i32()?)),
        PLAYER_DISCONNECTED => Ok(GameHostPacket::PlayerDisconnected(reader.read_u32()?)),
        LEVEL_DATA => read_level_data(&mut reader),
        _ => Ok(GameHostPacket::Unknown(id)),
    }
}

fn level_data_packet_with_type(
    packet_type: i32,
    name: &str,
    uid: &str,
    workshop_id: u64,
    data: &[u8],
) -> Result<Vec<u8>> {
    write_packet(LEVEL_DATA, |writer| {
        writer.write_i32(packet_type);
        writer.write_string(name)?;
        writer.write_string(uid)?;
        writer.write_u64(workshop_id);
        writer.write_i32(i32::try_from(data.len())?);
        writer.write_bytes(data);
        Ok(())
    })
}

fn read_level_data(reader: &mut BitReader<'_>) -> Result<GameHostPacket> {
    let packet_type = reader.read_i32()?;
    let name = reader.read_string(4_096)?;
    let uid = reader.read_string(4_096)?;
    let workshop_id = reader.read_u64()?;
    let byte_length = reader.read_i32()?;
    ensure!(
        byte_length >= 0
            && usize::try_from(byte_length)? <= MAX_LEVEL_DATA_BYTES
            && usize::try_from(byte_length)? * 8 <= reader.remaining_bits(),
        "Invalid level payload"
    );
    let data = reader.read_bytes(usize::try_from(byte_length)?)?;
    match packet_type {
        1 => Ok(GameHostPacket::LevelData {
            data,
            name,
            uid,
            workshop_id,
        }),
        3 => Ok(GameHostPacket::LevelRequest {
            name,
            uid,
            workshop_id,
        }),
        _ => bail!("Unsupported level data packet type {packet_type}"),
    }
}

fn read_playlist(reader: &mut BitReader<'_>) -> Result<OnlinePlaylist> {
    let round_time = reader.read_f64()?;
    let is_random = reader.read_bool()?;
    let current_index = reader.read_i32()?;
    let next_index = reader.read_i32()?;
    let count = reader.read_i32()?;
    ensure!(
        count >= 0 && usize::try_from(count)? <= MAX_PLAYLIST_LEVELS,
        "Invalid playlist length"
    );
    let mut levels = Vec::with_capacity(usize::try_from(count)?);
    for _ in 0..count {
        levels.push(OnlinePlaylistLevel {
            level: read_level(reader)?,
            played: reader.read_bool()?,
        });
    }
    let was_synced = reader.read_bool()?;
    let original_playlist_length = reader.read_i32()?;
    Ok(OnlinePlaylist {
        current_index,
        is_random,
        levels,
        next_index,
        original_playlist_length,
        round_time,
        was_synced,
    })
}

fn write_level(writer: &mut BitWriter, level: &OnlineLevel) -> Result<()> {
    writer.write_string(&level.uid)?;
    writer.write_u64(level.workshop_id);
    writer.write_string(&level.name)?;
    writer.write_string(&level.collaborators)?;
    writer.write_string(&level.override_author_name)?;
    writer.write_string(&level.author)
}

fn read_level(reader: &mut BitReader<'_>) -> Result<OnlineLevel> {
    Ok(OnlineLevel {
        uid: reader.read_string(4_096)?,
        workshop_id: reader.read_u64()?,
        name: reader.read_string(4_096)?,
        collaborators: reader.read_string(4_096)?,
        override_author_name: reader.read_string(4_096)?,
        author: reader.read_string(4_096)?,
    })
}

fn validate_chat(value: &str, label: &str) -> Result<()> {
    ensure!(
        !value.is_empty() && value.len() <= MAX_CHAT_BYTES,
        "{label} must contain between 1 and {MAX_CHAT_BYTES} bytes"
    );
    Ok(())
}

fn write_packet(id: u16, write: impl FnOnce(&mut BitWriter) -> Result<()>) -> Result<Vec<u8>> {
    let mut writer = BitWriter::new();
    writer.write_u16(id);
    write(&mut writer)?;
    Ok(writer.into_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn level(
        uid: &str,
        workshop_id: u64,
        name: &str,
        collaborators: &str,
        override_author_name: &str,
        author: &str,
    ) -> OnlineLevel {
        OnlineLevel {
            author: author.to_owned(),
            collaborators: collaborators.to_owned(),
            name: name.to_owned(),
            override_author_name: override_author_name.to_owned(),
            uid: uid.to_owned(),
            workshop_id,
        }
    }

    #[test]
    fn packet_hashes_match_v18_ids() {
        assert_eq!(
            packet_id("ZeepkistNetworking.ChangeLobbyPlaylistPacket"),
            CHANGE_LOBBY_PLAYLIST
        );
        assert_eq!(packet_id("ZeepkistNetworking.LevelDataPacket"), LEVEL_DATA);
        assert_eq!(
            packet_id("ZeepkistNetworking.SkipToLevelPacket"),
            SKIP_TO_LEVEL
        );
    }

    #[test]
    fn multi_playlist_matches_independent_v18_golden() -> Result<()> {
        let levels = vec![
            level("alpha", 123, "Café", "Zoë", "", "Åsa"),
            level("beta", 9_007_199_254_740_993, "雪道", "", "名", "René"),
        ];
        let expected = decode_hex(
            "b2eb0000000000c072400000000002000000040000000ac2d8e0d0c2f6000000000000000a86c2cc865309b4de86570108860be7c2108895d185050000000000800018a46faaa6074e020c944336164895b90da72a00000000",
        );
        let encoded = change_lobby_levels_packet(&levels, 300.0, 0, 1)?;
        assert_eq!(encoded, expected);
        let GameHostPacket::Playlist(decoded) = parse_game_host_packet(&encoded)? else {
            panic!("expected playlist");
        };
        assert_eq!(decoded.levels.len(), 2);
        assert_eq!(decoded.levels[1].level, levels[1]);
        assert!(decoded.was_synced);
        assert_eq!(decoded.original_playlist_length, 2);
        Ok(())
    }

    #[test]
    fn captured_single_level_packets_remain_byte_identical() -> Result<()> {
        let captured = level(
            "Six Cubed-maxie12-01KDKQ3K2KA14WK8RP9AD61TVQ",
            3_633_729_201,
            "ZSL - Cube Maintenance",
            "",
            "",
            "maxie12",
        );
        assert_eq!(
            change_lobby_playlist_packet(&captured, 720.0)?,
            decode_base64(
                "susAAAAAAICGQAAAAAAAAAAAAgAAAFim0vBAhurEysha2sLw0spiZFpgYpaIlqJmlmSWgmJorpZwpKBygohsYqisomKdLLEBAAAALLSmmEBaQIbqxMpAmsLS3OjK3MLcxsoAAA7awvDSymJkDAAAAAA="
            )
        );
        assert_eq!(
            skip_to_level_packet(&captured)?,
            decode_base64(
                "hPksU2l4IEN1YmVkLW1heGllMTItMDFLREtRM0syS0ExNFdLOFJQOUFENjFUVlGxTpbYAAAAAA=="
            )
        );
        assert_eq!(level_loaded_packet()?, decode_base64("o3M="));
        Ok(())
    }

    #[test]
    fn level_response_matches_v18_fixture() -> Result<()> {
        assert_eq!(
            level_data_packet("Requested Name", "request-uid", 999, &[1, 2, 3])?,
            decode_base64("CFkCAAAADlJlcXVlc3RlZCBOYW1lC3JlcXVlc3QtdWlk5wMAAAAAAAADAAAAAQID")
        );
        assert_eq!(level_data_request_packet()?.len(), 20);
        Ok(())
    }

    fn decode_hex(value: &str) -> Vec<u8> {
        let (pairs, remainder) = value.as_bytes().as_chunks::<2>();
        assert!(remainder.is_empty());
        pairs
            .iter()
            .map(|pair| {
                u8::from_str_radix(std::str::from_utf8(pair).expect("hex pair"), 16)
                    .expect("hex byte")
            })
            .collect()
    }

    fn decode_base64(value: &str) -> Vec<u8> {
        const TABLE: &[u8; 64] =
            b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let mut output = Vec::new();
        let mut accumulator = 0_u32;
        let mut bits = 0_u8;
        for byte in value.bytes().take_while(|byte| *byte != b'=') {
            let index = TABLE
                .iter()
                .position(|candidate| *candidate == byte)
                .expect("base64 character") as u32;
            accumulator = (accumulator << 6) | index;
            bits += 6;
            if bits >= 8 {
                bits -= 8;
                output.push((accumulator >> bits) as u8);
                accumulator &= (1_u32 << bits).saturating_sub(1);
            }
        }
        output
    }
}
