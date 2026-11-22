use anyhow::{Context, Result};
use diesel::migration::MigrationSource;
use diesel::sql_query;
use diesel_async::{
    AsyncConnection, AsyncMigrationHarness, AsyncPgConnection, RunQueryDsl, SimpleAsyncConnection,
};
use diesel_migrations::{EmbeddedMigrations, MigrationHarness, embed_migrations};

const ACQUIRE_ADVISORY_LOCK: &str = include_str!("queries/migrations/acquire_advisory_lock.sql");
const SET_PRIVATE_SEARCH_PATH: &str =
    include_str!("queries/migrations/set_private_search_path.sql");

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations");

/// Diesel names its ledger without a schema, so place it in the private schema
/// before constructing the harness. Moving an existing table preserves applied
/// versions and their timestamps.
pub(crate) async fn ensure_private_ledger(connection: &mut AsyncPgConnection) -> Result<()> {
    sql_query(include_str!("queries/migrations/ensure_private_ledger.sql"))
        .execute(connection)
        .await
        .context("Failed to place Diesel migration ledger in zc_private")?;
    Ok(())
}

pub async fn run_pending(database_url: &str) -> Result<Vec<String>> {
    let mut connection = AsyncPgConnection::establish(database_url)
        .await
        .context("Failed to connect to PostgreSQL")?;
    sql_query(ACQUIRE_ADVISORY_LOCK.replace(
        "{{migration_lock_id}}",
        &crate::adoption::MIGRATION_LOCK_ID.to_string(),
    ))
    .execute(&mut connection)
    .await
    .context("Failed to acquire migration advisory lock")?;
    ensure_private_ledger(&mut connection).await?;
    sql_query(SET_PRIVATE_SEARCH_PATH)
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
    sql_query(ACQUIRE_ADVISORY_LOCK.replace(
        "{{migration_lock_id}}",
        &crate::adoption::MIGRATION_LOCK_ID.to_string(),
    ))
    .execute(&mut connection)
    .await?;
    let retired: Retired = sql_query(include_str!(
        "queries/migrations/check_history_retirement.sql"
    ))
    .get_result(&mut connection)
    .await?;
    if !retired.retired {
        return Ok(());
    }
    sql_query(SET_PRIVATE_SEARCH_PATH)
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
    sql_query(include_str!("queries/migrations/analyze_history_fact.sql"))
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
        "backfill" => include_str!("queries/migrations/backfill_history_fact.sql"),
        "verify" => include_str!("queries/migrations/verify_history_fact.sql"),
        _ => anyhow::bail!("Unknown history batch operation"),
    };
    loop {
        let batch = connection
            .transaction::<Batch, anyhow::Error, _>(async |connection| {
                connection
                    .batch_execute(include_str!(
                        "queries/migrations/configure_history_batch_timeouts.sql"
                    ))
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
