//! Shared practice playlist and published asset contracts.
use anyhow::{Context, Result, ensure};
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, time::Duration};

pub const MAX_PLAYLIST_BYTES: usize = 1024 * 1024;
pub const MAX_LEVEL_BYTES: usize = 64 * 1024 * 1024;

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct PracticeLevel {
    #[serde(rename = "UID")]
    pub uid: String,
    #[serde(rename = "WorkshopID")]
    pub workshop_id: u64,
    #[serde(rename = "Name")]
    pub name: String,
    #[serde(rename = "Author")]
    pub author: String,
    #[serde(rename = "Collaborators", default)]
    pub collaborators: String,
    #[serde(rename = "OverrideAuthorName", default)]
    pub override_author_name: String,
}

#[derive(Debug, Deserialize)]
pub struct PracticePlaylist {
    pub levels: Vec<PracticeLevel>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PracticePayload {
    pub level: PracticeLevel,
    pub object_key: String,
    pub sha256: String,
    pub byte_size: usize,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PracticeBundle {
    pub round_id: i32,
    pub playlist: String,
    pub levels: Vec<PracticePayload>,
}

pub fn validate_playlist_url(value: &str) -> Result<reqwest::Url> {
    let url = reqwest::Url::parse(value).context("Invalid practice playlist URL")?;
    ensure!(
        matches!(url.scheme(), "http" | "https")
            && url.host_str().is_some()
            && url.username().is_empty()
            && url.password().is_none()
            && value.len() <= 4096,
        "Practice playlist URL must use HTTP(S) without credentials"
    );
    Ok(url)
}

fn validate_levels<'a>(levels: impl Iterator<Item = &'a PracticeLevel>) -> Result<()> {
    let mut seen = HashSet::new();
    for level in levels {
        ensure!(
            level.workshop_id > 0 && !level.uid.is_empty() && level.uid.len() <= 4096,
            "Invalid practice level identity"
        );
        ensure!(
            [
                &level.name,
                &level.author,
                &level.collaborators,
                &level.override_author_name
            ]
            .iter()
            .all(|text| text.len() <= 4096),
            "Practice level text exceeds protocol capacity"
        );
        ensure!(
            seen.insert((level.workshop_id, &level.uid)),
            "Duplicate practice level identity"
        );
    }
    ensure!(
        (1..=1001).contains(&seen.len()),
        "Practice playlist must contain 1 to 1001 levels"
    );
    Ok(())
}

impl PracticePlaylist {
    pub fn parse(bytes: &[u8]) -> Result<Self> {
        ensure!(
            bytes.len() <= MAX_PLAYLIST_BYTES,
            "Practice playlist is too large"
        );
        let source = std::str::from_utf8(bytes)?.trim_start_matches('\u{feff}');
        let playlist: Self = serde_json::from_str(source)?;
        validate_levels(playlist.levels.iter())?;
        Ok(playlist)
    }
}

impl PracticeBundle {
    pub fn validate(&self) -> Result<()> {
        ensure!(self.round_id > 0, "Invalid practice round ID");
        validate_playlist_url(&self.playlist)?;
        validate_levels(self.levels.iter().map(|entry| &entry.level))?;
        for entry in &self.levels {
            ensure!(
                (1..=MAX_LEVEL_BYTES).contains(&entry.byte_size)
                    && entry.sha256.len() == 64
                    && entry.sha256.bytes().all(|b| b.is_ascii_hexdigit())
                    && entry.object_key == format!("zsl-practice/payloads/{}.gz", entry.sha256),
                "Invalid practice payload metadata"
            );
        }
        Ok(())
    }
}

pub async fn fetch_playlist(url: &str) -> Result<PracticePlaylist> {
    let url = validate_playlist_url(url)?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()?;
    let mut response = client.get(url).send().await?.error_for_status()?;
    ensure!(
        response
            .content_length()
            .is_none_or(|size| size <= MAX_PLAYLIST_BYTES as u64),
        "Practice playlist is too large"
    );
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await? {
        ensure!(
            bytes.len() + chunk.len() <= MAX_PLAYLIST_BYTES,
            "Practice playlist is too large"
        );
        bytes.extend_from_slice(&chunk);
    }
    PracticePlaylist::parse(&bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bom_order_shared_workshop_and_saved_flags() -> Result<()> {
        let playlist = PracticePlaylist::parse("\u{feff}{\"roundLength\":420,\"shufflePlaylist\":false,\"levels\":[{\"UID\":\"b\",\"WorkshopID\":3809417598,\"Name\":\"B\",\"Author\":\"author\",\"played\":true},{\"UID\":\"a\",\"WorkshopID\":3809417598,\"Name\":\"A\",\"Author\":\"author\"}]}".as_bytes())?;
        assert_eq!(
            playlist
                .levels
                .iter()
                .map(|l| l.uid.as_str())
                .collect::<Vec<_>>(),
            ["b", "a"]
        );
        Ok(())
    }
    #[test]
    fn rejects_empty_duplicate_and_invalid_urls() {
        assert!(PracticePlaylist::parse(br#"{"levels":[]}"#).is_err());
        let level = r#"{"UID":"x","WorkshopID":1,"Name":"X","Author":"a"}"#;
        assert!(
            PracticePlaylist::parse(format!("{{\"levels\":[{level},{level}]}}").as_bytes())
                .is_err()
        );
        for url in [
            "file:///tmp/x",
            "ftp://example.com/x",
            "https://user:secret@example.com/x",
        ] {
            assert!(validate_playlist_url(url).is_err());
        }
    }
}
