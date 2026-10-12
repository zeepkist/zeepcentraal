use super::{ProfileSession, RoomContext};
use crate::transfer::{TransferEvent, TransferWork};
use anyhow::{Result, ensure};
use std::{any::Any, sync::Arc};
use tokio::sync::{OwnedSemaphorePermit, Semaphore};
use zc_core::zeepnet::GameHostPacket;

pub struct ReceivedPacket {
    pub packet: GameHostPacket,
    pub received_at: jiff::Timestamp,
    pub sequence: u64,
    pub session_generation: u64,
    pub payload_bytes: usize,
    pub(crate) captured: Option<Arc<dyn Any + Send + Sync>>,
    pub(crate) events: Vec<TransferEvent>,
    pub(crate) transfer: Option<TransferWork>,
    pub(crate) transfer_complete: Option<tokio::sync::oneshot::Receiver<Vec<TransferEvent>>>,
    pub(super) permits: Option<(OwnedSemaphorePermit, OwnedSemaphorePermit)>,
}

pub(super) struct Budget {
    events: Arc<Semaphore>,
    bytes: Arc<Semaphore>,
}
impl Budget {
    pub(super) fn new() -> Self {
        Self {
            events: Arc::new(Semaphore::new(512)),
            bytes: Arc::new(Semaphore::new(8 * 1024 * 1024)),
        }
    }
    pub(super) fn reserve(&self, packet: &mut ReceivedPacket) -> Result<()> {
        let event = self.events.clone().try_acquire_owned().map_err(|_| {
            tracing::error!(
                sequence = packet.sequence,
                session = packet.session_generation,
                events = 512,
                "Room profile queue exceeded event capacity"
            );
            anyhow::anyhow!("Room profile queue exceeded event capacity")
        })?;
        let bytes = u32::try_from(packet.payload_bytes)?;
        let bytes = self
            .bytes
            .clone()
            .try_acquire_many_owned(bytes)
            .map_err(|_| {
                tracing::error!(
                    sequence = packet.sequence,
                    session = packet.session_generation,
                    bytes = 8 * 1024 * 1024 - self.bytes.available_permits(),
                    "Room profile queue exceeded byte capacity"
                );
                anyhow::anyhow!("Room profile queue exceeded byte capacity")
            })?;
        tracing::debug!(
            sequence = packet.sequence,
            session = packet.session_generation,
            events = 512 - self.events.available_permits(),
            bytes = 8 * 1024 * 1024 - self.bytes.available_permits(),
            "Room receipt queued"
        );
        packet.permits = Some((event, bytes));
        Ok(())
    }
}

impl ReceivedPacket {
    pub(crate) fn new(
        packet: GameHostPacket,
        received_at: jiff::Timestamp,
        sequence: u64,
        payload_bytes: usize,
    ) -> Self {
        Self {
            packet,
            received_at,
            sequence,
            payload_bytes,
            session_generation: 0,
            captured: None,
            events: vec![],
            transfer: None,
            transfer_complete: None,
            permits: None,
        }
    }
    pub(super) async fn capture(
        &mut self,
        profile: &dyn ProfileSession,
        context: &RoomContext,
    ) -> Result<()> {
        ensure!(context.is_host(), "Room host authority unavailable");
        self.session_generation = context.session_generation;
        self.events = context.observe_received(&self.packet).await?;
        self.transfer = context.transfer.lock().await.prepare_work(&self.packet)?;
        for event in &self.events {
            profile.confirm_receipt(event);
        }
        let players = context.players().await;
        self.captured = profile.capture_receipt(&self.packet, self.received_at, &players);
        if let GameHostPacket::PlayerResult {
            uid,
            has_result: true,
            level_uid,
            time,
            ..
        } = &self.packet
            && context
                .transfer
                .lock()
                .await
                .active
                .as_ref()
                .is_some_and(|level| level.level.uid == *level_uid)
            && let Some(player) = players.iter().find(|player| player.uid == *uid)
            && profile.preserve_native_finish(&self.packet, player.steam_id, self.received_at)
            && let Some(publisher) = &context.publisher
        {
            publisher.native_finish(
                player.steam_id,
                *time,
                &players
                    .iter()
                    .map(|player| player.steam_id)
                    .collect::<Vec<_>>(),
            );
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn event_and_byte_budgets_remain_reserved_until_callback_finishes() -> Result<()> {
        let budget = Budget::new();
        let packet =
            || ReceivedPacket::new(GameHostPacket::GameState(0), jiff::Timestamp::now(), 1, 1);
        let mut queued = Vec::new();
        for _ in 0..512 {
            let mut received = packet();
            budget.reserve(&mut received)?;
            queued.push(received);
        }
        assert_eq!(
            budget.reserve(&mut packet()).unwrap_err().to_string(),
            "Room profile queue exceeded event capacity"
        );
        queued.pop();
        budget.reserve(&mut packet())?;
        drop(queued);
        let mut oversized = packet();
        oversized.payload_bytes = 8 * 1024 * 1024 + 1;
        assert_eq!(
            budget.reserve(&mut oversized).unwrap_err().to_string(),
            "Room profile queue exceeded byte capacity"
        );
        let mut full = packet();
        full.payload_bytes = 8 * 1024 * 1024;
        budget.reserve(&mut full)?;
        assert!(budget.reserve(&mut packet()).is_err());
        drop(full);
        budget.reserve(&mut packet())?;
        Ok(())
    }
}
