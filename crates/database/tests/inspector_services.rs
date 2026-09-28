use anyhow::{Context, Result, ensure};
use serde_json::json;
use zc_database::{
    Database,
    services::inspector::{InspectorPlaylistMember, InspectorValidationInput},
};

#[tokio::test(flavor = "multi_thread")]
#[ignore = "requires disposable migrated PostgreSQL named zsl_migration_test"]
async fn first_party_submissions_ownership_revisions_and_freeze() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/zsl_migration_test",
        "Dedicated disposable database required"
    );
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move {
        let _ = connection.await;
    });
    // Fixture owns only its newly inserted rows. Existing frozen fixture tests remain intact.
    let points:i32=client.query_one("INSERT INTO public.zsl_points_structure(name,points,minimum_points,best_of) VALUES('fixture',ARRAY[10],1,1) RETURNING id",&[]).await?.get(0);
    let season:i32=client.query_one("INSERT INTO public.zsl_season(id_points_structure,name,start_date,end_date) VALUES($1,'Fixture',now(),now()+interval '1 year') RETURNING id",&[&points]).await?.get(0);
    let round:i32=client.query_one("INSERT INTO public.zsl_round(id_season,name,round,workshop_id,event_date,submission_start,submission_end,zsl_vote_end,cosmetic_vote_end) VALUES($1,'Fixture round',1,0,now()+interval '1 month',now()-interval '1 day',now()+interval '1 day',now()+interval '8 days',now()+interval '45 days') RETURNING id",&[&season]).await?.get(0);
    let authors = [
        "76561198000000001".to_owned(),
        "76561198000000002".to_owned(),
        "76561198000000003".to_owned(),
    ];
    for (i, author) in authors.iter().enumerate() {
        client.execute("INSERT INTO public.\"user\"(steam_id,steam_name) VALUES($1,$2) ON CONFLICT(steam_id) DO NOTHING",&[&author.parse::<i64>()?,&format!("Author {i}")]).await?;
    }
    let db = Database::connect(&url, 6).await?;
    let cancelled = tokio::time::timeout(
        std::time::Duration::from_millis(50),
        db.with_inspector_lock(|| async {
            tokio::time::sleep(std::time::Duration::from_secs(10)).await;
            Ok(())
        }),
    )
    .await;
    assert!(cancelled.is_err());
    let other = Database::connect(&url, 2).await?;
    assert!(
        other
            .with_inspector_lock(|| async { Ok(()) })
            .await?
            .is_some(),
        "Cancelled run releases advisory lock"
    );

    db.configure_inspector_contest(round, json!({"minBlocks":0}), "rules")
        .await?;
    let id = db
        .submit_level(round, 123, &authors[..2], &authors[0])
        .await?;
    assert_eq!(
        db.viewer_submission(Some(round), &authors[1]).await?["submission"]["id"],
        id
    );
    assert!(db.submission_status(id, &authors[2]).await?.is_none());
    assert!(
        db.submit_level(round, 456, &authors[1..], &authors[2])
            .await
            .is_err()
    );
    assert!(
        db.submit_level(round, 123, &authors[2..], &authors[2])
            .await
            .is_err()
    );
    let missing = "76561198000000999".to_owned();
    let existing = db.get_user(authors[0].parse()?).await?.unwrap();
    assert!(db.get_user(missing.parse()?).await?.is_none());
    let shared_with_missing = [authors[0].clone(), authors[1].clone(), missing.clone()];
    for _ in 0..2 {
        assert_eq!(
            db.submit_level(round, 123, &shared_with_missing, &authors[0])
                .await?,
            id
        );
    }
    let placeholder = db.get_user(missing.parse()?).await?.unwrap();
    assert_eq!(placeholder.steam_id, Some(missing.parse()?));
    assert!(placeholder.steam_name.is_none());
    assert!(!placeholder.banned);
    assert_eq!(db.submission_status(id, &missing).await?.unwrap()["id"], id);
    let preserved = db.get_user(authors[0].parse()?).await?.unwrap();
    assert_eq!(preserved.id, existing.id);
    assert_eq!(preserved.steam_name, existing.steam_name);
    assert_eq!(preserved.discord_id, existing.discord_id);
    let count = client
        .query_one(
            "SELECT count(*) FROM public.\"user\" WHERE steam_id=$1",
            &[&missing.parse::<i64>()?],
        )
        .await?;
    assert_eq!(count.get::<_, i64>(0), 1);
    // Banned profiles remain banned. Earlier placeholder inserts roll back on rejection.
    client
        .execute(
            "UPDATE public.\"user\" SET banned=true WHERE steam_id=$1",
            &[&authors[2].parse::<i64>()?],
        )
        .await?;
    let rollback_author = "76561198000000000".to_owned();
    let rejected = db
        .submit_level(
            round,
            123,
            &[
                rollback_author.clone(),
                authors[0].clone(),
                authors[2].clone(),
            ],
            &authors[0],
        )
        .await
        .unwrap_err();
    assert!(matches!(
        rejected.downcast_ref(),
        Some(zc_database::services::submissions::SubmissionError::BannedAuthor)
    ));
    assert!(db.get_user(rollback_author.parse()?).await?.is_none());
    assert!(db.get_user(authors[2].parse()?).await?.unwrap().banned);
    client
        .execute(
            "UPDATE public.\"user\" SET banned=false WHERE steam_id=$1",
            &[&authors[2].parse::<i64>()?],
        )
        .await?;
    db.submit_level(round, 123, &authors[..2], &authors[0])
        .await?;
    assert_eq!(
        db.pending_submission_notifications().await?.len(),
        0,
        "No backfill before validation"
    );
    let contest = db.get_inspector_contest(round).await?.context("contest")?;
    let selected = db.get_inspector_submissions(contest.id).await?;
    assert!(selected[0].inspection_due);
    let revision = selected[0].revision;
    assert!(db.begin_inspector_validation(id, revision).await?);
    assert_eq!(
        db.submission_status(id, &authors[1]).await?.unwrap()["status"],
        "validating"
    );
    let hash = "0123456789ABCDEF0123456789ABCDEF";
    client.execute("INSERT INTO public.level(hash,xx_hash,adventure) VALUES('fixture-hash',$1,false) ON CONFLICT(xx_hash) DO NOTHING",&[&hash]).await?;
    let input = InspectorValidationInput {
        id_submission: id,
        submission_revision: revision,
        level_hash: Some(hash.into()),
        workshop_updated_at: "2026-09-28T00:00:00Z".into(),
        workshop_file_size: 42,
        content_sha256: Some("a".repeat(64)),
        validator_version: "2".into(),
        rules_hash: "rules".into(),
        id_level_item: None,
        file_uid: Some("uid".into()),
        measurements: json!({"blocks":100}),
        failures: json!([]),
        valid: true,
        payload: Some(
            json!({"uid":"uid","name":"Level","author":"Author","sha256":"a".repeat(64)}),
        ),
    };
    let validation = db
        .save_inspector_validation(&input)
        .await?
        .context("validation")?;
    assert_eq!(
        db.submission_status(id, &authors[0]).await?.unwrap()["status"],
        "complete"
    );
    assert!(!db.get_inspector_submissions(contest.id).await?[0].inspection_due);
    let notification = db.pending_submission_notifications().await?;
    assert_eq!(notification.len(), 1);
    db.finish_submission_notification(id, revision, Some(validation), Some("999"), "digest")
        .await?;
    assert!(db.pending_submission_notifications().await?.is_empty());
    let current = db.get_inspector_contest(round).await?.unwrap();
    let members = [InspectorPlaylistMember {
        id_validation: validation,
        workshop_id: 123,
    }];
    let playlist = db
        .publish_inspector_playlist(
            contest.id,
            current.playlist_revision,
            "digest",
            "inspector/fixture.zeeplist",
            &members,
        )
        .await?;
    assert_eq!(playlist["valid_count"], 1);
    assert_eq!(
        db.submit_level(round, 456, &authors[..2], &authors[1])
            .await?,
        id,
        "Collaborator edits preserve ID"
    );
    assert!(
        db.save_inspector_validation(&input).await?.is_none(),
        "Stale inspection rejected"
    );
    assert!(
        db.publish_inspector_playlist(
            contest.id,
            current.playlist_revision,
            "old",
            "inspector/old.zeeplist",
            &members
        )
        .await
        .is_err()
    );
    let updated = db.get_inspector_submissions(contest.id).await?;
    assert!(updated[0].inspection_due && updated[0].revision > revision);
    db.set_inspector_submission_retry(id, updated[0].revision, "transient")
        .await?;
    assert_eq!(
        db.submission_status(id, &authors[1]).await?.unwrap()["status"],
        "retrying"
    );
    let due=client.query_one("SELECT next_inspection_at>now()+interval '50 seconds' AND next_inspection_at<=now()+interval '60 seconds' FROM zc_private.level_submissions WHERE id=$1",&[&id]).await?;
    assert!(due.get::<_, bool>(0));
    db.withdraw_submission(round, &authors[1]).await?;
    assert_eq!(
        db.submission_status(id, &authors[0]).await?.unwrap()["status"],
        "withdrawn"
    );
    assert_eq!(db.pending_submission_notifications().await?.len(), 1);
    assert_eq!(
        db.submit_level(round, 456, &authors[..1], &authors[0])
            .await?,
        id
    );
    // Concurrent mutations involving a common collaborator serialize under contest lock.
    let shared = [authors[0].clone(), authors[2].clone()];
    let single = [authors[1].clone(), authors[2].clone()];
    let (a, b) = tokio::join!(
        db.submit_level(round, 789, &shared, &authors[0]),
        db.submit_level(round, 790, &single, &authors[1])
    );
    assert!(a.is_ok() ^ b.is_ok());
    client
        .execute(
            "UPDATE public.zsl_round SET submission_end=now()-interval '1 second' WHERE id=$1",
            &[&round],
        )
        .await?;
    assert!(
        db.submit_level(round, 555, &authors[..1], &authors[0])
            .await
            .is_err()
    );
    assert!(db.withdraw_submission(round, &authors[0]).await.is_err());
    assert!(
        !db.finalize_inspector_contest(
            contest.id,
            playlist["id"].as_i64().unwrap(),
            "inspector/workshop/fixture.tar.gz",
            &"a".repeat(64),
            10
        )
        .await?
    );
    // Clean final scans are necessary before freezing. Close every selected row with fresh invalid result.
    for selected in db.get_inspector_submissions(contest.id).await? {
        let mut final_input = input.clone();
        final_input.id_submission = selected.id;
        final_input.submission_revision = selected.revision;
        final_input.valid = false;
        final_input.payload = None;
        final_input.failures = json!(["fixture-invalid"]);
        db.save_inspector_validation(&final_input).await?;
    }
    let current = db.get_inspector_contest(round).await?.unwrap();
    let empty = db
        .publish_inspector_playlist(
            contest.id,
            current.playlist_revision,
            "empty",
            "inspector/empty.zeeplist",
            &[],
        )
        .await?;
    assert!(
        db.finalize_inspector_contest(
            contest.id,
            empty["id"].as_i64().unwrap(),
            "inspector/workshop/fixture.tar.gz",
            &"a".repeat(64),
            10
        )
        .await?
    );
    assert!(db.save_inspector_validation(&input).await?.is_none());
    assert!(
        db.publish_inspector_playlist(
            contest.id,
            current.playlist_revision,
            "changed",
            "inspector/changed.zeeplist",
            &[]
        )
        .await
        .is_err()
    );
    db.configure_inspector_contest(round, json!({"new":true}), "changed")
        .await?;
    assert_eq!(
        db.get_inspector_contest(round).await?.unwrap().rules_hash,
        "rules"
    );
    Ok(())
}
