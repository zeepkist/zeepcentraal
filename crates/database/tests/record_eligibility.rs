use anyhow::{Result, ensure};
use zc_core::ghost_validation::ValidationReport;
use zc_database::Database;

#[tokio::test]
#[ignore = "requires isolated record_eligibility_test with current schema and eligibility migrations"]
async fn repairs_visibility_assignments_tournaments_and_rollback() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/record_eligibility_test",
        "Isolated local database required"
    );
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("fixture connection") });
    let persisted_eligibility = client.query_one("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='record' AND column_name='record_eligible')", &[]).await?.get::<_,bool>(0);
    client.batch_execute(r#"
      TRUNCATE public."user",public.level,public.discord_activity_event,zc_jobs.job RESTART IDENTITY CASCADE;
      INSERT INTO public."user"(id,steam_id,banned) OVERRIDING SYSTEM VALUE VALUES(1,42,false),(2,43,false),(3,44,true),(4,45,false);
      INSERT INTO public.level(id,hash,xx_hash,publicly_visible,adventure) OVERRIDING SYSTEM VALUE VALUES(1,'fixture',repeat('a',32),true,true),(2,'empty',repeat('b',32),true,true);
      INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version,date_created) OVERRIDING SYSTEM VALUE VALUES
       (1,1,1,10,'test','test','2026-01-01'),(2,1,1,12,'test','test','2026-01-02'),
       (3,2,1,11,'test','test','2026-01-03'),(4,2,1,11,'test','test','2026-01-04'),
       (5,3,1,1,'test','test','2026-01-05'),(6,4,1,15,'test','test','2026-01-06'),
       (7,1,2,5,'test','test','2026-01-07');
      INSERT INTO public.record_media(id_record,ghost_url) VALUES(1,'fixture-ghost'),(2,'fixture-ghost-2');
      INSERT INTO public.record_statistic(id_record,ghost_version) VALUES(1,8),(2,8);
      INSERT INTO public.personal_best_global(id_user,id_level,id_record) VALUES(1,1,1),(2,1,3),(1,2,7);
      INSERT INTO public.world_record_global(id_user,id_level,id_record) VALUES(1,1,1),(1,2,7);
      INSERT INTO public.track_tournament(id,type,slug,id_level,start_at,end_at,finalized_at) OVERRIDING SYSTEM VALUE VALUES
       (1,0,'active',1,'2026-01-01','2026-01-04',NULL),
       (2,1,'finalized',1,'2026-01-01','2026-01-04','2026-01-05');
      INSERT INTO public.track_tournament_result(id_tournament,id_user,id_record,time,rank,points)
       VALUES(1,1,1,10,1,1000),(2,1,1,10,1,1000);
      GRANT USAGE ON SCHEMA public,zc_private TO zeepcentraal_graphql;
      GRANT SELECT ON ALL TABLES IN SCHEMA public TO zeepcentraal_graphql;
      GRANT SELECT ON zc_private.record_history_index TO zeepcentraal_graphql;
    "#).await?;
    let db = Database::connect(&url, 4).await?;
    let original = client
        .query_one(
            "SELECT (to_jsonb(r)-'record_eligible')::text FROM public.record r WHERE id=1",
            &[],
        )
        .await?
        .get::<_, String>(0);
    let pb=client.query_one("SELECT id,date_created::text FROM public.personal_best_global WHERE id_user=1 AND id_level=1",&[]).await?;
    let events = client
        .query_one("SELECT count(*) FROM public.discord_activity_event", &[])
        .await?
        .get::<_, i64>(0);
    db.save_record_validation(1, None, &ValidationReport::failed("missing_checkpoint"))
        .await?;
    let count = client
        .query_one(
            "SELECT count(*) FROM zc_jobs.job WHERE task='reconcileRecordEligibility'",
            &[],
        )
        .await?
        .get::<_, i64>(0);
    assert_eq!(count, 1);
    db.save_record_validation(1, None, &ValidationReport::failed("missing_checkpoint"))
        .await?;
    assert_eq!(
        client
            .query_one(
                "SELECT count(*) FROM zc_jobs.job WHERE task='reconcileRecordEligibility'",
                &[]
            )
            .await?
            .get::<_, i64>(0),
        count
    );
    client
        .batch_execute("SET ROLE zeepcentraal_graphql")
        .await?;
    assert!(
        client
            .query("SELECT report FROM zc_private.record_validation", &[])
            .await
            .is_err(),
        "detailed evidence stays private"
    );
    assert_eq!(
        client
            .query_one(
                "SELECT count(*) FROM public.track_tournament_result WHERE id_tournament=2",
                &[]
            )
            .await?
            .get::<_, i64>(0),
        1,
        "finalized snapshot stays visible"
    );
    assert!(client.query_one("SELECT r.id FROM public.track_tournament_result t LEFT JOIN public.record r ON r.id=t.id_record WHERE t.id_tournament=2",&[]).await?.get::<_,Option<i32>>(0).is_none(),"failed record relationship hidden");
    for sql in [
        "SELECT count(*) FROM public.record WHERE id=1",
        "SELECT count(*) FROM public.record_media WHERE id_record=1",
        "SELECT count(*) FROM public.record_statistic WHERE id_record=1",
        "SELECT count(*) FROM public.personal_best_global WHERE id_record=1",
        "SELECT count(*) FROM public.world_record_global WHERE id_record=1",
        "SELECT count(*) FROM public.record_history_entry WHERE id=1",
    ] {
        assert_eq!(
            client.query_one(sql, &[]).await?.get::<_, i64>(0),
            0,
            "{sql}"
        );
    }
    assert_eq!(
        client
            .query_one("SELECT count(*) FROM public.record WHERE id=2", &[])
            .await?
            .get::<_, i64>(0),
        1
    );
    client.batch_execute("RESET ROLE").await?;
    client.batch_execute("SELECT setval(pg_get_serial_sequence('public.record','id'),(SELECT max(id) FROM public.record))").await?;
    let statistics = zc_core::ghosts::GhostStatistics::default();
    let submitted = db
        .submit_record(zc_database::services::record::RecordSubmission {
            evidence: None,
            id_user: 1,
            id_level: 1,
            time: 15.,
            game_version: "test",
            mod_version: "test",
            splits: &[],
            speeds: &[],
            statistics: &statistics,
        })
        .await?;
    assert!(
        !submitted.personal_best_changed,
        "slower run cannot replace eligible backup PB"
    );
    assert!(
        submitted.world_record_user_ids.is_empty(),
        "slower run cannot be announced as WR"
    );
    client
        .batch_execute("BEGIN; SELECT pg_advisory_xact_lock(1869000001,1)")
        .await?;
    assert!(matches!(
        db.reconcile_record_eligibility(1).await?,
        zc_database::services::jobs::MaintenanceOutcome::Contended
    ));
    client.batch_execute("ROLLBACK").await?;
    let (first, second) = tokio::join!(
        db.reconcile_record_eligibility(1),
        db.reconcile_record_eligibility(1)
    );
    first?;
    second?;
    let updated=client.query_one("SELECT id,id_record,date_created::text FROM public.personal_best_global WHERE id_user=1 AND id_level=1",&[]).await?;
    assert_eq!(updated.get::<_, i32>(0), pb.get::<_, i32>(0));
    assert_eq!(updated.get::<_, i32>(1), 2);
    assert_eq!(updated.get::<_, String>(2), pb.get::<_, String>(1));
    assert_eq!(
        client
            .query_one(
                "SELECT id_record FROM public.world_record_global WHERE id_level=1",
                &[]
            )
            .await?
            .get::<_, i32>(0),
        3
    );
    assert_eq!(
        client
            .query_one(
                "SELECT count(*) FROM public.personal_best_global WHERE id_user=3",
                &[]
            )
            .await?
            .get::<_, i64>(0),
        0,
        "banned player"
    );
    assert_eq!(client.query_one("SELECT id_record FROM public.track_tournament_result WHERE id_tournament=1 AND id_user=1",&[]).await?.get::<_,i32>(0),2);
    assert_eq!(client.query_one("SELECT id_record FROM public.track_tournament_result WHERE id_tournament=2 AND id_user=1",&[]).await?.get::<_,i32>(0),1,"finalized result preserved");
    assert_eq!(client.query_one("SELECT count(*) FROM public.track_tournament_result WHERE id_tournament=1 AND id_user=4",&[]).await?.get::<_,i64>(0),0,"outside original window");
    assert_eq!(
        client
            .query_one("SELECT count(*) FROM public.discord_activity_event", &[])
            .await?
            .get::<_, i64>(0),
        events,
        "silent corrections"
    );
    client
        .batch_execute("INSERT INTO public.level_points(id_level,points,rating) VALUES(1,100,0)")
        .await?;
    let projection = db.reconcile_level_contribution_users(1, &[1, 2, 4]).await?;
    assert!(matches!(
        projection,
        zc_database::services::jobs::MaintenanceOutcome::Applied(_)
    ));
    db.recalculate_player_score(1).await?;
    assert_eq!(
        client
            .query_one(
                "SELECT total_points FROM public.user_points WHERE id_user=1",
                &[]
            )
            .await?
            .get::<_, i32>(0),
        99,
        "inactive totals use eligible contributions"
    );
    assert_eq!(client.query_one("SELECT id_record FROM public.user_point_contribution WHERE id_user=1 AND id_level=1",&[]).await?.get::<_,i32>(0),2);
    assert_eq!(
        client
            .query_one(
                "SELECT (to_jsonb(r)-'record_eligible')::text FROM public.record r WHERE id=1",
                &[]
            )
            .await?
            .get::<_, String>(0),
        original
    );
    let unchanged=client.query_one("SELECT date_updated::text FROM public.personal_best_global WHERE id_user=1 AND id_level=1",&[]).await?.get::<_,String>(0);
    db.reconcile_record_eligibility(1).await?;
    assert_eq!(client.query_one("SELECT date_updated::text FROM public.personal_best_global WHERE id_user=1 AND id_level=1",&[]).await?.get::<_,String>(0),unchanged);
    db.save_record_validation(1, None, &ValidationReport::uncertain("legacy"))
        .await?;
    db.reconcile_record_eligibility(1).await?;
    assert_eq!(
        client
            .query_one(
                "SELECT id_record FROM public.world_record_global WHERE id_level=1",
                &[]
            )
            .await?
            .get::<_, i32>(0),
        1,
        "automatic restoration"
    );
    db.save_record_validation(7, None, &ValidationReport::failed("missing_ghost"))
        .await?;
    db.reconcile_record_eligibility(2).await?;
    assert_eq!(
        client
            .query_one(
                "SELECT count(*) FROM public.personal_best_global WHERE id_level=2",
                &[]
            )
            .await?
            .get::<_, i64>(0),
        0
    );
    assert_eq!(
        client
            .query_one(
                "SELECT count(*) FROM public.world_record_global WHERE id_level=2",
                &[]
            )
            .await?
            .get::<_, i64>(0),
        0
    );
    client
        .batch_execute("DELETE FROM zc_private.record_validation WHERE id_record=7")
        .await?;
    db.reconcile_record_eligibility(2).await?;
    db.reconcile_level_contribution_users(1, &[1, 2, 3, 4])
        .await?;
    for id in 1..=4 {
        db.recalculate_player_score(id).await?;
    }
    let ranks = db.player_rank_snapshot().await?;
    db.persist_player_rank_batch_with_notifications(&ranks, false)
        .await?;
    assert!(db.record_eligibility_level_current(1).await?);
    assert!(db.record_eligibility_scores_current().await?);
    assert_eq!(
        client
            .query_one(
                "SELECT id_record FROM public.world_record_global WHERE id_level=2",
                &[]
            )
            .await?
            .get::<_, i32>(0),
        7,
        "validation deletion restores eligibility"
    );
    client.batch_execute("BEGIN; UPDATE zc_private.record_validation SET status='fail' WHERE id_record=1; ROLLBACK").await?;
    assert!(
        client
            .query_one("SELECT zc_private.record_is_eligible(1)", &[])
            .await?
            .get::<_, bool>(0)
    );
    if persisted_eligibility {
        client
            .batch_execute(include_str!(
                "../migrations/20261013020000_persist_record_eligibility/down.sql"
            ))
            .await?;
    }
    client
        .batch_execute(include_str!(
            "../migrations/20261012010000_record_eligibility/down.sql"
        ))
        .await?;
    assert_eq!(
        client
            .query_one(
                "SELECT count(*) FROM pg_policy WHERE polname='record_eligibility'",
                &[]
            )
            .await?
            .get::<_, i64>(0),
        0
    );
    client
        .batch_execute(include_str!(
            "../migrations/20261012010000_record_eligibility/up.sql"
        ))
        .await?;
    if persisted_eligibility {
        client
            .batch_execute(include_str!(
                "../migrations/20261013020000_persist_record_eligibility/up.sql"
            ))
            .await?;
    }
    client.batch_execute("INSERT INTO public.level(id,hash,xx_hash) OVERRIDING SYSTEM VALUE SELECT id,'fixture-'||id,md5(id::text) FROM generate_series(10,110) id; INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version) OVERRIDING SYSTEM VALUE SELECT id+990,1,id,10,'test','test' FROM generate_series(10,110) id").await?;
    db.save_checked_record_validations(
        &(1000..=1100).collect::<Vec<_>>(),
        None,
        &ValidationReport::failed("missing_ghost"),
        "epoch",
    )
    .await?;
    assert_eq!(db.failed_record_level_page(0, 110).await?.len(), 100);
    assert_eq!(db.failed_record_level_page(109, 110).await?, vec![110]);
    assert!(db.failed_record_level_page(109, 109).await?.is_empty());
    assert_eq!(
        db.failed_record_level_page(50, 55).await?,
        vec![51, 52, 53, 54, 55]
    );
    Ok(())
}

#[tokio::test]
#[ignore = "requires empty record_eligibility_benchmark_test with current schema and eligibility migrations"]
async fn production_sized_eligibility_queries() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1")
            && parsed.path() == "/record_eligibility_benchmark_test",
        "Isolated benchmark database required"
    );
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("benchmark connection") });
    if client
        .query_one("SELECT count(*) FROM public.record", &[])
        .await?
        .get::<_, i64>(0)
        == 0
    {
        client
            .batch_execute(include_str!("fixtures/record_eligibility_benchmark.sql"))
            .await?;
    }
    let counts=client.query("SELECT status,count(*) FROM zc_private.record_validation GROUP BY status ORDER BY status",&[]).await?;
    assert_eq!(
        counts
            .iter()
            .map(|r| (r.get::<_, String>(0), r.get::<_, i64>(1)))
            .collect::<Vec<_>>(),
        vec![
            ("fail".into(), 626386),
            ("pass".into(), 2048),
            ("uncertain".into(), 3301323)
        ]
    );
    let mut plans = String::new();
    for sql in [
        "SELECT r.id,r.time FROM public.record r WHERE id_level=20000 AND zc_private.record_is_eligible(r.id) ORDER BY r.time,r.id LIMIT 20",
        "SELECT l.id FROM public.level l WHERE l.id>10000 AND l.id<=49122 AND EXISTS(SELECT 1 FROM public.record r JOIN zc_private.record_validation v ON v.id_record=r.id WHERE r.id_level=l.id AND v.status='fail') ORDER BY l.id LIMIT 100",
        "SELECT count(*) FROM public.record r WHERE NOT EXISTS(SELECT 1 FROM zc_private.record_validation v WHERE v.id_record=r.id AND v.status='fail')",
    ] {
        plans.push_str(sql);
        plans.push('\n');
        for row in client
            .query(&format!("EXPLAIN (ANALYZE,BUFFERS) {sql}"), &[])
            .await?
        {
            plans.push_str(&row.get::<_, String>(0));
            plans.push('\n');
        }
    }
    let db = Database::connect(&url, 2).await?;
    let started = std::time::Instant::now();
    assert!(matches!(
        db.reconcile_record_eligibility(20000).await?,
        zc_database::services::jobs::MaintenanceOutcome::Applied(())
    ));
    plans.push_str(&format!(
        "Level repair elapsed_ms={}\n",
        started.elapsed().as_millis()
    ));
    std::fs::write(
        "../../.local/ghost-validation/eligibility-benchmark-plans.txt",
        plans,
    )?;
    Ok(())
}
