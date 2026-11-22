use anyhow::{Result, ensure};
use std::path::Path;
use zc_database::{
    adoption::{Mode, run},
    migrations::run_pending,
};
const BEGIN_SQL: &str = include_str!("fixtures/contest_migration/begin.sql");
const ROLLBACK_SQL: &str = include_str!("fixtures/contest_migration/rollback.sql");

const UP: &str = include_str!("../migrations/20260928010000_first_party_submissions/up.sql");
const DOWN: &str = include_str!("../migrations/20260928010000_first_party_submissions/down.sql");
#[tokio::test(flavor = "multi_thread")]
#[ignore = "requires disposable adopted PostgreSQL named zsl_migration_test before first-party migration"]
async fn contest_migration_up_down_and_repeat() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/zsl_migration_test",
        "Dedicated disposable database required"
    );
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    run(&url, &root.join("packages/database/drizzle"), Mode::Adopt).await?;
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move {
        let _ = connection.await;
    });
    // Voting migration remains reversible before column removal. Transactions keep fixture schedule intact.
    client.batch_execute(BEGIN_SQL).await?;
    client
        .batch_execute(include_str!(
            "../migrations/20260927010000_zsl_contest_voting/down.sql"
        ))
        .await?;
    client
        .batch_execute(include_str!(
            "../migrations/20260927010000_zsl_contest_voting/up.sql"
        ))
        .await?;
    client.batch_execute(ROLLBACK_SQL).await?;
    client
        .batch_execute(include_str!(
            "fixtures/contest_migration/insert_zsl_points_structure.sql"
        ))
        .await?;
    for invalid in [
        include_str!("fixtures/contest_migration/set_id_zsl_round_level_submission_contest.sql"),
        include_str!("fixtures/contest_migration/insert_level_submission_contest.sql"),
        include_str!("fixtures/contest_migration/set_authors_level_submissions.sql"),
        include_str!("fixtures/contest_migration/set_authors_level_submissions_by_id_9000.sql"),
    ] {
        client.batch_execute(BEGIN_SQL).await?;
        client.batch_execute(invalid).await?;
        assert!(client.batch_execute(UP).await.is_err());
        client.batch_execute(ROLLBACK_SQL).await?;
    }
    let applied = run_pending(&url).await?;
    assert!(applied.iter().any(|v| v == "20260928010000"));
    assert!(run_pending(&url).await?.is_empty());
    run(&url, &root.join("packages/database/drizzle"), Mode::Verify).await?;
    let preserved = client
        .query_one(
            include_str!("fixtures/contest_migration/select_state_level_submission_vote.sql"),
            &[],
        )
        .await?;
    assert_eq!(preserved.get::<_, &str>(0), "frozen");
    assert_eq!(preserved.get::<_, i64>(1), 9000);
    assert_eq!(preserved.get::<_, &str>(2), "a".repeat(64));
    assert_eq!(preserved.get::<_, i64>(3), 9000);
    assert_eq!(
        preserved.get::<_, Vec<String>>(4),
        vec!["76561198000000001"]
    );
    assert_eq!(preserved.get::<_, &str>(5), "migration-fixture-xx");
    assert_eq!(preserved.get::<_, i64>(6), 1);
    assert_eq!(preserved.get::<_, i64>(7), 0);
    assert!(client.batch_execute(DOWN).await.is_err());
    for authors in [
        Vec::<String>::new(),
        vec!["wrong".into()],
        vec!["76561198000000001".into(); 4],
    ] {
        assert!(
            client
                .execute(
                    include_str!(
                        "fixtures/contest_migration/set_authors_level_submissions_by_id_9000_2.sql"
                    ),
                    &[&authors]
                )
                .await
                .is_err()
        );
    }
    let removed = client
        .query_one(
            include_str!("fixtures/contest_migration/count_information_schema.sql"),
            &[],
        )
        .await?;
    assert_eq!(removed.get::<_, i64>(0), 0);
    let db = zc_database::Database::connect(&url, 2).await?;
    let votes = db
        .super_league_vote_snapshot(Some(9000), 9000, "76561198000000099")
        .await?
        .unwrap();
    assert_eq!(votes.candidates.len(), 1);
    assert_eq!(votes.votes[0], vec![9000]);
    assert_eq!(votes.open_types, vec![1, 2, 3]);
    assert!(db.pending_submission_notifications().await?.is_empty());
    assert_eq!(
        db.get_inspector_contest(9000).await?.unwrap().theme,
        "Frozen fixture"
    );
    // Migration ledger relocation and migrated catalog verification remain repeatable.
    client
        .batch_execute(include_str!(
            "fixtures/contest_migration/alter_diesel_schema_migrations.sql"
        ))
        .await?;
    assert!(run_pending(&url).await?.is_empty());
    run(&url, &root.join("packages/database/drizzle"), Mode::Verify).await?;
    Ok(())
}
