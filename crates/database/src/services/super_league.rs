use crate::Database;
use anyhow::Result;
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{Array, BigInt, Bool, Float, Integer, Jsonb, Nullable, SmallInt, Text},
};
use diesel_async::{AsyncConnection, RunQueryDsl};
use serde::Serialize;

#[derive(QueryableByName)]
struct RoundRow {
    #[diesel(sql_type = Integer)]
    id: i32,
    #[diesel(sql_type = Nullable<BigInt>)]
    contest_id: Option<i64>,
    #[diesel(sql_type = Nullable<Text>)]
    submission_start: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    submission_end: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    zsl_vote_end: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    cosmetic_vote_end: Option<String>,
    #[diesel(sql_type = Bool)]
    submissions_open: bool,
    #[diesel(sql_type = Bool)]
    zsl_open: bool,
    #[diesel(sql_type = Bool)]
    cosmetic_open: bool,
    #[diesel(sql_type = Bool)]
    zsl_closed: bool,
    #[diesel(sql_type = Bool)]
    cosmetic_closed: bool,
    #[diesel(sql_type = Bool)]
    finalized: bool,
}

#[derive(QueryableByName)]
struct CandidateRow {
    #[diesel(sql_type = Integer)]
    level_id: i32,
    #[diesel(sql_type = BigInt)]
    workshop_id: i64,
    #[diesel(sql_type = Jsonb)]
    authors: serde_json::Value,
    #[diesel(sql_type = Text)]
    xx_hash: String,
    #[diesel(sql_type = Bool)]
    adventure: bool,
    #[diesel(sql_type = Text)]
    date_created: String,
    #[diesel(sql_type = Nullable<Text>)]
    name: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    image_url: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    author_name: Option<String>,
    #[diesel(sql_type = Nullable<Integer>)]
    points: Option<i32>,
    #[diesel(sql_type = Nullable<Float>)]
    rating: Option<f32>,
    #[diesel(sql_type = BigInt)]
    record_count: i64,
    #[diesel(sql_type = BigInt)]
    personal_best_count: i64,
    #[diesel(sql_type = BigInt)]
    vote_count: i64,
}

#[derive(QueryableByName)]
struct VoteRow {
    #[diesel(sql_type = Integer)]
    level_id: i32,
    #[diesel(sql_type = SmallInt)]
    vote_type: i16,
}

#[derive(QueryableByName)]
struct UserLock {
    #[diesel(sql_type = Integer)]
    id: i32,
}

#[derive(Clone, Debug, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct VoteCandidate {
    pub level_id: i32,
    pub workshop_id: i64,
    pub xx_hash: String,
    pub adventure: bool,
    pub date_created: String,
    pub name: Option<String>,
    pub image_url: Option<String>,
    pub author_name: Option<String>,
    pub points: Option<i32>,
    pub rating: Option<f32>,
    pub record_count: i64,
    pub personal_best_count: i64,
    pub vote_count: i64,
    pub self_authored: bool,
}

#[derive(Clone, Debug, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct VoteSnapshot {
    pub round_id: i32,
    pub contest_id: Option<i64>,
    pub submission_start: Option<String>,
    pub submission_end: Option<String>,
    pub zsl_vote_end: Option<String>,
    pub cosmetic_vote_end: Option<String>,
    pub submissions_open: bool,
    pub voting_pending: bool,
    pub open_types: Vec<i16>,
    pub candidates: Vec<VoteCandidate>,
    pub votes: [Vec<i32>; 3],
}

#[derive(Clone, Debug, PartialEq, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum VoteResultState {
    Pending,
    Published,
    Unavailable,
}

#[derive(Clone, Debug, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct VoteResultLevel {
    pub level_id: i32,
    pub xx_hash: String,
    pub name: Option<String>,
    pub image_url: Option<String>,
    pub votes: i64,
}

#[derive(Clone, Debug, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct VoteResultCategory {
    pub vote_type: i16,
    pub deadline: Option<String>,
    pub state: VoteResultState,
    pub total_votes: Option<i64>,
    pub levels: Vec<VoteResultLevel>,
}

#[derive(Clone, Debug, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct VoteResultsSnapshot {
    pub round_id: i32,
    pub categories: [VoteResultCategory; 3],
}

#[derive(QueryableByName)]
struct VoteResultRow {
    #[diesel(sql_type = Integer)]
    level_id: i32,
    #[diesel(sql_type = Text)]
    xx_hash: String,
    #[diesel(sql_type = Nullable<Text>)]
    name: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    image_url: Option<String>,
    #[diesel(sql_type = SmallInt)]
    vote_type: i16,
    #[diesel(sql_type = BigInt)]
    votes: i64,
}

fn vote_result_category(
    vote_type: i16,
    deadline: Option<String>,
    has_contest: bool,
    finalized: bool,
    closed: bool,
) -> VoteResultCategory {
    let state = if !has_contest || deadline.is_none() {
        VoteResultState::Unavailable
    } else if finalized && closed {
        VoteResultState::Published
    } else {
        VoteResultState::Pending
    };
    let total_votes = (state == VoteResultState::Published).then_some(0);
    VoteResultCategory {
        vote_type,
        deadline,
        state,
        total_votes,
        levels: Vec::new(),
    }
}

const ROUND_SQL: &str = "SELECT r.id,c.id AS contest_id, \
    r.submission_start::text AS submission_start,r.submission_end::text AS submission_end, \
    r.zsl_vote_end::text AS zsl_vote_end,r.cosmetic_vote_end::text AS cosmetic_vote_end, \
    coalesce((clock_timestamp()>=r.submission_start AND clock_timestamp()<r.submission_end),false) AS submissions_open, \
    coalesce((clock_timestamp()>=r.submission_end AND clock_timestamp()<r.zsl_vote_end),false) AS zsl_open, \
    coalesce((clock_timestamp()>=r.submission_end AND clock_timestamp()<r.cosmetic_vote_end),false) AS cosmetic_open, \
    coalesce(clock_timestamp()>=r.zsl_vote_end,false) AS zsl_closed, \
    coalesce(clock_timestamp()>=r.cosmetic_vote_end,false) AS cosmetic_closed, \
    coalesce((c.state='frozen' AND c.finalized_at IS NOT NULL AND c.current_playlist_id IS NOT NULL),false) AS finalized \
    FROM public.zsl_round r LEFT JOIN LATERAL \
    (SELECT * FROM zc_private.level_submission_contest WHERE id_zsl_round=r.id ORDER BY id DESC LIMIT 1) c ON true \
    WHERE ($1::integer IS NOT NULL AND r.id=$1) OR ($1::integer IS NULL AND r.submission_start<=clock_timestamp() \
    AND r.cosmetic_vote_end>clock_timestamp()) ORDER BY r.submission_end DESC LIMIT 1";

fn candidates_sql() -> String {
    format!(
        "SELECT DISTINCT l.id AS level_id,s.workshop_id, \
    coalesce(to_jsonb(s.authors),'null'::jsonb) AS authors,l.xx_hash,l.adventure, \
    l.date_created::text AS date_created,coalesce(i.name,v.payload->>'name') AS name, \
    coalesce(nullif(i.image_url,''),nullif(other_image.image_url,''),nullif(wi.image_url,'')) AS image_url, \
    coalesce(u.steam_name,v.payload->>'author') AS author_name, \
    p.points,p.rating, \
    (SELECT count(*) FROM public.record r WHERE r.id_level=l.id) AS record_count, \
    (SELECT count(*) FROM public.personal_best_global pb WHERE pb.id_level=l.id) AS personal_best_count, \
    (SELECT count(*) FROM public.vote vote WHERE vote.id_level=l.id) AS vote_count \
    {CANDIDATES_FROM_SQL} ORDER BY level_id,workshop_id"
    )
}

// Both ballot reads and public tallies use the finalized playlist's candidate set.
const CANDIDATES_FROM_SQL: &str = "FROM zc_private.level_submission_contest c \
    JOIN zc_private.level_submission_playlist_entry e ON e.id_playlist=c.current_playlist_id \
    JOIN zc_private.level_submission_validation v ON v.id=e.id_validation AND v.valid \
    JOIN zc_private.level_submissions s ON s.id=v.id_submission AND s.state='selected' \
    JOIN public.level l ON l.xx_hash=s.level_hash \
    LEFT JOIN LATERAL (SELECT name,image_url,author_id FROM public.level_item \
        WHERE id_level=l.id AND workshop_id=s.workshop_id ORDER BY id DESC LIMIT 1) i ON true \
    LEFT JOIN LATERAL (SELECT image_url FROM public.level_item \
        WHERE id_level=l.id AND deleted=false AND image_url<>'' \
        ORDER BY updated_at DESC,id DESC LIMIT 1) other_image ON true \
    LEFT JOIN public.workshop_item wi ON wi.workshop_id=s.workshop_id \
    LEFT JOIN public.\"user\" u ON u.steam_id=i.author_id \
    LEFT JOIN public.level_points p ON p.id_level=l.id \
    WHERE c.id=$1";

impl Database {
    pub async fn super_league_vote_results(
        &self,
        round_id: i32,
    ) -> Result<Option<VoteResultsSnapshot>> {
        let mut connection = self.connection().await?;
        let round = sql_query(ROUND_SQL)
            .bind::<Nullable<Integer>, _>(Some(round_id))
            .get_result::<RoundRow>(&mut connection)
            .await
            .optional()?;
        let Some(round) = round else { return Ok(None) };
        let mut snapshot = VoteResultsSnapshot {
            round_id: round.id,
            categories: [
                vote_result_category(
                    1,
                    round.zsl_vote_end,
                    round.contest_id.is_some(),
                    round.finalized,
                    round.zsl_closed,
                ),
                vote_result_category(
                    2,
                    round.cosmetic_vote_end.clone(),
                    round.contest_id.is_some(),
                    round.finalized,
                    round.cosmetic_closed,
                ),
                vote_result_category(
                    3,
                    round.cosmetic_vote_end,
                    round.contest_id.is_some(),
                    round.finalized,
                    round.cosmetic_closed,
                ),
            ],
        };
        let published: Vec<i16> = snapshot
            .categories
            .iter()
            .filter(|category| category.state == VoteResultState::Published)
            .map(|category| category.vote_type)
            .collect();
        let Some(contest_id) = round.contest_id.filter(|_| !published.is_empty()) else {
            return Ok(Some(snapshot));
        };
        let query = format!(
            "WITH candidates AS (\
            SELECT DISTINCT ON (l.id) l.id AS level_id,l.xx_hash,\
            coalesce(i.name,v.payload->>'name') AS name,\
            coalesce(nullif(i.image_url,''),nullif(other_image.image_url,''),nullif(wi.image_url,'')) AS image_url \
            {CANDIDATES_FROM_SQL} ORDER BY l.id,s.workshop_id,e.position), \
            tallies AS (SELECT id_level,vote_type,count(*) AS votes \
                FROM zc_private.level_submission_vote WHERE id_contest=$1 AND vote_type=ANY($2) \
                GROUP BY id_level,vote_type) \
            SELECT c.*,t.vote_type,coalesce(v.votes,0)::bigint AS votes \
            FROM candidates c CROSS JOIN unnest($2::smallint[]) t(vote_type) \
            LEFT JOIN tallies v ON v.id_level=c.level_id AND v.vote_type=t.vote_type \
            ORDER BY t.vote_type,votes DESC,coalesce(c.name,c.xx_hash) COLLATE \"C\",c.level_id"
        );
        for row in sql_query(query)
            .bind::<BigInt, _>(contest_id)
            .bind::<Array<SmallInt>, _>(&published)
            .load::<VoteResultRow>(&mut connection)
            .await?
        {
            let category = &mut snapshot.categories[(row.vote_type - 1) as usize];
            if let Some(total) = &mut category.total_votes {
                *total += row.votes;
            }
            category.levels.push(VoteResultLevel {
                level_id: row.level_id,
                xx_hash: row.xx_hash,
                name: row.name,
                image_url: row.image_url,
                votes: row.votes,
            });
        }
        Ok(Some(snapshot))
    }

    pub async fn super_league_vote_snapshot(
        &self,
        round_id: Option<i32>,
        user_id: i32,
        steam_id: &str,
    ) -> Result<Option<VoteSnapshot>> {
        let mut connection = self.connection().await?;
        let round = sql_query(ROUND_SQL)
            .bind::<Nullable<Integer>, _>(round_id)
            .get_result::<RoundRow>(&mut connection)
            .await
            .optional()?;
        let Some(round) = round else { return Ok(None) };
        let mut snapshot = VoteSnapshot {
            round_id: round.id,
            contest_id: round.contest_id,
            submission_start: round.submission_start,
            submission_end: round.submission_end,
            zsl_vote_end: round.zsl_vote_end,
            cosmetic_vote_end: round.cosmetic_vote_end,
            submissions_open: round.submissions_open,
            voting_pending: round.contest_id.is_some()
                && !round.finalized
                && (round.zsl_open || round.cosmetic_open),
            open_types: Vec::new(),
            candidates: Vec::new(),
            votes: [vec![], vec![], vec![]],
        };
        if let Some(contest_id) = round.contest_id {
            if round.finalized {
                if round.zsl_open {
                    snapshot.open_types.push(1);
                }
                if round.cosmetic_open {
                    snapshot.open_types.extend([2, 3]);
                }
                let rows = sql_query(candidates_sql())
                    .bind::<BigInt, _>(contest_id)
                    .load::<CandidateRow>(&mut connection)
                    .await?;
                for row in rows {
                    let self_authored = row.authors.as_array().is_some_and(|authors| {
                        authors
                            .iter()
                            .any(|author| author.as_str() == Some(steam_id))
                    });
                    if let Some(existing) = snapshot
                        .candidates
                        .iter_mut()
                        .find(|candidate: &&mut VoteCandidate| candidate.level_id == row.level_id)
                    {
                        existing.self_authored |= self_authored;
                        continue;
                    }
                    snapshot.candidates.push(VoteCandidate {
                        level_id: row.level_id,
                        workshop_id: row.workshop_id,
                        xx_hash: row.xx_hash,
                        adventure: row.adventure,
                        date_created: row.date_created,
                        name: row.name,
                        image_url: row.image_url,
                        author_name: row.author_name,
                        points: row.points,
                        rating: row.rating,
                        record_count: row.record_count,
                        personal_best_count: row.personal_best_count,
                        vote_count: row.vote_count,
                        self_authored,
                    });
                }
            }
            for row in sql_query(
                "SELECT id_level AS level_id,vote_type FROM zc_private.level_submission_vote \
                WHERE id_contest=$1 AND id_user=$2 ORDER BY vote_type,id_level",
            )
            .bind::<BigInt, _>(contest_id)
            .bind::<Integer, _>(user_id)
            .load::<VoteRow>(&mut connection)
            .await?
            {
                if let Some(votes) = snapshot.votes.get_mut((row.vote_type - 1) as usize) {
                    votes.push(row.level_id);
                }
            }
        }
        Ok(Some(snapshot))
    }

    /// Returns false when voting is closed or ballot is invalid. User row lock serializes replacements.
    pub async fn replace_super_league_ballot(
        &self,
        round_id: i32,
        user_id: i32,
        steam_id: &str,
        vote_type: i16,
        level_ids: &[i32],
    ) -> Result<bool> {
        let limit = if vote_type == 1 {
            14
        } else if matches!(vote_type, 2 | 3) {
            3
        } else {
            return Ok(false);
        };
        if level_ids.is_empty() || level_ids.len() > limit || level_ids.iter().any(|id| *id <= 0) {
            return Ok(false);
        }
        let unique: std::collections::HashSet<_> = level_ids.iter().collect();
        if unique.len() != level_ids.len() {
            return Ok(false);
        }
        let mut connection = self.connection().await?;
        connection.transaction::<bool, anyhow::Error, _>(async move |connection| {
            let locked = sql_query("SELECT id FROM public.\"user\" WHERE id=$1 FOR UPDATE")
                .bind::<Integer, _>(user_id).get_result::<UserLock>(connection).await.optional()?;
            if locked.as_ref().is_none_or(|user| user.id != user_id) { return Ok(false); }
            let round = sql_query(ROUND_SQL).bind::<Nullable<Integer>, _>(Some(round_id))
                .get_result::<RoundRow>(connection).await.optional()?;
            let Some(round) = round else { return Ok(false) };
            if !round.finalized || !(if vote_type == 1 { round.zsl_open } else { round.cosmetic_open }) { return Ok(false); }
            let Some(contest_id) = round.contest_id else { return Ok(false) };
            let candidates = sql_query(candidates_sql()).bind::<BigInt, _>(contest_id)
                .load::<CandidateRow>(connection).await?;
            if level_ids.iter().any(|id| !candidates.iter().any(|candidate| candidate.level_id == *id)
                || candidates.iter().any(|candidate| candidate.level_id == *id
                    && candidate.authors.as_array().is_some_and(|authors| authors.iter().any(|author| author.as_str() == Some(steam_id))))) {
                return Ok(false);
            }
            sql_query("DELETE FROM zc_private.level_submission_vote WHERE id_contest=$1 AND id_user=$2 AND vote_type=$3")
                .bind::<BigInt, _>(contest_id).bind::<Integer, _>(user_id).bind::<SmallInt, _>(vote_type)
                .execute(connection).await?;
            for level_id in level_ids {
                sql_query("INSERT INTO zc_private.level_submission_vote (id_contest,id_user,vote_type,id_level) VALUES($1,$2,$3,$4)")
                    .bind::<BigInt, _>(contest_id).bind::<Integer, _>(user_id)
                    .bind::<SmallInt, _>(vote_type).bind::<Integer, _>(*level_id)
                    .execute(connection).await?;
            }
            Ok(true)
        }).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_finalized_closed_categories_publish() {
        let deadline = Some("2026-10-04T17:00:00Z".to_owned());
        for (has_contest, finalized, closed, expected) in [
            (true, true, true, VoteResultState::Published),
            (true, true, false, VoteResultState::Pending),
            (true, false, true, VoteResultState::Pending),
            (false, true, true, VoteResultState::Unavailable),
        ] {
            let result = vote_result_category(1, deadline.clone(), has_contest, finalized, closed);
            assert_eq!(result.state, expected);
            assert_eq!(
                result.total_votes,
                (expected == VoteResultState::Published).then_some(0)
            );
            assert!(result.levels.is_empty());
        }
        assert_eq!(
            vote_result_category(1, None, true, true, true).state,
            VoteResultState::Unavailable
        );
    }

    #[test]
    fn public_result_serialization_contains_only_level_counts() {
        let mut category = vote_result_category(1, Some("deadline".into()), true, true, true);
        category.total_votes = Some(4);
        category.levels.push(VoteResultLevel {
            level_id: 7,
            xx_hash: "hash".into(),
            name: Some("Level".into()),
            image_url: None,
            votes: 4,
        });
        let value = serde_json::to_value(category).unwrap();
        assert_eq!(value["state"], "published");
        assert_eq!(value["totalVotes"], 4);
        let level = value["levels"][0].as_object().unwrap();
        assert_eq!(level.len(), 5);
        for key in ["levelId", "xxHash", "name", "imageUrl", "votes"] {
            assert!(level.contains_key(key));
        }
    }
}
