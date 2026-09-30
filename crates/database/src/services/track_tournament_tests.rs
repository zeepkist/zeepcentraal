use super::*;
use diesel_async::{AsyncPgConnection, SimpleAsyncConnection};

const REPAIR_UP: &str =
    include_str!("../../migrations/20260930010000_track_tournament_utc_boundaries/up.sql");
const REPAIR_DOWN: &str =
    include_str!("../../migrations/20260930010000_track_tournament_utc_boundaries/down.sql");

async fn fixture() -> Result<AsyncPgConnection> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        matches!(parsed.host_str(), Some("127.0.0.1" | "localhost"))
            && parsed.path() == "/track_tournament_test",
        "Dedicated empty local track_tournament_test database required"
    );
    let mut connection = AsyncPgConnection::establish(&url).await?;
    connection.begin_test_transaction().await?;
    // Serialize fixture DDL; every test rolls back its tables on disconnect.
    sql_query("SELECT pg_advisory_xact_lock(1953744431,2)")
        .execute(&mut connection)
        .await?;
    connection
        .batch_execute(
            r#"
CREATE TABLE public.level (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    publicly_visible boolean NOT NULL,
    date_created timestamptz NOT NULL
);
CREATE TABLE public.level_points (id_level integer PRIMARY KEY, points integer NOT NULL);
CREATE TABLE public.level_item (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_level integer NOT NULL, publicly_visible boolean NOT NULL, deleted boolean NOT NULL
);
CREATE TABLE public.track_tournament (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type integer NOT NULL, slug text NOT NULL, id_level integer NOT NULL,
    start_at timestamptz NOT NULL, end_at timestamptz NOT NULL,
    points_version integer NOT NULL DEFAULT 1, finalized_at timestamptz,
    date_created timestamptz NOT NULL DEFAULT now(), date_updated timestamptz,
    UNIQUE(type, id_level), UNIQUE(type, start_at), UNIQUE(type, slug),
    CHECK(end_at > start_at)
);
CREATE TABLE public.track_tournament_result (
    id_tournament integer NOT NULL, id_user integer NOT NULL, id_record integer NOT NULL,
    time real NOT NULL, rank integer NOT NULL, points integer NOT NULL,
    PRIMARY KEY(id_tournament, id_user)
);
"#,
        )
        .await?;
    Ok(connection)
}

async fn clear_fixture(connection: &mut AsyncPgConnection) -> Result<()> {
    connection
        .batch_execute(
            "TRUNCATE public.track_tournament_result, public.track_tournament, \
             public.level_item, public.level_points, public.level RESTART IDENTITY",
        )
        .await?;
    Ok(())
}

#[derive(QueryableByName)]
struct PeriodRow {
    #[diesel(sql_type = Text)]
    slug: String,
    #[diesel(sql_type = Text)]
    start_at: String,
    #[diesel(sql_type = Text)]
    end_at: String,
}

#[tokio::test]
#[ignore = "requires dedicated empty local PostgreSQL track_tournament_test"]
async fn rotation_uses_utc_six_am_periods_and_is_idempotent() -> Result<()> {
    let mut connection = fixture().await?;
    for zone in ["UTC", "Europe/London", "America/New_York"] {
        sql_query("SELECT set_config('TimeZone',$1,true)")
            .bind::<Text, _>(zone)
            .execute(&mut connection)
            .await?;
        for (kind, at, slug, end) in [
            (
                0,
                "2026-09-28T06:00:00Z",
                "2026-W40",
                "2026-10-05T06:00:00Z",
            ),
            (
                0,
                "2025-12-29T06:00:00Z",
                "2026-W01",
                "2026-01-05T06:00:00Z",
            ),
            (
                0,
                "2026-03-23T06:00:00Z",
                "2026-W13",
                "2026-03-30T06:00:00Z",
            ),
            (
                0,
                "2026-10-19T06:00:00Z",
                "2026-W43",
                "2026-10-26T06:00:00Z",
            ),
            (1, "2028-02-01T06:00:00Z", "2028-02", "2028-03-01T06:00:00Z"),
            (1, "2026-10-01T06:00:00Z", "2026-10", "2026-11-01T06:00:00Z"),
        ] {
            clear_fixture(&mut connection).await?;
            sql_query(
                "INSERT INTO public.level(publicly_visible,date_created) \
                 VALUES(true,$1::text::timestamptz-interval '1 day')",
            )
            .bind::<Text, _>(at)
            .execute(&mut connection)
            .await?;
            connection
                .batch_execute(
                    "INSERT INTO public.level_points VALUES(1,1000); \
                     INSERT INTO public.level_item(id_level,publicly_visible,deleted) VALUES(1,true,false)",
                )
                .await?;
            let midnight = at.replace("T06:", "T00:");
            let rejected =
                rotate_track_tournament_at(&mut connection, kind, Some(&midnight)).await?;
            assert!(!rejected.created);
            assert_eq!(rejected.id_tournament, None);
            let created = rotate_track_tournament_at(&mut connection, kind, Some(at)).await?;
            assert!(created.created, "{zone}: {at}");
            let id = created.id_tournament.unwrap();
            let period: PeriodRow = sql_query(
                "SELECT slug,to_char(start_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS start_at, \
                 to_char(end_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS end_at \
                 FROM public.track_tournament WHERE id=$1",
            )
            .bind::<Integer, _>(id)
            .get_result(&mut connection)
            .await?;
            assert_eq!(period.slug, slug);
            assert_eq!(period.start_at, at);
            assert_eq!(period.end_at, end);
            let repeated = rotate_track_tournament_at(&mut connection, kind, Some(at)).await?;
            assert!(!repeated.created);
            assert_eq!(repeated.id_tournament, Some(id));

            // Finalization uses the injected database instant too.
            let finalized = rotate_track_tournament_at(&mut connection, kind, Some(end)).await?;
            assert!(!finalized.created); // Fixture's only eligible level was already used.
            let matches: BooleanRow = sql_query(
                "SELECT finalized_at=$2::text::timestamptz AND date_updated=$2::text::timestamptz AS value \
                 FROM public.track_tournament WHERE id=$1",
            )
            .bind::<Integer, _>(id)
            .bind::<Text, _>(end)
            .get_result(&mut connection)
            .await?;
            assert!(matches.value);
        }
    }
    Ok(())
}

#[tokio::test]
#[ignore = "requires dedicated empty local PostgreSQL track_tournament_test"]
async fn repair_moves_only_active_canonical_midnight_periods_and_preserves_results() -> Result<()> {
    let mut connection = fixture().await?;
    connection
        .batch_execute("SET LOCAL TimeZone='America/New_York'")
        .await?;
    for case in [
        "active",
        "correct",
        "expired",
        "finalized",
        "custom-slug",
        "custom-end",
        "custom-start",
        "future",
    ] {
        clear_fixture(&mut connection).await?;
        sql_query(
            "WITH periods AS (SELECT kind,CASE WHEN kind=0 \
             THEN date_trunc('week',statement_timestamp() AT TIME ZONE 'UTC') \
             ELSE date_trunc('month',statement_timestamp() AT TIME ZONE 'UTC') END AS utc_start \
             FROM generate_series(0,1) kind), shifted AS (SELECT kind, \
             utc_start+CASE WHEN $1='expired' THEN CASE WHEN kind=0 THEN interval '-1 week' ELSE interval '-1 month' END \
             WHEN $1='future' THEN CASE WHEN kind=0 THEN interval '1 week' ELSE interval '1 month' END \
             ELSE interval '0' END AS utc_start FROM periods) \
             INSERT INTO public.track_tournament(type,slug,id_level,start_at,end_at,finalized_at) \
             SELECT kind,CASE WHEN $1='custom-slug' THEN 'custom' WHEN kind=0 \
             THEN to_char(utc_start,'IYYY-\"W\"IW') ELSE to_char(utc_start,'YYYY-MM') END,kind+1, \
             (utc_start AT TIME ZONE 'UTC')+CASE WHEN $1='correct' THEN interval '6 hours' \
             WHEN $1='custom-start' THEN interval '-1 hour' ELSE interval '0' END, \
             ((utc_start+CASE WHEN kind=0 THEN interval '1 week' ELSE interval '1 month' END) AT TIME ZONE 'UTC') \
             +CASE WHEN $1='correct' THEN interval '6 hours' WHEN $1='custom-end' THEN interval '1 hour' ELSE interval '0' END, \
             CASE WHEN $1='finalized' THEN statement_timestamp() END FROM shifted",
        )
        .bind::<Text, _>(case)
        .execute(&mut connection)
        .await?;
        connection.batch_execute(
            "INSERT INTO public.track_tournament_result \
             SELECT id,1,100+id,49.332,1,1000 FROM public.track_tournament; \
             CREATE TEMP TABLE original_tournaments ON COMMIT DROP AS SELECT * FROM public.track_tournament; \
             CREATE TEMP TABLE original_results ON COMMIT DROP AS SELECT * FROM public.track_tournament_result",
        ).await?;
        connection.batch_execute(REPAIR_UP).await?;
        let preserved: BooleanRow = sql_query(
            "SELECT NOT EXISTS((SELECT * FROM public.track_tournament_result EXCEPT SELECT * FROM original_results) \
             UNION ALL (SELECT * FROM original_results EXCEPT SELECT * FROM public.track_tournament_result)) AS value",
        ).get_result(&mut connection).await?;
        assert!(preserved.value, "{case}");
        let correct: BooleanRow = sql_query(
            "SELECT bool_and(ROW(t.id,t.type,t.slug,t.id_level,t.points_version,t.finalized_at,t.date_created) \
             IS NOT DISTINCT FROM ROW(o.id,o.type,o.slug,o.id_level,o.points_version,o.finalized_at,o.date_created) \
             AND t.start_at=o.start_at+CASE WHEN $1='active' THEN interval '6 hours' ELSE interval '0' END \
             AND t.end_at=o.end_at+CASE WHEN $1='active' THEN interval '6 hours' ELSE interval '0' END \
             AND CASE WHEN $1='active' THEN t.date_updated IS NOT NULL ELSE t.date_updated IS NOT DISTINCT FROM o.date_updated END) AS value \
             FROM public.track_tournament t JOIN original_tournaments o USING(id)",
        ).bind::<Text, _>(case).get_result(&mut connection).await?;
        assert!(correct.value, "{case}");
        connection.batch_execute(
            "CREATE TEMP TABLE once_repaired ON COMMIT DROP AS SELECT * FROM public.track_tournament",
        ).await?;
        connection.batch_execute(REPAIR_UP).await?;
        let repeated: BooleanRow = sql_query(
            "SELECT NOT EXISTS((SELECT * FROM public.track_tournament EXCEPT SELECT * FROM once_repaired) \
             UNION ALL (SELECT * FROM once_repaired EXCEPT SELECT * FROM public.track_tournament)) AS value",
        ).get_result(&mut connection).await?;
        assert!(repeated.value, "{case}");
        connection
            .batch_execute("DROP TABLE original_tournaments,original_results,once_repaired")
            .await?;
    }
    connection.batch_execute("SAVEPOINT before_down").await?;
    assert!(connection.batch_execute(REPAIR_DOWN).await.is_err());
    connection
        .batch_execute("ROLLBACK TO SAVEPOINT before_down")
        .await?;
    Ok(())
}
