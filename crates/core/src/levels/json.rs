use super::{
    LevelBlocks, LevelFormat, PRESENT_BLOCK_ID, ParsedLevel, count_checkpoints, count_finishes,
};
use anyhow::{Context, Result, bail};
use serde_json::{Map, Value};

fn is_identifier(character: Option<char>) -> bool {
    character.is_some_and(|value| value.is_ascii_alphanumeric() || matches!(value, '_' | '$'))
}

fn normalize_non_finite(content: &str) -> String {
    let mut output = String::with_capacity(content.len());
    let mut index = 0;
    let mut in_string = false;
    let mut escaped = false;
    while index < content.len() {
        let rest = &content[index..];
        let character = rest.chars().next().expect("index remains in string");
        if in_string {
            output.push(character);
            if escaped {
                escaped = false;
            } else if character == '\\' {
                escaped = true;
            } else if character == '"' {
                in_string = false;
            }
            index += character.len_utf8();
            continue;
        }
        if character == '"' {
            in_string = true;
            output.push(character);
            index += 1;
            continue;
        }
        let previous = output.chars().next_back();
        let token = ["-Infinity", "Infinity", "NaN"].into_iter().find(|token| {
            rest.starts_with(token)
                && !is_identifier(previous)
                && !is_identifier(rest[token.len()..].chars().next())
        });
        if let Some(token) = token {
            output.push('0');
            index += token.len();
        } else {
            output.push(character);
            index += character.len_utf8();
        }
    }
    output
}

fn as_number(value: Option<&Value>) -> f64 {
    match value {
        Some(Value::Number(value)) => value
            .to_string()
            .parse::<f64>()
            .ok()
            .filter(|value| value.is_finite())
            .unwrap_or(0.0),
        Some(Value::String(value)) => value
            .parse()
            .ok()
            .filter(|value: &f64| value.is_finite())
            .unwrap_or(0.0),
        _ => 0.0,
    }
}

fn as_integer(value: Option<&Value>) -> i64 {
    as_number(value).trunc() as i64
}

fn as_string(value: Option<&Value>) -> String {
    value.and_then(Value::as_str).unwrap_or_default().to_owned()
}

fn object<'a>(value: &'a Value, key: &str) -> Option<&'a Map<String, Value>> {
    value.get(key)?.as_object()
}

fn canonical_json(value: &Value, output: &mut String) -> Result<()> {
    match value {
        Value::Null => output.push_str("null"),
        Value::Bool(value) => output.push_str(if *value { "true" } else { "false" }),
        Value::Number(value) => {
            let number: f64 = value
                .to_string()
                .parse()
                .context("JSON number is outside f64 range")?;
            if number == 0.0 {
                output.push('0');
            } else {
                output.push_str(ryu_js::Buffer::new().format(number));
            }
        }
        Value::String(value) => output.push_str(&serde_json::to_string(value)?),
        Value::Array(values) => {
            output.push('[');
            for (index, value) in values.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }
                canonical_json(value, output)?;
            }
            output.push(']');
        }
        Value::Object(values) => {
            output.push('{');
            let mut entries: Vec<_> = values.iter().collect();
            entries.sort_by_key(|(key, _)| *key);
            for (index, (key, value)) in entries.into_iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }
                output.push_str(&serde_json::to_string(key)?);
                output.push(':');
                canonical_json(value, output)?;
            }
            output.push('}');
        }
    }
    Ok(())
}

fn parsed(content: &str) -> Result<Value> {
    serde_json::from_str(&normalize_non_finite(content)).context("invalid JSON level")
}

fn canonical_json_blocks(content: &str) -> Result<String> {
    let parsed = parsed(content)?;
    let blocks = parsed
        .get("blox")
        .and_then(Value::as_array)
        .context("JSON level is missing blox")?;
    let mut canonical = Vec::new();
    for (index, block) in blocks.iter().enumerate() {
        if as_integer(block.get("i")) == PRESENT_BLOCK_ID {
            continue;
        }
        let mut output = String::new();
        canonical_json(block, &mut output)?;
        canonical.push((output, index));
    }
    canonical.sort_by(|(left, left_index), (right, right_index)| {
        left.cmp(right).then(left_index.cmp(right_index))
    });
    Ok(format!(
        "[{}]",
        canonical
            .into_iter()
            .map(|(value, _)| value)
            .collect::<Vec<_>>()
            .join(",")
    ))
}

pub fn calculate_json_level_xxhash(content: &str) -> Result<String> {
    let payload = canonical_json_blocks(content)?;
    Ok(crate::xxh128_hex(payload.as_bytes()))
}

pub fn parse_json_level(content: &str, adventure: bool) -> Result<ParsedLevel> {
    let parsed = parsed(content)?;
    let level = object(&parsed, "level");
    let author = object(&parsed, "author");
    let medals = object(&parsed, "medals");
    let environment = object(&parsed, "enviro");
    let blocks = parsed
        .get("blox")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let uid = as_string(level.and_then(|value| value.get("UID")));
    let zeep_hash = if adventure {
        uid.clone()
    } else {
        let value = as_string(level.and_then(|value| value.get("zeepHash")));
        if value.is_empty() { uid.clone() } else { value }
    };
    let author_id = match author.and_then(|value| value.get("StmID")) {
        Some(Value::String(value)) => value.parse().unwrap_or_default(),
        Some(Value::Number(value)) => value
            .as_u64()
            .unwrap_or_else(|| as_number(Some(&Value::Number(value.clone()))) as u64),
        _ => 0,
    };
    let mut checkpoint_blocks = Vec::with_capacity(blocks.len());
    let mut finish_ids = Vec::with_capacity(blocks.len());
    for block in &blocks {
        let id = as_integer(block.get("i"));
        let flagged = block
            .pointer("/d/n/ch5")
            .is_some_and(|value| as_integer(Some(value)) == 1);
        checkpoint_blocks.push((id, flagged));
        finish_ids.push(id);
    }
    let amount_blocks = blocks.len();
    let hash = calculate_json_level_xxhash(content)?;
    Ok(ParsedLevel {
        format: LevelFormat::Json,
        hash,
        zeep_hash,
        uid,
        author_id,
        file_author: as_string(author.and_then(|value| value.get("name"))),
        validation_time_author: as_number(medals.and_then(|value| value.get("author"))),
        validation_time_gold: as_number(medals.and_then(|value| value.get("gold"))),
        validation_time_silver: as_number(medals.and_then(|value| value.get("silver"))),
        validation_time_bronze: as_number(medals.and_then(|value| value.get("bronze"))),
        amount_checkpoints: count_checkpoints(checkpoint_blocks),
        amount_finishes: count_finishes(finish_ids),
        amount_blocks,
        type_ground: as_integer(environment.and_then(|value| value.get("groundMat"))),
        type_skybox: as_integer(environment.and_then(|value| value.get("skybox"))),
        blocks: LevelBlocks::Json(blocks),
    })
}

#[allow(dead_code)]
fn _assert_supported(value: &Value) -> Result<()> {
    if matches!(
        value,
        Value::Null
            | Value::Bool(_)
            | Value::Number(_)
            | Value::String(_)
            | Value::Array(_)
            | Value::Object(_)
    ) {
        Ok(())
    } else {
        bail!("JSON level contains unsupported value")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_ecmascript_numbers() {
        let values: Value =
            serde_json::from_str("[1E1,1E-1,1E6,1E-6,1E7,1E-7,1E20,1E21,1E22,6.41169463E-21]")
                .unwrap();
        let mut output = String::new();
        canonical_json(&values, &mut output).unwrap();
        assert_eq!(
            output,
            "[10,0.1,1000000,0.000001,10000000,1e-7,100000000000000000000,1e+21,1e+22,6.41169463e-21]"
        );
        let parsed: Value = serde_json::from_str("-1E-30").unwrap();
        assert_eq!(
            parsed.to_string().parse::<f64>().unwrap().to_bits(),
            (-1e-30f64).to_bits()
        );
    }
}
