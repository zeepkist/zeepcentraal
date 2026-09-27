use anyhow::{Context, Result, ensure};
use std::path::Path;
use zc_database::{
    adoption::{Mode, run},
    migrations::run_pending,
};

#[tokio::test(flavor = "multi_thread")]
#[ignore = "requires dedicated disposable PostgreSQL named zsl_migration_test with frozen Drizzle ledger"]
async fn contest_migration_up_down_and_repeat() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed
            .host_str()
            .is_some_and(|host| matches!(host, "127.0.0.1" | "localhost"))
            && parsed.path().trim_start_matches('/') == "zsl_migration_test",
        "Contest migration test requires dedicated local disposable database"
    );
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    run(&url, &root.join("packages/database/drizzle"), Mode::Adopt).await?;
    assert!(run_pending(&url).await?.is_empty());
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move {
        let _ = connection.await;
    });
    client
        .batch_execute("ALTER TABLE zc_private.__diesel_schema_migrations SET SCHEMA public")
        .await?;
    assert!(run_pending(&url).await?.is_empty());
    let ledger = client
        .query_one(
            "SELECT to_regclass('public.__diesel_schema_migrations') IS NULL, \
             to_regclass('zc_private.__diesel_schema_migrations') IS NOT NULL",
            &[],
        )
        .await?;
    assert!(ledger.get::<_, bool>(0) && ledger.get::<_, bool>(1));
    let vote = client
        .query_one(
            "SELECT to_regclass('zc_private.level_submission_vote')::text",
            &[],
        )
        .await?;
    assert_eq!(
        vote.get::<_, Option<&str>>(0),
        Some("zc_private.level_submission_vote")
    );
    client
        .batch_execute(include_str!(
            "../migrations/20260927010000_zsl_contest_voting/down.sql"
        ))
        .await?;
    client
        .execute(
            "DELETE FROM zc_private.__diesel_schema_migrations WHERE version=$1",
            &[&"20260927010000"],
        )
        .await?;
    let removed = client
        .query_one(
            "SELECT to_regclass('zc_private.level_submission_vote') IS NULL",
            &[],
        )
        .await?;
    assert!(removed.get::<_, bool>(0));
    let applied = run_pending(&url).await?;
    ensure!(
        applied.iter().any(|version| version == "20260927010000"),
        "Migration was not reapplied"
    );
    assert!(run_pending(&url).await?.is_empty());
    let invalid = client
        .execute(
            "INSERT INTO zc_private.level_submission_vote \
        (id_contest,id_user,id_level,vote_type) VALUES (0,0,0,4)",
            &[],
        )
        .await;
    assert!(invalid.is_err(), "Invalid vote type must be rejected");
    let schedule = client
        .query_one(
            "SELECT column_name FROM information_schema.columns \
        WHERE table_schema='public' AND table_name='zsl_round' AND column_name='submission_start'",
            &[],
        )
        .await
        .context("Submission schedule column missing")?;
    assert_eq!(schedule.get::<_, &str>(0), "submission_start");
    Ok(())
}
