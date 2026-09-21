use crate::config::{RequiredMode, Rules};
use anyhow::{Context, Result, bail, ensure};
use regex::Regex;
use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{collections::HashSet, sync::LazyLock};
use zc_core::{
    levels::{LevelBlocks, parse_level},
    zeepnet::{decode_zeepkist_level_payload, encode_zeepkist_level_payload},
};

pub const VALIDATOR_VERSION: &str = "1";

static CSV_NUMBER: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$").expect("valid CSV number regex")
});

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectionMeasurements {
    pub blocks: usize,
    pub checkpoints: usize,
    pub author_time: f64,
    pub modes: Vec<String>,
    pub center_span: [f64; 3],
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectionPayload {
    pub sha256: String,
    pub byte_size: usize,
    pub uid: String,
    pub name: String,
    pub author: String,
    pub collaborators: String,
    pub override_author_name: String,
}

#[derive(Clone, Debug)]
pub struct Inspection {
    pub failures: Vec<String>,
    pub measurements: InspectionMeasurements,
    pub content_sha256: String,
    pub data: Vec<u8>,
    pub payload: InspectionPayload,
}

#[derive(Clone, Copy)]
struct Block {
    id: i64,
    position: [f64; 3],
}

pub fn inspect_level(content: &str, name: &str, rules: &Rules) -> Result<Inspection> {
    let normalized = content.strip_prefix('\u{feff}').unwrap_or(content);
    let is_json = normalized.trim_start().starts_with('{');
    let raw = if is_json {
        Some(serde_json::from_str::<Value>(normalized).context("malformed-level")?)
    } else {
        validate_csv_source(normalized)?;
        None
    };
    if let Some(raw) = &raw {
        ensure!(
            raw.get("blox").is_some_and(Value::is_array),
            "malformed-level"
        );
        ensure!(
            raw.pointer("/medals/author").is_some_and(Value::is_number),
            "malformed-level"
        );
    }
    let parsed = parse_level(normalized, false, 0).context("malformed-level")?;
    for value in [parsed.uid.as_str(), name, parsed.file_author.as_str()] {
        ensure!(value.len() <= 4_096, "malformed-level");
    }
    ensure!(
        !parsed.uid.is_empty()
            && parsed.validation_time_author.is_finite()
            && parsed.validation_time_author >= 0.0,
        "malformed-level"
    );
    let (blocks, collaborators, override_author_name) = match (&parsed.blocks, raw.as_ref()) {
        (LevelBlocks::Csv(blocks), _) => (
            blocks
                .iter()
                .map(|block| Block {
                    id: block.id,
                    position: [block.position.x, block.position.y, block.position.z],
                })
                .collect(),
            String::new(),
            String::new(),
        ),
        (LevelBlocks::Json(blocks), Some(raw)) => {
            let blocks = blocks
                .iter()
                .map(|block| {
                    Ok(Block {
                        id: block
                            .get("i")
                            .and_then(Value::as_i64)
                            .context("malformed-level")?,
                        position: [
                            number(block.pointer("/p/x"))?,
                            number(block.pointer("/p/y"))?,
                            number(block.pointer("/p/z"))?,
                        ],
                    })
                })
                .collect::<Result<Vec<_>>>()?;
            (
                blocks,
                string(raw.pointer("/author/collaborators"))?,
                string(raw.pointer("/author/nameOverride"))?,
            )
        }
        _ => bail!("malformed-level"),
    };
    ensure!(
        blocks
            .iter()
            .all(|block| block.position.iter().all(|value| value.is_finite())),
        "malformed-level"
    );
    ensure!(
        [name, &collaborators, &override_author_name]
            .iter()
            .all(|value| value.len() <= 4_096),
        "malformed-level"
    );

    let found_modes: Vec<_> = mode_ids()
        .into_iter()
        .filter(|(_, ids)| blocks.iter().any(|block| ids.contains(&block.id)))
        .map(|(mode, _)| mode)
        .collect();
    let mut spans = [0.0; 3];
    if !blocks.is_empty() {
        for (axis, span) in spans.iter_mut().enumerate() {
            let min = blocks
                .iter()
                .map(|block| block.position[axis])
                .fold(f64::INFINITY, f64::min);
            let max = blocks
                .iter()
                .map(|block| block.position[axis])
                .fold(f64::NEG_INFINITY, f64::max);
            *span = max - min;
        }
    }
    let mut failures = Vec::new();
    if !(rules.min_blocks..=rules.max_blocks).contains(&blocks.len()) {
        failures.push("block-limit".into());
    }
    if parsed.validation_time_author < rules.min_time {
        failures.push("minimum-time".into());
    }
    if parsed.validation_time_author > rules.max_time {
        failures.push("maximum-time".into());
    }
    if parsed.amount_checkpoints < rules.min_checkpoints {
        failures.push("minimum-checkpoints".into());
    }
    let found: HashSet<_> = found_modes.iter().copied().collect();
    for mode in &rules.required_modes {
        if !found.contains(mode) {
            failures.push(format!("missing-mode:{}", mode.label()));
        }
    }
    if rules
        .max_center_span
        .is_some_and(|maximum| spans.iter().any(|span| *span > maximum))
    {
        failures.push("center-span".into());
    }
    for checkpoint in &rules.fixed_checkpoints {
        if !blocks.iter().any(|block| {
            block.id >= 0
                && block.id as u64 == checkpoint.id
                && block
                    .position
                    .iter()
                    .zip(checkpoint.position)
                    .all(|(actual, expected)| (actual - expected).abs() <= checkpoint.tolerance)
        }) {
            failures.push(format!("missing-fixed-checkpoint:{}", checkpoint.id));
        }
    }
    let data = encode_zeepkist_level_payload(normalized, is_json)?;
    decode_zeepkist_level_payload(&data)?;
    let payload = InspectionPayload {
        sha256: sha256(&data),
        byte_size: data.len(),
        uid: parsed.uid,
        name: name.to_owned(),
        author: parsed.file_author,
        collaborators,
        override_author_name,
    };
    Ok(Inspection {
        failures,
        measurements: InspectionMeasurements {
            blocks: blocks.len(),
            checkpoints: parsed.amount_checkpoints,
            author_time: parsed.validation_time_author,
            modes: found_modes
                .into_iter()
                .map(|mode| mode.label().to_owned())
                .collect(),
            center_span: spans,
        },
        content_sha256: sha256(normalized.as_bytes()),
        data,
        payload,
    })
}

fn validate_csv_source(content: &str) -> Result<()> {
    let lines: Vec<_> = content.lines().collect();
    ensure!(
        lines.len() >= 3 && lines[0].split(',').count() >= 3,
        "malformed-level"
    );
    for field in lines
        .iter()
        .skip(1)
        .filter(|line| !line.trim().is_empty())
        .flat_map(|line| line.split(','))
    {
        let field = field.trim();
        ensure!(CSV_NUMBER.is_match(field), "malformed-level");
        let value: f32 = field.parse().context("malformed-level")?;
        ensure!(value.is_finite(), "malformed-level");
        if let Some((_, exponent)) = field.split_once(['e', 'E']) {
            let exponent: i32 = exponent.parse().context("malformed-level")?;
            ensure!(exponent.unsigned_abs() <= 308, "malformed-level");
        }
    }
    Ok(())
}

fn number(value: Option<&Value>) -> Result<f64> {
    value
        .and_then(Value::as_f64)
        .filter(|value| value.is_finite())
        .context("malformed-level")
}

fn string(value: Option<&Value>) -> Result<String> {
    match value {
        None => Ok(String::new()),
        Some(Value::String(value)) if value.len() <= 4_096 => Ok(value.clone()),
        _ => bail!("malformed-level"),
    }
}

pub fn sha256(value: impl AsRef<[u8]>) -> String {
    format!("{:x}", Sha256::digest(value.as_ref()))
}

fn mode_ids() -> [(RequiredMode, &'static [i64]); 10] {
    [
        (RequiredMode::InvertSteering, &[1978, 1979, 1990]),
        (RequiredMode::InvertArmsUpBraking, &[1980, 1981, 1991]),
        (RequiredMode::OffroadWheels, &[1982, 1983, 1992]),
        (RequiredMode::Paraglider, &[1984, 1985, 1993]),
        (RequiredMode::SoapWheels, &[1608, 1610, 1987]),
        (RequiredMode::FirstPerson, &[72, 1611, 1613, 1988]),
        (RequiredMode::ThirdPerson, &[73, 1612, 1614, 1989]),
        (
            RequiredMode::Logic,
            &[1727, 1728, 1729, 1730, 1744, 2285, 2286],
        ),
        (RequiredMode::Music, &[2279, 2280]),
        (RequiredMode::Reset, &[1607, 1609, 1986]),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn rules() -> Rules {
        serde_json::from_value(json!({
            "minBlocks": 0,
            "maxBlocks": 3000,
            "minTime": 25,
            "maxTime": 60,
            "minCheckpoints": 3
        }))
        .unwrap()
    }

    fn level() -> Value {
        json!({
            "jsonVersion": 15,
            "level": { "UID": "fixture", "name": "Fixture" },
            "author": { "name": "Author", "StmID": "76561198000000000" },
            "medals": { "author": 40, "gold": 45, "silver": 50, "bronze": 60 },
            "blox": (0..3).map(|x| json!({
                "i": 22,
                "p": { "x": x, "y": 0, "z": 0 },
                "r": { "x": 0, "y": 0, "z": 0 },
                "s": { "x": 1, "y": 1, "z": 1 },
                "d": { "n": {} }
            })).collect::<Vec<_>>()
        })
    }

    #[test]
    fn valid_json_produces_verified_payload_and_measurements() {
        let result = inspect_level(&level().to_string(), "Fixture", &rules()).unwrap();
        assert!(result.failures.is_empty());
        assert_eq!(result.payload.uid, "fixture");
        assert_eq!(result.payload.byte_size, result.data.len());
        assert_eq!(result.measurements.checkpoints, 3);
    }

    #[test]
    fn reports_numeric_mode_fixed_point_and_span_failures_in_order() {
        let mut input = level();
        input["medals"]["author"] = json!(61);
        let rules: Rules = serde_json::from_value(json!({
            "minBlocks": 0,
            "maxBlocks": 2,
            "minTime": 25,
            "maxTime": 60,
            "minCheckpoints": 3,
            "requiredModes": ["Paraglider"],
            "maxCenterSpan": 1,
            "fixedCheckpoints": [{ "id": 22, "position": [99, 0, 0], "tolerance": 0.01 }]
        }))
        .unwrap();
        assert_eq!(
            inspect_level(&input.to_string(), "Fixture", &rules)
                .unwrap()
                .failures,
            [
                "block-limit",
                "maximum-time",
                "missing-mode:Paraglider",
                "center-span",
                "missing-fixed-checkpoint:22"
            ]
        );
    }

    #[test]
    fn validates_legacy_numbers_before_permissive_core_parser() {
        let block = std::iter::once("22")
            .chain(std::iter::repeat_n("0", 37))
            .collect::<Vec<_>>()
            .join(",");
        let content =
            format!("Level,Author,fixture\r\n0,0,0,0,0,0,0,0\r\n40,45,50,60,0,0\r\n{block}");
        let mut csv_rules = rules();
        csv_rules.min_checkpoints = 0;
        assert!(
            inspect_level(&content, "Legacy", &csv_rules)
                .unwrap()
                .failures
                .is_empty()
        );
        for invalid in ["NaN", "Infinity", "1e999999", "1e-999999", "garbage"] {
            assert!(
                inspect_level(
                    &content.replacen("40,45", &format!("{invalid},45"), 1),
                    "Legacy",
                    &csv_rules
                )
                .is_err()
            );
        }
    }
}
