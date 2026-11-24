use anyhow::{Result, ensure};
use zc_database::Database;

#[tokio::test]
#[ignore = "requires an empty local workshop_scan_state_test database"]
async fn refresh_state_compares_steam_timestamps_and_retries_partial_scans() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/workshop_scan_state_test");
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    let connection = tokio::spawn(connection);
    let up = include_str!("../migrations/20261124000000_workshop_scan_requests/up.sql");
    let down = include_str!("../migrations/20261124000000_workshop_scan_requests/down.sql");
    for sql in [
        include_str!("fixtures/zsl_tournament.sql"),
        "CREATE TABLE public.workshop_item (
            workshop_id bigint PRIMARY KEY,
            updated_at timestamptz NOT NULL,
            visibility smallint NOT NULL
        )",
        up,
        down,
        up,
        "INSERT INTO zc_private.workshop_scan_request (workshop_id, last_requested_at) VALUES (1,now()),(2,now())",
    ] {
        client.batch_execute(sql).await?;
    }

    let database = Database::connect(&url, 2).await?;
    let first = "2026-01-01T00:00:00Z";
    let next = "2026-02-01T00:00:00Z";
    assert!(
        database
            .begin_requested_workshop_refresh(1, first, 0)
            .await?
    );
    database
        .finish_requested_workshop_refresh(1, Some(first))
        .await?;
    assert!(
        !database
            .begin_requested_workshop_refresh(1, first, 0)
            .await?,
        "empty scan is complete"
    );

    client
        .batch_execute(
            "INSERT INTO public.workshop_item VALUES (2, '2026-01-01', 0);
        INSERT INTO public.level (hash, xx_hash) VALUES ('fixture', repeat('A',32));
        INSERT INTO public.level_item (id_level, workshop_id, file_uid) VALUES (1, 2, 'track');",
        )
        .await?;
    assert!(
        !database
            .begin_requested_workshop_refresh(2, first, 0)
            .await?
    );
    assert!(
        database
            .begin_requested_workshop_refresh(2, next, 0)
            .await?
    );
    client
        .batch_execute(
            "UPDATE public.workshop_item SET updated_at = '2026-02-01' WHERE workshop_id = 2",
        )
        .await?;
    assert!(
        database
            .begin_requested_workshop_refresh(2, next, 0)
            .await?,
        "a partial write cannot mark a scan complete"
    );
    database
        .finish_requested_workshop_refresh(2, Some(next))
        .await?;
    assert!(
        !database
            .begin_requested_workshop_refresh(2, next, 0)
            .await?
    );
    assert!(
        !database
            .begin_requested_workshop_refresh(2, first, 0)
            .await?
    );
    client
        .batch_execute("UPDATE public.workshop_item SET visibility = 2 WHERE workshop_id = 2")
        .await?;
    assert!(
        database
            .begin_requested_workshop_refresh(2, next, 3)
            .await?,
        "restored visibility requires reconciliation"
    );
    client.batch_execute(down).await?;
    drop(client);
    connection.await??;
    Ok(())
}
