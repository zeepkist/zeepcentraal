use crate::Database;
use anyhow::{Result, ensure};
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{Array, BigInt, Bool, Integer, Jsonb, Nullable, Text},
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
            "SELECT e.id_validation,e.workshop_id,v.valid, \
            v.payload || jsonb_build_object('overrideAuthorName', \
                (SELECT string_agg(coalesce(u.steam_name,a.id), ', ' ORDER BY a.n) \
                 FROM unnest(s.authors) WITH ORDINALITY a(id,n) LEFT JOIN public.\"user\" u ON u.steam_id::text=a.id)) AS payload \
            FROM zc_private.level_submission_playlist_entry e \
            JOIN zc_private.level_submission_validation v ON v.id=e.id_validation \
            JOIN zc_private.level_submissions s ON s.id=v.id_submission \
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
            (submission_end<=clock_timestamp()) AS due,(submission_start<=clock_timestamp()) AS started FROM public.zsl_round \
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
            AND c.playlist_revision=c.published_revision \
            AND NOT EXISTS(SELECT 1 FROM zc_private.level_submissions s LEFT JOIN zc_private.level_submission_validation v ON v.id=s.latest_validation_id WHERE s.id_contest=c.id AND s.state='selected' AND (v.id IS NULL OR v.submission_revision<>s.revision OR s.retry_category IS NOT NULL OR s.next_inspection_at<=clock_timestamp() OR v.date_created<(SELECT submission_end FROM public.zsl_round WHERE id=c.id_zsl_round))) \
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
        F: FnOnce() -> Fut + Send,
        Fut: Future<Output = Result<T>> + Send,
        T: Send,
    {
        let mut connection = self.connection().await?;
        connection
            .transaction::<_, anyhow::Error, _>(async move |connection| {
                // External downloads can take minutes; this dedicated lock transaction has no row locks.
                sql_query("SET LOCAL idle_in_transaction_session_timeout=0")
                    .execute(connection)
                    .await?;
                let locked = sql_query("SELECT pg_try_advisory_xact_lock(1953721968,1) AS value")
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
                    let contest = sql_query(
                        "SELECT id FROM zc_private.level_submission_contest \
                         WHERE id=$1 AND state='open' AND playlist_revision=$2 FOR UPDATE",
                    )
                    .bind::<BigInt, _>(id_contest)
                    .bind::<BigInt, _>(expected_revision)
                    .get_result::<IdRow>(connection)
                    .await
                    .optional()?;
                    ensure!(contest.is_some(), "Contest is frozen or missing");
                    for member in members {
                        ensure!(sql_query("SELECT EXISTS(SELECT 1 FROM zc_private.level_submission_validation v JOIN zc_private.level_submissions s ON s.id=v.id_submission WHERE v.id=$1 AND v.valid AND s.id_contest=$2 AND s.state='selected' AND s.latest_validation_id=v.id AND s.revision=v.submission_revision AND s.workshop_id=$3 AND s.level_hash IS NOT NULL) AS value")
                            .bind::<BigInt,_>(member.id_validation).bind::<BigInt,_>(id_contest).bind::<BigInt,_>(member.workshop_id)
                            .get_result::<BoolRow>(connection).await?.value,"Playlist contains stale validation");
                    }
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
                        "UPDATE zc_private.level_submission_contest SET current_playlist_id=$2,published_revision=playlist_revision, \
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
            .await
    }
    pub async fn configure_inspector_contest(
        &self,
        round_id: i32,
        rules: serde_json::Value,
        rules_hash: &str,
    ) -> Result<()> {
        let mut connection = self.connection().await?;
        connection.transaction::<_,anyhow::Error,_>(async move |connection| {
            let changed=sql_query("SELECT id FROM zc_private.level_submission_contest WHERE id_zsl_round=$1 AND state='open' AND rules_hash<>$2 FOR UPDATE")
                .bind::<Integer,_>(round_id).bind::<Text,_>(rules_hash).get_result::<IdRow>(connection).await.optional()?;
            if let Some(row)=changed {
                sql_query("UPDATE zc_private.level_submissions SET revision=revision+1,latest_validation_id=NULL,next_inspection_at=now(),inspection_started_at=NULL WHERE id_contest=$1 AND state='selected'")
                    .bind::<BigInt,_>(row.id).execute(connection).await?;
                sql_query("UPDATE zc_private.level_submission_contest SET playlist_revision=playlist_revision+1 WHERE id=$1").bind::<BigInt,_>(row.id).execute(connection).await?;
            }
            sql_query("INSERT INTO zc_private.level_submission_contest(id_zsl_round,rules,rules_hash) VALUES($1,$2,$3) ON CONFLICT(id_zsl_round) DO UPDATE SET rules=EXCLUDED.rules,rules_hash=EXCLUDED.rules_hash,date_updated=now() WHERE level_submission_contest.state='open'")
                .bind::<Integer,_>(round_id).bind::<Jsonb,_>(rules).bind::<Text,_>(rules_hash).execute(connection).await?;
            Ok(())
        }).await
    }
    pub async fn defer_inspector_finalization(&self, round: i32) -> Result<()> {
        let mut c = self.connection().await?;
        sql_query("UPDATE zc_private.level_submission_contest c SET next_finalization_at=now()+interval '60 seconds' FROM public.zsl_round r WHERE c.id_zsl_round=r.id AND r.id=$1 AND c.state='open' AND r.submission_end<=now()")
            .bind::<Integer,_>(round).execute(&mut c).await?;
        Ok(())
    }
    pub async fn get_inspector_contest(
        &self,
        round_id: i32,
    ) -> Result<Option<InspectorContestRow>> {
        let mut c = self.connection().await?;
        Ok(sql_query("SELECT c.id,r.name AS theme,r.id_season AS season_number,r.round AS round_number,c.id_zsl_round,c.state,c.rules_hash,c.current_playlist_id,c.playlist_revision,c.published_revision,(c.finalized_at IS NOT NULL) AS finalized,(c.next_finalization_at<=clock_timestamp()) AS finalization_due FROM zc_private.level_submission_contest c JOIN public.zsl_round r ON r.id=c.id_zsl_round WHERE c.id_zsl_round=$1")
            .bind::<Integer,_>(round_id).get_result(&mut c).await.optional()?)
    }
    pub async fn get_inspector_submissions(
        &self,
        contest_id: i64,
    ) -> Result<Vec<InspectorSubmissionRow>> {
        let mut c = self.connection().await?;
        Ok(sql_query("SELECT s.id,s.authors,coalesce((SELECT jsonb_agg(coalesce(u.steam_name,a.id) ORDER BY a.n) FROM unnest(s.authors) WITH ORDINALITY a(id,n) LEFT JOIN public.\"user\" u ON u.steam_id::text=a.id),'[]'::jsonb) AS author_names,s.workshop_id,s.date_created::text AS submitted_at,s.state,s.revision,((s.next_inspection_at<=now()) OR (r.submission_end<=now() AND s.retry_category IS NULL AND (v.id IS NULL OR v.date_created<r.submission_end))) AS inspection_due,(r.submission_end<=now() AND (v.id IS NULL OR v.date_created<r.submission_end)) AS final_scan_due,s.latest_validation_id FROM zc_private.level_submissions s JOIN zc_private.level_submission_contest c ON c.id=s.id_contest JOIN public.zsl_round r ON r.id=c.id_zsl_round LEFT JOIN zc_private.level_submission_validation v ON v.id=s.latest_validation_id WHERE s.id_contest=$1 AND s.state='selected' ORDER BY s.date_created,s.id")
            .bind::<BigInt,_>(contest_id).load(&mut c).await?)
    }
    pub async fn get_inspector_validation(
        &self,
        id: Option<i64>,
    ) -> Result<Option<InspectorValidationRow>> {
        let Some(id) = id else { return Ok(None) };
        let mut c = self.connection().await?;
        Ok(sql_query("SELECT id,id_submission,submission_revision,workshop_updated_at,workshop_file_size,content_sha256,validator_version,rules_hash,measurements,file_uid,failures,valid,payload FROM zc_private.level_submission_validation WHERE id=$1")
            .bind::<BigInt,_>(id).get_result(&mut c).await.optional()?)
    }
    pub async fn begin_inspector_validation(&self, id: i64, revision: i64) -> Result<bool> {
        let mut c = self.connection().await?;
        Ok(sql_query("UPDATE zc_private.level_submissions s SET inspection_started_at=now() WHERE s.id=$1 AND s.revision=$2 AND s.state='selected' AND EXISTS(SELECT 1 FROM zc_private.level_submission_contest c WHERE c.id=s.id_contest AND c.state='open')")
            .bind::<BigInt,_>(id).bind::<BigInt,_>(revision).execute(&mut c).await?>0)
    }
    pub async fn finish_inspector_cache_check(&self, id: i64, revision: i64) -> Result<()> {
        let mut c = self.connection().await?;
        sql_query("UPDATE zc_private.level_submissions SET inspection_started_at=NULL,retry_category=NULL,next_inspection_at=now()+interval '30 minutes' WHERE id=$1 AND revision=$2 AND state='selected'")
            .bind::<BigInt,_>(id).bind::<BigInt,_>(revision).execute(&mut c).await?;
        Ok(())
    }
    pub async fn set_inspector_submission_retry(
        &self,
        id: i64,
        revision: i64,
        category: &str,
    ) -> Result<bool> {
        let mut c = self.connection().await?;
        Ok(sql_query("UPDATE zc_private.level_submissions SET retry_category=$3,inspection_started_at=NULL,next_inspection_at=now()+interval '60 seconds' WHERE id=$1 AND revision=$2 AND state='selected'")
            .bind::<BigInt,_>(id).bind::<BigInt,_>(revision).bind::<Text,_>(category).execute(&mut c).await?>0)
    }
    pub async fn save_inspector_validation(
        &self,
        input: &InspectorValidationInput,
    ) -> Result<Option<i64>> {
        let mut c = self.connection().await?;
        c.transaction::<_,anyhow::Error,_>(async move |c| {
            let contest=sql_query("SELECT c.id FROM zc_private.level_submission_contest c JOIN zc_private.level_submissions s ON s.id_contest=c.id WHERE s.id=$1 AND c.state='open' FOR UPDATE OF c")
                .bind::<BigInt,_>(input.id_submission).get_result::<IdRow>(c).await.optional()?;
            let Some(contest)=contest else {return Ok(None)};
            let current=sql_query("SELECT id FROM zc_private.level_submissions WHERE id=$1 AND revision=$2 AND state='selected' FOR UPDATE")
                .bind::<BigInt,_>(input.id_submission).bind::<BigInt,_>(input.submission_revision).get_result::<IdRow>(c).await.optional()?;
            if current.is_none(){return Ok(None)}
            let row=sql_query("INSERT INTO zc_private.level_submission_validation(id_submission,submission_revision,workshop_updated_at,workshop_file_size,content_sha256,validator_version,rules_hash,id_level_item,file_uid,measurements,failures,valid,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id")
                .bind::<BigInt,_>(input.id_submission).bind::<BigInt,_>(input.submission_revision)
                .bind::<Text,_>(&input.workshop_updated_at).bind::<BigInt,_>(input.workshop_file_size)
                .bind::<Nullable<Text>,_>(&input.content_sha256).bind::<Text,_>(&input.validator_version).bind::<Text,_>(&input.rules_hash)
                .bind::<Nullable<Integer>,_>(input.id_level_item).bind::<Nullable<Text>,_>(&input.file_uid)
                .bind::<Jsonb,_>(&input.measurements).bind::<Jsonb,_>(&input.failures).bind::<Bool,_>(input.valid).bind::<Nullable<Jsonb>,_>(&input.payload)
                .get_result::<IdRow>(c).await?;
            sql_query("UPDATE zc_private.level_submissions SET latest_validation_id=$2,level_hash=(SELECT xx_hash FROM public.level WHERE xx_hash=$3),retry_category=NULL,inspection_started_at=NULL,next_inspection_at=now()+interval '30 minutes',date_updated=now() WHERE id=$1")
                .bind::<BigInt,_>(input.id_submission).bind::<BigInt,_>(row.id).bind::<Nullable<Text>,_>(&input.level_hash).execute(c).await?;
            sql_query("UPDATE zc_private.level_submission_contest SET playlist_revision=playlist_revision+1 WHERE id=$1").bind::<BigInt,_>(contest.id).execute(c).await?;
            sql_query("INSERT INTO zc_private.level_submission_notification(id_submission,desired_revision,desired_validation_id) VALUES($1,$2,$3) ON CONFLICT(id_submission) DO UPDATE SET desired_revision=$2,desired_validation_id=$3,next_attempt_at=now(),date_updated=now()")
                .bind::<BigInt,_>(input.id_submission).bind::<BigInt,_>(input.submission_revision).bind::<BigInt,_>(row.id).execute(c).await?;
            Ok(Some(row.id))
        }).await
    }
}
