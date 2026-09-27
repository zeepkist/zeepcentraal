use crate::Database;
use anyhow::{Result, ensure};
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{BigInt, Bool, Integer, Jsonb, Nullable, Text},
};
use diesel_async::{AsyncConnection, RunQueryDsl};
use serde::{Deserialize, Serialize};
use std::future::Future;

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
struct IntegerIdRow {
    #[diesel(sql_type = Integer)]
    id: i32,
}

#[derive(QueryableByName)]
struct OptionalSecondsRow {
    #[diesel(sql_type = Nullable<BigInt>)]
    seconds: Option<i64>,
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
    pub thread_id: String,
    #[diesel(sql_type = Text)]
    pub theme: String,
    #[diesel(sql_type = Integer)]
    pub season_number: i32,
    #[diesel(sql_type = Integer)]
    pub round_number: i32,
    #[diesel(sql_type = Nullable<Integer>)]
    pub id_zsl_round: Option<i32>,
    #[diesel(sql_type = Text)]
    pub state: String,
    #[diesel(sql_type = Text)]
    pub rules_hash: String,
    #[diesel(sql_type = Nullable<BigInt>)]
    pub current_playlist_id: Option<i64>,
    #[diesel(sql_type = Jsonb)]
    pub publication: serde_json::Value,
    #[diesel(sql_type = Bool)]
    pub finalized: bool,
}

#[derive(Clone, Debug, Deserialize, QueryableByName, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectorSubmissionRow {
    #[diesel(sql_type = BigInt)]
    pub id: i64,
    #[diesel(sql_type = Text)]
    pub message_id: String,
    #[diesel(sql_type = Text)]
    pub author_id: String,
    #[diesel(sql_type = BigInt)]
    pub workshop_id: i64,
    #[diesel(sql_type = Text)]
    pub message_created_at: String,
    #[diesel(sql_type = Nullable<Text>)]
    pub message_edited_at: Option<String>,
    #[diesel(sql_type = Text)]
    pub state: String,
    #[diesel(sql_type = Nullable<Text>)]
    pub source_error: Option<String>,
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
pub struct InspectorContestInput {
    pub thread_id: String,
    pub guild_id: String,
    pub forum_id: String,
    pub title: String,
    pub theme: String,
    pub season_number: i32,
    pub round_number: i32,
    pub id_zsl_round: Option<i32>,
    pub mapping_source: String,
    pub rules: serde_json::Value,
    pub rules_hash: String,
    pub state: String,
    pub frozen_at: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectorSubmissionInput {
    pub message_id: String,
    pub author_id: String,
    pub workshop_id: i64,
    pub message_created_at: String,
    pub message_edited_at: Option<String>,
    pub state: String,
    pub source_error: Option<String>,
    pub last_seen: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectorValidationInput {
    pub id_submission: i64,
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
    pub async fn next_inspector_finalize_delay(&self) -> Result<Option<i64>> {
        let mut connection = self.connection().await?;
        Ok(sql_query("SELECT floor(extract(epoch FROM min(r.submission_end) - clock_timestamp()))::bigint AS seconds \
            FROM zc_private.level_submission_contest c JOIN public.zsl_round r ON r.id=c.id_zsl_round \
            WHERE c.state='open' AND c.finalized_at IS NULL AND r.submission_end IS NOT NULL")
            .get_result::<OptionalSecondsRow>(&mut connection).await?.seconds)
    }

    pub async fn get_inspector_lobby_schedule(
        &self,
        round_id: i32,
    ) -> Result<Option<InspectorLobbyScheduleRow>> {
        let mut connection = self.connection().await?;
        Ok(sql_query("SELECT to_char(submission_end AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS submission_end, \
            to_char(zsl_vote_end AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS zsl_vote_end, \
            (zsl_vote_end<=clock_timestamp()) AS closed FROM public.zsl_round \
            WHERE id=$1 AND submission_end IS NOT NULL AND zsl_vote_end IS NOT NULL")
            .bind::<Integer, _>(round_id).get_result::<InspectorLobbyScheduleRow>(&mut connection).await.optional()?)
    }

    pub async fn get_inspector_playlist_by_round(
        &self,
        round_id: i32,
    ) -> Result<Option<InspectorPlaylistBundle>> {
        let mut connection = self.connection().await?;
        let playlist = sql_query(
            "SELECT p.id,p.digest,p.valid_count,p.object_key, \
            floor(extract(epoch FROM p.date_created))::bigint AS date_created_epoch \
            FROM zc_private.level_submission_contest c \
            JOIN zc_private.level_submission_playlist p ON p.id=c.current_playlist_id \
            WHERE c.id_zsl_round=$1 ORDER BY c.id DESC LIMIT 1",
        )
        .bind::<Integer, _>(round_id)
        .get_result::<InspectorPlaylistRow>(&mut connection)
        .await
        .optional()?;
        let Some(playlist) = playlist else {
            return Ok(None);
        };
        let members = sql_query(
            "SELECT e.id_validation,e.workshop_id,v.valid,v.payload \
            FROM zc_private.level_submission_playlist_entry e \
            JOIN zc_private.level_submission_validation v ON v.id=e.id_validation \
            WHERE e.id_playlist=$1 ORDER BY e.position",
        )
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
        Ok(sql_query("SELECT to_char(submission_end AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS submission_end, \
            (submission_end<=clock_timestamp()) AS due FROM public.zsl_round \
            WHERE id=$1 AND submission_end IS NOT NULL")
            .bind::<Integer, _>(round_id)
            .get_result::<InspectorScheduleRow>(&mut connection).await.optional()?)
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
        Ok(sql_query(
            "UPDATE zc_private.level_submission_contest c SET state='frozen', \
            frozen_at=clock_timestamp(),finalized_at=clock_timestamp(),archive_object_key=$3, \
            archive_sha256=$4,archive_size=$5,date_updated=clock_timestamp() \
            WHERE c.id=$1 AND c.state='open' AND c.current_playlist_id=$2 \
            AND EXISTS(SELECT 1 FROM public.zsl_round r WHERE r.id=c.id_zsl_round \
                AND r.submission_end<=clock_timestamp()) \
            AND NOT EXISTS (SELECT 1 FROM zc_private.level_submission_playlist_entry e \
                JOIN zc_private.level_submission_validation v ON v.id=e.id_validation \
                JOIN zc_private.level_submissions s ON s.id=v.id_submission \
                WHERE e.id_playlist=$2 AND v.valid AND s.level_hash IS NULL)",
        )
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
        F: FnOnce() -> Fut,
        Fut: Future<Output = Result<T>>,
    {
        let mut connection = self.connection().await?;
        let locked = sql_query("SELECT pg_try_advisory_lock(1953721968, 1) AS value")
            .get_result::<BoolRow>(&mut connection)
            .await?
            .value;
        if !locked {
            return Ok(None);
        }
        let result = run().await;
        let unlocked = sql_query("SELECT pg_advisory_unlock(1953721968, 1) AS value")
            .get_result::<BoolRow>(&mut connection)
            .await;
        match (result, unlocked) {
            (Ok(value), Ok(row)) => {
                ensure!(row.value, "Inspector advisory lock was lost");
                Ok(Some(value))
            }
            (Err(error), _) => Err(error),
            (Ok(_), Err(error)) => Err(error.into()),
        }
    }

    pub async fn find_inspector_round(
        &self,
        season_id: Option<i32>,
        round: i32,
        override_id: Option<i32>,
    ) -> Result<Option<i32>> {
        ensure!(round > 0, "Invalid inspector round number");
        let mut connection = self.connection().await?;
        let rows = sql_query(
            "SELECT id FROM zsl_round WHERE id_season=$2 AND round=$3 \
             AND ($1 IS NULL OR id=$1) LIMIT 2",
        )
        .bind::<Nullable<Integer>, _>(override_id)
        .bind::<Nullable<Integer>, _>(season_id)
        .bind::<Integer, _>(round)
        .load::<IntegerIdRow>(&mut connection)
        .await?;
        Ok((rows.len() == 1).then(|| rows[0].id))
    }

    pub async fn get_inspector_contest(
        &self,
        thread_id: &str,
    ) -> Result<Option<InspectorContestRow>> {
        ensure!(!thread_id.is_empty(), "Invalid inspector thread ID");
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "SELECT id,thread_id,theme,season_number,round_number,id_zsl_round,state,rules_hash, \
             current_playlist_id,publication,(finalized_at IS NOT NULL) AS finalized FROM zc_private.level_submission_contest \
             WHERE thread_id=$1",
        )
        .bind::<Text, _>(thread_id)
        .get_result::<InspectorContestRow>(&mut connection)
        .await
        .optional()?)
    }

    pub async fn get_inspector_submissions(
        &self,
        id_contest: i64,
    ) -> Result<Vec<InspectorSubmissionRow>> {
        ensure!(id_contest > 0, "Invalid inspector contest ID");
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "SELECT id,message_id,author_id,workshop_id,message_created_at::text AS message_created_at, \
             message_edited_at::text AS message_edited_at,state,source_error,latest_validation_id \
             FROM zc_private.level_submissions WHERE id_contest=$1 ORDER BY id",
        )
        .bind::<BigInt, _>(id_contest)
        .load::<InspectorSubmissionRow>(&mut connection)
        .await?)
    }

    pub async fn get_inspector_validation(
        &self,
        id: Option<i64>,
    ) -> Result<Option<InspectorValidationRow>> {
        let Some(id) = id else { return Ok(None) };
        ensure!(id > 0, "Invalid inspector validation ID");
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "SELECT id,id_submission,workshop_updated_at,workshop_file_size,content_sha256,validator_version, \
             rules_hash,failures,valid,payload FROM zc_private.level_submission_validation WHERE id=$1",
        )
        .bind::<BigInt, _>(id)
        .get_result::<InspectorValidationRow>(&mut connection)
        .await
        .optional()?)
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
        Ok(sql_query(
            "SELECT EXISTS(SELECT 1 FROM public.level l JOIN public.level_item i ON i.id_level=l.id \
             WHERE l.xx_hash=$1 AND i.workshop_id=$2) AS value",
        )
        .bind::<Text, _>(level_hash)
        .bind::<BigInt, _>(workshop_id)
        .get_result::<BoolRow>(&mut connection)
        .await?
        .value)
    }

    pub async fn get_inspector_playlist(
        &self,
        thread_id: &str,
    ) -> Result<Option<InspectorPlaylistBundle>> {
        ensure!(!thread_id.is_empty(), "Invalid inspector thread ID");
        let mut connection = self.connection().await?;
        let playlist = sql_query(
            "SELECT p.id,p.digest,p.valid_count,p.object_key, \
             floor(extract(epoch FROM p.date_created))::bigint AS date_created_epoch \
             FROM zc_private.level_submission_contest c \
             JOIN zc_private.level_submission_playlist p ON p.id=c.current_playlist_id \
             WHERE c.thread_id=$1",
        )
        .bind::<Text, _>(thread_id)
        .get_result::<InspectorPlaylistRow>(&mut connection)
        .await
        .optional()?;
        let Some(playlist) = playlist else {
            return Ok(None);
        };
        let members = sql_query(
            "SELECT e.id_validation,e.workshop_id,v.valid,v.payload \
             FROM zc_private.level_submission_playlist_entry e \
             JOIN zc_private.level_submission_validation v ON v.id=e.id_validation \
             WHERE e.id_playlist=$1 ORDER BY e.position",
        )
        .bind::<BigInt, _>(playlist.id)
        .load::<InspectorPlaylistMemberRow>(&mut connection)
        .await?;
        Ok(Some(InspectorPlaylistBundle { playlist, members }))
    }

    pub async fn save_inspector_contest(
        &self,
        input: &InspectorContestInput,
    ) -> Result<serde_json::Value> {
        validate_contest(input)?;
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "INSERT INTO zc_private.level_submission_contest \
             (thread_id,guild_id,forum_id,title,theme,season_number,round_number,id_zsl_round, \
              mapping_source,state,rules,rules_hash,frozen_at,date_created,date_updated) \
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::timestamptz, \
                    clock_timestamp(),clock_timestamp()) \
             ON CONFLICT(thread_id) DO UPDATE SET guild_id=excluded.guild_id, \
              forum_id=excluded.forum_id,title=excluded.title,theme=excluded.theme, \
              season_number=excluded.season_number,round_number=excluded.round_number, \
              id_zsl_round=excluded.id_zsl_round,mapping_source=excluded.mapping_source, \
              state=excluded.state,rules=excluded.rules,rules_hash=excluded.rules_hash, \
              frozen_at=excluded.frozen_at,date_updated=clock_timestamp() \
             RETURNING to_jsonb(level_submission_contest.*) AS payload",
        )
        .bind::<Text, _>(&input.thread_id)
        .bind::<Text, _>(&input.guild_id)
        .bind::<Text, _>(&input.forum_id)
        .bind::<Text, _>(&input.title)
        .bind::<Text, _>(&input.theme)
        .bind::<Integer, _>(input.season_number)
        .bind::<Integer, _>(input.round_number)
        .bind::<Nullable<Integer>, _>(input.id_zsl_round)
        .bind::<Text, _>(&input.mapping_source)
        .bind::<Text, _>(&input.state)
        .bind::<Jsonb, _>(&input.rules)
        .bind::<Text, _>(&input.rules_hash)
        .bind::<Nullable<Text>, _>(&input.frozen_at)
        .get_result::<JsonRow>(&mut connection)
        .await?
        .payload)
    }

    pub async fn link_inspector_round(
        &self,
        id_contest: i64,
        id_zsl_round: i32,
        explicit: bool,
    ) -> Result<bool> {
        ensure!(
            id_contest > 0 && id_zsl_round > 0,
            "Invalid inspector round link"
        );
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "UPDATE zc_private.level_submission_contest SET id_zsl_round=$2, \
             mapping_source=$3,date_updated=clock_timestamp() WHERE id=$1",
        )
        .bind::<BigInt, _>(id_contest)
        .bind::<Integer, _>(id_zsl_round)
        .bind::<Text, _>(if explicit { "explicit" } else { "title" })
        .execute(&mut connection)
        .await?
            > 0)
    }

    pub async fn freeze_inspector_contest(&self, id_contest: i64, frozen: bool) -> Result<bool> {
        ensure!(id_contest > 0, "Invalid inspector contest ID");
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "UPDATE zc_private.level_submission_contest SET state=CASE WHEN $2 THEN 'frozen' \
             ELSE 'open' END,frozen_at=CASE WHEN $2 THEN clock_timestamp() ELSE NULL END, \
             date_updated=clock_timestamp() WHERE id=$1 AND (NOT $2 OR state='open')",
        )
        .bind::<BigInt, _>(id_contest)
        .bind::<Bool, _>(frozen)
        .execute(&mut connection)
        .await?
            > 0)
    }

    pub async fn reconcile_inspector_submissions(
        &self,
        id_contest: i64,
        rows: &[InspectorSubmissionInput],
    ) -> Result<Vec<InspectorSubmissionRow>> {
        ensure!(id_contest > 0, "Invalid inspector contest ID");
        for row in rows {
            validate_submission(row)?;
        }
        let mut connection = self.connection().await?;
        connection
            .transaction::<Vec<InspectorSubmissionRow>, anyhow::Error, _>(|connection| {
                Box::pin(async move {
                    sql_query(
                        "UPDATE zc_private.level_submissions SET state='withdrawn', \
                         date_updated=clock_timestamp() WHERE id_contest=$1",
                    )
                    .bind::<BigInt, _>(id_contest)
                    .execute(connection)
                    .await?;
                    for row in rows {
                        sql_query(
                            "INSERT INTO zc_private.level_submissions \
                             (id_contest,message_id,author_id,workshop_id,message_created_at, \
                              message_edited_at,state,source_error,last_seen,date_created,date_updated) \
                             VALUES($1,$2,$3,$4,$5::timestamptz,$6::timestamptz,$7,$8, \
                                    $9::timestamptz,clock_timestamp(),clock_timestamp()) \
                             ON CONFLICT(id_contest,message_id,workshop_id) DO UPDATE SET \
                              author_id=excluded.author_id,message_created_at=excluded.message_created_at, \
                              message_edited_at=excluded.message_edited_at,state=excluded.state, \
                              source_error=excluded.source_error,last_seen=excluded.last_seen, \
                              date_updated=clock_timestamp()",
                        )
                        .bind::<BigInt, _>(id_contest)
                        .bind::<Text, _>(&row.message_id)
                        .bind::<Text, _>(&row.author_id)
                        .bind::<BigInt, _>(row.workshop_id)
                        .bind::<Text, _>(&row.message_created_at)
                        .bind::<Nullable<Text>, _>(&row.message_edited_at)
                        .bind::<Text, _>(&row.state)
                        .bind::<Nullable<Text>, _>(&row.source_error)
                        .bind::<Text, _>(&row.last_seen)
                        .execute(connection)
                        .await?;
                    }
                    sql_query(
                        "UPDATE zc_private.level_submission_contest SET \
                         last_complete_scan=clock_timestamp(),date_updated=clock_timestamp() WHERE id=$1",
                    )
                    .bind::<BigInt, _>(id_contest)
                    .execute(connection)
                    .await?;
                    Ok(sql_query(
                        "SELECT id,message_id,author_id,workshop_id, \
                         message_created_at::text AS message_created_at, \
                         message_edited_at::text AS message_edited_at,state,source_error, \
                         latest_validation_id FROM zc_private.level_submissions \
                         WHERE id_contest=$1 AND state='selected' ORDER BY id",
                    )
                    .bind::<BigInt, _>(id_contest)
                    .load::<InspectorSubmissionRow>(connection)
                    .await?)
                })
            })
            .await
    }

    pub async fn save_inspector_validation(
        &self,
        input: &InspectorValidationInput,
    ) -> Result<serde_json::Value> {
        ensure!(
            input.id_submission > 0 && input.workshop_file_size >= 0,
            "Invalid inspector validation"
        );
        ensure!(
            input.failures.is_array(),
            "Validation failures must be an array"
        );
        let mut connection = self.connection().await?;
        connection
            .transaction::<serde_json::Value, anyhow::Error, _>(|connection| {
                Box::pin(async move {
                    let row = sql_query(
                        "INSERT INTO zc_private.level_submission_validation \
                         (id_submission,workshop_updated_at,workshop_file_size,content_sha256, \
                          validator_version,rules_hash,id_level_item,file_uid,measurements,failures, \
                          valid,payload,date_created) \
                         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,clock_timestamp()) \
                         RETURNING id,to_jsonb(level_submission_validation.*) AS payload",
                    )
                    .bind::<BigInt, _>(input.id_submission)
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
                    .get_result::<ValidationRow>(connection)
                    .await?;
                    sql_query(
                        "UPDATE zc_private.level_submissions SET latest_validation_id=$2, \
                         level_hash=CASE WHEN $3 IS NULL THEN NULL ELSE \
                           (SELECT xx_hash FROM public.level WHERE xx_hash=$3) END, \
                         retry_category=NULL,date_updated=clock_timestamp() WHERE id=$1",
                    )
                    .bind::<BigInt, _>(input.id_submission)
                    .bind::<BigInt, _>(row.id)
                    .bind::<Nullable<Text>, _>(&input.level_hash)
                    .execute(connection)
                    .await?;
                    Ok(row.payload)
                })
            })
            .await
    }

    pub async fn set_inspector_submission_retry(
        &self,
        id_submission: i64,
        category: &str,
    ) -> Result<bool> {
        ensure!(
            id_submission > 0 && !category.is_empty(),
            "Invalid inspector retry"
        );
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "UPDATE zc_private.level_submissions SET retry_category=$2, \
             date_updated=clock_timestamp() WHERE id=$1",
        )
        .bind::<BigInt, _>(id_submission)
        .bind::<Text, _>(category)
        .execute(&mut connection)
        .await?
            > 0)
    }

    pub async fn publish_inspector_playlist(
        &self,
        id_contest: i64,
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
            .transaction::<serde_json::Value, anyhow::Error, _>(|connection| {
                Box::pin(async move {
                    let contest = sql_query(
                        "SELECT id FROM zc_private.level_submission_contest \
                         WHERE id=$1 AND state<>'frozen' FOR UPDATE",
                    )
                    .bind::<BigInt, _>(id_contest)
                    .get_result::<IdRow>(connection)
                    .await
                    .optional()?;
                    ensure!(contest.is_some(), "Contest is frozen or missing");
                    let inserted = sql_query(
                        "INSERT INTO zc_private.level_submission_playlist \
                         (id_contest,digest,valid_count,object_key,date_created) \
                         VALUES($1,$2,$3,$4,clock_timestamp()) \
                         ON CONFLICT(id_contest,digest) DO NOTHING RETURNING id",
                    )
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
                        None => sql_query(
                            "SELECT id FROM zc_private.level_submission_playlist \
                             WHERE id_contest=$1 AND digest=$2",
                        )
                        .bind::<BigInt, _>(id_contest)
                        .bind::<Text, _>(digest)
                        .get_result::<IdRow>(connection)
                        .await?
                        .id,
                    };
                    if was_inserted {
                        for (position, member) in members.iter().enumerate() {
                            sql_query(
                                "INSERT INTO zc_private.level_submission_playlist_entry \
                                 (id_playlist,position,id_validation,workshop_id) VALUES($1,$2,$3,$4)",
                            )
                            .bind::<BigInt, _>(id_playlist)
                            .bind::<Integer, _>(i32::try_from(position)?)
                            .bind::<BigInt, _>(member.id_validation)
                            .bind::<BigInt, _>(member.workshop_id)
                            .execute(connection)
                            .await?;
                        }
                    }
                    sql_query(
                        "UPDATE zc_private.level_submission_contest SET current_playlist_id=$2, \
                         date_updated=clock_timestamp() WHERE id=$1",
                    )
                    .bind::<BigInt, _>(id_contest)
                    .bind::<BigInt, _>(id_playlist)
                    .execute(connection)
                    .await?;
                    Ok(sql_query(
                        "SELECT to_jsonb(level_submission_playlist.*) AS payload FROM \
                         zc_private.level_submission_playlist WHERE id=$1",
                    )
                    .bind::<BigInt, _>(id_playlist)
                    .get_result::<JsonRow>(connection)
                    .await?
                    .payload)
                })
            })
            .await
    }

    pub async fn save_inspector_publication(
        &self,
        id_contest: i64,
        publication: serde_json::Value,
    ) -> Result<bool> {
        ensure!(
            id_contest > 0 && publication.is_object(),
            "Invalid publication state"
        );
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "UPDATE zc_private.level_submission_contest SET publication=$2, \
             date_updated=clock_timestamp() WHERE id=$1",
        )
        .bind::<BigInt, _>(id_contest)
        .bind::<Jsonb, _>(publication)
        .execute(&mut connection)
        .await?
            > 0)
    }
}

#[derive(QueryableByName)]
struct ValidationRow {
    #[diesel(sql_type = BigInt)]
    id: i64,
    #[diesel(sql_type = Jsonb)]
    payload: serde_json::Value,
}

fn validate_contest(input: &InspectorContestInput) -> Result<()> {
    ensure!(
        !input.thread_id.is_empty()
            && !input.guild_id.is_empty()
            && !input.forum_id.is_empty()
            && !input.title.is_empty()
            && !input.theme.is_empty()
            && input.season_number > 0
            && input.round_number > 0
            && matches!(input.state.as_str(), "open" | "frozen")
            && input.rules.is_object()
            && !input.rules_hash.is_empty(),
        "Invalid inspector contest"
    );
    Ok(())
}

fn validate_submission(input: &InspectorSubmissionInput) -> Result<()> {
    ensure!(
        !input.message_id.is_empty()
            && !input.author_id.is_empty()
            && input.workshop_id > 0
            && !input.message_created_at.is_empty()
            && !input.last_seen.is_empty()
            && matches!(
                input.state.as_str(),
                "selected" | "superseded" | "withdrawn"
            ),
        "Invalid inspector submission"
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_invalid_mutation_inputs_before_database_access() {
        let submission = InspectorSubmissionInput {
            message_id: "1".to_owned(),
            author_id: "2".to_owned(),
            workshop_id: 3,
            message_created_at: "2026-01-01T00:00:00Z".to_owned(),
            message_edited_at: None,
            state: "selected".to_owned(),
            source_error: None,
            last_seen: "2026-01-01T00:00:00Z".to_owned(),
        };
        assert!(validate_submission(&submission).is_ok());
        assert!(
            validate_submission(&InspectorSubmissionInput {
                state: "invalid".to_owned(),
                ..submission
            })
            .is_err()
        );
    }
}
