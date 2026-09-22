use std::collections::HashMap;

use steam_enums::EPersonaState;

/// Helper to store and restore session state (games played, rich presence).
#[derive(Debug, Clone, Default)]
pub struct SessionRecovery {
    /// Last known played app IDs.
    pub last_playing_app_ids: Vec<u32>,
    /// Last known playing custom game name (if any).
    pub last_custom_game_name: Option<String>,
    /// Last known rich presence data per app ID.
    pub last_rich_presence: HashMap<u32, HashMap<String, String>>,
    /// Last known persona state.
    pub last_persona_state: Option<EPersonaState>,
    /// Last known player name.
    pub last_player_name: Option<String>,
}

impl SessionRecovery {
    /// Create a new session recovery helper.
    pub fn new() -> Self {
        Self::default()
    }

    /// Record the games currently being played.
    pub fn record_playing(&mut self, app_ids: Vec<u32>, custom_game_name: Option<String>) {
        self.last_playing_app_ids = app_ids;
        self.last_custom_game_name = custom_game_name;
    }

    /// Record rich presence data for an app.
    pub fn record_rich_presence(&mut self, app_id: u32, data: HashMap<String, String>) {
        // If data is empty, we might want to remove it?
        // Or keep it as empty map to signal clearing?
        // Current implementation of clear_rich_presence sends empty map.
        if data.is_empty() {
            self.last_rich_presence.remove(&app_id);
        } else {
            self.last_rich_presence.insert(app_id, data);
        }
    }

    /// Record persona state.
    pub fn record_persona_state(&mut self, state: EPersonaState, name: Option<String>) {
        self.last_persona_state = Some(state);
        if name.is_some() {
            self.last_player_name = name;
        }
    }

    /// Clear all stored state.
    pub fn clear(&mut self) {
        self.last_playing_app_ids.clear();
        self.last_custom_game_name = None;
        self.last_rich_presence.clear();
        self.last_persona_state = None;
        self.last_player_name = None;
    }
}
