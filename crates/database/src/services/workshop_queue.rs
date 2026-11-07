//! Queue writes shared by workshop mutations and explicit audit requests.
use anyhow::{Result, ensure};
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{BigInt, Integer, Jsonb, Text},
};
use diesel_async::{AsyncPgConnection, RunQueryDsl};
use std::collections::BTreeSet;

/// Caller owns transaction. Keep metadata and required audit work atomic.
pub async fn enqueue_ghost_audit_levels(
    connection: &mut AsyncPgConnection,
    levels: &[i32],
) -> Result<()> {
    ensure!(
        levels.len() <= 1000,
        "Audit enqueue batch exceeds 1000 levels"
    );
    ensure!(levels.iter().all(|id| *id > 0), "Invalid audit level");
    let mut remaining: BTreeSet<i32> = levels.iter().copied().collect();
    while !remaining.is_empty() {
        sql_query("SELECT zc_jobs.lock_lane('bulk')")
            .execute(connection)
            .await?;
        #[derive(QueryableByName)]
        struct Pending {
            #[diesel(sql_type=BigInt)]
            id: i64,
            #[diesel(sql_type=Jsonb)]
            payload: serde_json::Value,
        }
        let pending = sql_query("SELECT id,payload FROM zc_jobs.job WHERE task='auditRecordGhosts' AND NOT running AND NOT(payload ? 'work') AND job_key LIKE 'audit-changed-levels:%' AND jsonb_array_length(payload->'idLevels')<1000 ORDER BY id LIMIT 1 FOR UPDATE")
                    .get_result::<Pending>(connection).await.optional()?;
        let mut ids: std::collections::BTreeSet<i32> = pending
            .as_ref()
            .into_iter()
            .flat_map(|p| p.payload["idLevels"].as_array().into_iter().flatten())
            .filter_map(|v| v.as_i64().and_then(|n| i32::try_from(n).ok()))
            .collect();
        let taken: Vec<_> = remaining
            .iter()
            .filter(|id| !ids.contains(id))
            .take(1000 - ids.len())
            .copied()
            .collect();
        let already: Vec<_> = remaining.intersection(&ids).copied().collect();
        ids.extend(taken.iter().copied());
        let payload = serde_json::json!({"idLevels":ids});
        if let Some(pending) = pending {
            sql_query("UPDATE zc_jobs.job SET payload=$2 WHERE id=$1")
                .bind::<BigInt, _>(pending.id)
                .bind::<Jsonb, _>(payload)
                .execute(connection)
                .await?;
        } else {
            sql_query("SELECT zc_jobs.enqueue('bulk','auditRecordGhosts',$1,$2,'ghost-audit',3,clock_timestamp())")
                        .bind::<Jsonb,_>(payload).bind::<Text,_>(format!("audit-changed-levels:{}",zc_core::generate_uid())).execute(connection).await?;
        }

        for id in taken.into_iter().chain(already) {
            remaining.remove(&id);
        }
    }
    Ok(())
}

pub(crate) async fn enqueue_level_scores(
    connection: &mut AsyncPgConnection,
    levels: &[i32],
) -> Result<()> {
    for id in levels.iter().copied().collect::<BTreeSet<_>>() {
        sql_query("SELECT zc_jobs.enqueue('bulk','updateLevelScore',jsonb_build_object('idLevel',$1::integer),'update-level-score:'||$1,'level-maintenance-shard:'||($1%4),3,clock_timestamp())")
            .bind::<Integer,_>(id).execute(connection).await?;
    }
    Ok(())
}
