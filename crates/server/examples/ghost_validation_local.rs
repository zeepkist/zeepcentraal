//! Loopback-only observation harness. Fixture identity, never production authentication.
#[path = "../tests/support/ghost_validation.rs"]
mod support;
use anyhow::{Result, ensure};
use async_trait::async_trait;
use std::{
    io::Read,
    path::{Component, PathBuf},
    sync::Arc,
};
use zc_core::{
    jwt::Provider,
    object_storage::{DownloadConstraints, ObjectStorage},
};

struct LocalStorage(PathBuf);
impl LocalStorage {
    fn path(&self, key: &str) -> Result<PathBuf> {
        let path = PathBuf::from(key);
        ensure!(
            !key.is_empty()
                && path
                    .components()
                    .all(|part| matches!(part, Component::Normal(_))),
            "Invalid object key"
        );
        Ok(self.0.join(path))
    }
}
#[async_trait]
impl ObjectStorage for LocalStorage {
    async fn upload(&self, key: &str, bytes: Vec<u8>, _: &str) -> Result<()> {
        use std::io::Write;
        let path = self.path(key)?;
        std::fs::create_dir_all(path.parent().expect("object parent"))?;
        let mut file = std::fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(path)?;
        file.write_all(&bytes)?;
        file.sync_all()?;
        Ok(())
    }
    async fn download(&self, key: &str, limits: DownloadConstraints<'_>) -> Result<Vec<u8>> {
        ensure!(limits.max_bytes > 0, "Positive download limit required");
        let mut bytes = Vec::new();
        std::fs::File::open(self.path(key)?)?
            .take((limits.max_bytes + 1) as u64)
            .read_to_end(&mut bytes)?;
        ensure!(bytes.len() <= limits.max_bytes, "Object exceeds limit");
        ensure!(
            limits.expected_bytes.is_none_or(|size| size == bytes.len()),
            "Object size mismatch"
        );
        if let Some(digest) = limits.expected_sha256 {
            use sha2::{Digest, Sha256};
            ensure!(
                hex::encode(Sha256::digest(&bytes)).eq_ignore_ascii_case(digest),
                "Object digest mismatch"
            );
        }
        Ok(bytes)
    }
    async fn delete(&self, _: &str) -> Result<()> {
        anyhow::bail!("Harness does not delete accepted objects")
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/ghost_validation_local",
        "Dedicated loopback fixture DB required"
    );
    let directory = PathBuf::from(".local/ghost-validation");
    std::fs::create_dir_all(&directory)?;
    let mut state = support::state(
        &url,
        Arc::new(LocalStorage(directory.join("objects"))),
        false,
    )?;
    let mutable = Arc::get_mut(&mut state).expect("unique harness state");
    mutable.config.validation_manifest = zc_core::ghost_validation::load_manifest_from_env()?;
    mutable.config.body_limit = 40 * 1024 * 1024;
    mutable.record_upload_bytes = Arc::new(tokio::sync::Semaphore::new(32 * 1024 * 1024));
    mutable.database.get_or_insert_user(42).await?;
    // Only this dedicated loopback fixture database receives a fake administrator.
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("local fixture connection") });
    client
        .execute(
            "UPDATE public.\"user\" SET role='admin' WHERE steam_id=42",
            &[],
        )
        .await?;
    // Tokens stay in ignored local storage. Both represent fake fixture user 42.
    std::fs::write(
        directory.join("fixture-tokens.json"),
        serde_json::to_vec_pretty(&serde_json::json!({
            "fixtureIdentity":true,
            "submission":mutable.config.jwt.issue(Provider::Gtr,"42",None)?.access_token,
            "admin":mutable.config.jwt.issue(Provider::Steam,"42",None)?.access_token
        }))?,
    )?;
    let listener = tokio::net::TcpListener::bind("127.0.0.1:3001").await?;
    println!(
        "Observation harness: http://127.0.0.1:3001. Fixture identity only; no production authentication or background workers."
    );
    axum::serve(listener, zc_server::app::router(state)?).await?;
    Ok(())
}
