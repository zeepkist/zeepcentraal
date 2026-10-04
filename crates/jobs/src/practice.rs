use anyhow::{Context, Result, ensure};
use sha2::{Digest, Sha256};
use std::collections::BTreeSet;
use zc_core::{
    object_storage::ObjectStorage,
    practice::{MAX_LEVEL_BYTES, PracticeBundle, PracticePayload, PracticePlaylist},
};
use zc_workshop::WorkshopDownloader;

pub(crate) async fn prepare_bundle(
    round_id: i32,
    url: &str,
    playlist: PracticePlaylist,
    downloader: &dyn WorkshopDownloader,
    storage: &dyn ObjectStorage,
) -> Result<PracticeBundle> {
    let ids: Vec<_> = playlist
        .levels
        .iter()
        .map(|level| level.workshop_id)
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect();
    let download = downloader.download(&ids).await?;
    let result: Result<PracticeBundle> = async {
        let mut levels = Vec::with_capacity(playlist.levels.len());
        for level in playlist.levels {
            let item = download
                .items
                .iter()
                .find(|item| item.workshop_id == level.workshop_id)
                .context("SteamCMD omitted practice Workshop item")?;
            let selected =
                zc_workshop::files::find_workshop_level_file(&item.directory, &level.uid)
                    .await?
                    .context("Workshop item omitted practice level UID")?;
            let source = selected.content.trim_start_matches('\u{feff}');
            let bytes = zc_core::zeepnet::encode_zeepkist_level_payload(
                source,
                source.trim_start().starts_with('{'),
            )?;
            ensure!(
                !bytes.is_empty() && bytes.len() <= MAX_LEVEL_BYTES,
                "Practice payload size is invalid"
            );
            ensure!(
                !zc_core::zeepnet::decode_zeepkist_level_payload(&bytes)?.is_empty(),
                "Practice payload is empty"
            );
            let sha256 = hex::encode(Sha256::digest(&bytes));
            let object_key = format!("zsl-practice/payloads/{sha256}.gz");
            let byte_size = bytes.len();
            storage
                .upload(&object_key, bytes, "application/gzip")
                .await?;
            levels.push(PracticePayload {
                level,
                object_key,
                sha256,
                byte_size,
            });
        }
        let bundle = PracticeBundle {
            round_id,
            playlist: url.to_owned(),
            levels,
        };
        bundle.validate()?;
        Ok(bundle)
    }
    .await;
    let cleanup = download.cleanup().await;
    let bundle = result?;
    cleanup?;
    Ok(bundle)
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use std::{collections::HashMap, path::PathBuf, sync::Mutex};
    use zc_core::object_storage::DownloadConstraints;
    use zc_workshop::{DownloadedWorkshopItem, steamcmd::WorkshopDownload};
    struct Downloader {
        root: PathBuf,
        requested: Mutex<Vec<Vec<u64>>>,
    }
    #[async_trait]
    impl WorkshopDownloader for Downloader {
        async fn download(&self, ids: &[u64]) -> Result<WorkshopDownload> {
            self.requested.lock().unwrap().push(ids.to_vec());
            tokio::fs::create_dir_all(&self.root).await?;
            for index in 0..14 {
                tokio::fs::write(
                    self.root.join(format!("{index}.zeeplevel")),
                    format!(r#"{{"level":{{"UID":"level-{index}"}},"blox":[]}}"#),
                )
                .await?;
            }
            Ok(WorkshopDownload::new(
                self.root.clone(),
                vec![DownloadedWorkshopItem {
                    directory: self.root.clone(),
                    workshop_id: 3809417598,
                }],
            ))
        }
    }
    #[derive(Default)]
    struct Storage {
        blobs: Mutex<HashMap<String, Vec<u8>>>,
        fail: bool,
    }
    #[async_trait]
    impl ObjectStorage for Storage {
        async fn upload(&self, key: &str, bytes: Vec<u8>, _: &str) -> Result<()> {
            ensure!(!self.fail, "Mock upload failed");
            self.blobs.lock().unwrap().insert(key.into(), bytes);
            Ok(())
        }
        async fn download(&self, _: &str, _: DownloadConstraints<'_>) -> Result<Vec<u8>> {
            anyhow::bail!("Unexpected download")
        }
        async fn delete(&self, _: &str) -> Result<()> {
            Ok(())
        }
    }
    fn downloader() -> Downloader {
        Downloader {
            root: std::env::temp_dir().join(format!("zc-practice-{}", zc_core::generate_uid())),
            requested: Mutex::new(Vec::new()),
        }
    }
    fn playlist() -> PracticePlaylist {
        let levels = (0..14).rev().map(|index| serde_json::json!({"UID":format!("level-{index}"),"WorkshopID":3809417598_u64,"Name":format!("Level {index}"),"Author":"Author"})).collect::<Vec<_>>();
        PracticePlaylist::parse(&serde_json::to_vec(&serde_json::json!({"levels":levels})).unwrap())
            .unwrap()
    }
    #[tokio::test]
    async fn fourteen_levels_preserve_order_and_download_shared_item_once() -> Result<()> {
        let downloader = downloader();
        let storage = Storage::default();
        let bundle = prepare_bundle(
            50,
            "https://example.com/p.zeeplist",
            playlist(),
            &downloader,
            &storage,
        )
        .await?;
        assert_eq!(bundle.levels.len(), 14);
        assert_eq!(bundle.levels[0].level.uid, "level-13");
        assert_eq!(bundle.levels[13].level.uid, "level-0");
        assert_eq!(*downloader.requested.lock().unwrap(), [vec![3809417598]]);
        assert!(!downloader.root.exists());
        for entry in bundle.levels {
            let blobs = storage.blobs.lock().unwrap();
            let bytes = &blobs[&entry.object_key];
            assert_eq!(hex::encode(Sha256::digest(bytes)), entry.sha256);
            assert_eq!(bytes.len(), entry.byte_size);
            assert!(
                zc_core::zeepnet::decode_zeepkist_level_payload(bytes)?[0]
                    .contains(&entry.level.uid)
            );
        }
        Ok(())
    }
    #[tokio::test]
    async fn missing_uid_and_failed_upload_cannot_return_publishable_bundle() {
        let downloader = downloader();
        let storage = Storage::default();
        let mut invalid = playlist();
        invalid.levels[1].uid = "missing".into();
        assert!(
            prepare_bundle(50, "https://example.com/p", invalid, &downloader, &storage)
                .await
                .is_err()
        );
        assert!(!downloader.root.exists());
        assert!(
            prepare_bundle(
                50,
                "https://example.com/p",
                playlist(),
                &downloader,
                &Storage {
                    fail: true,
                    ..Storage::default()
                }
            )
            .await
            .is_err()
        );
        assert!(!downloader.root.exists());
    }
    #[tokio::test]
    #[ignore = "requires supplied CDN playlist and installed round 50 Workshop files"]
    async fn supplied_playlist_resolves_all_fourteen_installed_levels() -> Result<()> {
        struct InstalledDownloader(PathBuf);
        #[async_trait]
        impl WorkshopDownloader for InstalledDownloader {
            async fn download(&self, ids: &[u64]) -> Result<WorkshopDownload> {
                ensure!(ids == [3809417598], "Unexpected live Workshop ID");
                let temporary = std::env::temp_dir()
                    .join(format!("zc-practice-live-{}", zc_core::generate_uid()));
                tokio::fs::create_dir_all(&temporary).await?;
                Ok(WorkshopDownload::new(
                    temporary,
                    vec![DownloadedWorkshopItem {
                        directory: self.0.clone(),
                        workshop_id: ids[0],
                    }],
                ))
            }
        }
        let directory = PathBuf::from(std::env::var("ZC_PRACTICE_WORKSHOP_DIRECTORY")?);
        ensure!(directory.is_dir(), "Installed Workshop directory missing");
        let url = "https://cdn.zeepki.st/super-league/season-8/ZSL%20S8R1%20-%20Mixed%20Surfaces.zeeplist";
        let playlist = zc_core::practice::fetch_playlist(url).await?;
        ensure!(
            playlist.levels.len() == 14,
            "Supplied playlist no longer contains 14 levels"
        );
        let expected: Vec<_> = playlist
            .levels
            .iter()
            .map(|level| level.uid.clone())
            .collect();
        let storage = Storage::default();
        let bundle =
            prepare_bundle(50, url, playlist, &InstalledDownloader(directory), &storage).await?;
        assert_eq!(
            bundle
                .levels
                .iter()
                .map(|entry| entry.level.uid.clone())
                .collect::<Vec<_>>(),
            expected
        );
        assert_eq!(storage.blobs.lock().unwrap().len(), 14);
        Ok(())
    }
}
