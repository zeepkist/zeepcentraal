use super::messages::escape_text;
use anyhow::{Context, Result, ensure};
use jiff::Timestamp;
use std::sync::{
    RwLock,
    atomic::{AtomicBool, Ordering},
};
use zc_database::{Database, services::practice::PracticeScheduleRow};

pub const CLOSURE_MESSAGE: &str = "Zeepkist Super League will be starting soon, please return to the Zeepkist lobby list. A new room will be created for the tournament.";
pub const NOTICE_SECONDS: [i64; 5] = [300, 240, 180, 120, 30];

#[derive(Clone, Debug)]
pub struct PracticeSchedule {
    pub name: String,
    pub first: Timestamp,
    pub second: Timestamp,
}
impl PracticeSchedule {
    pub fn from_row(row: PracticeScheduleRow) -> Result<Self> {
        let first = row.event_date.parse()?;
        let second = row
            .event2_date
            .context("Practice round has no Timeslot 2 start")?
            .parse()?;
        ensure!(
            !row.name.trim().is_empty() && second > first,
            "Invalid practice round schedule"
        );
        Ok(Self {
            name: row.name,
            first,
            second,
        })
    }
    pub fn close_at(&self, now: Timestamp) -> Timestamp {
        let first_close = self.first.as_second() - 600;
        let final_close = self.second.as_second() - 600;
        let deadline = if now.as_second() < self.first.as_second() + 7200 {
            first_close
        } else {
            final_close
        };
        Timestamp::from_second(deadline.min(final_close)).expect("valid schedule timestamp")
    }
    pub fn is_open(&self, now: Timestamp) -> bool {
        let now = now.as_second();
        now < self.second.as_second() - 600
            && (now < self.first.as_second() - 600 || now >= self.first.as_second() + 7200)
    }
    pub fn title(&self) -> String {
        format!("ZSL {} Practice", self.name.trim())
    }
    pub fn overlay(
        &self,
        entries: usize,
        position: usize,
        duration: u64,
        now: Timestamp,
    ) -> String {
        let remaining = (self.close_at(now).as_second() - now.as_second()).max(0);
        format!(
            "/servermessage yellow {duration} <size=160%><b>{}</b>\nLevel {position} of {entries}\nCloses in {}d {}h {}m</size>",
            escape_text(&self.title()),
            remaining / 86400,
            remaining % 86400 / 3600,
            remaining % 3600 / 60,
        )
    }
    pub fn welcome(&self, player: &str, duration: u64, now: Timestamp) -> String {
        let remaining = (self.close_at(now).as_second() - now.as_second()).max(0);
        format!(
            "<size=85%><color=#dedede>Welcome to {}, {}!<br><br>Practice every level in playlist order. The playlist repeats, with {duration} seconds per level.<br><br>This room closes in {}h {}m {}s before the tournament.<br><br><size=65%>This is an unattended room, so chat is not monitored. If you find something wrong, please contact Akane on Discord.</size></color></size>",
            escape_text(&self.title()),
            escape_text(player),
            remaining / 3600,
            remaining % 3600 / 60,
            remaining % 60
        )
    }
}

pub struct PracticeState {
    database: Option<Database>,
    round_id: i32,
    schedule: RwLock<Option<PracticeSchedule>>,
    pending_clear: AtomicBool,
}
impl PracticeState {
    pub fn new(database: Database, round_id: i32) -> Self {
        Self {
            database: Some(database),
            round_id,
            schedule: RwLock::new(None),
            pending_clear: AtomicBool::new(false),
        }
    }
    #[cfg(test)]
    pub fn for_test(schedule: PracticeSchedule) -> Self {
        Self {
            database: None,
            round_id: 50,
            schedule: RwLock::new(Some(schedule)),
            pending_clear: AtomicBool::new(false),
        }
    }
    pub fn schedule(&self) -> Option<PracticeSchedule> {
        self.schedule.read().unwrap().clone()
    }
    pub async fn refresh(&self) -> Result<()> {
        let row = self
            .database
            .as_ref()
            .context("Practice schedule database unavailable")?
            .practice_schedule(self.round_id)
            .await?;
        let schedule = row.map(PracticeSchedule::from_row).transpose();
        match schedule {
            Ok(schedule) => {
                *self.schedule.write().unwrap() = schedule;
                Ok(())
            }
            Err(error) => {
                *self.schedule.write().unwrap() = None;
                Err(error)
            }
        }
    }
    pub fn needs_clear(&self) -> bool {
        self.pending_clear.load(Ordering::Acquire)
    }
    pub async fn clear_join_id(&self, key: &str) -> Result<()> {
        self.pending_clear.store(true, Ordering::Release);
        self.database
            .as_ref()
            .context("Practice schedule database unavailable")?
            .clear_managed_lobby_join_id(key)
            .await?;
        self.pending_clear.store(false, Ordering::Release);
        Ok(())
    }
    pub fn close_at(&self) -> Timestamp {
        let now = Timestamp::now();
        self.schedule()
            .map_or(now, |schedule| schedule.close_at(now))
    }
}

/// Tracks absolute warning thresholds. Elapsed notices on first observation are skipped.
#[derive(Default)]
pub struct ClosureNotices {
    deadline: Option<i64>,
    sent: [bool; 5],
}
impl ClosureNotices {
    pub fn due(&mut self, deadline: Timestamp, now: Timestamp) -> bool {
        let deadline = deadline.as_second();
        let now = now.as_second();
        if self.deadline != Some(deadline) {
            self.deadline = Some(deadline);
            self.sent = NOTICE_SECONDS.map(|offset| deadline - offset < now);
        }
        let mut due = false;
        for (index, offset) in NOTICE_SECONDS.iter().enumerate() {
            if !self.sent[index] && now >= deadline - offset {
                self.sent[index] = true;
                due = true;
            }
        }
        due && now < deadline
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn time(second: i64) -> Timestamp {
        Timestamp::from_second(second).unwrap()
    }
    fn schedule(second: i64) -> PracticeSchedule {
        PracticeSchedule {
            name: "Mixed <Surfaces>".into(),
            first: time(10000),
            second: time(second),
        }
    }
    #[test]
    fn exact_boundaries_and_restart() {
        let schedule = schedule(30000);
        for (now, open) in [
            (9399, true),
            (9400, false),
            (10000, false),
            (17199, false),
            (17200, true),
            (29399, true),
            (29400, false),
            (100000, false),
        ] {
            assert_eq!(schedule.is_open(time(now)), open, "at {now}");
        }
        assert_eq!(schedule.close_at(time(9000)), time(9400));
        assert_eq!(schedule.close_at(time(17200)), time(29400));
        assert!(!super::tests::schedule(17000).is_open(time(17200)));
    }
    #[test]
    fn all_warnings_once_and_reconnect_skips_elapsed() {
        let mut notices = ClosureNotices::default();
        assert!(!notices.due(time(1000), time(699)));
        for now in [700, 760, 820, 880, 970] {
            assert!(notices.due(time(1000), time(now)));
            assert!(!notices.due(time(1000), time(now)));
        }
        assert!(!ClosureNotices::default().due(time(1000), time(881)));
        assert!(!notices.due(time(1000), time(1000)));
    }
    #[test]
    fn practice_messages_and_duration() {
        let schedule = schedule(30000);
        let overlay = schedule.overlay(14, 3, 900, time(9000));
        assert!(overlay.starts_with("/servermessage yellow 900"));
        assert!(overlay.contains("Level 3 of 14"));
        assert!(overlay.contains("Mixed &lt;Surfaces&gt;"));
        assert!(
            schedule
                .welcome("<Player>", 900, time(9000))
                .contains("&lt;Player&gt;")
        );
    }
    #[test]
    fn countdown_uses_days_hours_minutes_until_next_closure() {
        let remaining = 4 * 86400 + 8 * 3600 + 34 * 60;
        let schedule = PracticeSchedule {
            name: "Test".into(),
            first: time(1000 + remaining + 600),
            second: time(1000 + remaining + 86400),
        };
        assert!(
            schedule
                .overlay(14, 1, 900, time(1000))
                .contains("Closes in 4d 8h 34m")
        );
    }
    #[tokio::test]
    async fn failed_join_id_clear_remains_required_before_reopen() {
        let state = PracticeState::for_test(schedule(30000));
        assert!(!state.needs_clear());
        assert!(state.clear_join_id("practice").await.is_err());
        assert!(state.needs_clear());
    }
    #[test]
    fn missing_and_invalid_schedules_do_not_open() {
        for second in [None, Some("invalid"), Some("2026-10-04T00:00:00Z")] {
            assert!(
                PracticeSchedule::from_row(PracticeScheduleRow {
                    name: "Mixed Surfaces".into(),
                    event_date: "2026-10-05T00:00:00Z".into(),
                    event2_date: second.map(str::to_owned),
                })
                .is_err()
            );
        }
    }
}
