use std::time::Duration;
use tokio::time::Instant;
use zc_core::zeepnet::{GameHostPacket, LobbyTiming};

#[derive(Clone, Debug, PartialEq)]
pub(crate) struct RoundKey {
    pub uid: String,
    pub workshop_id: u64,
    pub loaded_at: f64,
}

#[derive(Clone, Debug)]
pub(crate) struct ServerRound {
    pub key: RoundKey,
    pub seconds: f64,
    clock_origin: f64,
    pub state: i32,
    pub deadline_ms: Option<i64>,
}

impl ServerRound {
    pub fn remaining(&self, remote_now: f64) -> f64 {
        self.clock_origin + self.seconds - remote_now
    }
}

#[derive(Default)]
pub(super) struct RoundClock {
    pub round: Option<ServerRound>,
    pub previous: Option<ServerRound>,
    state: Option<i32>,
    waiting_for_properties: bool,
    countdown: bool,
    pub last_message: Option<Instant>,
    pub overlay: OverlayClock,
}

#[derive(Default)]
pub(super) struct OverlayClock {
    pub evaluated: Option<Instant>,
    pub submitted: Option<OverlaySubmission>,
    pub joins: u64,
    pub revision: u64,
}

pub(super) struct OverlaySubmission {
    pub content: String,
    pub written: Instant,
    pub refresh: Instant,
    pub joins: u64,
}

impl RoundClock {
    pub fn observe(
        &mut self,
        packet: &GameHostPacket,
        received_at: jiff::Timestamp,
        remote_now: Option<f64>,
    ) -> bool {
        let timing = match packet {
            GameHostPacket::Initial { timing, .. } => {
                self.state = Some(timing.game_state);
                timing.clone()
            }
            GameHostPacket::GameProperties {
                level_loaded_at,
                round_time,
                uid,
                workshop_id,
            } => LobbyTiming {
                game_state: self.state.unwrap_or(1),
                level_loaded_at: *level_loaded_at,
                round_time: *round_time,
                uid: uid.clone(),
                workshop_id: *workshop_id,
            },
            GameHostPacket::GameState(state) => {
                if *state != 0 && self.state == Some(0) {
                    self.waiting_for_properties = true;
                }
                self.state = Some(*state);
                if let Some(round) = &mut self.round
                    && (*state != 0 || !self.waiting_for_properties)
                {
                    round.state = *state;
                }
                return true;
            }
            GameHostPacket::Timer(value) => {
                let Some(round) = &mut self.round else {
                    return false;
                };
                let Some(seconds) = timer_seconds(value) else {
                    return false;
                };
                let Some(now) = remote_now else {
                    return false;
                };
                if round.state != 0
                    || self.waiting_for_properties
                    || seconds <= 0.0
                    || seconds >= round.seconds
                    || self.countdown
                    || (round.remaining(now) - seconds).abs() > 2.0
                {
                    return false;
                }
                // The first running sample is below the announced full duration.
                // The remote clock rejects delayed text packets from the prior round.
                round.deadline_ms.get_or_insert_with(|| {
                    deadline_ms(received_at, round.clock_origin, round.seconds, now)
                });
                self.countdown = true;
                return true;
            }
            GameHostPacket::Time {
                round_time,
                level_loaded_at,
            } => {
                let Some(round) = &mut self.round else {
                    return false;
                };
                if round.state != 0
                    || self.waiting_for_properties
                    || !round_time.is_finite()
                    || *round_time <= 0.0
                    || !level_loaded_at.is_finite()
                {
                    return false;
                }
                // A timer correction can change the clock origin without loading a level.
                round.seconds = *round_time;
                round.deadline_ms = remote_now
                    .map(|now| deadline_ms(received_at, *level_loaded_at, *round_time, now));
                round.clock_origin = *level_loaded_at;
                return true;
            }
            _ => return false,
        };
        if !timing.level_loaded_at.is_finite()
            || !timing.round_time.is_finite()
            || timing.round_time <= 0.0
            || timing.uid.is_empty()
        {
            return false;
        }
        let key = RoundKey {
            uid: timing.uid,
            workshop_id: timing.workshop_id,
            loaded_at: timing.level_loaded_at,
        };
        if let Some(round) = &self.round {
            if key.loaded_at < round.key.loaded_at
                || (key.loaded_at == round.key.loaded_at && key != round.key)
                || (key == round.key && self.waiting_for_properties)
            {
                return false;
            }
            if key == round.key && round.seconds == timing.round_time && round.deadline_ms.is_some()
            {
                return false;
            }
        }
        let new_round = self.round.as_ref().is_none_or(|round| round.key != key);
        let needs_playing = new_round && self.round.as_ref().is_some_and(|round| round.state == 0);
        if new_round {
            self.previous = self.round.take();
            self.waiting_for_properties = false;
            self.countdown = false;
            self.last_message = None;
            self.overlay = OverlayClock::default();
        }
        let deadline_ms =
            remote_now.map(|now| deadline_ms(received_at, key.loaded_at, timing.round_time, now));
        self.round = Some(ServerRound {
            clock_origin: key.loaded_at,
            key,
            seconds: timing.round_time,
            state: if needs_playing { 1 } else { timing.game_state },
            deadline_ms,
        });
        true
    }

    pub fn message_deadline(&self, interval: Duration) -> Option<Instant> {
        (self.countdown && self.round.as_ref().is_some_and(|round| round.state == 0)).then(|| {
            if let Some(evaluated) = self.overlay.evaluated {
                let ordinary = self
                    .overlay
                    .submitted
                    .as_ref()
                    .map_or(evaluated, |sent| evaluated.max(sent.written))
                    + interval;
                self.overlay
                    .submitted
                    .as_ref()
                    .map_or(ordinary, |sent| ordinary.min(sent.refresh))
            } else {
                self.last_message
                    .map_or_else(Instant::now, |last| last + interval)
            }
        })
    }
}

fn deadline_ms(
    received_at: jiff::Timestamp,
    loaded_at: f64,
    round_time: f64,
    remote_now: f64,
) -> i64 {
    received_at
        .as_millisecond()
        .saturating_add(((loaded_at + round_time - remote_now) * 1000.0).ceil() as i64)
}

fn timer_seconds(value: &str) -> Option<f64> {
    let mut parts = value.trim().rsplit(':');
    let seconds: f64 = parts.next()?.parse().ok()?;
    if !seconds.is_finite() || seconds < 0.0 {
        return None;
    }
    let mut total = seconds;
    for (index, part) in parts.enumerate() {
        if index > 1 || (index == 0 && seconds >= 60.0) {
            return None;
        }
        let part: u32 = part.parse().ok()?;
        total += f64::from(part) * if index == 0 { 60.0 } else { 3600.0 };
    }
    Some(total)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn countdown_bypasses_previous_round_interval_and_uses_server_origin() -> anyhow::Result<()> {
        let mut clock = RoundClock::default();
        let received = jiff::Timestamp::from_millisecond(10_000)?;
        let properties = |loaded_at| GameHostPacket::GameProperties {
            uid: "same-level".into(),
            workshop_id: 42,
            level_loaded_at: loaded_at,
            round_time: 420.0,
        };
        let timer = |text: &str| GameHostPacket::Timer(text.to_owned());
        let interval = Duration::from_secs(60);
        assert!(clock.observe(&properties(113.0), received, Some(100.0)));
        assert!(clock.observe(&GameHostPacket::GameState(0), received, Some(113.0)));
        assert_eq!(clock.round.as_ref().unwrap().deadline_ms, Some(443_000));
        assert!(!clock.observe(&timer("7:00"), received, Some(113.0)));
        assert!(!clock.observe(&timer("0:13"), received, Some(114.0)));
        assert!(clock.observe(&timer("6:59"), received, Some(114.0)));
        let sent = Instant::now();
        assert!(clock.message_deadline(interval).unwrap() >= sent);
        clock.last_message = Some(sent);
        assert!(!clock.observe(&timer("6:58"), received, Some(115.0)));
        assert_eq!(clock.message_deadline(interval), Some(sent + interval));
        assert!(clock.observe(
            &GameHostPacket::Time {
                round_time: 421.0,
                level_loaded_at: 113.0
            },
            received,
            Some(115.0),
        ));
        assert_eq!(clock.round.as_ref().unwrap().deadline_ms, Some(429_000));
        assert!(clock.observe(&GameHostPacket::GameState(2), received, Some(533.0)));
        assert!(clock.message_deadline(interval).is_none());
        assert!(clock.observe(&GameHostPacket::GameState(0), received, Some(547.0)));
        assert!(!clock.observe(&properties(113.0), received, Some(547.0)));
        assert!(!clock.observe(&timer("6:59"), received, Some(547.0)));
        assert!(clock.observe(&properties(547.0), received, Some(547.0)));
        assert_eq!(clock.previous.as_ref().unwrap().deadline_ms, Some(429_000));
        assert!(clock.observe(&timer("6:59"), received, Some(548.0)));
        assert!(clock.last_message.is_none());
        assert!(clock.message_deadline(interval).is_some());
        Ok(())
    }
}
