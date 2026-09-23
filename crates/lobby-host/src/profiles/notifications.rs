use super::messages::StandingResult;
use std::collections::{HashMap, HashSet};
use tokio::time::{Duration, Instant};
use zc_database::services::lobby_assets::TournamentLobbyStanding;

#[derive(Clone, Copy)]
struct Pending {
    previous: Option<StandingResult>,
    current: StandingResult,
    due: Instant,
}

#[derive(Default)]
pub struct StandingNotifications {
    baselines: HashMap<u64, Option<StandingResult>>,
    pending: HashMap<u64, Pending>,
    ready: bool,
}

impl StandingNotifications {
    pub fn set_ready(&mut self, ready: bool) {
        self.ready = ready;
        if !ready {
            self.pending.clear();
        }
    }

    pub fn reset(&mut self) {
        self.baselines.clear();
        self.pending.clear();
    }

    pub fn set_roster(&mut self, ids: &[u64]) {
        let roster: HashSet<u64> = ids.iter().copied().collect();
        self.baselines.retain(|id, _| roster.contains(id));
        self.pending.retain(|id, _| roster.contains(id));
    }

    pub fn update(&mut self, ids: &[u64], rows: &[TournamentLobbyStanding], now: Instant) {
        self.set_roster(ids);
        let results: HashMap<u64, StandingResult> = rows
            .iter()
            .filter_map(|row| {
                let steam_id = u64::try_from(row.steam_id).ok()?;
                Some((
                    steam_id,
                    StandingResult {
                        rank: row.rank,
                        time: row.time,
                        points: row.points,
                    },
                ))
            })
            .collect();
        for id in ids {
            let current = results.get(id).copied();
            let initialized = self.baselines.contains_key(id);
            let previous = self.baselines.insert(*id, current).flatten();
            let Some(current) = current else {
                self.pending.remove(id);
                continue;
            };
            if !initialized || !self.ready {
                continue;
            }
            if let Some(pending) = self.pending.get_mut(id) {
                pending.current = current;
            } else if should_notify(previous, current) {
                self.pending.insert(
                    *id,
                    Pending {
                        previous,
                        current,
                        due: now + Duration::from_secs(1),
                    },
                );
            }
        }
    }

    pub fn next_due(&self) -> Option<Instant> {
        self.pending.values().map(|item| item.due).min()
    }

    pub fn drain_due(
        &mut self,
        now: Instant,
    ) -> Vec<(u64, Option<StandingResult>, StandingResult)> {
        if !self.ready {
            return Vec::new();
        }
        let ids: Vec<u64> = self
            .pending
            .iter()
            .filter(|(_, item)| item.due <= now)
            .map(|(id, _)| *id)
            .collect();
        ids.into_iter()
            .filter_map(|id| {
                let pending = self.pending.remove(&id)?;
                if self.baselines.contains_key(&id)
                    && should_notify(pending.previous, pending.current)
                {
                    Some((id, pending.previous, pending.current))
                } else {
                    None
                }
            })
            .collect()
    }
}

fn should_notify(previous: Option<StandingResult>, current: StandingResult) -> bool {
    previous.is_none_or(|previous| previous.rank != current.rank || current.time < previous.time)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(rank: i32, time: f32) -> TournamentLobbyStanding {
        TournamentLobbyStanding {
            user_id: 1,
            record_id: 1,
            steam_id: 42,
            steam_name: None,
            time,
            rank,
            points: 630,
        }
    }

    #[test]
    fn first_snapshot_silent_then_coalesces_from_earliest_baseline() {
        let now = Instant::now();
        let mut state = StandingNotifications::default();
        state.set_ready(true);
        state.update(&[42], &[row(15, 34.75)], now);
        assert_eq!(state.next_due(), None);
        state.update(&[42], &[row(14, 34.75)], now);
        let due = state.next_due().unwrap();
        state.update(&[42], &[row(12, 34.234)], now + Duration::from_millis(500));
        assert_eq!(state.next_due(), Some(due));
        assert!(state.drain_due(now + Duration::from_millis(999)).is_empty());
        let sent = state.drain_due(due);
        assert_eq!(sent.len(), 1);
        assert_eq!(sent[0].1.unwrap().rank, 15);
        assert_eq!(sent[0].2.rank, 12);
        assert!(state.drain_due(due).is_empty());
    }

    #[test]
    fn first_result_after_confirmed_unranked_and_cancellation() {
        let now = Instant::now();
        let mut state = StandingNotifications::default();
        state.set_ready(true);
        state.update(&[42], &[], now);
        state.update(&[42], &[row(15, 34.75)], now);
        assert!(state.drain_due(now + Duration::from_secs(1))[0].1.is_none());
        state.update(&[42], &[row(14, 34.75)], now);
        state.set_roster(&[]);
        assert!(state.drain_due(now + Duration::from_secs(1)).is_empty());
        state.update(&[42], &[], now);
        state.update(&[42], &[row(15, 34.75)], now);
        state.set_ready(false);
        assert!(state.drain_due(now + Duration::from_secs(1)).is_empty());
        state.reset();
        assert_eq!(state.next_due(), None);
    }

    #[test]
    fn ignores_points_only_and_net_reversal() {
        let now = Instant::now();
        let mut state = StandingNotifications::default();
        state.set_ready(true);
        state.update(&[42], &[row(15, 34.75)], now);
        let mut points = row(15, 34.75);
        points.points = 650;
        state.update(&[42], &[points], now);
        assert_eq!(state.next_due(), None);
        state.update(&[42], &[row(14, 34.75)], now);
        state.update(&[42], &[row(15, 34.75)], now);
        assert!(state.drain_due(now + Duration::from_secs(1)).is_empty());
    }
}
