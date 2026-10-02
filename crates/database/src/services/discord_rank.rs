use crate::Database;
use anyhow::Result;
use diesel::{
    QueryableByName, sql_query,
    sql_types::{BigInt, Integer, Jsonb, Nullable},
};
use diesel_async::{AsyncConnection, AsyncPgConnection, RunQueryDsl};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

const BATCH_LIMIT: usize = 50;
const QUIET_MILLISECONDS: i64 = 120_000;
const WINDOW_MILLISECONDS: i64 = 300_000;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, QueryableByName, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RankChange {
    #[diesel(sql_type = Integer)]
    pub id_user: i32,
    #[diesel(sql_type = Integer)]
    pub previous_rank: i32,
    #[diesel(sql_type = Integer)]
    pub rank: i32,
}

#[derive(Default)]
struct Accumulator {
    changes: BTreeMap<i32, PendingChange>,
    window_started_at: Option<i64>,
    last_change_at: Option<i64>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PendingChange {
    #[serde(flatten)]
    change: RankChange,
    changed_at: i64,
}

struct Batch {
    changes: Vec<RankChange>,
    occurred_at: i64,
}

impl Accumulator {
    fn take(&mut self, count: usize) -> Batch {
        let mut changes = self.changes.values().cloned().collect::<Vec<_>>();
        changes.sort_by_key(|change| {
            (
                if change.change.rank == -1 {
                    i64::MAX
                } else {
                    i64::from(change.change.rank)
                },
                change.change.id_user,
            )
        });
        changes.truncate(count);
        for change in &changes {
            self.changes.remove(&change.change.id_user);
        }
        let occurred_at = changes
            .iter()
            .map(|change| change.changed_at)
            .max()
            .expect("Nonempty rank batch has timestamp");
        if self.changes.is_empty() {
            self.window_started_at = None;
            self.last_change_at = None;
        }
        Batch {
            changes: changes.into_iter().map(|change| change.change).collect(),
            occurred_at,
        }
    }

    fn flush_due(&mut self, now: i64) -> Vec<Batch> {
        match (self.window_started_at, self.last_change_at) {
            (Some(start), Some(last))
                if now >= start + WINDOW_MILLISECONDS || now >= last + QUIET_MILLISECONDS =>
            {
                vec![self.take(BATCH_LIMIT)]
            }
            _ => Vec::new(),
        }
    }

    fn append(&mut self, changes: Vec<RankChange>, now: i64) -> Vec<Batch> {
        let mut batches = self.flush_due(now);
        let mut changed = false;
        for change in changes {
            if change.id_user <= 0
                || !valid_rank(change.previous_rank)
                || !valid_rank(change.rank)
                || change.previous_rank == change.rank
            {
                continue;
            }
            let previous_rank = self
                .changes
                .get(&change.id_user)
                .map_or(change.previous_rank, |pending| pending.change.previous_rank);
            changed = true;
            if previous_rank == change.rank {
                self.changes.remove(&change.id_user);
            } else {
                self.changes.insert(
                    change.id_user,
                    PendingChange {
                        change: RankChange {
                            previous_rank,
                            ..change
                        },
                        changed_at: now,
                    },
                );
            }
        }
        if self.changes.is_empty() {
            self.window_started_at = None;
            self.last_change_at = None;
        } else if changed {
            self.window_started_at.get_or_insert(now);
            self.last_change_at = Some(now);
        }
        while self.changes.len() >= BATCH_LIMIT {
            batches.push(self.take(BATCH_LIMIT));
        }
        batches
    }
}

fn valid_rank(rank: i32) -> bool {
    rank == -1 || rank > 0
}

#[derive(QueryableByName)]
struct StateRow {
    #[diesel(sql_type = Jsonb)]
    changes: serde_json::Value,
    #[diesel(sql_type = Nullable<BigInt>)]
    window_started_at: Option<i64>,
    #[diesel(sql_type = Nullable<BigInt>)]
    last_change_at: Option<i64>,
}

#[derive(QueryableByName)]
struct ClockRow {
    #[diesel(sql_type = BigInt)]
    milliseconds: i64,
}

pub(crate) async fn append_rank_changes(
    connection: &mut AsyncPgConnection,
    changes: Vec<RankChange>,
) -> Result<usize> {
    // Caller owns transaction: rank updates, accumulator and emitted events commit together.
    let row = sql_query(
        "SELECT changes,floor(extract(epoch FROM window_started_at)*1000)::bigint AS window_started_at, \
         floor(extract(epoch FROM last_change_at)*1000)::bigint AS last_change_at \
         FROM zc_private.discord_rank_batch_state WHERE id=1 FOR UPDATE",
    ).get_result::<StateRow>(connection).await?;
    // Read clock after locking so concurrent requests cannot move quiet timer backwards.
    let now = sql_query(
        "SELECT floor(extract(epoch FROM clock_timestamp())*1000)::bigint AS milliseconds",
    )
    .get_result::<ClockRow>(connection)
    .await?
    .milliseconds;
    let mut accumulator = Accumulator {
        changes: serde_json::from_value::<Vec<PendingChange>>(row.changes)?
            .into_iter()
            .map(|change| (change.change.id_user, change))
            .collect(),
        window_started_at: row.window_started_at,
        last_change_at: row.last_change_at,
    };
    let batches = accumulator.append(changes, now);
    for batch in &batches {
        sql_query(
            "INSERT INTO public.discord_activity_event(kind,payload,occurred_at) \
             VALUES('rank_batch',jsonb_build_object('changes',$1::jsonb),to_timestamp($2::bigint::double precision/1000))",
        ).bind::<Jsonb, _>(serde_json::to_value(&batch.changes)?)
            .bind::<BigInt, _>(batch.occurred_at).execute(connection).await?;
    }
    sql_query(
        "UPDATE zc_private.discord_rank_batch_state SET changes=$1, \
         window_started_at=to_timestamp($2::bigint::double precision/1000), \
         last_change_at=to_timestamp($3::bigint::double precision/1000) WHERE id=1",
    )
    .bind::<Jsonb, _>(serde_json::to_value(
        accumulator.changes.into_values().collect::<Vec<_>>(),
    )?)
    .bind::<Nullable<BigInt>, _>(accumulator.window_started_at)
    .bind::<Nullable<BigInt>, _>(accumulator.last_change_at)
    .execute(connection)
    .await?;
    Ok(batches.len())
}

impl Database {
    pub async fn flush_discord_rank_batches(&self) -> Result<usize> {
        let mut connection = self.connection().await?;
        connection
            .transaction::<usize, anyhow::Error, _>(async |connection| {
                append_rank_changes(connection, Vec::new()).await
            })
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn change(id_user: i32, previous_rank: i32, rank: i32) -> RankChange {
        RankChange {
            id_user,
            previous_rank,
            rank,
        }
    }

    #[test]
    fn merges_players_and_flushes_after_two_quiet_minutes() {
        let mut state = Accumulator::default();
        assert!(state.append(vec![change(1, 50, 49)], 0).is_empty());
        assert!(state.append(vec![change(1, 49, 47)], 119_000).is_empty());
        assert!(state.flush_due(238_999).is_empty());
        let batches = state.flush_due(239_000);
        assert_eq!(batches[0].changes, vec![change(1, 50, 47)]);
        assert_eq!(batches[0].occurred_at, 119_000);
        assert!(state.flush_due(500_000).is_empty());
    }

    #[test]
    fn enforces_five_minute_cap_and_separates_arrivals_at_deadline() {
        let mut state = Accumulator::default();
        for (now, previous, rank) in [
            (0, 50, 49),
            (100_000, 49, 48),
            (200_000, 48, 47),
            (299_999, 47, 46),
        ] {
            assert!(
                state
                    .append(vec![change(1, previous, rank)], now)
                    .is_empty()
            );
        }
        let batches = state.append(vec![change(1, 46, 45)], 300_000);
        assert_eq!(batches[0].changes, vec![change(1, 50, 46)]);
        assert_eq!(state.flush_due(420_000)[0].changes, vec![change(1, 46, 45)]);
    }

    #[test]
    fn removes_reversals_and_accepts_unranked_transitions() {
        let mut state = Accumulator::default();
        state.append(vec![change(1, -1, 50), change(2, 2, -1)], 0);
        state.append(vec![change(1, 50, -1)], 10_000);
        assert_eq!(state.flush_due(130_000)[0].changes, vec![change(2, 2, -1)]);
        state.append(vec![change(1, 50, 49)], 200_000);
        state.append(vec![change(1, 49, 50)], 210_000);
        assert!(state.changes.is_empty());
        assert_eq!(state.window_started_at, None);
        assert!(
            state
                .append(
                    vec![change(0, 1, 2), change(1, 0, 2), change(2, 1, 1)],
                    220_000
                )
                .is_empty()
        );
        assert!(state.flush_due(600_000).is_empty());
    }

    #[test]
    fn thresholds_count_unique_players_and_large_batches_keep_remainder() {
        for count in [49, 50, 51, 151] {
            let mut state = Accumulator::default();
            let changes = (1..=count).map(|id| change(id, id + 1, id)).collect();
            let batches = state.append(changes, 0);
            assert_eq!(batches.len(), count as usize / BATCH_LIMIT);
            assert!(
                batches
                    .iter()
                    .all(|batch| batch.changes.len() == BATCH_LIMIT)
            );
            assert_eq!(state.changes.len(), count as usize % BATCH_LIMIT);
            if count == 49 {
                assert!(state.append(vec![change(1, 1, 3)], 1).is_empty());
                assert_eq!(state.changes.len(), 49);
                assert_eq!(state.append(vec![change(50, 51, 50)], 2).len(), 1);
            }
        }
    }

    #[test]
    fn threshold_remainder_keeps_original_deadline_and_its_own_timestamp() {
        let mut state = Accumulator::default();
        state.append((100..=119).map(|id| change(id, id + 1, id)).collect(), 0);
        let batches = state.append((1..=49).map(|id| change(id, id + 1, id)).collect(), 100_000);
        assert_eq!(batches.len(), 1);
        assert_eq!(batches[0].occurred_at, 100_000);
        assert_eq!(state.window_started_at, Some(0));
        assert_eq!(state.changes.len(), 19);
        // All new players already emitted. Remaining players last moved at time zero.
        let tail = state.flush_due(220_000);
        assert_eq!(tail[0].occurred_at, 0);

        state.append((100..=119).map(|id| change(id, id + 1, id)).collect(), 0);
        state.append((1..=49).map(|id| change(id, id + 1, id)).collect(), 100_000);
        state.append(vec![change(101, 101, 99)], 210_000);
        let capped = state.flush_due(300_000);
        assert_eq!(capped.len(), 1);
        assert_eq!(capped[0].occurred_at, 210_000);
        assert_eq!(capped[0].changes.len(), 19);
    }
}
