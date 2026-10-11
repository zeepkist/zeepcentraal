use anyhow::{Result, ensure};
use serde_json::json;
const UP: &str =
    include_str!("../migrations/20261011180000_submission_playlist_notifications/up.sql");
const DOWN: &str =
    include_str!("../migrations/20261011180000_submission_playlist_notifications/down.sql");
#[tokio::test]
#[ignore = "requires empty local zsl_submission_playlist_test database"]
async fn public_overview_and_playlist_migration() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1")
            && (parsed.path() == "/zsl_submission_playlist_test"
                || parsed
                    .path()
                    .strip_prefix("/zsl_submission_playlist_test_")
                    .is_some_and(
                        |suffix| !suffix.is_empty() && suffix.bytes().all(|c| c.is_ascii_digit())
                    )),
        "Disposable fixture required"
    );
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move {
        let _ = connection.await;
    });
    ensure!(
        client
            .query_one("SELECT to_regclass('public.level') IS NULL", &[])
            .await?
            .get::<_, bool>(0),
        "Empty fixture required"
    );
    client
        .batch_execute(include_str!("fixtures/zsl_tournament.sql"))
        .await?;
    client
        .batch_execute(include_str!("fixtures/submission_playlist.sql"))
        .await?;
    client.batch_execute(UP).await?;
    client.batch_execute(DOWN).await?;
    client.batch_execute(UP).await?;
    client.batch_execute(r#"
INSERT INTO public.zsl_points_structure(id,name,points,minimum_points,best_of) VALUES(1,'Fixture',ARRAY[10],1,1);
INSERT INTO public.zsl_season(id,id_points_structure,name) VALUES(1,1,'Fixture');
INSERT INTO public.zsl_round(id,id_season,name,round,event_date,submission_start,submission_end) VALUES
 (1,1,'Current',1,now(),now()-interval '1 day',now()+interval '1 day'),
 (2,1,'Future',2,now(),now()+interval '1 day',now()+interval '2 days');
INSERT INTO public."user"(steam_id,steam_name) VALUES(76561198000000001,'Alice'),(76561198000000002,'Bob');
INSERT INTO public.level(id,hash,xx_hash) VALUES(1,'legacy','fixture-hash');
INSERT INTO zc_private.level_submission_contest(id_zsl_round) VALUES(1),(2);
INSERT INTO zc_private.level_submissions(id_contest,workshop_id,authors,state,revision,latest_validation_id,level_hash) VALUES
 (1,9007199254740993,ARRAY['76561198000000001','76561198000000002'],'selected',1,1,'fixture-hash'),
 (1,2,ARRAY['76561198000000003'],'selected',1,2,'fixture-hash'),
 (1,3,ARRAY['76561198000000004'],'selected',2,3,'fixture-hash'),
 (1,4,ARRAY['76561198000000005'],'selected',1,NULL,NULL),
 (1,5,ARRAY['76561198000000006'],'withdrawn',1,4,'fixture-hash'),
 (2,6,ARRAY['76561198000000007'],'selected',1,NULL,NULL);
INSERT INTO zc_private.level_submission_validation(id_submission,submission_revision,valid,file_uid,payload) VALUES
 (1,1,true,'uid','{"uid":"uid","name":"Accepted","sha256":"verified"}'),
 (2,1,false,'uid2','{"uid":"uid2","name":"Invalid","sha256":"verified"}'),
 (3,1,true,'uid3','{"uid":"uid3","name":"Stale","sha256":"verified"}'),
 (5,1,true,'uid4','{"uid":"uid4","name":"Withdrawn","sha256":"verified"}');
"#).await?;
    let db = zc_database::Database::connect(&url, 2).await?;
    let snapshot = db.submission_overview(None).await?;
    assert_eq!(snapshot.contest.as_ref().unwrap()["roundId"], 1);
    assert_eq!(snapshot.total_count, 4);
    assert_eq!(snapshot.valid_count, 1);
    assert_eq!(snapshot.submissions[0].workshop_id, "9007199254740993");
    assert_eq!(snapshot.submissions[0].author_names, vec!["Alice", "Bob"]);
    assert_eq!(snapshot.submissions[0].level["authorName"], "Alice, Bob");
    let members = [zc_database::services::inspector::InspectorPlaylistMember {
        id_validation: 1,
        workshop_id: 9007199254740993,
    }];
    let published = db
        .publish_inspector_playlist(
            1,
            1,
            "fixture-digest",
            "inspector/fixture.zeeplist",
            &members,
        )
        .await?;
    let queued = db.pending_playlist_notifications(&[1], "123").await?;
    assert_eq!(queued.len(), 1, "Publication queues delivery atomically");
    assert_eq!(queued[0]["playlistId"], published["id"]);
    assert!(
        db.publish_inspector_playlist(1, 999, "stale-digest", "inspector/stale.zeeplist", &members)
            .await
            .is_err()
    );
    assert_eq!(
        db.pending_playlist_notifications(&[1], "123").await?[0]["playlistId"],
        published["id"],
        "Rejected publication leaves delivery unchanged"
    );
    let other = db.submission_overview(Some(2)).await?;
    assert_eq!(other.total_count, 1);
    assert_eq!(other.valid_count, 0);
    assert!(db.submission_overview(Some(999)).await?.contest.is_none());
    client
        .execute(
            "UPDATE public.zsl_round SET submission_end=now()-interval '1 minute' WHERE id=1",
            &[],
        )
        .await?;
    assert_eq!(
        db.submission_overview(None).await?.contest.unwrap()["roundId"],
        2
    );
    client
        .execute(
            "UPDATE zc_private.level_submission_validation SET payload=$1::text::jsonb WHERE id=1",
            &[&json!({"uid":"wrong","name":"Incomplete","sha256":"verified"}).to_string()],
        )
        .await?;
    assert_eq!(db.submission_overview(Some(1)).await?.valid_count, 0);
    Ok(())
}
