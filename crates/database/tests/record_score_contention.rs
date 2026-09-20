use anyhow::{Context, Result};
use std::time::Duration;
use zc_database::{
    Database,
    services::{jobs::MaintenanceOutcome, record::RecordSubmission},
};

#[tokio::test]
#[ignore = "requires disposable PostgreSQL cloned from current Drizzle schema"]
async fn score_locks_and_user_points_row_do_not_block_record_submission() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")
        .context("ZC_TEST_DATABASE_URL is required")?;
    anyhow::ensure!(
        url::Url::parse(&url)?
            .host_str()
            .is_some_and(|host| matches!(host, "127.0.0.1" | "localhost")),
        "Record contention test requires local disposable PostgreSQL"
    );
    let database = Database::connect(&url, 4).await?;
    let suffix = i64::from(std::process::id());
    let user = database
        .get_or_insert_user(76_561_198_700_000_000 + suffix)
        .await?;
    let level = database
        .resolve_submission_level(
            &format!("record-contention-{suffix}"),
            &format!("{suffix:032X}"),
            true,
        )
        .await?;
    let (mut client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("PostgreSQL connection") });
    client
        .execute(
            "INSERT INTO public.user_points(id_user,points,total_points,rank,world_records) \
             VALUES($1,0,0,-1,0) ON CONFLICT(id_user) DO NOTHING",
            &[&user.id],
        )
        .await?;

    let blocker = client.transaction().await?;
    blocker
        .execute(
            "UPDATE public.user_points SET points=points WHERE id_user=$1",
            &[&user.id],
        )
        .await?;
    blocker
        .execute("SELECT pg_advisory_xact_lock(1861284954,$1)", &[&level.id])
        .await?;
    blocker
        .execute("SELECT pg_advisory_xact_lock(-1861284952,$1)", &[&user.id])
        .await?;

    let statistics = zc_core::ghosts::GhostStatistics::default();
    let submitted = tokio::time::timeout(
        Duration::from_secs(2),
        database.submit_record(RecordSubmission {
            id_user: user.id,
            id_level: level.id,
            time: 10.0,
            game_version: "test",
            mod_version: "test",
            splits: &[],
            speeds: &[],
            statistics: &statistics,
        }),
    )
    .await
    .context("record submission waited on score maintenance")??;
    assert!(submitted.personal_best_changed);
    assert_eq!(submitted.world_record_user_ids, vec![user.id]);
    assert_eq!(
        database.recalculate_player_score(user.id).await?,
        MaintenanceOutcome::Contended
    );

    blocker.rollback().await?;
    assert_eq!(
        database.recalculate_player_score(user.id).await?,
        MaintenanceOutcome::Applied(())
    );
    let world_records: i32 = client
        .query_one(
            "SELECT world_records FROM public.user_points WHERE id_user=$1",
            &[&user.id],
        )
        .await?
        .get(0);
    assert_eq!(world_records, 1);

    let slower = database
        .submit_record(RecordSubmission {
            id_user: user.id,
            id_level: level.id,
            time: 11.0,
            game_version: "test",
            mod_version: "test",
            splits: &[],
            speeds: &[],
            statistics: &statistics,
        })
        .await?;
    assert!(!slower.personal_best_changed);
    assert!(!slower.tournament_result_changed);
    assert!(slower.world_record_user_ids.is_empty());
    let persisted = client
        .query_one(
            "SELECT count(*)::bigint, \
             (SELECT id_record FROM public.personal_best_global WHERE id_user=$1 AND id_level=$2), \
             (SELECT id_record FROM public.world_record_global WHERE id_level=$2) \
             FROM public.record WHERE id_user=$1 AND id_level=$2",
            &[&user.id, &level.id],
        )
        .await?;
    assert_eq!(persisted.get::<_, i64>(0), 2);
    assert_eq!(persisted.get::<_, i32>(1), submitted.id_record);
    assert_eq!(persisted.get::<_, i32>(2), submitted.id_record);

    client
        .execute("DELETE FROM public.level WHERE id=$1", &[&level.id])
        .await?;
    client
        .execute("DELETE FROM public.\"user\" WHERE id=$1", &[&user.id])
        .await?;
    Ok(())
}
