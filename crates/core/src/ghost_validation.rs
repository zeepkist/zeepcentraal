//! Independent compatibility evidence. Client events are claims, never authority.
use crate::ghosts::ParsedGhost;
use parry3d_f64::{
    math::{Pose, Vector},
    query::{ShapeCastOptions, cast_shapes, intersection_test},
    shape::{Ball, ConvexPolyhedron},
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};

pub const VALIDATOR_VERSION: &str = "geometry-8";
pub const MAX_BLOCKS: usize = 20_000;
pub const MAX_QUERY_WORK: usize = 2_000_000;
pub const START_IDS: &[i64] = &[1, 1363, 2256, 2259];
pub const CHECKPOINT_IDS: &[i64] = &[22, 372, 373, 1275, 1276, 1277, 1278, 1279, 1615];
pub const GATE_IDS: &[i64] = &[
    1607, 1608, 1609, 1610, 1611, 1612, 1613, 1614, 1978, 1979, 1980, 1981, 1982, 1983, 1984, 1985,
    1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993,
];
pub const FINISH_IDS: &[i64] = &[2, 1273, 1274, 1412, 1616];

pub fn load_manifest_from_env() -> anyhow::Result<Option<ValidationManifest>> {
    use std::io::Read;
    let Ok(path) = crate::environment::var("GHOST_VALIDATION_MANIFEST") else {
        return Ok(None);
    };
    let mut bytes = Vec::new();
    std::fs::File::open(path)?
        .take(16 * 1024 * 1024 + 1)
        .read_to_end(&mut bytes)?;
    anyhow::ensure!(
        bytes.len() <= 16 * 1024 * 1024,
        "validation manifest exceeds 16 MiB"
    );
    Ok(Some(serde_json::from_slice(&bytes)?))
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SphereSample {
    pub time: f64,
    pub position: [f64; 3],
    pub radius: f64,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TriggerEvent {
    pub block_uid: String,
    pub shape: String,
    pub finish: bool,
    pub raw_time: f64,
    pub adjusted_time: f64,
    pub velocity_kmh: f64,
    pub sample: SphereSample,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RunEvidence {
    #[serde(default, skip_serializing_if = "is_zero")]
    pub sphere_sampling_version: u32,
    pub run_uuid: String,
    pub level_uid: String,
    pub submission_level: String,
    pub canonical_hash: String,
    pub initial_time: f64,
    pub physics_interval: f64,
    pub samples: Vec<SphereSample>,
    pub events: Vec<TriggerEvent>,
}
fn is_zero(value: &u32) -> bool {
    *value == 0
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationReport {
    #[serde(default)]
    pub comparison: bool,
    pub status: String,
    pub reasons: Vec<String>,
    pub matched_groups: Vec<Vec<String>>,
    pub missing_groups: Vec<Vec<String>>,
    pub validator_version: String,
}
impl ValidationReport {
    pub fn failed(reason: &str) -> Self {
        Self {
            status: "fail".into(),
            ..Self::uncertain(reason)
        }
    }
    pub fn uncertain(reason: &str) -> Self {
        Self {
            comparison: false,
            status: "uncertain".into(),
            reasons: vec![reason.into()],
            matched_groups: vec![],
            missing_groups: vec![],
            validator_version: VALIDATOR_VERSION.into(),
        }
    }
    fn fail(&mut self, reason: &str) {
        self.status = "fail".into();
        self.reasons.push(reason.into());
    }
    fn uncertainty(&mut self, reason: &str) {
        if self.status != "fail" {
            self.status = "uncertain".into();
        }
        if !self.reasons.iter().any(|r| r == reason) {
            self.reasons.push(reason.into());
        }
    }
}

/// Checkpoint telemetry travels in submission fields, not V1–V7 ghost payloads.
/// GTR commit 34cc643 records V4 splits, without speeds. Earlier submission
/// implementations are absent from available history, so their support is unknown.
fn checkpoint_telemetry_capabilities(version: i32) -> (Option<bool>, Option<bool>) {
    match version {
        1..=3 => (None, None),
        4 => (Some(true), Some(false)),
        5.. => (Some(true), Some(true)),
        _ => (None, None),
    }
}

fn validate_checkpoint_telemetry(
    ghost: &ParsedGhost,
    context: &SubmissionContext<'_>,
    group_count: Option<usize>,
    report: &mut ValidationReport,
) {
    let legacy = (1..=7).contains(&ghost.version);
    let (splits_supported, speeds_supported) = checkpoint_telemetry_capabilities(ghost.version);
    if legacy && splits_supported.is_none() && context.splits.is_empty() {
        report.uncertainty("legacy_telemetry_capabilities_unknown");
    }
    let invalid_values = context
        .splits
        .iter()
        .any(|v| !v.is_finite() || *v < 0. || f64::from(*v) > context.time + 0.25)
        || context.splits.windows(2).any(|pair| pair[1] < pair[0])
        || context.speeds.iter().any(|v| !v.is_finite() || *v < 0.);
    let mismatch = context.splits.len() != context.speeds.len();
    if !legacy {
        if invalid_values || mismatch {
            report.fail("invalid_splits");
        }
        return;
    }
    if invalid_values || (mismatch && !context.splits.is_empty() && !context.speeds.is_empty()) {
        report.uncertainty("legacy_telemetry_inconsistent");
    }
    if mismatch
        && speeds_supported == Some(true)
        && (context.splits.is_empty() || context.speeds.is_empty())
    {
        report.uncertainty("legacy_telemetry_incomplete");
    }
    if let Some(count) = group_count {
        for (values, supported) in [
            (context.splits, splits_supported),
            (context.speeds, speeds_supported),
        ] {
            if supported == Some(true) && values.is_empty() && count > 0 {
                report.uncertainty("legacy_telemetry_incomplete");
            } else if !values.is_empty() && values.len() < count {
                // Supplied checkpoint telemetry proves a shortfall even for old formats.
                // Empty arrays remain unavailable evidence, not zero checkpoint hits.
                report.fail("missing_checkpoint_telemetry");
            } else if !values.is_empty() && values.len() > count {
                report.uncertainty("legacy_telemetry_inconsistent");
            }
        }
    }
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct CheckpointGraph {
    pub groups: Vec<Vec<String>>,
    pub reasons: Vec<String>,
}

/// Read only declared entries. Stale text entries and drawing-leader flags are irrelevant.
pub fn checkpoint_graph(blocks: &Value) -> CheckpointGraph {
    if blocks
        .as_array()
        .is_some_and(|array| array.len() > MAX_BLOCKS)
    {
        return CheckpointGraph {
            groups: vec![],
            reasons: vec!["geometry_budget".into()],
        };
    }
    let normalized = normalize_blocks(blocks);
    let blocks = &normalized;
    let mut result = CheckpointGraph::default();
    let Some(blocks) = blocks.as_array() else {
        result.reasons.push("unsupported_level_format".into());
        return result;
    };
    if blocks.len() > MAX_BLOCKS {
        result.reasons.push("geometry_budget".into());
        return result;
    }
    let mut nodes = BTreeMap::<String, (&Value, bool)>::new();
    for (index, block) in blocks.iter().enumerate() {
        let id = block["i"].as_i64().unwrap_or(-1);
        if !CHECKPOINT_IDS.contains(&id) && !GATE_IDS.contains(&id) {
            continue;
        }
        let active = CHECKPOINT_IDS.contains(&id)
            || block.pointer("/d/n/ch5").and_then(Value::as_f64) == Some(1.0);
        let uid = block["u"]
            .as_str()
            .map(str::to_owned)
            .unwrap_or_else(|| format!("missing:{index}"));
        if block["u"].as_str().is_none() {
            result.reasons.push("missing_block_uid".into());
        }
        if nodes.insert(uid, (block, active)).is_some() {
            result.reasons.push("duplicate_block_uid".into());
        }
    }
    let mut edges = BTreeMap::<String, BTreeSet<String>>::new();
    let mut remaining_links = 100_000;
    for (uid, (block, _)) in &nodes {
        let count = match block.pointer("/d/n/id0") {
            None => 0,
            Some(value) => match value.as_u64() {
                Some(n) if n <= MAX_BLOCKS as u64 => n as usize,
                _ => {
                    result.reasons.push("malformed_links".into());
                    0
                }
            },
        };
        if count > remaining_links {
            result.reasons.push("geometry_budget".into());
            break;
        }
        remaining_links -= count;
        for index in 0..count {
            let connection = block
                .pointer("/d/t")
                .and_then(|t| t.get(format!("id0-{index}")))
                .and_then(Value::as_str)
                .and_then(|text| serde_json::from_str::<Value>(text).ok());
            let Some(connection) = connection else {
                result.reasons.push("malformed_links".into());
                continue;
            };
            let Some(target) = connection["t"].as_str() else {
                result.reasons.push("malformed_links".into());
                continue;
            };
            if connection["c"].as_i64() != Some(0) || !nodes.contains_key(target) {
                result.reasons.push("missing_link_target".into());
                continue;
            }
            edges.entry(uid.clone()).or_default().insert(target.into());
            edges.entry(target.into()).or_default().insert(uid.clone());
        }
    }
    let mut visited = BTreeSet::new();
    for uid in nodes.keys() {
        if !visited.insert(uid.clone()) {
            continue;
        }
        let mut pending = vec![uid.clone()];
        let mut group = vec![];
        while let Some(node) = pending.pop() {
            if nodes[&node].1 {
                group.push(node.clone());
            }
            for next in edges.get(&node).into_iter().flatten() {
                if visited.insert(next.clone()) {
                    pending.push(next.clone());
                }
            }
        }
        group.sort();
        if !group.is_empty() {
            result.groups.push(group);
        }
    }
    result.reasons.sort();
    result.reasons.dedup();
    result
}

fn normalize_blocks(blocks: &Value) -> Value {
    let Some(array) = blocks.as_array() else {
        return blocks.clone();
    };
    if array.len() > MAX_BLOCKS || !array.first().is_some_and(|b| b.get("Id").is_some()) {
        return blocks.clone();
    }
    Value::Array(array.iter().enumerate().map(|(index,block)| {
        let mut numeric=serde_json::Map::new();
        let options=block["Options"].as_array();
        // CsvBlock.Options already excludes ID, transforms, and 17 paint columns.
        for option in 0..6 {if let Some(value)=options.and_then(|v|v.get(option)){numeric.insert(format!("a{option}"),value.clone());}}
        numeric.insert("ch5".into(),serde_json::json!(if options.and_then(|v|v.get(5)).and_then(Value::as_f64).is_some_and(|n|n>=0.5){1}else{0}));
        let vector=|key:&str|serde_json::json!({"x":block[key]["X"],"y":block[key]["Y"],"z":block[key]["Z"]});
        serde_json::json!({"i":block["Id"],"u":format!("csv:{index}"),"p":vector("Position"),"r":vector("Euler"),"s":vector("Scale"),"d":{"n":numeric}})
    }).collect())
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColliderDefinition {
    pub shape: String,
    #[serde(default)]
    pub convex: bool,
    pub vertices: Vec<[f64; 3]>,
    #[serde(default)]
    pub attributes: Vec<String>,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockDefinition {
    #[serde(default)]
    pub spawns: Vec<[f64; 3]>,
    #[serde(default)]
    pub colliders: Vec<ColliderDefinition>,
    #[serde(default)]
    pub unsupported: Vec<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationManifest {
    pub version: u32,
    pub game_version: String,
    pub source_digest: String,
    /// Calibration is an operator-owned artifact. Never trust a client radius/tolerance.
    #[serde(default)]
    pub calibrated: bool,
    pub sphere_radius: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ragdoll_sphere_radius: Option<f64>,
    pub physics_interval: f64,
    pub position_tolerance: f64,
    pub spawn_tolerance: f64,
    pub blocks: BTreeMap<String, BlockDefinition>,
}
pub struct SubmissionContext<'a> {
    pub steam_id: &'a str,
    pub canonical_hash: &'a str,
    pub game_version: &'a str,
    pub time: f64,
    pub splits: &'a [f32],
    pub speeds: &'a [f32],
}

pub fn checkpoint_overlays(blocks: &Value, manifest: &ValidationManifest) -> Vec<Value> {
    if blocks
        .as_array()
        .is_some_and(|array| array.len() > MAX_BLOCKS)
    {
        return vec![];
    }
    let normalized = normalize_blocks(blocks);
    let blocks = &normalized;
    let Some(blocks) = blocks.as_array() else {
        return vec![];
    };
    if blocks.len() > MAX_BLOCKS {
        return vec![];
    }
    let mut overlays = vec![];
    let mut vertices_left = 250_000;
    for block in blocks {
        let id = block["i"].as_i64().unwrap_or(-1);
        if !CHECKPOINT_IDS.contains(&id)
            && !(GATE_IDS.contains(&id)
                && block.pointer("/d/n/ch5").and_then(Value::as_f64) == Some(1.))
            && !FINISH_IDS.contains(&id)
        {
            continue;
        }
        let Some(def) = manifest.blocks.get(&id.to_string()) else {
            continue;
        };
        for collider in &def.colliders {
            if !collider.attributes.iter().all(|key| {
                block
                    .pointer("/d/n")
                    .and_then(|n| n.get(key))
                    .and_then(Value::as_f64)
                    == Some(1.)
            }) {
                continue;
            }
            if collider.vertices.len() > vertices_left {
                return overlays;
            }
            vertices_left -= collider.vertices.len();
            let points: Option<Vec<_>> = collider
                .vertices
                .iter()
                .map(|p| transform(*p, block))
                .collect();
            if let Some(points) = points {
                overlays.push(serde_json::json!({"uid":block["u"],"shape":collider.shape,"finish":FINISH_IDS.contains(&id),"vertices":points}));
            }
        }
    }
    overlays
}

struct Trigger {
    uid: String,
    shape: String,
    hull: ConvexPolyhedron,
    min: [f64; 3],
    max: [f64; 3],
    finish: bool,
}
fn transform(point: [f64; 3], block: &Value) -> Option<[f64; 3]> {
    let read = |key: &str, default: f64| -> Option<[f64; 3]> {
        let mut out = [default; 3];
        for (i, axis) in ["x", "y", "z"].iter().enumerate() {
            if let Some(value) = block.get(key).and_then(|v| v.get(*axis)) {
                out[i] = value.as_f64()?;
            }
            if !out[i].is_finite() {
                return None;
            }
        }
        Some(out)
    };
    let p = read("p", 0.)?;
    let r = read("r", 0.)?.map(f64::to_radians);
    let s = read("s", 1.)?;
    let [x, y, z] = std::array::from_fn(|i| point[i] * s[i]);
    // Unity Quaternion.Euler applies Z, then X, then Y.
    let (sz, cz) = r[2].sin_cos();
    let (sx, cx) = r[0].sin_cos();
    let (sy, cy) = r[1].sin_cos();
    let (x, y) = (cz * x - sz * y, sz * x + cz * y);
    let (y, z) = (cx * y - sx * z, sx * y + cx * z);
    let out = [cy * x + sy * z + p[0], y + p[1], -sy * x + cy * z + p[2]];
    out.iter().all(|v| v.is_finite()).then_some(out)
}
fn finite_sample(s: &SphereSample) -> bool {
    s.time.is_finite()
        && s.time >= 0.
        && s.radius.is_finite()
        && s.radius > 0.
        && s.position.iter().all(|v| v.is_finite())
}
fn contact(trigger: &Trigger, a: &SphereSample, b: &SphereSample, radius: f64) -> Result<bool, ()> {
    for i in 0..3 {
        if a.position[i].min(b.position[i]) - radius > trigger.max[i]
            || a.position[i].max(b.position[i]) + radius < trigger.min[i]
        {
            return Ok(false);
        }
    }
    let sphere = Ball::new(radius);
    let start = Pose::translation(a.position[0], a.position[1], a.position[2]);
    if intersection_test(&start, &sphere, &Pose::IDENTITY, &trigger.hull)
        .map_err(|_| ())?
        .intersecting
    {
        return Ok(true);
    }
    cast_shapes(
        &start,
        Vector::new(
            b.position[0] - a.position[0],
            b.position[1] - a.position[1],
            b.position[2] - a.position[2],
        ),
        &Ball::new(radius),
        &Pose::IDENTITY,
        Vector::ZERO,
        &trigger.hull,
        ShapeCastOptions {
            max_time_of_impact: 1.,
            ..Default::default()
        },
    )
    .map(|hit| hit.is_some())
    .map_err(|_| ())
}

pub fn validate(
    ghost: &ParsedGhost,
    context: &SubmissionContext<'_>,
    blocks: Option<&Value>,
    manifest: Option<&ValidationManifest>,
) -> ValidationReport {
    let prepared = blocks.map(|blocks| prepare_level(blocks, manifest));
    validate_prepared(ghost, context, prepared.as_ref(), manifest)
}

/// Server-owned level geometry, shared across records without ghost-specific state.
pub struct PreparedLevel {
    blocks: Value,
    graph: CheckpointGraph,
    csv_event_identity_unknown: bool,
    triggers: Vec<Trigger>,
    spawns: Vec<[f64; 3]>,
    geometry_complete: bool,
    geometry_reasons: Vec<String>,
    geometry_stop: bool,
    trigger_index: BTreeMap<(String, String, bool), usize>,
}
pub fn prepare_level(blocks: &Value, manifest: Option<&ValidationManifest>) -> PreparedLevel {
    let csv_event_identity_unknown = blocks
        .as_array()
        .and_then(|array| array.first())
        .is_some_and(|block| block.get("Id").is_some());
    let blocks = normalize_blocks(blocks);
    let graph = checkpoint_graph(&blocks);
    let mut triggers = vec![];
    let mut spawns = vec![];
    let mut geometry_complete = graph.reasons.is_empty() && !csv_event_identity_unknown;
    let mut report = ValidationReport::uncertain("");
    report.reasons.clear();
    let geometry_stop = if let Some(manifest) = manifest {
        (|| {
            let Some(raw_blocks) = blocks.as_array() else {
                report.uncertainty("unsupported_level_format");
                return true;
            };
            if raw_blocks.len() > MAX_BLOCKS {
                report.uncertainty("geometry_budget");
                return true;
            }

            let mut vertex_budget = 250_000;
            for block in raw_blocks {
                if block
                    .pointer("/d/n")
                    .and_then(Value::as_object)
                    .is_some_and(|n| {
                        n.iter().any(|(key, value)| {
                            key.starts_with("id")
                                && key != "id0"
                                && value.as_f64().is_some_and(|value| value > 0.)
                        })
                    })
                {
                    geometry_complete = false;
                    report.uncertainty("logic_controlled_trigger");
                }
                let id = block["i"].as_i64().unwrap_or(-1);
                let active = CHECKPOINT_IDS.contains(&id)
                    || GATE_IDS.contains(&id)
                        && block.pointer("/d/n/ch5").and_then(Value::as_f64) == Some(1.);
                if !active && !FINISH_IDS.contains(&id) && !START_IDS.contains(&id) {
                    continue;
                }
                let Some(def) = manifest.blocks.get(&id.to_string()) else {
                    geometry_complete = false;
                    report.uncertainty("unsupported_geometry");
                    continue;
                };
                if !def.unsupported.is_empty() {
                    geometry_complete = false;
                    report.uncertainty("dynamic_or_unsupported_trigger");
                }
                if START_IDS.contains(&id) {
                    for spawn in &def.spawns {
                        if let Some(spawn) = transform(*spawn, block) {
                            spawns.push(spawn);
                        }
                    }
                    continue;
                }
                let uid = block["u"].as_str().unwrap_or("");
                let mut included = 0;
                for collider in &def.colliders {
                    if !collider.convex {
                        geometry_complete = false;
                        report.uncertainty("nonconvex_trigger");
                        continue;
                    }
                    if !collider.attributes.iter().all(|key| {
                        block
                            .pointer("/d/n")
                            .and_then(|n| n.get(key))
                            .and_then(Value::as_f64)
                            == Some(1.)
                    }) {
                        continue;
                    }
                    included += 1;
                    if collider.vertices.len() > vertex_budget {
                        report.uncertainty("geometry_budget");
                        return true;
                    }
                    vertex_budget -= collider.vertices.len();
                    if collider.vertices.len() > 4096 {
                        geometry_complete = false;
                        report.uncertainty("geometry_budget");
                        continue;
                    }
                    let points: Option<Vec<_>> = collider
                        .vertices
                        .iter()
                        .map(|p| transform(*p, block).map(|p| Vector::new(p[0], p[1], p[2])))
                        .collect();
                    let Some(points) = points else {
                        geometry_complete = false;
                        report.uncertainty("invalid_transform");
                        continue;
                    };
                    let Some(hull) = ConvexPolyhedron::from_convex_hull(&points) else {
                        geometry_complete = false;
                        report.uncertainty("unsupported_geometry");
                        continue;
                    };
                    let mut min = [f64::INFINITY; 3];
                    let mut max = [f64::NEG_INFINITY; 3];
                    for p in &points {
                        for i in 0..3 {
                            min[i] = min[i].min(p[i]);
                            max[i] = max[i].max(p[i]);
                        }
                    }
                    triggers.push(Trigger {
                        uid: uid.into(),
                        shape: collider.shape.clone(),
                        hull,
                        min,
                        max,
                        finish: FINISH_IDS.contains(&id),
                    });
                }
                if included == 0 {
                    geometry_complete = false;
                    report.uncertainty("unsupported_shape");
                }
            }
            triggers.sort_by(|a, b| a.min[0].total_cmp(&b.min[0]));
            false
        })()
    } else {
        false
    };
    let trigger_index = triggers
        .iter()
        .enumerate()
        .map(|(index, t)| ((t.uid.clone(), t.shape.clone(), t.finish), index))
        .collect();
    PreparedLevel {
        blocks,
        graph,
        csv_event_identity_unknown,
        triggers,
        spawns,
        geometry_complete,
        geometry_reasons: report.reasons,
        geometry_stop,
        trigger_index,
    }
}
pub fn validate_prepared(
    ghost: &ParsedGhost,
    context: &SubmissionContext<'_>,
    prepared: Option<&PreparedLevel>,
    manifest: Option<&ValidationManifest>,
) -> ValidationReport {
    let mut report = ValidationReport {
        comparison: false,
        status: "pass".into(),
        reasons: vec![],
        matched_groups: vec![],
        missing_groups: vec![],
        validator_version: VALIDATOR_VERSION.into(),
    };
    if ghost
        .metadata
        .steam_id
        .as_deref()
        .filter(|id| !((1..=7).contains(&ghost.version) && (id.trim().is_empty() || *id == "0")))
        .is_some_and(|id| id != context.steam_id)
    {
        report.fail("wrong_steam_id");
    }
    validate_checkpoint_telemetry(ghost, context, None, &mut report);
    if ghost
        .frames
        .windows(2)
        .any(|pair| pair[1].time < pair[0].time)
    {
        report.fail("nonmonotonic_samples");
    }
    let evidence = ghost.evidence.as_ref();
    if let Some(e) = evidence {
        if e.sphere_sampling_version != 3 {
            report.uncertainty("unsupported_trigger_sphere_sampling");
        }
        if ghost.frames.iter().any(|frame| frame.ragdoll == Some(true))
            && e.sphere_sampling_version != 3
        {
            report.uncertainty("unsupported_ragdoll_sphere_sampling");
        }
        if !e
            .canonical_hash
            .eq_ignore_ascii_case(context.canonical_hash)
        {
            report.fail("wrong_level_identity");
        }
        // Level UIDs and legacy submission identities are builder-controlled aliases.
        // Only canonical block xxHash identifies the version used for validation.
        if uuid::Uuid::parse_str(&e.run_uuid).is_err() {
            report.fail("invalid_run_uuid");
        }
        if !e.initial_time.is_finite()
            || e.initial_time < 0.
            || !e.physics_interval.is_finite()
            || e.physics_interval <= 0.
            || e.physics_interval > 0.1
            || e.samples.iter().any(|s| !finite_sample(s))
            || e.events.iter().any(|event| {
                !finite_sample(&event.sample)
                    || !event.raw_time.is_finite()
                    || !event.adjusted_time.is_finite()
                    || !event.velocity_kmh.is_finite()
                    || event.velocity_kmh < 0.
                    || (event.sample.time - event.raw_time).abs() > 0.001
                    || (event.raw_time - event.adjusted_time).abs() > 0.25001
            })
        {
            report.fail("invalid_run_evidence");
            return report;
        }
    }
    let Some(prepared) = prepared else {
        report.uncertainty("missing_snapshot");
        return report;
    };
    let blocks = &prepared.blocks;
    if blocks
        .as_array()
        .is_some_and(|array| array.len() > MAX_BLOCKS)
    {
        report.uncertainty("geometry_budget");
        return report;
    }
    let csv_event_identity_unknown = prepared.csv_event_identity_unknown;
    if csv_event_identity_unknown {
        report.uncertainty("csv_event_identity_unknown");
    }
    let graph = &prepared.graph;
    for reason in &graph.reasons {
        report.uncertainty(reason);
    }
    if (1..=7).contains(&ghost.version) && graph.reasons.is_empty() {
        // Counting does not require collider exports. Malformed links cannot prove a count.
        validate_checkpoint_telemetry(ghost, context, Some(graph.groups.len()), &mut report);
    }
    let Some(manifest) = manifest else {
        report.uncertainty("missing_validation_manifest");
        return report;
    };
    // Game release labels are provenance only. Validate manifest format and geometry capabilities.
    if manifest.version != 1 {
        report.uncertainty("unsupported_manifest_version");
        return report;
    }
    if !manifest.calibrated {
        report.uncertainty("uncalibrated_profile");
    }
    if !manifest.physics_interval.is_finite()
        || manifest.physics_interval <= 0.
        || manifest.physics_interval > 0.1
        || !manifest.sphere_radius.is_finite()
        || manifest.sphere_radius <= 0.
        || manifest
            .ragdoll_sphere_radius
            .is_some_and(|radius| !radius.is_finite() || radius <= 0.)
        || !manifest.position_tolerance.is_finite()
        || manifest.position_tolerance < 0.
        || !manifest.spawn_tolerance.is_finite()
        || manifest.spawn_tolerance < 0.
    {
        report.uncertainty("invalid_profile");
        return report;
    }
    let legacy = evidence.is_none();
    let legacy_evidence = evidence.is_none().then(|| RunEvidence {
        sphere_sampling_version: 0,
        run_uuid: String::new(),
        level_uid: String::new(),
        submission_level: String::new(),
        canonical_hash: String::new(),
        initial_time: ghost.frames.first().map_or(0., |f| f.time),
        physics_interval: manifest.physics_interval,
        samples: ghost
            .frames
            .iter()
            .map(|f| SphereSample {
                time: f.time,
                position: [f.position.x, f.position.y, f.position.z],
                radius: manifest.sphere_radius,
            })
            .collect(),
        events: vec![],
    });
    let e = evidence
        .or(legacy_evidence.as_ref())
        .expect("legacy evidence initialized");
    if legacy {
        report.uncertainty("legacy_collider_uncertainty");
    }
    if e.samples.len() < 2
        || e.samples.len() > crate::ghosts::MAX_GHOST_FRAMES
        || e.events.len() > MAX_BLOCKS + 1
    {
        report.uncertainty("incomplete_samples");
        return report;
    }
    // Select server-owned radius by visual physics state; never trust client radii as tolerances.
    let trusted_radius = |time: f64| {
        let index = ghost.frames.partition_point(|frame| frame.time <= time);
        if index > 0 && ghost.frames[index - 1].ragdoll == Some(true) {
            manifest
                .ragdoll_sphere_radius
                .unwrap_or(manifest.sphere_radius)
        } else {
            manifest.sphere_radius
        }
    };
    let complete = e.samples[0].time == e.initial_time
        && (e.physics_interval - manifest.physics_interval).abs() < 0.00001
        && e.samples.windows(2).all(|p| {
            p[1].time >= p[0].time
                && p[1].time - p[0].time
                    <= if legacy {
                        e.physics_interval * 2.5 + 0.001
                    } else {
                        e.physics_interval * 1.5
                    }
        })
        && e.samples
            .iter()
            .all(|s| (s.radius - trusted_radius(s.time)).abs() <= manifest.position_tolerance);
    if !complete {
        report.uncertainty("incomplete_samples");
    }
    for reason in &prepared.geometry_reasons {
        report.uncertainty(reason);
    }
    if prepared.geometry_stop {
        return report;
    }
    let triggers = &prepared.triggers;
    let spawns = &prepared.spawns;
    let geometry_complete = prepared.geometry_complete;
    let trigger_index = &prepared.trigger_index;
    // A callback contradicting the exported hull can indicate changed trigger geometry.
    // Do not turn that disagreement into a proven absence using the same hull.
    let event_geometry_matches = !legacy
        && !csv_event_identity_unknown
        && e.events.iter().all(|event| {
            trigger_index
                .get(&(event.block_uid.clone(), event.shape.clone(), event.finish))
                .map(|index| &triggers[*index])
                .is_some_and(|trigger| {
                    contact(
                        trigger,
                        &event.sample,
                        &event.sample,
                        trusted_radius(event.sample.time) + manifest.position_tolerance,
                    ) == Ok(true)
                })
        });
    let finish_samples_complete = e.events.iter().filter(|event| event.finish).count() == 1
        && e.events
            .iter()
            .find(|event| event.finish)
            .is_some_and(|event| {
                e.samples.last().is_some_and(|sample| {
                    (sample.time - event.raw_time).abs() <= e.physics_interval * 1.5
                })
            });
    let sphere_sampling_supported = e.sphere_sampling_version == 3;
    let proven = complete
        && finish_samples_complete
        && geometry_complete
        && manifest.calibrated
        && !legacy
        && sphere_sampling_supported
        && event_geometry_matches;
    let miss = |report: &mut ValidationReport, reason: &str| {
        if proven {
            report.fail(reason)
        } else {
            report.uncertainty(reason)
        }
    };
    if spawns.is_empty() {
        report.uncertainty("missing_spawn_geometry");
    } else if !spawns.iter().any(|p| {
        p.iter()
            .zip(e.samples[0].position)
            .map(|(x, y)| (x - y).powi(2))
            .sum::<f64>()
            <= manifest.spawn_tolerance.powi(2)
    }) {
        miss(&mut report, "wrong_start");
    }
    let finishes: Vec<_> = e.events.iter().filter(|v| v.finish).collect();
    let legacy_finish = TriggerEvent {
        block_uid: String::new(),
        shape: String::new(),
        finish: true,
        raw_time: e.samples.last().map_or(0., |s| s.time),
        adjusted_time: context.time,
        velocity_kmh: 0.,
        sample: e.samples.last().cloned().unwrap_or(SphereSample {
            time: 0.,
            position: [0.; 3],
            radius: manifest.sphere_radius,
        }),
    };
    if !legacy && finishes.len() != 1 {
        miss(&mut report, "missing_finish_event");
        return report;
    }
    let finish = if legacy { &legacy_finish } else { finishes[0] };
    if (finish.adjusted_time - context.time).abs() > 0.001 {
        report.fail("wrong_finish_time");
    }
    if e.samples
        .last()
        .is_none_or(|s| (s.time - finish.raw_time).abs() > e.physics_interval * 1.5)
    {
        report.uncertainty("missing_finish_sample");
    }
    // Legacy car-root positions need a broad envelope for head offset and cumulative rounding.
    // Ragdoll centers are unbounded relative to TopSphereMan; never prove absence from them.
    let radius_margin = manifest.position_tolerance
        + if legacy {
            2.0 + ghost.frames.len() as f64 * 0.00001
        } else {
            0.
        };
    let mut work = e.events.len();
    let mut hits = BTreeSet::new();
    let mut finish_hit = false;
    for pair in e.samples.windows(2) {
        if pair[0].time > finish.raw_time {
            break;
        }
        let radius = trusted_radius(pair[0].time).max(trusted_radius(pair[1].time)) + radius_margin;
        let max_x = pair[0].position[0].max(pair[1].position[0]) + radius;
        let bound = triggers.partition_point(|trigger| trigger.min[0] <= max_x);
        for trigger in &triggers[..bound] {
            work += 1;
            if work > MAX_QUERY_WORK {
                report.uncertainty("geometry_budget");
                return report;
            }
            let mut end = pair[1].clone();
            if end.time > finish.raw_time && end.time > pair[0].time {
                let fraction = (finish.raw_time - pair[0].time) / (end.time - pair[0].time);
                for i in 0..3 {
                    end.position[i] =
                        pair[0].position[i] + (end.position[i] - pair[0].position[i]) * fraction;
                }
                end.time = finish.raw_time;
            }
            match contact(trigger, &pair[0], &end, radius) {
                Ok(true) => {
                    if !trigger.finish {
                        hits.insert(trigger.uid.clone());
                    }
                }
                Ok(false) => {}
                Err(()) => {
                    report.uncertainty("unsupported_geometry");
                    return report;
                }
            }
        }
    }
    for trigger in triggers.iter().filter(|t| t.finish) {
        let radius = trusted_radius(finish.sample.time) + radius_margin;
        if contact(trigger, &finish.sample, &finish.sample, radius) == Ok(true) {
            finish_hit = true;
        }
    }
    for event in &e.events {
        let radius = trusted_radius(event.sample.time) + radius_margin;
        if event.raw_time > finish.raw_time {
            miss(&mut report, "event_after_finish");
        }
        let event_contact = if csv_event_identity_unknown {
            // CSV lacks persisted UIDs. Test geometric compatibility without inventing identity.
            let bound = triggers
                .partition_point(|trigger| trigger.min[0] <= event.sample.position[0] + radius);
            let mut found = false;
            for trigger in &triggers[..bound] {
                work += 1;
                if work > MAX_QUERY_WORK {
                    report.uncertainty("geometry_budget");
                    return report;
                }
                if trigger.finish == event.finish
                    && trigger.shape == event.shape
                    && contact(trigger, &event.sample, &event.sample, radius) == Ok(true)
                {
                    found = true;
                    break;
                }
            }
            found
        } else {
            trigger_index
                .get(&(event.block_uid.clone(), event.shape.clone(), event.finish))
                .map(|index| &triggers[*index])
                .is_some_and(|trigger| {
                    contact(trigger, &event.sample, &event.sample, radius) == Ok(true)
                })
        };
        if !event_contact {
            miss(&mut report, "event_geometry_mismatch");
        }
        let sample_index = e
            .samples
            .partition_point(|sample| sample.time < event.raw_time);
        let on_trajectory = e.samples
            [sample_index.saturating_sub(2)..(sample_index + 2).min(e.samples.len())]
            .windows(2)
            .any(|pair| {
                if event.raw_time < pair[0].time - e.physics_interval
                    || event.raw_time > pair[1].time + e.physics_interval
                {
                    return false;
                }
                let start = Vector::new(
                    pair[0].position[0],
                    pair[0].position[1],
                    pair[0].position[2],
                );
                let end = Vector::new(
                    pair[1].position[0],
                    pair[1].position[1],
                    pair[1].position[2],
                );
                let point = Vector::new(
                    event.sample.position[0],
                    event.sample.position[1],
                    event.sample.position[2],
                );
                let delta = end - start;
                let fraction = if delta.length_squared() > 0. {
                    ((point - start).dot(delta) / delta.length_squared()).clamp(0., 1.)
                } else {
                    0.
                };
                (point - (start + delta * fraction)).length() <= manifest.position_tolerance + 0.001
            });
        if !on_trajectory {
            miss(&mut report, "event_trajectory_mismatch");
        }
    }
    if !legacy {
        let checkpoint_events: Vec<_> = e.events.iter().filter(|event| !event.finish).collect();
        if checkpoint_events.len() != context.splits.len() {
            report.fail("event_split_count_mismatch");
        }
        for ((event, split), speed) in checkpoint_events
            .iter()
            .zip(context.splits)
            .zip(context.speeds)
        {
            if (event.adjusted_time - f64::from(*split)).abs() > 0.001
                || (event.velocity_kmh - f64::from(*speed)).abs() > 0.001
            {
                report.fail("event_split_values_mismatch");
            }
        }
    }
    if !finish_hit {
        if legacy {
            report.uncertainty("missing_finish_contact");
        } else {
            miss(&mut report, "missing_finish_contact");
        }
    }
    let event_groups: BTreeMap<_, _> = graph
        .groups
        .iter()
        .enumerate()
        .flat_map(|(index, group)| group.iter().map(move |uid| (uid.as_str(), index)))
        .collect();
    let mut accepted_groups = BTreeSet::new();
    if !legacy && !csv_event_identity_unknown {
        for event in e.events.iter().filter(|event| !event.finish) {
            if let Some(group) = event_groups.get(event.block_uid.as_str()) {
                if !accepted_groups.insert(*group) {
                    miss(&mut report, "duplicate_checkpoint_group_event");
                }
            } else {
                miss(&mut report, "unknown_checkpoint_group_event");
            }
        }
        if accepted_groups.len() != graph.groups.len() {
            miss(&mut report, "missing_checkpoint_group_event");
        }
    }
    for group in &graph.groups {
        if group.iter().any(|uid| hits.contains(uid)) {
            report.matched_groups.push(group.clone());
        } else {
            report.missing_groups.push(group.clone());
        }
    }
    if !report.missing_groups.is_empty() {
        if legacy {
            // Legacy positions use the expanded car-root envelope above. Accept a geometric
            // absence only after the whole run reaches a known finish without sampling gaps.
            // Ragdolls can move the head independently from the recorded car position.
            let continuous_run = complete
                && e.samples.first().is_some_and(|s| s.time <= 0.1)
                && e.samples
                    .last()
                    .is_some_and(|s| (s.time - context.time).abs() <= 0.25)
                && e.samples.iter().all(finite_sample)
                && e.samples.windows(2).all(|pair| {
                    let gap = pair[1].time - pair[0].time;
                    gap > 0. && gap <= manifest.physics_interval * 2.5 + 0.001
                });
            if continuous_run
                && geometry_complete
                && finish_hit
                && !ghost.frames.iter().any(|frame| frame.ragdoll == Some(true))
            {
                report.fail("missing_checkpoint_groups");
            } else {
                report.uncertainty("missing_checkpoint_groups");
            }
        } else {
            miss(&mut report, "missing_checkpoint_groups");
        }
    }
    if !(1..=7).contains(&ghost.version)
        && context.splits.len() != report.matched_groups.len() + report.missing_groups.len()
    {
        miss(&mut report, "wrong_split_count");
    }
    report
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn block(uid: &str, active: bool, targets: &[&str]) -> Value {
        let mut b = json!({"i":1607,"u":uid,"d":{"n":{"ch5":if active{1}else{0},"id0":targets.len()},"t":{}}});
        for (i, target) in targets.iter().enumerate() {
            b["d"]["t"][format!("id0-{i}")] =
                json!(json!({"t":target,"c":0,"a":false}).to_string());
        }
        b
    }
    #[test]
    fn independent_components_and_inactive_bridges() {
        let blocks = json!([
            block("a", true, &["b"]),
            block("b", false, &["c"]),
            block("c", true, &[]),
            block("d", true, &["e"]),
            block("e", true, &["d"])
        ]);
        let g = checkpoint_graph(&blocks);
        assert!(g.reasons.is_empty());
        assert_eq!(g.groups, vec![vec!["a", "c"], vec!["d", "e"]]);
    }
    #[test]
    fn stale_entries_do_not_link() {
        let mut b = block("a", true, &[]);
        b["d"]["t"]["id0-0"] = json!("invalid");
        let g = checkpoint_graph(&json!([b, block("b", true, &[])]));
        assert_eq!(g.groups.len(), 2);
        assert!(g.reasons.is_empty());
    }
    #[test]
    fn missing_target_is_uncertain() {
        assert_eq!(
            checkpoint_graph(&json!([block("a", true, &["missing"])])).reasons,
            vec!["missing_link_target"]
        );
    }
    #[test]
    fn large_linked_cycle_has_one_required_component() {
        let names: Vec<_> = (0..500)
            .map(|index| format!("checkpoint-{index}"))
            .collect();
        let blocks: Vec<_> = names
            .iter()
            .enumerate()
            .map(|(index, name)| block(name, true, &[&names[(index + 1) % names.len()]]))
            .collect();
        let graph = checkpoint_graph(&json!(blocks));
        assert!(graph.reasons.is_empty());
        assert_eq!(graph.groups.len(), 1);
        assert_eq!(graph.groups[0].len(), 500);
    }
    #[test]
    fn malformed_counted_link_stays_uncertain() {
        let mut checkpoint = block("checkpoint", true, &["target"]);
        checkpoint["d"]["t"]["id0-0"] = json!("not json");
        let graph = checkpoint_graph(&json!([checkpoint]));
        assert!(!graph.reasons.is_empty());
    }
    #[test]
    fn unity_transform_preserves_negative_scale() {
        let p = transform(
            [1., 0., 0.],
            &json!({"p":{"x":10},"r":{"y":90},"s":{"x":-2}}),
        )
        .unwrap();
        assert!((p[0] - 10.).abs() < 1e-9);
        assert!((p[2] - 2.).abs() < 1e-9);
    }

    #[test]
    fn sphere_edge_contact_and_fast_crossing_use_narrow_geometry() {
        let vertices: Vec<_> = (0..8)
            .map(|n| {
                Vector::new(
                    if n & 1 == 0 { -0.01 } else { 0.01 },
                    if n & 2 == 0 { -2. } else { 2. },
                    if n & 4 == 0 { -2. } else { 2. },
                )
            })
            .collect();
        let trigger = Trigger {
            uid: "checkpoint".into(),
            shape: "thin".into(),
            hull: ConvexPolyhedron::from_convex_hull(&vertices).unwrap(),
            min: [-0.01, -2., -2.],
            max: [0.01, 2., 2.],
            finish: false,
        };
        let sample = |position| SphereSample {
            time: 0.,
            position,
            radius: 0.9,
        };
        assert_eq!(
            contact(
                &trigger,
                &sample([-10., 0., 0.]),
                &sample([10., 0., 0.]),
                0.9
            ),
            Ok(true)
        );
        assert_eq!(
            contact(
                &trigger,
                &sample([0., 2.89, 0.]),
                &sample([0., 2.89, 0.]),
                0.9
            ),
            Ok(true)
        );
        assert_eq!(
            contact(
                &trigger,
                &sample([0., 2.91, 0.]),
                &sample([0., 2.91, 0.]),
                0.9
            ),
            Ok(false)
        );
    }
}
