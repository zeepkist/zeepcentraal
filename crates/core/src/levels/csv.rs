use super::{
    CsvBlock, LevelBlocks, LevelFormat, PRESENT_BLOCK_ID, ParsedLevel, Vector3, count_checkpoints,
    count_finishes,
};
use anyhow::Result;
use sha1::{Digest, Sha1};
use std::cmp::Ordering;

#[derive(Clone, Debug)]
struct HashBlock {
    block: CsvBlock,
    raw_position: [String; 3],
    raw_euler: [String; 3],
    raw_scale: [String; 3],
}

struct CsvContent<'a> {
    first: Vec<&'a str>,
    validation: Vec<&'a str>,
    block_lines: Vec<&'a str>,
}

fn parse_content(content: &str) -> CsvContent<'_> {
    let lines: Vec<_> = content.lines().collect();
    let mut first: Vec<_> = lines
        .first()
        .copied()
        .unwrap_or_default()
        .split(',')
        .collect();
    first.resize(3, "0");
    let raw_validation: Vec<_> = lines
        .get(2)
        .copied()
        .unwrap_or_default()
        .split(',')
        .collect();
    let validation_is_block = raw_validation.len() >= 10;
    let mut validation = if validation_is_block {
        vec!["0"; 6]
    } else {
        raw_validation
    };
    validation.resize(6, "0");
    let block_lines = lines
        .into_iter()
        .skip(if validation_is_block { 2 } else { 3 })
        .collect();
    CsvContent {
        first,
        validation,
        block_lines,
    }
}

fn number(value: &str) -> f64 {
    value
        .trim()
        .parse()
        .ok()
        .filter(|v: &f64| v.is_finite())
        .unwrap_or(0.0)
}

fn integer(value: &str) -> i64 {
    let value = number(value).trunc();
    if value >= i64::MAX as f64 {
        i64::MAX
    } else if value <= i64::MIN as f64 {
        i64::MIN
    } else {
        value as i64
    }
}

fn format_decimal(value: &str) -> String {
    let trimmed = value.trim();
    let Some((mantissa, exponent)) = split_decimal(trimmed) else {
        return "0".to_owned();
    };
    let negative = mantissa.starts_with('-');
    let unsigned = mantissa.trim_start_matches(['+', '-']);
    let (integer, fraction) = unsigned.split_once('.').unwrap_or((unsigned, ""));
    let digits = format!("{integer}{fraction}");
    let decimal_index = i64::try_from(integer.len()).unwrap_or(i64::MAX) + exponent;
    let expanded = if decimal_index <= 0 {
        format!("0.{}{digits}", "0".repeat((-decimal_index) as usize))
    } else if decimal_index as usize >= digits.len() {
        format!(
            "{digits}{}",
            "0".repeat(decimal_index as usize - digits.len())
        )
    } else {
        let index = decimal_index as usize;
        format!("{}.{}", &digits[..index], &digits[index..])
    };
    let (whole, fraction) = expanded.split_once('.').unwrap_or((&expanded, ""));
    let whole = whole.trim_start_matches('0');
    let whole = if whole.is_empty() { "0" } else { whole };
    let normalized = if fraction.is_empty() {
        whole.to_owned()
    } else {
        format!("{whole}.{fraction}")
    };
    let zero = normalized
        .chars()
        .all(|character| matches!(character, '0' | '.'));
    if negative && !zero {
        format!("-{normalized}")
    } else {
        normalized
    }
}

fn split_decimal(value: &str) -> Option<(&str, i64)> {
    let (mantissa, exponent) = if let Some((left, right)) = value.split_once(['e', 'E']) {
        (left, right.parse().ok()?)
    } else {
        (value, 0)
    };
    let unsigned = mantissa.trim_start_matches(['+', '-']);
    let mut split = unsigned.split('.');
    let whole = split.next()?;
    let fraction = split.next().unwrap_or_default();
    if split.next().is_some()
        || whole.is_empty()
        || !whole.bytes().all(|byte| byte.is_ascii_digit())
        || !fraction.bytes().all(|byte| byte.is_ascii_digit())
    {
        return None;
    }
    Some((mantissa, exponent))
}

fn parse_blocks(lines: &[&str]) -> Vec<HashBlock> {
    lines
        .iter()
        .filter(|line| !line.trim().is_empty())
        .map(|line| {
            let mut values: Vec<_> = line.split(',').collect();
            if values.len() < 38 {
                values.resize(38, "0");
            }
            let id = integer(values[0]);
            let vector = |offset: usize| Vector3 {
                x: number(values[offset]),
                y: number(values[offset + 1]),
                z: number(values[offset + 2]),
            };
            let raw = |offset: usize| {
                [
                    format_decimal(values[offset]),
                    format_decimal(values[offset + 1]),
                    format_decimal(values[offset + 2]),
                ]
            };
            let paints = values[10..27]
                .iter()
                .map(|value| {
                    if id == 2279 {
                        f64::from(number(value) as f32).trunc() as i64
                    } else {
                        number(value).trunc() as i64
                    }
                })
                .collect();
            let options = values[27..]
                .iter()
                .map(|value| number(value) as f32)
                .collect();
            HashBlock {
                block: CsvBlock {
                    id,
                    position: vector(1),
                    euler: vector(4),
                    scale: vector(7),
                    paints,
                    options,
                },
                raw_position: raw(1),
                raw_euler: raw(4),
                raw_scale: raw(7),
            }
        })
        .collect()
}

fn compare_vector(left: Vector3, right: Vector3) -> Ordering {
    left.x
        .total_cmp(&right.x)
        .then(left.y.total_cmp(&right.y))
        .then(left.z.total_cmp(&right.z))
}

fn compare_sequence<T: Ord>(left: &[T], right: &[T]) -> Ordering {
    left.len().cmp(&right.len()).then_with(|| left.cmp(right))
}

fn compare_blocks(left: &HashBlock, right: &HashBlock) -> Ordering {
    left.block
        .id
        .cmp(&right.block.id)
        .then(compare_vector(left.block.position, right.block.position))
        .then(compare_vector(left.block.euler, right.block.euler))
        .then(compare_vector(left.block.scale, right.block.scale))
        .then_with(|| compare_sequence(&left.block.paints, &right.block.paints))
        .then_with(|| {
            left.block
                .options
                .len()
                .cmp(&right.block.options.len())
                .then_with(|| {
                    left.block
                        .options
                        .iter()
                        .zip(&right.block.options)
                        .map(|(left, right)| left.total_cmp(right))
                        .find(|order| !order.is_eq())
                        .unwrap_or(Ordering::Equal)
                })
        })
}

fn format_single(value: f32) -> String {
    if value.is_infinite() {
        return if value.is_sign_negative() {
            "-Infinity".to_owned()
        } else {
            "Infinity".to_owned()
        };
    }
    if value == 0.0 {
        return "0".to_owned();
    }
    let absolute = value.abs();
    let exponent = absolute.log10().floor() as i32;
    let mut formatted = if (1e-6..1e7).contains(&absolute) {
        let decimals = usize::try_from((6 - exponent).max(0)).unwrap_or_default();
        format!("{value:.decimals$}")
    } else {
        format!("{value:.6e}")
    };
    if let Some(index) = formatted.find('e') {
        let exponent = formatted.split_off(index);
        while formatted.ends_with('0') {
            formatted.pop();
        }
        if formatted.ends_with('.') {
            formatted.pop();
        }
        let (marker, digits) = exponent.split_at(1);
        formatted.push_str(marker);
        if !digits.starts_with(['+', '-']) {
            formatted.push('+');
        }
        formatted.push_str(digits);
    } else if formatted.contains('.') {
        while formatted.ends_with('0') {
            formatted.pop();
        }
        if formatted.ends_with('.') {
            formatted.pop();
        }
    }
    formatted
}

fn vector_text(value: &[String; 3]) -> String {
    format!("<{},{},{}>", value[0], value[1], value[2])
}

fn canonical_content(skybox: i64, ground: i64, blocks: &[HashBlock]) -> String {
    let mut ordered: Vec<_> = blocks
        .iter()
        .enumerate()
        .filter(|(_, block)| block.block.id != PRESENT_BLOCK_ID)
        .collect();
    ordered.sort_by(|(left_index, left), (right_index, right)| {
        compare_blocks(left, right).then(left_index.cmp(right_index))
    });
    let mut lines = vec![skybox.to_string(), ground.to_string()];
    lines.extend(ordered.into_iter().map(|(_, entry)| {
        let block = &entry.block;
        format!(
            "Id: {}, Position: {}, Euler: {}, Scale: {}, Paints: {}, Options: {}",
            block.id,
            vector_text(&entry.raw_position),
            vector_text(&entry.raw_euler),
            vector_text(&entry.raw_scale),
            block
                .paints
                .iter()
                .map(ToString::to_string)
                .collect::<Vec<_>>()
                .join(", "),
            block
                .options
                .iter()
                .copied()
                .map(format_single)
                .collect::<Vec<_>>()
                .join(", ")
        )
    }));
    lines.push(String::new());
    lines.join("\r\n")
}

fn calculate_legacy_hash(content: &str) -> String {
    let canonical = canonical_csv_content(content);
    format!("{:X}", Sha1::digest(canonical.as_bytes()))
}

fn canonical_csv_content(content: &str) -> String {
    let parsed = parse_content(content);
    canonical_content(
        integer(parsed.validation[4]),
        integer(parsed.validation[5]),
        &parse_blocks(&parsed.block_lines),
    )
}

pub fn calculate_csv_level_xxhash(content: &str) -> String {
    let canonical = canonical_csv_content(content);
    crate::xxh128_hex(canonical.as_bytes())
}

pub fn parse_csv_level(content: &str, adventure: bool, author_id: u64) -> Result<ParsedLevel> {
    let parsed = parse_content(content);
    let blocks = parse_blocks(&parsed.block_lines);
    let uid = parsed.first[2].to_owned();
    let zeep_hash = if adventure {
        uid.clone()
    } else {
        calculate_legacy_hash(content)
    };
    let hash = calculate_csv_level_xxhash(content);
    let amount_checkpoints = count_checkpoints(blocks.iter().map(|entry| {
        (
            entry.block.id,
            entry.block.options.get(5).copied().unwrap_or_default() >= 0.5,
        )
    }));
    let amount_finishes = count_finishes(blocks.iter().map(|entry| entry.block.id));
    let amount_blocks = blocks.len();
    Ok(ParsedLevel {
        format: LevelFormat::Csv,
        hash,
        zeep_hash,
        uid,
        author_id,
        file_author: parsed.first[1].to_owned(),
        validation_time_author: number(parsed.validation[0]),
        validation_time_gold: number(parsed.validation[1]),
        validation_time_silver: number(parsed.validation[2]),
        validation_time_bronze: number(parsed.validation[3]),
        amount_checkpoints,
        amount_finishes,
        amount_blocks,
        type_ground: integer(parsed.validation[5]),
        type_skybox: integer(parsed.validation[4]),
        blocks: LevelBlocks::Csv(blocks.into_iter().map(|entry| entry.block).collect()),
    })
}
