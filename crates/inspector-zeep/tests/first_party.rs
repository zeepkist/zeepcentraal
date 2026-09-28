//! Disposable contest acceptance with in-memory workshop/storage and local HTTP Discord.
use anyhow::{Context, Result, bail, ensure};
use async_trait::async_trait;
use serde_json::{Value, json};
use std::{
    collections::HashMap,
    io::Read,
    sync::{
        Arc,
        atomic::{AtomicBool, AtomicUsize, Ordering},
    },
};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
    sync::Mutex,
};
use zc_core::object_storage::{DownloadConstraints, ObjectStorage};
use zc_database::Database;
use zc_inspector_zeep::{
    config::{InspectorConfig, InspectorOptions},
    discord::DiscordRest,
    run::{InspectorRuntime, run_inspector},
    validation::sha256,
};
use zc_workshop::{
    DownloadedWorkshopItem, WorkshopCatalogPage, WorkshopDownloader, WorkshopItemMetadata,
    WorkshopMetadataAdapter, WorkshopUserItemPage, persistence::DatabaseWorkshopPersistence,
    steamcmd::WorkshopDownload,
};

#[derive(Default)]
struct Storage {
    objects: Mutex<HashMap<String, Vec<u8>>>,
    fail_archive: AtomicBool,
}
#[async_trait]
impl ObjectStorage for Storage {
    async fn upload(&self, key: &str, bytes: Vec<u8>, _: &str) -> Result<()> {
        if key.contains("/workshop/") && self.fail_archive.swap(false, Ordering::SeqCst) {
            bail!("mock archive upload unavailable")
        }
        self.objects.lock().await.insert(key.into(), bytes);
        Ok(())
    }
    async fn download(&self, key: &str, constraints: DownloadConstraints<'_>) -> Result<Vec<u8>> {
        let bytes = self
            .objects
            .lock()
            .await
            .get(key)
            .cloned()
            .context("mock object missing")?;
        ensure!(bytes.len() <= constraints.max_bytes, "mock size bound");
        if let Some(size) = constraints.expected_bytes {
            ensure!(size == bytes.len(), "mock exact size")
        }
        if let Some(digest) = constraints.expected_sha256 {
            ensure!(digest == sha256(&bytes), "mock digest")
        }
        Ok(bytes)
    }
    async fn delete(&self, key: &str) -> Result<()> {
        self.objects.lock().await.remove(key);
        Ok(())
    }
}
struct Metadata {
    item: Mutex<WorkshopItemMetadata>,
    calls: AtomicUsize,
}
#[async_trait]
impl WorkshopMetadataAdapter for Metadata {
    async fn get_items(&self, ids: &[u64]) -> Result<Vec<WorkshopItemMetadata>> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        let item = self.item.lock().await.clone();
        Ok(ids
            .iter()
            .filter(|id| **id == item.workshop_id)
            .map(|_| item.clone())
            .collect())
    }
    async fn list_items(&self, _: &str, _: u32) -> Result<WorkshopCatalogPage> {
        bail!("Catalog discovery forbidden")
    }
    async fn list_user_item_ids(&self, _: u64, _: u32, _: u32) -> Result<WorkshopUserItemPage> {
        bail!("User discovery forbidden")
    }
}
struct Downloader {
    bytes: Mutex<Vec<u8>>,
    calls: AtomicUsize,
    fail: AtomicBool,
    edit: Mutex<Option<(Database, i32, String)>>,
}
#[async_trait]
impl WorkshopDownloader for Downloader {
    async fn download(&self, ids: &[u64]) -> Result<WorkshopDownload> {
        let call = self.calls.fetch_add(1, Ordering::SeqCst);
        if self.fail.swap(false, Ordering::SeqCst) {
            bail!("mock transient download")
        }
        if let Some((db, round, author)) = self.edit.lock().await.take() {
            db.submit_level(round, ids[0] as i64, std::slice::from_ref(&author), &author)
                .await?;
        }
        let root =
            std::env::temp_dir().join(format!("zc-first-party-{}-{call}", std::process::id()));
        tokio::fs::create_dir_all(&root).await?;
        tokio::fs::write(
            root.join("zsl-fixture.zeeplevel"),
            self.bytes.lock().await.as_slice(),
        )
        .await?;
        tokio::fs::write(root.join("zsl-fixture_Thumbnail.jpg"), b"thumbnail-bytes").await?;
        tokio::fs::write(root.join("indexdata.zeepindex"), b"index-bytes").await?;
        Ok(WorkshopDownload::new(
            root.clone(),
            vec![DownloadedWorkshopItem {
                workshop_id: ids[0],
                directory: root,
            }],
        ))
    }
}
#[derive(Default)]
struct Feed {
    messages: HashMap<String, Value>,
    requests: Vec<(String, Value)>,
    uncertain_create: bool,
    rate_limit_edit: bool,
}
async fn discord_mock() -> Result<(DiscordRest, Arc<Mutex<Feed>>, tokio::task::JoinHandle<()>)> {
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let rest = DiscordRest::with_root(
        "fake-test-bot-token".into(),
        format!("http://{}/", listener.local_addr()?).parse()?,
    )?;
    let feed = Arc::new(Mutex::new(Feed::default()));
    let state = feed.clone();
    let task = tokio::spawn(async move {
        loop {
            let Ok((mut socket, _)) = listener.accept().await else {
                break;
            };
            let state = state.clone();
            tokio::spawn(async move {
                let result:Result<()>=async {
    let mut data=Vec::new();let header_end;
    loop {let mut buf=[0;4096];let n=socket.read(&mut buf).await?;if n==0{return Ok(())}data.extend_from_slice(&buf[..n]);if let Some(i)=data.windows(4).position(|w|w==b"\r\n\r\n"){header_end=i+4;break}ensure!(data.len()<65536,"mock request bound");}
    let header=String::from_utf8_lossy(&data[..header_end]).to_string();
    let length=header.lines().find_map(|line|line.to_ascii_lowercase().strip_prefix("content-length:").and_then(|n|n.trim().parse::<usize>().ok())).unwrap_or(0);
    while data.len()<header_end+length {let mut buf=[0;4096];let n=socket.read(&mut buf).await?;ensure!(n>0,"mock body incomplete");data.extend_from_slice(&buf[..n]);}
    let first=header.lines().next().context("mock request line")?;let mut fields=first.split_whitespace();let method=fields.next().unwrap_or("");let path=fields.next().unwrap_or("");
    let payload=if length==0{Value::Null}else{serde_json::from_slice(&data[header_end..header_end+length])?};
    let mut feed=state.lock().await;feed.requests.push((format!("{method} {path}"),payload.clone()));
    let (status,response)=if path=="/users/@me" {(200,json!({"id":"bot"}))}
    else if method=="POST" {
     let id=format!("m{}",feed.messages.len()+1);let mut message=payload;message["id"]=id.clone().into();message["author"]=json!({"id":"bot","bot":true});feed.messages.insert(id,message.clone());
     if feed.uncertain_create {feed.uncertain_create=false;(500,json!({"error":"uncertain"}))}else{(200,message)}
    }else if method=="GET" && path.contains('?'){(200,Value::Array(feed.messages.values().cloned().collect()))}
    else {let id=path.rsplit('/').next().unwrap_or("");if !feed.messages.contains_key(id){(404,json!({"code":10008}))}else if method=="PATCH" {
     if feed.rate_limit_edit{feed.rate_limit_edit=false;(429,json!({"retry_after":2.0}))}else{let mut message=payload;message["id"]=id.into();message["author"]=json!({"id":"bot","bot":true});feed.messages.insert(id.into(),message.clone());(200,message)}
    }else{(200,feed.messages[id].clone())}};
    let response=serde_json::to_vec(&response)?;socket.write_all(format!("HTTP/1.1 {status} Test\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",response.len()).as_bytes()).await?;socket.write_all(&response).await?;Ok(())
   }.await;
                if let Err(e) = result {
                    panic!("mock Discord: {e}")
                }
            });
        }
    });
    Ok((rest, feed, task))
}
fn level() -> Vec<u8> {
    serde_json::to_vec(&json!({"jsonVersion":15,"level":{"UID":"fixture-first-party","name":"Fixture"},"author":{"name":"Author","StmID":"76561198000000001"},"medals":{"author":40,"gold":45,"silver":50,"bronze":60},"blox":(0..3).map(|x|json!({"i":22,"p":{"x":x,"y":0,"z":0},"r":{"x":0,"y":0,"z":0},"s":{"x":1,"y":1,"z":1},"d":{"n":{}}})).collect::<Vec<_>>()})).unwrap()
}

#[tokio::test(flavor = "multi_thread")]
#[ignore = "requires migrated disposable zsl_migration_test; all Steam/Discord/S3 dependencies mocked"]
async fn website_validation_feed_archive_and_final_retry() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/zsl_migration_test",
        "Dedicated disposable DB required"
    );
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move {
        let _ = connection.await;
    });
    let round:i32=client.query_one("INSERT INTO public.zsl_round(id_season,name,round,workshop_id,event_date,submission_start,submission_end,zsl_vote_end,cosmetic_vote_end) VALUES(9000,'Mock integration',2,0,now()+interval '14 days',now()-interval '1 day',now()+interval '1 day',now()+interval '8 days',now()+interval '28 days') RETURNING id",&[]).await?.get(0);
    let author = "76561198000000001".to_owned();
    let db = Database::connect(&url, 6).await?;
    let config=InspectorConfig::parse(&json!({"version":2,"notificationChannelId":"1553911239275585617","contests":[{"roundId":9000,"rules":{"minBlocks":0,"maxBlocks":3000,"minTime":25,"maxTime":60,"minCheckpoints":3}},{"roundId":round,"rules":{"minBlocks":0,"maxBlocks":3000,"minTime":25,"maxTime":60,"minCheckpoints":3}}]}).to_string())?;
    let bytes = level();
    let downloader = Downloader {
        bytes: Mutex::new(bytes.clone()),
        calls: AtomicUsize::new(0),
        fail: AtomicBool::new(false),
        edit: Mutex::new(None),
    };
    let metadata = Metadata {
        item: Mutex::new(WorkshopItemMetadata {
            available: true,
            created_at: "2026-09-01T00:00:00Z".into(),
            creator_id: 76561198000000001,
            file_size: bytes.len() as u64,
            image_url: String::new(),
            name: "Fixture".into(),
            permanent_failure: None,
            updated_at: "2026-09-28T00:00:00Z".into(),
            visibility: 0,
            workshop_id: 3810000001,
        }),
        calls: AtomicUsize::new(0),
    };
    let storage = Arc::new(Storage::default());
    let persistence =
        DatabaseWorkshopPersistence::new(db.clone(), storage.clone(), "mock-thumbnails")?;
    let (discord, feed, task) = discord_mock().await?;
    // Isolate previously exercised fixture outbox. No live data involved.
    client.execute("UPDATE zc_private.level_submission_notification SET delivered_revision=desired_revision,delivered_validation_id=desired_validation_id",&[]).await?;
    let runtime = InspectorRuntime {
        database: &db,
        discord: &discord,
        downloader: &downloader,
        metadata: &metadata,
        storage: storage.as_ref(),
        persistence: &persistence,
    };
    let options = InspectorOptions {
        dry_run: false,
        force: false,
    };
    run_inspector(&runtime, &config, options).await?;
    assert_eq!(downloader.calls.load(Ordering::SeqCst), 0);
    assert!(
        feed.lock().await.requests.is_empty(),
        "No historical backfill"
    );
    let id = db
        .submit_level(round, 3810000001, std::slice::from_ref(&author), &author)
        .await?;
    feed.lock().await.uncertain_create = true;
    run_inspector(&runtime, &config, options).await?;
    let status = db.submission_status(id, &author).await?.unwrap();
    assert_eq!(status["status"], "complete");
    assert_eq!(status["validation"]["valid"], true);
    assert_eq!(feed.lock().await.messages.len(), 1);
    let contest = db.get_inspector_contest(round).await?.unwrap();
    let first = db.get_inspector_submissions(contest.id).await?[0].latest_validation_id;
    assert!(!db.get_inspector_submissions(contest.id).await?[0].inspection_due);
    client.execute("UPDATE zc_private.level_submission_notification SET next_attempt_at=now() WHERE id_submission=$1",&[&id]).await?;
    run_inspector(&runtime, &config, options).await?;
    assert_eq!(
        feed.lock().await.messages.len(),
        1,
        "Uncertain create recovered instead of duplicate"
    );
    let calls = downloader.calls.load(Ordering::SeqCst);
    let edits = feed
        .lock()
        .await
        .requests
        .iter()
        .filter(|(r, _)| r.starts_with("PATCH"))
        .count();
    client
        .execute(
            "UPDATE zc_private.level_submissions SET next_inspection_at=now() WHERE id=$1",
            &[&id],
        )
        .await?;
    run_inspector(&runtime, &config, options).await?;
    assert_eq!(
        downloader.calls.load(Ordering::SeqCst),
        calls,
        "Cached workshop revision skips download"
    );
    assert_eq!(
        db.get_inspector_submissions(contest.id).await?[0].latest_validation_id,
        first
    );
    assert_eq!(
        feed.lock()
            .await
            .requests
            .iter()
            .filter(|(r, _)| r.starts_with("PATCH"))
            .count(),
        edits
    );
    // Workshop ownership mismatch is a completed validation, not a transient failure.
    metadata.item.lock().await.creator_id = 76561198000000002;
    client
        .execute(
            "UPDATE zc_private.level_submissions SET next_inspection_at=now() WHERE id=$1",
            &[&id],
        )
        .await?;
    feed.lock().await.rate_limit_edit = true;
    run_inspector(&runtime, &config, options).await?;
    let invalid = db.submission_status(id, &author).await?.unwrap();
    assert_eq!(invalid["validation"]["valid"], false);
    assert_eq!(
        invalid["validation"]["failures"],
        json!(["workshop-owner-not-listed-as-author"])
    );
    client.execute("UPDATE zc_private.level_submission_notification SET next_attempt_at=now() WHERE id_submission=$1",&[&id]).await?;
    run_inspector(&runtime, &config, options).await?;
    assert_eq!(feed.lock().await.messages.len(), 1);
    db.withdraw_submission(round, &author).await?;
    run_inspector(&runtime, &config, options).await?;
    assert!(
        feed.lock()
            .await
            .messages
            .values()
            .next()
            .unwrap()
            .to_string()
            .contains("Withdrawn")
    );
    metadata.item.lock().await.creator_id = 76561198000000001;
    assert_eq!(
        db.submit_level(round, 3810000001, std::slice::from_ref(&author), &author)
            .await?,
        id
    );
    // Simulate an edit while download is in flight. Old validation cannot commit.
    *downloader.edit.lock().await = Some((db.clone(), round, author.clone()));
    assert!(run_inspector(&runtime, &config, options).await.is_err());
    assert_eq!(
        db.submission_status(id, &author).await?.unwrap()["status"],
        "queued"
    );
    run_inspector(&runtime, &config, options).await?;
    // Deleted feed messages are recreated after the next fresh validation.
    feed.lock().await.messages.clear();
    db.submit_level(round, 3810000001, std::slice::from_ref(&author), &author)
        .await?;
    run_inspector(&runtime, &config, options).await?;
    assert_eq!(feed.lock().await.messages.len(), 1);
    client
        .execute(
            "UPDATE public.zsl_round SET submission_end=now()-interval '1 second' WHERE id=$1",
            &[&round],
        )
        .await?;
    downloader.fail.store(true, Ordering::SeqCst);
    assert!(run_inspector(&runtime, &config, options).await.is_err());
    assert_eq!(
        db.get_inspector_contest(round).await?.unwrap().state,
        "open"
    );
    client
        .execute(
            "UPDATE zc_private.level_submissions SET next_inspection_at=now() WHERE id=$1",
            &[&id],
        )
        .await?;
    client
        .execute(
            "UPDATE zc_private.level_submission_contest SET next_finalization_at=now() WHERE id=$1",
            &[&contest.id],
        )
        .await?;
    storage.fail_archive.store(true, Ordering::SeqCst);
    assert!(run_inspector(&runtime, &config, options).await.is_err());
    assert_eq!(
        db.get_inspector_contest(round).await?.unwrap().state,
        "open"
    );
    client
        .execute(
            "UPDATE zc_private.level_submission_contest SET next_finalization_at=now() WHERE id=$1",
            &[&contest.id],
        )
        .await?;
    run_inspector(&runtime, &config, options).await?;
    assert_eq!(
        db.get_inspector_contest(round).await?.unwrap().state,
        "frozen"
    );
    let archive_row=client.query_one("SELECT archive_object_key,archive_sha256,archive_size FROM zc_private.level_submission_contest WHERE id=$1",&[&contest.id]).await?;
    let key: String = archive_row.get(0);
    let archive = storage.objects.lock().await[&key].clone();
    assert_eq!(sha256(&archive), archive_row.get::<_, String>(1));
    assert_eq!(archive.len() as i64, archive_row.get::<_, i64>(2));
    let mut tar = Vec::new();
    flate2::read::GzDecoder::new(archive.as_slice()).read_to_end(&mut tar)?;
    let mut pos = 0;
    let mut files = HashMap::new();
    while pos + 512 <= tar.len() && tar[pos] != 0 {
        let header = &tar[pos..pos + 512];
        let name = std::str::from_utf8(&header[..100])?
            .trim_end_matches('\0')
            .to_owned();
        let size = usize::from_str_radix(
            std::str::from_utf8(&header[124..136])?.trim_matches(['\0', ' ']),
            8,
        )?;
        files.insert(name, tar[pos + 512..pos + 512 + size].to_vec());
        pos += 512 + size.div_ceil(512) * 512;
    }
    assert_eq!(files["ZSL - fixture/ZSL - fixture.zeeplevel"], bytes);
    assert_eq!(
        files["ZSL - fixture/ZSL - fixture_Thumbnail.jpg"],
        b"thumbnail-bytes"
    );
    assert_eq!(files["ZSL - fixture/indexdata.zeepindex"], b"index-bytes");
    let counts = (
        downloader.calls.load(Ordering::SeqCst),
        metadata.calls.load(Ordering::SeqCst),
    );
    run_inspector(&runtime, &config, options).await?;
    assert_eq!(
        counts,
        (
            downloader.calls.load(Ordering::SeqCst),
            metadata.calls.load(Ordering::SeqCst)
        ),
        "Frozen contests never rescan"
    );
    task.abort();
    Ok(())
}
