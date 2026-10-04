use super::LevelFormat;
use anyhow::{Context, Result, ensure};
use serde_json::Value;
use std::collections::BTreeMap;
use xxhash_rust::xxh3::xxh3_64;

/// Version 1: frequency-weighted block IDs, XXH3-64 over little-endian i64 IDs,
/// positive votes set bits, zero votes clear bits. Signed storage preserves all 64 bits.
pub fn calculate_level_simhash(blocks: &Value, format: LevelFormat) -> Result<Option<i64>> {
    let blocks = blocks.as_array().context("Level blocks must be an array")?;
    if blocks.is_empty() {
        return Ok(None);
    }
    let key = match format {
        LevelFormat::Csv => "Id",
        LevelFormat::Json => "i",
    };
    let mut frequencies = BTreeMap::<i64, i64>::new();
    for block in blocks {
        let value = block.get(key).context("Block ID is missing")?;
        let id = block_id(value).context("Block ID must be an integer")?;
        ensure!(id >= 0, "Block ID must not be negative");
        *frequencies.entry(id).or_default() += 1;
    }
    let mut votes = [0_i64; 64];
    for (id, frequency) in frequencies {
        let hash = xxh3_64(&id.to_le_bytes());
        for (bit, vote) in votes.iter_mut().enumerate() {
            *vote += if hash & (1_u64 << bit) != 0 {
                frequency
            } else {
                -frequency
            };
        }
    }
    let fingerprint = votes.iter().enumerate().fold(0_u64, |hash, (bit, vote)| {
        hash | (u64::from(*vote > 0) << bit)
    });
    Ok(Some(fingerprint as i64))
}

// JSONB preserves decimal and exponent spellings. Parse exactly, without f64 rounding.
fn block_id(value: &Value) -> Option<i64> {
    if let Some(id) = value.as_i64() {
        return Some(id);
    }
    let spelling = value.as_number()?.to_string();
    let (mantissa, exponent) = spelling.split_once(['e', 'E']).unwrap_or((&spelling, "0"));
    let exponent = exponent.parse::<i64>().ok()?;
    let negative = mantissa.starts_with('-');
    let (integer, fraction) = mantissa
        .trim_start_matches('-')
        .split_once('.')
        .unwrap_or((mantissa.trim_start_matches('-'), ""));
    let digits = format!("{integer}{fraction}");
    let digits = digits.trim_start_matches('0');
    if digits.is_empty() {
        return Some(0);
    }
    let significant = digits.trim_end_matches('0');
    let shift = exponent
        .checked_sub(i64::try_from(fraction.len()).ok()?)?
        .checked_add(i64::try_from(digits.len() - significant.len()).ok()?)?;
    if negative
        || shift < 0
        || significant
            .len()
            .checked_add(usize::try_from(shift).ok()?)?
            > 19
    {
        return None;
    }
    significant
        .parse::<i64>()
        .ok()?
        .checked_mul(10_i64.checked_pow(u32::try_from(shift).ok()?)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn formats_order_and_non_id_fields_do_not_affect_similarity() -> Result<()> {
        let csv = json!([{"Id":22,"Position":{"X":100},"Paints":[4]}, {"Id":2}]);
        let json = json!([{"i":2,"p":{"x":-5},"r":{},"s":{},"u":"changed","d":{}}, {"i":22}]);
        assert_eq!(
            calculate_level_simhash(&csv, LevelFormat::Csv)?,
            calculate_level_simhash(&json, LevelFormat::Json)?
        );
        assert_eq!(
            calculate_level_simhash(&json!([{"i":22.0}, {"i":2e0}]), LevelFormat::Json)?,
            calculate_level_simhash(&csv, LevelFormat::Csv)?
        );
        Ok(())
    }

    #[test]
    fn frequencies_count_and_proportional_counts_match() -> Result<()> {
        let minority = json!([{"i":22}, {"i":2}, {"i":2}]);
        let majority = json!([{"i":22}, {"i":22}, {"i":2}]);
        let doubled = json!([{"i":22}, {"i":22}, {"i":22}, {"i":22}, {"i":2}, {"i":2}]);
        assert_ne!(
            calculate_level_simhash(&minority, LevelFormat::Json)?,
            calculate_level_simhash(&majority, LevelFormat::Json)?
        );
        assert_eq!(
            calculate_level_simhash(&majority, LevelFormat::Json)?,
            calculate_level_simhash(&doubled, LevelFormat::Json)?
        );
        Ok(())
    }

    #[test]
    fn empty_and_malformed_blocks_are_not_fingerprints() -> Result<()> {
        assert_eq!(
            calculate_level_simhash(&json!([]), LevelFormat::Json)?,
            None
        );
        for blocks in [
            json!(null),
            json!({}),
            json!([null]),
            json!([{}]),
            json!([{"i":-1}]),
            json!([{"i":1.5}]),
            json!([{"i":"22"}]),
        ] {
            assert!(calculate_level_simhash(&blocks, LevelFormat::Json).is_err());
        }
        Ok(())
    }

    #[test]
    fn decimal_ids_preserve_exact_integer_values() -> Result<()> {
        for spelling in [
            "22.00",
            "2.2e1",
            "220e-1",
            "0e-400",
            "9223372036854775807.0",
        ] {
            let value: Value = serde_json::from_str(spelling)?;
            let expected = if spelling.starts_with('0') {
                0
            } else if spelling.starts_with("922") {
                i64::MAX
            } else {
                22
            };
            assert_eq!(block_id(&value), Some(expected));
        }
        for spelling in [
            "1e-400",
            "1.00000000000000000001",
            "9007199254740993.1",
            "9223372036854775808.0",
            "1e400",
            "-1.0",
        ] {
            assert_eq!(block_id(&serde_json::from_str(spelling)?), None);
        }
        Ok(())
    }

    #[test]
    fn signed_storage_preserves_single_id_fingerprint() -> Result<()> {
        for id in 0_i64..100 {
            let result = calculate_level_simhash(&json!([{"i":id}]), LevelFormat::Json)?.unwrap();
            assert_eq!(result as u64, xxh3_64(&id.to_le_bytes()));
        }
        let ties =
            calculate_level_simhash(&json!([{"i":22}, {"i":2}]), LevelFormat::Json)?.unwrap();
        assert_eq!(
            ties as u64,
            xxh3_64(&22_i64.to_le_bytes()) & xxh3_64(&2_i64.to_le_bytes())
        );
        Ok(())
    }
}
