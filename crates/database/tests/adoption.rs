use std::path::Path;
use zc_database::adoption::{Mode, run};

#[tokio::test]
#[ignore = "requires disposable pgmq PostgreSQL with Drizzle migrations already applied"]
async fn adopts_existing_drizzle_database_in_place() -> anyhow::Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    anyhow::ensure!(
        url::Url::parse(&url)?
            .host_str()
            .is_some_and(|host| matches!(host, "127.0.0.1" | "localhost")),
        "Adoption integration test requires local disposable PostgreSQL"
    );
    let migrations = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../packages/database/drizzle");
    let first = run(&url, &migrations, Mode::Adopt).await?;
    let second = run(&url, &migrations, Mode::Adopt).await?;
    assert!(first.baseline_created);
    assert!(!second.baseline_created);
    assert_eq!(second.drizzle_migrations, 87);
    Ok(())
}
