use diesel::connection::{Instrumentation, InstrumentationEvent};
use opentelemetry::{KeyValue, global};
use std::{
    fmt::{self, Write},
    sync::OnceLock,
    time::Instant,
};

/// Only collect the initial SQL keyword. Never materialize DebugQuery bind values.
#[derive(Default)]
struct Keyword(String);
impl Write for Keyword {
    fn write_str(&mut self, value: &str) -> fmt::Result {
        for c in value.chars() {
            if self.0.is_empty() && c.is_ascii_whitespace() {
                continue;
            }
            if !c.is_ascii_alphabetic() || self.0.len() >= 16 {
                return Err(fmt::Error);
            }
            self.0.push(c.to_ascii_uppercase());
        }
        Ok(())
    }
}
fn operation(query: &dyn diesel::connection::DebugQuery) -> &'static str {
    let mut keyword = Keyword::default();
    let _ = write!(keyword, "{query}");
    match keyword.0.as_str() {
        "SELECT" => "SELECT",
        "INSERT" => "INSERT",
        "UPDATE" => "UPDATE",
        "DELETE" => "DELETE",
        "BEGIN" => "BEGIN",
        "COMMIT" => "COMMIT",
        "ROLLBACK" => "ROLLBACK",
        "SAVEPOINT" => "SAVEPOINT",
        "RELEASE" => "RELEASE",
        "SET" => "SET",
        _ => "QUERY",
    }
}

struct ActiveQuery {
    span: tracing::Span,
    started: Instant,
    operation: &'static str,
    outcome: &'static str,
}
impl Drop for ActiveQuery {
    fn drop(&mut self) {
        if self.outcome != "ok" {
            self.span.record("otel.status_code", "ERROR");
            self.span.record("error.type", self.outcome);
        }
        static DURATION: OnceLock<opentelemetry::metrics::Histogram<f64>> = OnceLock::new();
        DURATION
            .get_or_init(|| {
                global::meter("zeepcentraal-database")
                    .f64_histogram("db.client.operation.duration")
                    .with_unit("s")
                    .build()
            })
            .record(
                self.started.elapsed().as_secs_f64(),
                &[
                    KeyValue::new("db.system.name", "postgresql"),
                    KeyValue::new("db.operation.name", self.operation),
                    KeyValue::new("outcome", self.outcome),
                ],
            );
    }
}

pub(crate) struct DatabaseInstrumentation {
    host: String,
    port: u16,
    database: String,
    active: Option<ActiveQuery>,
}
impl DatabaseInstrumentation {
    pub(crate) fn new(host: String, port: u16, database: String) -> Self {
        Self {
            host,
            port,
            database,
            active: None,
        }
    }
}
impl Instrumentation for DatabaseInstrumentation {
    fn on_connection_event(&mut self, event: InstrumentationEvent<'_>) {
        match event {
            InstrumentationEvent::StartQuery { query, .. } => {
                let operation = operation(query);
                self.active = Some(ActiveQuery {
                    span: tracing::info_span!("db.client.operation", otel.kind = "client", otel.name = operation,
                        db.system = "postgresql", db.system.name = "postgresql", db.name = %self.database,
                        db.namespace = %self.database, db.operation = operation, db.operation.name = operation,
                        server.address = %self.host, server.port = self.port,
                        otel.status_code = tracing::field::Empty, error.type = tracing::field::Empty),
                    started: Instant::now(),
                    operation,
                    outcome: "cancelled",
                });
            }
            InstrumentationEvent::FinishQuery { error, .. } => {
                if let Some(mut active) = self.active.take() {
                    active.outcome = if error.is_some() {
                        "database.error"
                    } else {
                        "ok"
                    };
                }
            }
            _ => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn keyword_never_formats_binds_or_unbounded_text() {
        struct Query;
        impl fmt::Debug for Query {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                fmt::Display::fmt(self, f)
            }
        }
        impl fmt::Display for Query {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                f.write_str("SELECT ")?;
                panic!("binds must never be formatted")
            }
        }
        impl diesel::connection::DebugQuery for Query {}
        assert_eq!(operation(&Query), "SELECT");
    }
}
