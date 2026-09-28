use anyhow::{Result, ensure};
use zc_database::{Database, adoption, migrations};

const UP: &str = include_str!("../migrations/20260928030000_zsl_announcement/up.sql");
const DOWN: &str = include_str!("../migrations/20260928030000_zsl_announcement/down.sql");

#[tokio::test(flavor = "multi_thread")]
#[ignore = "requires disposable adopted PostgreSQL named zsl_announcement_test before announcement migration"]
async fn announcement_migration_and_contest_metadata() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/zsl_announcement_test",
        "Dedicated local disposable database required"
    );
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move {
        let _ = connection.await;
    });
    client.batch_execute(r#"
INSERT INTO public.zsl_points_structure(id,name,points,minimum_points,best_of) OVERRIDING SYSTEM VALUE VALUES(9000,'Fixture',ARRAY[10],1,1);
INSERT INTO public.zsl_season(id,id_points_structure,name,start_date,end_date) OVERRIDING SYSTEM VALUE VALUES(8,9000,'Season 8',now(),now()+interval '1 year');
INSERT INTO public.zsl_round(id,id_season,name,round,workshop_id,event_date,submission_start,submission_end,zsl_vote_end,cosmetic_vote_end) OVERRIDING SYSTEM VALUE VALUES(50,8,'Mixed Surfaces',1,123,'2026-10-11',now()-interval '22 days',now()-interval '1 day',now()+interval '6 days',now()+interval '30 days');
INSERT INTO public.zsl_round(id,id_season,name,round,workshop_id,event_date) OVERRIDING SYSTEM VALUE VALUES(51,8,'Another contest',2,0,'2026-11-11');
INSERT INTO public."user"(id,steam_id,steam_name) VALUES(9000,76561198000000099,'Fixture voter');
INSERT INTO public.level(id,hash,xx_hash,adventure) OVERRIDING SYSTEM VALUE VALUES(9000,'fixture-md5','announcement-fixture-xx',false);
INSERT INTO zc_private.level_submission_contest(id,id_zsl_round,state,rules,rules_hash,archive_object_key,archive_sha256,archive_size,finalized_at,frozen_at) OVERRIDING SYSTEM VALUE VALUES(9000,50,'frozen','{}','frozen-rules','inspector/workshop/frozen.tar.gz',repeat('a',64),42,now(),now());
INSERT INTO zc_private.level_submission_contest(id,id_zsl_round,state,rules,rules_hash) OVERRIDING SYSTEM VALUE VALUES(9001,51,'open','{}','other-rules');
INSERT INTO zc_private.level_submissions(id,id_contest,workshop_id,state,authors,level_hash) OVERRIDING SYSTEM VALUE VALUES(9000,9000,123,'selected',ARRAY['76561198000000001'],'announcement-fixture-xx');
INSERT INTO zc_private.level_submission_validation(id,id_submission,workshop_updated_at,workshop_file_size,validator_version,rules_hash,measurements,failures,valid,payload) OVERRIDING SYSTEM VALUE VALUES(9000,9000,'2026-09-27',42,'1','frozen-rules','{}','[]',true,'{"name":"Frozen level"}');
UPDATE zc_private.level_submissions SET latest_validation_id=9000 WHERE id=9000;
INSERT INTO zc_private.level_submission_playlist(id,id_contest,digest,valid_count,object_key) OVERRIDING SYSTEM VALUE VALUES(9000,9000,'immutable',1,'inspector/playlists/frozen.zeeplist');
INSERT INTO zc_private.level_submission_playlist_entry(id_playlist,position,id_validation,workshop_id) VALUES(9000,0,9000,123);
UPDATE zc_private.level_submission_contest SET current_playlist_id=9000 WHERE id=9000;
INSERT INTO zc_private.level_submission_vote(id_contest,id_user,id_level,vote_type) VALUES(9000,9000,9000,1);
"#).await?;
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    adoption::run(
        &url,
        &root.join("packages/database/drizzle"),
        adoption::Mode::Verify,
    )
    .await?;
    assert_eq!(migrations::run_pending(&url).await?, vec!["20260928030000"]);
    assert!(migrations::run_pending(&url).await?.is_empty());
    adoption::run(
        &url,
        &root.join("packages/database/drizzle"),
        adoption::Mode::Verify,
    )
    .await?;
    let db = Database::connect(&url, 2).await?;
    let contests = db.submission_contests(None, Some(50)).await?;
    assert_eq!(contests[0]["steamAnnouncementId"], "705530288588981646");
    let viewer = db.viewer_submission(Some(50), "76561198000000001").await?;
    assert_eq!(
        viewer["contest"]["steamAnnouncementId"],
        "705530288588981646"
    );
    assert_eq!(viewer["submission"]["id"], 9000);
    let unconfigured = client
        .query_one(
            "SELECT steam_announcement_id FROM public.zsl_round WHERE id=51",
            &[],
        )
        .await?;
    assert_eq!(unconfigured.get::<_, Option<i64>>(0), None);
    for invalid in [0_i64, -1] {
        assert!(
            client
                .execute(
                    "UPDATE public.zsl_round SET steam_announcement_id=$1 WHERE id=50",
                    &[&invalid]
                )
                .await
                .is_err()
        );
    }
    db.get_or_create_zsl_round(8, 1, "Imported name", 999, "2026-10-11")
        .await?;
    let round = client
        .query_one(
            "SELECT steam_announcement_id,workshop_id FROM public.zsl_round WHERE id=50",
            &[],
        )
        .await?;
    assert_eq!(round.get::<_, i64>(0), 705530288588981646);
    assert_eq!(round.get::<_, i64>(1), 123);
    let preserved = client.query_one("SELECT c.state,c.current_playlist_id,c.archive_sha256,(SELECT count(*) FROM zc_private.level_submission_vote WHERE id_contest=c.id) FROM zc_private.level_submission_contest c WHERE id=9000", &[]).await?;
    assert_eq!(preserved.get::<_, &str>(0), "frozen");
    assert_eq!(preserved.get::<_, i64>(1), 9000);
    assert_eq!(preserved.get::<_, &str>(2), "a".repeat(64));
    assert_eq!(preserved.get::<_, i64>(3), 1);
    let votes = db
        .super_league_vote_snapshot(Some(50), 9000, "76561198000000099")
        .await?
        .unwrap();
    assert_eq!(votes.candidates.len(), 1);
    assert_eq!(votes.votes[0], vec![9000]);
    // Exercise null, seed preservation and reversible DDL without changing the final fixture.
    client.batch_execute("BEGIN").await?;
    client
        .batch_execute("UPDATE public.zsl_round SET steam_announcement_id=123 WHERE id=50")
        .await?;
    client
        .batch_execute(&format!("UPDATE {}", UP.split_once("UPDATE ").unwrap().1))
        .await?;
    assert_eq!(
        client
            .query_one(
                "SELECT steam_announcement_id FROM public.zsl_round WHERE id=50",
                &[]
            )
            .await?
            .get::<_, i64>(0),
        123
    );
    client
        .batch_execute("UPDATE public.zsl_round SET steam_announcement_id=NULL WHERE id=50")
        .await?;
    assert!(db.submission_contests(None, Some(51)).await?[0]["steamAnnouncementId"].is_null());
    client.batch_execute(DOWN).await?;
    client.batch_execute(UP).await?;
    client.batch_execute("ROLLBACK").await?;
    Ok(())
}
