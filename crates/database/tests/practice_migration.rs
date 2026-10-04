use anyhow::{Result, ensure};
const UP: &str = include_str!("../migrations/20261004200000_zsl_practice/up.sql");
const DOWN: &str = include_str!("../migrations/20261004200000_zsl_practice/down.sql");

#[tokio::test]
#[ignore = "requires empty disposable PostgreSQL named zsl_practice_test"]
async fn practice_migration_seed_nullable_schedule_and_rollback() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/zsl_practice_test",
        "Dedicated disposable database required"
    );
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move {
        let _ = connection.await;
    });
    ensure!(
        client
            .query_one("SELECT to_regclass('public.zsl_round') IS NULL", &[])
            .await?
            .get::<_, bool>(0),
        "Empty test database required"
    );
    client.batch_execute("BEGIN; CREATE SCHEMA zc_private; CREATE TABLE public.zsl_round (id integer PRIMARY KEY); INSERT INTO public.zsl_round VALUES (50),(51);").await?;
    client.batch_execute(UP).await?;
    assert!(client.query_one("SELECT event2_date='2026-10-11T23:00:00Z'::timestamptz FROM public.zsl_round WHERE id=50", &[]).await?.get::<_,bool>(0));
    assert!(
        client
            .query_one(
                "SELECT event2_date IS NULL FROM public.zsl_round WHERE id=51",
                &[]
            )
            .await?
            .get::<_, bool>(0)
    );
    client.batch_execute("INSERT INTO zc_private.zsl_practice_playlist (id_zsl_round,playlist_url,object_key,content_sha256,byte_size) VALUES (50,'https://example.com/p','manifest',repeat('a',64),100);").await?;
    client.batch_execute(DOWN).await?;
    assert!(
        client
            .query_one(
                "SELECT to_regclass('zc_private.zsl_practice_playlist') IS NULL",
                &[]
            )
            .await?
            .get::<_, bool>(0)
    );
    client.batch_execute(UP).await?;
    client.batch_execute("ROLLBACK").await?;
    Ok(())
}
