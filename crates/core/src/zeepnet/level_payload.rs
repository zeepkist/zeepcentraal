use anyhow::{Context, Result, bail, ensure};
use flate2::{Compression, read::GzDecoder, write::GzEncoder};
use std::io::{Read, Write};

const MAX_LEVEL_PAYLOAD_BYTES: usize = 64 * 1024 * 1024;
const MAX_LEVEL_LINES: usize = 10_000_000;

pub fn encode_zeepkist_level_payload(content: &str, v15: bool) -> Result<Vec<u8>> {
    let content = content.strip_prefix('\u{feff}').unwrap_or(content);
    let lines: Vec<&str> = if v15 {
        content.split('\n').collect()
    } else {
        split_legacy_lines(content)
    };
    ensure!(lines.len() <= MAX_LEVEL_LINES, "level has too many lines");
    let mut raw = Vec::with_capacity(content.len().saturating_add(4));
    raw.extend_from_slice(&i32::try_from(lines.len())?.to_le_bytes());
    for line in lines {
        let bytes = line.as_bytes();
        write_7bit(&mut raw, u32::try_from(bytes.len())?);
        raw.extend_from_slice(bytes);
        ensure!(
            raw.len() <= MAX_LEVEL_PAYLOAD_BYTES,
            "level payload is too large"
        );
    }
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(&raw)?;
    Ok(encoder.finish()?)
}

fn split_legacy_lines(content: &str) -> Vec<&str> {
    let bytes = content.as_bytes();
    let mut lines = Vec::new();
    let mut start = 0;
    let mut index = 0;
    while index < bytes.len() {
        if matches!(bytes[index], b'\r' | b'\n') {
            lines.push(&content[start..index]);
            if bytes[index] == b'\r' && bytes.get(index + 1) == Some(&b'\n') {
                index += 1;
            }
            start = index + 1;
        }
        index += 1;
    }
    lines.push(&content[start..]);
    if lines.last() == Some(&"") {
        lines.pop();
    }
    lines
}

pub fn decode_zeepkist_level_payload(payload: &[u8]) -> Result<Vec<String>> {
    ensure!(
        payload.len() <= MAX_LEVEL_PAYLOAD_BYTES,
        "level payload is too large"
    );
    let decoder = GzDecoder::new(payload);
    let mut raw = Vec::new();
    decoder
        .take((MAX_LEVEL_PAYLOAD_BYTES + 1) as u64)
        .read_to_end(&mut raw)
        .context("invalid level payload gzip")?;
    ensure!(
        raw.len() <= MAX_LEVEL_PAYLOAD_BYTES,
        "level payload is too large"
    );
    ensure!(raw.len() >= 4, "level payload is truncated");
    let count = i32::from_le_bytes(raw[..4].try_into().expect("four bytes"));
    ensure!(
        count >= 0 && count as usize <= MAX_LEVEL_LINES,
        "invalid level line count"
    );
    let mut offset = 4;
    let mut lines = Vec::with_capacity((count as usize).min(100_000));
    for _ in 0..count {
        let length = usize::try_from(read_7bit(&raw, &mut offset)?)?;
        let end = offset
            .checked_add(length)
            .context("level string length overflow")?;
        let bytes = raw
            .get(offset..end)
            .context("level payload string is truncated")?;
        lines.push(
            std::str::from_utf8(bytes)
                .context("level payload is not UTF-8")?
                .to_owned(),
        );
        offset = end;
    }
    ensure!(offset == raw.len(), "level payload has trailing bytes");
    Ok(lines)
}

fn write_7bit(target: &mut Vec<u8>, mut value: u32) {
    loop {
        let mut byte = (value & 0x7f) as u8;
        value >>= 7;
        if value != 0 {
            byte |= 0x80;
        }
        target.push(byte);
        if value == 0 {
            break;
        }
    }
}

fn read_7bit(source: &[u8], offset: &mut usize) -> Result<u32> {
    let mut result = 0_u32;
    for shift in (0..35).step_by(7) {
        let byte = *source
            .get(*offset)
            .context("level payload string length is truncated")?;
        *offset += 1;
        result |= u32::from(byte & 0x7f) << shift;
        if byte & 0x80 == 0 {
            return Ok(result);
        }
    }
    bail!("level payload string length is invalid")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v15_preserves_lf_split_contract() {
        let payload = encode_zeepkist_level_payload("\u{feff}one\r\ntwø\n", true).unwrap();
        assert_eq!(
            decode_zeepkist_level_payload(&payload).unwrap(),
            ["one\r", "twø", ""]
        );
    }

    #[test]
    fn legacy_accepts_all_line_endings_without_trailing_empty_line() {
        let payload = encode_zeepkist_level_payload("one\r\ntwø\r\n", false).unwrap();
        assert_eq!(
            decode_zeepkist_level_payload(&payload).unwrap(),
            ["one", "twø"]
        );
    }

    #[test]
    fn rejects_invalid_payload() {
        assert!(decode_zeepkist_level_payload(&[1, 2, 3]).is_err());
    }
}
