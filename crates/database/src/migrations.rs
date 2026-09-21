use anyhow::{Context, Result};
use diesel_async::{AsyncConnection, AsyncMigrationHarness, AsyncPgConnection};
use diesel_migrations::{EmbeddedMigrations, MigrationHarness, embed_migrations};

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations");

pub async fn run_pending(database_url: &str) -> Result<Vec<String>> {
    let connection = AsyncPgConnection::establish(database_url)
        .await
        .context("Failed to connect to PostgreSQL")?;
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
