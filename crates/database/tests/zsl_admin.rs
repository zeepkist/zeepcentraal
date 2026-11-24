use diesel_async::{AsyncConnection, AsyncPgConnection};
use serde_json::{Value, json};
use zc_core::practice::{PracticeBundle, PracticeLevel, PracticePayload, warmup_playlist_key};
use zc_database::{
    Database,
    services::zsl_admin::{AdminSave, ZslAdminConflict, ZslAdminValidation},
};

const ADMIN: i64 = 76561198000000001;

fn utc_after(hours: i64) -> String {
    jiff::Timestamp::from_second(jiff::Timestamp::now().as_second() + hours * 3600)
        .unwrap()
        .to_string()
}

async fn save(database: &Database, settings: Value) -> anyhow::Result<i32> {
    database
        .save_zsl_admin(ADMIN, serde_json::from_value(settings)?)
        .await
}

fn bundle(round: i32) -> PracticeBundle {
    let levels = (0..4)
        .map(|index| {
            let sha = format!("{index:064x}");
            PracticePayload {
                xx_hash: None,
                legacy_hash: None,
                author_time: None,
                level: PracticeLevel {
                    uid: format!("warmup-{index}"),
                    workshop_id: 100 + index,
                    name: format!("Warmup {index}"),
                    author: "Test".into(),
                    collaborators: String::new(),
                    override_author_name: String::new(),
                },
                object_key: format!("zsl-practice/payloads/{sha}.gz"),
                sha256: sha,
                byte_size: 1,
            }
        })
        .collect();
    PracticeBundle {
        round_id: round,
        playlist: warmup_playlist_key(round),
        round_length: Some(300),
        levels,
    }
}

#[tokio::test]
#[ignore = "requires an empty local PostgreSQL database named zsl_admin_test"]
async fn admin_settings_and_playlist_revisions_are_fenced() -> anyhow::Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    anyhow::ensure!(parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/zsl_admin_test");
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    let connection = tokio::spawn(connection);
    for sql in [
        include_str!("fixtures/zsl_tournament.sql"),
        include_str!("fixtures/zsl_admin.sql"),
        include_str!("../migrations/20261010120000_zsl_tournament/up.sql"),
        include_str!("../migrations/20261122001000_zsl_admin/up.sql"),
        include_str!("../migrations/20261122002000_zsl_practice_upload/up.sql"),
    ] {
        client.batch_execute(sql).await?;
    }

    let database = Database::connect(&url, 2).await?;
    let points =
        json!({"kind":"points","name":"Scoring","points":[25,20,15],"minimumPoints":1,"bestOf":4});
    let points_id = save(&database, json!({"settings":points})).await?;
    let season = save(
        &database,
        json!({"settings":{"kind":"season","name":"Season Test",
        "pointsStructureId":points_id,"startDate":utc_after(1),"endDate":utc_after(200)}}),
    )
    .await?;
    let mut round = json!({"kind":"round","name":"Round Test","seasonId":season,"number":1,
        "workshopId":"9223372036854775807","eventDate":utc_after(48),"event2Date":utc_after(54),
        "submissionStart":utc_after(3),"submissionEnd":utc_after(18),
        "zslVoteEnd":utc_after(30),"cosmeticVoteEnd":utc_after(60)});
    let round_id = save(&database, json!({"settings":round})).await?;
    assert!(
        save(&database, json!({"settings":round}))
            .await
            .unwrap_err()
            .is::<ZslAdminConflict>()
    );
    let dashboard = database.zsl_admin_dashboard().await?;
    let round_version = dashboard["rounds"][0]["version"].clone();
    let points_version = dashboard["points"][0]["version"].clone();
    assert_eq!(dashboard["rounds"][0]["workshopId"], "9223372036854775807");
    round["name"] = "Updated round".into();
    let update = json!({"id":round_id,"version":round_version,"settings":round});
    save(&database, update.clone()).await?;
    assert!(
        save(&database, update)
            .await
            .unwrap_err()
            .is::<ZslAdminConflict>()
    );
    database
        .get_or_create_zsl_round(season, 1, "Old import", 0, "2025-01-01")
        .await?;
    assert_eq!(
        database.zsl_admin_dashboard().await?["rounds"][0]["name"],
        "Updated round"
    );
    let overlapping = json!({"kind":"round","name":"Overlap","seasonId":season,"number":2,
        "eventDate":utc_after(48),"event2Date":utc_after(49)});
    assert!(
        save(&database, json!({"settings":overlapping}))
            .await
            .unwrap_err()
            .is::<ZslAdminValidation>()
    );

    let status = database.zsl_playlist_status(round_id).await?;
    let first = status["playlists"][0]["selectedRevision"].as_i64().unwrap() as i32;
    let mut scheduler = AsyncPgConnection::establish(&url).await?;
    assert_eq!(
        Database::pending_zsl_playlists(&mut scheduler).await?,
        [first]
    );
    let first_job = database.claim_zsl_playlist(first).await?.unwrap();
    let second = database
        .request_zsl_playlist(ADMIN, round_id, "warmup", None, None)
        .await?;
    database
        .finish_zsl_playlist(&first_job, Some(&bundle(round_id)), json!([]))
        .await?;
    assert!(!database.verify_zsl_playlist(first, None).await?);
    let second_job = database.claim_zsl_playlist(second).await?.unwrap();
    let rejected = json!({"position":1,"name":"Rejected candidate","workshopId":"100",
        "uid":"missing","state":"failed","stage":"Workshop UID missing"});
    database
        .finish_zsl_playlist(&second_job, Some(&bundle(round_id)), json!([rejected]))
        .await?;
    assert_eq!(
        database.zsl_playlist_status(round_id).await?["playlists"][0]["state"],
        "prepared"
    );
    assert!(database.verify_zsl_playlist(second, None).await?);
    let verified = &database.zsl_playlist_status(round_id).await?["playlists"][0];
    assert_eq!(verified["levels"].as_array().unwrap().len(), 4);
    assert_eq!(verified["levels"][0]["state"], "ready");
    assert_eq!(verified["levels"][0]["uid"], "warmup-0");
    assert_eq!(verified["rejectedCandidates"][0]["uid"], "missing");
    assert_eq!(verified["rejectedCandidates"][0]["state"], "failed");
    let third = database
        .request_zsl_playlist(ADMIN, round_id, "warmup", None, None)
        .await?;
    let third_job = database.claim_zsl_playlist(third).await?.unwrap();
    database
        .finish_zsl_playlist(
            &third_job,
            None,
            json!([rejected, {"state":"failed","stage":"Too few playable levels"}]),
        )
        .await?;
    let status = database.zsl_playlist_status(round_id).await?;
    let warmup = &status["playlists"][0];
    assert_eq!(warmup["verifiedRevision"], second);
    assert_eq!(warmup["verifiedLevels"][3]["uid"], "warmup-3");
    assert_eq!(warmup["verifiedLevels"][3]["state"], "ready");
    assert_eq!(warmup["levels"], json!([]));
    assert_eq!(warmup["rejectedCandidates"][0]["uid"], "missing");
    assert_eq!(warmup["playlistErrors"], json!(["Too few playable levels"]));
    assert_eq!(
        database.host_zsl_playlists(round_id, false).await?[0].id,
        second
    );
    assert_eq!(
        database.host_zsl_playlists(round_id, true).await?[0].id,
        third
    );
    assert!(
        database
            .request_zsl_playlist(ADMIN, round_id, "", None, Some(third))
            .await?
            > third
    );
    check_practice_level_status(&database, &client, round_id).await?;

    client
        .execute(
            include_str!("fixtures/zsl_admin_start_warmup.sql"),
            &[&round_id],
        )
        .await?;
    let alerts = Database::zsl_readiness_alerts(&mut scheduler).await?;
    assert_eq!(alerts.len(), 1);
    assert_eq!(
        (alerts[0].round_id, alerts[0].timeslot, alerts[0].hours),
        (round_id, 1, 1)
    );
    assert!(
        Database::zsl_readiness_alerts(&mut scheduler)
            .await?
            .is_empty()
    );
    let mut changed_points = points;
    changed_points["bestOf"] = 3.into();
    let attempt: AdminSave = serde_json::from_value(
        json!({"id":points_id,"version":points_version,"settings":changed_points}),
    )?;
    assert!(
        database
            .save_zsl_admin(ADMIN, attempt)
            .await
            .unwrap_err()
            .is::<ZslAdminConflict>()
    );
    let next_version = database.zsl_admin_dashboard().await?["rounds"][0]["version"].clone();
    round["eventDate"] = utc_after(49).into();
    assert!(
        save(
            &database,
            json!({"id":round_id,"version":next_version,"settings":round})
        )
        .await
        .unwrap_err()
        .is::<ZslAdminConflict>()
    );

    client
        .batch_execute(include_str!(
            "../migrations/20261122002000_zsl_practice_upload/down.sql"
        ))
        .await?;
    client
        .batch_execute(include_str!(
            "../migrations/20261122001000_zsl_admin/down.sql"
        ))
        .await?;
    drop(client);
    connection.await??;
    Ok(())
}

async fn check_practice_level_status(
    database: &Database,
    client: &tokio_postgres::Client,
    round_id: i32,
) -> anyhow::Result<()> {
    client
        .batch_execute(include_str!("fixtures/zsl_admin_playlist_levels.sql"))
        .await?;
    let mut practice = bundle(round_id);
    for payload in &mut practice.levels {
        payload.level.workshop_id = 100;
    }
    let source =
        json!({"levels": practice.levels.iter().map(|payload| &payload.level).collect::<Vec<_>>()});
    let upload = database
        .request_zsl_playlist(ADMIN, round_id, "practice", Some(source.to_string()), None)
        .await?;
    let queued = &database.zsl_playlist_status(round_id).await?["playlists"][0];
    assert_eq!(queued["kind"], "practice");
    assert_eq!(queued["levels"].as_array().unwrap().len(), 4);
    assert_eq!(queued["levels"][0]["state"], "pending");
    assert_eq!(queued["levels"][0]["stage"], "Queued for preparation");
    assert_eq!(queued["levels"][0]["xxHash"], "A".repeat(32));
    assert_eq!(
        queued["levels"][0]["imageUrl"],
        "https://example.test/track-a.jpg"
    );
    assert_eq!(queued["levels"][1]["xxHash"], "B".repeat(32));
    assert!(queued["levels"][2].get("xxHash").is_none());
    assert!(queued["levels"][3].get("xxHash").is_none());
    assert!(queued.get("source").is_none());

    practice.levels[0].xx_hash = Some("E".repeat(32)); // Stored hash is unavailable.
    practice.levels[2].xx_hash = Some("D".repeat(32)); // Resolves the ambiguous identity.
    let job = database.claim_zsl_playlist(upload).await?.unwrap();
    database
        .finish_zsl_playlist(
            &job,
            Some(&practice),
            json!([{"position":1,"workshopId":"100","uid":"warmup-0",
                "state":"prepared","stage":"Payload uploaded"}]),
        )
        .await?;
    let prepared = &database.zsl_playlist_status(round_id).await?["playlists"][0];
    assert_eq!(prepared["levels"][0]["state"], "pending");
    assert_eq!(
        prepared["levels"][0]["stage"],
        "Payload uploaded. Awaiting host verification"
    );
    assert!(prepared["levels"][0].get("xxHash").is_none());
    assert_eq!(prepared["levels"][2]["xxHash"], "D".repeat(32));
    assert!(database.verify_zsl_playlist(upload, Some(json!([
        {"position":3,"workshopId":"100","uid":"warmup-0","state":"failed","stage":"Host payload corrupt"}
    ]))).await?);
    let failed = &database.zsl_playlist_status(round_id).await?["playlists"][0];
    assert_eq!(failed["levels"][0]["position"], 1);
    assert_eq!(failed["levels"][0]["state"], "failed");
    assert_eq!(failed["levels"][0]["stage"], "Host payload corrupt");
    assert_eq!(failed["levels"][2]["state"], "pending");
    assert_eq!(
        failed["levels"][2]["stage"],
        "Awaits verification after retry"
    );

    let retry = database
        .request_zsl_playlist(ADMIN, round_id, "", None, Some(upload))
        .await?;
    let job = database.claim_zsl_playlist(retry).await?.unwrap();
    database
        .finish_zsl_playlist(&job, Some(&practice), json!([]))
        .await?;
    assert!(database.verify_zsl_playlist(retry, None).await?);
    let verified = &database.zsl_playlist_status(round_id).await?["playlists"][0];
    assert_eq!(verified["levels"][0]["state"], "ready");
    assert_eq!(verified["levels"][2]["state"], "ready");
    Ok(())
}
