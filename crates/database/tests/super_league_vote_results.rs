use anyhow::{Context, Result, ensure};
use serde_json::json;
use zc_database::{Database, services::super_league::VoteResultState};

#[tokio::test(flavor = "multi_thread")]
#[ignore = "requires disposable migrated PostgreSQL named zsl_migration_test"]
async fn anonymous_tallies_deadlines_candidates_and_historical_rounds() -> Result<()> {
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
    let db = Database::connect(&url, 2).await?;
    let points: i32 = client.query_one("INSERT INTO public.zsl_points_structure(name,points,minimum_points,best_of) VALUES('Vote results fixture',ARRAY[10],1,1) RETURNING id", &[]).await?.get(0);
    let season: i32 = client.query_one("INSERT INTO public.zsl_season(id_points_structure,name,start_date,end_date) VALUES($1,'Vote results fixture',now(),now()+interval '1 year') RETURNING id", &[&points]).await?.get(0);
    let round: i32 = client.query_one("INSERT INTO public.zsl_round(id_season,name,round,workshop_id,event_date,submission_start,submission_end,zsl_vote_end,cosmetic_vote_end) VALUES($1,'Vote results fixture',1,0,now(),now()-interval '3 days',now()-interval '2 days',now()+interval '1 day',now()+interval '2 days') RETURNING id", &[&season]).await?.get(0);
    let historical: i32 = client.query_one("INSERT INTO public.zsl_round(id_season,name,round,workshop_id,event_date) VALUES($1,'No stored votes',2,0,now()) RETURNING id", &[&season]).await?.get(0);
    db.configure_inspector_contest(round, json!({}), "fixture")
        .await?;
    let contest = db.get_inspector_contest(round).await?.context("contest")?;
    let playlist: i64 = client.query_one("INSERT INTO zc_private.level_submission_playlist(id_contest,digest,valid_count,object_key) VALUES($1,'fixture',5,'fixture') RETURNING id", &[&contest.id]).await?.get(0);
    let steam_id = 76561198900000000_i64 + i64::from(round);
    let author = steam_id.to_string();
    let co_author = (steam_id + 2_000_000).to_string();
    let user: i32 = client.query_one("INSERT INTO public.\"user\"(steam_id,steam_name) VALUES($1,'Voter fixture') RETURNING id", &[&steam_id]).await?.get(0);
    let second_user: i32 = client.query_one("INSERT INTO public.\"user\"(steam_id,steam_name) VALUES($1,'Second voter fixture') RETURNING id", &[&(steam_id + 1_000_000)]).await?.get(0);
    let mut levels = Vec::new();
    let mut hashes = Vec::new();
    for index in 0..5 {
        let hash = format!("{:032X}", u128::try_from(round)? * 100 + index);
        let id: i32 = client
            .query_one(
                "INSERT INTO public.level(hash,xx_hash,adventure) VALUES($1,$1,false) RETURNING id",
                &[&hash],
            )
            .await?
            .get(0);
        levels.push(id);
        hashes.push(hash);
    }
    // Same canonical level appears twice in frozen playlist. Invalid entries never become candidates.
    for (position, (index, name, valid)) in [
        (0, "Zulu", true),
        (1, "Alpha", true),
        (2, "Alpha", true),
        (3, "Zero", true),
        (0, "Duplicate", true),
        (4, "Invalid", false),
    ]
    .into_iter()
    .enumerate()
    {
        let workshop = 8_000_000_000_i64 + i64::from(round) * 100 + position as i64;
        let authors = if position == 4 {
            vec![author.clone(), co_author.clone()]
        } else {
            vec![author.clone()]
        };
        let submission: i64 = client.query_one("INSERT INTO zc_private.level_submissions(id_contest,workshop_id,authors,state,level_hash) VALUES($1,$2,$3,'selected',$4) RETURNING id", &[&contest.id, &workshop, &authors, &hashes[index]]).await?.get(0);
        let payload = json!({"name":name,"author":"Private author fixture"}).to_string();
        let validation: i64 = client.query_one("INSERT INTO zc_private.level_submission_validation(id_submission,workshop_updated_at,workshop_file_size,validator_version,rules_hash,measurements,failures,valid,payload) VALUES($1,'fixture',1,'fixture','fixture','{}','[]',$2,$3::text::jsonb) RETURNING id", &[&submission, &valid, &payload]).await?.get(0);
        client.execute("INSERT INTO zc_private.level_submission_playlist_entry(id_playlist,position,id_validation,workshop_id) VALUES($1,$2,$3,$4)", &[&playlist, &(position as i32), &validation, &workshop]).await?;
    }
    client.execute("UPDATE zc_private.level_submission_contest SET state='frozen',current_playlist_id=$2,finalized_at=now(),archive_object_key='fixture',archive_sha256=repeat('a',64),archive_size=1 WHERE id=$1", &[&contest.id, &playlist]).await?;
    for vote_type in 1..=3_i16 {
        for id in [levels[0], levels[1], levels[2], levels[4]] {
            client.execute("INSERT INTO zc_private.level_submission_vote(id_contest,id_user,id_level,vote_type) VALUES($1,$2,$3,$4)", &[&contest.id, &user, &id, &vote_type]).await?;
        }
    }
    for id in [levels[0], levels[1], levels[2]] {
        client.execute("INSERT INTO zc_private.level_submission_vote(id_contest,id_user,id_level,vote_type) VALUES($1,$2,$3,1)", &[&contest.id, &second_user, &id]).await?;
    }
    let pending = db.super_league_vote_results(round).await?.unwrap();
    assert!(
        pending
            .categories
            .iter()
            .all(|category| category.state == VoteResultState::Pending
                && category.total_votes.is_none()
                && category.levels.is_empty())
    );
    client
        .execute(
            "UPDATE public.zsl_round SET zsl_vote_end=clock_timestamp() WHERE id=$1",
            &[&round],
        )
        .await?;
    let partial = db.super_league_vote_results(round).await?.unwrap();
    assert_eq!(partial.categories[0].state, VoteResultState::Published);
    assert_eq!(partial.categories[0].total_votes, Some(6));
    assert_eq!(
        partial.categories[0]
            .levels
            .iter()
            .map(|level| (level.level_id, level.votes))
            .collect::<Vec<_>>(),
        vec![
            (levels[1], 2),
            (levels[2], 2),
            (levels[0], 2),
            (levels[3], 0)
        ]
    );
    assert!(
        partial.categories[1..]
            .iter()
            .all(|category| category.state == VoteResultState::Pending
                && category.total_votes.is_none()
                && category.levels.is_empty())
    );
    let public = db.submission_contests(None, Some(round)).await?;
    assert_eq!(public[0]["resultTypes"], json!([1]));
    client
        .execute(
            "UPDATE public.zsl_round SET cosmetic_vote_end=clock_timestamp() WHERE id=$1",
            &[&round],
        )
        .await?;
    let complete = db.super_league_vote_results(round).await?.unwrap();
    assert_eq!(
        complete
            .categories
            .iter()
            .map(|category| category.total_votes)
            .collect::<Vec<_>>(),
        vec![Some(6), Some(3), Some(3)]
    );
    assert_eq!(
        db.submission_contests(None, Some(round)).await?[0]["resultTypes"],
        json!([1, 2, 3])
    );
    let saved = db
        .super_league_vote_snapshot(Some(round), user, &author)
        .await?
        .unwrap();
    assert!(
        saved
            .candidates
            .iter()
            .all(|candidate| candidate.self_authored)
    );
    assert_eq!(saved.candidates.len(), 4);
    let co_authored = db
        .super_league_vote_snapshot(Some(round), second_user, &co_author)
        .await?
        .unwrap();
    assert_eq!(
        co_authored
            .candidates
            .iter()
            .filter(|candidate| candidate.self_authored)
            .map(|candidate| candidate.level_id)
            .collect::<Vec<_>>(),
        vec![levels[0]]
    );
    let old = db.super_league_vote_results(historical).await?.unwrap();
    assert!(
        old.categories
            .iter()
            .all(|category| category.state == VoteResultState::Unavailable
                && category.total_votes.is_none()
                && category.levels.is_empty())
    );
    assert!(db.super_league_vote_results(i32::MAX).await?.is_none());
    // Frozen results remain available even after another round's contest is created.
    db.configure_inspector_contest(historical, json!({}), "fixture")
        .await?;
    assert_eq!(
        db.super_league_vote_results(round)
            .await?
            .unwrap()
            .categories[0]
            .total_votes,
        Some(6)
    );
    client.execute("UPDATE zc_private.level_submission_contest SET state='open',finalized_at=NULL,archive_object_key=NULL,archive_sha256=NULL,archive_size=NULL WHERE id=$1", &[&contest.id]).await?;
    assert!(
        db.super_league_vote_results(round)
            .await?
            .unwrap()
            .categories
            .iter()
            .all(
                |category| category.state == VoteResultState::Pending && category.levels.is_empty()
            )
    );
    assert_eq!(
        db.submission_contests(None, Some(round)).await?[0]["resultTypes"],
        json!([])
    );
    Ok(())
}
