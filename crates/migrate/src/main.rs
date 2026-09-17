#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let arguments: Vec<String> = std::env::args().skip(1).collect();
    if arguments
        .first()
        .is_some_and(|arg| arg == "inspect-history")
    {
        anyhow::ensure!(
            arguments.len() == 2,
            "Usage: zc-migrate inspect-history MIGRATION_FOLDER"
        );
        println!(
            "{}",
            serde_json::to_string_pretty(&zc_database::history::inspect(std::path::Path::new(
                &arguments[1]
            ))?)?
        );
        return Ok(());
    }
    anyhow::ensure!(arguments.is_empty(), "Unknown migration command");
    let config = zc_core::PreviewConfig::from_env()?;
    zc_database::migration::migrate(&config.database_url).await?;
    println!("{} preview migrations applied", zc_database::Database::NAME);
    Ok(())
}
