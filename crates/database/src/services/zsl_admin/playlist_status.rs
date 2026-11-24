use anyhow::Result;
use diesel::{
    QueryableByName, sql_query,
    sql_types::{Jsonb, Nullable, Text},
};
use diesel_async::{AsyncPgConnection, RunQueryDsl};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::{HashMap, HashSet};
use zc_core::practice::{PracticeLevel, PracticePlaylist};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManifestLevel {
    level: PracticeLevel,
    xx_hash: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LevelRow {
    position: usize,
    name: String,
    workshop_id: String,
    uid: String,
    state: &'static str,
    stage: String,
    #[serde(skip)]
    canonical_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    xx_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    image_url: Option<String>,
}

impl LevelRow {
    fn identity(&self) -> (&str, &str) {
        (&self.workshop_id, &self.uid)
    }
}

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
struct PlaylistRows {
    levels: Vec<LevelRow>,
    verified_levels: Vec<LevelRow>,
    pending_candidates: Vec<LevelRow>,
    rejected_candidates: Vec<LevelRow>,
    playlist_errors: Vec<String>,
}

impl PlaylistRows {
    fn all_levels(&mut self) -> impl Iterator<Item = &mut LevelRow> {
        self.levels
            .iter_mut()
            .chain(&mut self.verified_levels)
            .chain(&mut self.pending_candidates)
            .chain(&mut self.rejected_candidates)
    }
}

fn manifest(value: Value) -> Vec<ManifestLevel> {
    serde_json::from_value(value).unwrap_or_default()
}

fn diagnostic_identity(value: &Value) -> Option<(&str, &str)> {
    Some((value["workshopId"].as_str()?, value["uid"].as_str()?))
}

fn row_status(state: &str, diagnostic: Option<&Value>) -> (&'static str, String) {
    let (diagnostic_state, stage) = diagnostic
        .map(|row| (row["state"].as_str(), row["stage"].as_str()))
        .unwrap_or_default();
    let (status, step) = match (state, diagnostic_state) {
        (_, Some("failed")) => ("failed", stage.unwrap_or("Level preparation failed")),
        ("verified", _) => ("ready", "Payload verified by host"),
        ("failed", _) => ("pending", "Awaits verification after retry"),
        ("prepared", _) | (_, Some("prepared")) => {
            ("pending", "Payload uploaded. Awaiting host verification")
        }
        ("queued", _) => ("pending", "Queued for preparation"),
        _ => ("pending", stage.unwrap_or("Preparing playlist")),
    };
    (status, step.to_owned())
}

fn level_rows(
    entries: Vec<ManifestLevel>,
    state: &str,
    diagnostics: &HashMap<(&str, &str), &Value>,
) -> Vec<LevelRow> {
    entries
        .into_iter()
        .enumerate()
        .map(|(index, entry)| {
            let workshop_id = entry.level.workshop_id.to_string();
            let diagnostic = diagnostics
                .get(&(workshop_id.as_str(), &entry.level.uid))
                .copied();
            let (state, stage) = row_status(state, diagnostic);
            LevelRow {
                position: index + 1,
                name: entry.level.name,
                workshop_id,
                uid: entry.level.uid,
                state,
                stage,
                canonical_hash: entry.xx_hash.or_else(|| {
                    diagnostic.and_then(|row| row["xxHash"].as_str().map(str::to_owned))
                }),
                xx_hash: None,
                image_url: None,
            }
        })
        .collect()
}

fn normalize(revision: &mut Value) -> PlaylistRows {
    let source = revision["source"].take();
    let mut entries = manifest(revision["manifest"].take());
    let previous = manifest(revision["verifiedManifest"].take());
    let state = revision["state"].as_str().unwrap_or_default();
    let mut diagnostics = HashMap::new();
    let mut rows = PlaylistRows::default();
    if let Some(entries) = revision["diagnostics"].as_array() {
        for entry in entries {
            if let Some(identity) = diagnostic_identity(entry) {
                diagnostics.insert(identity, entry);
            } else if entry["state"] == "failed"
                && let Some(stage) = entry["stage"].as_str()
                && !rows.playlist_errors.iter().any(|error| error == stage)
            {
                rows.playlist_errors.push(stage.to_owned());
            }
        }
    }

    let warmup = revision["kind"] == "warmup";
    let has_manifest = !entries.is_empty();
    if entries.is_empty()
        && let Some(source) = source.as_str()
        && let Ok(playlist) = PracticePlaylist::parse(source.as_bytes())
    {
        entries = playlist
            .levels
            .into_iter()
            .map(|level| ManifestLevel {
                level,
                xx_hash: None,
            })
            .collect();
    }
    rows.levels = level_rows(entries, state, &diagnostics);
    rows.verified_levels = level_rows(previous, "verified", &HashMap::new());
    if warmup {
        let selected = rows
            .levels
            .iter()
            .map(LevelRow::identity)
            .collect::<HashSet<_>>();
        let mut candidates = diagnostics
            .into_iter()
            .filter_map(|((workshop_id, uid), entry)| {
                if selected.contains(&(workshop_id, uid)) {
                    return None;
                }
                let candidate_state = if state == "failed" {
                    "failed"
                } else {
                    "preparing"
                };
                let (state, stage) = row_status(candidate_state, Some(entry));
                Some((
                    entry["state"].as_str(),
                    LevelRow {
                        position: usize::try_from(entry["position"].as_u64()?).ok()?,
                        name: entry["name"].as_str()?.to_owned(),
                        workshop_id: workshop_id.to_owned(),
                        uid: uid.to_owned(),
                        state,
                        stage,
                        canonical_hash: entry["xxHash"].as_str().map(str::to_owned),
                        xx_hash: None,
                        image_url: None,
                    },
                ))
            })
            .collect::<Vec<_>>();
        candidates.sort_by(|(_, a), (_, b)| {
            (a.position, &a.workshop_id, &a.uid).cmp(&(b.position, &b.workshop_id, &b.uid))
        });
        for (diagnostic_state, mut row) in candidates {
            match diagnostic_state {
                Some("failed") => rows.rejected_candidates.push(row),
                Some("prepared") if !has_manifest => {
                    row.position = rows.levels.len() + 1;
                    rows.levels.push(row);
                }
                Some("pending") => rows.pending_candidates.push(row),
                _ => {}
            }
        }
    }
    rows
}

#[derive(QueryableByName)]
struct LevelLink {
    #[diesel(sql_type = Nullable<Text>)]
    xx_hash: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    image_url: Option<String>,
}

pub(super) async fn add_level_rows(
    connection: &mut AsyncPgConnection,
    status: &mut Value,
) -> Result<()> {
    let Some(revisions) = status["playlists"].as_array_mut() else {
        return Ok(());
    };
    let mut rows = revisions.iter_mut().map(normalize).collect::<Vec<_>>();
    let levels = rows
        .iter_mut()
        .flat_map(PlaylistRows::all_levels)
        .collect::<Vec<_>>();
    if !levels.is_empty() {
        let inputs = levels
            .iter()
            .enumerate()
            .map(|(position, row)| {
                json!({"position": position, "workshop_id": row.workshop_id.parse::<i64>().ok(),
                "uid": row.uid, "canonical_hash": row.canonical_hash})
            })
            .collect::<Vec<_>>();
        let links = sql_query(include_str!(
            "../../queries/zsl_admin/playlist_level_links.sql"
        ))
        .bind::<Jsonb, _>(json!(inputs))
        .load::<LevelLink>(connection)
        .await?;
        for (row, link) in levels.into_iter().zip(links) {
            row.xx_hash = link.xx_hash;
            row.image_url = link.image_url;
        }
    }
    for (revision, rows) in revisions.iter_mut().zip(rows) {
        let revision = revision.as_object_mut().expect("playlist status object");
        for key in ["source", "manifest", "verifiedManifest"] {
            revision.remove(key);
        }
        let Value::Object(mut fields) = serde_json::to_value(rows)? else {
            unreachable!("playlist rows serialize as an object");
        };
        if revision["state"] == "verified" {
            fields.insert("verifiedLevels".to_owned(), fields["levels"].clone());
        }
        revision.extend(fields);
    }
    Ok(())
}
