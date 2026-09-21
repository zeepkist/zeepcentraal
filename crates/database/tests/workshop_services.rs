use serde_json::json;
use zc_database::{Database, services::workshop::WorkshopLevelInput};

#[tokio::test]
#[ignore = "requires disposable PostgreSQL with current workshop tables"]
async fn workshop_upsert_and_reconciliation_preserve_adventure_aliases() -> anyhow::Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    anyhow::ensure!(
        url::Url::parse(&url)?
            .host_str()
            .is_some_and(|host| matches!(host, "127.0.0.1" | "localhost")),
        "Workshop integration test requires local disposable PostgreSQL"
    );
    let database = Database::connect(&url, 2).await?;
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("PostgreSQL connection") });
    let suffix = i64::from(std::process::id());
    let workshop_id = 3_800_000_000 + suffix;
    let steam_id = 76_561_198_800_000_000 + suffix;
    let input = WorkshopLevelInput {
        hash: format!("legacy-{suffix}"),
        xx_hash: format!("{suffix:032X}"),
        workshop_id,
        workshop_name: "Rust Workshop".to_owned(),
        workshop_image_url: "thumbnails/workshop.jpg".to_owned(),
        workshop_visibility: 0,
        workshop_file_size: 123,
        author_id: steam_id,
        level_author_id: steam_id,
        name: "Rust Level".to_owned(),
        image_url: "thumbnails/level.jpg".to_owned(),
        file_author: "Rust".to_owned(),
        file_uid: format!("rust-{suffix}"),
        validation_time_author: 10.0,
        validation_time_gold: 11.0,
        validation_time_silver: 12.0,
        validation_time_bronze: 13.0,
        created_at: "2026-01-01T00:00:00Z".to_owned(),
        updated_at: "2026-01-02T00:00:00Z".to_owned(),
        format: 1,
        amount_checkpoints: 1,
        amount_finishes: 1,
        amount_blocks: 2,
        type_ground: -1,
        type_skybox: 1,
        blocks: json!([{"i": 22}, {"i": 2}]),
    };
    let first = database.upsert_workshop_level(&input).await?;
    assert!(first.score_changed);
    let before = client
        .query_one(
            "SELECT level.xmin::text,metadata.xmin::text,item.xmin::text \
             FROM public.level level JOIN public.level_metadata metadata ON metadata.id_level=level.id \
             JOIN public.level_item item ON item.id_level=level.id WHERE level.id=$1",
            &[&first.id_level],
        )
        .await?;
    let before_versions = (
        before.get::<_, String>(0),
        before.get::<_, String>(1),
        before.get::<_, String>(2),
    );
    let second = database.upsert_workshop_level(&input).await?;
    assert_eq!(second.id_level, first.id_level);
    assert!(!second.score_changed);
    let after = client
        .query_one(
            "SELECT level.xmin::text,metadata.xmin::text,item.xmin::text \
             FROM public.level level JOIN public.level_metadata metadata ON metadata.id_level=level.id \
             JOIN public.level_item item ON item.id_level=level.id WHERE level.id=$1",
            &[&first.id_level],
        )
        .await?;
    assert_eq!(
        before_versions,
        (
            after.get::<_, String>(0),
            after.get::<_, String>(1),
            after.get::<_, String>(2),
        ),
        "unchanged workshop reconciliation must not rewrite rows"
    );

    assert_eq!(
        database
            .mark_missing_workshop_levels_deleted(workshop_id, &[])
            .await?,
        vec![first.id_level]
    );
    let restored = database.upsert_workshop_level(&input).await?;
    assert!(restored.score_changed);

    client
        .execute(
            "UPDATE public.level SET adventure=true WHERE id=$1",
            &[&first.id_level],
        )
        .await?;
    assert!(
        database
            .mark_missing_workshop_levels_deleted(workshop_id, &[])
            .await?
            .is_empty()
    );
    let deleted: bool = client
        .query_one(
            "SELECT deleted FROM public.level_item WHERE id_level=$1",
            &[&first.id_level],
        )
        .await?
        .get(0);
    assert!(!deleted);

    client
        .execute("DELETE FROM public.level WHERE id=$1", &[&first.id_level])
        .await?;
    client
        .execute(
            "DELETE FROM public.workshop_item WHERE workshop_id=$1",
            &[&workshop_id],
        )
        .await?;
    client
        .execute(
            "DELETE FROM public.\"user\" WHERE steam_id=$1",
            &[&steam_id],
        )
        .await?;
    Ok(())
}
