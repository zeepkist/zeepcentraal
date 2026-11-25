use anyhow::Result;
use std::{future::Future, sync::Arc};
use zc_core::zeepnet::OnlineLevel;

#[derive(Clone)]
pub struct PreparedLevel {
    pub compressed_data: Arc<[u8]>,
    pub content_sha256: Arc<str>,
    pub level: OnlineLevel,
}

#[derive(Clone)]
pub struct PreparedPlaylist {
    pub levels: Arc<[OnlineLevel]>,
    loader: Arc<dyn LevelLoader>,
}

#[async_trait::async_trait]
pub trait LevelLoader: Send + Sync {
    async fn load(&self, uid: &str, workshop_id: u64) -> Result<Option<PreparedLevel>>;
}

impl PreparedPlaylist {
    pub(crate) fn with_current(&self, level: &OnlineLevel) -> Result<(Self, usize)> {
        if let Some(index) = self
            .levels
            .iter()
            .position(|entry| entry.uid == level.uid && entry.workshop_id == level.workshop_id)
        {
            return Ok((self.clone(), index));
        }
        let mut levels = self.levels.to_vec();
        let index = levels.len();
        levels.push(level.clone());
        Ok((Self::new(levels, self.loader.clone())?, index))
    }

    pub fn new(levels: Vec<OnlineLevel>, loader: Arc<dyn LevelLoader>) -> Result<Self> {
        anyhow::ensure!(
            !levels.is_empty() && levels.len() <= 1_001,
            "Invalid playlist size"
        );
        Ok(Self {
            levels: levels.into(),
            loader,
        })
    }

    pub async fn load(&self, uid: &str, workshop_id: u64) -> Result<Option<PreparedLevel>> {
        if !self
            .levels
            .iter()
            .any(|level| level.uid == uid && level.workshop_id == workshop_id)
        {
            return Ok(None);
        }
        self.loader.load(uid, workshop_id).await
    }
}

pub struct FnLevelLoader<F>(pub F);

#[async_trait::async_trait]
impl<F, Fut> LevelLoader for FnLevelLoader<F>
where
    F: Fn(&str, u64) -> Fut + Send + Sync,
    Fut: Future<Output = Result<Option<PreparedLevel>>> + Send,
{
    async fn load(&self, uid: &str, workshop_id: u64) -> Result<Option<PreparedLevel>> {
        (self.0)(uid, workshop_id).await
    }
}
