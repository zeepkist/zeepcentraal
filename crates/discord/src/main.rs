use std::sync::Arc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    zc_core::environment::initialize()?;
    let telemetry = zc_telemetry::initialize("discord")?;
    let config = Arc::new(zc_discord::config::DiscordConfig::from_env()?);
    let state = Arc::new(zc_discord::health::RuntimeState::default());
    let health = tokio::spawn(zc_discord::health::serve(
        config.health_address,
        state.clone(),
    ));
    let runtime = zc_discord::runtime::run(config, state.clone()).await;
    state.set_ready(false);
    health.abort();
    runtime?;
    telemetry.shutdown().await
}
