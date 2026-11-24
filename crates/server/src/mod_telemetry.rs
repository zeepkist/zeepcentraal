use axum::{
    extract::{MatchedPath, Request},
    http::Method,
    middleware::Next,
    response::Response,
};
use std::{
    cell::{Cell, RefCell},
    collections::BTreeMap,
};

struct RequestContext {
    span: tracing::Span,
    gtr: Cell<bool>,
    record_submit: bool,
    submission: RefCell<Option<RecordSubmissionDiagnostics>>,
}

const STRING_LIMIT: usize = 1024;
const ARRAY_LIMIT: usize = 256;

pub(super) struct RecordSubmissionDiagnostics {
    strings: Vec<(&'static str, String)>,
    arrays: Vec<(&'static str, Vec<f32>)>,
    time: f64,
    ghost_length: usize,
    unset: Vec<&'static str>,
    truncated: Vec<&'static str>,
    original_lengths: BTreeMap<&'static str, usize>,
    validation_errors: Vec<&'static str>,
}

impl RecordSubmissionDiagnostics {
    pub(super) fn new(time: f32, ghost_length: usize) -> Self {
        Self {
            strings: Vec::new(),
            arrays: Vec::new(),
            time: f64::from(time),
            ghost_length,
            unset: Vec::new(),
            truncated: Vec::new(),
            original_lengths: BTreeMap::new(),
            validation_errors: Vec::new(),
        }
    }

    pub(super) fn string(&mut self, key: &'static str, field: &'static str, value: Option<&str>) {
        if let Some(value) = value {
            let length = value.chars().count();
            if length > STRING_LIMIT {
                self.truncated.push(field);
                self.original_lengths.insert(field, length);
            }
            self.strings
                .push((key, value.chars().take(STRING_LIMIT).collect()));
        } else {
            self.unset.push(field);
        }
    }

    pub(super) fn array(&mut self, key: &'static str, field: &'static str, value: &[f32]) {
        if value.len() > ARRAY_LIMIT {
            self.truncated.push(field);
            self.original_lengths.insert(field, value.len());
        }
        self.arrays
            .push((key, value[..value.len().min(ARRAY_LIMIT)].to_vec()));
    }

    fn record(&self, span: &tracing::Span) {
        for (key, value) in &self.strings {
            span.record(*key, value.as_str());
        }
        for (key, value) in &self.arrays {
            span.record(
                *key,
                serde_json::to_string(value).expect("numeric diagnostics serialize"),
            );
        }
        span.record("record.Time", self.time);
        span.record("record.GhostData", "[redacted]");
        span.record(
            "record.GhostDataLength",
            i64::try_from(self.ghost_length).expect("string length fits i64"),
        );
        for (key, values) in [
            ("record.unsetFields", &self.unset),
            ("record.truncatedFields", &self.truncated),
            ("record.validationErrors", &self.validation_errors),
        ] {
            if !values.is_empty() {
                span.record(
                    key,
                    serde_json::to_string(values).expect("diagnostic names serialize"),
                );
            }
        }
        if !self.original_lengths.is_empty() {
            span.record(
                "record.originalLengths",
                serde_json::to_string(&self.original_lengths)
                    .expect("diagnostic lengths serialize"),
            );
        }
    }
}

pub(super) fn capture_submission(snapshot: impl FnOnce() -> RecordSubmissionDiagnostics) {
    let _ = REQUEST_CONTEXT.try_with(|context| {
        if context.record_submit {
            *context.submission.borrow_mut() = Some(snapshot());
        }
    });
}

pub(super) fn submission_validation_errors(errors: &[&'static str]) {
    let _ = REQUEST_CONTEXT.try_with(|context| {
        if let Some(snapshot) = context.submission.borrow_mut().as_mut() {
            snapshot.validation_errors = errors.to_vec();
        }
    });
}

fn eligible_submission_code(code: &serde_json::Value) -> bool {
    use crate::problem::*;
    match code.as_i64() {
        Some(code) => ![
            AUTH_MISSING_REQUIRED_FIELDS,
            AUTH_MOD_OUTDATED,
            AUTH_STEAM_ID_MISMATCH,
            AUTH_STEAM_AUTHENTICATION_FAILED,
            AUTH_MISSING_TOKEN,
            AUTH_INVALID_TOKEN,
            AUTH_USER_NOT_FOUND,
            AUTH_DISCORD_NOT_LINKED,
            VOTE_MISSING_PARAMS,
        ]
        .into_iter()
        .any(|excluded| i64::from(excluded) == code),
        None => code.as_str().is_some_and(|value| !value.is_empty()),
    }
}

#[derive(Clone, Copy)]
struct SubmissionProblem;

pub(super) fn record_problem_response(response: &mut Response, code: Option<&serde_json::Value>) {
    if let Some(code) = code {
        record_error_code(code);
        if eligible_submission_code(code) {
            response.extensions_mut().insert(SubmissionProblem);
        }
    }
}

tokio::task_local! {
    static REQUEST_CONTEXT: RequestContext;
}

pub async fn track_request(request: Request, next: Next) -> Response {
    let record_submit = request.method() == Method::POST
        && request
            .extensions()
            .get::<MatchedPath>()
            .is_some_and(|path| path.as_str() == "/record/submit");
    let gtr = request.method() == Method::POST
        && request
            .extensions()
            .get::<MatchedPath>()
            .is_some_and(|path| {
                matches!(
                    path.as_str(),
                    "/auth/login" | "/auth/refresh" | "/record/submit" | "/user/updateSteamName"
                )
            });
    REQUEST_CONTEXT
        .scope(
            RequestContext {
                span: tracing::Span::current(),
                gtr: Cell::new(gtr),
                record_submit,
                submission: RefCell::new(None),
            },
            async {
                let response = next.run(request).await;
                // Defer publication until final response: ignored/intermediate Problems cannot leak payloads onto success spans.
                REQUEST_CONTEXT.with(|context| {
                    if context.record_submit
                        && response.extensions().get::<SubmissionProblem>().is_some()
                        && (response.status().is_client_error()
                            || response.status().is_server_error())
                        && let Some(snapshot) = context.submission.borrow().as_ref()
                    {
                        snapshot.record(&context.span);
                    }
                });
                response
            },
        )
        .await
}

pub fn mark_gtr() {
    let _ = REQUEST_CONTEXT.try_with(|context| context.gtr.set(true));
}

pub fn record_outdated(outdated: bool) {
    let _ = REQUEST_CONTEXT.try_with(|context| {
        context.span.record("mod.outdated", outdated);
    });
}

pub fn record_error_code(code: &serde_json::Value) {
    let _ = REQUEST_CONTEXT.try_with(|context| {
        if context.gtr.get() {
            if let Some(code) = code.as_i64() {
                context.span.record("mod.errorCode", code);
            } else if let Some(code) = code.as_u64() {
                context.span.record("mod.errorCode", code);
            } else if let Some(code) = code.as_f64() {
                context.span.record("mod.errorCode", code);
            } else if let Some(code) = code.as_str() {
                context.span.record("mod.errorCode", code);
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::problem::Problem;
    use axum::{
        Router, body::Body, http::StatusCode, middleware, response::IntoResponse, routing::post,
    };
    use opentelemetry::{KeyValue, trace::TracerProvider as _};
    use opentelemetry_sdk::trace::{InMemorySpanExporter, SdkTracerProvider};
    use tower::ServiceExt;
    use tracing::Instrument;
    use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

    #[tokio::test]
    async fn exports_outcomes_on_request_span_without_leaking_between_requests() {
        let exporter = InMemorySpanExporter::default();
        let provider = SdkTracerProvider::builder()
            .with_simple_exporter(exporter.clone())
            .build();
        let _subscriber = tracing_subscriber::registry()
            .with(tracing_opentelemetry::layer().with_tracer(provider.tracer("mod-test")))
            .set_default();
        let app = Router::new()
            .route(
                "/auth/login",
                post(|| async {
                    async {
                        record_outdated(false);
                        tokio::task::yield_now().await;
                        Problem {
                            status: StatusCode::BAD_REQUEST,
                            detail: "test".into(),
                            error_code: Some("test_code".into()),
                        }
                    }
                    .instrument(tracing::info_span!("child"))
                    .await
                }),
            )
            .route(
                "/auth/refresh",
                post(|| async {
                    tokio::task::yield_now().await;
                    record_outdated(true);
                    Problem::code(StatusCode::BAD_REQUEST, 9)
                }),
            )
            .route(
                "/shared",
                post(|| async {
                    tokio::task::yield_now().await;
                    Problem::code(StatusCode::BAD_REQUEST, 16)
                }),
            )
            .route(
                "/gtr-shared",
                post(|| async {
                    mark_gtr();
                    tokio::task::yield_now().await;
                    Problem::code(StatusCode::BAD_REQUEST, 16)
                }),
            )
            .route(
                "/level/request",
                post(|| async { Problem::service_unavailable() }),
            )
            .layer(middleware::from_fn(track_request))
            .layer(middleware::from_fn(zc_telemetry::http::track_request));
        let request = |path| {
            app.clone().oneshot(
                Request::builder()
                    .method("POST")
                    .uri(path)
                    .body(Body::empty())
                    .unwrap(),
            )
        };
        let (login, refresh, shared, gtr_shared, missing) = tokio::join!(
            request("/auth/login"),
            request("/auth/refresh"),
            request("/shared"),
            request("/gtr-shared"),
            request("/level/request")
        );
        assert_eq!(login.unwrap().status(), StatusCode::BAD_REQUEST);
        assert_eq!(refresh.unwrap().status(), StatusCode::BAD_REQUEST);
        assert_eq!(shared.unwrap().status(), StatusCode::BAD_REQUEST);
        assert_eq!(gtr_shared.unwrap().status(), StatusCode::BAD_REQUEST);
        assert_eq!(missing.unwrap().status(), StatusCode::SERVICE_UNAVAILABLE);
        provider.force_flush().unwrap();
        let spans = exporter.get_finished_spans().unwrap();
        let attributes = |name| {
            &spans
                .iter()
                .find(|span| span.name == name)
                .unwrap()
                .attributes
        };
        assert!(attributes("POST /auth/login").contains(&KeyValue::new("mod.outdated", false)));
        assert!(
            attributes("POST /auth/login").contains(&KeyValue::new("mod.errorCode", "test_code"))
        );
        assert!(attributes("POST /auth/refresh").contains(&KeyValue::new("mod.outdated", true)));
        assert!(attributes("POST /auth/refresh").contains(&KeyValue::new("mod.errorCode", 9_i64)));
        assert!(attributes("POST /gtr-shared").contains(&KeyValue::new("mod.errorCode", 16_i64)));
        for name in ["POST /shared", "POST /level/request", "child"] {
            assert!(
                !attributes(name)
                    .iter()
                    .any(|attribute| attribute.key.as_str().starts_with("mod."))
            );
        }
        assert!(
            !attributes("POST /gtr-shared")
                .iter()
                .any(|attribute| attribute.key.as_str() == "mod.outdated")
        );
        // Direct calls without HTTP request context remain safe.
        mark_gtr();
        record_outdated(true);
        record_error_code(&9.into());
        let _ = Problem::code(StatusCode::BAD_REQUEST, 9).into_response();
    }
}

#[cfg(test)]
mod record_diagnostic_tests {
    use super::*;
    use crate::{
        problem::*,
        routes::{RecordSubmissionBody, ensure_submission_ghost_size, submission_ghost_result},
    };
    use axum::{
        Json, Router,
        body::Body,
        http::{HeaderMap, StatusCode},
        middleware,
        response::IntoResponse,
        routing::post,
    };
    use base64::Engine;
    use opentelemetry::{KeyValue, Value, trace::TracerProvider as _};
    use opentelemetry_sdk::trace::{InMemorySpanExporter, SdkTracerProvider, SpanData};
    use tower::ServiceExt;
    use tracing::Instrument;
    use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

    async fn handler(headers: HeaderMap, Json(body): Json<RecordSubmissionBody>) -> Response {
        capture_submission(|| body.diagnostics());
        async {
            tokio::task::yield_now().await;
            let mode = headers
                .get("x-test-mode")
                .and_then(|h| h.to_str().ok())
                .unwrap_or("");
            match mode {
                "success" => return StatusCode::OK.into_response(),
                "uncoded" => return Problem::service_unavailable().into_response(),
                "intermediate" | "intermediate-uncoded" | "intermediate-status" => {
                    let _ = Problem::code(StatusCode::BAD_REQUEST, RECORD_SUBMIT_MISSING_PARAMS)
                        .into_response();
                    return match mode {
                        "intermediate-uncoded" => Problem::service_unavailable().into_response(),
                        "intermediate-status" => StatusCode::SERVICE_UNAVAILABLE.into_response(),
                        _ => StatusCode::OK.into_response(),
                    };
                }
                "decode" => return body.decode_ghost().unwrap_err().into_response(),
                "size" => {
                    return ensure_submission_ghost_size(
                        zc_core::ghosts::MAX_GHOST_COMPRESSED_BYTES + 1,
                    )
                    .unwrap_err()
                    .into_response();
                }
                "parse" => {
                    let bytes = body.decode_ghost().unwrap();
                    let parsed =
                        tokio::task::spawn_blocking(move || zc_core::ghosts::parse_ghost(&bytes))
                            .await
                            .unwrap();
                    return submission_ghost_result(parsed).unwrap_err().into_response();
                }
                _ => {}
            }
            submission_validation_errors(&["Hash.invalid"]);
            let code = headers
                .get("x-test-code")
                .and_then(|h| h.to_str().ok())
                .and_then(|h| h.parse().ok())
                .unwrap_or(RECORD_SUBMIT_MISSING_PARAMS);
            Problem::code(
                if code == INTERNAL {
                    StatusCode::INTERNAL_SERVER_ERROR
                } else {
                    StatusCode::BAD_REQUEST
                },
                code,
            )
            .into_response()
        }
        .instrument(tracing::info_span!("record-child"))
        .await
    }

    fn body(level: &str) -> serde_json::Value {
        serde_json::json!({"Level":level,"Hash":"0123456789ABCDEF0123456789ABCDEF","Time":42.25,
            "Splits":[1.0,2.0],"Speeds":[3.0],"GhostData":"private-ghost-data",
            "GameVersion":"1","ModVersion":"2","UnexpectedToken":"unknown-secret-sentinel"})
    }

    async fn request(
        app: &Router,
        path: &str,
        method: &str,
        body: &serde_json::Value,
        mode: &str,
        code: i32,
    ) -> Response {
        app.clone()
            .oneshot(
                Request::builder()
                    .method(method)
                    .uri(path)
                    .header("content-type", "application/json")
                    .header("x-test-mode", mode)
                    .header("x-test-code", code.to_string())
                    .body(Body::from(body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap()
    }
    fn text<'a>(span: &'a SpanData, key: &str) -> Option<&'a str> {
        span.attributes
            .iter()
            .find(|a| a.key.as_str() == key)
            .and_then(|a| match &a.value {
                Value::String(value) => Some(value.as_str()),
                _ => None,
            })
    }
    fn no_record_attributes(span: &SpanData) -> bool {
        !span
            .attributes
            .iter()
            .any(|a| a.key.as_str().starts_with("record."))
    }

    #[tokio::test]
    async fn exports_only_failed_submission_diagnostics_and_isolates_concurrent_requests() {
        let exporter = InMemorySpanExporter::default();
        let provider = SdkTracerProvider::builder()
            .with_simple_exporter(exporter.clone())
            .build();
        let _subscriber = tracing_subscriber::registry()
            .with(tracing_opentelemetry::layer().with_tracer(provider.tracer("record-test")))
            .set_default();
        let app = Router::new()
            .route("/record/submit", post(handler).get(handler))
            .route("/other", post(handler))
            .layer(middleware::from_fn(track_request))
            .layer(middleware::from_fn(zc_telemetry::http::track_request));
        for code in [
            INTERNAL,
            LEVEL_NOT_FOUND,
            RECORD_SUBMIT_MISSING_PARAMS,
            RECORD_SUBMIT_FAILED,
            INVALID_REQUEST,
        ] {
            let response = request(&app, "/record/submit", "POST", &body("level"), "", code).await;
            assert!(response.status().is_client_error() || response.status().is_server_error());
            provider.force_flush().unwrap();
            let spans = exporter.get_finished_spans().unwrap();
            let span = spans
                .iter()
                .rev()
                .find(|s| s.name == "POST /record/submit")
                .unwrap();
            assert_eq!(text(span, "record.Level"), Some("level"));
            assert_eq!(
                text(span, "record.Hash"),
                Some("0123456789ABCDEF0123456789ABCDEF")
            );
            assert_eq!(text(span, "record.GhostData"), Some("[redacted]"));
            assert_eq!(text(span, "record.Splits"), Some("[1.0,2.0]"));
            assert_eq!(text(span, "record.Speeds"), Some("[3.0]"));
            assert_eq!(text(span, "record.GameVersion"), Some("1"));
            assert_eq!(text(span, "record.ModVersion"), Some("2"));
            assert_eq!(text(span, "record.unsetFields"), Some("[\"WorkshopId\"]"));
            assert_eq!(
                text(span, "record.validationErrors"),
                Some("[\"Hash.invalid\"]")
            );
            assert!(
                span.attributes
                    .contains(&KeyValue::new("record.Time", 42.25))
            );
            assert!(
                span.attributes
                    .contains(&KeyValue::new("record.GhostDataLength", 18_i64))
            );
            assert!(text(span, "record.WorkshopId").is_none());
        }
        for code in [
            AUTH_MISSING_REQUIRED_FIELDS,
            AUTH_MOD_OUTDATED,
            AUTH_STEAM_ID_MISMATCH,
            AUTH_STEAM_AUTHENTICATION_FAILED,
            AUTH_MISSING_TOKEN,
            AUTH_INVALID_TOKEN,
            AUTH_USER_NOT_FOUND,
            AUTH_DISCORD_NOT_LINKED,
            VOTE_MISSING_PARAMS,
        ] {
            request(
                &app,
                "/record/submit",
                "POST",
                &body("suppressed"),
                "",
                code,
            )
            .await;
            provider.force_flush().unwrap();
            let spans = exporter.get_finished_spans().unwrap();
            assert!(no_record_attributes(
                spans
                    .iter()
                    .rev()
                    .find(|s| s.name == "POST /record/submit")
                    .unwrap()
            ));
        }
        for (path, method, mode) in [
            ("/record/submit", "POST", "success"),
            ("/record/submit", "POST", "intermediate"),
            ("/record/submit", "POST", "intermediate-uncoded"),
            ("/record/submit", "POST", "intermediate-status"),
            ("/record/submit", "POST", "uncoded"),
            ("/other", "POST", ""),
            ("/record/submit", "GET", ""),
        ] {
            request(&app, path, method, &body("suppressed"), mode, 19).await;
            provider.force_flush().unwrap();
            let spans = exporter.get_finished_spans().unwrap();
            assert!(no_record_attributes(
                spans
                    .iter()
                    .rev()
                    .find(|s| s.name == format!("{method} {path}"))
                    .unwrap()
            ));
        }
        for (input, expected) in [
            ("{}", StatusCode::UNPROCESSABLE_ENTITY),
            ("{", StatusCode::BAD_REQUEST),
        ] {
            let response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/record/submit")
                        .header("content-type", "application/json")
                        .body(Body::from(input))
                        .unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(response.status(), expected);
            provider.force_flush().unwrap();
            let spans = exporter.get_finished_spans().unwrap();
            assert!(no_record_attributes(
                spans
                    .iter()
                    .rev()
                    .find(|s| s.name == "POST /record/submit")
                    .unwrap()
            ));
        }
        let mut oversized = body(&"界".repeat(1025));
        oversized["Splits"] = serde_json::json!(vec![1.0; 257]);
        oversized["Speeds"] = serde_json::json!(vec![2.0; 256]);
        oversized["GameVersion"] = "x".repeat(1024).into();
        oversized["ModVersion"] = "m".repeat(1025).into();
        oversized["WorkshopId"] = "7".into();
        request(&app, "/record/submit", "POST", &oversized, "", 19).await;
        provider.force_flush().unwrap();
        {
            let spans = exporter.get_finished_spans().unwrap();
            let span = spans
                .iter()
                .rev()
                .find(|s| s.name == "POST /record/submit")
                .unwrap();
            assert_eq!(text(span, "record.Level").unwrap().chars().count(), 1024);
            assert_eq!(text(span, "record.ModVersion").unwrap().len(), 1024);
            assert_eq!(text(span, "record.GameVersion").unwrap().len(), 1024);
            assert_eq!(text(span, "record.WorkshopId"), Some("7"));
            assert!(text(span, "record.unsetFields").is_none());
            assert_eq!(
                serde_json::from_str::<Vec<f64>>(text(span, "record.Splits").unwrap())
                    .unwrap()
                    .len(),
                256
            );
            assert_eq!(
                serde_json::from_str::<Vec<f64>>(text(span, "record.Speeds").unwrap())
                    .unwrap()
                    .len(),
                256
            );
            assert_eq!(
                serde_json::from_str::<serde_json::Value>(
                    text(span, "record.originalLengths").unwrap()
                )
                .unwrap(),
                serde_json::json!({"Level":1025,"ModVersion":1025,"Splits":257})
            );
            assert_eq!(
                serde_json::from_str::<Vec<String>>(text(span, "record.truncatedFields").unwrap())
                    .unwrap(),
                vec!["Level", "ModVersion", "Splits"]
            );
        }
        let mut boundary = body(&"界".repeat(1024));
        boundary["WorkshopId"] = serde_json::Value::Null;
        request(&app, "/record/submit", "POST", &boundary, "", 19).await;
        provider.force_flush().unwrap();
        {
            let spans = exporter.get_finished_spans().unwrap();
            let span = spans
                .iter()
                .rev()
                .find(|s| s.name == "POST /record/submit")
                .unwrap();
            assert!(text(span, "record.truncatedFields").is_none());
            assert!(text(span, "record.originalLengths").is_none());
            assert_eq!(text(span, "record.unsetFields"), Some("[\"WorkshopId\"]"));
        }
        for (mode, ghost, reason) in [
            ("decode", "!!!!".into(), "GhostData.invalid_base64"),
            ("size", "AAAA".into(), "GhostData.compressed_size_limit"),
            (
                "parse",
                base64::engine::general_purpose::STANDARD.encode(b"not a ghost"),
                "GhostData.invalid_ghost",
            ),
        ] {
            let mut input = body("ghost-failure");
            input["GhostData"] = ghost.into();
            let response = request(&app, "/record/submit", "POST", &input, mode, 19).await;
            assert_eq!(response.status(), StatusCode::BAD_REQUEST);
            provider.force_flush().unwrap();
            let spans = exporter.get_finished_spans().unwrap();
            let span = spans
                .iter()
                .rev()
                .find(|s| s.name == "POST /record/submit")
                .unwrap();
            assert_eq!(
                text(span, "record.validationErrors"),
                Some(serde_json::to_string(&[reason]).unwrap().as_str())
            );
        }
        let previous = exporter.get_finished_spans().unwrap().len();
        let a = body("concurrent-a");
        let b = body("concurrent-b");
        let (a, b) = tokio::join!(
            request(&app, "/record/submit", "POST", &a, "", 19),
            request(&app, "/record/submit", "POST", &b, "success", 19)
        );
        assert_eq!(a.status(), StatusCode::BAD_REQUEST);
        assert_eq!(b.status(), StatusCode::OK);
        provider.force_flush().unwrap();
        let spans = exporter.get_finished_spans().unwrap();
        let requests: Vec<_> = spans[previous..]
            .iter()
            .filter(|s| s.name == "POST /record/submit")
            .collect();
        assert_eq!(requests.len(), 2);
        assert_eq!(
            requests
                .iter()
                .filter(|s| text(s, "record.Level") == Some("concurrent-a"))
                .count(),
            1
        );
        assert_eq!(
            requests.iter().filter(|s| no_record_attributes(s)).count(),
            1
        );
        assert!(
            spans
                .iter()
                .filter(|s| s.name == "record-child")
                .all(no_record_attributes)
        );
        let exported = format!("{spans:?}");
        for secret in [
            "private-ghost-data",
            "unknown-secret-sentinel",
            "UnexpectedToken",
            "bm90IGEgZ2hvc3Q=",
        ] {
            assert!(!exported.contains(secret));
        }
        capture_submission(|| panic!("no snapshot outside request scope"));
        submission_validation_errors(&["unused"]);
    }
}
