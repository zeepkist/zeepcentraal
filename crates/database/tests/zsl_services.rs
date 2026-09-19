use zc_database::services::zsl::{RankedLevelResult, RankedResult};

#[tokio::test]
#[ignore = "requires disposable PostgreSQL cloned from current Drizzle schema"]
async fn zsl_import_services_are_idempotent() -> anyhow::Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
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
            "INSERT INTO zsl_points_structure(name,points,minimum_points,best_of) \
             VALUES($1,ARRAY[10,8,6],1,3) RETURNING id",
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
            "INSERT INTO level(hash,xx_hash) VALUES($1,$2) RETURNING id",
            &[&format!("legacy-{suffix}"), &format!("{suffix:032X}")],
        )
        .await?
        .get(0);
    client
        .execute(
            "INSERT INTO workshop_item(workshop_id,author_id,name,image_url) \
             VALUES($1,$2,'Rust ZSL Workshop','')",
            &[&workshop_id, &steam_id],
        )
        .await?;
    client
        .execute(
            "INSERT INTO level_item(id_level,workshop_id,author_id,name,image_url,file_author, \
             file_uid,validation_time_author,validation_time_gold,validation_time_silver, \
             validation_time_bronze,deleted,created_at,updated_at) \
             VALUES($1,$2,$3,'Rust ZSL Level','','',$4,1,2,3,4,false,now(),now())",
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
            "SELECT points,position,time FROM zsl_level_result \
             WHERE id_level=$1 AND id_user=$2",
            &[&zsl_level.id, &id_user],
        )
        .await?;
    assert_eq!(result.get::<_, i32>(0), 10);
    assert_eq!(result.get::<_, i32>(1), 1);
    assert_eq!(result.get::<_, f32>(2), 12.0);

    client
        .execute("DELETE FROM zsl_season WHERE id=$1", &[&season.id])
        .await?;
    client
        .execute("DELETE FROM level WHERE id=$1", &[&id_level])
        .await?;
    client
        .execute(
            "DELETE FROM workshop_item WHERE workshop_id=$1",
            &[&workshop_id],
        )
        .await?;
    client
        .execute("DELETE FROM \"user\" WHERE id=$1", &[&id_user])
        .await?;
    client
        .execute(
            "DELETE FROM zsl_points_structure WHERE id=$1",
            &[&points_id],
        )
        .await?;
    Ok(())
}
