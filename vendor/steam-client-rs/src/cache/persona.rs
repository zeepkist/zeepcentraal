//! Persona cache with TTL expiration.
//!
//! This module provides a thread-safe cache for user persona data with
//! configurable TTL (time-to-live) expiration. The cache reduces redundant API
//! calls when fetching the same user's profile data multiple times.
//!
//! # Example
//!
//! ```rust,ignore
//! use steam_client::cache::{PersonaCache, PersonaCacheConfig};
//! use std::time::Duration;
//!
//! // Create cache with custom TTL
//! let config = PersonaCacheConfig {
//!     ttl: Duration::from_secs(600), // 10 minutes
//!     max_size: 500,
//! };
//! let cache = PersonaCache::new(config);
//!
//! // Insert persona data
//! cache.insert(steam_id, persona_data);
//!
//! // Retrieve (returns None if expired)
//! if let Some(persona) = cache.get(&steam_id) {
//!     tracing::info!("Cached: {}", persona.player_name);
//! }
//! ```

use std::{
    sync::RwLock,
    time::{Duration, Instant},
};

use rustc_hash::FxHashMap;

use steamid::SteamID;

use crate::client::UserPersona;

/// Configuration for the persona cache.
#[derive(Debug, Clone)]
pub struct PersonaCacheConfig {
    /// Time-to-live for cached entries.
    ///
    /// Entries older than this duration are considered expired and will be
    /// evicted on access or during cleanup.
    ///
    /// Default: 5 minutes
    pub ttl: Duration,

    /// Maximum number of entries in the cache.
    ///
    /// When the cache reaches this size, expired entries are evicted.
    /// If still at capacity after eviction, the oldest entry is removed.
    ///
    /// Default: 1000
    pub max_size: usize,
}

impl Default for PersonaCacheConfig {
    fn default() -> Self {
        Self {
            ttl: Duration::from_secs(300), // 5 minutes
            max_size: 1000,
        }
    }
}

/// A cached persona entry with timestamp.
#[derive(Debug, Clone)]
pub struct CachedPersona {
    /// The persona data.
    pub data: UserPersona,
    /// When this entry was cached.
    pub cached_at: Instant,
}

impl CachedPersona {
    /// Create a new cached persona entry.
    pub fn new(data: UserPersona) -> Self {
        Self { data, cached_at: Instant::now() }
    }

    /// Check if this entry has expired given a TTL.
    pub fn is_expired(&self, ttl: Duration) -> bool {
        self.cached_at.elapsed() > ttl
    }
}

/// Thread-safe persona cache with TTL expiration.
///
/// This cache stores `UserPersona` data keyed by `SteamID` and automatically
/// considers entries expired after the configured TTL.
#[derive(Debug)]
pub struct PersonaCache {
    /// The internal cache storage.
    cache: RwLock<FxHashMap<SteamID, CachedPersona>>,
    /// Cache configuration.
    config: PersonaCacheConfig,
}

impl PersonaCache {
    /// Create a new persona cache with the given configuration.
    pub fn new(config: PersonaCacheConfig) -> Self {
        Self { cache: RwLock::new(FxHashMap::default()), config }
    }

    /// Get persona from cache if not expired.
    ///
    /// Returns `None` if the entry doesn't exist or has expired.
    pub fn get(&self, steam_id: &SteamID) -> Option<UserPersona> {
        let cache = self.cache.read().ok()?;
        cache.get(steam_id).and_then(|entry| {
            if !entry.is_expired(self.config.ttl) {
                Some(entry.data.clone())
            } else {
                None // Expired
            }
        })
    }

    /// Insert or update a persona in the cache.
    ///
    /// If the cache is at capacity, expired entries are evicted first.
    pub fn insert(&self, steam_id: SteamID, data: UserPersona) {
        if let Ok(mut cache) = self.cache.write() {
            // Evict expired entries if at capacity
            if cache.len() >= self.config.max_size {
                self.evict_expired_internal(&mut cache);
            }

            // If still at capacity after eviction, remove oldest entry
            if cache.len() >= self.config.max_size {
                self.evict_oldest_internal(&mut cache);
            }

            cache.insert(steam_id, CachedPersona::new(data));
        }
    }

    /// Bulk get - returns found (non-expired) entries and missing SteamIDs.
    ///
    /// This is useful for optimizing batch lookups where you want to know
    /// which IDs need to be fetched from Steam.
    ///
    /// # Returns
    /// A tuple of (found_personas, missing_steam_ids)
    pub fn get_many(&self, steam_ids: &[SteamID]) -> (Vec<UserPersona>, Vec<SteamID>) {
        let mut found = Vec::new();
        let mut missing = Vec::new();

        if let Ok(cache) = self.cache.read() {
            for id in steam_ids {
                if let Some(entry) = cache.get(id) {
                    if !entry.is_expired(self.config.ttl) {
                        found.push(entry.data.clone());
                    } else {
                        missing.push(*id);
                    }
                } else {
                    missing.push(*id);
                }
            }
        } else {
            // If we can't acquire lock, treat all as missing
            missing.extend(steam_ids.iter().copied());
        }

        (found, missing)
    }

    /// Clear the entire cache.
    pub fn clear(&self) {
        if let Ok(mut cache) = self.cache.write() {
            cache.clear();
        }
    }

    /// Invalidate a specific entry.
    ///
    /// Use this when you know a user's data has changed and the cache
    /// should be refreshed on next access.
    pub fn invalidate(&self, steam_id: &SteamID) {
        if let Ok(mut cache) = self.cache.write() {
            cache.remove(steam_id);
        }
    }

    /// Get the current number of entries in the cache (including expired).
    pub fn len(&self) -> usize {
        self.cache.read().map(|c| c.len()).unwrap_or(0)
    }

    /// Check if the cache is empty.
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Get the cache configuration.
    pub fn config(&self) -> &PersonaCacheConfig {
        &self.config
    }

    /// Evict all expired entries.
    ///
    /// This can be called periodically to clean up stale entries.
    pub fn evict_expired(&self) {
        if let Ok(mut cache) = self.cache.write() {
            self.evict_expired_internal(&mut cache);
        }
    }

    /// Internal helper to evict expired entries.
    fn evict_expired_internal(&self, cache: &mut FxHashMap<SteamID, CachedPersona>) {
        let ttl = self.config.ttl;
        cache.retain(|_, entry| !entry.is_expired(ttl));
    }

    /// Internal helper to evict the oldest entry.
    fn evict_oldest_internal(&self, cache: &mut FxHashMap<SteamID, CachedPersona>) {
        if let Some((oldest_id, _)) = cache.iter().min_by_key(|(_, entry)| entry.cached_at).map(|(id, entry)| (*id, entry.cached_at)) {
            cache.remove(&oldest_id);
        }
    }
}

impl Default for PersonaCache {
    fn default() -> Self {
        Self::new(PersonaCacheConfig::default())
    }
}

impl Clone for PersonaCache {
    fn clone(&self) -> Self {
        let cache_data = self.cache.read().map(|c| c.clone()).unwrap_or_default();

        Self { cache: RwLock::new(cache_data), config: self.config.clone() }
    }
}

#[cfg(test)]
mod tests {
    use steam_enums::EPersonaState;

    use super::*;

    fn create_test_persona(steam_id: SteamID, name: &str) -> UserPersona {
        UserPersona { steam_id, player_name: name.to_string(), persona_state: EPersonaState::Online, ..Default::default() }
    }

    #[test]
    fn test_cache_insert_and_get() {
        let cache = PersonaCache::default();
        let steam_id = SteamID::from_steam_id64(76561198000000001);
        let persona = create_test_persona(steam_id, "TestUser");

        cache.insert(steam_id, persona.clone());

        let retrieved = cache.get(&steam_id);
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().player_name, "TestUser");
    }

    #[test]
    fn test_cache_miss() {
        let cache = PersonaCache::default();
        let steam_id = SteamID::from_steam_id64(76561198000000001);

        let retrieved = cache.get(&steam_id);
        assert!(retrieved.is_none());
    }

    #[test]
    fn test_cache_invalidate() {
        let cache = PersonaCache::default();
        let steam_id = SteamID::from_steam_id64(76561198000000001);
        let persona = create_test_persona(steam_id, "TestUser");

        cache.insert(steam_id, persona);
        assert!(cache.get(&steam_id).is_some());

        cache.invalidate(&steam_id);
        assert!(cache.get(&steam_id).is_none());
    }

    #[test]
    fn test_cache_clear() {
        let cache = PersonaCache::default();
        let steam_id1 = SteamID::from_steam_id64(76561198000000001);
        let steam_id2 = SteamID::from_steam_id64(76561198000000002);

        cache.insert(steam_id1, create_test_persona(steam_id1, "User1"));
        cache.insert(steam_id2, create_test_persona(steam_id2, "User2"));
        assert_eq!(cache.len(), 2);

        cache.clear();
        assert!(cache.is_empty());
    }

    #[test]
    fn test_cache_get_many_partial() {
        let cache = PersonaCache::default();
        let id1 = SteamID::from_steam_id64(76561198000000001);
        let id2 = SteamID::from_steam_id64(76561198000000002);
        let id3 = SteamID::from_steam_id64(76561198000000003);

        cache.insert(id1, create_test_persona(id1, "User1"));
        cache.insert(id2, create_test_persona(id2, "User2"));
        // id3 not in cache

        let (found, missing) = cache.get_many(&[id1, id2, id3]);

        assert_eq!(found.len(), 2);
        assert_eq!(missing.len(), 1);
        assert_eq!(missing[0], id3);
    }

    #[test]
    fn test_cache_expired_entry() {
        // Create cache with very short TTL
        let config = PersonaCacheConfig { ttl: Duration::from_millis(1), max_size: 100 };
        let cache = PersonaCache::new(config);
        let steam_id = SteamID::from_steam_id64(76561198000000001);
        let persona = create_test_persona(steam_id, "TestUser");

        cache.insert(steam_id, persona);

        // Wait for entry to expire
        std::thread::sleep(Duration::from_millis(10));

        // Should return None for expired entry
        assert!(cache.get(&steam_id).is_none());
    }

    #[test]
    fn test_cache_max_size_eviction() {
        let config = PersonaCacheConfig { ttl: Duration::from_secs(300), max_size: 3 };
        let cache = PersonaCache::new(config);

        // Insert 3 entries
        for i in 1..=3 {
            let id = SteamID::from_steam_id64(76561198000000000 + i);
            cache.insert(id, create_test_persona(id, &format!("User{}", i)));
        }
        assert_eq!(cache.len(), 3);

        // Insert 4th entry - should evict oldest
        let id4 = SteamID::from_steam_id64(76561198000000004);
        cache.insert(id4, create_test_persona(id4, "User4"));

        assert_eq!(cache.len(), 3);
        assert!(cache.get(&id4).is_some()); // New entry exists
    }

    #[test]
    fn test_cached_persona_is_expired() {
        let persona = create_test_persona(SteamID::from_steam_id64(76561198000000001), "TestUser");
        let cached = CachedPersona::new(persona);

        // Should not be expired immediately
        assert!(!cached.is_expired(Duration::from_secs(300)));

        // Should be expired with 0 TTL
        assert!(cached.is_expired(Duration::ZERO));
    }
}
