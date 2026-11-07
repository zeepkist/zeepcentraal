use anyhow::{Result, ensure};
use async_trait::async_trait;
use std::{
    path::PathBuf,
    sync::{
        Arc, Mutex,
        atomic::{AtomicUsize, Ordering},
    },
};
use zc_core::object_storage::{DownloadConstraints, ObjectStorage};
use zc_database::Database;
use zc_workshop::{
    DownloadedWorkshopItem, WorkshopCatalogPage, WorkshopDownloader, WorkshopItemMetadata,
    WorkshopMetadataAdapter, WorkshopUserItemPage, persistence::DatabaseWorkshopPersistence,
    scanner::WorkshopScanner, steamcmd::WorkshopDownload,
};

struct Metadata;
#[async_trait]
impl WorkshopMetadataAdapter for Metadata {
    async fn get_items(&self, ids: &[u64]) -> Result<Vec<WorkshopItemMetadata>> {
        Ok(ids
            .iter()
            .map(|id| WorkshopItemMetadata {
                available: true,
                created_at: "2026-01-01T00:00:00Z".into(),
                creator_id: 76561198800000001,
                file_size: 1,
                image_url: String::new(),
                name: format!("Fixture {id}"),
                permanent_failure: None,
                updated_at: "2026-01-02T00:00:00Z".into(),
                visibility: 0,
                workshop_id: *id,
            })
            .collect())
    }
    async fn list_items(&self, _: &str, _: u32) -> Result<WorkshopCatalogPage> {
        unreachable!()
    }
    async fn list_user_item_ids(&self, _: u64, _: u32, _: u32) -> Result<WorkshopUserItemPage> {
        unreachable!()
    }
}

#[derive(Default)]
struct Storage {
    uploads: AtomicUsize,
    fail_at: AtomicUsize,
}
#[async_trait]
impl ObjectStorage for Storage {
    async fn upload(&self, _: &str, _: Vec<u8>, _: &str) -> Result<()> {
        let number = self.uploads.fetch_add(1, Ordering::SeqCst) + 1;
        ensure!(
            number != self.fail_at.load(Ordering::SeqCst),
            "fixture upload failed"
        );
        Ok(())
    }
    async fn download(&self, _: &str, _: DownloadConstraints<'_>) -> Result<Vec<u8>> {
        unreachable!()
    }
    async fn delete(&self, _: &str) -> Result<()> {
        unreachable!()
    }
}

#[derive(Default)]
struct Downloader {
    roots: Mutex<Vec<PathBuf>>,
}
#[async_trait]
impl WorkshopDownloader for Downloader {
    async fn download(&self, ids: &[u64]) -> Result<WorkshopDownload> {
        let root =
            std::env::temp_dir().join(format!("zc-durable-scan-{}", zc_core::generate_uid()));
        tokio::fs::create_dir_all(&root).await?;
        self.roots.lock().unwrap().push(root.clone());
        let mut items = Vec::new();
        for id in ids {
            let directory = root.join(id.to_string());
            tokio::fs::create_dir_all(&directory).await?;
            for version in 0..if *id == 3 { 2 } else { 1 } {
                let content = if *id == 2 {
                    "{\"blox\":".into()
                } else {
                    format!(
                        "LevelEditor2,Author,fixture-{id}-{version}\n0,0,0,0,0,0,0,0\n12.5,20,25,30,1,-1\n22,{id},{version},0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0"
                    )
                };
                tokio::fs::write(directory.join(format!("track{version}.zeeplevel")), content)
                    .await?;
                tokio::fs::write(
                    directory.join(format!("track{version}_thumbnail.jpg")),
                    b"jpg",
                )
                .await?;
            }
            items.push(DownloadedWorkshopItem {
                workshop_id: *id,
                directory,
            });
        }
        // A file cannot be removed with remove_dir_all: fail cleanup after persistence.
        let cleanup = if ids == [4] {
            let file = root.join("cleanup-file");
            tokio::fs::write(&file, b"fixture").await?;
            file
        } else {
            root
        };
        Ok(WorkshopDownload::new(cleanup, items))
    }
}

async fn assert_pending(client: &tokio_postgres::Client, workshop: i64) -> Result<()> {
    let row = client.query_one("SELECT count(*)::bigint, bool_and(EXISTS(SELECT 1 FROM zc_jobs.job j WHERE j.task='updateLevelScore' AND (j.payload->>'idLevel')::integer=l.id)), bool_and(EXISTS(SELECT 1 FROM zc_jobs.job j WHERE j.task='auditRecordGhosts' AND j.payload->'idLevels' @> to_jsonb(ARRAY[l.id]))) FROM public.level l JOIN public.level_item i ON i.id_level=l.id WHERE i.workshop_id=$1", &[&workshop]).await?;
    ensure!(
        row.get::<_, i64>(0) > 0,
        "fixture must commit at least one level"
    );
    assert!(
        row.get::<_, bool>(1),
        "score work must survive scan failure"
    );
    assert!(
        row.get::<_, bool>(2),
        "audit work must survive scan failure"
    );
    Ok(())
}

#[tokio::test]
#[ignore = "requires empty schema-only local workshop_durable_followups_test with current migrations and pgmq 1.12.0"]
async fn committed_changes_keep_followups_through_scan_and_queue_failures() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = reqwest::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1")
            && parsed.path() == "/workshop_durable_followups_test",
        "Dedicated isolated database required"
    );
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("fixture connection") });
    ensure!(
        client
            .query_one("SELECT count(*) FROM public.level", &[])
            .await?
            .get::<_, i64>(0)
            == 0,
        "Empty fixture required"
    );
    let database = Database::connect(&url, 2).await?;
    let storage = Arc::new(Storage::default());
    let persistence =
        DatabaseWorkshopPersistence::new(database.clone(), storage.clone(), "thumbnails")?;
    let downloader = Downloader::default();
    let scanner = WorkshopScanner::new(&Metadata, &downloader, &persistence);
    let outcome = async {
        let batch = scanner.scan_workshop_items(&[1,2], 2).await?;
        assert_eq!(batch.transient_failures.len(), 1);
        assert_pending(&client, 1).await?;
        let queued: i64 = client.query_one("SELECT count(*) FROM zc_jobs.job", &[]).await?.get(0);
        scanner.scan_workshop_item(1).await?;
        assert_eq!(client.query_one("SELECT count(*) FROM zc_jobs.job", &[]).await?.get::<_,i64>(0), queued);

        storage.fail_at.store(storage.uploads.load(Ordering::SeqCst)+2, Ordering::SeqCst);
        assert!(scanner.scan_workshop_item(3).await.is_err());
        assert_pending(&client, 3).await?;
        scanner.scan_workshop_item(3).await?;
        assert_pending(&client, 3).await?;

        assert!(scanner.scan_workshop_item(4).await.is_err());
        assert_pending(&client, 4).await?;

        // Start a new audit batch so enqueue failure cannot merge into previous job.
        client.batch_execute("DELETE FROM zc_jobs.job WHERE task='auditRecordGhosts'; CREATE FUNCTION public.reject_fixture_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.task='auditRecordGhosts' THEN RAISE EXCEPTION 'fixture queue failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_fixture_audit BEFORE INSERT ON zc_jobs.job FOR EACH ROW EXECUTE FUNCTION public.reject_fixture_audit()").await?;
        assert!(scanner.scan_workshop_item(5).await.is_err());
        assert_eq!(client.query_one("SELECT count(*) FROM public.workshop_item WHERE workshop_id=5", &[]).await?.get::<_,i64>(0), 0);
        client.batch_execute("DROP TRIGGER reject_fixture_audit ON zc_jobs.job; DROP FUNCTION public.reject_fixture_audit()").await?;
        scanner.scan_workshop_item(5).await?;
        assert_pending(&client, 5).await?;
        client.batch_execute("DELETE FROM zc_jobs.job").await?;
        let ids = database.mark_workshop_deleted(5, 2).await?;
        assert!(!ids.is_empty());
        ensure!(client.query_one("SELECT EXISTS(SELECT 1 FROM zc_jobs.job WHERE task='updateLevelScore' AND (payload->>'idLevel')::integer=$1)", &[&ids[0]]).await?.get::<_,bool>(0), "deletion repair missing");
        client.batch_execute("DELETE FROM zc_jobs.job; CREATE FUNCTION public.reject_fixture_score() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.task='updateLevelScore' THEN RAISE EXCEPTION 'fixture score failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_fixture_score BEFORE INSERT ON zc_jobs.job FOR EACH ROW EXECUTE FUNCTION public.reject_fixture_score()").await?;
        assert!(database.mark_missing_workshop_levels_deleted(1, &[]).await.is_err());
        assert!(!client.query_one("SELECT deleted FROM public.level_item WHERE workshop_id=1 LIMIT 1", &[]).await?.get::<_,bool>(0));
        client.batch_execute("DROP TRIGGER reject_fixture_score ON zc_jobs.job; DROP FUNCTION public.reject_fixture_score()").await?;
        let ids = database.mark_missing_workshop_levels_deleted(1, &[]).await?;
        assert!(!ids.is_empty());
        assert!(client.query_one("SELECT EXISTS(SELECT 1 FROM zc_jobs.job WHERE task='updateLevelScore' AND (payload->>'idLevel')::integer=$1)", &[&ids[0]]).await?.get::<_,bool>(0));
        client.batch_execute("DELETE FROM zc_jobs.job; CREATE FUNCTION public.reject_fixture_score() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.task='updateLevelScore' THEN RAISE EXCEPTION 'fixture score failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_fixture_score BEFORE INSERT ON zc_jobs.job FOR EACH ROW EXECUTE FUNCTION public.reject_fixture_score()").await?;
        assert!(database.reconcile_missing_workshop_items(&[3]).await.is_err());
        assert!(!client.query_one("SELECT bool_or(deleted) FROM public.level_item WHERE workshop_id=3", &[]).await?.get::<_,bool>(0));
        client.batch_execute("DROP TRIGGER reject_fixture_score ON zc_jobs.job; DROP FUNCTION public.reject_fixture_score()").await?;
        let ids = database.reconcile_missing_workshop_items(&[3]).await?;
        assert_eq!(ids.len(), 2);
        assert_eq!(client.query_one("SELECT count(*) FROM zc_jobs.job WHERE task='updateLevelScore' AND (payload->>'idLevel')::integer=ANY($1)", &[&ids]).await?.get::<_,i64>(0), 2);
        Ok(())
    }.await;
    for root in downloader.roots.lock().unwrap().iter() {
        if root.exists() {
            std::fs::remove_dir_all(root)?;
        }
    }
    outcome
}
