use anyhow::{Result, ensure};
use zc_database::migrations::run_pending;

#[tokio::test(flavor = "multi_thread")]
#[ignore = "requires dedicated disposable PostgreSQL named zsl_ledger_test"]
async fn moves_public_diesel_ledger_without_replaying_migrations() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed
            .host_str()
            .is_some_and(|host| matches!(host, "127.0.0.1" | "localhost"))
            && parsed.path().trim_start_matches('/') == "zsl_ledger_test",
        "Ledger test requires dedicated local disposable database"
    );
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move {
        let _ = connection.await;
    });
    client
        .batch_execute(
            "CREATE SCHEMA zc_private; \
         CREATE TABLE public.__diesel_schema_migrations (\
             version varchar(50) PRIMARY KEY NOT NULL, \
             run_on timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP); \
         INSERT INTO public.__diesel_schema_migrations(version) VALUES \
             ('20260919000000'),('20260927010000')",
        )
        .await?;
    assert!(run_pending(&url).await?.is_empty());
    assert!(run_pending(&url).await?.is_empty());
    let row = client
        .query_one(
            "SELECT to_regclass('public.__diesel_schema_migrations') IS NULL AS public_gone, \
         count(*)::bigint AS versions FROM zc_private.__diesel_schema_migrations",
            &[],
        )
        .await?;
    assert!(row.get::<_, bool>(0));
    assert_eq!(row.get::<_, i64>(1), 2);

    client.batch_execute(
        "CREATE TABLE public.__diesel_schema_migrations (version varchar(50) PRIMARY KEY NOT NULL)",
    ).await?;
    let conflict = format!("{:#}", run_pending(&url).await.unwrap_err());
    assert!(conflict.contains("Both public and zc_private Diesel ledgers exist"));
    Ok(())
}
