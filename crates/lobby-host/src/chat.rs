use anyhow::Result;
use std::{future::Future, sync::Arc};
use zc_core::zeepnet::{chat_message_packet, targeted_chat_message_packet};

#[async_trait::async_trait]
pub trait PacketSender: Send + Sync {
    async fn send(&self, packet: Vec<u8>) -> Result<()>;
}

pub struct FnPacketSender<F>(pub F);

#[async_trait::async_trait]
impl<F, Fut> PacketSender for FnPacketSender<F>
where
    F: Fn(Vec<u8>) -> Fut + Send + Sync,
    Fut: Future<Output = Result<()>> + Send,
{
    async fn send(&self, packet: Vec<u8>) -> Result<()> {
        (self.0)(packet).await
    }
}

#[derive(Clone)]
pub struct RoomChat {
    sender: Arc<dyn PacketSender>,
}

impl RoomChat {
    pub fn new(sender: Arc<dyn PacketSender>) -> Self {
        Self { sender }
    }
    pub async fn command(&self, message: &str) -> Result<()> {
        self.sender.send(chat_message_packet(message)?).await
    }
    pub async fn target(&self, steam_id: u64, message: &str, hostname: &str) -> Result<()> {
        self.sender
            .send(targeted_chat_message_packet(steam_id, message, hostname)?)
            .await
    }
}
