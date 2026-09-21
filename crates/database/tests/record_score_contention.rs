use anyhow::{Context, Result};
use std::time::Duration;
use zc_database::{
    Database,
    services::{
        jobs::{LevelScoreUpdate, MaintenanceOutcome},
        record::RecordSubmission,
    },
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
    let user_score_blocker = client.transaction().await?;
    user_score_blocker
        .execute("SELECT pg_advisory_xact_lock(-1861284952,$1)", &[&user.id])
        .await?;
    assert_eq!(
        database.update_level_scores(&[level.id], false).await?,
        MaintenanceOutcome::Applied(LevelScoreUpdate {
            points_changed: true,
            projection_needed: true
        })
    );
    assert_eq!(
        database
            .reconcile_level_contribution_users(level.id, &[user.id])
            .await?,
        MaintenanceOutcome::Contended
    );
    user_score_blocker.rollback().await?;
    let page = database
        .level_contribution_user_page(level.id, 0, 50)
        .await?;
    assert_eq!(page.user_ids, vec![user.id]);
    assert_eq!(
        database
            .reconcile_level_contribution_users(level.id, &page.user_ids)
            .await?,
        MaintenanceOutcome::Applied(vec![user.id])
    );
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

#[tokio::test]
#[ignore = "requires disposable PostgreSQL cloned from current Drizzle schema"]
async fn submitter_projection_precedes_popular_level_cursor() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")
        .context("ZC_TEST_DATABASE_URL is required")?;
    let parsed = url::Url::parse(&url)?;
    anyhow::ensure!(
        parsed
            .host_str()
            .is_some_and(|host| matches!(host, "127.0.0.1" | "localhost"))
            && parsed.path().contains("test"),
        "Popular-level projection test requires local disposable test database"
    );
    let database = Database::connect(&url, 4).await?;
    let nonce = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_millis();
    let first_steam_id = 76_561_198_700_000_000_i64 + i64::try_from(nonce)? * 1_000;
    let level = database
        .resolve_submission_level(
            &format!("popular-projection-{nonce}"),
            &format!("{nonce:032X}"),
            true,
        )
        .await?;
    let (mut client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("PostgreSQL connection") });
    let statistics = zc_core::ghosts::GhostStatistics::default();
    let mut user_ids = Vec::with_capacity(205);
    for offset in 0..205_i64 {
        let user = database.get_or_insert_user(first_steam_id + offset).await?;
        user_ids.push(user.id);
        let result = database
            .submit_record(RecordSubmission {
                id_user: user.id,
                id_level: level.id,
                time: if offset == 204 {
                    9.0
                } else {
                    1_000.0 + offset as f32
                },
                game_version: "test",
                mod_version: "test",
                splits: &[],
                speeds: &[],
                statistics: &statistics,
            })
            .await?;
        assert!(result.personal_best_changed);
    }

    assert_eq!(
        database.update_level_scores(&[level.id], false).await?,
        MaintenanceOutcome::Applied(LevelScoreUpdate {
            points_changed: true,
            projection_needed: true
        })
    );
    let submitter = *user_ids.last().context("submitter missing")?;
    assert_eq!(
        database
            .reconcile_level_contribution_users(level.id, &[submitter])
            .await?,
        MaintenanceOutcome::Applied(vec![submitter])
    );
    assert_eq!(
        database.recalculate_player_score(submitter).await?,
        MaintenanceOutcome::Applied(())
    );
    let fast = client
        .query_one(
            "SELECT contribution.level_position,contribution.level_points, \
             contribution.contribution_rank,contribution.player_decayed_points,points.points \
             FROM public.user_point_contribution contribution \
             JOIN public.level_points points ON points.id_level=contribution.id_level \
             WHERE contribution.id_level=$1 AND contribution.id_user=$2",
            &[&level.id, &submitter],
        )
        .await?;
    assert_eq!(fast.get::<_, i32>(0), 1);
    assert!(fast.get::<_, i32>(1) > 0);
    assert_eq!(fast.get::<_, i32>(1), fast.get::<_, i32>(4));
    assert_eq!(fast.get::<_, i32>(2), 1);
    assert!(fast.get::<_, f32>(3) > 0.0);
    let before_cursor: i64 = client
        .query_one(
            "SELECT count(*) FROM public.user_point_contribution WHERE id_level=$1",
            &[&level.id],
        )
        .await?
        .get(0);
    assert_eq!(before_cursor, 1);

    let busy_user = user_ids[0];
    let blocker = client.transaction().await?;
    blocker
        .execute(
            "SELECT pg_advisory_xact_lock(-1861284952,$1)",
            &[&busy_user],
        )
        .await?;
    let first_page = database
        .level_contribution_user_page(level.id, 0, 50)
        .await?;
    assert_eq!(first_page.user_ids.len(), 50);
    assert!(first_page.user_ids.contains(&busy_user));
    assert_eq!(
        database
            .reconcile_level_contribution_users(level.id, &first_page.user_ids)
            .await?,
        MaintenanceOutcome::Contended
    );
    let free_users = first_page
        .user_ids
        .iter()
        .copied()
        .filter(|id| *id != busy_user)
        .collect::<Vec<_>>();
    assert_eq!(
        database
            .reconcile_level_contribution_users(level.id, &free_users)
            .await?,
        MaintenanceOutcome::Applied(free_users.clone())
    );
    blocker.rollback().await?;

    let mut after = 0;
    let mut pages = 0;
    loop {
        let page = database
            .level_contribution_user_page(level.id, after, 50)
            .await?;
        if page.user_ids.is_empty() {
            break;
        }
        assert_eq!(
            database
                .reconcile_level_contribution_users(level.id, &page.user_ids)
                .await?,
            MaintenanceOutcome::Applied(
                page.user_ids
                    .iter()
                    .copied()
                    .filter(|id| *id == busy_user || !free_users.contains(id))
                    .collect()
            )
        );
        for id_user in &page.user_ids {
            assert_eq!(
                database.recalculate_player_score(*id_user).await?,
                MaintenanceOutcome::Applied(())
            );
        }
        pages += 1;
        match page.next_after_user_id {
            Some(next) => after = next,
            None => break,
        }
    }
    assert!(pages >= 5);
    let converged: i64 = client
        .query_one(
            "SELECT count(*) FROM public.user_point_contribution \
             WHERE id_level=$1 AND contribution_rank=1 AND player_decayed_points>0",
            &[&level.id],
        )
        .await?
        .get(0);
    assert_eq!(converged, 205);
    let date_updated: String = client
        .query_one(
            "SELECT date_updated::text FROM public.level_points WHERE id_level=$1",
            &[&level.id],
        )
        .await?
        .get(0);
    assert_eq!(
        database.update_level_scores(&[level.id], false).await?,
        MaintenanceOutcome::Applied(LevelScoreUpdate {
            points_changed: false,
            projection_needed: false
        })
    );
    let unchanged_date_updated: String = client
        .query_one(
            "SELECT date_updated::text FROM public.level_points WHERE id_level=$1",
            &[&level.id],
        )
        .await?
        .get(0);
    assert_eq!(date_updated, unchanged_date_updated);
    let first_page = database
        .level_contribution_user_page(level.id, 0, 50)
        .await?;
    assert_eq!(
        database
            .reconcile_level_contribution_users(level.id, &first_page.user_ids)
            .await?,
        MaintenanceOutcome::Applied(Vec::new())
    );
    client
        .execute("DELETE FROM public.level WHERE id=$1", &[&level.id])
        .await?;
    client
        .execute("DELETE FROM public.\"user\" WHERE id=ANY($1)", &[&user_ids])
        .await?;
    Ok(())
}
