use serde_json::json;
use zc_database::{Database, services::workshop::WorkshopLevelInput};

#[tokio::test]
#[ignore = "requires fresh local workshop_incremental_validation_test database with current migrations"]
async fn workshop_upsert_and_reconciliation_preserve_adventure_aliases() -> anyhow::Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed_url = url::Url::parse(&url)?;
    anyhow::ensure!(
        parsed_url
            .host_str()
            .is_some_and(|host| matches!(host, "127.0.0.1" | "localhost"))
            && parsed_url.path() == "/workshop_incremental_validation_test",
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
        environment: Some(serde_json::json!({"skybox": 1})),
        blocks: json!([{"i": 22}, {"i": 2}]),
    };
    let first = database.upsert_workshop_level(&input).await?;
    assert!(first.score_changed);
    let fingerprint = client
        .query_one(
            "SELECT simhash FROM public.level WHERE id=$1",
            &[&first.id_level],
        )
        .await?
        .get::<_, i64>(0);
    assert_eq!(
        Some(fingerprint),
        zc_core::levels::calculate_level_simhash(
            &input.blocks,
            zc_core::levels::LevelFormat::Json
        )?
    );
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
    assert!(second.validation_level_ids.is_empty());
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

    client
        .execute(
            "UPDATE public.level SET simhash=NULL WHERE id=$1",
            &[&first.id_level],
        )
        .await?;
    let repaired = database.upsert_workshop_level(&input).await?;
    assert!(!repaired.score_changed);
    assert_eq!(
        client
            .query_one(
                "SELECT simhash FROM public.level WHERE id=$1",
                &[&first.id_level]
            )
            .await?
            .get::<_, i64>(0),
        fingerprint
    );

    let mut changed_environment = input.clone();
    changed_environment.environment =
        Some(json!({"skybox": 1, "skyboxOverride": {"sun": {"i": 0.125}}}));
    let lighting_update = database.upsert_workshop_level(&changed_environment).await?;
    assert_eq!(lighting_update.id_level, first.id_level);
    assert!(!lighting_update.score_changed);
    assert_eq!(lighting_update.validation_level_ids, vec![first.id_level]);
    let saved = client
        .query_one(
            "SELECT metadata.environment::text,metadata.blocks::text,level.hash,level.xx_hash \
         FROM public.level level JOIN public.level_metadata metadata ON metadata.id_level=level.id \
         WHERE level.id=$1",
            &[&first.id_level],
        )
        .await?;
    assert_eq!(
        saved
            .get::<_, Option<String>>(0)
            .map(|value| serde_json::from_str::<serde_json::Value>(&value))
            .transpose()?,
        changed_environment.environment
    );
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(&saved.get::<_, String>(1))?,
        input.blocks
    );
    assert_eq!(saved.get::<_, String>(2), input.hash);
    assert_eq!(
        saved.get::<_, Option<String>>(3).as_deref(),
        Some(input.xx_hash.as_str())
    );

    assert_eq!(
        database
            .mark_missing_workshop_levels_deleted(workshop_id, &[])
            .await?,
        vec![first.id_level]
    );
    let restored = database.upsert_workshop_level(&input).await?;
    assert!(restored.score_changed);

    assert_eq!(
        database
            .reconcile_missing_workshop_items(&[workshop_id])
            .await?,
        vec![first.id_level]
    );
    assert_eq!(
        client
            .query_one(
                "SELECT points FROM public.level_points WHERE id_level=$1",
                &[&first.id_level]
            )
            .await?
            .get::<_, i32>(0),
        0
    );
    let restored = database.upsert_workshop_level(&input).await?;
    assert!(restored.score_changed);
    assert!(
        !client
            .query_one(
                "SELECT deleted FROM public.level_item WHERE id_level=$1",
                &[&first.id_level]
            )
            .await?
            .get::<_, bool>(0)
    );

    client
        .execute(
            "UPDATE public.level SET adventure=true WHERE id=$1",
            &[&first.id_level],
        )
        .await?;
    client
        .execute(
            "UPDATE public.level_points SET points=900 WHERE id_level=$1",
            &[&first.id_level],
        )
        .await?;
    assert!(
        database
            .reconcile_missing_workshop_items(&[workshop_id])
            .await?
            .is_empty()
    );
    assert_eq!(
        client
            .query_one(
                "SELECT points FROM public.level_points WHERE id_level=$1",
                &[&first.id_level]
            )
            .await?
            .get::<_, i32>(0),
        900
    );
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

    // Reused UID replaces current membership; no separate lineage is retained.
    // A reused UID moves current membership, but retains both existing metadata versions.
    let mut new_version = input.clone();
    new_version.xx_hash = format!("{:032X}", suffix + 1_000_000);
    new_version.blocks = json!([{"i":22},{"i":2},{"i":22}]);
    let changed = database.upsert_workshop_level(&new_version).await?;
    assert_ne!(changed.id_level, first.id_level);
    assert!(changed.validation_level_ids.contains(&first.id_level));
    assert!(changed.validation_level_ids.contains(&changed.id_level));
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(&client
            .query_one(
                "SELECT blocks::text FROM public.level_metadata WHERE id_level=$1 ORDER BY id LIMIT 1",
                &[&first.id_level]
            )
            .await?
            .get::<_, String>(0))?,
        input.blocks
    );
    assert_eq!(
        client
            .query_one(
                "SELECT id_level FROM public.level_item WHERE workshop_id=$1 AND file_uid=$2",
                &[&workshop_id, &input.file_uid]
            )
            .await?
            .get::<_, i32>(0),
        changed.id_level
    );
    assert!(
        client
            .query_one(
                "SELECT to_regclass('zc_private.level_version_lineage') IS NULL",
                &[]
            )
            .await?
            .get::<_, bool>(0)
    );
    let membership_count = client
        .query_one(
            "SELECT count(*) FROM public.level_item WHERE workshop_id=$1",
            &[&workshop_id],
        )
        .await?
        .get::<_, i64>(0);
    database.upsert_workshop_level(&new_version).await?;
    assert_eq!(
        client
            .query_one(
                "SELECT count(*) FROM public.level_item WHERE workshop_id=$1",
                &[&workshop_id]
            )
            .await?
            .get::<_, i64>(0),
        membership_count
    );
    Ok(())
}
