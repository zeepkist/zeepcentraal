use anyhow::{Context, Result, bail, ensure};
use async_trait::async_trait;
use serde_json::{Value, json};
use std::{collections::HashMap, sync::Arc};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
    sync::Mutex,
};
use zc_core::object_storage::{DownloadConstraints, ObjectStorage};
use zc_inspector_zeep::{
    discord::DiscordRest, playlist_publication::deliver_playlist_notifications,
};
#[derive(Default)]
struct Storage {
    objects: Mutex<HashMap<String, Vec<u8>>>,
}
#[async_trait]
impl ObjectStorage for Storage {
    async fn upload(&self, key: &str, bytes: Vec<u8>, _: &str) -> Result<()> {
        self.objects.lock().await.insert(key.into(), bytes);
        Ok(())
    }
    async fn download(&self, key: &str, limit: DownloadConstraints<'_>) -> Result<Vec<u8>> {
        let bytes = self
            .objects
            .lock()
            .await
            .get(key)
            .cloned()
            .context("Missing mock playlist")?;
        ensure!(bytes.len() <= limit.max_bytes, "Size bound");
        Ok(bytes)
    }
    async fn delete(&self, _: &str) -> Result<()> {
        bail!("Unexpected storage deletion")
    }
}
#[derive(Default)]
struct Feed {
    messages: HashMap<String, Value>,
    requests: Vec<(String, Vec<u8>)>,
    serial: usize,
    uncertain: bool,
    delete_status: Option<u16>,
    post_status: Option<u16>,
}
async fn mock() -> Result<(DiscordRest, Arc<Mutex<Feed>>, tokio::task::JoinHandle<()>)> {
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let rest = DiscordRest::with_root(
        "fake-bot-token".into(),
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
                let mut data = Vec::new();
                let header_end;
                loop {
                    let mut chunk = [0; 4096];
                    let n = socket.read(&mut chunk).await.unwrap();
                    if n == 0 {
                        return;
                    };
                    data.extend_from_slice(&chunk[..n]);
                    if let Some(i) = data.windows(4).position(|w| w == b"\r\n\r\n") {
                        header_end = i + 4;
                        break;
                    }
                }
                let header = String::from_utf8_lossy(&data[..header_end]).into_owned();
                let length = header
                    .lines()
                    .find_map(|line| {
                        line.to_ascii_lowercase()
                            .strip_prefix("content-length:")
                            .and_then(|n| n.trim().parse::<usize>().ok())
                    })
                    .unwrap_or(0);
                while data.len() < header_end + length {
                    let mut chunk = [0; 4096];
                    let n = socket.read(&mut chunk).await.unwrap();
                    assert!(n > 0);
                    data.extend_from_slice(&chunk[..n]);
                }
                let mut first = header.lines().next().unwrap().split_whitespace();
                let method = first.next().unwrap();
                let path = first.next().unwrap();
                let body = data[header_end..header_end + length].to_vec();
                let mut state = state.lock().await;
                state
                    .requests
                    .push((format!("{method} {path}"), body.clone()));
                let channel = path.split('/').nth(2).unwrap_or("");
                let (status, response) = if path == "/users/@me" {
                    (200, json!({"id":"bot"}))
                } else if method == "DELETE" {
                    if let Some(status) = state.delete_status.take() {
                        (status, json!({"retry_after":2}))
                    } else {
                        let id = path.rsplit('/').next().unwrap();
                        if state.messages.remove(id).is_some() {
                            (204, Value::Null)
                        } else {
                            (404, json!({"code":10008}))
                        }
                    }
                } else if method == "POST" {
                    if let Some(status) = state.post_status.take() {
                        (status, json!({"retry_after":2}))
                    } else {
                        let text = String::from_utf8_lossy(&body);
                        let start = text.find("{\"").unwrap();
                        let end = text[start..].find("\r\n--").unwrap() + start;
                        let mut payload: Value = serde_json::from_str(&text[start..end]).unwrap();
                        state.serial += 1;
                        let id = state.serial.to_string();
                        payload["id"] = id.clone().into();
                        payload["author"] = json!({"id":"bot"});
                        payload["channel_id"] = channel.into();
                        state.messages.insert(id, payload.clone());
                        if state.uncertain {
                            state.uncertain = false;
                            (500, json!({"error":"uncertain"}))
                        } else {
                            (200, payload)
                        }
                    }
                } else {
                    (
                        200,
                        Value::Array(
                            state
                                .messages
                                .values()
                                .filter(|m| m["channel_id"] == channel)
                                .cloned()
                                .collect(),
                        ),
                    )
                };
                let response = if status == 204 {
                    Vec::new()
                } else {
                    serde_json::to_vec(&response).unwrap()
                };
                socket.write_all(format!("HTTP/1.1 {status} Test\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",response.len()).as_bytes()).await.unwrap();
                socket.write_all(&response).await.unwrap();
            });
        }
    });
    Ok((rest, feed, task))
}
async fn publish(
    client: &tokio_postgres::Client,
    storage: &Storage,
    contest: i64,
    count: i32,
    digest: &str,
) -> Result<i64> {
    let key = format!("inspector/{contest}/{digest}.zeeplist");
    let artifact = json!({"name":"Fixture","amountOfLevels":count,"roundLength":480,"shufflePlaylist":false,"UID":if count>0{vec!["fixture"]}else{vec![]},"levels":if count>0{vec![json!({"UID":"fixture","WorkshopID":123,"Name":"Fixture","Author":"Alice"})]}else{vec![]}});
    storage
        .upload(&key, serde_json::to_vec(&artifact)?, "application/json")
        .await?;
    let id:i64=client.query_one("INSERT INTO zc_private.level_submission_playlist(id_contest,digest,valid_count,object_key) VALUES($1,$2,$3,$4) RETURNING id",&[&contest,&digest,&count,&key]).await?.get(0);
    client
        .execute(
            "UPDATE zc_private.level_submission_contest SET current_playlist_id=$2 WHERE id=$1",
            &[&contest, &id],
        )
        .await?;
    Ok(id)
}
#[tokio::test]
#[ignore = "requires local zsl_submission_playlist_test initialized by submission_overview test"]
async fn replacement_empty_retry_recovery_and_channels() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1")
            && (parsed.path() == "/zsl_submission_playlist_test"
                || parsed
                    .path()
                    .strip_prefix("/zsl_submission_playlist_test_")
                    .is_some_and(
                        |suffix| !suffix.is_empty() && suffix.bytes().all(|c| c.is_ascii_digit())
                    )),
        "Disposable fixture required"
    );
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move {
        let _ = connection.await;
    });
    client.batch_execute("INSERT INTO public.zsl_round(id,id_season,name,round,event_date) VALUES(30,1,'Discord fixture',30,now()),(31,1,'Other Discord fixture',31,now());").await?;
    let contest: i64 = client
        .query_one(
            "INSERT INTO zc_private.level_submission_contest(id_zsl_round) VALUES(30) RETURNING id",
            &[],
        )
        .await?
        .get(0);
    let other: i64 = client
        .query_one(
            "INSERT INTO zc_private.level_submission_contest(id_zsl_round) VALUES(31) RETURNING id",
            &[],
        )
        .await?
        .get(0);
    let database = zc_database::Database::connect(&url, 2).await?;
    let storage = Storage::default();
    let (discord, feed, task) = mock().await?;
    let deliver = || deliver_playlist_notifications(&database, &discord, &storage, "123", &[30]);
    publish(&client, &storage, contest, 0, "empty-initial").await?;
    deliver().await?;
    assert!(feed.lock().await.requests.is_empty());
    let first = publish(&client, &storage, contest, 1, "first").await?;
    deliver().await?;
    assert_eq!(feed.lock().await.messages.len(), 1);
    let body = feed.lock().await.requests.last().unwrap().1.clone();
    let text = String::from_utf8_lossy(&body);
    assert!(text.contains("name=\"files[0]\""));
    assert!(text.contains(".zeeplist"));
    assert!(text.contains("\"WorkshopID\":123"));
    let requests = feed.lock().await.requests.len();
    deliver().await?;
    assert_eq!(
        requests,
        feed.lock().await.requests.len(),
        "Unchanged playlist stays quiet"
    );
    publish(&client, &storage, contest, 1, "updated").await?;
    feed.lock().await.delete_status = Some(429);
    deliver().await?;
    assert_eq!(
        feed.lock().await.messages.len(),
        1,
        "Failed deletion preserves existing post"
    );
    client.execute("UPDATE zc_private.level_submission_playlist_notification SET next_attempt_at=now() WHERE id_contest=$1",&[&contest]).await?;
    feed.lock().await.uncertain = true;
    deliver().await?;
    assert_eq!(feed.lock().await.messages.len(), 1);
    client.execute("UPDATE zc_private.level_submission_playlist_notification SET next_attempt_at=now() WHERE id_contest=$1",&[&contest]).await?;
    let posts = feed
        .lock()
        .await
        .requests
        .iter()
        .filter(|(r, _)| r.starts_with("POST"))
        .count();
    deliver().await?;
    assert_eq!(feed.lock().await.messages.len(), 1);
    assert_eq!(
        posts,
        feed.lock()
            .await
            .requests
            .iter()
            .filter(|(r, _)| r.starts_with("POST"))
            .count(),
        "Recover uncertain POST without duplicate"
    );
    let current:i64=client.query_one("SELECT delivered_playlist_id FROM zc_private.level_submission_playlist_notification WHERE id_contest=$1",&[&contest]).await?.get(0);
    assert_ne!(first, current);
    // Channel move deletes old tracked post and creates new post.
    deliver_playlist_notifications(&database, &discord, &storage, "456", &[30]).await?;
    assert_eq!(
        feed.lock().await.messages.values().next().unwrap()["channel_id"],
        "456"
    );
    // Missing attachment must not delete current post.
    let missing = publish(&client, &storage, contest, 1, "missing").await?;
    storage.objects.lock().await.clear();
    deliver_playlist_notifications(&database, &discord, &storage, "456", &[30]).await?;
    assert_eq!(feed.lock().await.messages.len(), 1);
    assert_ne!(client.query_one("SELECT delivered_playlist_id FROM zc_private.level_submission_playlist_notification WHERE id_contest=$1",&[&contest]).await?.get::<_,i64>(0),missing);
    // Last entry removal deletes post. Missing Discord message is accepted.
    publish(&client, &storage, contest, 0, "empty-final").await?;
    feed.lock().await.messages.clear();
    deliver_playlist_notifications(&database, &discord, &storage, "456", &[30]).await?;
    assert!(feed.lock().await.messages.is_empty());
    publish(&client, &storage, contest, 1, "restored").await?;
    feed.lock().await.post_status = Some(429);
    deliver_playlist_notifications(&database, &discord, &storage, "456", &[30]).await?;
    assert!(
        feed.lock().await.messages.is_empty(),
        "Rate-limited upload remains pending"
    );
    client.execute("UPDATE zc_private.level_submission_playlist_notification SET next_attempt_at=now() WHERE id_contest=$1", &[&contest]).await?;
    deliver_playlist_notifications(&database, &discord, &storage, "456", &[30]).await?;
    assert_eq!(
        feed.lock().await.messages.len(),
        1,
        "Failed send recovers and retries"
    );
    publish(&client, &storage, other, 1, "other").await?;
    deliver_playlist_notifications(&database, &discord, &storage, "456", &[30, 31]).await?;
    assert_eq!(feed.lock().await.messages.len(), 2);
    // Uncertain attempt superseded by another publication is recovered and removed first.
    publish(&client, &storage, contest, 1, "uncertain-old").await?;
    feed.lock().await.uncertain = true;
    deliver_playlist_notifications(&database, &discord, &storage, "456", &[30]).await?;
    publish(&client, &storage, contest, 0, "superseded-empty").await?;
    deliver_playlist_notifications(&database, &discord, &storage, "456", &[30]).await?;
    assert_eq!(feed.lock().await.messages.len(), 1);
    task.abort();
    Ok(())
}
