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
            .query_one(
                include_str!("fixtures/practice_migration/to_regclass.sql"),
                &[]
            )
            .await?
            .get::<_, bool>(0),
        "Empty test database required"
    );
    client
        .batch_execute(include_str!(
            "fixtures/practice_migration/create_zc_private.sql"
        ))
        .await?;
    client.batch_execute(UP).await?;
    assert!(
        client
            .query_one(
                include_str!("fixtures/practice_migration/select_event2_date_zsl_round.sql"),
                &[]
            )
            .await?
            .get::<_, bool>(0)
    );
    assert!(
        client
            .query_one(
                include_str!(
                    "fixtures/practice_migration/select_event2_date_zsl_round_by_id_51.sql"
                ),
                &[]
            )
            .await?
            .get::<_, bool>(0)
    );
    client
        .batch_execute(include_str!(
            "fixtures/practice_migration/insert_zsl_practice_playlist.sql"
        ))
        .await?;
    client.batch_execute(DOWN).await?;
    assert!(
        client
            .query_one(
                include_str!("fixtures/practice_migration/to_regclass_2.sql"),
                &[]
            )
            .await?
            .get::<_, bool>(0)
    );
    client.batch_execute(UP).await?;
    client
        .batch_execute(include_str!("fixtures/practice_migration/rollback.sql"))
        .await?;
    Ok(())
}
