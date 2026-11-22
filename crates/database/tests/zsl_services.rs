use zc_database::services::zsl::{RankedLevelResult, RankedResult};

#[tokio::test]
#[ignore = "requires disposable PostgreSQL cloned from current Drizzle schema"]
async fn zsl_import_services_are_idempotent() -> anyhow::Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    anyhow::ensure!(
        url::Url::parse(&url)?
            .host_str()
            .is_some_and(|host| matches!(host, "127.0.0.1" | "localhost")),
        "ZSL integration test requires local disposable PostgreSQL"
    );
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("PostgreSQL connection") });
    let suffix = std::process::id();
    let season_name = format!("rust-zsl-test-{suffix}");
    let steam_id = 76_561_198_999_000_000_i64 + i64::from(suffix);
    let workshop_id = 3_900_000_000_i64 + i64::from(suffix);
    let file_uid = format!("rust-zsl-test-{suffix}");
    let points_id: i32 = client
        .query_one(
            include_str!("fixtures/zsl_services/insert_zsl_points_structure.sql"),
            &[&season_name],
        )
        .await?
        .get(0);
    let database = zc_database::Database::connect(&url, 2).await?;
    let users = database
        .upsert_zsl_users(&[(steam_id, "Rust ZSL User".to_owned())])
        .await?;
    let id_user = users[&steam_id];
    let id_level: i32 = client
        .query_one(
            include_str!("fixtures/zsl_services/insert_level.sql"),
            &[&format!("legacy-{suffix}"), &format!("{suffix:032X}")],
        )
        .await?
        .get(0);
    client
        .execute(
            include_str!("fixtures/zsl_services/insert_workshop_item.sql"),
            &[&workshop_id, &steam_id],
        )
        .await?;
    client
        .execute(
            include_str!("fixtures/zsl_services/insert_level_item.sql"),
            &[&id_level, &workshop_id, &steam_id, &file_uid],
        )
        .await?;

    let season = database
        .get_or_create_zsl_season(&season_name, points_id, "2025-01-01", "2025-01-08")
        .await?;
    assert_eq!(
        database
            .get_or_create_zsl_season(&season_name, points_id, "2025-01-01", "2025-01-08")
            .await?
            .id,
        season.id
    );
    let round = database
        .get_or_create_zsl_round(season.id, 1, "Round", workshop_id, "2025-01-01")
        .await?;
    assert_eq!(
        database
            .get_or_create_zsl_round(season.id, 1, "Updated", workshop_id, "2025-01-02")
            .await?
            .id,
        round.id
    );
    database
        .get_or_create_zsl_round(season.id, 1, "Updated Again", 0, "2025-01-02")
        .await?;
    database
        .get_or_create_zsl_round(season.id, 1, "Updated Again", workshop_id + 1, "2025-01-02")
        .await?;
    let preserved: i64 = client
        .query_one(
            include_str!("fixtures/zsl_services/select_workshop_id_zsl_round.sql"),
            &[&round.id],
        )
        .await?
        .get(0);
    assert_eq!(preserved, workshop_id);
    assert!(database.zsl_event_is_future("2999-01-01").await?);
    assert_eq!(
        database
            .levels_by_file_uids(std::slice::from_ref(&file_uid))
            .await?[&file_uid],
        id_level
    );
    let zsl_level = database.get_or_create_zsl_level(round.id, id_level).await?;
    assert_eq!(
        database
            .get_or_create_zsl_level(round.id, id_level)
            .await?
            .id,
        zsl_level.id
    );

    database
        .upsert_zsl_season_results(&[RankedResult {
            id_parent: season.id,
            id_user,
            points: 20,
            position: 1,
        }])
        .await?;
    database
        .upsert_zsl_round_results(&[RankedResult {
            id_parent: round.id,
            id_user,
            points: 10,
            position: 1,
        }])
        .await?;
    database
        .upsert_zsl_level_results(&[RankedLevelResult {
            id_level: zsl_level.id,
            id_user,
            points: 8,
            position: 2,
            time: 12.5,
        }])
        .await?;
    database
        .upsert_zsl_level_results(&[RankedLevelResult {
            id_level: zsl_level.id,
            id_user,
            points: 10,
            position: 1,
            time: 12.0,
        }])
        .await?;
    let result = client
        .query_one(
            include_str!("fixtures/zsl_services/select_points_zsl_level_result.sql"),
            &[&zsl_level.id, &id_user],
        )
        .await?;
    assert_eq!(result.get::<_, i32>(0), 10);
    assert_eq!(result.get::<_, i32>(1), 1);
    assert_eq!(result.get::<_, f32>(2), 12.0);

    client
        .execute(
            include_str!("fixtures/zsl_services/delete_zsl_season.sql"),
            &[&season.id],
        )
        .await?;
    client
        .execute(
            include_str!("fixtures/zsl_services/delete_level.sql"),
            &[&id_level],
        )
        .await?;
    client
        .execute(
            include_str!("fixtures/zsl_services/delete_workshop_item.sql"),
            &[&workshop_id],
        )
        .await?;
    client
        .execute(
            include_str!("fixtures/zsl_services/delete_user.sql"),
            &[&id_user],
        )
        .await?;
    client
        .execute(
            include_str!("fixtures/zsl_services/delete_zsl_points_structure.sql"),
            &[&points_id],
        )
        .await?;
    Ok(())
}
