use anyhow::{Result, ensure};
use tokio_postgres::{Client, NoTls};

const UP: &str = include_str!("../migrations/20261108010000_track_tournament_overall/up.sql");
const DOWN: &str = include_str!("../migrations/20261108010000_track_tournament_overall/down.sql");
static TEST_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

async fn connect() -> Result<Client> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/track_tournament_overall_test",
        "Dedicated local track_tournament_overall_test database required"
    );
    let (client, connection) = tokio_postgres::connect(&url, NoTls).await?;
    tokio::spawn(async move { connection.await.expect("overall test connection") });
    Ok(client)
}

const FIXTURE: &str = r#"
CREATE SCHEMA zc_private;
GRANT USAGE ON SCHEMA zc_private TO zeepcentraal_graphql;
CREATE TABLE public."user"(id integer PRIMARY KEY,steam_name text);
CREATE TABLE public.level(id integer PRIMARY KEY,publicly_visible boolean NOT NULL DEFAULT true);
CREATE TABLE public.record(id integer PRIMARY KEY,record_eligible boolean NOT NULL DEFAULT true);
CREATE TABLE public.track_tournament(
 id integer PRIMARY KEY,type integer NOT NULL,id_level integer NOT NULL REFERENCES public.level,
 start_at timestamptz NOT NULL,end_at timestamptz NOT NULL,finalized_at timestamptz
);
CREATE TABLE public.track_tournament_result(
 id_tournament integer REFERENCES public.track_tournament ON DELETE CASCADE,
 id_user integer REFERENCES public."user" ON DELETE CASCADE,id_record integer REFERENCES public.record,
 points integer NOT NULL,PRIMARY KEY(id_tournament,id_user)
);
INSERT INTO public."user" SELECT i,'Player '||i FROM generate_series(1,5) i;
INSERT INTO public.level SELECT i,true FROM generate_series(1,40) i;
INSERT INTO public.record SELECT i,true FROM generate_series(1,5) i;
INSERT INTO public.track_tournament
 SELECT i,0,i,'2026-01-01'::timestamptz+i*interval '1 week',
 '2026-01-08'::timestamptz+i*interval '1 week','2026-10-01'::timestamptz FROM generate_series(1,15) i;
INSERT INTO public.track_tournament
 SELECT i,1,i,'2024-01-01'::timestamptz+i*interval '1 month',
 '2024-02-01'::timestamptz+i*interval '1 month','2026-10-01'::timestamptz FROM generate_series(20,27) i;
INSERT INTO public.track_tournament_result
 SELECT t.id,u.id,u.id,1000 FROM public.track_tournament t CROSS JOIN public."user" u WHERE u.id IN(1,2);
INSERT INTO public.track_tournament_result VALUES(15,3,3,500),(1,4,4,1000),(27,4,4,1000);
"#;

#[tokio::test]
#[ignore = "requires dedicated empty local track_tournament_overall_test database"]
async fn rolling_cache_lifecycle_permissions_backfill_and_rollback() -> Result<()> {
    let _guard = TEST_LOCK.lock().await;
    let mut client = connect().await?;
    let tx = client.transaction().await?;
    tx.batch_execute(FIXTURE).await?;
    tx.batch_execute(UP).await?;
    for (kind, count, points) in [(0, 12, 12000), (1, 6, 6000)] {
        let period = tx.query_one("SELECT eligible_event_count FROM public.track_tournament_overall_period WHERE type=$1", &[&kind]).await?;
        assert_eq!(period.get::<_, i32>(0), count);
        let rows = tx.query("SELECT id_user,total_points,events_played,rank FROM public.track_tournament_overall_standing WHERE type=$1 ORDER BY total_points DESC,id_user", &[&kind]).await?;
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0].get::<_, i32>(1), points);
        assert_eq!(rows[0].get::<_, i32>(2), count);
        assert_eq!(rows[0].get::<_, i32>(3), 1);
        assert_eq!(rows[1].get::<_, i32>(3), 1);
        assert_eq!(rows[2].get::<_, i32>(3), 3);
        assert_eq!(rows[2].get::<_, i32>(2), 1);
    }
    // Completion time does not displace newer event periods.
    tx.batch_execute("UPDATE public.track_tournament SET finalized_at=now() WHERE id=1")
        .await?;
    assert_eq!(tx.query_one("SELECT total_points FROM public.track_tournament_overall_standing WHERE type=0 AND id_user=1",&[]).await?.get::<_,i32>(0),12000);
    let updated: String = tx
        .query_one(
            "SELECT last_updated_at::text FROM public.track_tournament_overall_period WHERE type=0",
            &[],
        )
        .await?
        .get(0);
    tx.batch_execute("INSERT INTO public.track_tournament VALUES(16,0,16,'2030-01-01','2030-01-08',NULL); INSERT INTO public.track_tournament_result VALUES(16,1,1,1000)").await?;
    assert_eq!(
        tx.query_one(
            "SELECT last_updated_at::text FROM public.track_tournament_overall_period WHERE type=0",
            &[]
        )
        .await?
        .get::<_, String>(0),
        updated,
        "active writes never refresh"
    );
    tx.batch_execute("UPDATE public.record SET record_eligible=false; UPDATE public.record SET record_eligible=true").await?;
    assert_eq!(
        tx.query_one(
            "SELECT last_updated_at::text FROM public.track_tournament_overall_period WHERE type=0",
            &[]
        )
        .await?
        .get::<_, String>(0),
        updated,
        "record corrections leave frozen awards unchanged"
    );
    tx.batch_execute(
        "SAVEPOINT rotation; UPDATE public.track_tournament SET finalized_at=now() WHERE id=16",
    )
    .await?;
    assert_eq!(tx.query_one("SELECT total_points FROM public.track_tournament_overall_standing WHERE type=0 AND id_user=2",&[]).await?.get::<_,i32>(0),11000);
    tx.batch_execute("ROLLBACK TO rotation").await?;
    assert_eq!(tx.query_one("SELECT total_points FROM public.track_tournament_overall_standing WHERE type=0 AND id_user=2",&[]).await?.get::<_,i32>(0),12000);
    tx.batch_execute("UPDATE public.track_tournament SET finalized_at=now() WHERE id=16; INSERT INTO public.track_tournament VALUES(17,0,17,'2030-02-01','2030-02-08',now())").await?;
    assert!(
        !tx.query_one(
            "SELECT overall_competitive FROM public.track_tournament WHERE id=17",
            &[]
        )
        .await?
        .get::<_, bool>(0),
        "empty completion excluded"
    );
    tx.batch_execute("DELETE FROM public.track_tournament_result WHERE id_tournament=16")
        .await?;
    assert!(
        tx.query_one(
            "SELECT overall_competitive FROM public.track_tournament WHERE id=16",
            &[]
        )
        .await?
        .get::<_, bool>(0),
        "competitive event keeps slot"
    );
    assert_eq!(tx.query_one("SELECT total_points FROM public.track_tournament_overall_standing WHERE type=0 AND id_user=1",&[]).await?.get::<_,i32>(0),11000);
    tx.batch_execute("UPDATE public.level SET publicly_visible=false WHERE id=15")
        .await?;
    assert_eq!(tx.query_one("SELECT count(*) FROM public.track_tournament_overall_standing WHERE type=0 AND id_user=3",&[]).await?.get::<_,i64>(0),0);
    tx.batch_execute("UPDATE public.level SET publicly_visible=true WHERE id=15; UPDATE public.track_tournament SET overall_competitive=false WHERE id=15").await?;
    assert_eq!(tx.query_one("SELECT count(*) FROM public.track_tournament_overall_standing WHERE type=0 AND id_user=3",&[]).await?.get::<_,i64>(0),0,"cancelled event excluded");
    tx.batch_execute("DELETE FROM public.\"user\" WHERE id=1")
        .await?;
    assert_eq!(
        tx.query_one(
            "SELECT rank FROM public.track_tournament_overall_standing WHERE type=0 AND id_user=2",
            &[]
        )
        .await?
        .get::<_, i32>(0),
        1
    );
    tx.batch_execute("SET LOCAL ROLE zeepcentraal_graphql")
        .await?;
    assert_eq!(
        tx.query_one(
            "SELECT count(*) FROM public.track_tournament_overall_period",
            &[]
        )
        .await?
        .get::<_, i64>(0),
        2
    );
    assert!(!tx.query_one("SELECT has_function_privilege(current_user,'zc_private.refresh_track_tournament_overall(integer)','EXECUTE')",&[]).await?.get::<_,bool>(0));
    for privilege in ["INSERT", "UPDATE", "DELETE"] {
        assert!(!tx.query_one("SELECT has_table_privilege(current_user,'public.track_tournament_overall_standing',$1)",&[&privilege]).await?.get::<_,bool>(0));
    }
    tx.batch_execute("RESET ROLE").await?;
    tx.batch_execute("INSERT INTO public.\"user\" SELECT i,'Plan player' FROM generate_series(1000,21000) i;
        INSERT INTO public.track_tournament_overall_standing SELECT 0,id,1000,1,1 FROM public.\"user\" WHERE id>=1000;
        ANALYZE public.track_tournament_overall_standing").await?;
    let plan = tx.query("EXPLAIN (ANALYZE,BUFFERS) SELECT * FROM public.track_tournament_overall_standing WHERE type=0 ORDER BY total_points DESC,id_user LIMIT 50",&[]).await?;
    assert!(
        plan.iter().any(|row| row
            .get::<_, String>(0)
            .contains("track_tournament_overall_order")),
        "cached pagination must use ordered index"
    );
    tx.batch_execute(DOWN).await?;
    assert!(
        tx.query_one(
            "SELECT to_regclass('public.track_tournament_overall_standing') IS NULL",
            &[]
        )
        .await?
        .get::<_, bool>(0)
    );
    tx.batch_execute(UP).await?;
    tx.batch_execute("DELETE FROM public.track_tournament")
        .await?;
    assert_eq!(
        tx.query_one(
            "SELECT eligible_event_count FROM public.track_tournament_overall_period WHERE type=0",
            &[]
        )
        .await?
        .get::<_, i32>(0),
        0
    );
    assert!(tx.query_one("SELECT period_start IS NULL AND period_end IS NULL FROM public.track_tournament_overall_period WHERE type=0",&[]).await?.get::<_,bool>(0));
    tx.rollback().await?;
    Ok(())
}

#[tokio::test]
#[ignore = "requires dedicated empty local track_tournament_overall_test database"]
async fn refresh_serializes_and_committed_cache_survives_new_connections() -> Result<()> {
    use std::time::Duration;
    let _guard = TEST_LOCK.lock().await;
    let client = connect().await?;
    client.batch_execute(FIXTURE).await?;
    client.batch_execute(UP).await?;
    let result = async {
        let mut writer = connect().await?;
        let transaction = writer.transaction().await?;
        transaction.batch_execute("SELECT zc_private.refresh_track_tournament_overall(0)").await?;
        let second = connect().await?;
        let mut waiting = tokio::spawn(async move {
            second.batch_execute("SELECT zc_private.refresh_track_tournament_overall(0)").await
        });
        assert!(tokio::time::timeout(Duration::from_millis(100), &mut waiting).await.is_err());
        let reader = connect().await?;
        assert_eq!(reader.query_one("SELECT count(*) FROM public.track_tournament_overall_standing WHERE type=0",&[]).await?.get::<_,i64>(0),3,"reader sees committed snapshot during refresh");
        transaction.rollback().await?;
        tokio::time::timeout(Duration::from_secs(5),waiting).await???;
        drop(writer);
        let restarted = connect().await?;
        assert_eq!(restarted.query_one("SELECT total_points FROM public.track_tournament_overall_standing WHERE type=0 AND id_user=1",&[]).await?.get::<_,i32>(0),12000);
        Ok::<(),anyhow::Error>(())
    }.await;
    client.batch_execute(DOWN).await?;
    client.batch_execute("DROP TABLE public.track_tournament_result,public.track_tournament,public.record,public.level,public.\"user\"; DROP SCHEMA zc_private").await?;
    result
}

#[tokio::test]
#[ignore = "requires dedicated empty local track_tournament_overall_test database"]
async fn daily_migration_window_permissions_and_destructive_rollback() -> Result<()> {
    let _guard = TEST_LOCK.lock().await;
    let mut client = connect().await?;
    let tx = client.transaction().await?;
    tx.batch_execute(FIXTURE).await?;
    tx.batch_execute(UP).await?;
    tx.batch_execute("ALTER TABLE public.track_tournament ADD COLUMN slug text; ALTER TABLE public.track_tournament ADD CONSTRAINT \"CK_track_tournament_type\" CHECK(type IN(0,1)); CREATE TABLE zc_private.discord_guild_feed(kind text CONSTRAINT \"CK_discord_guild_feed_kind\" CHECK(kind IN('workshop','world_record','rank','totw','totm'))); CREATE TABLE zc_private.discord_watch(kind text,target_id text)").await?;
    tx.batch_execute(include_str!(
        "../migrations/20261111010000_track_of_the_day/up.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(
            "SELECT eligible_event_count FROM public.track_tournament_overall_period WHERE type=2",
            &[]
        )
        .await?
        .get::<_, i32>(0),
        0
    );
    tx.batch_execute("INSERT INTO public.track_tournament(id,type,id_level,start_at,end_at,slug) SELECT 100+i,2,i+1,'2026-01-01T06:00Z'::timestamptz+i*interval '1 day','2026-01-02T06:00Z'::timestamptz+i*interval '1 day',to_char('2026-01-01'::date+i,'YYYY-MM-DD') FROM generate_series(0,31) i; INSERT INTO public.track_tournament_result SELECT id,1,1,1000 FROM public.track_tournament WHERE type=2; UPDATE public.track_tournament SET finalized_at=end_at WHERE type=2; INSERT INTO public.track_tournament(id,type,id_level,start_at,end_at,finalized_at) VALUES(132,2,33,'2026-02-02T06:00Z','2026-02-03T06:00Z','2026-02-03T06:00Z')").await?;
    assert_eq!(
        tx.query_one(
            "SELECT eligible_event_count FROM public.track_tournament_overall_period WHERE type=2",
            &[]
        )
        .await?
        .get::<_, i32>(0),
        30
    );
    assert_eq!(tx.query_one("SELECT total_points FROM public.track_tournament_overall_standing WHERE type=2 AND id_user=1",&[]).await?.get::<_,i32>(0),30000);
    // Visibility changes remove points without restoring an older event.
    tx.batch_execute("UPDATE public.level SET publicly_visible=false WHERE id=32")
        .await?;
    assert_eq!(tx.query_one("SELECT total_points FROM public.track_tournament_overall_standing WHERE type=2 AND id_user=1",&[]).await?.get::<_,i32>(0),29000);
    tx.batch_execute("UPDATE public.level SET publicly_visible=true WHERE id=32; DELETE FROM public.track_tournament_result WHERE id_tournament=131").await?;
    assert!(
        tx.query_one(
            "SELECT overall_competitive FROM public.track_tournament WHERE id=131",
            &[]
        )
        .await?
        .get::<_, bool>(0)
    );
    assert_eq!(tx.query_one("SELECT total_points FROM public.track_tournament_overall_standing WHERE type=2 AND id_user=1",&[]).await?.get::<_,i32>(0),29000);
    for (kind, points) in [(0, 12000), (1, 6000)] {
        assert_eq!(tx.query_one("SELECT total_points FROM public.track_tournament_overall_standing WHERE type=$1 AND id_user=1",&[&kind]).await?.get::<_,i32>(0),points);
    }
    tx.batch_execute("SET LOCAL ROLE zeepcentraal_graphql")
        .await?;
    assert_eq!(
        tx.query_one(
            "SELECT count(*) FROM public.track_tournament_overall_period WHERE type=2",
            &[]
        )
        .await?
        .get::<_, i64>(0),
        1
    );
    assert!(!tx.query_one("SELECT has_function_privilege(current_user,'zc_private.refresh_track_tournament_overall(integer)','EXECUTE')",&[]).await?.get::<_,bool>(0));
    assert!(!tx.query_one("SELECT has_table_privilege(current_user,'public.track_tournament_overall_standing','UPDATE')",&[]).await?.get::<_,bool>(0));
    tx.batch_execute("RESET ROLE; INSERT INTO zc_private.discord_guild_feed VALUES('totd'),('totw'); INSERT INTO zc_private.discord_watch VALUES('tournament','totd'),('tournament','100'),('tournament','2026-01-01'),('tournament','totw')").await?;
    tx.batch_execute(include_str!(
        "../migrations/20261111010000_track_of_the_day/down.sql"
    ))
    .await?;
    assert_eq!(
        tx.query_one(
            "SELECT count(*) FROM public.track_tournament WHERE type=2",
            &[]
        )
        .await?
        .get::<_, i64>(0),
        0
    );
    assert_eq!(
        tx.query_one("SELECT count(*) FROM zc_private.discord_guild_feed", &[])
            .await?
            .get::<_, i64>(0),
        1
    );
    assert_eq!(
        tx.query_one("SELECT count(*) FROM zc_private.discord_watch", &[])
            .await?
            .get::<_, i64>(0),
        1
    );
    assert_eq!(
        tx.query_one(
            "SELECT count(*) FROM public.track_tournament_overall_period",
            &[]
        )
        .await?
        .get::<_, i64>(0),
        2
    );
    tx.batch_execute("SAVEPOINT reject_daily").await?;
    assert!(
        tx.batch_execute("INSERT INTO zc_private.discord_guild_feed VALUES('totd')")
            .await
            .is_err()
    );
    tx.batch_execute("ROLLBACK TO reject_daily").await?;
    Ok(())
}
