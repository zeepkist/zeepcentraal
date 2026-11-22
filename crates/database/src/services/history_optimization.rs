use crate::Database;
use anyhow::{Result, ensure};
use diesel::{
    QueryableByName, sql_query,
    sql_types::{Bool, Jsonb},
};
use diesel_async::{AsyncConnection, RunQueryDsl, SimpleAsyncConnection};
use serde_json::Value;

#[derive(QueryableByName)]
struct Status {
    #[diesel(sql_type=Jsonb)]
    value: Value,
}

#[derive(QueryableByName)]
struct Retired {
    #[diesel(sql_type = Bool)]
    retired: bool,
}

impl Database {
    pub async fn history_optimization(&self, operation: &str, qualified: bool) -> Result<Value> {
        let mut connection = self.connection().await?;
        let retired: Retired = sql_query(include_str!(
            "../queries/history_optimization/history_optimization_to_regclass.sql"
        ))
        .get_result(&mut connection)
        .await?;
        if retired.retired {
            ensure!(
                operation != "rollback",
                "History index retired; revert migration 20261019000800 to rebuild legacy storage before rollback"
            );
            ensure!(
                ["status", "backfill", "verify", "cutover"].contains(&operation),
                "Unknown history operation"
            );
            return Ok(serde_json::json!({"retired": true, "source": "record_history_fact"}));
        }
        match operation {
            "backfill" | "verify" => {
                crate::migrations::history_batches(&mut connection, operation).await?;
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
                                include_str!("../queries/history_optimization/history_optimization.sql"),
                            )
                            .await?;
                        sql_query(if operation == "cutover" {
                            include_str!("../queries/history_optimization/history_optimization_cutover_history_fact.sql")
                        } else {
                            include_str!("../queries/history_optimization/history_optimization_rollback_history_fact.sql")
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
        Ok(sql_query(include_str!(
            "../queries/history_optimization/select_history_fact_dirty.sql"
        ))
        .get_result::<Status>(&mut connection)
        .await?
        .value)
    }
}
