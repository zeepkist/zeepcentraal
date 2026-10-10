mod assets;
pub(crate) mod messages;
mod notifications;
pub(crate) mod practice;
mod track_tournament;
mod zsl;
mod zsl_messages;
mod zsl_submissions;

use crate::{
    config::{ManagedRoomConfig, RoomProfile},
    runtime::LobbyProfile,
};
use anyhow::Result;
use std::sync::Arc;
use zc_core::object_storage::ObjectStorage;
use zc_database::Database;

use assets::SubmissionPlaylist;
pub use assets::{SubmissionAsset, SubmissionAssets, TournamentAsset, TournamentAssets};
pub use track_tournament::TrackTournamentProfile;
pub use zsl_submissions::ZslSubmissionsProfile;

pub fn create_profile(
    config: ManagedRoomConfig,
    database: Database,
    storage: Arc<dyn ObjectStorage>,
) -> Result<Arc<dyn LobbyProfile>> {
    match &config.profile {
        RoomProfile::Zsl { .. } => Ok(Arc::new(zsl::ZslProfile::new(
            config, None, database, storage,
        )?)),
        RoomProfile::TrackTournament { tournament_type } => Ok(Arc::new(
            TrackTournamentProfile::new(config.clone(), database, storage, *tournament_type)?,
        )),
        RoomProfile::ZslPractice { round_id, playlist } => {
            if let Some(tournament) = config.paired_tournament.clone() {
                return Ok(Arc::new(zsl::ZslProfile::new(
                    *tournament,
                    Some(config),
                    database,
                    storage,
                )?));
            }
            Ok(Arc::new(ZslSubmissionsProfile::practice(
                config.clone(),
                database,
                storage,
                *round_id,
                playlist.clone(),
            )))
        }
        RoomProfile::ZslSubmissions { round_id } => Ok(Arc::new(ZslSubmissionsProfile::new(
            config.clone(),
            database,
            storage,
            *round_id,
        ))),
    }
}
