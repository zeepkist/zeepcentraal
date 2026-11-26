//! Opt-in test uses only dedicated local telemetry_test database.
use anyhow::{Context, Result, ensure};
use axum::{Router, extract::State, middleware, routing::get};
use diesel::{QueryableByName, sql_query, sql_types::Text};
use diesel_async::RunQueryDsl;
use opentelemetry_proto::tonic::{
    collector::{
        logs::v1::logs_service_server::LogsServiceServer,
        metrics::v1::metrics_service_server::MetricsServiceServer,
        trace::v1::trace_service_server::TraceServiceServer,
    },
    common::v1::any_value::Value,
    metrics::v1::metric::Data,
};
use std::{
    io::{BufRead, BufReader, Read},
    process::{Command, Stdio},
    sync::Arc,
    time::Duration,
};
use tokio::sync::watch;
use tokio_stream::wrappers::TcpListenerStream;
use tonic::transport::Server;
use zc_database::{DatabasePool, PoolBudget, PoolSettings};
use zc_jobs::{
    TaskIdentifier,
    queue::{JobLane, Queue},
    runtime::{JobHandler, JobOutcome},
};

const SELECT_TRACEPARENT_JOB_BY_JOB_KEY_FIXTURE: &str =
    include_str!("fixtures/telemetry_pipeline/select_traceparent_job_by_job_key_fixture.sql");
const SET_CONFIG_4: &str = include_str!("fixtures/telemetry_pipeline/set_config_4.sql");

#[path = "../../telemetry/tests/support/collector.rs"]
mod collector;

fn database_url() -> Result<String> {
    let value = std::env::var("ZC_TEST_DATABASE_URL").context("ZC_TEST_DATABASE_URL required")?;
    let url = url::Url::parse(&value)?;
    ensure!(
        url.host_str() == Some("127.0.0.1") && url.path() == "/telemetry_test",
        "Dedicated local telemetry_test database required"
    );
    Ok(value)
}

async fn pool() -> Result<DatabasePool> {
    DatabasePool::connect(
        &database_url()?,
        PoolSettings {
            application_name: "telemetry-test".into(),
            acquire_timeout: Duration::from_secs(5),
            statement_timeout: Duration::from_secs(5),
            lock_timeout: Duration::from_secs(2),
            idle_transaction_timeout: Duration::from_secs(5),
            idle_timeout: Duration::from_secs(30),
        },
        PoolBudget::application(2),
    )
    .await
}

struct Handler {
    queue: Queue,
    pool: DatabasePool,
    done: watch::Sender<bool>,
}
#[async_trait::async_trait]
impl JobHandler for Handler {
    async fn handle(
        &self,
        task: TaskIdentifier,
        payload: serde_json::Value,
        _: JobLane,
        attempts: i32,
    ) -> Result<JobOutcome> {
        sql_query(include_str!("fixtures/telemetry_pipeline/select_43.sql"))
            .execute(&mut self.pool.application().connection().await?)
            .await?;
        if task == TaskIdentifier::RefreshGlobalMetrics {
            if attempts == 1 {
                anyhow::bail!("fixture handler failure");
            }
            self.queue
                .enqueue(
                    TaskIdentifier::RefreshMedals,
                    serde_json::json!({"idLevel":100}),
                    JobLane::Fast,
                    None,
                )
                .await?;
        } else if payload["idLevel"] == 100 {
            self.done.send(true)?;
        }
        Ok(JobOutcome::Completed)
    }
}

#[derive(QueryableByName)]
struct SessionContext {
    #[diesel(sql_type = Text)]
    value: String,
}

#[derive(Clone)]
struct Api {
    pool: DatabasePool,
    queue: Queue,
    done: watch::Sender<bool>,
}
async fn request(State(state): State<Api>) -> &'static str {
    sql_query(include_str!("fixtures/telemetry_pipeline/select_42.sql"))
        .execute(&mut state.pool.application().connection().await.unwrap())
        .await
        .unwrap();
    // Failure and cancellation must contribute to metrics without emitting SQL spans.
    {
        let mut connection = state.pool.application().connection().await.unwrap();
        assert!(
            sql_query(include_str!(
                "fixtures/telemetry_pipeline/read_fixture_state.sql"
            ))
            .execute(&mut connection)
            .await
            .is_err()
        );
        assert!(
            tokio::time::timeout(
                Duration::from_millis(5),
                sql_query(include_str!("fixtures/telemetry_pipeline/pg_sleep.sql"))
                    .execute(&mut connection)
            )
            .await
            .is_err()
        );
    }
    let query = |name| {
        let partition = state.pool.application();
        zc_telemetry::observe_operation(name, async move {
            let expected = zc_core::telemetry::trace_carrier()
                .remove("traceparent")
                .unwrap();
            let mut connection = partition.connection().await?;
            let session: SessionContext = sql_query(include_str!(
                "fixtures/telemetry_pipeline/current_setting.sql"
            ))
            .get_result(&mut connection)
            .await?;
            assert_eq!(session.value, expected);
            sql_query(include_str!("fixtures/telemetry_pipeline/select_44.sql"))
                .execute(&mut connection)
                .await?;
            Ok::<_, anyhow::Error>(())
        })
    };
    let (one, two) = tokio::join!(query("parallel.one"), query("parallel.two"));
    one.unwrap();
    two.unwrap();
    state
        .queue
        .enqueue(
            TaskIdentifier::RefreshGlobalMetrics,
            serde_json::json!({}),
            JobLane::Fast,
            None,
        )
        .await
        .unwrap();
    state.done.send(true).unwrap();
    "ok"
}

#[tokio::test]
#[ignore = "subprocess fixture; launched by distributed_pipeline"]
async fn telemetry_child() -> Result<()> {
    let role = std::env::var("ZC_TELEMETRY_TEST_ROLE")?;
    let telemetry = zc_telemetry::initialize(&role)?;
    let pool = pool().await?;
    let queue = Queue::connect(pool.application()).await?;
    let (done, mut shutdown) = watch::channel(false);
    if role == "api" {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
        println!("PIPELINE_ADDRESS=http://{}/work", listener.local_addr()?);
        let app = Router::new()
            .route("/work", get(request))
            .with_state(Api { pool, queue, done })
            .layer(middleware::from_fn(zc_telemetry::http::track_request));
        axum::serve(listener, app)
            .with_graceful_shutdown(async move {
                let _ = shutdown.changed().await;
            })
            .await?;
    } else {
        zc_jobs::runtime::run(
            queue.clone(),
            Arc::new(Handler {
                pool,
                done,
                queue: queue.clone(),
            }),
            shutdown,
        )
        .await?;
    }
    telemetry.shutdown().await
}

struct ChildGuard(std::process::Child);
impl std::ops::Deref for ChildGuard {
    type Target = std::process::Child;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
impl std::ops::DerefMut for ChildGuard {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}
impl Drop for ChildGuard {
    fn drop(&mut self) {
        if self.0.try_wait().ok().flatten().is_none() {
            let _ = self.0.kill();
            let _ = self.0.wait();
        }
    }
}

fn child(role: &str, endpoint: &str) -> Result<ChildGuard> {
    Ok(ChildGuard(
        Command::new(std::env::current_exe()?)
            .args(["--ignored", "--exact", "telemetry_child", "--nocapture"])
            .env("ZC_TELEMETRY_TEST_ROLE", role)
            .env("OTEL_EXPORTER_OTLP_ENDPOINT", endpoint)
            .env("OTEL_SERVICE_NAME", format!("zc-telemetry-{role}"))
            .env("NODE_ENV", "telemetry-test")
            .env("OTEL_SDK_DISABLED", "false")
            .env("RUST_LOG", "warn,zc_=info,telemetry_pipeline=info")
            .stdout(if role == "api" {
                Stdio::piped()
            } else {
                Stdio::null()
            })
            .stderr(Stdio::inherit())
            .spawn()?,
    ))
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
#[ignore = "requires disposable PostgreSQL with pgmq 1.12.0 and Bun"]
async fn distributed_pipeline() -> Result<()> {
    let (client, connection) =
        tokio_postgres::connect(&database_url()?, tokio_postgres::NoTls).await?;
    tokio::spawn(async move {
        connection.await.unwrap();
    });
    // Database name guard above prevents any production or shared database reset.
    client
        .batch_execute(include_str!("fixtures/telemetry_pipeline/drop_zc_jobs.sql"))
        .await?;
    client
        .batch_execute(include_str!(
            "../../../packages/database/drizzle/0083_pgmq_queue.sql"
        ))
        .await?;
    client
        .batch_execute(include_str!(
            "../../database/migrations/20261018000000_optimize_job_claims/up.sql"
        ))
        .await?;
    let up = include_str!("../../database/migrations/20261116010000_queue_trace_context/up.sql");
    let down =
        include_str!("../../database/migrations/20261116010000_queue_trace_context/down.sql");
    client.batch_execute(up).await?;
    client.batch_execute(down).await?;
    client.batch_execute(up).await?;
    queue_context_contract(&client).await?;
    let started = std::time::Instant::now();
    for _ in 0..20 {
        client
            .batch_execute(include_str!("fixtures/telemetry_pipeline/set_config.sql"))
            .await?;
    }
    println!(
        "context setup mean round trip: {:.3}ms",
        started.elapsed().as_secs_f64() * 1000.0 / 20.0
    );

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
    let endpoint = format!("http://{}", listener.local_addr()?);
    let collector = collector::Collector::default();
    let server = tokio::spawn(
        Server::builder()
            .add_service(TraceServiceServer::new(collector.clone()))
            .add_service(MetricsServiceServer::new(collector.clone()))
            .add_service(LogsServiceServer::new(collector.clone()))
            .serve_with_incoming(TcpListenerStream::new(listener)),
    );
    let mut api = child("api", &endpoint)?;
    let mut address = None;
    let mut output = BufReader::new(api.stdout.take().unwrap());
    for line in output.by_ref().lines() {
        let line = line?;
        if let Some(value) = line.strip_prefix("PIPELINE_ADDRESS=") {
            address = Some(value.to_owned());
            break;
        }
    }
    let address = address.context("API did not report listener")?;
    let drain = std::thread::spawn(move || std::io::copy(&mut output, &mut std::io::sink()));
    let fixture = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/web/tests/fixtures/telemetryPipeline.ts");
    let web = Command::new("bun")
        .args(["--no-env-file"])
        .arg(fixture)
        .arg(address)
        .env("OTEL_EXPORTER_OTLP_ENDPOINT", &endpoint)
        .env("OTEL_SERVICE_NAME", "zc-telemetry-web")
        .env("NODE_ENV", "telemetry-test")
        .output()?;
    ensure!(
        web.status.success(),
        "web fixture failed: {}",
        String::from_utf8_lossy(&web.stderr)
    );
    ensure!(api.wait()?.success(), "API fixture failed");
    client
        .batch_execute(include_str!("fixtures/telemetry_pipeline/enqueue.sql"))
        .await?;
    let mut worker = child("worker", &endpoint)?;
    let _ = drain.join();
    ensure!(worker.wait()?.success(), "worker fixture failed");
    let captured = collector.captured.lock().unwrap();
    let mut spans = Vec::new();
    for resource in captured.traces.iter().flat_map(|r| &r.resource_spans) {
        let attributes = &resource.resource.as_ref().unwrap().attributes;
        assert!(attributes.iter().any(|a| a.key == "deployment.environment" && matches!(a.value.as_ref().and_then(|v|v.value.as_ref()),Some(Value::StringValue(value)) if value == "telemetry-test")));
        let service = attributes.iter().find(|a| a.key == "service.name").unwrap();
        let Some(Value::StringValue(service)) =
            service.value.as_ref().and_then(|v| v.value.as_ref())
        else {
            panic!("service name missing")
        };
        for span in resource.scope_spans.iter().flat_map(|s| &s.spans) {
            spans.push((service.as_str(), span));
        }
    }
    let find = |service: &str, kind: i32| {
        spans
            .iter()
            .find(|(s, span)| *s == service && span.kind == kind)
            .unwrap()
            .1
    };
    let web_client = spans
        .iter()
        .find(|(service, s)| {
            *service == "zc-telemetry-web"
                && s.kind == 3
                && s.attributes.iter().any(|a| a.key == "http.request.method")
        })
        .unwrap()
        .1;
    let api_server = find("zc-telemetry-api", 2);
    let producer = find("zc-telemetry-api", 4);
    let consumer = spans
        .iter()
        .find(|(service, s)| {
            *service == "zc-telemetry-worker" && s.kind == 5 && s.name == "refreshGlobalMetrics"
        })
        .unwrap()
        .1;
    assert_eq!(api_server.trace_id, web_client.trace_id);
    assert_eq!(api_server.parent_span_id, web_client.span_id);
    assert_eq!(producer.trace_id, web_client.trace_id);
    assert_eq!(consumer.trace_id, producer.trace_id);
    assert_eq!(consumer.parent_span_id, producer.span_id);
    let attempts: Vec<_> = spans
        .iter()
        .filter(|(service, s)| {
            *service == "zc-telemetry-worker" && s.kind == 5 && s.name == "refreshGlobalMetrics"
        })
        .map(|(_, s)| *s)
        .collect();
    assert_eq!(attempts.len(), 2);
    assert_ne!(attempts[0].span_id, attempts[1].span_id);
    assert!(
        attempts
            .iter()
            .all(|s| s.parent_span_id == producer.span_id && s.trace_id == producer.trace_id)
    );
    assert_eq!(
        attempts
            .iter()
            .filter(|s| s.status.as_ref().is_some_and(|status| status.code == 2))
            .count(),
        1
    );
    let child_producer = find("zc-telemetry-worker", 4);
    assert_eq!(child_producer.trace_id, producer.trace_id);
    assert!(
        spans
            .iter()
            .any(|(service, s)| *service == "zc-telemetry-worker"
                && s.kind == 5
                && s.parent_span_id == child_producer.span_id
                && s.trace_id == child_producer.trace_id)
    );
    let roots: Vec<_> = spans
        .iter()
        .filter(|(service, s)| {
            *service == "zc-telemetry-worker"
                && s.kind == 5
                && s.parent_span_id.iter().all(|b| *b == 0)
        })
        .collect();
    assert_eq!(roots.len(), 2);
    assert!(roots.iter().all(|(_, s)| s.trace_id != producer.trace_id));
    assert!(spans.iter().all(|(_, span)| {
        span.attributes
            .iter()
            .all(|attribute| !attribute.key.starts_with("db."))
            && span.events.iter().all(|event| event.name != "db.response")
    }));
    for name in ["parallel.one", "parallel.two"] {
        assert_eq!(
            spans.iter().filter(|(_, span)| span.name == name).count(),
            1
        );
    }
    assert!(
        spans
            .iter()
            .all(|(_, span)| { span.name != "refreshGlobalMetrics" || span.kind == 5 })
    );
    assert!(!format!("{spans:?}").contains("private-sql-literal"));
    assert!(!format!("{spans:?}").contains("private-bun-sql-literal"));
    let metrics: Vec<_> = captured
        .metrics
        .iter()
        .flat_map(|r| &r.resource_metrics)
        .flat_map(|r| &r.scope_metrics)
        .flat_map(|s| &s.metrics)
        .collect();
    assert!(
        metrics
            .iter()
            .any(|metric| metric.name == "http.client.request.duration")
    );
    let outcomes: Vec<_> = metrics
        .iter()
        .filter(|metric| metric.name == "db.client.operation.duration")
        .filter_map(|metric| match &metric.data {
            Some(Data::Histogram(histogram)) => Some(&histogram.data_points),
            _ => None,
        })
        .flatten()
        .flat_map(|point| &point.attributes)
        .filter(|attribute| attribute.key == "outcome")
        .filter_map(
            |attribute| match attribute.value.as_ref()?.value.as_ref()? {
                Value::StringValue(outcome) => Some(outcome.as_str()),
                _ => None,
            },
        )
        .collect();
    for expected in ["ok", "database.error", "cancelled"] {
        assert!(
            outcomes.contains(&expected),
            "missing SQL outcome {expected}"
        );
    }
    drop(captured);
    server.abort();
    Ok(())
}

async fn queue_context_contract(client: &tokio_postgres::Client) -> Result<()> {
    const FIRST: &str = "00-11111111111111111111111111111111-1111111111111111-01";
    const LATEST: &str = "00-22222222222222222222222222222222-2222222222222222-01";
    for context in [FIRST, LATEST] {
        client
            .query_one(
                include_str!("fixtures/telemetry_pipeline/set_config_2.sql"),
                &[&context],
            )
            .await?;
        client
            .query_one(
                include_str!("fixtures/telemetry_pipeline/enqueue_2.sql"),
                &[],
            )
            .await?;
    }
    let stored = client
        .query_one(
            include_str!("fixtures/telemetry_pipeline/select_traceparent_job.sql"),
            &[],
        )
        .await?;
    assert_eq!(stored.get::<_, Option<String>>(0).as_deref(), Some(LATEST));
    assert_eq!(
        stored.get::<_, Option<String>>(1).as_deref(),
        Some("fixture=ok")
    );
    // Legacy producers have no context; latest pending update clears old context.
    client
        .batch_execute(include_str!("fixtures/telemetry_pipeline/set_config_3.sql"))
        .await?;
    assert!(
        client
            .query_one(SELECT_TRACEPARENT_JOB_BY_JOB_KEY_FIXTURE, &[])
            .await?
            .get::<_, Option<String>>(0)
            .is_none()
    );
    client.query_one(SET_CONFIG_4, &[&FIRST]).await?;
    client
        .batch_execute(include_str!("fixtures/telemetry_pipeline/enqueue_3.sql"))
        .await?;
    client.query_one(SET_CONFIG_4, &[&LATEST]).await?;
    // Checkpoint and defer payload updates preserve original enqueue context.
    client
        .batch_execute(include_str!(
            "fixtures/telemetry_pipeline/set_payload_job.sql"
        ))
        .await?;
    assert_eq!(
        client
            .query_one(SELECT_TRACEPARENT_JOB_BY_JOB_KEY_FIXTURE, &[])
            .await?
            .get::<_, Option<String>>(0)
            .as_deref(),
        Some(FIRST)
    );
    // A SQL trigger can enqueue without carrying metadata in task payloads.
    client
        .batch_execute(include_str!(
            "fixtures/telemetry_pipeline/create_trace_fixture.sql"
        ))
        .await?;
    assert_eq!(
        client
            .query_one(
                include_str!("fixtures/telemetry_pipeline/select_traceparent_job_by_job_key_trigger_fixture.sql"),
                &[]
            )
            .await?
            .get::<_, Option<String>>(0)
            .as_deref(),
        Some(LATEST)
    );
    client
        .batch_execute(include_str!("fixtures/telemetry_pipeline/truncate_job.sql"))
        .await?;
    Ok(())
}
