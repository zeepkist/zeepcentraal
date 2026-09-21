use anyhow::{Result, ensure};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationPayload {
    pub sha256: String,
    pub uid: String,
    pub name: String,
    pub author: String,
}

#[derive(Clone, Debug)]
pub struct ValidationMember {
    pub id_validation: i64,
    pub workshop_id: u64,
    pub valid: bool,
    pub payload: Option<ValidationPayload>,
}

#[derive(Clone, Debug)]
pub struct SubmissionPlaylist {
    pub json: String,
    pub digest: String,
    pub members: Vec<ValidationMember>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Playlist<'a> {
    name: String,
    amount_of_levels: usize,
    round_length: u32,
    shuffle_playlist: bool,
    #[serde(rename = "UID")]
    uid: Vec<String>,
    levels: Vec<PlaylistLevel<'a>>,
}

#[derive(Serialize)]
struct PlaylistLevel<'a> {
    #[serde(rename = "UID")]
    uid: &'a str,
    #[serde(rename = "WorkshopID")]
    workshop_id: u64,
    #[serde(rename = "Name")]
    name: &'a str,
    #[serde(rename = "Author")]
    author: &'a str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DigestPlaylist<'a> {
    name: String,
    amount_of_levels: usize,
    round_length: u32,
    shuffle_playlist: bool,
    #[serde(rename = "UID")]
    uid: Vec<String>,
    levels: Vec<DigestPlaylistLevel<'a>>,
}

#[derive(Serialize)]
struct DigestPlaylistLevel<'a> {
    #[serde(rename = "UID")]
    uid: &'a str,
    #[serde(rename = "WorkshopID")]
    workshop_id: String,
    #[serde(rename = "Name")]
    name: &'a str,
    #[serde(rename = "Author")]
    author: &'a str,
}

pub fn create_submission_playlist(
    theme: &str,
    rows: &[ValidationMember],
) -> Result<SubmissionPlaylist> {
    let mut seen = HashSet::new();
    let members: Vec<_> = rows
        .iter()
        .filter(|row| row.valid && row.payload.is_some() && seen.insert(row.workshop_id))
        .cloned()
        .collect();
    ensure!(
        members.len() <= 1_001,
        "Submission playlist exceeds protocol capacity"
    );
    let levels = members
        .iter()
        .map(|member| {
            let payload = member.payload.as_ref().expect("filtered payload");
            PlaylistLevel {
                uid: &payload.uid,
                workshop_id: member.workshop_id,
                name: &payload.name,
                author: &payload.author,
            }
        })
        .collect();
    let playlist = Playlist {
        name: format!("{theme} - {}", members.len()),
        amount_of_levels: members.len(),
        round_length: 300,
        shuffle_playlist: false,
        uid: Vec::new(),
        levels,
    };
    let json = serde_json::to_string(&playlist)?;
    let digest_playlist = DigestPlaylist {
        name: playlist.name.clone(),
        amount_of_levels: playlist.amount_of_levels,
        round_length: playlist.round_length,
        shuffle_playlist: playlist.shuffle_playlist,
        uid: Vec::new(),
        levels: members
            .iter()
            .map(|member| {
                let payload = member.payload.as_ref().expect("filtered payload");
                DigestPlaylistLevel {
                    uid: &payload.uid,
                    workshop_id: member.workshop_id.to_string(),
                    name: &payload.name,
                    author: &payload.author,
                }
            })
            .collect(),
    };
    let digest_source = serde_json::to_string(&(
        &digest_playlist,
        members
            .iter()
            .map(|member| &member.payload.as_ref().expect("filtered payload").sha256)
            .collect::<Vec<_>>(),
    ))?;
    let digest = format!("{:x}", Sha256::digest(digest_source.as_bytes()));
    Ok(SubmissionPlaylist {
        json,
        digest,
        members,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn member(workshop_id: u64, valid: bool, sha: &str) -> ValidationMember {
        ValidationMember {
            id_validation: workshop_id as i64,
            workshop_id,
            valid,
            payload: Some(ValidationPayload {
                sha256: sha.into(),
                uid: format!("uid-{workshop_id}"),
                name: format!("Level {workshop_id}"),
                author: "Author".into(),
            }),
        }
    }

    #[test]
    fn filters_invalid_and_duplicate_members_without_losing_u64_ids() {
        let playlist = create_submission_playlist(
            "Theme",
            &[
                member(u64::MAX, true, "one"),
                member(u64::MAX, true, "two"),
                member(2, false, "three"),
            ],
        )
        .unwrap();
        assert_eq!(playlist.members.len(), 1);
        assert!(
            playlist
                .json
                .contains("\"WorkshopID\":18446744073709551615")
        );
        assert!(playlist.json.contains("\"amountOfLevels\":1"));
        assert_eq!(
            playlist.digest,
            "59657a5ea48897478d258f4e01dfc49bb9760a743b83f8ee82b5ad7e1d4babd4"
        );
    }
}
