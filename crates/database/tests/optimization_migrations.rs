use anyhow::{Result, ensure};

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
#[ignore = "requires isolated zc_optimization_test with pre-optimization schema and migration ledger"]
async fn async_harness_applies_concurrent_indexes_outside_transactions() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/zc_optimization_test",
        "Dedicated local zc_optimization_test database required"
    );
    let applied = zc_database::migrations::run_pending(&url).await?;
    assert_eq!(applied.len(), 11);
    assert!(
        applied
            .iter()
            .all(|version| version.starts_with("2026101900"))
    );
    let database = zc_database::Database::connect(&url, 1).await?;
    assert_eq!(
        database.history_optimization("status", false).await?["retired"],
        true
    );
    assert!(zc_database::migrations::run_pending(&url).await?.is_empty());
    Ok(())
}
