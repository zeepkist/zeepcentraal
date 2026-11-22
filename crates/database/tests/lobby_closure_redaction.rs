use anyhow::{Result, ensure};

#[tokio::test]
#[ignore = "requires disposable loopback PostgreSQL with lobby tables"]
async fn backfill_redacts_private_closures_and_preserves_other_names() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/zc_test",
        "Dedicated lobby test database required"
    );
    let (mut client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("Lobby test connection") });
    let tx = client.transaction().await?;
    tx.batch_execute(include_str!(
        "fixtures/lobby_closure_redaction/insert_user.sql"
    ))
    .await?;

    let up = include_str!("../migrations/20261119000000_redact_private_lobby_closures/up.sql");
    let down = include_str!("../migrations/20261119000000_redact_private_lobby_closures/down.sql");
    for sql in [up, up, down] {
        tx.batch_execute(sql).await?;
        let rows = tx
            .query(
                include_str!("fixtures/lobby_closure_redaction/select_room_name_lobby.sql"),
                &[],
            )
            .await?;
        let names: Vec<_> = rows
            .iter()
            .map(|row| (row.get::<_, &str>(0), row.get::<_, Vec<&str>>(1)))
            .collect();
        assert_eq!(
            names,
            [
                ("Active room", vec!["Active room"]),
                ("Inferred room", vec!["Inferred room", "Private room"]),
                ("Public room", vec!["Public room", "Public room"]),
                ("Private room", vec!["Private packet name", "Private room"]),
            ]
        );
    }
    tx.rollback().await?;
    Ok(())
}
