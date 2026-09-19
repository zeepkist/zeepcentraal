use crate::{DownloadedWorkshopItem, WorkshopDownloader};
use anyhow::{Context, Result, ensure};
use async_trait::async_trait;
use std::{path::PathBuf, process::Stdio, time::Duration};
use tokio::{fs, process::Command, time::timeout};

const STEAMCMD_TIMEOUT: Duration = Duration::from_secs(10 * 60);

pub struct SteamCmdDownloader {
    app_id: String,
    executable: PathBuf,
}

impl SteamCmdDownloader {
    pub fn new(app_id: impl Into<String>, executable: impl Into<PathBuf>) -> Self {
        Self {
            app_id: app_id.into(),
            executable: executable.into(),
        }
    }
}

pub struct WorkshopDownload {
    pub items: Vec<DownloadedWorkshopItem>,
    root: PathBuf,
}

impl WorkshopDownload {
    pub fn new(root: PathBuf, items: Vec<DownloadedWorkshopItem>) -> Self {
        Self { items, root }
    }

    pub async fn cleanup(mut self) -> Result<()> {
        let root = std::mem::take(&mut self.root);
        if !root.as_os_str().is_empty() {
            fs::remove_dir_all(root).await?;
        }
        Ok(())
    }
}

impl Drop for WorkshopDownload {
    fn drop(&mut self) {
        if !self.root.as_os_str().is_empty() {
            tracing::warn!(path = %self.root.display(), "Workshop download dropped before cleanup");
        }
    }
}

#[async_trait]
impl WorkshopDownloader for SteamCmdDownloader {
    async fn download(&self, workshop_ids: &[u64]) -> Result<WorkshopDownload> {
        ensure!(
            !workshop_ids.is_empty(),
            "At least one workshop ID is required"
        );
        let root =
            std::env::temp_dir().join(format!("zeepcentraal-workshop-{}", zc_core::generate_uid()));
        fs::create_dir_all(&root).await?;
        let result = self.download_into(&root, workshop_ids).await;
        if result.is_err() {
            let _ = fs::remove_dir_all(&root).await;
        }
        result
    }
}

impl SteamCmdDownloader {
    async fn download_into(
        &self,
        root: &std::path::Path,
        workshop_ids: &[u64],
    ) -> Result<WorkshopDownload> {
        let mut command = Command::new(&self.executable);
        command.args([
            "+force_install_dir",
            root.to_str().context("Temporary path is not UTF-8")?,
            "+login",
            "anonymous",
        ]);
        for id in workshop_ids {
            command.args(["+workshop_download_item", &self.app_id, &id.to_string()]);
        }
        command
            .arg("+quit")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);
        let output = timeout(STEAMCMD_TIMEOUT, command.output())
            .await
            .context("SteamCMD timed out")??;
        ensure!(
            output.status.success(),
            "SteamCMD failed with exit code {}",
            output.status.code().unwrap_or(-1)
        );
        let content = root
            .join("steamapps")
            .join("workshop")
            .join("content")
            .join(&self.app_id);
        let mut items = Vec::with_capacity(workshop_ids.len());
        for id in workshop_ids {
            let directory = content.join(id.to_string());
            ensure!(
                fs::try_exists(&directory).await?,
                "SteamCMD omitted workshop item {id}"
            );
            items.push(DownloadedWorkshopItem {
                directory,
                workshop_id: *id,
            });
        }
        Ok(WorkshopDownload {
            items,
            root: root.to_owned(),
        })
    }
}
