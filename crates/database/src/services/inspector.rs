use crate::Database;
use anyhow::{Result, ensure};
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{Array, BigInt, Bool, Integer, Jsonb, Nullable, Text},
};
use diesel_async::{AsyncConnection, RunQueryDsl};
use serde::{Deserialize, Serialize};
use std::future::Future;

const SET_PLAYLIST_REVISION_LEVEL_SUBMISSION_CONTEST: &str =
    include_str!("../queries/inspector/set_playlist_revision_level_submission_contest.sql");

#[derive(QueryableByName)]
struct JsonRow {
    #[diesel(sql_type = Jsonb)]
    payload: serde_json::Value,
}

#[derive(QueryableByName)]
struct IdRow {
    #[diesel(sql_type = BigInt)]
    id: i64,
}

#[derive(QueryableByName)]
struct BoolRow {
    #[diesel(sql_type = Bool)]
    value: bool,
}

#[derive(QueryableByName)]
pub struct InspectorScheduleRow {
    #[diesel(sql_type = Text)]
    pub submission_end: String,
    #[diesel(sql_type = Bool)]
    pub due: bool,
    #[diesel(sql_type=Bool)]
    pub started: bool,
}

#[derive(QueryableByName)]
pub struct InspectorLobbyScheduleRow {
    #[diesel(sql_type = Text)]
    pub submission_end: String,
    #[diesel(sql_type = Text)]
    pub zsl_vote_end: String,
    #[diesel(sql_type = Bool)]
    pub closed: bool,
}

#[derive(Clone, Debug, Deserialize, QueryableByName, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectorContestRow {
    #[diesel(sql_type = BigInt)]
    pub id: i64,
    #[diesel(sql_type = Text)]
    pub theme: String,
    #[diesel(sql_type = Integer)]
    pub season_number: i32,
    #[diesel(sql_type = Integer)]
    pub round_number: i32,
    #[diesel(sql_type = Integer)]
    pub id_zsl_round: i32,
    #[diesel(sql_type = Text)]
    pub state: String,
    #[diesel(sql_type = Text)]
    pub rules_hash: String,
    #[diesel(sql_type = Nullable<BigInt>)]
    pub current_playlist_id: Option<i64>,
    #[diesel(sql_type = BigInt)]
    pub playlist_revision: i64,
    #[diesel(sql_type = BigInt)]
    pub published_revision: i64,
    #[diesel(sql_type = Bool)]
    pub finalized: bool,
    #[diesel(sql_type=Bool)]
    pub finalization_due: bool,
}

#[derive(Clone, Debug, Deserialize, QueryableByName, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectorSubmissionRow {
    #[diesel(sql_type = BigInt)]
    pub id: i64,
    #[diesel(sql_type = Array<Text>)]
    pub authors: Vec<String>,
    #[diesel(sql_type = Jsonb)]
    pub author_names: serde_json::Value,
    #[diesel(sql_type = BigInt)]
    pub workshop_id: i64,
    #[diesel(sql_type = Text)]
    pub submitted_at: String,
    #[diesel(sql_type = Text)]
    pub state: String,
    #[diesel(sql_type = BigInt)]
    pub revision: i64,
    #[diesel(sql_type = Bool)]
    pub inspection_due: bool,
    #[diesel(sql_type = Bool)]
    pub final_scan_due: bool,
    #[diesel(sql_type = Nullable<BigInt>)]
    pub latest_validation_id: Option<i64>,
}

#[derive(Clone, Debug, Deserialize, QueryableByName, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectorValidationRow {
    #[diesel(sql_type = BigInt)]
    pub id: i64,
    #[diesel(sql_type = BigInt)]
    pub id_submission: i64,
    #[diesel(sql_type = BigInt)]
    pub submission_revision: i64,
    #[diesel(sql_type = Text)]
    pub workshop_updated_at: String,
    #[diesel(sql_type = BigInt)]
    pub workshop_file_size: i64,
    #[diesel(sql_type = Nullable<Text>)]
    pub content_sha256: Option<String>,
    #[diesel(sql_type = Text)]
    pub validator_version: String,
    #[diesel(sql_type = Text)]
    pub rules_hash: String,
    #[diesel(sql_type = Jsonb)]
    pub failures: serde_json::Value,
    #[diesel(sql_type = Jsonb)]
    pub measurements: serde_json::Value,
    #[diesel(sql_type = Nullable<Text>)]
    pub file_uid: Option<String>,
    #[diesel(sql_type = Bool)]
    pub valid: bool,
    #[diesel(sql_type = Nullable<Jsonb>)]
    pub payload: Option<serde_json::Value>,
}

#[derive(Clone, Debug, Deserialize, QueryableByName, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectorPlaylistRow {
    #[diesel(sql_type = BigInt)]
    pub id: i64,
    #[diesel(sql_type = Text)]
    pub digest: String,
    #[diesel(sql_type = Integer)]
    pub valid_count: i32,
    #[diesel(sql_type = Text)]
    pub object_key: String,
    #[diesel(sql_type = BigInt)]
    pub date_created_epoch: i64,
}

#[derive(Clone, Debug, Deserialize, QueryableByName, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectorPlaylistMemberRow {
    #[diesel(sql_type = BigInt)]
    pub id_validation: i64,
    #[diesel(sql_type = BigInt)]
    pub workshop_id: i64,
    #[diesel(sql_type = Bool)]
    pub valid: bool,
    #[diesel(sql_type = Nullable<Jsonb>)]
    pub payload: Option<serde_json::Value>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectorPlaylistBundle {
    pub playlist: InspectorPlaylistRow,
    pub members: Vec<InspectorPlaylistMemberRow>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectorValidationInput {
    pub id_submission: i64,
    pub submission_revision: i64,
    pub level_hash: Option<String>,
    pub workshop_updated_at: String,
    pub workshop_file_size: i64,
    pub content_sha256: Option<String>,
    pub validator_version: String,
    pub rules_hash: String,
    pub id_level_item: Option<i32>,
    pub file_uid: Option<String>,
    pub measurements: serde_json::Value,
    pub failures: serde_json::Value,
    pub valid: bool,
    pub payload: Option<serde_json::Value>,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectorPlaylistMember {
    pub id_validation: i64,
    pub workshop_id: i64,
}

impl Database {
    pub async fn get_inspector_lobby_schedule(
        &self,
        round_id: i32,
    ) -> Result<Option<InspectorLobbyScheduleRow>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(include_str!(
            "../queries/inspector/get_inspector_lobby_schedule.sql"
        ))
        .bind::<Integer, _>(round_id)
        .get_result::<InspectorLobbyScheduleRow>(&mut connection)
        .await
        .optional()?)
    }

    pub async fn get_inspector_playlist_by_round(
        &self,
        round_id: i32,
    ) -> Result<Option<InspectorPlaylistBundle>> {
        let mut connection = self.connection().await?;
        let playlist = sql_query(include_str!("../queries/inspector/select_id_p.sql"))
            .bind::<Integer, _>(round_id)
            .get_result::<InspectorPlaylistRow>(&mut connection)
            .await
            .optional()?;
        let Some(playlist) = playlist else {
            return Ok(None);
        };
        let members = sql_query(include_str!(
            "../queries/inspector/select_id_validation_unnest.sql"
        ))
        .bind::<BigInt, _>(playlist.id)
        .load::<InspectorPlaylistMemberRow>(&mut connection)
        .await?;
        Ok(Some(InspectorPlaylistBundle { playlist, members }))
    }

    pub async fn get_inspector_schedule(
        &self,
        round_id: i32,
    ) -> Result<Option<InspectorScheduleRow>> {
        let mut connection = self.connection().await?;
        Ok(sql_query(include_str!(
            "../queries/inspector/get_inspector_schedule.sql"
        ))
        .bind::<Integer, _>(round_id)
        .get_result::<InspectorScheduleRow>(&mut connection)
        .await
        .optional()?)
    }

    pub async fn finalize_inspector_contest(
        &self,
        contest_id: i64,
        playlist_id: i64,
        archive_key: &str,
        archive_sha256: &str,
        archive_size: i64,
    ) -> Result<bool> {
        ensure!(
            contest_id > 0
                && playlist_id > 0
                && archive_key.starts_with("inspector/workshop/")
                && archive_sha256.len() == 64
                && archive_size > 0,
            "Invalid contest archive"
        );
        let mut connection = self.connection().await?;
        Ok(sql_query(include_str!(
            "../queries/inspector/finalize_inspector_contest.sql"
        ))
        .bind::<BigInt, _>(contest_id)
        .bind::<BigInt, _>(playlist_id)
        .bind::<Text, _>(archive_key)
        .bind::<Text, _>(archive_sha256)
        .bind::<BigInt, _>(archive_size)
        .execute(&mut connection)
        .await?
            > 0)
    }

    pub async fn with_inspector_lock<T, F, Fut>(&self, run: F) -> Result<Option<T>>
    where
        F: FnOnce() -> Fut + Send,
        Fut: Future<Output = Result<T>> + Send,
        T: Send,
    {
        let mut connection = self.connection().await?;
        connection
            .transaction::<_, anyhow::Error, _>(async move |connection| {
                // External downloads can take minutes; this dedicated lock transaction has no row locks.
                sql_query(include_str!(
                    "../queries/inspector/set_local_idle_in_transaction_session_timeout_0.sql"
                ))
                .execute(connection)
                .await?;
                let locked = sql_query(include_str!(
                    "../queries/inspector/with_inspector_lock_pg_try_advisory_xact_lock.sql"
                ))
                .get_result::<BoolRow>(connection)
                .await?
                .value;
                if !locked {
                    return Ok(None);
                }
                Ok(Some(run().await?))
            })
            .await
    }

    pub async fn inspector_workshop_level_link_exists(
        &self,
        level_hash: &str,
        workshop_id: i64,
    ) -> Result<bool> {
        ensure!(
            !level_hash.is_empty() && workshop_id > 0,
            "Invalid workshop level link"
        );
        let mut connection = self.connection().await?;
        Ok(sql_query(include_str!(
            "../queries/inspector/inspector_workshop_level_link_exists.sql"
        ))
        .bind::<Text, _>(level_hash)
        .bind::<BigInt, _>(workshop_id)
        .get_result::<BoolRow>(&mut connection)
        .await?
        .value)
    }

    pub async fn publish_inspector_playlist(
        &self,
        id_contest: i64,
        expected_revision: i64,
        digest: &str,
        object_key: &str,
        members: &[InspectorPlaylistMember],
    ) -> Result<serde_json::Value> {
        ensure!(
            id_contest > 0 && !digest.is_empty() && object_key.starts_with("inspector/"),
            "Invalid inspector playlist"
        );
        ensure!(
            members.len() <= 1_001,
            "Inspector playlist exceeds protocol capacity"
        );
        ensure!(
            members
                .iter()
                .all(|member| member.id_validation > 0 && member.workshop_id > 0),
            "Invalid inspector playlist member"
        );
        let mut connection = self.connection().await?;
        connection
            .transaction::<serde_json::Value, anyhow::Error, _>(async move |connection| {
                let contest = sql_query(include_str!(
                    "../queries/inspector/select_id_level_submission_contest.sql"
                ))
                .bind::<BigInt, _>(id_contest)
                .bind::<BigInt, _>(expected_revision)
                .get_result::<IdRow>(connection)
                .await
                .optional()?;
                ensure!(contest.is_some(), "Contest is frozen or missing");
                for member in members {
                    ensure!(
                        sql_query(include_str!(
                            "../queries/inspector/publish_inspector_playlist_exists.sql"
                        ))
                        .bind::<BigInt, _>(member.id_validation)
                        .bind::<BigInt, _>(id_contest)
                        .bind::<BigInt, _>(member.workshop_id)
                        .get_result::<BoolRow>(connection)
                        .await?
                        .value,
                        "Playlist contains stale validation"
                    );
                }
                let inserted = sql_query(include_str!(
                    "../queries/inspector/insert_level_submission_playlist.sql"
                ))
                .bind::<BigInt, _>(id_contest)
                .bind::<Text, _>(digest)
                .bind::<Integer, _>(i32::try_from(members.len())?)
                .bind::<Text, _>(object_key)
                .get_result::<IdRow>(connection)
                .await
                .optional()?;
                let was_inserted = inserted.is_some();
                let id_playlist = match inserted {
                    Some(row) => row.id,
                    None => {
                        sql_query(include_str!(
                            "../queries/inspector/select_id_level_submission_playlist.sql"
                        ))
                        .bind::<BigInt, _>(id_contest)
                        .bind::<Text, _>(digest)
                        .get_result::<IdRow>(connection)
                        .await?
                        .id
                    }
                };
                if was_inserted {
                    for (position, member) in members.iter().enumerate() {
                        sql_query(include_str!(
                            "../queries/inspector/insert_level_submission_playlist_entry.sql"
                        ))
                        .bind::<BigInt, _>(id_playlist)
                        .bind::<Integer, _>(i32::try_from(position)?)
                        .bind::<BigInt, _>(member.id_validation)
                        .bind::<BigInt, _>(member.workshop_id)
                        .execute(connection)
                        .await?;
                    }
                }
                sql_query(include_str!(
                    "../queries/inspector/set_current_playlist_id_level_submission_contest.sql"
                ))
                .bind::<BigInt, _>(id_contest)
                .bind::<BigInt, _>(id_playlist)
                .execute(connection)
                .await?;
                sql_query(include_str!(
                    "../queries/inspector/insert_level_submission_playlist_notification.sql"
                ))
                .bind::<BigInt, _>(id_contest)
                .bind::<BigInt, _>(id_playlist)
                .execute(connection)
                .await?;
                Ok(sql_query(include_str!(
                    "../queries/inspector/select_level_submission_playlist.sql"
                ))
                .bind::<BigInt, _>(id_playlist)
                .get_result::<JsonRow>(connection)
                .await?
                .payload)
            })
            .await
    }
    pub async fn configure_inspector_contest(
        &self,
        round_id: i32,
        rules: serde_json::Value,
        rules_hash: &str,
    ) -> Result<()> {
        let mut connection = self.connection().await?;
        connection
            .transaction::<_, anyhow::Error, _>(async move |connection| {
                let changed = sql_query(include_str!(
                    "../queries/inspector/select_id_level_submission_contest_by_id_zsl_round.sql"
                ))
                .bind::<Integer, _>(round_id)
                .bind::<Text, _>(rules_hash)
                .get_result::<IdRow>(connection)
                .await
                .optional()?;
                if let Some(row) = changed {
                    sql_query(include_str!(
                        "../queries/inspector/set_revision_level_submissions.sql"
                    ))
                    .bind::<BigInt, _>(row.id)
                    .execute(connection)
                    .await?;
                    sql_query(SET_PLAYLIST_REVISION_LEVEL_SUBMISSION_CONTEST)
                        .bind::<BigInt, _>(row.id)
                        .execute(connection)
                        .await?;
                }
                sql_query(include_str!(
                    "../queries/inspector/insert_level_submission_contest.sql"
                ))
                .bind::<Integer, _>(round_id)
                .bind::<Jsonb, _>(rules)
                .bind::<Text, _>(rules_hash)
                .execute(connection)
                .await?;
                Ok(())
            })
            .await
    }
    pub async fn defer_inspector_finalization(&self, round: i32) -> Result<()> {
        let mut c = self.connection().await?;
        sql_query(include_str!(
            "../queries/inspector/defer_inspector_finalization.sql"
        ))
        .bind::<Integer, _>(round)
        .execute(&mut c)
        .await?;
        Ok(())
    }
    pub async fn get_inspector_contest(
        &self,
        round_id: i32,
    ) -> Result<Option<InspectorContestRow>> {
        let mut c = self.connection().await?;
        Ok(sql_query(include_str!(
            "../queries/inspector/get_inspector_contest.sql"
        ))
        .bind::<Integer, _>(round_id)
        .get_result(&mut c)
        .await
        .optional()?)
    }
    pub async fn get_inspector_submissions(
        &self,
        contest_id: i64,
    ) -> Result<Vec<InspectorSubmissionRow>> {
        let mut c = self.connection().await?;
        Ok(sql_query(include_str!(
            "../queries/inspector/get_inspector_submissions.sql"
        ))
        .bind::<BigInt, _>(contest_id)
        .load(&mut c)
        .await?)
    }
    pub async fn get_inspector_validation(
        &self,
        id: Option<i64>,
    ) -> Result<Option<InspectorValidationRow>> {
        let Some(id) = id else { return Ok(None) };
        let mut c = self.connection().await?;
        Ok(sql_query(include_str!(
            "../queries/inspector/get_inspector_validation.sql"
        ))
        .bind::<BigInt, _>(id)
        .get_result(&mut c)
        .await
        .optional()?)
    }
    pub async fn begin_inspector_validation(&self, id: i64, revision: i64) -> Result<bool> {
        let mut c = self.connection().await?;
        Ok(sql_query(include_str!(
            "../queries/inspector/begin_inspector_validation.sql"
        ))
        .bind::<BigInt, _>(id)
        .bind::<BigInt, _>(revision)
        .execute(&mut c)
        .await?
            > 0)
    }
    pub async fn finish_inspector_cache_check(&self, id: i64, revision: i64) -> Result<()> {
        let mut c = self.connection().await?;
        sql_query(include_str!(
            "../queries/inspector/finish_inspector_cache_check.sql"
        ))
        .bind::<BigInt, _>(id)
        .bind::<BigInt, _>(revision)
        .execute(&mut c)
        .await?;
        Ok(())
    }
    pub async fn set_inspector_submission_retry(
        &self,
        id: i64,
        revision: i64,
        category: &str,
    ) -> Result<bool> {
        let mut c = self.connection().await?;
        Ok(sql_query(include_str!(
            "../queries/inspector/set_inspector_submission_retry.sql"
        ))
        .bind::<BigInt, _>(id)
        .bind::<BigInt, _>(revision)
        .bind::<Text, _>(category)
        .execute(&mut c)
        .await?
            > 0)
    }
    pub async fn save_inspector_validation(
        &self,
        input: &InspectorValidationInput,
    ) -> Result<Option<i64>> {
        let mut c = self.connection().await?;
        c.transaction::<_, anyhow::Error, _>(async move |c| {
            let contest = sql_query(include_str!(
                "../queries/inspector/select_id_level_submission_contest_by_id.sql"
            ))
            .bind::<BigInt, _>(input.id_submission)
            .get_result::<IdRow>(c)
            .await
            .optional()?;
            let Some(contest) = contest else {
                return Ok(None);
            };
            let current = sql_query(include_str!(
                "../queries/inspector/select_id_level_submissions.sql"
            ))
            .bind::<BigInt, _>(input.id_submission)
            .bind::<BigInt, _>(input.submission_revision)
            .get_result::<IdRow>(c)
            .await
            .optional()?;
            if current.is_none() {
                return Ok(None);
            }
            let row = sql_query(include_str!(
                "../queries/inspector/insert_level_submission_validation.sql"
            ))
            .bind::<BigInt, _>(input.id_submission)
            .bind::<BigInt, _>(input.submission_revision)
            .bind::<Text, _>(&input.workshop_updated_at)
            .bind::<BigInt, _>(input.workshop_file_size)
            .bind::<Nullable<Text>, _>(&input.content_sha256)
            .bind::<Text, _>(&input.validator_version)
            .bind::<Text, _>(&input.rules_hash)
            .bind::<Nullable<Integer>, _>(input.id_level_item)
            .bind::<Nullable<Text>, _>(&input.file_uid)
            .bind::<Jsonb, _>(&input.measurements)
            .bind::<Jsonb, _>(&input.failures)
            .bind::<Bool, _>(input.valid)
            .bind::<Nullable<Jsonb>, _>(&input.payload)
            .get_result::<IdRow>(c)
            .await?;
            sql_query(include_str!(
                "../queries/inspector/set_latest_validation_id_level_submissions.sql"
            ))
            .bind::<BigInt, _>(input.id_submission)
            .bind::<BigInt, _>(row.id)
            .bind::<Nullable<Text>, _>(&input.level_hash)
            .execute(c)
            .await?;
            sql_query(SET_PLAYLIST_REVISION_LEVEL_SUBMISSION_CONTEST)
                .bind::<BigInt, _>(contest.id)
                .execute(c)
                .await?;
            sql_query(include_str!(
                "../queries/inspector/insert_level_submission_notification.sql"
            ))
            .bind::<BigInt, _>(input.id_submission)
            .bind::<BigInt, _>(input.submission_revision)
            .bind::<BigInt, _>(row.id)
            .execute(c)
            .await?;
            Ok(Some(row.id))
        })
        .await
    }
}
