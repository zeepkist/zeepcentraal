use anyhow::{Context, Result, ensure};
use std::time::Duration;
use zc_database::{
    Database,
    services::jobs::{LevelScoreUpdate, MaintenanceOutcome},
};

const SELECT_XMIN_LEVEL_POINTS: &str =
    include_str!("fixtures/workshop_catalog/select_xmin_level_points.sql");

#[tokio::test(flavor = "multi_thread")]
#[ignore = "requires empty disposable local PostgreSQL named workshop_catalog_test"]
async fn catalog_deletion_zeroing_retry_adventure_and_scoring_lock() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/workshop_catalog_test",
        "Dedicated disposable workshop catalog database required"
    );
    let (mut client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("PostgreSQL connection") });
    client
        .batch_execute(include_str!("fixtures/workshop_catalog.sql"))
        .await?;
    client
        .batch_execute(include_str!("fixtures/workshop_catalog/insert_level.sql"))
        .await?;
    let database = Database::connect(&url, 4).await?;
    assert!(!database.workshop_sync_state().await?.contains_key(&-1));
    assert!(
        database
            .reconcile_missing_workshop_items(&[])
            .await?
            .is_empty()
    );
    assert!(
        database
            .reconcile_missing_workshop_items(&[0])
            .await
            .is_err()
    );
    assert!(
        database
            .reconcile_missing_workshop_items(&vec![10; 101])
            .await
            .is_err()
    );
    let missing = [10, 20, 40, 50, 60, 80];
    client
        .execute(
            include_str!("fixtures/workshop_catalog/alter_level_points.sql"),
            &[],
        )
        .await?;
    assert!(
        database
            .reconcile_missing_workshop_items(&missing)
            .await
            .is_err()
    );
    assert!(
        !client
            .query_one(
                include_str!("fixtures/workshop_catalog/select_deleted_level_item.sql"),
                &[]
            )
            .await?
            .get::<_, bool>(0)
    );
    assert_eq!(
        client
            .query_one(
                include_str!("fixtures/workshop_catalog/select_points_level_points.sql"),
                &[]
            )
            .await?
            .get::<_, i32>(0),
        1000
    );
    client
        .execute(
            include_str!("fixtures/workshop_catalog/alter_level_points_2.sql"),
            &[],
        )
        .await?;
    assert_eq!(
        database.reconcile_missing_workshop_items(&missing).await?,
        vec![1, 2, 4, 6, 7, 10]
    );
    let items = client
        .query(
            include_str!("fixtures/workshop_catalog/select_id_level_item.sql"),
            &[],
        )
        .await?;
    let deleted = items
        .iter()
        .filter(|row| row.get::<_, bool>(1))
        .map(|row| row.get::<_, i32>(0))
        .collect::<Vec<_>>();
    assert_eq!(deleted, vec![1, 2, 5, 6, 7, 10, 11]);
    let points = client
        .query(
            include_str!("fixtures/workshop_catalog/select_id_level_level_points.sql"),
            &[],
        )
        .await?;
    for row in points {
        let id = row.get::<_, i32>(0);
        assert_eq!(
            row.get::<_, i32>(1),
            if [1, 4, 6, 7, 10].contains(&id) {
                0
            } else {
                1000
            },
            "level {id}"
        );
    }
    // Simulate a failed enqueue after commit: deletion is complete, contribution repair remains.
    let versions = client
        .query(SELECT_XMIN_LEVEL_POINTS, &[])
        .await?
        .into_iter()
        .map(|row| row.get::<_, String>(0))
        .collect::<Vec<_>>();
    assert_eq!(
        database.reconcile_missing_workshop_items(&missing).await?,
        vec![1]
    );
    assert_eq!(
        database.update_level_scores(&[1], false).await?,
        MaintenanceOutcome::Applied(LevelScoreUpdate {
            points_changed: false,
            projection_needed: true,
        })
    );
    let repeated = client
        .query(SELECT_XMIN_LEVEL_POINTS, &[])
        .await?
        .into_iter()
        .map(|row| row.get::<_, String>(0))
        .collect::<Vec<_>>();
    assert_eq!(versions, repeated);
    client
        .execute(
            include_str!("fixtures/workshop_catalog/delete_user_point_contribution.sql"),
            &[],
        )
        .await?;
    assert!(
        database
            .reconcile_missing_workshop_items(&missing)
            .await?
            .is_empty()
    );

    // Deleting the last accessible copy now zeros shared level 2, but keeps Adventure levels.
    assert_eq!(
        database.reconcile_missing_workshop_items(&[30]).await?,
        vec![2, 7, 11]
    );
    assert_eq!(
        client
            .query_one(
                include_str!(
                    "fixtures/workshop_catalog/select_points_level_points_by_id_level_2.sql"
                ),
                &[]
            )
            .await?
            .get::<_, i32>(0),
        0
    );

    // A concurrent scoring transaction holds the same lock. No deletion may commit before it releases.
    let blocker = client.transaction().await?;
    blocker
        .execute(
            include_str!("fixtures/workshop_catalog/pg_advisory_xact_lock.sql"),
            &[],
        )
        .await?;
    let concurrent_database = database.clone();
    let mut reconcile = tokio::spawn(async move {
        concurrent_database
            .reconcile_missing_workshop_items(&[70])
            .await
    });
    assert!(
        tokio::time::timeout(Duration::from_millis(150), &mut reconcile)
            .await
            .is_err()
    );
    assert!(
        !blocker
            .query_one(
                include_str!(
                    "fixtures/workshop_catalog/select_deleted_level_item_by_id_level_9.sql"
                ),
                &[]
            )
            .await?
            .get::<_, bool>(0)
    );
    blocker
        .execute(
            include_str!("fixtures/workshop_catalog/set_points_level_points.sql"),
            &[],
        )
        .await?;
    blocker.commit().await?;
    assert_eq!(
        tokio::time::timeout(Duration::from_secs(2), reconcile)
            .await
            .context("reconciliation stayed blocked")???,
        vec![9]
    );
    assert_eq!(
        client
            .query_one(
                include_str!(
                    "fixtures/workshop_catalog/select_points_level_points_by_id_level_9.sql"
                ),
                &[]
            )
            .await?
            .get::<_, i32>(0),
        0
    );
    Ok(())
}
