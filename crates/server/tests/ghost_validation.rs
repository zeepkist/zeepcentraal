#[path = "support/ghost_validation.rs"]
mod support;

use anyhow::{Result, bail, ensure};
use async_trait::async_trait;
use axum::{
    Router,
    body::{Body, to_bytes},
    http::{Request, StatusCode},
};
use base64::Engine;
use serde_json::{Value, json};
use std::sync::{
    Arc, Mutex,
    atomic::{AtomicBool, AtomicUsize, Ordering},
};
use tower::ServiceExt;
use zc_core::{
    jwt::Provider,
    object_storage::{DownloadConstraints, ObjectStorage},
};

#[derive(Default)]
struct Storage {
    failing: AtomicBool,
    uploads: AtomicUsize,
    download_failing: AtomicBool,
    bytes: Mutex<Vec<u8>>,
}
#[async_trait]
impl ObjectStorage for Storage {
    async fn upload(&self, _: &str, bytes: Vec<u8>, _: &str) -> Result<()> {
        self.uploads.fetch_add(1, Ordering::SeqCst);
        if self.failing.load(Ordering::SeqCst) {
            bail!("fixture storage failure");
        }
        *self.bytes.lock().unwrap() = bytes;
        Ok(())
    }
    async fn download(&self, _: &str, _: DownloadConstraints<'_>) -> Result<Vec<u8>> {
        if self.download_failing.load(Ordering::SeqCst) {
            bail!("fixture download unavailable");
        }
        Ok(self.bytes.lock().unwrap().clone())
    }
    async fn delete(&self, _: &str) -> Result<()> {
        bail!("Acceptance must not clean up objects");
    }
}
async fn request(
    app: &Router,
    method: &str,
    path: &str,
    token: &str,
    body: Value,
) -> Result<(StatusCode, Value)> {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(method)
                .uri(path)
                .header("Authorization", format!("Bearer {token}"))
                .header("Content-Type", "application/json")
                .body(if method == "GET" {
                    Body::empty()
                } else {
                    Body::from(serde_json::to_vec(&body)?)
                })?,
        )
        .await?;
    let status = response.status();
    let bytes = to_bytes(response.into_body(), 2_000_000).await?;
    Ok((
        status,
        if bytes.is_empty() {
            Value::Null
        } else {
            serde_json::from_slice(&bytes)?
        },
    ))
}

#[tokio::test]
#[ignore = "requires fresh isolated ghost_validation_http_test with fixture, validation migration, and user-role migration"]
async fn durable_acceptance_retries_identity_and_private_admin_evidence() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1")
            && matches!(
                parsed.path(),
                "/ghost_validation_http_test"
                    | "/ghost_validation_legacy_http_test"
                    | "/ghost_validation_legacy_http_test_2"
                    | "/ghost_validation_discord_http_test"
                    | "/ghost_validation_mutable_http_test"
            ),
        "Dedicated local fixture DB required"
    );
    let storage = Arc::new(Storage::default());
    storage.failing.store(true, Ordering::SeqCst);
    let state = support::state(&url, storage.clone(), true)?;
    let user = state.database.get_or_insert_user(42).await?;
    state.database.get_or_insert_user(43).await?;
    let token = state
        .config
        .jwt
        .issue(Provider::Gtr, "42", None)?
        .access_token;
    let steam = state
        .config
        .jwt
        .issue(Provider::Steam, "42", None)?
        .access_token;
    let other = state
        .config
        .jwt
        .issue(Provider::Gtr, "43", None)?
        .access_token;
    let discord = state
        .config
        .jwt
        .issue(Provider::Discord, "42", Some("1234"))?
        .access_token;
    let app = zc_server::app::router(state.clone())?;
    let fixture: Value =
        serde_json::from_str(include_str!("../../../test/fixtures/ghost-v8.json"))?;
    let bytes = hex::decode(fixture["lzmaHex"].as_str().unwrap())?;
    let body = json!({"Level":"fixture-legacy","Hash":"A".repeat(32),"Time":1.22,"Splits":[],"Speeds":[],"GameVersion":"18.2","ModVersion":"99.0.0","GhostData":base64::engine::general_purpose::STANDARD.encode(&bytes)});
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("fixture connection") });
    assert_eq!(
        request(&app, "GET", "/admin/ghost-validation", &steam, Value::Null)
            .await?
            .0,
        StatusCode::FORBIDDEN
    );
    client
        .execute(
            "UPDATE public.\"user\" SET role='admin' WHERE id=$1",
            &[&user.id],
        )
        .await?;
    let counts = || async {
        Ok::<_,anyhow::Error>(client.query_one("SELECT (SELECT count(*) FROM public.record),(SELECT count(*) FROM public.personal_best_global),(SELECT count(*) FROM zc_private.record_run)", &[]).await?)
    };
    let failed = request(&app, "POST", "/record/submit", &token, body.clone()).await?;
    assert_eq!(failed.0, StatusCode::SERVICE_UNAVAILABLE);
    let row = counts().await?;
    assert_eq!(
        (
            row.get::<_, i64>(0),
            row.get::<_, i64>(1),
            row.get::<_, i64>(2)
        ),
        (0, 0, 0)
    );
    storage.failing.store(false, Ordering::SeqCst);
    assert_eq!(
        request(&app, "POST", "/record/submit", &token, body.clone()).await?,
        (StatusCode::OK, Value::Null)
    );
    assert_eq!(*storage.bytes.lock().unwrap(), bytes);
    assert_eq!(
        request(&app, "POST", "/record/submit", &token, body.clone()).await?,
        (StatusCode::OK, Value::Null)
    );
    assert_eq!(storage.uploads.load(Ordering::SeqCst), 2);
    let mut changed = body.clone();
    changed["Time"] = json!(1.24);
    let rejection = request(&app, "POST", "/record/submit", &token, changed).await?;
    assert_eq!(rejection.0, StatusCode::BAD_REQUEST);
    assert_eq!(rejection.1["errorCode"], 20);
    let rejection = request(&app, "POST", "/record/submit", &other, body.clone()).await?;
    assert_eq!(rejection.0, StatusCode::BAD_REQUEST);
    assert_eq!(rejection.1["errorCode"], 20);
    assert_eq!(storage.uploads.load(Ordering::SeqCst), 2);
    let row = counts().await?;
    assert_eq!(
        (
            row.get::<_, i64>(0),
            row.get::<_, i64>(1),
            row.get::<_, i64>(2)
        ),
        (1, 1, 1)
    );
    assert_eq!(
        client
            .query_one("SELECT count(*) FROM zc_private.record_validation", &[])
            .await?
            .get::<_, i64>(0),
        1
    );
    let record: i32 = client
        .query_one("SELECT id FROM public.record WHERE id_user=$1", &[&user.id])
        .await?
        .get(0);
    let path = format!("/admin/ghost-validation/records/{record}");
    assert_eq!(
        request(&app, "GET", &path, &other, Value::Null).await?.0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        request(&app, "GET", &path, &discord, Value::Null).await?.0,
        StatusCode::OK
    );
    for route in [
        path.as_str(),
        "/admin/ghost-validation?after=0&status=fail&history=false",
    ] {
        assert_eq!(
            request(&app, "GET", route, &discord, Value::Null).await?.0,
            StatusCode::OK
        );
    }
    assert_eq!(
        request(&app, "GET", &path, &token, Value::Null).await?.0,
        StatusCode::FORBIDDEN
    );
    let wrong_discord = state
        .config
        .jwt
        .issue(Provider::Discord, "43", Some("5678"))?
        .access_token;
    assert_eq!(
        request(&app, "GET", &path, &wrong_discord, Value::Null)
            .await?
            .0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        request(&app, "GET", &path, "forged", Value::Null).await?.0,
        StatusCode::UNAUTHORIZED
    );
    let review = request(&app, "GET", &path, &steam, Value::Null).await?;
    assert_eq!(review.0, StatusCode::OK);
    assert_eq!(review.1["attempts"][0]["status"], "uncertain");
    client
        .execute(
            "UPDATE public.\"user\" SET banned=true WHERE id=$1",
            &[&user.id],
        )
        .await?;
    assert_eq!(
        request(&app, "GET", &path, &steam, Value::Null).await?.0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        request(&app, "GET", &path, &discord, Value::Null).await?.0,
        StatusCode::FORBIDDEN
    );
    client
        .execute(
            "UPDATE public.\"user\" SET banned=false,role='user' WHERE id=$1",
            &[&user.id],
        )
        .await?;
    assert_eq!(
        request(&app, "GET", &path, &steam, Value::Null).await?.0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        request(&app, "GET", &path, &discord, Value::Null).await?.0,
        StatusCode::FORBIDDEN
    );
    client
        .execute(
            "UPDATE public.\"user\" SET role='admin' WHERE id=$1",
            &[&user.id],
        )
        .await?;
    let ghost = request(&app, "GET", &format!("{path}/ghost"), &steam, Value::Null).await?;
    assert_eq!(ghost.0, StatusCode::OK);
    assert_eq!(
        base64::engine::general_purpose::STANDARD.decode(ghost.1["ghost"].as_str().unwrap())?,
        bytes
    );
    let observe = support::state(&url, storage.clone(), false)?;
    let observe = zc_server::app::router(observe)?;
    assert_eq!(
        request(&observe, "POST", "/record/submit", &other, body)
            .await?
            .0,
        StatusCode::OK
    );
    assert_eq!(client.query_one("SELECT status FROM zc_private.record_validation WHERE id_record=(SELECT id FROM public.record WHERE id_user<>$1)",&[&user.id]).await?.get::<_,String>(0),"fail");
    let auditor = zc_jobs::ghost_audit::GhostAuditService::new(
        state.database.clone(),
        state.queue.clone(),
        storage.clone(),
    );
    let eligibility = || async {
        Ok::<_,anyhow::Error>(client.query_one("SELECT jsonb_build_object('records',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public.record r),'personalBests',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.personal_best_global p),'worldRecords',(SELECT jsonb_agg(to_jsonb(w) ORDER BY id) FROM public.world_record_global w))::text", &[]).await?.get::<_,String>(0))
    };
    let before = eligibility().await?;
    // Outages replace assigned results while keeping repair retryable.
    let blocks = json!([]);
    let hash = zc_core::levels::calculate_json_level_xxhash(&json!({"blox":blocks}).to_string())?;
    let candidate = state
        .database
        .resolve_submission_level("fixture-candidate", &hash, true)
        .await?;
    let assigned = state.database.audit_record(record).await?.unwrap().id_level;
    client.execute("INSERT INTO public.level_metadata(id_level,format,blocks) VALUES($1,1,$2::text::jsonb)", &[&candidate.id,&blocks.to_string()]).await?;
    for level in [assigned, candidate.id] {
        client.execute("INSERT INTO public.level_item(id_level,workshop_id,file_uid) VALUES($1,123,'untrusted-fixture')", &[&level]).await?;
    }
    let mut old_candidate = zc_core::ghost_validation::ValidationReport::failed("invalid_splits");
    old_candidate.validator_version = "geometry-6".into();
    state
        .database
        .save_record_validation(record, None, &old_candidate)
        .await?;
    let comparison_path = format!("{path}/compare");
    let unchanged = state.database.record_validation_attempts(record).await?;
    for level in [assigned, candidate.id] {
        for credential in [&steam, &discord] {
            let (status, result) = request(
                &app,
                "POST",
                &comparison_path,
                credential,
                json!({"idLevel":level}),
            )
            .await?;
            assert_eq!(status, StatusCode::OK);
            assert_eq!(result["report"]["comparison"], true);
        }
    }
    assert_eq!(
        request(
            &app,
            "POST",
            &comparison_path,
            &steam,
            json!({"idLevel":i32::MAX})
        )
        .await?
        .0,
        StatusCode::BAD_REQUEST
    );
    assert_eq!(
        request(
            &app,
            "POST",
            &comparison_path,
            &other,
            json!({"idLevel":candidate.id})
        )
        .await?
        .0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        state.database.record_validation_attempts(record).await?,
        unchanged,
        "comparisons must not persist"
    );
    storage.download_failing.store(true, Ordering::SeqCst);
    assert_eq!(
        request(
            &app,
            "POST",
            &comparison_path,
            &steam,
            json!({"idLevel":candidate.id})
        )
        .await?
        .0,
        StatusCode::SERVICE_UNAVAILABLE
    );
    assert_eq!(
        state.database.record_validation_attempts(record).await?,
        unchanged
    );

    assert!(
        auditor
            .validate_record_ghost(&json!({"idRecord":record}))
            .await
            .is_err()
    );
    let attempts = state.database.record_validation_attempts(record).await?;
    assert_eq!(attempts[0]["status"], "uncertain");
    assert_eq!(
        attempts[0]["report"]["reasons"][0],
        "ghost_storage_unavailable"
    );
    assert!(
        state
            .database
            .admin_validations(0, Some(record), Some("fail"), &json!({}))
            .await?
            .is_empty()
    );
    assert_eq!(
        state
            .database
            .audit_record_ids(&json!({"idRecord":record,"reasons":["invalid_splits"]}))
            .await?,
        vec![record]
    );
    storage.download_failing.store(false, Ordering::SeqCst);
    auditor
        .validate_record_ghost(&json!({"idRecord":record}))
        .await?;
    auditor
        .validate_record_ghost(&json!({"idRecord":record}))
        .await?;
    assert_eq!(
        eligibility().await?,
        before,
        "audits must preserve dates, associations, times and leaderboard eligibility"
    );
    let historical: i32 = client
        .query_one("SELECT id_level FROM public.record WHERE id=$1", &[&record])
        .await?
        .get(0);
    client.execute("INSERT INTO public.record(id_user,id_level,time,game_version,mod_version,splits,speeds) SELECT $1,$2,2,'test','test',NULL,NULL FROM generate_series(1,205)", &[&user.id,&historical]).await?;
    let mut filter =
        json!({"idLevel":historical,"from":"2020-01-01T00:00:00Z","to":"2090-01-01T00:00:00Z"});
    let mut all = Vec::new();
    loop {
        let page = state.database.audit_record_ids(&filter).await?;
        assert!(page.len() <= 100);
        if page.is_empty() {
            break;
        }
        let last = *page.last().unwrap();
        assert!(page.windows(2).all(|pair| pair[0] < pair[1]));
        all.extend(page);
        filter["afterId"] = json!(last);
    }
    assert_eq!(all.len(), 207);
    assert!(
        all.windows(2).all(|pair| pair[0] < pair[1]),
        "continuations cannot duplicate or omit records"
    );
    let missing = *all.last().unwrap();
    let legacy = state.database.audit_record(missing).await?.unwrap();
    assert!(legacy.splits.is_empty() && legacy.speeds.is_empty());
    let before_missing = eligibility().await?;
    auditor
        .validate_record_ghost(&json!({"idRecord":missing}))
        .await?;
    assert_eq!(
        state.database.record_validation_attempts(missing).await?[0]["report"]["reasons"][0],
        "missing_ghost"
    );
    assert_eq!(
        state.database.record_validation_attempts(missing).await?[0]["status"],
        "fail"
    );
    assert_eq!(eligibility().await?, before_missing);
    client
        .execute(
            "INSERT INTO public.record_media(id_record,ghost_url) VALUES($1,'  ')",
            &[&missing],
        )
        .await?;
    auditor
        .validate_record_ghost(&json!({"idRecord":missing}))
        .await?;
    let (status, current) = request(
        &app,
        "GET",
        &format!("/admin/ghost-validation?record={missing}&status=fail"),
        &steam,
        Value::Null,
    )
    .await?;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(current["attempts"].as_array().unwrap().len(), 1);
    let (status, history) = request(
        &app,
        "GET",
        &format!("/admin/ghost-validation?record={missing}&history=true&status=fail"),
        &steam,
        Value::Null,
    )
    .await?;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(history, current);
    Ok(())
}
