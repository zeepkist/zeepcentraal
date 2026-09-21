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
            "SELECT (CASE \
               WHEN LN(GREATEST(1000::double precision,1.401298464324817e-45)) \
                    +(100000-1)*LN(0.95)<LN(1.401298464324817e-45) \
               THEN 0 \
               ELSE 1000::double precision*POWER(0.95,100000-1) \
             END)::real",
            &[],
        )
        .await?;

    assert_eq!(row.get::<_, f32>(0), 0.0);
    Ok(())
}
