use crate::{discord::DiscordRest, submissions::SourceMessage};
use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::HashSet;

pub const COMPONENTS_V2_FLAG: u64 = 1 << 15;

pub fn playlist_message(filename: &str, valid_count: usize, updated_at_epoch: i64) -> Value {
    json!({
        "flags": COMPONENTS_V2_FLAG,
        "allowed_mentions": { "parse": [] },
        "components": [{
            "type": 17,
            "components": [
                {
                    "type": 10,
                    "content": format!(
                        "## Level contest submissions\n{valid_count} valid submissions · Updated <t:{updated_at_epoch}:R>"
                    )
                },
                { "type": 13, "file": { "url": format!("attachment://{filename}") } }
            ]
        }]
    })
}

pub fn publication_filename(thread_id: &str, digest: &str) -> String {
    format!("contest-{thread_id}-{digest}.zeeplist")
}

#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicationState {
    pub digest: Option<String>,
    pub message_id: Option<String>,
    #[serde(default)]
    pub cleanup_ids: Vec<String>,
}

#[derive(Clone, Debug)]
pub struct PublicationContest {
    pub id: i64,
    pub thread_id: String,
    pub publication: PublicationState,
}

#[derive(Clone, Debug)]
pub struct PlaylistVersion {
    pub digest: String,
    pub valid_count: usize,
    pub date_created_epoch: i64,
}

#[async_trait]
pub trait PublicationDiscord: Send + Sync {
    async fn post_attachment(
        &self,
        thread_id: &str,
        payload: &Value,
        filename: &str,
        contents: &[u8],
    ) -> Result<String>;
    async fn delete_message(&self, thread_id: &str, message_id: &str) -> Result<()>;
}

#[async_trait]
impl PublicationDiscord for DiscordRest {
    async fn post_attachment(
        &self,
        thread_id: &str,
        payload: &Value,
        filename: &str,
        contents: &[u8],
    ) -> Result<String> {
        self.post_attachment(thread_id, payload, filename, contents)
            .await
    }

    async fn delete_message(&self, thread_id: &str, message_id: &str) -> Result<()> {
        self.delete_message(thread_id, message_id).await
    }
}

#[async_trait]
pub trait PublicationStore: Send + Sync {
    async fn save_publication(&self, contest_id: i64, state: &PublicationState) -> Result<()>;
}

#[async_trait]
impl PublicationStore for zc_database::Database {
    async fn save_publication(&self, contest_id: i64, state: &PublicationState) -> Result<()> {
        self.save_inspector_publication(contest_id, serde_json::to_value(state)?)
            .await?;
        Ok(())
    }
}

pub async fn publish_discord_playlist<D: PublicationDiscord, S: PublicationStore>(
    discord: &D,
    store: &S,
    bot_id: &str,
    contest: &PublicationContest,
    version: &PlaylistVersion,
    json: &str,
    messages: &[SourceMessage],
) -> Result<PublicationState> {
    let filename = publication_filename(&contest.thread_id, &version.digest);
    let mut publication = contest.publication.clone();
    if publication.digest.as_deref() != Some(&version.digest) || publication.message_id.is_none() {
        let recovered = messages.iter().find(|message| {
            message.author.id == bot_id
                && message
                    .attachments
                    .iter()
                    .any(|attachment| attachment.filename == filename)
        });
        let message_id = match recovered {
            Some(message) => message.id.clone(),
            None => {
                discord
                    .post_attachment(
                        &contest.thread_id,
                        &playlist_message(
                            &filename,
                            version.valid_count,
                            version.date_created_epoch,
                        ),
                        &filename,
                        json.as_bytes(),
                    )
                    .await?
            }
        };
        let mut seen = HashSet::new();
        publication.cleanup_ids = publication
            .cleanup_ids
            .iter()
            .chain(publication.message_id.iter())
            .filter(|id| id.as_str() != message_id && seen.insert((*id).clone()))
            .cloned()
            .collect();
        publication.message_id = Some(message_id);
        publication.digest = Some(version.digest.clone());
        store.save_publication(contest.id, &publication).await?;
    }
    for id in publication.cleanup_ids.clone() {
        if messages
            .iter()
            .any(|message| message.id == id && message.author.id == bot_id)
        {
            discord.delete_message(&contest.thread_id, &id).await?;
        }
        publication.cleanup_ids.retain(|candidate| candidate != &id);
        store.save_publication(contest.id, &publication).await?;
    }
    Ok(publication)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::submissions::{SourceAttachment, SourceAuthor};
    use std::sync::Mutex;

    #[derive(Default)]
    struct Discord {
        posted: Mutex<usize>,
        deleted: Mutex<Vec<String>>,
        fail_delete: bool,
    }

    #[async_trait]
    impl PublicationDiscord for Discord {
        async fn post_attachment(
            &self,
            _: &str,
            payload: &Value,
            _: &str,
            _: &[u8],
        ) -> Result<String> {
            assert_eq!(payload["flags"], COMPONENTS_V2_FLAG);
            *self.posted.lock().unwrap() += 1;
            Ok("new".into())
        }

        async fn delete_message(&self, _: &str, message_id: &str) -> Result<()> {
            if self.fail_delete {
                anyhow::bail!("transient");
            }
            self.deleted.lock().unwrap().push(message_id.into());
            Ok(())
        }
    }

    #[derive(Default)]
    struct Store(Mutex<Vec<PublicationState>>);

    #[async_trait]
    impl PublicationStore for Store {
        async fn save_publication(&self, _: i64, state: &PublicationState) -> Result<()> {
            self.0.lock().unwrap().push(state.clone());
            Ok(())
        }
    }

    fn contest(publication: PublicationState) -> PublicationContest {
        PublicationContest {
            id: 1,
            thread_id: "3".into(),
            publication,
        }
    }

    fn version() -> PlaylistVersion {
        PlaylistVersion {
            digest: "revision".into(),
            valid_count: 1,
            date_created_epoch: 1_757_462_400,
        }
    }

    fn message(id: &str, author: &str, filename: Option<&str>) -> SourceMessage {
        SourceMessage {
            id: id.into(),
            content: String::new(),
            author: SourceAuthor {
                id: author.into(),
                bot: true,
            },
            timestamp: String::new(),
            edited_timestamp: None,
            attachments: filename
                .map(|filename| {
                    vec![SourceAttachment {
                        filename: filename.into(),
                    }]
                })
                .unwrap_or_default(),
            reactions: Vec::new(),
        }
    }

    #[test]
    fn matches_components_v2_attachment_contract() {
        let message = playlist_message("contest.zeeplist", 3, 1_757_462_400);
        assert_eq!(message["flags"], COMPONENTS_V2_FLAG);
        assert_eq!(
            message.pointer("/components/0/components/1/file/url"),
            Some(&json!("attachment://contest.zeeplist"))
        );
        assert_eq!(
            publication_filename("3", "revision"),
            "contest-3-revision.zeeplist"
        );
    }

    #[tokio::test]
    async fn unchanged_digest_sends_and_saves_nothing() {
        let discord = Discord::default();
        let store = Store::default();
        let result = publish_discord_playlist(
            &discord,
            &store,
            "bot",
            &contest(PublicationState {
                digest: Some("revision".into()),
                message_id: Some("old".into()),
                cleanup_ids: Vec::new(),
            }),
            &version(),
            "{}",
            &[],
        )
        .await
        .unwrap();
        assert_eq!(result.message_id.as_deref(), Some("old"));
        assert_eq!(*discord.posted.lock().unwrap(), 0);
        assert!(store.0.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn recovers_post_and_only_deletes_own_previous_message() {
        let discord = Discord::default();
        let store = Store::default();
        let filename = publication_filename("3", "revision");
        let result = publish_discord_playlist(
            &discord,
            &store,
            "bot",
            &contest(PublicationState {
                digest: Some("previous".into()),
                message_id: Some("old".into()),
                cleanup_ids: vec!["unrelated".into()],
            }),
            &version(),
            "{}",
            &[
                message("recovered", "bot", Some(&filename)),
                message("old", "bot", None),
                message("unrelated", "someone-else", None),
            ],
        )
        .await
        .unwrap();
        assert_eq!(result.message_id.as_deref(), Some("recovered"));
        assert!(result.cleanup_ids.is_empty());
        assert_eq!(*discord.deleted.lock().unwrap(), vec!["old"]);
        assert_eq!(*discord.posted.lock().unwrap(), 0);
    }

    #[tokio::test]
    async fn persists_replacement_before_retryable_cleanup() {
        let discord = Discord {
            fail_delete: true,
            ..Discord::default()
        };
        let store = Store::default();
        let result = publish_discord_playlist(
            &discord,
            &store,
            "bot",
            &contest(PublicationState {
                digest: Some("previous".into()),
                message_id: Some("old".into()),
                cleanup_ids: Vec::new(),
            }),
            &version(),
            "{}",
            &[message("old", "bot", None)],
        )
        .await;
        assert!(result.is_err());
        let saved = store.0.lock().unwrap();
        assert_eq!(saved.len(), 1);
        assert_eq!(saved[0].message_id.as_deref(), Some("new"));
        assert_eq!(saved[0].cleanup_ids, vec!["old"]);
    }
}
