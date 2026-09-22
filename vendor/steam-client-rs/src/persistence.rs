use std::{collections::HashMap, fs, path::PathBuf};

use serde::{Deserialize, Serialize};

use crate::LogOnDetails;

#[derive(Serialize, Deserialize, Clone)]
struct SavedSession {
    account_name: String,
    refresh_token: String,
    steam_id: u64,
}

impl std::fmt::Debug for SavedSession {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SavedSession")
            .field("account_name", &self.account_name)
            .field("steam_id", &self.steam_id)
            // Sensitive field — redacted
            .field("refresh_token", &"<redacted>")
            .finish()
    }
}

pub struct TokenStore {
    path: PathBuf,
}

impl TokenStore {
    pub fn new(filename: &str) -> Self {
        Self { path: PathBuf::from(filename) }
    }

    /// Load all sessions from disk
    fn load_all(&self) -> HashMap<String, SavedSession> {
        if !self.path.exists() {
            return HashMap::new();
        }
        let data = match fs::read_to_string(&self.path) {
            Ok(d) => d,
            Err(_) => return HashMap::new(),
        };
        serde_json::from_str(&data).unwrap_or_default()
    }

    /// Attempt to load a session for a specific user.
    /// If no user specified, returns the first one found (single-user mode).
    pub fn load(&self, account_name: Option<&str>) -> Option<LogOnDetails> {
        let sessions = self.load_all();

        let session = if let Some(name) = account_name {
            sessions.get(name)?
        } else {
            // "Default" behavior: just grab the first one
            sessions.values().next()?
        };

        Some(LogOnDetails {
            account_name: Some(session.account_name.clone()),
            refresh_token: Some(session.refresh_token.clone()),
            // steam_id: Some(session.steam_id), // Useful for pre-filling
            ..Default::default()
        })
    }

    /// Save a token (updates existing entry or adds new one).
    ///
    /// Writes atomically: serialises to a `.tmp` sibling, restricts file
    /// permissions on Unix (0o600), then renames over the destination so a
    /// partial write never leaves a truncated session file on disk.
    pub fn save(&self, account_name: String, token: String, steam_id: u64) -> std::io::Result<()> {
        let mut sessions = self.load_all();

        sessions.insert(
            account_name.clone(),
            SavedSession { account_name: account_name.clone(), refresh_token: token, steam_id },
        );

        let data = serde_json::to_string_pretty(&sessions)?;

        // Build the temp path alongside the destination.
        let mut tmp_path = self.path.clone();
        let mut tmp_name = self.path
            .file_name()
            .map(|n| n.to_os_string())
            .unwrap_or_default();
        tmp_name.push(".tmp");
        tmp_path.set_file_name(tmp_name);

        // Write to the temp file first.
        fs::write(&tmp_path, &data)?;

        // Restrict permissions before the file is moved into place.
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&tmp_path, fs::Permissions::from_mode(0o600))?;
        }

        // On Windows there is no direct stdlib equivalent to chmod 600.
        // ACL restriction (e.g. via SetNamedSecurityInfo) requires windows-sys
        // or similar, which is not a dependency of this crate.  The atomic
        // rename below still ensures no plaintext lingers on a partial write;
        // callers that need tighter ACLs should restrict the parent directory.
        #[cfg(windows)]
        {
            tracing::debug!(
                path = %self.path.display(),
                "TokenStore::save: ACL restriction on Windows is left to the caller; \
                 rename is still atomic to prevent partial-write exposure"
            );
        }

        // Atomic rename: destination either keeps old content or gets new content,
        // never a partially-written file.
        fs::rename(&tmp_path, &self.path)
    }
}
