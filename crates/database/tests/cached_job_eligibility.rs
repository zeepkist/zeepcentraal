use anyhow::{Result, ensure};
use tokio_postgres::{Client, NoTls};
use zc_database::{Database, services::jobs::MaintenanceOutcome};

async fn refresh_positions(database: &Database) -> Result<()> {
    let mut after = 0;
    let mut pages = 0;
    loop {
        let page = database.level_contribution_user_page(1, after, 50).await?;
        ensure!(
            matches!(
                database
                    .reconcile_level_contribution_users(1, &page.user_ids)
                    .await?,
                MaintenanceOutcome::Applied(_)
            ),
            "uncontended fixture repair required"
        );
        pages += 1;
        let Some(next) = page.next_after_user_id else {
            break;
        };
        after = next;
    }
    assert!(pages >= 2, "fixture must exercise multiple cursor pages");
    Ok(())
}

async fn assert_positions(client: &Client) -> Result<()> {
    let mismatch: i64 = client.query_one("WITH desired AS (SELECT pb.id_user,pb.id_record,RANK() OVER(ORDER BY r.time)::integer AS level_position FROM public.personal_best_global pb JOIN public.record r ON r.id=pb.id_record WHERE pb.id_level=1 AND NOT EXISTS(SELECT 1 FROM zc_private.record_validation v WHERE v.id_record=r.id AND v.status='fail')) SELECT count(*) FROM desired FULL JOIN (SELECT * FROM public.user_point_contribution WHERE id_level=1) actual USING(id_user) WHERE ROW(desired.id_record,desired.level_position) IS DISTINCT FROM ROW(actual.id_record,actual.level_position)", &[]).await?.get(0);
    assert_eq!(
        mismatch, 0,
        "cached ranks differ from validation-derived ranks"
    );
    Ok(())
}

#[tokio::test]
#[ignore = "requires local cached_job_eligibility_test with persisted eligibility migration and scoring schema"]
async fn cached_queries_preserve_activity_ranks_repairs_and_score_inputs() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/cached_job_eligibility_test",
        "Dedicated local cached_job_eligibility_test database required"
    );
    let (client, connection) = tokio_postgres::connect(&url, NoTls).await?;
    tokio::spawn(async move { connection.await.expect("cached eligibility connection") });
    client.batch_execute(r#"
      TRUNCATE public."user",public.level,public.record,public.personal_best_global,
        public.world_record_global,public.user_point_contribution,public.player_skill_aggregate,
        public.user_points,public.level_points,public.record_media,public.record_statistic,
        public.track_tournament,public.track_tournament_result,public.level_item,
        zc_private.record_validation,zc_jobs.job RESTART IDENTITY CASCADE;
      INSERT INTO public."user"(id,steam_id,banned) OVERRIDING SYSTEM VALUE
        SELECT id,100000+id,id=60 FROM generate_series(1,61) id;
      INSERT INTO public.level(id,hash,xx_hash,adventure) OVERRIDING SYSTEM VALUE
        SELECT id,'cached-'||id,md5(id::text),false FROM generate_series(1,3) id;
      INSERT INTO public.level_item(id_level,deleted) VALUES(1,false),(2,true);
      INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version) OVERRIDING SYSTEM VALUE
        SELECT id,id,1,((id+1)/2)::real,'test','test' FROM generate_series(1,60) id;
      INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version) OVERRIDING SYSTEM VALUE
        VALUES(61,1,2,10,'test','test'),(62,61,3,10,'test','test');
      INSERT INTO public.personal_best_global(id_user,id_level,id_record)
        SELECT id_user,id_level,id FROM public.record;
      INSERT INTO public.world_record_global(id_user,id_level,id_record) VALUES(1,1,1),(1,2,61),(61,3,62);
      INSERT INTO public.level_points(id_level,points) SELECT id,1000 FROM generate_series(1,3) id;
      INSERT INTO public.user_point_contribution(id_user,id_level,id_record,contribution_rank,level_position,level_points,level_decayed_points,player_decayed_points,date_calculated)
        SELECT id_user,id_level,id,1,999,1000,1,1,now() FROM public.record;
      INSERT INTO zc_private.record_validation(id_record,id_user,id_level,status,report,validator_version)
        VALUES(1,1,1,'fail','{}','test'),(2,2,1,'pass','{}','test'),
          (3,3,1,'pending','{}','test'),(4,4,1,'uncertain','{}','test'),(62,61,3,'fail','{}','test');
    "#).await?;
    let database = Database::connect(&url, 4).await?;
    let activity = database.user_activity_page(0, 1000).await?;
    for user in activity {
        let expected: bool = client.query_one("SELECT EXISTS(SELECT 1 FROM public.record r WHERE r.id_user=$1 AND r.date_created>=clock_timestamp()-interval '6 months' AND NOT EXISTS(SELECT 1 FROM zc_private.record_validation v WHERE v.id_record=r.id AND v.status='fail'))", &[&user.id_user]).await?.get(0);
        assert_eq!(user.active, expected);
    }
    // Failed PB remains discoverable through its stale contribution until repair removes it.
    assert!(
        database
            .level_contribution_user_page(1, 0, 50)
            .await?
            .user_ids
            .contains(&1)
    );
    refresh_positions(&database).await?;
    assert_positions(&client).await?;
    assert_eq!(client.query_one("SELECT count(*) FROM public.user_point_contribution WHERE id_user=1 AND id_level=1", &[]).await?.get::<_,i64>(0),0);

    // Improved PB on page two changes users on every page, including tied times.
    client.batch_execute("INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version) OVERRIDING SYSTEM VALUE VALUES(63,56,1,0.5,'test','test'); UPDATE public.personal_best_global SET id_record=63 WHERE id_user=56 AND id_level=1").await?;
    refresh_positions(&database).await?;
    assert_positions(&client).await?;
    assert_eq!(client.query_one("SELECT level_position FROM public.user_point_contribution WHERE id_user=56 AND id_level=1",&[]).await?.get::<_,i32>(0),1);

    // Cached predicates agree under both bypass-RLS and restricted SELECT roles.
    let cached =
        "SELECT array_agg(r.id ORDER BY r.id) FROM public.record r WHERE r.record_eligible";
    let expected: Vec<i32> = client.query_one("SELECT array_agg(r.id ORDER BY r.id) FROM public.record r WHERE NOT EXISTS(SELECT 1 FROM zc_private.record_validation v WHERE v.id_record=r.id AND v.status='fail')",&[]).await?.get(0);
    assert_eq!(
        client.query_one(cached, &[]).await?.get::<_, Vec<i32>>(0),
        expected
    );
    client.batch_execute("GRANT USAGE ON SCHEMA public,zc_private TO zeepcentraal_graphql; GRANT SELECT ON ALL TABLES IN SCHEMA public TO zeepcentraal_graphql; SET ROLE zeepcentraal_graphql").await?;
    assert_eq!(
        client.query_one(cached, &[]).await?.get::<_, Vec<i32>>(0),
        expected
    );
    client.batch_execute("RESET ROLE").await?;

    database.rebuild_player_skill_aggregates().await?;
    assert!(matches!(
        database.update_level_scores(&[1], false).await?,
        MaintenanceOutcome::Applied(_)
    ));
    assert!(matches!(
        database.update_level_scores(&[2], false).await?,
        MaintenanceOutcome::Applied(_)
    ));
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
    assert_eq!(
        database.reconcile_record_eligibility(1).await?,
        MaintenanceOutcome::Applied(())
    );
    assert_eq!(
        client
            .query_one(
                "SELECT id_user FROM public.world_record_global WHERE id_level=1",
                &[]
            )
            .await?
            .get::<_, i32>(0),
        56
    );
    assert_eq!(client.query_one("SELECT count(*) FROM public.personal_best_global WHERE id_level=1 AND id_user IN(1,60)",&[]).await?.get::<_,i64>(0),0);

    // Restoration repairs PB/WR and counts without reviving unavailable level counts.
    client
        .batch_execute("UPDATE zc_private.record_validation SET status='pass' WHERE id_record=1")
        .await?;
    assert_eq!(
        database.reconcile_record_eligibility(1).await?,
        MaintenanceOutcome::Applied(())
    );
    let counts = client
        .query_one(
            "SELECT personal_bests,world_records FROM zc_private.user_record_counts(ARRAY[1])",
            &[],
        )
        .await?;
    assert_eq!((counts.get::<_, i32>(0), counts.get::<_, i32>(1)), (1, 0));
    Ok(())
}
