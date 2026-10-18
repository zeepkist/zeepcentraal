use crate::Database;
use anyhow::{Result, ensure};
use diesel::{
    QueryableByName, sql_query,
    sql_types::{Integer, Jsonb},
};
use diesel_async::{AsyncConnection, RunQueryDsl, SimpleAsyncConnection};
use serde_json::Value;

#[derive(QueryableByName)]
struct Batch {
    #[diesel(sql_type=Integer)]
    processed: i32,
}
#[derive(QueryableByName)]
struct Status {
    #[diesel(sql_type=Jsonb)]
    value: Value,
}

impl Database {
    pub async fn history_optimization(&self, operation: &str, qualified: bool) -> Result<Value> {
        let mut connection = self.connection().await?;
        match operation {
            "backfill" | "verify" => {
                let statement = if operation == "backfill" {
                    "SELECT zc_private.backfill_history_fact(1000) AS processed"
                } else {
                    "SELECT zc_private.verify_history_fact(1000) AS processed"
                };
                loop {
                    let batch: Batch = sql_query(statement).get_result(&mut connection).await?;
                    if batch.processed == 0 {
                        break;
                    }
                    tracing::info!(
                        operation,
                        processed = batch.processed,
                        "History optimization batch committed"
                    );
                }
            }
            "cutover" | "rollback" => {
                ensure!(
                    qualified,
                    "Pass --writers-paused-and-qualified after completing runbook checks"
                );
                connection
                    .transaction::<(), anyhow::Error, _>(async |connection| {
                        connection
                            .batch_execute(
                                "SET LOCAL statement_timeout='60s'; SET LOCAL lock_timeout='5s'",
                            )
                            .await?;
                        sql_query(if operation == "cutover" {
                            "SELECT zc_private.cutover_history_fact(true,true)"
                        } else {
                            "SELECT zc_private.rollback_history_fact()"
                        })
                        .execute(connection)
                        .await?;
                        Ok(())
                    })
                    .await?;
            }
            "status" => {}
            _ => anyhow::bail!("Unknown history operation"),
        }
        Ok(sql_query("SELECT to_jsonb(state)-'original_view' || jsonb_build_object('dirty_records',(SELECT count(*) FROM zc_private.history_fact_dirty)) AS value FROM zc_private.history_fact_rollout state")
            .get_result::<Status>(&mut connection).await?.value)
    }
}
