use anyhow::{Context, Result};
use diesel::migration::MigrationSource;
use diesel::sql_query;
use diesel_async::{
    AsyncConnection, AsyncMigrationHarness, AsyncPgConnection, RunQueryDsl, SimpleAsyncConnection,
};
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
    let pending = harness
        .pending_migrations(MIGRATIONS)
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;
    let mut applied = Vec::new();
    for migration in pending {
        let version = migration.name().version().to_string();
        if version == "20261019000800" {
            // Keep the migration session lock while committing resumable batches.
            let mut connection = harness.into_inner();
            prepare_history_retirement(&mut connection).await?;
            harness = AsyncMigrationHarness::new(connection);
        }
        harness
            .run_migration(migration.as_ref())
            .map_err(|error| anyhow::anyhow!(error.to_string()))?;
        tracing::info!(version, "Database migration committed");
        applied.push(version);
    }
    Ok(applied)
}

/// Restore the last retirement migration before the existing legacy-read rollback.
/// Never revert later migrations implicitly.
pub async fn restore_history_index(database_url: &str) -> Result<()> {
    use diesel::{QueryableByName, sql_types::Bool};
    #[derive(QueryableByName)]
    struct Retired {
        #[diesel(sql_type = Bool)]
        retired: bool,
    }
    let mut connection = AsyncPgConnection::establish(database_url).await?;
    sql_query(format!(
        "SELECT pg_advisory_lock({})",
        crate::adoption::MIGRATION_LOCK_ID
    ))
    .execute(&mut connection)
    .await?;
    let retired: Retired = sql_query("SELECT to_regclass('zc_private.history_fact_rollout') IS NULL AND to_regclass('zc_private.record_history_fact') IS NOT NULL AS retired")
        .get_result(&mut connection).await?;
    if !retired.retired {
        return Ok(());
    }
    sql_query("SET search_path TO zc_private, public")
        .execute(&mut connection)
        .await?;
    let mut harness = AsyncMigrationHarness::new(connection);
    let versions = harness
        .applied_migrations()
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;
    anyhow::ensure!(
        versions
            .iter()
            .any(|version| version.to_string() == "20261019000800"),
        "History retirement migration is absent"
    );
    anyhow::ensure!(
        versions.iter().all(|version| {
            let version = version.to_string();
            // Public statistics does not depend on the history storage layout.
            version.as_str() <= "20261019000800"
                || matches!(
                    version.as_str(),
                    "20261019000900" | "20261019001000" | "20261021000000"
                )
        }),
        "Revert later migrations before rebuilding legacy history storage"
    );
    let migrations = MIGRATIONS
        .migrations()
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;
    let retirement = migrations
        .iter()
        .find(|migration| migration.name().version().to_string() == "20261019000800")
        .context("History retirement migration is missing from this binary")?;
    harness
        .revert_migration(retirement.as_ref())
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;
    Ok(())
}

async fn prepare_history_retirement(connection: &mut AsyncPgConnection) -> Result<()> {
    for phase in ["backfill", "verify"] {
        history_batches(connection, phase).await?;
    }
    sql_query("ANALYZE zc_private.record_history_fact")
        .execute(connection)
        .await?;
    Ok(())
}

pub(crate) async fn history_batches(connection: &mut AsyncPgConnection, phase: &str) -> Result<()> {
    use diesel::{QueryableByName, sql_types::Integer};
    #[derive(QueryableByName)]
    struct Batch {
        #[diesel(sql_type = Integer)]
        processed: i32,
    }
    let statement = match phase {
        "backfill" => "SELECT zc_private.backfill_history_fact(1000) AS processed",
        "verify" => "SELECT zc_private.verify_history_fact(1000) AS processed",
        _ => anyhow::bail!("Unknown history batch operation"),
    };
    loop {
        let batch = connection
            .transaction::<Batch, anyhow::Error, _>(async |connection| {
                connection
                    .batch_execute("SET LOCAL statement_timeout='60s'; SET LOCAL lock_timeout='5s'")
                    .await?;
                Ok(sql_query(statement).get_result::<Batch>(connection).await?)
            })
            .await
            .with_context(|| format!("History {phase} batch failed; rerun adopt to resume"))?;
        tracing::info!(
            phase,
            processed = batch.processed,
            "History migration batch committed"
        );
        if batch.processed == 0 {
            break;
        }
    }
    Ok(())
}
