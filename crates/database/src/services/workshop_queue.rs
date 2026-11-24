//! Queue writes shared by workshop mutations and explicit audit requests.
use anyhow::{Result, ensure};
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{BigInt, Integer, Jsonb, Nullable, Text},
};
use diesel_async::{AsyncPgConnection, RunQueryDsl};
use std::collections::BTreeSet;

/// Caller holds the bulk lane lock and enqueues before committing.
pub async fn claim_workshop_scan_request(
    connection: &mut AsyncPgConnection,
    workshop_id: i64,
    hash: Option<&str>,
) -> Result<bool> {
    ensure!(workshop_id > 0, "Workshop ID must be positive");
    Ok(sql_query(include_str!(
        "../queries/workshop_queue/claim_workshop_scan_request.sql"
    ))
    .bind::<BigInt, _>(workshop_id)
    .bind::<Nullable<Text>, _>(hash)
    .execute(connection)
    .await?
        != 0)
}

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
        sql_query(include_str!("../queries/workshop_queue/lock_bulk_lane.sql"))
            .execute(connection)
            .await?;
        #[derive(QueryableByName)]
        struct Pending {
            #[diesel(sql_type=BigInt)]
            id: i64,
            #[diesel(sql_type=Jsonb)]
            payload: serde_json::Value,
        }
        let pending = sql_query(include_str!(
            "../queries/workshop_queue/read_pending_ghost_audit.sql"
        ))
        .get_result::<Pending>(connection)
        .await
        .optional()?;
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
            sql_query(include_str!(
                "../queries/workshop_queue/update_ghost_audit_payload.sql"
            ))
            .bind::<BigInt, _>(pending.id)
            .bind::<Jsonb, _>(payload)
            .execute(connection)
            .await?;
        } else {
            sql_query(include_str!(
                "../queries/workshop_queue/enqueue_ghost_audit.sql"
            ))
            .bind::<Jsonb, _>(payload)
            .bind::<Text, _>(format!("audit-changed-levels:{}", zc_core::generate_uid()))
            .execute(connection)
            .await?;
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
        sql_query(include_str!(
            "../queries/workshop_queue/enqueue_level_scores.sql"
        ))
        .bind::<Integer, _>(id)
        .execute(connection)
        .await?;
    }
    Ok(())
}
