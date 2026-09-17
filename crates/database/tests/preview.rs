use zc_database::{migration, Database};

/// Run explicitly against one of the two disposable preview databases.
/// No environment means no database mutation, never a silent test pass.
#[tokio::test]
#[ignore = "requires isolated preview PostgreSQL; see tools/rust-evaluation/README.md"]
async fn adapter_and_migration_contract() -> anyhow::Result<()> {
    let config = zc_core::PreviewConfig::from_env()?;
    migration::migrate(&config.database_url).await?;
    migration::migrate(&config.database_url).await?;
    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(3)
        .connect(&config.database_url)
        .await?;
    let db = Database::connect(&config.database_url, 3, pool.clone()).await?;
    let user = db.user(76561198000000001).await?.expect("fixture user");
    assert_eq!(user.steam_id, "76561198000000001");
    assert!(!user.banned);
    assert!(db.user(0).await?.is_none());
    let before: i64 = sqlx::query_scalar("SELECT count(*) FROM public.record")
        .fetch_one(&pool)
        .await?;
    assert!(db.submit(-1, 1, 28.0).await.is_err());
    assert!(db.submit(1, 1, f64::NAN).await.is_err());
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM public.record")
            .fetch_one(&pool)
            .await?,
        before
    );
    db.submit(1, 1, 27.125).await?;
    let standings = db.leaderboard(1, 100).await?;
    assert_eq!(standings[0].id_user, 1);
    assert_eq!(standings[0].time, 27.125);
    assert_eq!(sqlx::query_scalar::<_,i64>("SELECT count(*) FROM public.record r JOIN public.record_audit a ON a.id_record=r.id WHERE r.time=27.125").fetch_one(&pool).await?,1);
    // Fail the SECOND statement to establish transaction rollback, not just FK validation.
    sqlx::raw_sql("CREATE FUNCTION public.reject_preview_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'evaluation rollback'; END $$; CREATE TRIGGER reject_preview_audit BEFORE INSERT ON public.record_audit FOR EACH ROW EXECUTE FUNCTION public.reject_preview_audit();").execute(&pool).await?;
    let failed = db.submit(1, 1, 26.0).await;
    sqlx::raw_sql("DROP TRIGGER reject_preview_audit ON public.record_audit; DROP FUNCTION public.reject_preview_audit();").execute(&pool).await?;
    assert!(failed.is_err());
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM public.record WHERE time=26.0")
            .fetch_one(&pool)
            .await?,
        0
    );
    sqlx::raw_sql("DELETE FROM public.record_audit WHERE id_record IN (SELECT id FROM public.record WHERE time=27.125); DELETE FROM public.record WHERE time=27.125;").execute(&pool).await?;
    pool.close().await;
    Ok(())
}
