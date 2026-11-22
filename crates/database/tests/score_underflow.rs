use anyhow::{Context, Result};

#[tokio::test]
#[ignore = "requires development PostgreSQL"]
async fn guarded_player_decay_avoids_postgresql_underflow() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")
        .or_else(|_| zc_core::environment::var("DATABASE_URL"))
        .context("ZC_TEST_DATABASE_URL or DATABASE_URL is required")?;
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("PostgreSQL connection") });

    let row = client
        .query_one(
            include_str!("fixtures/score_underflow/read_fixture_state.sql"),
            &[],
        )
        .await?;

    assert_eq!(row.get::<_, f32>(0), 0.0);
    Ok(())
}
