//! First-party ownership, availability and revision-safe submission mutations.
use crate::Database;
use anyhow::{Result, ensure};
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{Array, BigInt, Integer, Jsonb, Nullable, Text},
};
use diesel_async::{AsyncConnection, RunQueryDsl};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;

const SELECT_ID_LEVEL_SUBMISSION_CONTEST: &str =
    include_str!("../queries/submissions/select_id_level_submission_contest.sql");
const SELECT_ID_LEVEL_SUBMISSION_CONTEST_BY_ID: &str =
    include_str!("../queries/submissions/select_id_level_submission_contest_by_id.sql");
const SET_PLAYLIST_REVISION_LEVEL_SUBMISSION_CONTEST: &str =
    include_str!("../queries/submissions/set_playlist_revision_level_submission_contest.sql");

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
const CONTEST_JSON: &str = include_str!("../queries/submissions/contest_payload.sql");
const SUBMISSION_JSON: &str = include_str!("../queries/submissions/submission_payload.sql");
#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SubmissionOverview {
    pub contest: Option<Value>,
    pub valid_count: usize,
    pub total_count: i64,
    pub submissions: Vec<PublicSubmission>,
}
#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PublicSubmission {
    pub id: i64,
    pub workshop_id: String,
    pub file_uid: String,
    pub name: String,
    pub authors: Vec<String>,
    pub author_names: Vec<String>,
    pub level: Value,
}
impl Database {
    pub async fn submission_contests(
        &self,
        season: Option<i32>,
        round: Option<i32>,
    ) -> Result<Value> {
        let mut c = self.connection().await?;
        let query = include_str!("../queries/submissions/submission_contests.sql")
            .replace("{{contest_json}}", CONTEST_JSON.trim_end());
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
        let query = include_str!("../queries/submissions/viewer_submission.sql")
            .replace("{{submission_json}}", SUBMISSION_JSON.trim_end());
        let row = sql_query(query)
            .bind::<Integer, _>(contest["roundId"].as_i64().unwrap_or_default() as i32)
            .bind::<Text, _>(steam)
            .get_result::<JsonRow>(&mut c)
            .await
            .optional()?;
        Ok(serde_json::json!({"contest":contest,"submission":row.map(|r|r.payload)}))
    }
    /// One statement keeps contest selection, counts, and accepted entries in one MVCC snapshot.
    pub async fn submission_overview(&self, round: Option<i32>) -> Result<SubmissionOverview> {
        let mut connection = self.connection().await?;
        let query = include_str!("../queries/submissions/submission_overview.sql")
            .replace("{{contest_json}}", CONTEST_JSON.trim_end());
        let row = sql_query(query)
            .bind::<Nullable<Integer>, _>(round)
            .get_result::<JsonRow>(&mut connection)
            .await?;
        Ok(serde_json::from_value(row.payload)?)
    }
    pub async fn submission_status(&self, id: i64, steam: &str) -> Result<Option<Value>> {
        let mut c = self.connection().await?;
        let query = include_str!("../queries/submissions/submission_status.sql")
            .replace("{{submission_json}}", SUBMISSION_JSON.trim_end());
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
        c.transaction::<_, anyhow::Error, _>(async move |c| {
            // Every mutation takes this same lock before checking author/workshop conflicts.
            let contest = sql_query(SELECT_ID_LEVEL_SUBMISSION_CONTEST)
                .bind::<Integer, _>(round)
                .get_result::<IdRow>(c)
                .await
                .optional()?
                .ok_or(SubmissionError::Closed)?;
            // Recheck wall clock after lock acquisition; a waiting mutation can cross the deadline.
            let available = sql_query(SELECT_ID_LEVEL_SUBMISSION_CONTEST_BY_ID)
                .bind::<BigInt, _>(contest.id)
                .get_result::<IdRow>(c)
                .await
                .optional()?;
            if available.is_none() {
                return Err(SubmissionError::Closed.into());
            }

            let own = sql_query(include_str!(
                "../queries/submissions/select_id_level_submissions.sql"
            ))
            .bind::<BigInt, _>(contest.id)
            .bind::<Text, _>(viewer)
            .get_result::<IdRow>(c)
            .await
            .optional()?;
            let conflict = sql_query(include_str!(
                "../queries/submissions/select_id_level_submissions_by_id_contest.sql"
            ))
            .bind::<BigInt, _>(contest.id)
            .bind::<Nullable<BigInt>, _>(own.as_ref().map(|r| r.id))
            .bind::<Array<Text>, _>(authors)
            .bind::<BigInt, _>(workshop)
            .get_result::<IdRow>(c)
            .await
            .optional()?;
            if conflict.is_some() {
                return Err(SubmissionError::Conflict.into());
            }
            // Reuse Steam sign-in placeholder creation within this transaction. Stable order
            // avoids deadlocks when different contests share author accounts.
            let mut steam_ids = authors
                .iter()
                .map(|id| id.parse::<i64>())
                .collect::<std::result::Result<Vec<_>, _>>()?;
            steam_ids.sort_unstable();
            for steam_id in steam_ids {
                if super::get_or_insert_user_with_connection(c, steam_id)
                    .await?
                    .banned
                {
                    return Err(SubmissionError::BannedAuthor.into());
                }
            }
            let row = if let Some(own) = own {
                sql_query(include_str!(
                    "../queries/submissions/set_workshop_id_level_submissions.sql"
                ))
                .bind::<BigInt, _>(own.id)
                .bind::<BigInt, _>(workshop)
                .bind::<Array<Text>, _>(authors)
                .get_result::<IdRow>(c)
                .await?
            } else {
                sql_query(include_str!(
                    "../queries/submissions/insert_level_submissions.sql"
                ))
                .bind::<BigInt, _>(contest.id)
                .bind::<BigInt, _>(workshop)
                .bind::<Array<Text>, _>(authors)
                .get_result::<IdRow>(c)
                .await?
            };
            sql_query(SET_PLAYLIST_REVISION_LEVEL_SUBMISSION_CONTEST)
                .bind::<BigInt, _>(contest.id)
                .execute(c)
                .await?;
            Ok(row.id)
        })
        .await
    }
    pub async fn withdraw_submission(&self, round: i32, viewer: &str) -> Result<()> {
        let mut c = self.connection().await?;
        c.transaction::<_, anyhow::Error, _>(async move |c| {
            let contest = sql_query(SELECT_ID_LEVEL_SUBMISSION_CONTEST)
                .bind::<Integer, _>(round)
                .get_result::<IdRow>(c)
                .await
                .optional()?
                .ok_or(SubmissionError::Closed)?;
            // Recheck wall clock after lock acquisition; a waiting mutation can cross the deadline.
            let available = sql_query(SELECT_ID_LEVEL_SUBMISSION_CONTEST_BY_ID)
                .bind::<BigInt, _>(contest.id)
                .get_result::<IdRow>(c)
                .await
                .optional()?;
            if available.is_none() {
                return Err(SubmissionError::Closed.into());
            }

            let row = sql_query(include_str!(
                "../queries/submissions/set_state_level_submissions.sql"
            ))
            .bind::<BigInt, _>(contest.id)
            .bind::<Text, _>(viewer)
            .get_result::<IdRow>(c)
            .await
            .optional()?;
            if let Some(row) = row {
                // Existing notification only: never backfill withdrawal messages.
                sql_query(include_str!(
                    "../queries/submissions/set_desired_revision_level_submission_notification.sql"
                ))
                .bind::<BigInt, _>(row.id)
                .execute(c)
                .await?;
                sql_query(SET_PLAYLIST_REVISION_LEVEL_SUBMISSION_CONTEST)
                    .bind::<BigInt, _>(contest.id)
                    .execute(c)
                    .await?;
            }
            Ok(())
        })
        .await
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
