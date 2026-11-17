#[path = "support/ghost_validation.rs"]
mod support;

use anyhow::Result;
use async_trait::async_trait;
use axum::{
    body::{Body, to_bytes},
    http::{Request, StatusCode},
};
use opentelemetry::{KeyValue, trace::TracerProvider as _};
use opentelemetry_sdk::trace::{InMemorySpanExporter, SdkTracerProvider};
use std::sync::Arc;
use tower::ServiceExt;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use zc_core::{
    jwt::Provider,
    object_storage::{DownloadConstraints, ObjectStorage},
};

struct NoStorage;
#[async_trait]
impl ObjectStorage for NoStorage {
    async fn upload(&self, _: &str, _: Vec<u8>, _: &str) -> Result<()> {
        anyhow::bail!("unused")
    }
    async fn download(&self, _: &str, _: DownloadConstraints<'_>) -> Result<Vec<u8>> {
        anyhow::bail!("unused")
    }
    async fn delete(&self, _: &str) -> Result<()> {
        anyhow::bail!("unused")
    }
}

#[tokio::test]
async fn gtr_errors_and_headers_preserve_http_contracts() -> Result<()> {
    let exporter = InMemorySpanExporter::default();
    let provider = SdkTracerProvider::builder()
        .with_simple_exporter(exporter.clone())
        .build();
    let _subscriber = tracing_subscriber::registry()
        .with(tracing_opentelemetry::layer().with_tracer(provider.tracer("server-mod-test")))
        .set_default();
    let state = support::state(
        "postgres://fake:fake@127.0.0.1:1/fake",
        Arc::new(NoStorage),
        false,
    )?;
    // Invalid Steam ID ensures shared routes fail after token verification, before DB access.
    let gtr = state
        .config
        .jwt
        .issue(Provider::Gtr, "invalid", None)?
        .access_token;
    let browser = state
        .config
        .jwt
        .issue(Provider::Steam, "invalid", None)?
        .access_token;
    let app = zc_server::app::router(state)?;
    let cases = [
        (
            "/auth/login",
            r#"{"ModVersion":"","SteamId":"","AuthenticationTicket":""}"#,
            None,
            8,
            true,
        ),
        (
            "/auth/refresh",
            r#"{"ModVersion":"","SteamId":"","LoginToken":"","RefreshToken":""}"#,
            None,
            8,
            true,
        ),
        (
            "/level/request",
            r#"{"WorkshopId":"1","Hash":"x"}"#,
            None,
            14,
            true,
        ),
        (
            "/level/request",
            r#"{"WorkshopId":"1","Hash":"x"}"#,
            Some("invalid"),
            15,
            true,
        ),
        (
            "/user/updateSteamName",
            r#"{"Name":"test"}"#,
            None,
            14,
            true,
        ),
        (
            "/record/submit",
            r#"{"Level":"","Hash":"","Time":0,"Splits":[],"Speeds":[],"GhostData":"","GameVersion":"","ModVersion":""}"#,
            None,
            19,
            true,
        ),
        (
            "/user/updateDiscordId",
            r#"{"Id":"1"}"#,
            Some(gtr.as_str()),
            16,
            true,
        ),
        (
            "/user/updateDiscordId",
            r#"{"Id":"1"}"#,
            Some(browser.as_str()),
            16,
            false,
        ),
        (
            "/user/updateDiscordId",
            r#"{"Id":"1"}"#,
            Some("invalid"),
            15,
            false,
        ),
    ];
    for (path, body, token, code, is_gtr) in cases {
        let mut request = Request::builder()
            .method("POST")
            .uri(path)
            .header("content-type", "application/json");
        if let Some(token) = token {
            request = request.header("authorization", format!("Bearer {token}"));
        }
        let response = app.clone().oneshot(request.body(Body::from(body))?).await?;
        assert!(
            matches!(
                response.status(),
                StatusCode::BAD_REQUEST | StatusCode::UNAUTHORIZED
            ),
            "{path}: unexpected status {}",
            response.status()
        );
        assert_eq!(
            response.headers()["content-type"],
            "application/problem+json"
        );
        let body: serde_json::Value =
            serde_json::from_slice(&to_bytes(response.into_body(), 4096).await?)?;
        assert_eq!(body["errorCode"], code);
        provider.force_flush()?;
        let spans = exporter.get_finished_spans()?;
        let span = spans
            .iter()
            .rev()
            .find(|span| span.name == format!("POST {path}"))
            .unwrap();
        assert_eq!(
            span.attributes
                .iter()
                .find(|attribute| attribute.key.as_str() == "mod.errorCode"),
            is_gtr.then_some(&KeyValue::new("mod.errorCode", i64::from(code)))
        );
        assert!(!span.attributes.iter().any(|attribute| matches!(
            attribute.key.as_str(),
            "mod.outdated" | "mod.version" | "mod.steamId"
        )));
        if path == "/record/submit" && code == 19 {
            assert!(span.attributes.contains(&KeyValue::new("record.Level", "")));
            assert!(span.attributes.contains(&KeyValue::new("record.Time", 0.0)));
            assert!(
                span.attributes
                    .contains(&KeyValue::new("record.GhostData", "[redacted]"))
            );
            let reasons = span
                .attributes
                .iter()
                .find(|a| a.key.as_str() == "record.validationErrors")
                .unwrap();
            let opentelemetry::Value::String(reasons) = &reasons.value else {
                panic!("JSON reasons expected")
            };
            let reasons: Vec<String> = serde_json::from_str(reasons.as_str())?;
            assert_eq!(
                reasons,
                [
                    "Level.empty",
                    "Hash.invalid",
                    "Time.invalid",
                    "GhostData.empty",
                    "GameVersion.empty",
                    "ModVersion.empty"
                ]
            );
        } else {
            assert!(
                !span
                    .attributes
                    .iter()
                    .any(|a| a.key.as_str().starts_with("record."))
            );
        }
    }
    for path in ["/healthz", "/missing"] {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri(path)
                    .header("X-GtR-Version", "2.0.0")
                    .header("X-Steam-ID", "76561198000000001")
                    .body(Body::empty())?,
            )
            .await?;
        assert_eq!(
            response.status(),
            if path == "/healthz" {
                StatusCode::OK
            } else {
                StatusCode::NOT_FOUND
            }
        );
        provider.force_flush()?;
        let spans = exporter.get_finished_spans()?;
        let span = spans
            .iter()
            .rev()
            .find(|span| span.name.starts_with("GET "))
            .unwrap();
        assert!(
            span.attributes
                .contains(&KeyValue::new("mod.version", "2.0.0"))
        );
        assert!(
            span.attributes
                .contains(&KeyValue::new("mod.steamId", "76561198000000001"))
        );
        assert!(
            !span
                .attributes
                .iter()
                .any(|attribute| attribute.key.as_str().starts_with("graphql.header."))
        );
    }
    Ok(())
}
