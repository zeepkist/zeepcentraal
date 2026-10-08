//! Upsert corrected reports with current validator. Default: read-only preview.
//! cargo run -p zc-jobs --example revalidate_legacy_ghosts --release -- [--apply] [--all] [--record ID] [--after-id ID]
use anyhow::{Context, Result, ensure};
use serde_json::json;
use std::sync::Arc;
use zc_core::{
    config::{DatabaseConfig, DatabaseProfile, ObjectStorageConfig},
    ghost_validation::VALIDATOR_VERSION,
    object_storage::S3ObjectStorage,
};
use zc_database::{Database, DatabasePool, PoolBudget, PoolSettings};
use zc_jobs::{ghost_audit::GhostAuditService, queue::Queue};

#[tokio::main]
async fn main() {
    if run().await.is_err() {
        // Configuration/storage errors can contain private URLs. Keep output sanitized.
        eprintln!(
            "Correction stopped. Completed results remain saved. Retry after checking configuration and storage."
        );
        std::process::exit(1);
    }
}

async fn run() -> Result<()> {
    let mut filter = json!({"reasons":["invalid_splits","missing_ghost"]});
    let mut apply = false;
    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--apply" => apply = true,
            "--all" => {
                filter
                    .as_object_mut()
                    .expect("filter object")
                    .remove("reasons");
            }
            "--record" | "--after-id" => {
                let id: i32 = args.next().context("ID required")?.parse()?;
                ensure!(id >= 0 && (arg != "--record" || id > 0), "Invalid ID");
                filter[if arg == "--record" {
                    "idRecord"
                } else {
                    "afterId"
                }] = json!(id);
            }
            _ => anyhow::bail!("Unknown option"),
        }
    }
    zc_core::environment::initialize()?;
    let config = DatabaseConfig::from_env_with_profile(2, DatabaseProfile::Worker)?;
    println!(
        "Validator: {VALIDATOR_VERSION}. Local database: {}. Apply: {apply}.",
        matches!(config.host.as_str(), "localhost" | "127.0.0.1" | "::1")
    );
    let pool = DatabasePool::connect(
        &config.url,
        PoolSettings::from_database_config(&config, "zeepcentraal-ghost-correction"),
        PoolBudget::application(2),
    )
    .await?;
    let database = Database::from_partition(pool.application());
    let service = if apply {
        Some(Arc::new(GhostAuditService::new(
            database.clone(),
            Queue::deferred(database.pool_partition()),
            Arc::new(S3ObjectStorage::new(&ObjectStorageConfig::from_env()?)?),
        )))
    } else {
        None
    };
    let mut count = 0;
    let mut retryable = 0;
    loop {
        let ids = database.audit_record_ids(&filter).await?;
        if ids.is_empty() {
            break;
        }
        if let Some(service) = &service {
            // Match audit service's two-slot memory bound. Retry failures separately;
            // one unavailable object must not stop correction of other records.
            let mut pending = tokio::task::JoinSet::new();
            for id in &ids {
                if pending.len() == 2 {
                    if pending.join_next().await.context("audit task missing")?? {
                        count += 1;
                    } else {
                        retryable += 1;
                    }
                }
                let service = Arc::clone(service);
                let id = *id;
                pending.spawn(async move {
                    let succeeded = service
                        .validate_record_ghost(&json!({"idRecord":id}))
                        .await
                        .is_ok();
                    println!(
                        "Record {id}: {}",
                        if succeeded {
                            "corrected assigned result"
                        } else {
                            "retry required"
                        }
                    );
                    succeeded
                });
            }
            while let Some(result) = pending.join_next().await {
                if result? {
                    count += 1;
                } else {
                    retryable += 1;
                }
            }
        } else {
            count += ids.len();
        }
        filter["afterId"] = json!(ids.last().context("page empty")?);
        if ids.len() < 100 {
            break;
        }
    }
    println!(
        "{} records: {count}. Record dates, associations, eligibility and scores unchanged.",
        if apply { "Corrected" } else { "Selected" }
    );
    ensure!(retryable == 0, "{retryable} records need retry");
    Ok(())
}
