use anyhow::{Result, ensure};

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
    tx.batch_execute(
        "ALTER TABLE public.level_item ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now()",
    )
    .await?;
    tx.batch_execute(BASE).await?;
    tx.batch_execute(UP).await?;
    tx.batch_execute("SET LOCAL ROLE zeepcentraal_graphql")
        .await?;
    assert_eq!(tx.query_one("SELECT (public.adventure_level_membership_level_item(m)).id FROM public.adventure_level_membership m WHERE series='a' AND id_level=1", &[]).await?.get::<_,i32>(0),2);
    assert_eq!(tx.query_one("SELECT (public.adventure_level_membership_level_item(m)).id FROM public.adventure_level_membership m WHERE series='b' AND id_level=1", &[]).await?.get::<_,i32>(0),4);
    assert!(
        !tx.query_one(
            "SELECT has_table_privilege(current_user,'public.level_item','UPDATE')",
            &[]
        )
        .await?
        .get::<_, bool>(0)
    );
    tx.batch_execute("RESET ROLE; UPDATE public.level_item SET deleted=true WHERE id=2")
        .await?;
    assert_eq!(tx.query_one("SELECT (public.adventure_level_membership_level_item(m)).id FROM public.adventure_level_membership m WHERE series='a' AND id_level=1", &[]).await?.get::<_,i32>(0),1);
    tx.batch_execute("UPDATE public.level SET publicly_visible=false WHERE id=1")
        .await?;
    assert!(tx.query_one("SELECT (public.adventure_level_membership_level_item(ROW('a',1)::public.adventure_level_membership)).id", &[]).await?.get::<_,Option<i32>>(0).is_none());
    tx.batch_execute(DOWN).await?;
    tx.batch_execute(UP).await?;
    tx.rollback().await?;
    Ok(())
}
