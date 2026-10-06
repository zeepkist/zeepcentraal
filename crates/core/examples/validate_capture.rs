//! Local calibration comparison. Never changes profiles, records or eligibility.
use anyhow::{Context, Result, ensure};
use base64::Engine;
use serde_json::{Value, json};
use std::{io::Read, path::Path, time::Instant};
use zc_core::{
    ghost_validation::{SubmissionContext, ValidationManifest, validate},
    ghosts::{MAX_GHOST_COMPRESSED_BYTES, parse_ghost},
    levels::{LevelBlocks, parse_level},
};

fn read(path: &Path, limit: usize) -> Result<Vec<u8>> {
    let mut bytes = Vec::new();
    std::fs::File::open(path)?
        .take((limit + 1) as u64)
        .read_to_end(&mut bytes)?;
    ensure!(bytes.len() <= limit, "capture file exceeds limit");
    Ok(bytes)
}
fn main() -> Result<()> {
    let arguments: Vec<_> = std::env::args().skip(1).collect();
    ensure!(
        arguments.len() >= 2,
        "Usage: validate_capture RUN.capture.json MANIFEST.json [--probe] [--probe-game-version] [--fixture OUTPUT.json]"
    );
    let mut probe = false;
    let mut version_probe = false;
    let mut fixture_path = None;
    let mut options = arguments.iter().skip(2);
    while let Some(option) = options.next() {
        match option.as_str() {
            "--probe" => probe = true,
            "--probe-game-version" => version_probe = true,
            "--fixture" => fixture_path = Some(options.next().context("Fixture output missing")?),
            _ => anyhow::bail!("Unknown option"),
        }
    }
    ensure!(!version_probe || probe, "Version probe requires --probe");
    let marker = Path::new(&arguments[0]);
    let metadata: Value = serde_json::from_slice(&read(marker, 1_048_576)?)?;
    let run = metadata["runUuid"]
        .as_str()
        .context("capture UUID missing")?;
    let run = uuid::Uuid::parse_str(run)?.to_string();
    let directory = marker.parent().context("capture directory missing")?;
    let submission: Value = serde_json::from_slice(&read(
        &directory.join(format!("{run}.submission.json")),
        40 * 1024 * 1024,
    )?)?;
    let level = String::from_utf8(read(
        &directory.join(format!("{run}.zeeplevel")),
        64 * 1024 * 1024,
    )?)?;
    let level = parse_level(&level, false, 0)?;
    let mut manifest: ValidationManifest =
        serde_json::from_slice(&read(Path::new(&arguments[1]), 16 * 1024 * 1024)?)?;
    // A probe tests provisional tolerances in memory. Never saves calibrated=true.
    if probe {
        manifest.calibrated = true;
    }
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(submission["GhostData"].as_str().context("ghost missing")?)?;
    ensure!(
        bytes.len() <= MAX_GHOST_COMPRESSED_BYTES,
        "ghost exceeds limit"
    );
    let ghost = parse_ghost(&bytes)?;
    ensure!(
        ghost.evidence.as_ref().is_some_and(|evidence| {
            uuid::Uuid::parse_str(&evidence.run_uuid)
                .ok()
                .map(|uuid| uuid.to_string())
                .as_deref()
                == Some(run.as_str())
        }),
        "capture marker UUID does not match ghost"
    );
    let hash = submission["Hash"].as_str().context("hash missing")?;
    ensure!(
        hash.eq_ignore_ascii_case(&level.hash),
        "capture blocks do not match submitted xxHash"
    );
    let blocks = match level.blocks {
        LevelBlocks::Json(blocks) => serde_json::to_value(blocks)?,
        LevelBlocks::Csv(blocks) => serde_json::to_value(blocks)?,
    };
    let splits: Vec<f32> = serde_json::from_value(submission["Splits"].clone())?;
    let speeds: Vec<f32> = serde_json::from_value(submission["Speeds"].clone())?;
    let context = SubmissionContext {
        steam_id: ghost.metadata.steam_id.as_deref().unwrap_or(""),
        canonical_hash: hash,
        game_version: submission["GameVersion"]
            .as_str()
            .context("game version missing")?,
        time: submission["Time"].as_f64().context("time missing")?,
        splits: &splits,
        speeds: &speeds,
    };
    let original_game_version = manifest.game_version.clone();
    if let Some(path) = fixture_path {
        export_fixture(Path::new(path), &ghost, &blocks, &manifest, &context)?;
    }
    if version_probe {
        manifest.game_version = context.game_version.into();
    }
    let mut timings = Vec::with_capacity(100);
    let mut report = validate(&ghost, &context, Some(&blocks), Some(&manifest));
    for _ in 0..100 {
        let started = Instant::now();
        report = validate(&ghost, &context, Some(&blocks), Some(&manifest));
        timings.push(started.elapsed().as_micros());
    }
    timings.sort_unstable();
    report.comparison = true;
    println!(
        "{}",
        serde_json::to_string_pretty(&json!({
            "runUuid":run,"calibrationComparison":true,"provisionalProbe":probe,"authenticatedIdentityChecked":false,
            "report":report,"validationMedianMicroseconds":timings[50],"validationP95Microseconds":timings[95],
            "samples":ghost.evidence.as_ref().map(|e|e.samples.len()),"captureMeasurements":metadata,
            "profileChanged":false,"provisionalGameVersionOverride":version_probe,"manifestGameVersion":original_game_version
        }))?
    );
    Ok(())
}

fn export_fixture(
    path: &Path,
    ghost: &zc_core::ghosts::ParsedGhost,
    blocks: &Value,
    manifest: &ValidationManifest,
    context: &SubmissionContext<'_>,
) -> Result<()> {
    use std::collections::BTreeMap;
    let mut blocks = blocks.clone();
    let array = blocks
        .as_array_mut()
        .context("Fixture blocks must be array")?;
    let mut identifiers = BTreeMap::new();
    for (index, block) in array.iter().enumerate() {
        if let Some(uid) = block["u"].as_str() {
            identifiers.insert(uid.to_owned(), format!("block-{index}"));
        }
    }
    for block in array.iter_mut() {
        if let Some(uid) = block["u"].as_str() {
            block["u"] = json!(identifiers[uid]);
        }
        if let Some(texts) = block.pointer_mut("/d/t").and_then(Value::as_object_mut) {
            texts.retain(|key, _| key.starts_with("id"));
            for text in texts.values_mut() {
                if let Some(raw) = text.as_str() {
                    if let Ok(mut link) = serde_json::from_str::<Value>(raw) {
                        if let Some(target) = link["t"].as_str() {
                            link["t"] = json!(
                                identifiers
                                    .get(target)
                                    .map_or("missing-block", String::as_str)
                            );
                        }
                        *text = json!(link.to_string());
                    } else {
                        *text = json!("malformed-link");
                    }
                }
            }
        }
        if let Some(object) = block.as_object_mut()
            && object.contains_key("i")
        {
            object.retain(|key, _| matches!(key.as_str(), "i" | "u" | "p" | "r" | "s" | "d"));
        }
    }
    let mut evidence = ghost.evidence.clone().context("V8 fixture required")?;
    array.retain(|block| {
        let id = block["i"]
            .as_i64()
            .or_else(|| block["Id"].as_i64())
            .unwrap_or(-1);
        zc_core::ghost_validation::START_IDS.contains(&id)
            || zc_core::ghost_validation::CHECKPOINT_IDS.contains(&id)
            || zc_core::ghost_validation::GATE_IDS.contains(&id)
            || zc_core::ghost_validation::FINISH_IDS.contains(&id)
            || block
                .pointer("/d/n")
                .and_then(Value::as_object)
                .is_some_and(|values| values.keys().any(|key| key.starts_with("id")))
    });
    evidence.run_uuid = "00000000-0000-4000-8000-000000000001".into();
    evidence.level_uid = "untrusted-fixture-alias".into();
    evidence.canonical_hash = if evidence
        .canonical_hash
        .eq_ignore_ascii_case(context.canonical_hash)
    {
        "a".repeat(32)
    } else {
        "b".repeat(32)
    };
    evidence.submission_level = "another-untrusted-fixture-alias".into();
    for (index, event) in evidence.events.iter_mut().enumerate() {
        event.block_uid = identifiers
            .get(&event.block_uid)
            .cloned()
            .unwrap_or_else(|| format!("event-block-{index}"));
    }
    let ids: std::collections::BTreeSet<_> = array
        .iter()
        .filter_map(|block| block["i"].as_i64().or_else(|| block["Id"].as_i64()))
        .map(|id| id.to_string())
        .collect();
    let mut profile = manifest.clone();
    profile.calibrated = false;
    profile.source_digest = "sanitized-live-capture-subset".into();
    profile.blocks.retain(|key, _| ids.contains(key));
    let frames: Vec<_> = ghost
        .frames
        .iter()
        .map(|frame| json!({"time":frame.time,"ragdoll":frame.ragdoll}))
        .collect();
    let fixture = json!({"provenance":"manual live capture; identifiers and author metadata removed; geometry uncalibrated","gameVersion":context.game_version,"time":context.time,"splits":context.splits,"speeds":context.speeds,"evidence":evidence,"frames":frames,"blocks":blocks,"manifest":profile});
    use std::io::Write;
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)?;
    file.write_all(serde_json::to_string_pretty(&fixture)?.as_bytes())?;
    Ok(())
}
