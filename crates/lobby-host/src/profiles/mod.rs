mod assets;
mod messages;
mod notifications;
mod track_tournament;
mod zsl_submissions;

use crate::{
    config::{ManagedRoomConfig, RoomProfile},
    runtime::LobbyProfile,
};
use anyhow::Result;
use std::sync::Arc;
use zc_core::object_storage::ObjectStorage;
use zc_database::Database;

pub use assets::{SubmissionAsset, SubmissionAssets, TournamentAsset, TournamentAssets};
pub use track_tournament::TrackTournamentProfile;
pub use zsl_submissions::ZslSubmissionsProfile;

pub fn create_profile(
    config: ManagedRoomConfig,
    database: Database,
    storage: Arc<dyn ObjectStorage>,
) -> Result<Arc<dyn LobbyProfile>> {
    match &config.profile {
        RoomProfile::TrackTournament { tournament_type } => Ok(Arc::new(
            TrackTournamentProfile::new(config.clone(), database, storage, *tournament_type)?,
        )),
        RoomProfile::ZslSubmissions { thread_id } => Ok(Arc::new(ZslSubmissionsProfile::new(
            config.clone(),
            database,
            storage,
            thread_id.clone(),
        ))),
    }
}
