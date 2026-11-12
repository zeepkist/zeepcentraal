use anyhow::{Result, ensure};

const ORIGINAL_UP: &str = include_str!("../migrations/20261112000000_competitive_medals/up.sql");
const UP: &str = include_str!("../migrations/20261112010000_medal_times_on_level_items/up.sql");
const ORIGINAL_DOWN: &str =
    include_str!("../migrations/20261112000000_competitive_medals/down.sql");
const DOWN: &str = include_str!("../migrations/20261112010000_medal_times_on_level_items/down.sql");

#[tokio::test]
#[ignore = "requires disposable local competitive_medal_test database"]
async fn backfill_lifecycle_permissions_counts_and_rollback() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/competitive_medal_test",
        "Dedicated local medal database required"
    );
    let (mut client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("medal test connection") });
    let tx = client.transaction().await?;
    tx.batch_execute(include_str!("fixtures/competitive_medals.sql"))
        .await?;
    tx.batch_execute(ORIGINAL_UP).await?;
    tx.batch_execute(UP).await?;
    tx.batch_execute("CREATE TABLE public.zsl_level(id integer PRIMARY KEY,id_level integer REFERENCES public.level); CREATE TABLE public.zsl_level_result(id_level integer REFERENCES public.zsl_level,id_user integer REFERENCES public.\"user\",id_record integer REFERENCES public.record,time real); GRANT SELECT ON public.zsl_level,public.zsl_level_result TO zeepcentraal_graphql; INSERT INTO public.zsl_level VALUES(615,1); INSERT INTO public.zsl_level_result SELECT 615,position,NULL,time FROM unnest(ARRAY[35,38,40,45,50,60,61]::real[]) WITH ORDINALITY input(time,position)").await?;
    tx.batch_execute(include_str!(
        "../migrations/20261112020000_zsl_result_medals/up.sql"
    ))
    .await?;
    let official_medals: Vec<Option<i16>> = tx.query("SELECT public.zsl_level_result_medal(result) FROM public.zsl_level_result result ORDER BY time", &[]).await?.iter().map(|row|row.get(0)).collect();
    assert_eq!(
        official_medals,
        vec![Some(5), Some(4), Some(3), Some(2), Some(1), Some(0), None]
    );
    tx.batch_execute("SET LOCAL ROLE zeepcentraal_graphql")
        .await?;
    assert_eq!(tx.query_one("SELECT public.zsl_level_result_medal(result) FROM public.zsl_level_result result WHERE id_user=1", &[]).await?.get::<_, Option<i16>>(0),Some(5));
    tx.batch_execute("RESET ROLE; SAVEPOINT zsl_medal_checks; UPDATE public.zsl_level_result SET id_record=1 WHERE id_user=1; UPDATE public.record SET record_eligible=false WHERE id=1").await?;
    assert_eq!(tx.query_one("SELECT public.zsl_level_result_medal(result) FROM public.zsl_level_result result WHERE id_user=1", &[]).await?.get::<_, Option<i16>>(0),None);
    tx.batch_execute(
        "ROLLBACK TO SAVEPOINT zsl_medal_checks; UPDATE public.\"user\" SET banned=true WHERE id=1",
    )
    .await?;
    assert_eq!(tx.query_one("SELECT public.zsl_level_result_medal(result) FROM public.zsl_level_result result WHERE id_user=1", &[]).await?.get::<_, Option<i16>>(0),None);
    tx.batch_execute("ROLLBACK TO SAVEPOINT zsl_medal_checks; INSERT INTO public.level_item(id,id_level,validation_time_author,validation_time_expert,validation_time_apex,updated_at) VALUES(900,1,39,37,36,now()+interval '1 day')").await?;
    assert_eq!(tx.query_one("SELECT public.zsl_level_result_medal(result) FROM public.zsl_level_result result WHERE id_user=2", &[]).await?.get::<_, Option<i16>>(0),Some(3));
    tx.batch_execute("UPDATE public.level_item SET deleted=true WHERE id=900")
        .await?;
    assert_eq!(tx.query_one("SELECT public.zsl_level_result_medal(result) FROM public.zsl_level_result result WHERE id_user=2", &[]).await?.get::<_, Option<i16>>(0),Some(4));
    tx.batch_execute("ROLLBACK TO SAVEPOINT zsl_medal_checks")
        .await?;
    tx.batch_execute(include_str!(
        "../migrations/20261112020000_zsl_result_medals/down.sql"
    ))
    .await?;
    assert!(tx.query_one("SELECT to_regprocedure('public.zsl_level_result_medal(public.zsl_level_result)') IS NULL", &[]).await?.get::<_,bool>(0));
    let thresholds = tx.query_one("SELECT zc_private.medal_milliseconds(validation_time_expert),zc_private.medal_milliseconds(validation_time_apex),coalesce(medal_calculation_version,0),medal_qualified_at IS NOT NULL,medal_due_at IS NULL FROM public.level_item WHERE id=1", &[]).await?;
    assert_eq!(thresholds.get::<_, Option<i64>>(0), Some(38251));
    assert_eq!(thresholds.get::<_, Option<i64>>(1), Some(36809));
    assert_eq!(thresholds.get::<_, i32>(2), 1);
    assert!(thresholds.get::<_, bool>(3) && thresholds.get::<_, bool>(4));
    assert_eq!(
        tx.query_one(
            "SELECT count(*)::int FROM public.personal_best_global WHERE medal=5",
            &[]
        )
        .await?
        .get::<_, i32>(0),
        5
    );
    assert_eq!(
        tx.query_one(
            "SELECT count(*)::int FROM public.personal_best_global WHERE medal=4",
            &[]
        )
        .await?
        .get::<_, i32>(0),
        4
    );
    assert!(tx.query_one("SELECT to_regclass('public.level_medal_threshold') IS NULL AND to_regclass('zc_private.level_medal_revision') IS NULL", &[]).await?.get::<_,bool>(0));
    let base = tx.query_one("SELECT validation_time_author,validation_time_gold,validation_time_silver,validation_time_bronze FROM public.level_item WHERE id=1", &[]).await?;
    assert_eq!(
        [
            base.get::<_, f32>(0),
            base.get::<_, f32>(1),
            base.get::<_, f32>(2),
            base.get::<_, f32>(3)
        ],
        [40.0, 45.0, 50.0, 60.0]
    );
    assert_eq!(tx.query_one("SELECT count(*)::int FROM information_schema.columns WHERE table_schema='public' AND table_name='level_item' AND column_name LIKE 'validation_time_%'", &[]).await?.get::<_,i32>(0),6);
    assert_eq!(
        tx.query_one(
            "SELECT sum(medal_apex)::bigint FROM public.user_points",
            &[]
        )
        .await?
        .get::<_, i64>(0),
        5
    );
    tx.batch_execute("SELECT zc_private.refresh_level_medals(1)")
        .await?;
    assert_eq!(
        tx.query_one(
            "SELECT count(*)::int FROM zc_jobs.job WHERE task='updatePlayerScore'",
            &[]
        )
        .await?
        .get::<_, i32>(0),
        0
    );
    // Matching a threshold earns that tier. Float storage must not lose one millisecond.
    tx.batch_execute("INSERT INTO public.record(id,id_user,id_level,time) VALUES(20,11,1,38.251); INSERT INTO public.personal_best_global VALUES(20,11,1,20,true)").await?;
    assert_eq!(
        tx.query_one(
            "SELECT medal FROM public.personal_best_global WHERE id=20",
            &[]
        )
        .await?
        .get::<_, Option<i16>>(0),
        Some(4)
    );
    // Corrections preserve finalised thresholds without retaining history.
    tx.batch_execute("UPDATE public.record SET record_eligible=false WHERE id=1; UPDATE public.personal_best_global SET record_eligible=false WHERE id=1; SELECT zc_private.refresh_level_medals(1)").await?;
    assert_eq!(
        tx.query_one(
            "SELECT coalesce(medal_calculation_version,0) FROM public.level_item WHERE id=1",
            &[]
        )
        .await?
        .get::<_, i32>(0),
        1
    );
    assert!(
        tx.query_one(
            "SELECT medal FROM public.personal_best_global WHERE id=1",
            &[]
        )
        .await?
        .get::<_, Option<i16>>(0)
        .is_none()
    );
    // Metadata uses current PBs immediately; insufficient population suspends the pair.
    tx.batch_execute("UPDATE public.level_item SET validation_time_author=35 WHERE id=1; SELECT zc_private.refresh_level_medals(1)").await?;
    assert!(
        tx.query_one(
            "SELECT zc_private.medal_milliseconds(validation_time_expert) FROM public.level_item WHERE id=1",
            &[]
        )
        .await?
        .get::<_, Option<i64>>(0)
        .is_none()
    );
    assert_eq!(
        tx.query_one(
            "SELECT coalesce(medal_calculation_version,0) FROM public.level_item WHERE id=1",
            &[]
        )
        .await?
        .get::<_, i32>(0),
        0
    );
    tx.batch_execute("UPDATE public.level_item SET validation_time_author=41 WHERE id=1; SELECT zc_private.refresh_level_medals(1)").await?;
    assert!(
        tx.query_one(
            "SELECT zc_private.medal_milliseconds(validation_time_expert) FROM public.level_item WHERE id=1",
            &[]
        )
        .await?
        .get::<_, Option<i64>>(0)
        .is_some()
    );
    // New qualifications settle for seven days and retain their first deadline after a drop.
    tx.batch_execute("INSERT INTO public.record(id,id_user,id_level,time) VALUES(110,10,2,36); INSERT INTO public.personal_best_global VALUES(110,10,2,110,true); SELECT zc_private.refresh_level_medals(2)").await?;
    assert!(tx.query_one("SELECT medal_due_at>now()+interval '6 days' AND validation_time_expert IS NULL FROM public.level_item WHERE id=2", &[]).await?.get::<_,bool>(0));
    tx.batch_execute("UPDATE public.level_item SET medal_due_at=now()-interval '1 second' WHERE id=2; UPDATE public.record SET record_eligible=false WHERE id=110; UPDATE public.personal_best_global SET record_eligible=false WHERE id=110; SELECT zc_private.refresh_level_medals(2)").await?;
    assert!(tx.query_one("SELECT medal_due_at<now() AND validation_time_expert IS NULL FROM public.level_item WHERE id=2", &[]).await?.get::<_,bool>(0));
    tx.batch_execute("UPDATE public.record SET record_eligible=true WHERE id=110; UPDATE public.personal_best_global SET record_eligible=true WHERE id=110; SELECT zc_private.refresh_level_medals(2)").await?;
    assert!(tx.query_one("SELECT validation_time_expert IS NOT NULL AND medal_due_at IS NULL FROM public.level_item WHERE id=2", &[]).await?.get::<_,bool>(0));
    // Millisecond collapse publishes neither target.
    assert!(tx.query_one("SELECT expert_ms IS NULL AND apex_ms IS NULL FROM zc_private.calculate_medal_thresholds(3474,ARRAY[3473,3473,3473,3473,3473,3473,3473,3473,3473,3473]::bigint[])", &[]).await?.get::<_,bool>(0));
    // Availability and bans affect counts without multiplying duplicate uploads.
    tx.batch_execute("INSERT INTO public.level_item(id,id_level,validation_time_author,validation_time_gold,validation_time_silver,validation_time_bronze,updated_at,deleted,publicly_visible) SELECT 4,id_level,validation_time_author,validation_time_gold,validation_time_silver,validation_time_bronze,now(),false,true FROM public.level_item WHERE id=2").await?;
    let counts=tx.query_one("SELECT apex+expert+author+gold+silver+bronze+\"none\" FROM zc_private.user_medal_counts(ARRAY[2])", &[]).await?.get::<_,i32>(0);
    assert_eq!(counts, 2);
    tx.batch_execute("UPDATE public.level_item SET deleted=true WHERE id_level=2")
        .await?;
    assert_eq!(tx.query_one("SELECT apex+expert+author+gold+silver+bronze+\"none\" FROM zc_private.user_medal_counts(ARRAY[2])", &[]).await?.get::<_,i32>(0),1);
    tx.batch_execute("UPDATE public.\"user\" SET banned=true WHERE id=2")
        .await?;
    tx.batch_execute("DELETE FROM zc_jobs.job WHERE task='updateLevelRecordCounts'; DELETE FROM public.level_item WHERE id=4").await?;
    assert_eq!(tx.query_one("SELECT count(*)::int FROM zc_jobs.job WHERE task='updateLevelRecordCounts' AND payload->>'idLevel'='2'", &[]).await?.get::<_,i32>(0),1);
    assert_eq!(tx.query_one("SELECT apex+expert+author+gold+silver+bronze+\"none\" FROM zc_private.user_medal_counts(ARRAY[2])", &[]).await?.get::<_,i32>(0),0);
    // A new latest item takes ownership of frozen targets; the old row stores no copy.
    let frozen = tx
        .query_one(
            "SELECT validation_time_expert FROM public.level_item WHERE id=1",
            &[],
        )
        .await?
        .get::<_, f64>(0);
    tx.batch_execute("INSERT INTO public.level_item(id,id_level,validation_time_author,validation_time_gold,validation_time_silver,validation_time_bronze) VALUES(5,1,41,45,50,60); SELECT zc_private.refresh_level_medals(1)").await?;
    assert_eq!(
        tx.query_one(
            "SELECT validation_time_expert FROM public.level_item WHERE id=5",
            &[]
        )
        .await?
        .get::<_, f64>(0),
        frozen
    );
    assert!(tx.query_one("SELECT validation_time_expert IS NULL AND medal_calculated_at IS NULL FROM public.level_item WHERE id=1", &[]).await?.get::<_,bool>(0));
    tx.batch_execute("UPDATE public.level_item SET deleted=true WHERE id=5; SELECT zc_private.refresh_level_medals(1)").await?;
    assert_eq!(
        tx.query_one(
            "SELECT validation_time_expert FROM public.level_item WHERE id=1",
            &[]
        )
        .await?
        .get::<_, f64>(0),
        frozen
    );
    assert_eq!(tx.query_one("SELECT count(*)::int FROM public.level_item WHERE id_level=1 AND validation_time_expert IS NOT NULL", &[]).await?.get::<_,i32>(0),1);
    // A different Author Time on the selected item recalculates immediately, not after seven days.
    tx.batch_execute("INSERT INTO public.record(id,id_user,id_level,time) VALUES(30,12,1,37); INSERT INTO public.personal_best_global VALUES(30,12,1,30,true); INSERT INTO public.level_item(id,id_level,validation_time_author,validation_time_gold,validation_time_silver,validation_time_bronze) VALUES(6,1,42,45,50,60); SELECT zc_private.refresh_level_medals(1)").await?;
    assert!(tx.query_one("SELECT validation_time_expert>$1 AND medal_calculated_at IS NOT NULL AND medal_due_at IS NULL AND medal_calculation_version=1 FROM public.level_item WHERE id=6", &[&frozen]).await?.get::<_,bool>(0));
    assert!(tx.query_one("SELECT validation_time_expert IS NULL AND medal_calculated_at IS NULL FROM public.level_item WHERE id=1", &[]).await?.get::<_,bool>(0));
    tx.batch_execute("SET LOCAL ROLE zeepcentraal_graphql")
        .await?;
    assert!(
        tx.query_one(
            "SELECT public.record_medal(r) IS NOT NULL FROM public.record r WHERE id=3",
            &[]
        )
        .await?
        .get::<_, bool>(0)
    );
    assert!(tx.query_one("SELECT public.record_history_entry_medal(e) IS NOT NULL FROM public.record_history_entry e WHERE id=3", &[]).await?.get::<_,bool>(0));
    assert_eq!(
        tx.query_one("SELECT apex FROM public.medal_counts(NULL,10003,NULL)", &[])
            .await?
            .get::<_, i64>(0),
        1
    );
    assert_eq!(
        tx.query_one("SELECT apex FROM public.medal_counts(999,NULL,NULL)", &[])
            .await?
            .get::<_, i64>(0),
        0
    );
    tx.batch_execute("RESET ROLE").await?;
    tx.batch_execute("SAVEPOINT ambiguous_identifier").await?;
    assert!(
        tx.query_one("SELECT * FROM public.medal_counts(3,10003,NULL)", &[])
            .await
            .is_err()
    );
    tx.batch_execute("ROLLBACK TO SAVEPOINT ambiguous_identifier")
        .await?;
    let rollback_expert=tx.query_one("SELECT validation_time_expert FROM public.level_item WHERE id_level=1 AND NOT deleted ORDER BY updated_at DESC,id DESC LIMIT 1", &[]).await?.get::<_,f64>(0);
    tx.batch_execute(DOWN).await?;
    assert_eq!(
        tx.query_one(
            "SELECT expert_ms FROM public.level_medal_threshold WHERE id_level=1",
            &[]
        )
        .await?
        .get::<_, i64>(0),
        (rollback_expert * 1000.0).round() as i64
    );
    tx.batch_execute(ORIGINAL_DOWN).await?;
    assert_eq!(
        tx.query_one("SELECT points FROM public.user_points WHERE id_user=1", &[])
            .await?
            .get::<_, i32>(0),
        123
    );
    tx.rollback().await?;
    Ok(())
}
