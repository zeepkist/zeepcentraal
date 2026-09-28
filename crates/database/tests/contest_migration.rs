use anyhow::{Result, ensure};
use std::path::Path;
use zc_database::{
    adoption::{Mode, run},
    migrations::run_pending,
};
const UP: &str = include_str!("../migrations/20260928010000_first_party_submissions/up.sql");
const DOWN: &str = include_str!("../migrations/20260928010000_first_party_submissions/down.sql");
#[tokio::test(flavor = "multi_thread")]
#[ignore = "requires disposable adopted PostgreSQL named zsl_migration_test before first-party migration"]
async fn contest_migration_up_down_and_repeat() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/zsl_migration_test",
        "Dedicated disposable database required"
    );
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    run(&url, &root.join("packages/database/drizzle"), Mode::Adopt).await?;
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move {
        let _ = connection.await;
    });
    // Voting migration remains reversible before column removal. Transactions keep fixture schedule intact.
    client.batch_execute("BEGIN").await?;
    client
        .batch_execute(include_str!(
            "../migrations/20260927010000_zsl_contest_voting/down.sql"
        ))
        .await?;
    client
        .batch_execute(include_str!(
            "../migrations/20260927010000_zsl_contest_voting/up.sql"
        ))
        .await?;
    client.batch_execute("ROLLBACK").await?;
    client.batch_execute(r#"
 INSERT INTO public.zsl_points_structure(id,name,points,minimum_points,best_of) OVERRIDING SYSTEM VALUE VALUES(9000,'Migration fixture',ARRAY[10],1,1);
 INSERT INTO public.zsl_season(id,id_points_structure,name,start_date,end_date) OVERRIDING SYSTEM VALUE VALUES(9000,9000,'Season 8 fixture',now(),now()+interval '1 year');
 INSERT INTO public.zsl_round(id,id_season,name,round,workshop_id,event_date,submission_start,submission_end,zsl_vote_end,cosmetic_vote_end) OVERRIDING SYSTEM VALUE VALUES(9000,9000,'Frozen fixture',1,123,now()+interval '2 weeks',now()-interval '22 days',now()-interval '1 day',now()+interval '6 days',now()+interval '30 days');
 INSERT INTO public."user"(id,steam_id,steam_name) VALUES(9000,76561198000000099,'Fixture voter');
 INSERT INTO public.level(id,hash,xx_hash,adventure) OVERRIDING SYSTEM VALUE VALUES(9000,'fixture-md5','migration-fixture-xx',false);
 INSERT INTO zc_private.level_submission_contest(id,thread_id,guild_id,forum_id,title,theme,season_number,round_number,id_zsl_round,mapping_source,state,rules,rules_hash,archive_object_key,archive_sha256,archive_size,finalized_at,frozen_at) OVERRIDING SYSTEM VALUE VALUES(9000,'1','2','3','Old title','Old theme',8,1,9000,'manual','frozen','{}','frozen-rules','inspector/workshop/frozen.tar.gz',repeat('a',64),42,now(),now());
 INSERT INTO zc_private.level_submissions(id,id_contest,message_id,author_id,workshop_id,message_created_at,state,last_seen,authors,level_hash) OVERRIDING SYSTEM VALUE VALUES(9000,9000,'4','5',123,now(),'selected',now(),ARRAY['76561198000000001'],'migration-fixture-xx');
 INSERT INTO zc_private.level_submission_validation(id,id_submission,workshop_updated_at,workshop_file_size,validator_version,rules_hash,measurements,failures,valid,payload) OVERRIDING SYSTEM VALUE VALUES(9000,9000,'2026-09-27',42,'1','frozen-rules','{}','[]',true,'{"name":"Frozen level"}');
 UPDATE zc_private.level_submissions SET latest_validation_id=9000 WHERE id=9000;
 INSERT INTO zc_private.level_submission_playlist(id,id_contest,digest,valid_count,object_key) OVERRIDING SYSTEM VALUE VALUES(9000,9000,'immutable',1,'inspector/playlists/frozen.zeeplist');
 INSERT INTO zc_private.level_submission_playlist_entry(id_playlist,position,id_validation,workshop_id) VALUES(9000,0,9000,123);
 UPDATE zc_private.level_submission_contest SET current_playlist_id=9000 WHERE id=9000;
 INSERT INTO zc_private.level_submission_vote(id_contest,id_user,id_level,vote_type) VALUES(9000,9000,9000,1);
 "#).await?;
    for invalid in [
        "UPDATE zc_private.level_submission_contest SET id_zsl_round=NULL WHERE id=9000",
        "INSERT INTO zc_private.level_submission_contest(thread_id,guild_id,forum_id,title,theme,season_number,round_number,id_zsl_round,mapping_source,rules,rules_hash) VALUES('duplicate','2','3','Duplicate','Duplicate',8,1,9000,'manual','{}','rules')",
        "UPDATE zc_private.level_submissions SET authors=NULL WHERE id=9000",
        "UPDATE zc_private.level_submissions SET authors=ARRAY['76561198000000001','76561198000000001'] WHERE id=9000",
    ] {
        client.batch_execute("BEGIN").await?;
        client.batch_execute(invalid).await?;
        assert!(client.batch_execute(UP).await.is_err());
        client.batch_execute("ROLLBACK").await?;
    }
    let applied = run_pending(&url).await?;
    assert!(applied.iter().any(|v| v == "20260928010000"));
    assert!(run_pending(&url).await?.is_empty());
    run(&url, &root.join("packages/database/drizzle"), Mode::Verify).await?;
    let preserved=client.query_one("SELECT c.state,c.current_playlist_id,c.archive_sha256,s.latest_validation_id,s.authors,s.level_hash,(SELECT count(*) FROM zc_private.level_submission_vote WHERE id_contest=c.id),(SELECT count(*) FROM zc_private.level_submission_notification) FROM zc_private.level_submission_contest c JOIN zc_private.level_submissions s ON s.id_contest=c.id WHERE c.id=9000",&[]).await?;
    assert_eq!(preserved.get::<_, &str>(0), "frozen");
    assert_eq!(preserved.get::<_, i64>(1), 9000);
    assert_eq!(preserved.get::<_, &str>(2), "a".repeat(64));
    assert_eq!(preserved.get::<_, i64>(3), 9000);
    assert_eq!(
        preserved.get::<_, Vec<String>>(4),
        vec!["76561198000000001"]
    );
    assert_eq!(preserved.get::<_, &str>(5), "migration-fixture-xx");
    assert_eq!(preserved.get::<_, i64>(6), 1);
    assert_eq!(preserved.get::<_, i64>(7), 0);
    assert!(client.batch_execute(DOWN).await.is_err());
    for authors in [
        Vec::<String>::new(),
        vec!["wrong".into()],
        vec!["76561198000000001".into(); 4],
    ] {
        assert!(
            client
                .execute(
                    "UPDATE zc_private.level_submissions SET authors=$1 WHERE id=9000",
                    &[&authors]
                )
                .await
                .is_err()
        );
    }
    let removed=client.query_one("SELECT count(*) FROM information_schema.columns WHERE table_schema='zc_private' AND table_name='level_submission_contest' AND column_name IN ('thread_id','guild_id','forum_id','title','theme','season_number','round_number','mapping_source','publication')",&[]).await?;
    assert_eq!(removed.get::<_, i64>(0), 0);
    let db = zc_database::Database::connect(&url, 2).await?;
    let votes = db
        .super_league_vote_snapshot(Some(9000), 9000, "76561198000000099")
        .await?
        .unwrap();
    assert_eq!(votes.candidates.len(), 1);
    assert_eq!(votes.votes[0], vec![9000]);
    assert_eq!(votes.open_types, vec![1, 2, 3]);
    assert!(db.pending_submission_notifications().await?.is_empty());
    assert_eq!(
        db.get_inspector_contest(9000).await?.unwrap().theme,
        "Frozen fixture"
    );
    // Migration ledger relocation and migrated catalog verification remain repeatable.
    client
        .batch_execute("ALTER TABLE zc_private.__diesel_schema_migrations SET SCHEMA public")
        .await?;
    assert!(run_pending(&url).await?.is_empty());
    run(&url, &root.join("packages/database/drizzle"), Mode::Verify).await?;
    Ok(())
}
