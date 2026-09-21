use axum::{Json, Router, http::StatusCode, response::IntoResponse, routing::get};
use serde::Serialize;
use std::{
    net::SocketAddr,
    sync::{
        Arc,
        atomic::{AtomicBool, AtomicUsize, Ordering},
    },
};

#[derive(Default)]
pub struct RuntimeState {
    ready: AtomicBool,
    guilds: AtomicUsize,
    activity_queue_depth: AtomicUsize,
    sessions: AtomicUsize,
}

impl RuntimeState {
    pub fn set_ready(&self, value: bool) {
        self.ready.store(value, Ordering::Relaxed);
    }

    pub fn set_guilds(&self, value: usize) {
        self.guilds.store(value, Ordering::Relaxed);
    }

    pub fn add_guild(&self) {
        self.guilds.fetch_add(1, Ordering::Relaxed);
    }

    pub fn remove_guild(&self) {
        self.guilds
            .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |value| {
                value.checked_sub(1)
            })
            .ok();
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HealthBody {
    status: &'static str,
    discord: bool,
    guilds: usize,
    memory: Memory,
    queues: Queues,
    sessions: Sessions,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Memory {
    rss: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Queues {
    activity_queue_depth: usize,
}

#[derive(Serialize)]
struct Sessions {
    size: usize,
}

pub async fn serve(address: SocketAddr, state: Arc<RuntimeState>) -> anyhow::Result<()> {
    let app = Router::new()
        .route("/health", get(health))
        .route("/ready", get(health))
        .with_state(state);
    let listener = tokio::net::TcpListener::bind(address).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

async fn health(
    axum::extract::State(state): axum::extract::State<Arc<RuntimeState>>,
) -> impl IntoResponse {
    let ready = state.ready.load(Ordering::Relaxed);
    let status = if ready {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };
    (
        status,
        Json(HealthBody {
            status: if ready { "ok" } else { "starting" },
            discord: ready,
            guilds: state.guilds.load(Ordering::Relaxed),
            memory: Memory {
                rss: resident_bytes(),
            },
            queues: Queues {
                activity_queue_depth: state.activity_queue_depth.load(Ordering::Relaxed),
            },
            sessions: Sessions {
                size: state.sessions.load(Ordering::Relaxed),
            },
        }),
    )
}

fn resident_bytes() -> u64 {
    std::fs::read_to_string("/proc/self/statm")
        .ok()
        .and_then(|value| value.split_whitespace().nth(1)?.parse::<u64>().ok())
        .and_then(|pages| pages.checked_mul(4_096))
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn guild_count_never_underflows() {
        let state = RuntimeState::default();
        state.remove_guild();
        assert_eq!(state.guilds.load(Ordering::Relaxed), 0);
        state.add_guild();
        state.remove_guild();
        assert_eq!(state.guilds.load(Ordering::Relaxed), 0);
    }
}
