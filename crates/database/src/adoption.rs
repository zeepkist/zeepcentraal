//! In-place adoption of the existing Drizzle ledger by Diesel.
//!
//! This module never replays historical SQL against an adopted database. It verifies
//! every Drizzle hash/timestamp before creating Diesel's metadata table and baseline row.

use crate::history::{HistoricalMigration, inspect};
use anyhow::{Context, Result, ensure};
use diesel::{
    QueryableByName, sql_query,
    sql_types::{BigInt, Text},
};
use diesel_async::{AsyncConnection, AsyncPgConnection, RunQueryDsl};
use serde::Deserialize;
use std::path::Path;

pub const BASELINE_VERSION: &str = "20260919000000";
const MIGRATION_LOCK_ID: i64 = 8_624_390_086;

#[derive(Debug, QueryableByName)]
struct DrizzleLedgerRow {
    #[diesel(sql_type = Text)]
    hash: String,
    #[diesel(sql_type = BigInt)]
    created_at: i64,
}

#[derive(Debug, QueryableByName)]
struct DieselVersionRow {
    #[diesel(sql_type = Text)]
    version: String,
}

#[derive(Deserialize)]
struct FrozenLedger {
    entries: Vec<FrozenLedgerRow>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FrozenLedgerRow {
    tag: String,
    hash: String,
    created_at: i64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Mode {
    Verify,
    Adopt,
}

#[derive(Debug, Eq, PartialEq)]
pub struct AdoptionReport {
    pub drizzle_migrations: usize,
    pub baseline_created: bool,
    pub baseline_version: &'static str,
}

pub async fn run(
    database_url: &str,
    migrations_folder: &Path,
    mode: Mode,
) -> Result<AdoptionReport> {
    let expected = inspect(migrations_folder)?;
    ensure!(
        expected
            .last()
            .is_some_and(|migration| migration.tag.starts_with("0086_")),
        "Drizzle history must end at frozen migration 0086"
    );
    ensure!(
        expected.len() == 86,
        "Expected exactly 86 Drizzle migrations"
    );
    let frozen: FrozenLedger = serde_json::from_str(include_str!("../drizzle-ledger.json"))?;
    verify_frozen_history(&expected, &frozen.entries)?;

    let mut connection = AsyncPgConnection::establish(database_url)
        .await
        .context("Failed to connect to PostgreSQL")?;
    sql_query(format!("SELECT pg_advisory_lock({MIGRATION_LOCK_ID})"))
        .execute(&mut connection)
        .await
        .context("Failed to acquire migration advisory lock")?;

    let outcome = adopt_locked(&mut connection, &frozen.entries, mode).await;
    let unlock = sql_query(format!("SELECT pg_advisory_unlock({MIGRATION_LOCK_ID})"))
        .execute(&mut connection)
        .await;
    if outcome.is_ok() {
        unlock.context("Failed to release migration advisory lock")?;
    }
    outcome
}

async fn adopt_locked(
    connection: &mut AsyncPgConnection,
    expected: &[FrozenLedgerRow],
    mode: Mode,
) -> Result<AdoptionReport> {
    let actual: Vec<DrizzleLedgerRow> = sql_query(
        "SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at, id",
    )
    .load(connection)
    .await
    .context("Existing Drizzle migration ledger is missing or unreadable")?;
    verify_ledger(expected, &actual)?;
    crate::catalog::verify(connection).await?;

    let mut baseline_created = false;
    if mode == Mode::Adopt {
        baseline_created = connection
            .transaction::<bool, anyhow::Error, _>(|connection| {
                Box::pin(async move {
                    sql_query(
                        "CREATE TABLE IF NOT EXISTS __diesel_schema_migrations (\
                         version VARCHAR(50) PRIMARY KEY NOT NULL, \
                         run_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)",
                    )
                    .execute(connection)
                    .await?;
                    let versions: Vec<DieselVersionRow> = sql_query(
                        "SELECT version FROM __diesel_schema_migrations ORDER BY version",
                    )
                    .load(connection)
                    .await?;
                    if versions.iter().any(|row| row.version == BASELINE_VERSION) {
                        return Ok(false);
                    }
                    ensure!(
                        versions.is_empty(),
                        "Diesel migrations exist without Drizzle baseline; refusing adoption"
                    );
                    sql_query("INSERT INTO __diesel_schema_migrations(version) VALUES ($1)")
                        .bind::<Text, _>(BASELINE_VERSION)
                        .execute(connection)
                        .await?;
                    Ok(true)
                })
            })
            .await?;
    }

    Ok(AdoptionReport {
        drizzle_migrations: actual.len(),
        baseline_created,
        baseline_version: BASELINE_VERSION,
    })
}

fn verify_frozen_history(
    history: &[HistoricalMigration],
    frozen: &[FrozenLedgerRow],
) -> Result<()> {
    ensure!(
        frozen.len() == history.len() + 1,
        "Frozen ledger must contain one legacy prefix and all repository migrations"
    );
    ensure!(
        frozen
            .first()
            .is_some_and(|entry| entry.tag == "legacy_initial"),
        "Frozen ledger legacy prefix is missing"
    );
    for (migration, entry) in history.iter().zip(&frozen[1..]) {
        ensure!(
            migration.tag == entry.tag && migration.timestamp == entry.created_at,
            "Frozen ledger differs from Drizzle journal at {}",
            migration.tag
        );
    }
    Ok(())
}

fn verify_ledger(expected: &[FrozenLedgerRow], actual: &[DrizzleLedgerRow]) -> Result<()> {
    ensure!(
        actual.len() == expected.len(),
        "Drizzle ledger has {} entries; expected {}",
        actual.len(),
        expected.len()
    );
    for (index, (expected, actual)) in expected.iter().zip(actual).enumerate() {
        ensure!(
            actual.hash.eq_ignore_ascii_case(&expected.hash),
            "Drizzle migration {} hash differs from repository history",
            index + 1
        );
        ensure!(
            actual.created_at == expected.created_at,
            "Drizzle migration {} timestamp differs from repository history",
            index + 1
        );
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ledger(tag: &str, timestamp: i64, hash: &str) -> FrozenLedgerRow {
        FrozenLedgerRow {
            tag: tag.to_owned(),
            created_at: timestamp,
            hash: hash.to_owned(),
        }
    }

    #[test]
    fn ledger_requires_exact_order_hashes_and_timestamps() {
        let expected = vec![ledger("one", 10, "aa"), ledger("two", 20, "bb")];
        let actual = vec![
            DrizzleLedgerRow {
                hash: "AA".into(),
                created_at: 10,
            },
            DrizzleLedgerRow {
                hash: "bb".into(),
                created_at: 20,
            },
        ];
        assert!(verify_ledger(&expected, &actual).is_ok());
        let wrong = vec![
            DrizzleLedgerRow {
                hash: "aa".into(),
                created_at: 10,
            },
            DrizzleLedgerRow {
                hash: "cc".into(),
                created_at: 20,
            },
        ];
        assert!(verify_ledger(&expected, &wrong).is_err());
    }
}
