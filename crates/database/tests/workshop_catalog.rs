use anyhow::{Context, Result, ensure};
use std::time::Duration;
use zc_database::{
    Database,
    services::jobs::{LevelScoreUpdate, MaintenanceOutcome},
};

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
    client.batch_execute(
        "INSERT INTO public.level(id,adventure) SELECT id,id IN(3,5) FROM generate_series(1,11) id;
         INSERT INTO public.workshop_item SELECT id FROM generate_series(10,80,10) id;
         INSERT INTO public.workshop_item VALUES(-1);
         INSERT INTO public.level_item(id,id_level,workshop_id,deleted,publicly_visible) VALUES
         (1,1,10,false,true),(2,2,20,false,true),(3,2,30,false,true),
         (4,3,40,false,true),(5,4,40,false,true),(6,6,50,true,true),
         (7,7,60,false,true),(8,7,30,false,false),(9,9,70,false,true),
         (10,10,80,false,true),(11,10,80,false,true),(12,11,30,false,true),(13,5,-1,false,true);
         INSERT INTO public.level_points(id_level,points) SELECT id,1000 FROM public.level WHERE id<>4;
         INSERT INTO public.user_point_contribution VALUES(1,1,1,1,1000,1000);"
    ).await?;
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
    client.execute(
        "ALTER TABLE public.level_points ADD CONSTRAINT catalog_zero_failure CHECK(id_level<>4)",
        &[],
    ).await?;
    assert!(
        database
            .reconcile_missing_workshop_items(&missing)
            .await
            .is_err()
    );
    assert!(
        !client
            .query_one("SELECT deleted FROM public.level_item WHERE id=1", &[])
            .await?
            .get::<_, bool>(0)
    );
    assert_eq!(
        client
            .query_one(
                "SELECT points FROM public.level_points WHERE id_level=1",
                &[]
            )
            .await?
            .get::<_, i32>(0),
        1000
    );
    client
        .execute(
            "ALTER TABLE public.level_points DROP CONSTRAINT catalog_zero_failure",
            &[],
        )
        .await?;
    assert_eq!(
        database.reconcile_missing_workshop_items(&missing).await?,
        vec![1, 2, 4, 6, 7, 10]
    );
    let items = client
        .query("SELECT id,deleted FROM public.level_item ORDER BY id", &[])
        .await?;
    let deleted = items
        .iter()
        .filter(|row| row.get::<_, bool>(1))
        .map(|row| row.get::<_, i32>(0))
        .collect::<Vec<_>>();
    assert_eq!(deleted, vec![1, 2, 5, 6, 7, 10, 11]);
    let points = client
        .query(
            "SELECT id_level,points FROM public.level_points ORDER BY id_level",
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
        .query(
            "SELECT xmin::text FROM public.level_points ORDER BY id_level",
            &[],
        )
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
        .query(
            "SELECT xmin::text FROM public.level_points ORDER BY id_level",
            &[],
        )
        .await?
        .into_iter()
        .map(|row| row.get::<_, String>(0))
        .collect::<Vec<_>>();
    assert_eq!(versions, repeated);
    client
        .execute(
            "DELETE FROM public.user_point_contribution WHERE id_level=1",
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
                "SELECT points FROM public.level_points WHERE id_level=2",
                &[]
            )
            .await?
            .get::<_, i32>(0),
        0
    );

    // A concurrent scoring transaction holds the same lock. No deletion may commit before it releases.
    let blocker = client.transaction().await?;
    blocker
        .execute("SELECT pg_advisory_xact_lock(1861284954,9)", &[])
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
                "SELECT deleted FROM public.level_item WHERE id_level=9",
                &[]
            )
            .await?
            .get::<_, bool>(0)
    );
    blocker
        .execute(
            "UPDATE public.level_points SET points=2000 WHERE id_level=9",
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
                "SELECT points FROM public.level_points WHERE id_level=9",
                &[]
            )
            .await?
            .get::<_, i32>(0),
        0
    );
    Ok(())
}
