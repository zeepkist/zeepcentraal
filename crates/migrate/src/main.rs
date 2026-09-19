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
    let mode = match arguments.first().map(String::as_str) {
        Some("verify") => zc_database::adoption::Mode::Verify,
        Some("adopt") | None => zc_database::adoption::Mode::Adopt,
        _ => anyhow::bail!("Usage: zeepcentraal-migrate [verify|adopt|inspect-history FOLDER]"),
    };
    anyhow::ensure!(arguments.len() <= 1, "Too many migration arguments");
    let database = zc_core::DatabaseConfig::from_env(1)?;
    let migrations = std::env::var("MIGRATIONS_FOLDER")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::path::PathBuf::from("packages/database/drizzle"));
    let report = zc_database::adoption::run(&database.url, &migrations, mode).await?;
    let applied = if mode == zc_database::adoption::Mode::Adopt {
        zc_database::migrations::run_pending(&database.url).await?
    } else {
        Vec::new()
    };
    println!(
        "verified {} Drizzle migrations; Diesel baseline {}{}",
        report.drizzle_migrations,
        report.baseline_version,
        if report.baseline_created {
            " created"
        } else {
            " present or verify-only"
        },
    );
    if !applied.is_empty() {
        println!("applied Diesel migrations: {}", applied.join(", "));
    }
    Ok(())
}
