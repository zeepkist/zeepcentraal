use anyhow::{Result, ensure};
use zc_database::{Database, services::level_simhash::LevelSimhashOutcome};

const UP: &str = include_str!("../migrations/20261003010000_level_simhash/up.sql");
const DOWN: &str = include_str!("../migrations/20261003010000_level_simhash/down.sql");

#[tokio::test(flavor = "multi_thread")]
#[ignore = "requires empty disposable local PostgreSQL named simhash_test"]
async fn migration_backfill_concurrency_visibility_and_distance() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/simhash_test",
        "Dedicated disposable database required"
    );
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move {
        connection.await.expect("PostgreSQL connection");
    });
    client
        .batch_execute(include_str!(
            "fixtures/level_simhash/create_fixture_schema.sql"
        ))
        .await?;
    client.batch_execute(UP).await?;
    client.batch_execute(DOWN).await?;
    client.batch_execute(UP).await?;
    client
        .batch_execute(include_str!("fixtures/level_simhash/insert_level.sql"))
        .await?;
    let database = Database::connect(&url, 4).await?;
    let first_page = database.missing_level_simhash_ids(0, 100).await?;
    assert_eq!(first_page, (1..=100).collect::<Vec<_>>());
    assert_eq!(
        database.missing_level_simhash_ids(100, 100).await?,
        (101..=110).collect::<Vec<_>>()
    );
    assert!(database.missing_level_simhash_ids(0, 101).await.is_err());

    let (first, second) = tokio::join!(
        database.backfill_level_simhash(1),
        database.backfill_level_simhash(1)
    );
    assert_eq!(
        usize::from(first? == LevelSimhashOutcome::Updated)
            + usize::from(second? == LevelSimhashOutcome::Updated),
        1
    );
    assert_eq!(
        database.backfill_level_simhash(2).await?,
        LevelSimhashOutcome::Updated
    );
    assert_eq!(
        database.backfill_level_simhash(3).await?,
        LevelSimhashOutcome::Empty
    );
    assert_eq!(
        database.backfill_level_simhash(4).await?,
        LevelSimhashOutcome::InvalidMetadata
    );
    assert_eq!(
        database.backfill_level_simhash(5).await?,
        LevelSimhashOutcome::InvalidMetadata
    );
    assert_eq!(
        database.backfill_level_simhash(7).await?,
        LevelSimhashOutcome::MissingMetadata
    );
    let hashes = client
        .query(
            include_str!("fixtures/level_simhash/select_simhash_level.sql"),
            &[],
        )
        .await?;
    assert_eq!(hashes[0].get::<_, i64>(0), hashes[1].get::<_, i64>(0));
    assert!(
        database
            .missing_level_simhash_ids(0, 100)
            .await?
            .iter()
            .all(|id| *id > 2)
    );

    let old = database.level_simhash_snapshot(6).await?.unwrap();
    client
        .execute(
            include_str!("fixtures/level_simhash/set_blocks_level_metadata.sql"),
            &[&old.id],
        )
        .await?;
    assert!(!database.set_missing_level_simhash(&old, 123).await?);
    assert_eq!(
        database.backfill_level_simhash(6).await?,
        LevelSimhashOutcome::Updated
    );
    assert!(!database.set_missing_level_simhash(&old, 123).await?);
    // Retry after a discarded snapshot recomputes current data; completed rows never change.
    let saved: i64 = client
        .query_one(
            include_str!("fixtures/level_simhash/select_simhash_level_by_id_6.sql"),
            &[],
        )
        .await?
        .get(0);
    assert_eq!(saved as u64, xxhash_for_json_id(22)? as u64);

    client
        .batch_execute(include_str!("fixtures/level_simhash/set_simhash_level.sql"))
        .await?;
    let source = "00000000000000000000000000000001";
    assert_eq!(similar_ids(&client, source, 0).await?, vec![3]);
    assert_eq!(similar_ids(&client, source, 1).await?, vec![3, 2, 4]);
    assert_eq!(similar_ids(&client, source, 16).await?, vec![3, 2, 4, 5]);
    assert_eq!(similar_ids(&client, source, 17).await?, vec![3, 2, 4, 5, 6]);
    for cutoff in [-1, 65] {
        assert!(similar_ids(&client, source, cutoff).await?.is_empty());
    }
    assert!(similar_ids(&client, "missing", 64).await?.is_empty());
    assert!(
        similar_ids(&client, "00000000000000000000000000000007", 64)
            .await?
            .is_empty()
    );
    assert!(
        similar_ids(&client, "00000000000000000000000000000008", 64)
            .await?
            .is_empty()
    );
    assert!(
        client
            .query(
                include_str!("fixtures/level_simhash/select_similar_levels.sql"),
                &[]
            )
            .await?
            .is_empty()
    );
    assert!(
        client
            .query(
                include_str!("fixtures/level_simhash/select_similar_levels_2.sql"),
                &[&source]
            )
            .await?
            .is_empty()
    );
    assert_eq!(
        client
            .query(
                include_str!("fixtures/level_simhash/select_id_similar_levels.sql"),
                &[&source]
            )
            .await?
            .len(),
        4
    );
    client
        .batch_execute(include_str!(
            "fixtures/level_simhash/set_role_zeepcentraal_graphql.sql"
        ))
        .await?;
    assert_eq!(similar_ids(&client, source, 64).await?, vec![3, 2, 4, 5, 6]);
    client
        .batch_execute(include_str!("fixtures/level_simhash/reset_role.sql"))
        .await?;

    // Large fingerprint-only search: no metadata dependency; validate covering access.
    client
        .batch_execute(include_str!("fixtures/level_simhash/insert_level_2.sql"))
        .await?;
    client
        .batch_execute(include_str!("fixtures/level_simhash/vacuum_level.sql"))
        .await?;
    client
        .batch_execute(include_str!(
            "fixtures/level_simhash/set_enable_seqscan_off.sql"
        ))
        .await?;
    let plan = client
        .query(
            include_str!("fixtures/level_simhash/explain_similar_levels.sql"),
            &[&source],
        )
        .await?
        .into_iter()
        .map(|row| row.get::<_, String>(0))
        .collect::<Vec<_>>()
        .join("\n");
    // SQL functions with SET options are opaque in EXPLAIN; inspect fingerprint query separately.
    let fingerprints = client
        .query(
            include_str!("fixtures/level_simhash/explain_level.sql"),
            &[],
        )
        .await?
        .into_iter()
        .map(|row| row.get::<_, String>(0))
        .collect::<Vec<_>>()
        .join("\n");
    assert!(
        fingerprints.contains("Index Only Scan")
            && fingerprints.contains("IX_level_public_simhash")
    );
    assert!(!fingerprints.contains("level_metadata"));
    println!("SimHash routine: {plan}\nFingerprint scan: {fingerprints}");
    Ok(())
}

fn xxhash_for_json_id(id: i64) -> Result<i64> {
    Ok(zc_core::levels::calculate_level_simhash(
        &serde_json::json!([{"i":id}]),
        zc_core::levels::LevelFormat::Json,
    )?
    .unwrap())
}

async fn similar_ids(client: &tokio_postgres::Client, hash: &str, cutoff: i32) -> Result<Vec<i32>> {
    Ok(client
        .query(
            include_str!("fixtures/level_simhash/select_id_similar_levels_2.sql"),
            &[&hash, &cutoff],
        )
        .await?
        .into_iter()
        .map(|row| row.get(0))
        .collect())
}
