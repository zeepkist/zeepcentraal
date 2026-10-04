use anyhow::{Context, Result, ensure};
use std::collections::{BTreeSet, HashMap};
use zc_database::services::workshop::WorkshopSyncState;
use zc_workshop::WorkshopMetadataAdapter;

pub(crate) struct CatalogDiscovery {
    pub discovered: usize,
    pub queued: Vec<u64>,
    pub missing: Vec<i64>,
}

/// Finish discovery and validate completeness before permitting any deletion writes.
pub(crate) async fn discover_catalog(
    metadata: &dyn WorkshopMetadataAdapter,
    stored: &HashMap<i64, WorkshopSyncState>,
    force_all: bool,
    repair_zsl: bool,
) -> Result<CatalogDiscovery> {
    let mut seen = BTreeSet::new();
    let mut queued = BTreeSet::new();
    if repair_zsl {
        let mut page = 1;
        loop {
            let result = metadata
                .list_user_item_ids(zc_workshop::scanner::ZSL_WORKSHOP_AUTHOR_ID, page, 100)
                .await?;
            for id in result.workshop_ids {
                validate_workshop_id(id)?;
                seen.insert(id);
                queued.insert(id);
            }
            let Some(next) = result.next_page else { break };
            ensure!(next > page, "Workshop author pagination made no progress");
            page = next;
        }
        return Ok(CatalogDiscovery {
            discovered: seen.len(),
            queued: queued.into_iter().collect(),
            missing: Vec::new(),
        });
    }

    let mut cursor = "*".to_owned();
    let mut cursors = BTreeSet::new();
    let mut expected_total = None;
    loop {
        ensure!(
            cursors.insert(cursor.clone()),
            "Workshop catalog cursor repeated"
        );
        let result = metadata.list_items(&cursor, 100).await?;
        ensure!(
            *expected_total.get_or_insert(result.total) == result.total,
            "Workshop catalog total changed during discovery"
        );
        let previous_count = seen.len();
        for item in result.items {
            let id = validate_workshop_id(item.workshop_id)?;
            seen.insert(item.workshop_id);
            let stored_item = stored.get(&id);
            let updated_epoch = item
                .updated_at
                .parse::<jiff::Timestamp>()
                .context("Invalid Steam workshop timestamp")?
                .as_second();
            if force_all
                || stored_item.is_none()
                || stored_item.is_some_and(|state| {
                    state.active_item_count == 0 || updated_epoch > state.updated_epoch
                })
            {
                queued.insert(item.workshop_id);
            }
        }
        ensure!(
            seen.len() as u64 <= result.total,
            "Workshop catalog exceeds reported total"
        );
        let Some(next) = result.next_cursor else {
            ensure!(
                seen.len() as u64 == result.total,
                "Workshop catalog discovery is incomplete"
            );
            break;
        };
        ensure!(
            seen.len() > previous_count,
            "Workshop catalog pagination made no progress"
        );
        ensure!(!next.is_empty(), "Workshop catalog cursor is empty");
        cursor = next;
    }

    let mut missing = Vec::new();
    // Adventure backfills use synthetic workshop IDs, including -1.
    for id in stored.keys().filter(|id| **id > 0) {
        let workshop_id = u64::try_from(*id).context("Stored workshop ID is invalid")?;
        validate_workshop_id(workshop_id)?;
        if !seen.contains(&workshop_id) {
            missing.push(*id);
        }
    }
    missing.sort_unstable();
    Ok(CatalogDiscovery {
        discovered: seen.len(),
        queued: queued.into_iter().collect(),
        missing,
    })
}

fn validate_workshop_id(id: u64) -> Result<i64> {
    ensure!(id > 0, "Workshop ID must be positive");
    i64::try_from(id).context("Workshop ID exceeds PostgreSQL bigint")
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use std::{collections::VecDeque, sync::Mutex};
    use zc_workshop::{WorkshopCatalogPage, WorkshopItemMetadata, WorkshopUserItemPage};

    #[derive(Default)]
    struct Metadata {
        pages: Mutex<VecDeque<(&'static str, Result<WorkshopCatalogPage>)>>,
        user_pages: Mutex<VecDeque<WorkshopUserItemPage>>,
    }

    #[async_trait]
    impl WorkshopMetadataAdapter for Metadata {
        async fn get_items(&self, _: &[u64]) -> Result<Vec<WorkshopItemMetadata>> {
            anyhow::bail!("Discovery must not query missing item details")
        }

        async fn list_items(&self, cursor: &str, limit: u32) -> Result<WorkshopCatalogPage> {
            assert_eq!(limit, 100);
            let (expected, page) = self
                .pages
                .lock()
                .unwrap()
                .pop_front()
                .expect("catalog page");
            assert_eq!(cursor, expected);
            page
        }

        async fn list_user_item_ids(
            &self,
            uploader_id: u64,
            page: u32,
            limit: u32,
        ) -> Result<WorkshopUserItemPage> {
            assert_eq!(uploader_id, zc_workshop::scanner::ZSL_WORKSHOP_AUTHOR_ID);
            assert_eq!(page, 1);
            assert_eq!(limit, 100);
            Ok(self
                .user_pages
                .lock()
                .unwrap()
                .pop_front()
                .expect("author page"))
        }
    }

    fn page(ids: &[u64], next: Option<&str>, total: u64) -> WorkshopCatalogPage {
        WorkshopCatalogPage {
            items: ids
                .iter()
                .map(|id| WorkshopItemMetadata {
                    workshop_id: *id,
                    available: true,
                    created_at: "2026-01-01T00:00:00Z".into(),
                    updated_at: "2026-01-02T00:00:00Z".into(),
                    creator_id: 1,
                    file_size: 1,
                    image_url: String::new(),
                    name: "Test".into(),
                    permanent_failure: None,
                    visibility: 0,
                })
                .collect(),
            next_cursor: next.map(str::to_owned),
            total,
        }
    }

    fn metadata(pages: Vec<(&'static str, Result<WorkshopCatalogPage>)>) -> Metadata {
        Metadata {
            pages: Mutex::new(pages.into()),
            ..Default::default()
        }
    }

    fn stored() -> HashMap<i64, WorkshopSyncState> {
        let epoch = "2026-01-02T00:00:00Z"
            .parse::<jiff::Timestamp>()
            .unwrap()
            .as_second();
        [
            (-1, 1, epoch),
            (1, 1, epoch),
            (2, 1, 0),
            (3, 0, epoch),
            (4, 1, epoch),
            (5, 0, epoch),
        ]
        .into_iter()
        .map(|(id, active_item_count, updated_epoch)| {
            (
                id,
                WorkshopSyncState {
                    active_item_count,
                    updated_epoch,
                },
            )
        })
        .collect()
    }

    #[tokio::test]
    async fn complete_catalog_finds_missing_and_preserves_update_selection() -> Result<()> {
        for force_all in [false, true] {
            let metadata = metadata(vec![
                ("*", Ok(page(&[1, 2], Some("next"), 4))),
                ("next", Ok(page(&[3, 6], None, 4))),
            ]);
            let discovery = discover_catalog(&metadata, &stored(), force_all, false).await?;
            assert_eq!(discovery.discovered, 4);
            assert_eq!(
                discovery.missing,
                vec![4, 5],
                "already-deleted IDs remain retry candidates"
            );
            assert_eq!(
                discovery.queued,
                if force_all {
                    vec![1, 2, 3, 6]
                } else {
                    vec![2, 3, 6]
                }
            );
        }
        Ok(())
    }

    #[tokio::test]
    async fn author_repair_never_discovers_global_deletions() -> Result<()> {
        let metadata = Metadata {
            user_pages: Mutex::new(VecDeque::from([WorkshopUserItemPage {
                workshop_ids: vec![1],
                next_page: None,
            }])),
            ..Default::default()
        };
        let discovery = discover_catalog(&metadata, &stored(), false, true).await?;
        assert_eq!(discovery.queued, vec![1]);
        assert!(discovery.missing.is_empty());
        Ok(())
    }

    #[tokio::test]
    async fn incomplete_or_changing_catalog_cannot_produce_deletions() {
        let incomplete = metadata(vec![("*", Ok(page(&[1], None, 2)))]);
        assert!(
            discover_catalog(&incomplete, &stored(), false, false)
                .await
                .is_err()
        );
        let changed = metadata(vec![
            ("*", Ok(page(&[1], Some("next"), 2))),
            ("next", Ok(page(&[2], None, 3))),
        ]);
        assert!(
            discover_catalog(&changed, &stored(), false, false)
                .await
                .is_err()
        );
        let failed = metadata(vec![
            ("*", Ok(page(&[1], Some("next"), 2))),
            ("next", Err(anyhow::anyhow!("Steam unavailable"))),
        ]);
        assert!(
            discover_catalog(&failed, &stored(), false, false)
                .await
                .is_err()
        );
    }

    #[tokio::test]
    async fn cursor_cycles_and_stalled_pages_are_rejected() {
        let cycle = metadata(vec![
            ("*", Ok(page(&[1], Some("next"), 3))),
            ("next", Ok(page(&[2], Some("*"), 3))),
        ]);
        assert!(
            discover_catalog(&cycle, &stored(), false, false)
                .await
                .is_err()
        );
        let stalled = metadata(vec![
            ("*", Ok(page(&[1], Some("next"), 2))),
            ("next", Ok(page(&[1], Some("another"), 2))),
        ]);
        assert!(
            discover_catalog(&stalled, &stored(), false, false)
                .await
                .is_err()
        );
    }

    #[tokio::test]
    async fn invalid_ids_and_timestamps_are_rejected() {
        for id in [0, u64::MAX] {
            let metadata = metadata(vec![("*", Ok(page(&[id], None, 1)))]);
            assert!(
                discover_catalog(&metadata, &stored(), false, false)
                    .await
                    .is_err()
            );
        }
        let mut invalid = page(&[1], None, 1);
        invalid.items[0].updated_at = "invalid".into();
        let metadata = metadata(vec![("*", Ok(invalid))]);
        assert!(
            discover_catalog(&metadata, &stored(), false, false)
                .await
                .is_err()
        );
    }

    #[tokio::test]
    async fn validated_empty_catalog_can_reconcile_all_stored_items() -> Result<()> {
        let metadata = metadata(vec![("*", Ok(page(&[], None, 0)))]);
        let discovery = discover_catalog(&metadata, &stored(), false, false).await?;
        assert_eq!(discovery.missing, vec![1, 2, 3, 4, 5]);
        assert!(discovery.queued.is_empty());
        Ok(())
    }

    #[tokio::test]
    async fn catalog_batches_fit_queue_payload_contract() -> Result<()> {
        let ids = (1..=21).collect::<Vec<_>>();
        let metadata = metadata(vec![("*", Ok(page(&ids, None, 21)))]);
        let discovery = discover_catalog(&metadata, &HashMap::new(), false, false).await?;
        let sizes = discovery
            .queued
            .chunks(crate::WORKSHOP_SCAN_BATCH_SIZE)
            .map(|chunk| {
                assert!(crate::TaskIdentifier::ScanWorkshopBatch.validate_payload(
                    &serde_json::json!({
                        "workshopIds": chunk.iter().map(u64::to_string).collect::<Vec<_>>(),
                        "fixZeepSDKExponentHashes": false,
                    })
                ));
                chunk.len()
            })
            .collect::<Vec<_>>();
        assert_eq!(sizes, vec![10, 10, 1]);
        Ok(())
    }
}
