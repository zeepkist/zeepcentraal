use anyhow::{Result, ensure};
use tokio_postgres::{Client, NoTls};
use zc_database::Database;

const UP: &str = include_str!("../migrations/20261013020000_persist_record_eligibility/up.sql");
const DOWN: &str = include_str!("../migrations/20261013020000_persist_record_eligibility/down.sql");
const TABLES: [(&str, &str); 7] = [
    ("public.record", "id"),
    ("public.record_media", "id_record"),
    ("public.record_statistic", "id_record"),
    ("public.personal_best_global", "id_record"),
    ("public.world_record_global", "id_record"),
    ("public.user_point_contribution", "id_record"),
    ("zc_private.record_history_index", "id"),
];

async fn connect(url: &str) -> Result<Client> {
    let (client, connection) = tokio_postgres::connect(url, NoTls).await?;
    tokio::spawn(async move { connection.await.expect("isolated flag test connection") });
    Ok(client)
}

async fn assert_flags(client: &Client, id: i32, expected: bool) -> Result<()> {
    for (table, column) in TABLES {
        let flags = client
            .query(
                &format!("SELECT record_eligible FROM {table} WHERE {column}=$1"),
                &[&id],
            )
            .await?;
        ensure!(!flags.is_empty(), "missing fixture row in {table}");
        for flag in flags {
            assert_eq!(flag.get::<_, bool>(0), expected, "{table} record {id}");
        }
    }
    Ok(())
}

async fn set_status(client: &Client, id: i32, status: &str) -> Result<()> {
    client.execute("INSERT INTO zc_private.record_validation(id_record,id_user,id_level,status,report,validator_version) SELECT id,id_user,id_level,$2,'{}','fixture' FROM public.record WHERE id=$1 ON CONFLICT(id_record) DO UPDATE SET status=excluded.status", &[&id,&status]).await?;
    Ok(())
}

#[tokio::test]
#[ignore = "requires isolated record_eligibility_flags_test with current schema"]
async fn flags_follow_validation_backfill_references_concurrency_and_rollback() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/record_eligibility_flags_test",
        "Isolated local flag test database required"
    );
    let client = connect(&url).await?;
    if client.query_one("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='record' AND column_name='record_eligible')", &[]).await?.get::<_,bool>(0) {
        client.batch_execute(&format!("BEGIN; {DOWN} COMMIT;")).await?;
    }
    client
        .batch_execute(include_str!("fixtures/record_eligibility_flags.sql"))
        .await?;
    let evidence = client
        .query_one(
            "SELECT to_jsonb(r)::text FROM public.record r WHERE id=1",
            &[],
        )
        .await?
        .get::<_, String>(0);
    let notifications = client
        .query_one("SELECT count(*) FROM public.discord_activity_event", &[])
        .await?
        .get::<_, i64>(0);
    client
        .batch_execute(&format!("BEGIN; {UP} COMMIT;"))
        .await?;
    assert_flags(&client, 1, false).await?;
    for id in 2..=4 {
        assert_flags(&client, id, true).await?;
    }
    client.batch_execute("UPDATE zc_private.record_validation SET id_record=4,id_user=4,id_level=4 WHERE id_record=1;").await?;
    assert_flags(&client, 1, true).await?;
    assert_flags(&client, 4, false).await?;
    assert_eq!(
        client
            .query_one("SELECT record_count FROM public.level WHERE id=1", &[])
            .await?
            .get::<_, i64>(0),
        1
    );
    assert_eq!(
        client
            .query_one("SELECT record_count FROM public.level WHERE id=4", &[])
            .await?
            .get::<_, i64>(0),
        0
    );
    client.batch_execute("UPDATE zc_private.record_validation SET id_record=1,id_user=1,id_level=1 WHERE id_record=4;").await?;
    assert_flags(&client, 1, false).await?;
    assert_flags(&client, 4, true).await?;
    assert_eq!(
        client
            .query_one(
                "SELECT (to_jsonb(r)-'record_eligible')::text FROM public.record r WHERE id=1",
                &[]
            )
            .await?
            .get::<_, String>(0),
        evidence
    );
    assert!(client.query_one("SELECT zc_private.record_is_eligible(NULL) AND zc_private.record_is_eligible(999999) AND NOT zc_private.record_is_eligible(1)", &[]).await?.get::<_,bool>(0));

    // Detect unnecessary projection writes as well as changed projection contents.
    client.batch_execute("CREATE TEMP TABLE history_flag_writes(flag_changed boolean,data_changed boolean); CREATE FUNCTION pg_temp.track_history_flag_writes() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO history_flag_writes VALUES(OLD.record_eligible IS DISTINCT FROM NEW.record_eligible,(to_jsonb(OLD)-'record_eligible') IS DISTINCT FROM (to_jsonb(NEW)-'record_eligible')); RETURN NULL; END $$; CREATE TRIGGER test_history_flag_writes AFTER UPDATE ON zc_private.record_history_index FOR EACH ROW EXECUTE FUNCTION pg_temp.track_history_flag_writes();").await?;
    set_status(&client, 2, "fail").await?;
    assert_flags(&client, 2, false).await?;
    assert_eq!(
        client
            .query_one(
                "SELECT count(*) FROM history_flag_writes WHERE NOT flag_changed OR data_changed",
                &[]
            )
            .await?
            .get::<_, i64>(0),
        0
    );
    for status in ["pass", "uncertain", "uncertain", "fail", "fail"] {
        set_status(&client, 2, status).await?;
        assert_flags(&client, 2, status != "fail").await?;
    }
    client
        .execute(
            "DELETE FROM zc_private.record_validation WHERE id_record=2",
            &[],
        )
        .await?;
    assert_flags(&client, 2, true).await?;
    client.batch_execute("BEGIN; INSERT INTO zc_private.record_validation(id_record,id_user,id_level,status,report,validator_version) VALUES(2,2,2,'fail','{}','fixture'); ROLLBACK;").await?;
    assert_flags(&client, 2, true).await?;
    client.batch_execute("INSERT INTO zc_private.record_validation(id_record,id_user,id_level,status,report,validator_version) SELECT id,id_user,id_level,'fail','{}','fixture' FROM public.record WHERE id IN(2,3) ON CONFLICT(id_record) DO UPDATE SET status=excluded.status;").await?;
    assert_flags(&client, 2, false).await?;
    assert_flags(&client, 3, false).await?;
    client
        .batch_execute("DELETE FROM zc_private.record_validation WHERE id_record IN(2,3);")
        .await?;
    assert_flags(&client, 2, true).await?;
    assert_flags(&client, 3, true).await?;
    client
        .batch_execute("DROP TRIGGER test_history_flag_writes ON zc_private.record_history_index;")
        .await?;

    client
        .batch_execute("SET ROLE zeepcentraal_graphql")
        .await?;
    for (table, column) in TABLES {
        assert_eq!(
            client
                .query_one(
                    &format!("SELECT count(*) FROM {table} WHERE {column}=1"),
                    &[]
                )
                .await?
                .get::<_, i64>(0),
            0,
            "failed row exposed by {table}"
        );
    }
    assert_eq!(
        client
            .query_one(
                "SELECT sum(distance)::real FROM public.record_statistic",
                &[]
            )
            .await?
            .get::<_, f32>(0),
        300.0
    );
    assert_eq!(
        client
            .query_one(
                "SELECT count(*) FROM public.track_tournament_result WHERE id_tournament=2",
                &[]
            )
            .await?
            .get::<_, i64>(0),
        1
    );
    assert_eq!(
        client
            .query_one(
                "SELECT count(*) FROM public.track_tournament_result WHERE id_tournament=1",
                &[]
            )
            .await?
            .get::<_, i64>(0),
        0
    );
    assert!(
        client
            .query("SELECT report FROM zc_private.record_validation", &[])
            .await
            .is_err()
    );
    for query in [
        "SELECT count(*) FROM public.record",
        "SELECT sum(distance) FROM public.record_statistic",
    ] {
        let plan = client
            .query(&format!("EXPLAIN {query}"), &[])
            .await?
            .into_iter()
            .map(|r| r.get::<_, String>(0))
            .collect::<String>();
        ensure!(
            !plan.contains("record_validation") && !plan.contains("SubPlan"),
            "eligibility still executes read-time validation lookups"
        );
    }
    client.batch_execute("RESET ROLE").await?;
    assert_eq!(
        client
            .query_one("SELECT count(*) FROM public.discord_activity_event", &[])
            .await?
            .get::<_, i64>(0),
        notifications
    );
    assert_eq!(
        client
            .query_one("SELECT record_count FROM public.level WHERE id=1", &[])
            .await?
            .get::<_, i64>(0),
        0
    );
    assert!(
        client
            .query_one(
                "SELECT has_records AND publicly_visible FROM public.level WHERE id=1",
                &[]
            )
            .await?
            .get::<_, bool>(0)
    );

    // A child insert holds the composite key stable. Validation retries after lock timeout.
    let concurrent = connect(&url).await?;
    client.batch_execute("BEGIN; INSERT INTO public.record_media(id_record,ghost_url) VALUES(1,'fixture-ghost') ON CONFLICT(id_record) DO UPDATE SET ghost_url=excluded.ghost_url;").await?;
    concurrent.batch_execute("SET lock_timeout='100ms'").await?;
    let error = concurrent
        .execute(
            "UPDATE zc_private.record_validation SET status='pass' WHERE id_record=1",
            &[],
        )
        .await
        .expect_err("validation must wait for child key lock");
    assert_eq!(
        error.code(),
        Some(&tokio_postgres::error::SqlState::LOCK_NOT_AVAILABLE)
    );
    client.batch_execute("COMMIT").await?;
    assert_flags(&client, 1, false).await?;
    set_status(&concurrent, 1, "pass").await?;
    assert_flags(&client, 1, true).await?;
    set_status(&concurrent, 1, "fail").await?;
    assert_flags(&client, 1, false).await?;

    // Child rows inserted after failure and changed references use current flags.
    client.batch_execute("DELETE FROM public.record_media WHERE id_record=1; INSERT INTO public.record_media(id_record,ghost_url,record_eligible) VALUES(1,'fixture-ghost',true); DELETE FROM public.record_media WHERE id_record=4; UPDATE public.record_media SET id_record=4 WHERE id_record=1;").await?;
    assert!(
        client
            .query_one(
                "SELECT record_eligible FROM public.record_media WHERE id_record=4",
                &[]
            )
            .await?
            .get::<_, bool>(0)
    );
    client
        .batch_execute("UPDATE public.record_media SET id_record=1 WHERE id_record=4;")
        .await?;
    assert!(
        !client
            .query_one(
                "SELECT record_eligible FROM public.record_media WHERE id_record=1",
                &[]
            )
            .await?
            .get::<_, bool>(0)
    );

    let db = Database::connect(&url, 2).await?;
    db.reconcile_record_eligibility(1).await?;
    assert_eq!(
        client
            .query_one(
                "SELECT count(*) FROM public.personal_best_global WHERE id_level=1",
                &[]
            )
            .await?
            .get::<_, i64>(0),
        0
    );
    client
        .batch_execute(&format!("BEGIN; {DOWN} COMMIT;"))
        .await?;
    client
        .batch_execute(&format!("BEGIN; {UP} ROLLBACK;"))
        .await?;
    assert!(!client.query_one("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='record' AND column_name='record_eligible')",&[]).await?.get::<_,bool>(0));
    client
        .batch_execute(&format!("BEGIN; {UP} COMMIT;"))
        .await?;
    assert!(
        !client
            .query_one("SELECT record_eligible FROM public.record WHERE id=1", &[])
            .await?
            .get::<_, bool>(0)
    );
    client.batch_execute("INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version) OVERRIDING SYSTEM VALUE VALUES(5,4,4,30,'fixture','fixture');").await?;
    set_status(&client, 4, "fail").await?;
    let error = client
        .execute("DELETE FROM public.record WHERE id=4", &[])
        .await
        .expect_err("audit evidence still prevents deleting audited record");
    assert_eq!(
        error.code(),
        Some(&tokio_postgres::error::SqlState::FOREIGN_KEY_VIOLATION)
    );
    client
        .execute(
            "DELETE FROM zc_private.record_validation WHERE id_record=4",
            &[],
        )
        .await?;
    client
        .execute("DELETE FROM public.record WHERE id=4", &[])
        .await?;
    assert_eq!(
        client
            .query_one("SELECT record_count FROM public.level WHERE id=4", &[])
            .await?
            .get::<_, i64>(0),
        1,
        "record deletion must retain surviving eligible count"
    );
    Ok(())
}
