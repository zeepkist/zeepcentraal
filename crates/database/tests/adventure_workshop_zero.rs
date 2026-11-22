use anyhow::{Result, ensure};

const SELECT_NAME_WORKSHOP_ITEM: &str =
    include_str!("fixtures/adventure_workshop_zero/select_name_workshop_item.sql");

const UP: &str = include_str!("../migrations/20261109010000_adventure_workshop_zero/up.sql");
const DOWN: &str = include_str!("../migrations/20261109010000_adventure_workshop_zero/down.sql");

#[tokio::test]
#[ignore = "requires disposable local adventure_workshop_zero_test database"]
async fn official_aliases_zero_foreign_keys_permissions_and_rollback() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/adventure_workshop_zero_test",
        "Dedicated local Adventure Workshop ID database required"
    );
    let (mut client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("Adventure Workshop ID connection") });
    let tx = client.transaction().await?;
    tx.batch_execute(include_str!(
        "fixtures/adventure_workshop_zero/create_workshop_item.sql"
    ))
    .await?;
    tx.batch_execute(UP).await?;
    tx.batch_execute(include_str!(
        "fixtures/adventure_workshop_zero/set_local_role_zeepcentraal_graphql.sql"
    ))
    .await?;
    let rows = tx
        .query(
            include_str!("fixtures/adventure_workshop_zero/select_workshop_id_level_item.sql"),
            &[],
        )
        .await?;
    assert_eq!(
        rows.iter().map(|r| r.get::<_, i64>(0)).collect::<Vec<_>>(),
        [0, 0, 123, -1, -1]
    );
    assert_eq!(rows[0].get::<_, String>(1), "ea1");
    assert_eq!(rows[1].get::<_, String>(1), "old-version");
    assert_eq!(
        tx.query_one(SELECT_NAME_WORKSHOP_ITEM, &[])
            .await?
            .get::<_, String>(0),
        "Official Adventure"
    );
    tx.batch_execute(include_str!(
        "fixtures/adventure_workshop_zero/reset_role.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/adventure_workshop_zero/count_item_changes.sql"),
            &[]
        )
        .await?
        .get::<_, i32>(0),
        2
    );
    tx.batch_execute(DOWN).await?;
    assert_eq!(
        tx.query_one(
            include_str!(
                "fixtures/adventure_workshop_zero/select_workshop_id_level_item_by_id_1.sql"
            ),
            &[]
        )
        .await?
        .get::<_, i64>(0),
        -1
    );
    // Existing zero metadata and unrelated zero aliases survive both directions.
    tx.batch_execute(include_str!(
        "fixtures/adventure_workshop_zero/set_name_workshop_item.sql"
    ))
    .await?;
    tx.batch_execute(UP).await?;
    tx.batch_execute(UP).await?;
    assert_eq!(
        tx.query_one(SELECT_NAME_WORKSHOP_ITEM, &[])
            .await?
            .get::<_, String>(0),
        "Existing zero"
    );
    tx.batch_execute(DOWN).await?;
    assert_eq!(
        tx.query_one(
            include_str!(
                "fixtures/adventure_workshop_zero/select_workshop_id_level_item_by_id_6.sql"
            ),
            &[]
        )
        .await?
        .get::<_, i64>(0),
        0
    );
    tx.rollback().await?;
    Ok(())
}
