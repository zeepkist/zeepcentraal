use serenity::{
    all::{FullEvent, GatewayIntents, Token},
    async_trait,
    prelude::*,
};
use std::sync::Arc;

struct Handler;

#[async_trait]
impl EventHandler for Handler {
    async fn dispatch(&self, _context: &Context, event: &FullEvent) {
        if let FullEvent::Ready { data_about_bot, .. } = event {
            tracing::info!(user = %data_about_bot.user.name, guilds = data_about_bot.guilds.len(), "Discord gateway ready");
        }
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let telemetry = zc_telemetry::initialize("discord")?;
    let token: Token = zc_core::config::required("DISCORD_BOT_TOKEN")?.parse()?;
    let mut client = Client::builder(token, GatewayIntents::GUILDS)
        .event_handler(Arc::new(Handler))
        .await?;
    client.start().await?;
    telemetry.shutdown().await
}
