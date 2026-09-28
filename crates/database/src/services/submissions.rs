//! First-party ownership, availability and revision-safe submission mutations.
use crate::Database;
use anyhow::{Result, ensure};
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{Array, BigInt, Integer, Jsonb, Nullable, Text},
};
use diesel_async::{AsyncConnection, RunQueryDsl};
use serde_json::Value;
use std::collections::HashSet;

#[derive(Debug, thiserror::Error)]
pub enum SubmissionError {
    #[error("Submission period is closed")]
    Closed,
    #[error("Authors must be 1–3 distinct Steam accounts, including your account")]
    Authors,
    #[error("An author or workshop item already belongs to another submission")]
    Conflict,
    #[error("Banned accounts cannot be listed as submission authors")]
    BannedAuthor,
}
#[derive(QueryableByName)]
struct JsonRow {
    #[diesel(sql_type=Jsonb)]
    payload: Value,
}
#[derive(QueryableByName)]
struct IdRow {
    #[diesel(sql_type=BigInt)]
    id: i64,
}

pub fn valid_authors(authors: &[String], viewer: &str) -> bool {
    (1..=3).contains(&authors.len())
        && authors.iter().any(|a| a == viewer)
        && authors.iter().all(|a| {
            a.len() == 17 && a.starts_with("7656119") && a.bytes().all(|b| b.is_ascii_digit())
        })
        && authors.iter().collect::<HashSet<_>>().len() == authors.len()
}
const CONTEST_JSON: &str = r#"jsonb_build_object('roundId',r.id,'contestId',c.id,'name',r.name,'seasonId',r.id_season,'round',r.round,'rules',c.rules,
'submissionStart',r.submission_start,'submissionEnd',r.submission_end,'zslVoteEnd',r.zsl_vote_end,'cosmeticVoteEnd',r.cosmetic_vote_end,
'submissionsOpen',coalesce(c.state='open' AND r.submission_start<=now() AND now()<r.submission_end,false),
'openTypes',CASE WHEN c.state='frozen' AND c.finalized_at IS NOT NULL AND now()>=r.submission_end THEN
    to_jsonb(array_remove(ARRAY[CASE WHEN now()<r.zsl_vote_end THEN 1 END,CASE WHEN now()<r.cosmetic_vote_end THEN 2 END,CASE WHEN now()<r.cosmetic_vote_end THEN 3 END],NULL)) ELSE '[]'::jsonb END)"#;
const SUBMISSION_JSON: &str = r#"jsonb_build_object('id',s.id,'roundId',c.id_zsl_round,'workshopId',s.workshop_id::text,'authors',s.authors,'revision',s.revision,
'authorNames',coalesce((SELECT jsonb_agg(coalesce(u.steam_name,a.id) ORDER BY a.n) FROM unnest(s.authors) WITH ORDINALITY a(id,n) LEFT JOIN public."user" u ON u.steam_id::text=a.id),'[]'::jsonb),
'status',CASE WHEN s.state='withdrawn' THEN 'withdrawn' WHEN s.retry_category IS NOT NULL THEN 'retrying' WHEN s.inspection_started_at IS NOT NULL THEN 'validating' WHEN v.id IS NULL OR v.submission_revision<>s.revision THEN 'queued' ELSE 'complete' END,
'validation',CASE WHEN v.id IS NOT NULL AND v.submission_revision=s.revision THEN jsonb_build_object('valid',v.valid,'workshopUpdatedAt',v.workshop_updated_at,'fileUid',v.file_uid,'measurements',v.measurements,'failures',v.failures) END)"#;
impl Database {
    pub async fn submission_contests(
        &self,
        season: Option<i32>,
        round: Option<i32>,
    ) -> Result<Value> {
        let mut c = self.connection().await?;
        let query = format!(
            "SELECT {CONTEST_JSON} AS payload FROM public.zsl_round r JOIN zc_private.level_submission_contest c ON c.id_zsl_round=r.id WHERE ($1 IS NULL OR r.id_season=$1) AND ($2 IS NULL OR r.id=$2) ORDER BY r.id_season DESC,r.round DESC"
        );
        let rows = sql_query(query)
            .bind::<Nullable<Integer>, _>(season)
            .bind::<Nullable<Integer>, _>(round)
            .load::<JsonRow>(&mut c)
            .await?;
        Ok(Value::Array(rows.into_iter().map(|r| r.payload).collect()))
    }
    pub async fn viewer_submission(&self, round: Option<i32>, steam: &str) -> Result<Value> {
        let contests = self.submission_contests(None, round).await?;
        let contest = contests
            .as_array()
            .and_then(|rows| {
                rows.iter()
                    .find(|r| r["submissionsOpen"] == true)
                    .or_else(|| rows.as_slice().first())
            })
            .cloned();
        let Some(contest) = contest else {
            return Ok(serde_json::json!({"contest":null,"submission":null}));
        };
        let mut c = self.connection().await?;
        let query = format!(
            "SELECT {SUBMISSION_JSON} AS payload FROM zc_private.level_submissions s JOIN zc_private.level_submission_contest c ON c.id=s.id_contest LEFT JOIN zc_private.level_submission_validation v ON v.id=s.latest_validation_id WHERE c.id_zsl_round=$1 AND $2=ANY(s.authors) AND s.state IN ('selected','withdrawn') ORDER BY (s.state='selected') DESC,s.date_updated DESC LIMIT 1"
        );
        let row = sql_query(query)
            .bind::<Integer, _>(contest["roundId"].as_i64().unwrap_or_default() as i32)
            .bind::<Text, _>(steam)
            .get_result::<JsonRow>(&mut c)
            .await
            .optional()?;
        Ok(serde_json::json!({"contest":contest,"submission":row.map(|r|r.payload)}))
    }
    pub async fn submission_status(&self, id: i64, steam: &str) -> Result<Option<Value>> {
        let mut c = self.connection().await?;
        let query = format!(
            "SELECT {SUBMISSION_JSON} AS payload FROM zc_private.level_submissions s JOIN zc_private.level_submission_contest c ON c.id=s.id_contest LEFT JOIN zc_private.level_submission_validation v ON v.id=s.latest_validation_id WHERE s.id=$1 AND $2=ANY(s.authors)"
        );
        Ok(sql_query(query)
            .bind::<BigInt, _>(id)
            .bind::<Text, _>(steam)
            .get_result::<JsonRow>(&mut c)
            .await
            .optional()?
            .map(|r| r.payload))
    }
    pub async fn submit_level(
        &self,
        round: i32,
        workshop: i64,
        authors: &[String],
        viewer: &str,
    ) -> Result<i64> {
        if !valid_authors(authors, viewer) {
            return Err(SubmissionError::Authors.into());
        }
        ensure!(round > 0 && workshop > 0, "Invalid submission identifiers");
        let mut c = self.connection().await?;
        c.transaction::<_,anyhow::Error,_>(|c|Box::pin(async move {
            // Every mutation takes this same lock before checking author/workshop conflicts.
            let contest=sql_query("SELECT c.id FROM zc_private.level_submission_contest c JOIN public.zsl_round r ON r.id=c.id_zsl_round WHERE r.id=$1 AND c.state='open' FOR UPDATE OF c")
                .bind::<Integer,_>(round).get_result::<IdRow>(c).await.optional()?.ok_or(SubmissionError::Closed)?;
            // Recheck wall clock after lock acquisition; a waiting mutation can cross the deadline.
            let available=sql_query("SELECT c.id FROM zc_private.level_submission_contest c JOIN public.zsl_round r ON r.id=c.id_zsl_round WHERE c.id=$1 AND r.submission_start<=clock_timestamp() AND clock_timestamp()<r.submission_end")
                .bind::<BigInt,_>(contest.id).get_result::<IdRow>(c).await.optional()?;
            if available.is_none(){return Err(SubmissionError::Closed.into())}

            let own=sql_query("SELECT id FROM zc_private.level_submissions WHERE id_contest=$1 AND $2=ANY(authors) AND state IN ('selected','withdrawn') ORDER BY (state='selected') DESC,date_updated DESC LIMIT 1")
                .bind::<BigInt,_>(contest.id).bind::<Text,_>(viewer).get_result::<IdRow>(c).await.optional()?;
            let conflict=sql_query("SELECT id FROM zc_private.level_submissions WHERE id_contest=$1 AND state='selected' AND ($2 IS NULL OR id<>$2) AND (authors && $3 OR workshop_id=$4) LIMIT 1")
                .bind::<BigInt,_>(contest.id).bind::<Nullable<BigInt>,_>(own.as_ref().map(|r|r.id)).bind::<Array<Text>,_>(authors).bind::<BigInt,_>(workshop).get_result::<IdRow>(c).await.optional()?;
            if conflict.is_some(){return Err(SubmissionError::Conflict.into())}
            // Reuse Steam sign-in placeholder creation within this transaction. Stable order
            // avoids deadlocks when different contests share author accounts.
            let mut steam_ids=authors.iter().map(|id|id.parse::<i64>()).collect::<std::result::Result<Vec<_>,_>>()?;
            steam_ids.sort_unstable();
            for steam_id in steam_ids {
                if super::get_or_insert_user_with_connection(c,steam_id).await?.banned {
                    return Err(SubmissionError::BannedAuthor.into())
                }
            }
            let row=if let Some(own)=own {
                sql_query("UPDATE zc_private.level_submissions SET workshop_id=$2,authors=$3,state='selected',revision=revision+1,latest_validation_id=NULL,level_hash=NULL,retry_category=NULL,next_inspection_at=now(),inspection_started_at=NULL,date_updated=now() WHERE id=$1 RETURNING id")
                    .bind::<BigInt,_>(own.id).bind::<BigInt,_>(workshop).bind::<Array<Text>,_>(authors).get_result::<IdRow>(c).await?
            }else{
                sql_query("INSERT INTO zc_private.level_submissions(id_contest,workshop_id,authors,state) VALUES($1,$2,$3,'selected') RETURNING id")
                    .bind::<BigInt,_>(contest.id).bind::<BigInt,_>(workshop).bind::<Array<Text>,_>(authors).get_result::<IdRow>(c).await?
            };
            sql_query("UPDATE zc_private.level_submission_contest SET playlist_revision=playlist_revision+1 WHERE id=$1").bind::<BigInt,_>(contest.id).execute(c).await?;
            Ok(row.id)
        })).await
    }
    pub async fn withdraw_submission(&self, round: i32, viewer: &str) -> Result<()> {
        let mut c = self.connection().await?;
        c.transaction::<_,anyhow::Error,_>(|c|Box::pin(async move {
            let contest=sql_query("SELECT c.id FROM zc_private.level_submission_contest c JOIN public.zsl_round r ON r.id=c.id_zsl_round WHERE r.id=$1 AND c.state='open' FOR UPDATE OF c")
                .bind::<Integer,_>(round).get_result::<IdRow>(c).await.optional()?.ok_or(SubmissionError::Closed)?;
            // Recheck wall clock after lock acquisition; a waiting mutation can cross the deadline.
            let available=sql_query("SELECT c.id FROM zc_private.level_submission_contest c JOIN public.zsl_round r ON r.id=c.id_zsl_round WHERE c.id=$1 AND r.submission_start<=clock_timestamp() AND clock_timestamp()<r.submission_end")
                .bind::<BigInt,_>(contest.id).get_result::<IdRow>(c).await.optional()?;
            if available.is_none(){return Err(SubmissionError::Closed.into())}

            let row=sql_query("UPDATE zc_private.level_submissions SET state='withdrawn',revision=revision+1,inspection_started_at=NULL,retry_category=NULL,date_updated=now() WHERE id_contest=$1 AND $2=ANY(authors) AND state='selected' RETURNING id")
                .bind::<BigInt,_>(contest.id).bind::<Text,_>(viewer).get_result::<IdRow>(c).await.optional()?;
            if let Some(row)=row {
                // Existing notification only: never backfill withdrawal messages.
                sql_query("UPDATE zc_private.level_submission_notification n SET desired_revision=s.revision,next_attempt_at=now(),date_updated=now() FROM zc_private.level_submissions s WHERE n.id_submission=s.id AND s.id=$1")
                    .bind::<BigInt,_>(row.id).execute(c).await?;
                sql_query("UPDATE zc_private.level_submission_contest SET playlist_revision=playlist_revision+1 WHERE id=$1").bind::<BigInt,_>(contest.id).execute(c).await?;
            }
            Ok(())
        })).await
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn author_contract() {
        let id = "76561198000000001";
        assert!(valid_authors(&[id.into()], id));
        assert!(!valid_authors(&[], id));
        assert!(!valid_authors(&[id.into(), id.into()], id));
        assert!(!valid_authors(&["76561198000000002".into()], id));
        assert!(!valid_authors(&[id.into(), "name".into()], id));
    }
}
