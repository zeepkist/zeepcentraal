use anyhow::{Result, ensure};
use diesel::{
    QueryableByName, sql_query,
    sql_types::{BigInt, Integer},
};
use diesel_async::{RunQueryDsl, SimpleAsyncConnection};
use std::time::Duration;
use zc_database::{Database, DatabasePool, PoolBudget, PoolSettings};
use zc_jobs::queue::Queue;

#[derive(QueryableByName)]
struct Id {
    #[diesel(sql_type=Integer)]
    id: i32,
}
#[derive(QueryableByName)]
struct Count {
    #[diesel(sql_type=BigInt)]
    count: i64,
}

#[tokio::test]
#[ignore = "requires empty current schema in local tournament_recovery_test with pgmq 1.12.0"]
async fn scheduler_startup_and_concurrent_rotation_recover_current_period() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/tournament_recovery_test",
        "Dedicated isolated database required"
    );
    let pool = DatabasePool::connect(
        &url,
        PoolSettings {
            application_name: "tournament-recovery-test".into(),
            acquire_timeout: Duration::from_secs(5),
            statement_timeout: Duration::from_secs(10),
            lock_timeout: Duration::from_secs(5),
            idle_transaction_timeout: Duration::from_secs(30),
            idle_timeout: Duration::from_secs(30),
        },
        PoolBudget {
            application: 2,
            queue: 1,
            scheduler: 1,
        },
    )
    .await?;
    let application = pool.application();
    let database = Database::from_partition(application.clone());
    let queue = Queue::connect(pool.queue()?).await?;
    let mut connection = application.connection().await?;
    ensure!(
        sql_query("SELECT count(*)::bigint AS count FROM public.level")
            .get_result::<Count>(&mut connection)
            .await?
            .count
            == 0,
        "Empty fixture required"
    );
    let user = database.get_or_insert_user(42).await?;
    connection.batch_execute("INSERT INTO public.workshop_item(workshop_id,author_id,name,image_url,visibility,file_size,created_at,updated_at) VALUES(1,42,'Fixture','',0,1,now(),now())").await?;
    let level = sql_query("INSERT INTO public.level(hash,xx_hash,date_created) VALUES('fixture',repeat('A',32),clock_timestamp()-interval '30 days') RETURNING id")
        .get_result::<Id>(&mut connection).await?.id;
    sql_query("INSERT INTO public.level_points(id_level,points,rating,modifier_length,modifier_evidence,modifier_quality,modifier_rating) VALUES($1,1000,0.5,1,0.2,0.55,1)").bind::<Integer,_>(level).execute(&mut connection).await?;
    sql_query("INSERT INTO public.level_item(id_level,workshop_id,author_id,name,image_url,file_author,file_uid,validation_time_author,validation_time_gold,validation_time_silver,validation_time_bronze,deleted,created_at,updated_at) VALUES($1,1,42,'Fixture','','Fixture','fixture',30,40,50,60,false,now(),now())")
        .bind::<Integer,_>(level).execute(&mut connection).await?;
    let record = sql_query("INSERT INTO public.record(id_user,id_level,time,game_version,mod_version,date_created) VALUES($1,$2,30,'test','test',(date_trunc('week',timezone('UTC',clock_timestamp())-interval '6 hours') AT TIME ZONE 'UTC')+interval '6 hours') RETURNING id")
        .bind::<Integer,_>(user.id).bind::<Integer,_>(level).get_result::<Id>(&mut connection).await?.id;
    drop(connection);

    // Two replicas must select once, then return the same tournament.
    let (first, second) = tokio::join!(
        database.rotate_track_tournament(0),
        database.rotate_track_tournament(0)
    );
    let (first, second) = (first?, second?);
    assert_ne!(first.created, second.created);
    assert_eq!(first.id_tournament, second.id_tournament);
    let mut connection = application.connection().await?;
    let winner = sql_query("SELECT id_record AS id FROM public.track_tournament_result WHERE id_tournament=$1 AND id_user=$2")
        .bind::<Integer,_>(first.id_tournament.unwrap()).bind::<Integer,_>(user.id).get_result::<Id>(&mut connection).await?;
    assert_eq!(winner.id, record);
    drop(connection);

    // Restart leadership within the same minute: stable keys must coalesce.
    for _ in 0..2 {
        let before = sql_query("SELECT coalesce(max(xmin::text::bigint),0)::bigint AS count FROM zc_jobs.job WHERE task='rotateTrackTournament'")
            .get_result::<Count>(&mut application.connection().await?).await?.count;
        let scheduler = pool.scheduler()?;
        let initial = scheduler.connection().await?;
        let (shutdown, receiver) = tokio::sync::watch::channel(false);
        let task = tokio::spawn(zc_jobs::cron::run(
            scheduler,
            initial,
            queue.clone(),
            receiver,
        ));
        let observed = tokio::time::timeout(Duration::from_secs(5), async {
            loop {
                let mut connection = application.connection().await?;
                #[derive(QueryableByName)]
                struct Progress {
                    #[diesel(sql_type=BigInt)] count: i64,
                    #[diesel(sql_type=BigInt)] version: i64,
                }
                let progress = sql_query("SELECT count(*)::bigint AS count,coalesce(min(xmin::text::bigint),0)::bigint AS version FROM zc_jobs.job WHERE task='rotateTrackTournament'")
                    .get_result::<Progress>(&mut connection).await?;
                if progress.count == 2 && progress.version > before { return Ok::<_,anyhow::Error>(()); }
                drop(connection);
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
        }).await;
        shutdown.send(true)?;
        tokio::time::timeout(Duration::from_secs(5), task).await???;
        observed??;
    }
    Ok(())
}
