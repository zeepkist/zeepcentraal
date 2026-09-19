#[tokio::main]
async fn main() -> anyhow::Result<()> {
    zc_server::run().await
}
