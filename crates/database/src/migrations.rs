use anyhow::{Context, Result};
use diesel::sql_query;
use diesel_async::{AsyncConnection, AsyncMigrationHarness, AsyncPgConnection, RunQueryDsl};
use diesel_migrations::{EmbeddedMigrations, MigrationHarness, embed_migrations};

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations");

/// Diesel names its ledger without a schema, so place it in the private schema
/// before constructing the harness. Moving an existing table preserves applied
/// versions and their timestamps.
pub(crate) async fn ensure_private_ledger(connection: &mut AsyncPgConnection) -> Result<()> {
    sql_query(
        "DO $$ BEGIN \
         IF to_regclass('public.__diesel_schema_migrations') IS NOT NULL THEN \
             IF to_regclass('zc_private.__diesel_schema_migrations') IS NOT NULL THEN \
                 RAISE EXCEPTION 'Both public and zc_private Diesel ledgers exist'; \
             END IF; \
             ALTER TABLE public.__diesel_schema_migrations SET SCHEMA zc_private; \
         ELSE \
             CREATE TABLE IF NOT EXISTS zc_private.__diesel_schema_migrations (\
                 version VARCHAR(50) PRIMARY KEY NOT NULL, \
                 run_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP); \
         END IF; \
         END $$",
    )
    .execute(connection)
    .await
    .context("Failed to place Diesel migration ledger in zc_private")?;
    Ok(())
}

pub async fn run_pending(database_url: &str) -> Result<Vec<String>> {
    let mut connection = AsyncPgConnection::establish(database_url)
        .await
        .context("Failed to connect to PostgreSQL")?;
    sql_query(format!(
        "SELECT pg_advisory_lock({})",
        crate::adoption::MIGRATION_LOCK_ID
    ))
    .execute(&mut connection)
    .await
    .context("Failed to acquire migration advisory lock")?;
    ensure_private_ledger(&mut connection).await?;
    sql_query("SET search_path TO zc_private, public")
        .execute(&mut connection)
        .await
        .context("Failed to select private Diesel migration ledger")?;
    let mut harness = AsyncMigrationHarness::new(connection);
    harness
        .run_pending_migrations(MIGRATIONS)
        .map(|versions| {
            versions
                .into_iter()
                .map(|version| version.to_string())
                .collect()
        })
        .map_err(|error| anyhow::anyhow!(error.to_string()))
}
