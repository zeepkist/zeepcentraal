use anyhow::{Result, ensure};

const SELECT_ADVENTURE_LEVEL_MEMBERSHIP: &str =
    include_str!("fixtures/adventure_level_items/select_adventure_level_membership.sql");

const BASE: &str = include_str!("../migrations/20261108020000_adventure_leaderboards/up.sql");
const UP: &str = include_str!("../migrations/20261108030000_adventure_level_items/up.sql");
const DOWN: &str = include_str!("../migrations/20261108030000_adventure_level_items/down.sql");

#[tokio::test]
#[ignore = "requires disposable local adventure_leaderboard_test database"]
async fn exact_active_alias_permissions_and_rollback() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/adventure_leaderboard_test",
        "Dedicated local Adventure database required"
    );
    let (mut client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("Adventure item test connection") });
    let tx = client.transaction().await?;
    tx.batch_execute(include_str!("fixtures/adventure_leaderboards.sql"))
        .await?;
    tx.batch_execute(include_str!(
        "fixtures/adventure_level_items/alter_level_item.sql"
    ))
    .await?;
    tx.batch_execute(BASE).await?;
    tx.batch_execute(UP).await?;
    tx.batch_execute(include_str!(
        "fixtures/adventure_level_items/set_local_role_zeepcentraal_graphql.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(SELECT_ADVENTURE_LEVEL_MEMBERSHIP, &[])
            .await?
            .get::<_, i32>(0),
        2
    );
    assert_eq!(
        tx.query_one(
            include_str!(
                "fixtures/adventure_level_items/select_adventure_level_membership_by_series_b.sql"
            ),
            &[]
        )
        .await?
        .get::<_, i32>(0),
        4
    );
    assert!(
        !tx.query_one(
            include_str!("fixtures/adventure_level_items/has_table_privilege.sql"),
            &[]
        )
        .await?
        .get::<_, bool>(0)
    );
    tx.batch_execute(include_str!(
        "fixtures/adventure_level_items/set_deleted_level_item.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(SELECT_ADVENTURE_LEVEL_MEMBERSHIP, &[])
            .await?
            .get::<_, i32>(0),
        1
    );
    tx.batch_execute(include_str!(
        "fixtures/adventure_level_items/set_publicly_visible_level.sql"
    ))
    .await?;
    assert!(
        tx.query_one(
            include_str!("fixtures/adventure_level_items/read_fixture_state.sql"),
            &[]
        )
        .await?
        .get::<_, Option<i32>>(0)
        .is_none()
    );
    tx.batch_execute(DOWN).await?;
    tx.batch_execute(UP).await?;
    tx.rollback().await?;
    Ok(())
}
