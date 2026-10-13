use anyhow::{Result, ensure};
use zc_database::{
    Database,
    services::{jobs::MaintenanceOutcome, record::RecordSubmission},
};

const UP: &str = include_str!("../migrations/20261013010000_available_record_counts/up.sql");
const DOWN: &str = include_str!("../migrations/20261013010000_available_record_counts/down.sql");

#[tokio::test]
#[ignore = "requires isolated local available_record_counts_test cloned from current schema"]
async fn availability_counts_backfill_workshop_refresh_and_rollback() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/available_record_counts_test",
        "Isolated local count database required"
    );
    let (mut client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("count fixture connection") });
    if client
        .query_one(
            "SELECT to_regprocedure('zc_private.user_record_counts(integer[])') IS NOT NULL",
            &[],
        )
        .await?
        .get::<_, bool>(0)
    {
        client.batch_execute(DOWN).await?;
    }
    client.batch_execute(r#"
      TRUNCATE public."user",public.level,public.workshop_item,zc_jobs.job RESTART IDENTITY CASCADE;
      INSERT INTO public."user"(id,steam_id,banned) OVERRIDING SYSTEM VALUE SELECT id,42+id,false FROM generate_series(1,56) id;
      INSERT INTO public.level(id,hash,xx_hash) OVERRIDING SYSTEM VALUE SELECT id,'count-'||id,lpad(id::text,32,'0') FROM generate_series(1,4) id;
      INSERT INTO public.workshop_item(workshop_id,author_id,name,image_url) VALUES(1,43,'counts',''),(2,43,'duplicate','');
      INSERT INTO public.level_item(id,id_level,workshop_id,author_id,name,image_url,file_author,file_uid,
        validation_time_author,validation_time_gold,validation_time_silver,validation_time_bronze,deleted,created_at,updated_at)
      OVERRIDING SYSTEM VALUE VALUES
        (10,1,1,43,'count','','fixture','one',10,11,12,13,false,now(),now()),
        (11,1,2,43,'duplicate','','fixture','two',10,11,12,13,false,now(),now()),
        (12,3,1,43,'deleted','','fixture','three',10,11,12,13,true,now(),now()),
        (13,4,1,43,'failed','','fixture','four',10,11,12,13,false,now(),now());
      INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version,date_created) OVERRIDING SYSTEM VALUE
        SELECT id,id,1,10+id::real/100,'test','test',CASE WHEN id%2=0 THEN '2020-01-01'::timestamptz ELSE now() END FROM generate_series(1,56) id;
      INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version,date_created) OVERRIDING SYSTEM VALUE
        VALUES(57,2,2,10,'test','test','2020-01-01'),(58,1,3,10,'test','test',now()),(59,2,4,10,'test','test','2020-01-01');
      INSERT INTO public.personal_best_global(id_user,id_level,id_record) SELECT id,id_level,id FROM public.record WHERE id<=56;
      INSERT INTO public.personal_best_global(id_user,id_level,id_record) VALUES(2,2,57),(1,3,58),(2,4,59);
      INSERT INTO public.world_record_global(id_user,id_level,id_record) VALUES(1,1,1),(2,2,57),(1,3,58),(2,4,59);
      INSERT INTO public.user_points(id_user,points,total_points,rank,world_records) VALUES(1,42,99,7,88),(56,0,0,-1,88);
    "#).await?;
    client.batch_execute(UP).await?;
    assert_eq!(counts(&client, 1).await?, (1, 1));
    assert_eq!(counts(&client, 2).await?, (2, 1));
    assert_eq!(counts(&client, 56).await?, (1, 0));
    let preserved = client
        .query_one(
            "SELECT points,total_points,rank FROM public.user_points WHERE id_user=1",
            &[],
        )
        .await?;
    assert_eq!(
        (
            preserved.get::<_, i32>(0),
            preserved.get::<_, i32>(1),
            preserved.get::<_, i32>(2)
        ),
        (42, 99, 7)
    );
    let db = Database::connect(&url, 4).await?;
    db.save_record_validation(
        59,
        None,
        &zc_core::ghost_validation::ValidationReport::failed("missing_checkpoint"),
    )
    .await?;
    assert_eq!(
        db.recalculate_player_score(2).await?,
        MaintenanceOutcome::Applied(())
    );
    assert_eq!(counts(&client, 2).await?, (1, 0));
    client
        .execute(
            "UPDATE public.user_points SET date_updated='2000-01-01' WHERE id_user=2",
            &[],
        )
        .await?;
    db.recalculate_player_score(2).await?;
    assert!(
        client
            .query_one(
                "SELECT date_updated='2000-01-01' FROM public.user_points WHERE id_user=2",
                &[]
            )
            .await?
            .get::<_, bool>(0)
    );

    // Partial removal keeps duplicate uploads counted exactly once.
    db.mark_workshop_deleted(1, 2).await?;
    db.recalculate_player_score(1).await?;
    assert_eq!(counts(&client, 1).await?, (1, 1));
    client.execute("TRUNCATE zc_jobs.job", &[]).await?;
    db.mark_missing_workshop_levels_deleted(2, &[]).await?;
    assert_eq!(queued_cursor(&client).await?, 1);
    let first = db.level_record_count_user_page(1, 0).await?;
    assert_eq!(first.user_ids, (1..=50).collect::<Vec<_>>());
    let last = db
        .level_record_count_user_page(1, first.next_after_user_id.unwrap())
        .await?;
    assert_eq!(last.user_ids, (51..=56).collect::<Vec<_>>());
    assert_eq!(last.next_after_user_id, None);
    for id in first.user_ids.into_iter().chain(last.user_ids) {
        db.recalculate_player_score(id).await?;
        assert_eq!(counts(&client, id).await?, (0, 0));
    }

    // Rolled-back restoration cannot queue work or change count sources.
    client.execute("TRUNCATE zc_jobs.job", &[]).await?;
    let transaction = client.transaction().await?;
    transaction
        .execute(
            "UPDATE public.level_item SET deleted=false WHERE id=11",
            &[],
        )
        .await?;
    transaction.rollback().await?;
    assert_eq!(queued_cursor(&client).await?, 0);
    client
        .execute(
            "UPDATE public.level_item SET deleted=false WHERE id=11",
            &[],
        )
        .await?;
    assert_eq!(queued_cursor(&client).await?, 1);
    db.recalculate_player_score(1).await?;
    assert_eq!(counts(&client, 1).await?, (1, 1));

    // Real WR transfer refreshes both holders, independently of score contributions.
    client
        .execute(
            "SELECT setval(pg_get_serial_sequence('public.record','id'),59,true)",
            &[],
        )
        .await?;
    client.execute("TRUNCATE zc_jobs.job", &[]).await?;
    let statistics = zc_core::ghosts::GhostStatistics::default();
    let transferred = db
        .submit_record(RecordSubmission {
            evidence: None,
            id_user: 2,
            id_level: 1,
            time: 9.0,
            game_version: "test",
            mod_version: "test",
            splits: &[],
            speeds: &[],
            statistics: &statistics,
        })
        .await?;
    assert_eq!(transferred.world_record_user_ids, vec![1, 2]);
    assert_eq!(client.query_one("SELECT count(*) FROM zc_jobs.job WHERE task='updatePlayerScore' AND payload->>'idUser' IN ('1','2')", &[]).await?.get::<_,i64>(0),2);
    db.recalculate_player_score(1).await?;
    db.recalculate_player_score(2).await?;
    assert_eq!(counts(&client, 1).await?, (1, 0));
    assert_eq!(counts(&client, 2).await?, (1, 1));

    // Metadata-only scans do not restart count work. Reassignment refreshes both levels.
    client.execute("TRUNCATE zc_jobs.job", &[]).await?;
    client
        .execute(
            "UPDATE public.level_item SET name='renamed' WHERE id=11",
            &[],
        )
        .await?;
    assert_eq!(queued_cursor(&client).await?, 0);
    client
        .execute("UPDATE public.level_item SET id_level=2 WHERE id=11", &[])
        .await?;
    assert_eq!(queued_cursor(&client).await?, 2);
    db.recalculate_player_score(1).await?;
    db.recalculate_player_score(2).await?;
    assert_eq!(counts(&client, 1).await?, (0, 0));
    assert_eq!(counts(&client, 2).await?, (1, 1));
    db.reconcile_missing_workshop_items(&[2]).await?;
    db.recalculate_player_score(2).await?;
    assert_eq!(counts(&client, 2).await?, (0, 0));

    // Projection changes queue users even when no score contribution exists.
    client.execute("TRUNCATE zc_jobs.job", &[]).await?;
    let improved = db
        .submit_record(RecordSubmission {
            evidence: None,
            id_user: 1,
            id_level: 1,
            time: 9.0,
            game_version: "test",
            mod_version: "test",
            splits: &[],
            speeds: &[],
            statistics: &statistics,
        })
        .await?;
    assert!(improved.personal_best_changed);
    assert!(improved.world_record_user_ids.is_empty());
    assert!(client.query_one("SELECT EXISTS(SELECT 1 FROM zc_jobs.job WHERE task='updatePlayerScore' AND payload->>'idUser'='1')",&[]).await?.get::<_,bool>(0));
    client.batch_execute(DOWN).await?;
    assert_eq!(
        client
            .query_one(
                "SELECT world_records FROM public.user_points WHERE id_user=1",
                &[]
            )
            .await?
            .get::<_, i32>(0),
        1
    );
    client.batch_execute(UP).await?;
    assert_eq!(counts(&client, 1).await?, (0, 0));
    Ok(())
}

async fn counts(client: &tokio_postgres::Client, user: i32) -> Result<(i32, i32)> {
    let row = client
        .query_one(
            "SELECT personal_bests,world_records FROM public.user_points WHERE id_user=$1",
            &[&user],
        )
        .await?;
    Ok((row.get(0), row.get(1)))
}
async fn queued_cursor(client: &tokio_postgres::Client) -> Result<i64> {
    Ok(client
        .query_one(
            "SELECT count(*) FROM zc_jobs.job WHERE task='updateLevelRecordCounts'",
            &[],
        )
        .await?
        .get(0))
}
