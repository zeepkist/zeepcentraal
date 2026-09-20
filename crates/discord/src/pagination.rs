use crate::backend::{LevelProfile, TournamentSnapshot};
use std::{
    collections::VecDeque,
    time::{Duration, Instant},
};

pub const PAGE_SIZE: i64 = 10;
const MAX_SESSIONS: usize = 256;
const DEFAULT_TTL: Duration = Duration::from_secs(15 * 60);

#[derive(Clone)]
pub enum PageKind {
    Level(LevelProfile),
    Tournament(TournamentSnapshot),
}

#[derive(Clone)]
pub struct PageSession {
    pub id: u64,
    pub owner_id: u64,
    pub page: i64,
    pub total_count: i64,
    pub kind: PageKind,
    expires_at: Instant,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Direction {
    First,
    Previous,
    Next,
    Last,
}

impl Direction {
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "first" => Some(Self::First),
            "previous" => Some(Self::Previous),
            "next" => Some(Self::Next),
            "last" => Some(Self::Last),
            _ => None,
        }
    }
}

#[derive(Default)]
pub struct PageStore {
    sessions: VecDeque<PageSession>,
}

impl PageStore {
    pub fn insert(&mut self, id: u64, owner_id: u64, total_count: i64, kind: PageKind) {
        self.cleanup();
        self.sessions.retain(|session| session.id != id);
        if self.sessions.len() >= MAX_SESSIONS {
            self.sessions.pop_front();
        }
        self.sessions.push_back(PageSession {
            id,
            owner_id,
            page: 0,
            total_count,
            kind,
            expires_at: Instant::now() + ttl(),
        });
    }

    pub fn get(&mut self, id: u64) -> Option<PageSession> {
        self.cleanup();
        self.sessions
            .iter()
            .find(|session| session.id == id)
            .cloned()
    }

    pub fn update(&mut self, id: u64, page: i64, total_count: i64) -> Option<PageSession> {
        self.cleanup();
        let session = self.sessions.iter_mut().find(|session| session.id == id)?;
        session.total_count = total_count;
        session.page = page.clamp(0, page_count(total_count) - 1);
        Some(session.clone())
    }

    fn cleanup(&mut self) {
        let now = Instant::now();
        self.sessions.retain(|session| session.expires_at > now);
    }
}

pub fn page_count(total_count: i64) -> i64 {
    ((total_count.max(0) + PAGE_SIZE - 1) / PAGE_SIZE).max(1)
}

pub fn target_page(session: &PageSession, direction: Direction) -> i64 {
    let last = page_count(session.total_count) - 1;
    match direction {
        Direction::First => 0,
        Direction::Previous => (session.page - 1).max(0),
        Direction::Next => (session.page + 1).min(last),
        Direction::Last => last,
    }
}

fn ttl() -> Duration {
    zc_core::environment::var("DISCORD_SESSION_TTL_MS")
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .map(Duration::from_millis)
        .unwrap_or(DEFAULT_TTL)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn level() -> LevelProfile {
        LevelProfile {
            id: 1,
            xx_hash: "hash".into(),
            name: "Level".into(),
            image_url: String::new(),
            workshop_id: "1".into(),
            author_name: None,
            author_discord_id: None,
            points: 0,
            rating: 0.0,
            records: 0,
            personal_bests: 25,
            votes: 0,
            world_record: None,
            leaderboard: Vec::new(),
        }
    }

    #[test]
    fn navigation_is_bounded_and_owner_is_preserved() {
        let mut store = PageStore::default();
        store.insert(7, 9, 25, PageKind::Level(level()));
        let session = store.get(7).unwrap();
        assert_eq!(session.owner_id, 9);
        assert_eq!(target_page(&session, Direction::Previous), 0);
        assert_eq!(target_page(&session, Direction::Last), 2);
        let session = store.update(7, 2, 25).unwrap();
        assert_eq!(target_page(&session, Direction::Next), 2);
        assert_eq!(page_count(0), 1);
    }

    #[test]
    fn store_caps_old_sessions() {
        let mut store = PageStore::default();
        for id in 0..300 {
            store.insert(id, 1, 1, PageKind::Level(level()));
        }
        assert!(store.get(0).is_none());
        assert!(store.get(299).is_some());
    }
}
