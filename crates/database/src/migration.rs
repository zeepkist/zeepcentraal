//! The experiment uses one SQL body with two native migration runners on separate DBs.
use anyhow::Result;

pub async fn migrate(url: &str) -> Result<()> {
    zc_core::validate_preview_database(url)?;
    let expected = format!("/zc_rust_{}", crate::Database::NAME);
    anyhow::ensure!(
        url::Url::parse(url)?.path() == expected,
        "Database name does not match selected migration adapter"
    );
    #[cfg(feature = "db-sqlx")]
    {
        use sqlx::migrate::{Migration, MigrationType, Migrator};
        use std::borrow::Cow;
        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(1)
            .connect(url)
            .await?;
        let mut migrator = Migrator::DEFAULT;
        migrator.migrations = Cow::Owned(vec![Migration::new(
            1,
            Cow::Borrowed("preview"),
            MigrationType::Simple,
            Cow::Borrowed(include_str!("../migrations/00000000000001_preview/up.sql")),
            false,
        )]);
        migrator.run(&pool).await?;
        pool.close().await;
    }
    #[cfg(feature = "db-diesel")]
    {
        use diesel_async::async_connection_wrapper::AsyncConnectionWrapper;
        use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
        const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations");
        let owned = url.to_owned();
        tokio::task::spawn_blocking(move || -> Result<()> {
            use diesel::Connection;
            let mut connection =
                AsyncConnectionWrapper::<diesel_async::AsyncPgConnection>::establish(&owned)?;
            connection
                .run_pending_migrations(MIGRATIONS)
                .map_err(|e| anyhow::anyhow!("Migration failed: {e}"))?;
            Ok(())
        })
        .await??;
    }
    Ok(())
}
