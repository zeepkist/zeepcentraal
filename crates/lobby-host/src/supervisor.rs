use anyhow::Result;
use std::{
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};
use tokio::{sync::Notify, task::JoinSet};

#[async_trait::async_trait]
pub trait SupervisedRoom: Send + Sync + 'static {
    fn key(&self) -> &str;
    async fn run(&self) -> Result<()>;
    async fn stop(&self) -> Result<()>;
}

pub struct LobbyHostSupervisor {
    rooms: Vec<Arc<dyn SupervisedRoom>>,
    stopped: Arc<AtomicBool>,
    wake: Arc<Notify>,
    restart_delay: Duration,
}

impl LobbyHostSupervisor {
    pub fn new(rooms: Vec<Arc<dyn SupervisedRoom>>, restart_delay: Duration) -> Self {
        Self {
            rooms,
            stopped: Arc::new(AtomicBool::new(false)),
            wake: Arc::new(Notify::new()),
            restart_delay,
        }
    }

    pub async fn run(&self) {
        let mut set = JoinSet::new();
        for room in &self.rooms {
            let room = room.clone();
            let stopped = self.stopped.clone();
            let wake = self.wake.clone();
            let delay = self.restart_delay;
            set.spawn(async move {
                while !stopped.load(Ordering::Acquire) {
                    if let Err(error) = room.run().await { tracing::warn!(room = room.key(), %error, "Managed room failed; restarting"); }
                    if stopped.load(Ordering::Acquire) { break; }
                    tokio::select! { _ = tokio::time::sleep(delay) => {}, _ = wake.notified() => {} }
                }
            });
        }
        while set.join_next().await.is_some() {}
    }

    pub async fn stop(&self) -> Result<()> {
        if self.stopped.swap(true, Ordering::AcqRel) {
            return Ok(());
        }
        self.wake.notify_waiters();
        let mut first = None;
        for room in &self.rooms {
            if let Err(error) = room.stop().await {
                first.get_or_insert(error);
            }
        }
        first.map_or(Ok(()), Err)
    }
}
