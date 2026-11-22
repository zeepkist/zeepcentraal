use anyhow::{Result, ensure};
use tokio_postgres::{Client, NoTls};
use zc_database::Database;

const EXISTS_SQL: &str = include_str!("fixtures/record_eligibility_flags/exists.sql");
const REVERT_ELIGIBILITY_MIGRATION: &str =
    include_str!("fixtures/record_eligibility_flags/revert_eligibility_migration.sql");
const COUNT_DISCORD_ACTIVITY_EVENT: &str =
    include_str!("fixtures/record_eligibility_flags/count_discord_activity_event.sql");
const APPLY_ELIGIBILITY_MIGRATION: &str =
    include_str!("fixtures/record_eligibility_flags/apply_eligibility_migration.sql");
const SELECT_RECORD_COUNT_LEVEL: &str =
    include_str!("fixtures/record_eligibility_flags/select_record_count_level.sql");
const SELECT_RECORD_COUNT_LEVEL_BY_ID_4: &str =
    include_str!("fixtures/record_eligibility_flags/select_record_count_level_by_id_4.sql");
const DELETE_RECORD: &str = include_str!("fixtures/record_eligibility_flags/delete_record.sql");

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
                &include_str!("fixtures/record_eligibility_flags/read_fixture_state.sql")
                    .replace("{{table}}", table)
                    .replace("{{column}}", column),
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
    client
        .execute(
            include_str!("fixtures/record_eligibility_flags/insert_record_validation.sql"),
            &[&id, &status],
        )
        .await?;
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
    if client.query_one(EXISTS_SQL, &[]).await?.get::<_, bool>(0) {
        client
            .batch_execute(&REVERT_ELIGIBILITY_MIGRATION.replace("{{down}}", DOWN))
            .await?;
    }
    client
        .batch_execute(include_str!("fixtures/record_eligibility_flags.sql"))
        .await?;
    let evidence = client
        .query_one(
            include_str!("fixtures/record_eligibility_flags/select_record.sql"),
            &[],
        )
        .await?
        .get::<_, String>(0);
    let notifications = client
        .query_one(COUNT_DISCORD_ACTIVITY_EVENT, &[])
        .await?
        .get::<_, i64>(0);
    client
        .batch_execute(&APPLY_ELIGIBILITY_MIGRATION.replace("{{up}}", UP))
        .await?;
    assert_flags(&client, 1, false).await?;
    for id in 2..=4 {
        assert_flags(&client, id, true).await?;
    }
    client
        .batch_execute(include_str!(
            "fixtures/record_eligibility_flags/set_id_record_record_validation.sql"
        ))
        .await?;
    assert_flags(&client, 1, true).await?;
    assert_flags(&client, 4, false).await?;
    assert_eq!(
        client
            .query_one(SELECT_RECORD_COUNT_LEVEL, &[])
            .await?
            .get::<_, i64>(0),
        1
    );
    assert_eq!(
        client
            .query_one(SELECT_RECORD_COUNT_LEVEL_BY_ID_4, &[])
            .await?
            .get::<_, i64>(0),
        0
    );
    client
        .batch_execute(include_str!(
            "fixtures/record_eligibility_flags/set_id_record_record_validation_by_id_record_4.sql"
        ))
        .await?;
    assert_flags(&client, 1, false).await?;
    assert_flags(&client, 4, true).await?;
    assert_eq!(
        client
            .query_one(
                include_str!("fixtures/record_eligibility_flags/select_record_by_id_1.sql"),
                &[]
            )
            .await?
            .get::<_, String>(0),
        evidence
    );
    assert!(
        client
            .query_one(
                include_str!("fixtures/record_eligibility_flags/record_is_eligible.sql"),
                &[]
            )
            .await?
            .get::<_, bool>(0)
    );

    // Detect unnecessary projection writes as well as changed projection contents.
    client
        .batch_execute(include_str!(
            "fixtures/record_eligibility_flags/create_history_flag_writes.sql"
        ))
        .await?;
    set_status(&client, 2, "fail").await?;
    assert_flags(&client, 2, false).await?;
    assert_eq!(
        client
            .query_one(
                include_str!("fixtures/record_eligibility_flags/count_history_flag_writes.sql"),
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
            include_str!("fixtures/record_eligibility_flags/delete_record_validation.sql"),
            &[],
        )
        .await?;
    assert_flags(&client, 2, true).await?;
    client
        .batch_execute(include_str!(
            "fixtures/record_eligibility_flags/insert_record_validation_2.sql"
        ))
        .await?;
    assert_flags(&client, 2, true).await?;
    client
        .batch_execute(include_str!(
            "fixtures/record_eligibility_flags/insert_record_validation_3.sql"
        ))
        .await?;
    assert_flags(&client, 2, false).await?;
    assert_flags(&client, 3, false).await?;
    client
        .batch_execute(include_str!(
            "fixtures/record_eligibility_flags/delete_record_validation_2.sql"
        ))
        .await?;
    assert_flags(&client, 2, true).await?;
    assert_flags(&client, 3, true).await?;
    client
        .batch_execute(include_str!(
            "fixtures/record_eligibility_flags/drop_test_history_flag_writes.sql"
        ))
        .await?;

    client
        .batch_execute(include_str!(
            "fixtures/record_eligibility_flags/set_role_zeepcentraal_graphql.sql"
        ))
        .await?;
    for (table, column) in TABLES {
        assert_eq!(
            client
                .query_one(
                    &include_str!("fixtures/record_eligibility_flags/count.sql")
                        .replace("{{table}}", table)
                        .replace("{{column}}", column),
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
                include_str!("fixtures/record_eligibility_flags/select_record_statistic.sql"),
                &[]
            )
            .await?
            .get::<_, f32>(0),
        300.0
    );
    assert_eq!(
        client
            .query_one(
                include_str!("fixtures/record_eligibility_flags/count_track_tournament_result.sql"),
                &[]
            )
            .await?
            .get::<_, i64>(0),
        1
    );
    assert_eq!(
        client
            .query_one(
                include_str!("fixtures/record_eligibility_flags/count_track_tournament_result_by_id_tournament_1.sql"),
                &[]
            )
            .await?
            .get::<_, i64>(0),
        0
    );
    assert!(
        client
            .query(
                include_str!(
                    "fixtures/record_eligibility_flags/select_report_record_validation.sql"
                ),
                &[]
            )
            .await
            .is_err()
    );
    for query in [
        include_str!("fixtures/record_eligibility_flags/count_record.sql"),
        include_str!("fixtures/record_eligibility_flags/select_record_statistic_2.sql"),
    ] {
        let plan = client
            .query(
                &include_str!("fixtures/record_eligibility_flags/explain_query.sql")
                    .replace("{{query}}", query),
                &[],
            )
            .await?
            .into_iter()
            .map(|r| r.get::<_, String>(0))
            .collect::<String>();
        ensure!(
            !plan.contains("record_validation") && !plan.contains("SubPlan"),
            "eligibility still executes read-time validation lookups"
        );
    }
    client
        .batch_execute(include_str!(
            "fixtures/record_eligibility_flags/reset_role.sql"
        ))
        .await?;
    assert_eq!(
        client
            .query_one(COUNT_DISCORD_ACTIVITY_EVENT, &[])
            .await?
            .get::<_, i64>(0),
        notifications
    );
    assert_eq!(
        client
            .query_one(SELECT_RECORD_COUNT_LEVEL, &[])
            .await?
            .get::<_, i64>(0),
        0
    );
    assert!(
        client
            .query_one(
                include_str!("fixtures/record_eligibility_flags/select_has_records_level.sql"),
                &[]
            )
            .await?
            .get::<_, bool>(0)
    );

    // A child insert holds the composite key stable. Validation retries after lock timeout.
    let concurrent = connect(&url).await?;
    client
        .batch_execute(include_str!(
            "fixtures/record_eligibility_flags/insert_record_media.sql"
        ))
        .await?;
    concurrent
        .batch_execute(include_str!(
            "fixtures/record_eligibility_flags/set_lock_timeout_100ms.sql"
        ))
        .await?;
    let error = concurrent
        .execute(
            include_str!("fixtures/record_eligibility_flags/set_status_record_validation.sql"),
            &[],
        )
        .await
        .expect_err("validation must wait for child key lock");
    assert_eq!(
        error.code(),
        Some(&tokio_postgres::error::SqlState::LOCK_NOT_AVAILABLE)
    );
    client
        .batch_execute(include_str!("fixtures/record_eligibility_flags/commit.sql"))
        .await?;
    assert_flags(&client, 1, false).await?;
    set_status(&concurrent, 1, "pass").await?;
    assert_flags(&client, 1, true).await?;
    set_status(&concurrent, 1, "fail").await?;
    assert_flags(&client, 1, false).await?;

    // Child rows inserted after failure and changed references use current flags.
    client
        .batch_execute(include_str!(
            "fixtures/record_eligibility_flags/delete_record_media.sql"
        ))
        .await?;
    assert!(
        client
            .query_one(
                include_str!(
                    "fixtures/record_eligibility_flags/select_record_eligible_record_media.sql"
                ),
                &[]
            )
            .await?
            .get::<_, bool>(0)
    );
    client
        .batch_execute(include_str!(
            "fixtures/record_eligibility_flags/set_id_record_record_media.sql"
        ))
        .await?;
    assert!(
        !client
            .query_one(
                include_str!("fixtures/record_eligibility_flags/select_record_eligible_record_media_by_id_record_1.sql"),
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
                include_str!("fixtures/record_eligibility_flags/count_personal_best_global.sql"),
                &[]
            )
            .await?
            .get::<_, i64>(0),
        0
    );
    client
        .batch_execute(&REVERT_ELIGIBILITY_MIGRATION.replace("{{down}}", DOWN))
        .await?;
    client
        .batch_execute(
            &include_str!(
                "fixtures/record_eligibility_flags/apply_and_roll_back_eligibility_migration.sql"
            )
            .replace("{{up}}", UP),
        )
        .await?;
    assert!(!client.query_one(EXISTS_SQL, &[]).await?.get::<_, bool>(0));
    client
        .batch_execute(&APPLY_ELIGIBILITY_MIGRATION.replace("{{up}}", UP))
        .await?;
    assert!(
        !client
            .query_one(
                include_str!("fixtures/record_eligibility_flags/select_record_eligible_record.sql"),
                &[]
            )
            .await?
            .get::<_, bool>(0)
    );
    client
        .batch_execute(include_str!(
            "fixtures/record_eligibility_flags/insert_record.sql"
        ))
        .await?;
    set_status(&client, 4, "fail").await?;
    let error = client
        .execute(DELETE_RECORD, &[])
        .await
        .expect_err("audit evidence still prevents deleting audited record");
    assert_eq!(
        error.code(),
        Some(&tokio_postgres::error::SqlState::FOREIGN_KEY_VIOLATION)
    );
    client
        .execute(
            include_str!(
                "fixtures/record_eligibility_flags/delete_record_validation_by_id_record_4.sql"
            ),
            &[],
        )
        .await?;
    client.execute(DELETE_RECORD, &[]).await?;
    assert_eq!(
        client
            .query_one(SELECT_RECORD_COUNT_LEVEL_BY_ID_4, &[])
            .await?
            .get::<_, i64>(0),
        1,
        "record deletion must retain surviving eligible count"
    );
    Ok(())
}
