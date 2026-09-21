//! Read-only Drizzle history validation. Does not adopt or alter migration ledgers.
use anyhow::{Context, Result, ensure};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{collections::HashSet, path::Path};

#[derive(Deserialize)]
struct Journal {
    dialect: String,
    entries: Vec<Entry>,
}
#[derive(Deserialize)]
struct Entry {
    idx: u64,
    when: i64,
    tag: String,
}
#[derive(Debug, Serialize)]
pub struct HistoricalMigration {
    pub index: u64,
    pub timestamp: i64,
    pub tag: String,
    pub sha256: String,
    pub statements: usize,
}

impl HistoricalMigration {
    pub fn drizzle_hash(&self) -> &str {
        &self.sha256
    }
}

pub fn inspect(folder: &Path) -> Result<Vec<HistoricalMigration>> {
    let journal: Journal =
        serde_json::from_slice(&std::fs::read(folder.join("meta/_journal.json"))?)?;
    ensure!(
        journal.dialect == "postgresql",
        "Expected PostgreSQL migration history"
    );
    let mut tags = HashSet::new();
    let mut previous = None;
    let mut result = Vec::new();
    for entry in journal.entries {
        ensure!(
            !entry.tag.is_empty()
                && entry
                    .tag
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'_'),
            "Invalid migration tag"
        );
        ensure!(tags.insert(entry.tag.clone()), "Duplicate migration tag");
        if let Some((index, timestamp)) = previous {
            ensure!(
                entry.idx > index && entry.when > timestamp,
                "Migration order is not increasing"
            );
        }
        let bytes = std::fs::read(folder.join(format!("{}.sql", entry.tag)))
            .context("Missing historical migration")?;
        let sql = std::str::from_utf8(&bytes).context("Historical SQL must be UTF-8")?;
        result.push(HistoricalMigration {
            index: entry.idx,
            timestamp: entry.when,
            tag: entry.tag,
            sha256: format!("{:x}", Sha256::digest(&bytes)),
            statements: sql.split("--> statement-breakpoint").count(),
        });
        previous = Some((entry.idx, entry.when));
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn current_history_is_ordered_and_complete() -> Result<()> {
        let folder = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../packages/database/drizzle");
        let history = inspect(&folder)?;
        ensure!(!history.is_empty(), "Missing migration history");
        ensure!(
            history
                .iter()
                .all(|entry| entry.sha256.len() == 64 && entry.statements > 0),
            "Invalid history fingerprints"
        );
        Ok(())
    }
}
