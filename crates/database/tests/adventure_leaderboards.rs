use anyhow::{Result, ensure};

const UP: &str = include_str!("../migrations/20261108020000_adventure_leaderboards/up.sql");
const DOWN: &str = include_str!("../migrations/20261108020000_adventure_leaderboards/down.sql");
const FIXTURE: &str = include_str!("fixtures/adventure_leaderboards.sql");

#[tokio::test]
#[ignore = "requires disposable local adventure_leaderboard_test database"]
async fn adventure_ranking_membership_permissions_changes_and_rollback() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/adventure_leaderboard_test",
        "Dedicated local Adventure database required"
    );
    let (mut client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("Adventure test connection") });
    let tx = client.transaction().await?;
    tx.batch_execute(FIXTURE).await?;
    tx.batch_execute(UP).await?;
    assert_eq!(
        tx.query_one(
            "SELECT count(*)::int FROM public.adventure_leaderboard_scope",
            &[]
        )
        .await?
        .get::<_, i32>(0),
        18
    );
    tx.batch_execute("SET LOCAL ROLE zeepcentraal_graphql")
        .await?;
    let rows = tx.query("SELECT id_user,rank,completed_levels,total_time_ms FROM public.adventure_leaderboard_entry WHERE series='a' ORDER BY completed_levels DESC,total_time_ms,id_user", &[]).await?;
    assert_eq!(rows.len(), 65);
    assert_eq!(rows[0].get::<_, i32>(1), 1);
    assert_eq!(rows[1].get::<_, i32>(1), 1);
    assert_eq!(rows[2].get::<_, i32>(1), 3);
    assert_eq!(rows[3].get::<_, i32>(1), 3);
    assert_eq!(rows[4].get::<_, i32>(1), 5);
    assert_eq!(rows[0].get::<_, i64>(3), 120000);
    assert_eq!(
        tx.query_one(
            "SELECT total_levels FROM public.adventure_leaderboard_scope WHERE series=''",
            &[]
        )
        .await?
        .get::<_, i32>(0),
        18
    );
    assert_eq!(tx.query_one("SELECT count(*)::int FROM public.adventure_leaderboard_scope_missing_levels(public.adventure_leaderboard('a'),0)", &[]).await?.get::<_,i32>(0),2);
    assert_eq!(tx.query_one("SELECT rank FROM public.adventure_leaderboard_scope_player_entry(public.adventure_leaderboard('a'),65)", &[]).await?.get::<_,i32>(0),6);
    // Different completed sets cannot produce a time gap.
    assert!(tx.query_one("SELECT public.adventure_leaderboard_entry_gap_ms(e) FROM public.adventure_leaderboard_entry e WHERE series='a' AND id_user=5", &[]).await?.get::<_,Option<i64>>(0).is_some());
    assert!(tx.query_one("SELECT public.adventure_leaderboard_entry_gap_ms(e) FROM public.adventure_leaderboard_entry e WHERE series='a' AND id_user=4", &[]).await?.get::<_,Option<i64>>(0).is_none());
    tx.batch_execute("RESET ROLE; UPDATE public.record SET record_eligible=false WHERE id=1; UPDATE public.personal_best_global SET record_eligible=false WHERE id_record=1").await?;
    assert_eq!(tx.query_one("SELECT completed_levels FROM public.adventure_leaderboard_entry WHERE series='a' AND id_user=1", &[]).await?.get::<_,i32>(0),1);
    tx.batch_execute("INSERT INTO public.record VALUES(500,1,1,70,true); UPDATE public.personal_best_global SET id_record=500,record_eligible=true WHERE id_user=1 AND id_level=1").await?;
    assert_eq!(tx.query_one("SELECT total_time_ms FROM public.adventure_leaderboard_entry WHERE series='a' AND id_user=1", &[]).await?.get::<_,i64>(0),130000);
    tx.batch_execute("UPDATE public.\"user\" SET banned=true WHERE id=1; UPDATE public.level_item SET deleted=true WHERE id_level=2").await?;
    assert_eq!(
        tx.query_one(
            "SELECT total_levels FROM public.adventure_leaderboard_scope WHERE series='a'",
            &[]
        )
        .await?
        .get::<_, i32>(0),
        1
    );
    assert_eq!(
        tx.query_one(
            "SELECT count(*)::int FROM public.adventure_leaderboard_entry WHERE id_user=1",
            &[]
        )
        .await?
        .get::<_, i32>(0),
        0
    );
    tx.batch_execute("UPDATE public.level SET publicly_visible=false WHERE id=1")
        .await?;
    assert_eq!(
        tx.query_one(
            "SELECT total_levels FROM public.adventure_leaderboard_scope WHERE series='a'",
            &[]
        )
        .await?
        .get::<_, i32>(0),
        0
    );
    tx.batch_execute(DOWN).await?;
    tx.batch_execute(UP).await?;
    // Representative PB volume plus unrelated history. Aggregation must use
    // PB references, not enumerate the decoy history on every request.
    tx.batch_execute(r#"
      UPDATE public.level SET publicly_visible=true;
      UPDATE public.level_item SET deleted=false;
      INSERT INTO public."user" SELECT i,false FROM generate_series(1000,2999) i;
      INSERT INTO public.record
       SELECT 1000+(u-1000)*18+l,u,l,10+l::real/100,true
       FROM generate_series(1000,2999) u CROSS JOIN generate_series(1,18) l;
      INSERT INTO public.personal_best_global SELECT id_user,id_level,id,true FROM public.record WHERE id>=1000;
      INSERT INTO public.record SELECT 1000000+i,1,19,100,true FROM generate_series(1,200000) i;
      CREATE INDEX fixture_pb_level_user ON public.personal_best_global(id_level,id_user);
      ANALYZE public.record; ANALYZE public.personal_best_global; ANALYZE public.level_item;
      ANALYZE public.level; ANALYZE public."user";
      SET LOCAL ROLE zeepcentraal_graphql;
    "#).await?;
    for scope in ["", "a", "xg"] {
        let plan = tx.query("EXPLAIN (ANALYZE,BUFFERS) SELECT * FROM public.adventure_leaderboard_entry WHERE series=$1 ORDER BY completed_levels DESC,total_time_ms,id_user LIMIT 50", &[&scope]).await?;
        let lines: Vec<String> = plan.iter().map(|row| row.get(0)).collect();
        ensure!(
            !lines
                .iter()
                .any(|line| line.contains("Seq Scan on record ")),
            "Leaderboard scans full history: {}",
            lines.join("\n")
        );
        println!("Adventure scope {scope:?}: {}", lines.last().unwrap());
        let count = tx
            .query_one(
                "SELECT count(*)::int FROM public.adventure_leaderboard_entry WHERE series=$1",
                &[&scope],
            )
            .await?
            .get::<_, i32>(0);
        ensure!(count >= 2000, "Benchmark participants missing");
        assert_eq!(tx.query_one("SELECT completed_levels FROM public.adventure_leaderboard_scope_player_entry(public.adventure_leaderboard($1),2999)", &[&scope]).await?.get::<_,i32>(0),if scope.is_empty(){18}else if scope=="a"{2}else{1});
    }
    tx.rollback().await?;
    Ok(())
}
