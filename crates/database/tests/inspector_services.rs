use anyhow::{Context, Result};
use serde_json::json;
use zc_database::{
    Database,
    services::inspector::{
        InspectorContestInput, InspectorPlaylistMember, InspectorSubmissionInput,
        InspectorValidationInput,
    },
};

#[tokio::test]
#[ignore = "requires disposable PostgreSQL with current inspector tables"]
async fn inspector_mutations_preserve_atomic_state_transitions() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL").context("ZC_TEST_DATABASE_URL is required")?;
    let database = Database::connect(&url, 2).await?;
    let contest = database
        .save_inspector_contest(&InspectorContestInput {
            thread_id: "100".to_owned(),
            guild_id: "200".to_owned(),
            forum_id: "300".to_owned(),
            title: "S8R1 Mixed".to_owned(),
            theme: "Mixed".to_owned(),
            season_number: 8,
            round_number: 1,
            id_zsl_round: None,
            mapping_source: "title".to_owned(),
            rules: json!({"minBlocks": 0}),
            rules_hash: "rules".to_owned(),
            state: "open".to_owned(),
            frozen_at: None,
        })
        .await?;
    let id_contest = contest["id"].as_i64().context("contest id")?;
    assert!(database.link_inspector_round(id_contest, 7, true).await?);

    let selected = database
        .reconcile_inspector_submissions(
            id_contest,
            &[InspectorSubmissionInput {
                message_id: "400".to_owned(),
                author_id: "500".to_owned(),
                workshop_id: 600,
                message_created_at: "2026-09-19T00:00:00Z".to_owned(),
                message_edited_at: None,
                state: "selected".to_owned(),
                source_error: None,
                last_seen: "2026-09-19T00:01:00Z".to_owned(),
            }],
        )
        .await?;
    let id_submission = selected[0]["id"].as_i64().context("submission id")?;
    assert!(
        database
            .set_inspector_submission_retry(id_submission, "inspection-transient")
            .await?
    );

    let validation = database
        .save_inspector_validation(&InspectorValidationInput {
            id_submission,
            workshop_updated_at: "2026-09-19T00:00:00Z".to_owned(),
            workshop_file_size: 123,
            content_sha256: Some("content".to_owned()),
            validator_version: "1".to_owned(),
            rules_hash: "rules".to_owned(),
            id_level_item: None,
            file_uid: Some("uid".to_owned()),
            measurements: json!({"blocks": 1}),
            failures: json!([]),
            valid: true,
            payload: Some(json!({"uid": "uid"})),
        })
        .await?;
    let id_validation = validation["id"].as_i64().context("validation id")?;

    let playlist = database
        .publish_inspector_playlist(
            id_contest,
            "digest",
            "inspector/contest.zeeplist",
            &[InspectorPlaylistMember {
                id_validation,
                workshop_id: 600,
            }],
        )
        .await?;
    assert_eq!(playlist["valid_count"], 1);
    let same = database
        .publish_inspector_playlist(
            id_contest,
            "digest",
            "inspector/contest.zeeplist",
            &[InspectorPlaylistMember {
                id_validation,
                workshop_id: 600,
            }],
        )
        .await?;
    assert_eq!(same["id"], playlist["id"]);
    assert!(
        database
            .save_inspector_publication(id_contest, json!({"messageId": "700"}))
            .await?
    );
    assert!(database.freeze_inspector_contest(id_contest, true).await?);
    assert!(
        database
            .publish_inspector_playlist(id_contest, "other", "inspector/other.zeeplist", &[],)
            .await
            .is_err()
    );
    Ok(())
}
