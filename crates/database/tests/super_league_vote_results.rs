use anyhow::{Context, Result, ensure};
use serde_json::json;
use zc_database::{Database, services::super_league::VoteResultState};

const INSERT_LEVEL_SUBMISSION_VOTE: &str =
    include_str!("fixtures/super_league_vote_results/insert_level_submission_vote.sql");

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
    let points: i32 = client
        .query_one(
            include_str!("fixtures/super_league_vote_results/insert_zsl_points_structure.sql"),
            &[],
        )
        .await?
        .get(0);
    let season: i32 = client
        .query_one(
            include_str!("fixtures/super_league_vote_results/insert_zsl_season.sql"),
            &[&points],
        )
        .await?
        .get(0);
    let round: i32 = client
        .query_one(
            include_str!("fixtures/super_league_vote_results/insert_zsl_round.sql"),
            &[&season],
        )
        .await?
        .get(0);
    let historical: i32 = client
        .query_one(
            include_str!("fixtures/super_league_vote_results/insert_zsl_round_2.sql"),
            &[&season],
        )
        .await?
        .get(0);
    db.configure_inspector_contest(round, json!({}), "fixture")
        .await?;
    let contest = db.get_inspector_contest(round).await?.context("contest")?;
    let playlist: i64 = client
        .query_one(
            include_str!("fixtures/super_league_vote_results/insert_level_submission_playlist.sql"),
            &[&contest.id],
        )
        .await?
        .get(0);
    let steam_id = 76561198900000000_i64 + i64::from(round);
    let author = steam_id.to_string();
    let co_author = (steam_id + 2_000_000).to_string();
    let user: i32 = client
        .query_one(
            include_str!("fixtures/super_league_vote_results/insert_user.sql"),
            &[&steam_id],
        )
        .await?
        .get(0);
    let second_user: i32 = client
        .query_one(
            include_str!("fixtures/super_league_vote_results/insert_user_2.sql"),
            &[&(steam_id + 1_000_000)],
        )
        .await?
        .get(0);
    let invalid_user: i32 = client
        .query_one(
            include_str!("fixtures/super_league_vote_results/insert_user_3.sql"),
            &[&(steam_id + 3_000_000)],
        )
        .await?
        .get(0);
    let mut levels = Vec::new();
    let mut hashes = Vec::new();
    for index in 0..5 {
        let hash = format!("{:032X}", u128::try_from(round)? * 100 + index);
        let id: i32 = client
            .query_one(
                include_str!("fixtures/super_league_vote_results/insert_level.sql"),
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
        let authors = match position {
            1 => vec![
                author.clone(),
                (steam_id + 1_000_000).to_string(),
                co_author.clone(),
            ],
            4 => vec![author.clone(), co_author.clone()],
            _ => vec![author.clone()],
        };
        let submission: i64 = client
            .query_one(
                include_str!("fixtures/super_league_vote_results/insert_level_submissions.sql"),
                &[&contest.id, &workshop, &authors, &hashes[index]],
            )
            .await?
            .get(0);
        let payload = json!({"name":name,"author":"Private author fixture"}).to_string();
        let validation: i64 = client
            .query_one(
                include_str!(
                    "fixtures/super_league_vote_results/insert_level_submission_validation.sql"
                ),
                &[&submission, &valid, &payload],
            )
            .await?
            .get(0);
        client
            .execute(
                include_str!(
                    "fixtures/super_league_vote_results/insert_level_submission_playlist_entry.sql"
                ),
                &[&playlist, &(position as i32), &validation, &workshop],
            )
            .await?;
    }
    client
        .execute(
            include_str!(
                "fixtures/super_league_vote_results/set_state_level_submission_contest.sql"
            ),
            &[&contest.id, &playlist],
        )
        .await?;
    for vote_type in 1..=3_i16 {
        for id in [levels[0], levels[1], levels[2], levels[4]] {
            client
                .execute(
                    INSERT_LEVEL_SUBMISSION_VOTE,
                    &[&contest.id, &user, &id, &vote_type],
                )
                .await?;
        }
    }
    for id in [levels[0], levels[1], levels[2]] {
        client
            .execute(
                include_str!(
                    "fixtures/super_league_vote_results/insert_level_submission_vote_2.sql"
                ),
                &[&contest.id, &second_user, &id],
            )
            .await?;
    }
    for vote_type in 1..=3_i16 {
        client
            .execute(
                INSERT_LEVEL_SUBMISSION_VOTE,
                &[&contest.id, &invalid_user, &levels[4], &vote_type],
            )
            .await?;
    }
    let pending = db.super_league_vote_results(round).await?.unwrap();
    assert!(
        pending
            .categories
            .iter()
            .all(|category| category.state == VoteResultState::Pending
                && category.total_votes.is_none()
                && category.unique_voters.is_none()
                && category.levels.is_empty())
    );
    client
        .execute(
            include_str!("fixtures/super_league_vote_results/set_zsl_vote_end_zsl_round.sql"),
            &[&round],
        )
        .await?;
    let partial = db.super_league_vote_results(round).await?.unwrap();
    assert_eq!(partial.categories[0].state, VoteResultState::Published);
    assert_eq!(partial.categories[0].total_votes, Some(6));
    assert_eq!(partial.categories[0].unique_voters, Some(2));
    assert_eq!(
        partial.categories[0].levels[0].author_ids,
        vec![
            author.clone(),
            (steam_id + 1_000_000).to_string(),
            co_author.clone()
        ]
    );
    assert_eq!(
        partial.categories[0].levels[0].author_names,
        vec![
            "Voter fixture".to_owned(),
            "Second voter fixture".to_owned(),
            co_author.clone()
        ]
    );
    // Duplicate candidate keeps authors from the same submission used for its name.
    assert_eq!(
        partial.categories[0].levels[2].author_names,
        vec!["Voter fixture"]
    );
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
    assert!(partial.categories[1..].iter().all(|category| category.state
        == VoteResultState::Pending
        && category.total_votes.is_none()
        && category.unique_voters.is_none()
        && category.levels.is_empty()));
    let public = db.submission_contests(None, Some(round)).await?;
    assert_eq!(public[0]["resultTypes"], json!([1]));
    client
        .execute(
            include_str!("fixtures/super_league_vote_results/set_cosmetic_vote_end_zsl_round.sql"),
            &[&round],
        )
        .await?;
    let complete = db.super_league_vote_results(round).await?.unwrap();
    assert_eq!(
        complete
            .categories
            .iter()
            .map(|category| category.unique_voters)
            .collect::<Vec<_>>(),
        vec![Some(2), Some(1), Some(1)]
    );
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
        vec![levels[0], levels[1]]
    );
    let old = db.super_league_vote_results(historical).await?.unwrap();
    assert!(
        old.categories
            .iter()
            .all(|category| category.state == VoteResultState::Unavailable
                && category.total_votes.is_none()
                && category.unique_voters.is_none()
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
    client
        .execute(
            include_str!("fixtures/super_league_vote_results/delete_level_submission_vote.sql"),
            &[&contest.id],
        )
        .await?;
    let empty = db.super_league_vote_results(round).await?.unwrap();
    assert!(
        empty
            .categories
            .iter()
            .all(|category| category.total_votes == Some(0) && category.unique_voters == Some(0))
    );
    client
        .execute(
            include_str!(
                "fixtures/super_league_vote_results/set_valid_level_submission_validation.sql"
            ),
            &[&playlist],
        )
        .await?;
    let no_candidates = db.super_league_vote_results(round).await?.unwrap();
    assert!(
        no_candidates
            .categories
            .iter()
            .all(|category| category.total_votes == Some(0)
                && category.unique_voters == Some(0)
                && category.levels.is_empty())
    );
    client
        .execute(
            include_str!(
                "fixtures/super_league_vote_results/set_state_level_submission_contest_by_id.sql"
            ),
            &[&contest.id],
        )
        .await?;
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
