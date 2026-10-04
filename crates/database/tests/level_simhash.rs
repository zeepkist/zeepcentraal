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
    client.batch_execute(
        "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='zeepcentraal_graphql') THEN CREATE ROLE zeepcentraal_graphql; END IF; END $$;
         CREATE TABLE public.level (
             id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
             hash text NOT NULL, xx_hash text UNIQUE NOT NULL, adventure boolean NOT NULL DEFAULT false,
             has_records boolean NOT NULL DEFAULT false,record_count bigint NOT NULL DEFAULT 0,
             publicly_visible boolean NOT NULL DEFAULT true,date_created timestamptz NOT NULL DEFAULT now(),date_updated timestamptz
         );
         CREATE TABLE public.level_metadata (
             id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,id_level integer NOT NULL REFERENCES public.level,
             format integer NOT NULL,blocks jsonb NOT NULL
         );
         GRANT USAGE ON SCHEMA public TO zeepcentraal_graphql;
         GRANT SELECT ON public.level TO zeepcentraal_graphql;
         ALTER TABLE public.level ENABLE ROW LEVEL SECURITY;
         CREATE POLICY visible_level ON public.level FOR SELECT TO zeepcentraal_graphql USING(publicly_visible);"
    ).await?;
    client.batch_execute(UP).await?;
    client.batch_execute(DOWN).await?;
    client.batch_execute(UP).await?;
    client.batch_execute(
        "INSERT INTO public.level(hash,xx_hash) SELECT 'simhash-'||id,lpad(id::text,32,'0') FROM generate_series(1,110) id;
         INSERT INTO public.level_metadata(id_level,format,blocks) VALUES
         (1,0,'[{\"Id\":22},{\"Id\":22},{\"Id\":2}]'),
         (2,1,'[{\"i\":2,\"p\":{\"x\":100}},{\"i\":22},{\"i\":22}]'),
         (3,1,'[]'),(4,1,'[{\"i\":\"bad\"}]'),(5,9,'[{\"i\":22}]'),
         (6,1,'[{\"i\":2}]'),(6,1,'[{\"i\":22}]');"
    ).await?;
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
            "SELECT simhash FROM public.level WHERE id IN(1,2) ORDER BY id",
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
            "UPDATE public.level_metadata SET blocks='[{\"i\":22}]' WHERE id=$1",
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
        .query_one("SELECT simhash FROM public.level WHERE id=6", &[])
        .await?
        .get(0);
    assert_eq!(saved as u64, xxhash_for_json_id(22)? as u64);

    client.batch_execute("UPDATE public.level SET simhash=NULL; UPDATE public.level SET simhash=-9223372036854775808 WHERE id=1;
        UPDATE public.level SET simhash=-9223372036854775807 WHERE id=2;
        UPDATE public.level SET simhash=-9223372036854775808 WHERE id=3;
        UPDATE public.level SET simhash=-9223372036854775806 WHERE id=4;
        UPDATE public.level SET simhash=-9223372036854710273 WHERE id=5;
        UPDATE public.level SET simhash=-9223372036854644737 WHERE id=6;
        UPDATE public.level SET simhash=-9223372036854775808,publicly_visible=false WHERE id=7;").await?;
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
            .query("SELECT * FROM public.similar_levels(NULL,16)", &[])
            .await?
            .is_empty()
    );
    assert!(
        client
            .query("SELECT * FROM public.similar_levels($1,NULL)", &[&source])
            .await?
            .is_empty()
    );
    assert_eq!(
        client
            .query(
                "SELECT id FROM public.similar_levels($1) ORDER BY id",
                &[&source]
            )
            .await?
            .len(),
        4
    );
    client
        .batch_execute("SET ROLE zeepcentraal_graphql")
        .await?;
    assert_eq!(similar_ids(&client, source, 64).await?, vec![3, 2, 4, 5, 6]);
    client.batch_execute("RESET ROLE").await?;

    // Large fingerprint-only search: no metadata dependency; validate covering access.
    client
        .batch_execute(
            "INSERT INTO public.level(hash,xx_hash,simhash)
        SELECT 'large-'||id,lpad(to_hex(id),32,'0'),id::bigint FROM generate_series(1000,101000) id;",
        )
        .await?;
    client.batch_execute("VACUUM ANALYZE public.level").await?;
    client.batch_execute("SET enable_seqscan=off").await?;
    let plan = client
        .query(
            "EXPLAIN (ANALYZE,BUFFERS,FORMAT TEXT) SELECT * FROM public.similar_levels($1,16)",
            &[&source],
        )
        .await?
        .into_iter()
        .map(|row| row.get::<_, String>(0))
        .collect::<Vec<_>>()
        .join("\n");
    // SQL functions with SET options are opaque in EXPLAIN; inspect fingerprint query separately.
    let fingerprints = client.query("EXPLAIN (ANALYZE,BUFFERS,FORMAT TEXT) SELECT id,bit_count(simhash::bit(64) # (-9223372036854775808)::bigint::bit(64)) FROM public.level WHERE publicly_visible=true AND simhash IS NOT NULL",&[]).await?
        .into_iter().map(|row|row.get::<_,String>(0)).collect::<Vec<_>>().join("\n");
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
            "SELECT id FROM public.similar_levels($1,$2)",
            &[&hash, &cutoff],
        )
        .await?
        .into_iter()
        .map(|row| row.get(0))
        .collect())
}
