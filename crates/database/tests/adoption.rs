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
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move {
        let _ = connection.await;
    });
    let ledger = client
        .query_one(
            "SELECT to_regclass('public.__diesel_schema_migrations') IS NULL, \
         to_regclass('zc_private.__diesel_schema_migrations') IS NOT NULL",
            &[],
        )
        .await?;
    assert!(ledger.get::<_, bool>(0) && ledger.get::<_, bool>(1));
    assert!(first.baseline_created);
    assert!(!second.baseline_created);
    assert_eq!(second.drizzle_migrations, 87);
    Ok(())
}
