use crate::chat::PacketSender;
use anyhow::{Result, bail, ensure};
use std::{
    collections::{HashMap, VecDeque},
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, AtomicU64, Ordering},
    },
};
use tokio::sync::{Notify, watch};
use zc_core::zeepnet::{BitReader, CUSTOM_LEADERBOARD};

const PACKETS: usize = 256;
const BYTES: usize = 4 * 1024 * 1024;

struct Batch {
    generation: u64,
    standings: bool,
    packets: VecDeque<Vec<u8>>,
}

#[derive(Default)]
struct Queue {
    batches: VecDeque<Batch>,
    packets: usize,
    bytes: usize,
    native_generation: u64,
    native_times: HashMap<u64, f32>,
}

pub(super) struct Publisher {
    queue: Mutex<Queue>,
    wake: Notify,
    stopped: AtomicBool,
    generation: Arc<AtomicU64>,
    failure: watch::Sender<Option<String>>,
}

impl Publisher {
    pub(super) fn new(generation: Arc<AtomicU64>) -> Arc<Self> {
        let (failure, _) = watch::channel(None);
        Arc::new(Self {
            queue: Mutex::new(Queue::default()),
            wake: Notify::new(),
            stopped: AtomicBool::new(false),
            generation,
            failure,
        })
    }

    pub(super) fn enqueue(&self, mut packets: Vec<Vec<u8>>, standings: bool) -> Result<()> {
        ensure!(
            !self.stopped.load(Ordering::Acquire),
            "Room publisher stopped"
        );
        if let Some(error) = self.failure.borrow().as_ref() {
            bail!("{error}");
        }
        let generation = self.generation.load(Ordering::Acquire);
        let mut queue = self.queue.lock().unwrap();
        ensure!(
            !self.stopped.load(Ordering::Acquire),
            "Room publisher stopped"
        );
        if queue.native_generation != generation {
            queue.native_generation = generation;
            queue.native_times.clear();
        }
        packets.retain(|packet| {
            standing_time(packet).is_none_or(|(id, time)| {
                queue
                    .native_times
                    .get(&id)
                    .is_none_or(|native| time <= *native)
            })
        });
        // Reconciliation produces deltas. Preserve unrelated unsent players when
        // coalescing refreshes, and replace only the same player's same field.
        let keys: Vec<_> = packets
            .iter()
            .filter_map(|packet| standing_key(packet))
            .collect();
        let mut previous = Vec::new();
        let mut retained = VecDeque::new();
        while let Some(batch) = queue.batches.pop_front() {
            if batch.generation != generation || (standings && batch.standings) {
                queue.packets -= batch.packets.len();
                queue.bytes -= batch.packets.iter().map(Vec::len).sum::<usize>();
                if batch.generation == generation {
                    previous.extend(batch.packets.into_iter().filter(|packet| {
                        standing_key(packet).is_none_or(|key| !keys.contains(&key))
                    }));
                }
            } else {
                let mut batch = batch;
                let old_count = batch.packets.len();
                let old_bytes = batch.packets.iter().map(Vec::len).sum::<usize>();
                batch
                    .packets
                    .retain(|packet| standing_key(packet).is_none_or(|key| !keys.contains(&key)));
                queue.packets -= old_count - batch.packets.len();
                queue.bytes -= old_bytes - batch.packets.iter().map(Vec::len).sum::<usize>();
                if !batch.packets.is_empty() {
                    retained.push_back(batch);
                }
            }
        }
        queue.batches = retained;
        previous.append(&mut packets);
        packets = previous;
        let bytes = packets.iter().map(Vec::len).sum::<usize>();
        if queue.packets + packets.len() > PACKETS || queue.bytes + bytes > BYTES {
            self.failure
                .send_replace(Some("Room publication queue exceeded capacity".into()));
            self.stopped.store(true, Ordering::Release);
            *queue = Queue::default();
            self.wake.notify_waiters();
            bail!("Room publication queue exceeded capacity");
        }
        queue.packets += packets.len();
        queue.bytes += bytes;
        if !packets.is_empty() {
            queue.batches.push_back(Batch {
                generation,
                standings,
                packets: packets.into(),
            });
        }
        tracing::debug!(
            generation,
            packets = queue.packets,
            bytes = queue.bytes,
            "Room publication queued"
        );
        drop(queue);
        self.wake.notify_one();
        Ok(())
    }

    pub(super) fn stop(&self) {
        self.stopped.store(true, Ordering::Release);
        *self.queue.lock().unwrap() = Queue::default();
        self.wake.notify_waiters();
    }

    pub(super) fn native_finish(&self, steam_id: u64, time: f32, players: &[u64]) {
        if !time.is_finite() || time <= 0.0 {
            return;
        }
        let mut queue = self.queue.lock().unwrap();
        let generation = self.generation.load(Ordering::Acquire);
        if queue.native_generation != generation {
            queue.native_generation = generation;
            queue.native_times.clear();
        }
        queue.native_times.retain(|id, _| players.contains(id));
        queue
            .native_times
            .entry(steam_id)
            .and_modify(|old| *old = old.min(time))
            .or_insert(time);
        let native = queue.native_times[&steam_id];
        let mut removed_count = 0;
        let mut removed_bytes = 0;
        for batch in &mut queue.batches {
            batch.packets.retain(|packet| {
                let remove =
                    standing_time(packet).is_some_and(|(id, time)| id == steam_id && time > native);
                if remove {
                    removed_count += 1;
                    removed_bytes += packet.len();
                }
                !remove
            });
        }
        queue.batches.retain(|batch| !batch.packets.is_empty());
        queue.packets -= removed_count;
        queue.bytes -= removed_bytes;
    }

    pub(super) async fn failed(&self) -> String {
        let mut failure = self.failure.subscribe();
        loop {
            if let Some(error) = failure.borrow().clone() {
                return error;
            }
            if failure.changed().await.is_err() {
                return "Room publisher closed".into();
            }
        }
    }

    pub(super) async fn run(self: Arc<Self>, sender: Arc<dyn PacketSender>) -> Result<()> {
        loop {
            let notified = self.wake.notified();
            tokio::pin!(notified);
            notified.as_mut().enable();
            if self.stopped.load(Ordering::Acquire) {
                return Ok(());
            }
            let next = {
                let mut queue = self.queue.lock().unwrap();
                let generation = self.generation.load(Ordering::Acquire);
                while queue
                    .batches
                    .front()
                    .is_some_and(|batch| batch.generation != generation)
                {
                    let batch = queue.batches.pop_front().unwrap();
                    queue.packets -= batch.packets.len();
                    queue.bytes -= batch.packets.iter().map(Vec::len).sum::<usize>();
                }
                let next = queue.batches.front_mut().and_then(|batch| {
                    batch
                        .packets
                        .pop_front()
                        .map(|packet| (batch.generation, packet))
                });
                if queue
                    .batches
                    .front()
                    .is_some_and(|batch| batch.packets.is_empty())
                {
                    queue.batches.pop_front();
                }
                next
            };
            if let Some((generation, packet)) = next {
                let bytes = packet.len();
                let result = if generation == self.generation.load(Ordering::Acquire) {
                    sender.send(packet).await
                } else {
                    Ok(())
                };
                if let Err(error) = result {
                    tracing::warn!(generation, error = %error, "Room publication failed");
                    self.stop();
                    return Err(error.context("Room publication failed"));
                }
                if self.stopped.load(Ordering::Acquire) {
                    return Ok(());
                }
                let mut queue = self.queue.lock().unwrap();
                if self.stopped.load(Ordering::Acquire) {
                    return Ok(());
                }
                queue.packets -= 1;
                queue.bytes -= bytes;
                tracing::debug!(
                    generation,
                    packets = queue.packets,
                    bytes = queue.bytes,
                    "Room publication progressed"
                );
            } else {
                notified.await;
            }
        }
    }
}

fn standing_key(packet: &[u8]) -> Option<(u64, bool, bool)> {
    let mut reader = BitReader::new(packet);
    if reader.read_u16().ok()? != CUSTOM_LEADERBOARD {
        return None;
    }
    let id = reader.read_u64().ok()?;
    reader.read_bool().ok()?;
    reader.read_f32().ok()?;
    reader.read_i32().ok()?;
    reader.read_bool().ok()?;
    let overrides = reader.read_bool().ok()?;
    Some((id, !overrides, overrides))
}

fn standing_time(packet: &[u8]) -> Option<(u64, f32)> {
    let (id, time, _) = standing_key(packet)?;
    if !time {
        return None;
    }
    let mut reader = BitReader::new(packet);
    reader.read_u16().ok()?;
    reader.read_u64().ok()?;
    reader.read_bool().ok()?;
    Some((id, reader.read_f32().ok()?))
}

pub(super) struct PublishingSender(pub Arc<Publisher>);
#[async_trait::async_trait]
impl PacketSender for PublishingSender {
    async fn send(&self, packet: Vec<u8>) -> Result<()> {
        self.0.enqueue(vec![packet], false)
    }
}

#[cfg(test)]
mod tests;
