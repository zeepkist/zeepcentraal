mod csv;
mod json;
mod types;

use anyhow::Result;

pub use csv::{calculate_csv_level_xxhash, parse_csv_level};
pub use json::{calculate_json_level_xxhash, parse_json_level};
pub use types::{CsvBlock, LevelBlocks, LevelFormat, ParsedLevel, Vector3};

pub const PRESENT_BLOCK_ID: i64 = 2264;

const CHECKPOINT_IDS: &[i64] = &[22, 372, 373, 1275, 1276, 1277, 1278, 1279, 1615];
const ALTERNATE_CHECKPOINT_IDS: &[i64] = &[
    1609, 1610, 1613, 1614, 1979, 1981, 1983, 1985, 1607, 1608, 1611, 1612, 1978, 1980, 1982, 1984,
    1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993,
];
const FINISH_IDS: &[i64] = &[2, 1273, 1274, 1412, 1616];

#[must_use]
pub fn count_checkpoints(blocks: impl IntoIterator<Item = (i64, bool)>) -> usize {
    blocks
        .into_iter()
        .filter(|(id, flagged)| {
            CHECKPOINT_IDS.contains(id) || (*flagged && ALTERNATE_CHECKPOINT_IDS.contains(id))
        })
        .count()
}

#[must_use]
pub fn count_finishes(ids: impl IntoIterator<Item = i64>) -> usize {
    ids.into_iter().filter(|id| FINISH_IDS.contains(id)).count()
}

pub fn parse_level(content: &str, adventure: bool, workshop_author_id: u64) -> Result<ParsedLevel> {
    let normalized = content.strip_prefix('\u{feff}').unwrap_or(content);
    if normalized.trim_start().starts_with('{') {
        parse_json_level(normalized, adventure)
    } else {
        parse_csv_level(normalized, adventure, workshop_author_id)
    }
}
