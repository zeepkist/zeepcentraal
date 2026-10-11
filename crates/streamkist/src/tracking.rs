use crate::{cards::Snapshot, twitch::Stream};
use std::collections::{HashMap, HashSet};
use zc_database::services::streamkist::{StreamMessage, Watch};

#[derive(Clone, Debug)]
pub struct Candidate {
    pub watch: Watch,
    pub stream: Stream,
}

pub fn candidates(
    watches: &[Watch],
    rows: &[StreamMessage],
    games: &HashMap<String, Vec<Stream>>,
    live: &HashMap<String, Stream>,
) -> Vec<Candidate> {
    let terminal: HashSet<_> = rows
        .iter()
        .filter(|row| row.canonical && row.tracking_state == "finished")
        .map(|row| (row.guild_id.clone(), row.stream_id.clone()))
        .collect();
    let mut result = HashMap::new();
    for watch in watches {
        for category_stream in games.get(&watch.game_id).into_iter().flatten() {
            if terminal.contains(&(watch.guild_id.clone(), category_stream.id.clone())) {
                continue;
            }
            let row = rows.iter().find(|row| {
                row.canonical
                    && row.guild_id == watch.guild_id
                    && row.channel_id == watch.channel_id
                    && row.stream_id == category_stream.id
            });
            if row.is_some_and(|row| row.tracking_state == "finished") {
                continue;
            }
            let stream = if row.is_some() {
                let Some(stream) = live.get(&category_stream.id) else {
                    continue;
                };
                stream
            } else {
                category_stream
            };
            if stream.game_id != watch.game_id
                || (row.is_none_or(|row| row.message_id.is_none())
                    && stream.viewer_count < watch.minimum_viewers)
            {
                continue;
            }
            result.insert(
                (
                    watch.guild_id.clone(),
                    watch.channel_id.clone(),
                    stream.id.clone(),
                ),
                Candidate {
                    watch: watch.clone(),
                    stream: stream.clone(),
                },
            );
        }
    }
    for row in rows
        .iter()
        .filter(|row| row.canonical && row.tracking_state != "finished")
    {
        if terminal.contains(&(row.guild_id.clone(), row.stream_id.clone())) {
            continue;
        }
        let Some(stream) = live.get(&row.stream_id) else {
            continue;
        };
        let channel: Vec<_> = watches
            .iter()
            .filter(|watch| watch.guild_id == row.guild_id && watch.channel_id == row.channel_id)
            .collect();
        let matching = channel.iter().find(|watch| watch.game_id == stream.game_id);
        let policy = matching.copied().or_else(|| {
            if row.tracking_state == "category_paused" || (row.message_id.is_none()) {
                return None;
            }
            channel
                .iter()
                .find(|watch| watch.id == row.policy_watch_id && watch.allow_category_switches)
                .copied()
        });
        if let Some(watch) = policy {
            if row.message_id.is_none() && stream.viewer_count < watch.minimum_viewers {
                continue;
            }
            result.insert(
                (
                    row.guild_id.clone(),
                    row.channel_id.clone(),
                    row.stream_id.clone(),
                ),
                Candidate {
                    watch: watch.clone(),
                    stream: stream.clone(),
                },
            );
        }
    }
    let mut result: Vec<_> = result.into_values().collect();
    let occupied: HashSet<_> = rows
        .iter()
        .filter(|row| row.tracking_state == "active" || row.activation_pending)
        .map(|row| (row.guild_id.clone(), row.stream_id.clone()))
        .collect();
    // When a failed pause leaves fewer free slots, admit higher-ranked replacements first.
    result.sort_by(|a, b| {
        a.watch
            .guild_id
            .cmp(&b.watch.guild_id)
            .then_with(|| b.stream.viewer_count.cmp(&a.stream.viewer_count))
            .then_with(|| {
                occupied
                    .contains(&(b.watch.guild_id.clone(), b.stream.id.clone()))
                    .cmp(&occupied.contains(&(a.watch.guild_id.clone(), a.stream.id.clone())))
            })
            .then_with(|| a.stream.id.cmp(&b.stream.id))
            .then_with(|| a.watch.channel_id.cmp(&b.watch.channel_id))
    });
    result
}

pub fn select(candidates: &[Candidate], rows: &[StreamMessage]) -> HashSet<(String, String)> {
    let occupied: HashSet<_> = rows
        .iter()
        .filter(|row| row.tracking_state == "active" || row.activation_pending)
        .map(|row| (row.guild_id.clone(), row.stream_id.clone()))
        .collect();
    let mut guilds: HashMap<String, HashMap<String, (i32, i32)>> = HashMap::new();
    for candidate in candidates {
        guilds
            .entry(candidate.watch.guild_id.clone())
            .or_default()
            .insert(
                candidate.stream.id.clone(),
                (candidate.stream.viewer_count, candidate.watch.stream_limit),
            );
    }
    let mut selected = HashSet::new();
    for (guild, streams) in guilds {
        let mut streams: Vec<_> = streams.into_iter().collect();
        streams.sort_by(|(a, (av, _)), (b, (bv, _))| {
            bv.cmp(av)
                .then_with(|| {
                    occupied
                        .contains(&(guild.clone(), b.clone()))
                        .cmp(&occupied.contains(&(guild.clone(), a.clone())))
                })
                .then_with(|| a.cmp(b))
        });
        let limit = streams.first().map_or(15, |(_, (_, limit))| *limit);
        selected.extend(
            streams
                .into_iter()
                .take(limit as usize)
                .map(|(stream, _)| (guild.clone(), stream)),
        );
    }
    selected
}

pub fn stopped(previous: &Snapshot, state: &str, now: i64) -> Snapshot {
    let mut next = previous.clone().finish(now);
    if state == "category_paused" {
        next.category_stopped = true;
    }
    if state == "limit_paused" {
        next.category_stopped = false;
    }
    next
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cards;

    fn watch(id: i64, channel: &str, game: &str) -> Watch {
        Watch {
            id,
            guild_id: "guild".into(),
            channel_id: channel.into(),
            game_id: game.into(),
            game_name: game.into(),
            minimum_viewers: 0,
            allow_category_switches: false,
            stream_limit: 15,
        }
    }
    fn stream(id: &str, viewers: i32) -> Stream {
        let mut stream = cards::tests::stream();
        stream.id = id.into();
        stream.viewer_count = viewers;
        stream
    }
    fn row(watch: &Watch, stream: &Stream, state: &str) -> StreamMessage {
        StreamMessage {
            id: 1,
            stream_id: stream.id.clone(),
            user_id: stream.user_id.clone(),
            message_id: Some("100".into()),
            snapshot: serde_json::to_value(Snapshot::live(stream.clone(), 20, 0)).unwrap(),
            peak_viewers: 20,
            is_live: state == "active",
            guild_id: watch.guild_id.clone(),
            channel_id: watch.channel_id.clone(),
            policy_watch_id: watch.id,
            canonical: true,
            tracking_state: state.into(),
            activation_pending: false,
        }
    }
    #[test]
    fn highest_viewership_replaces_low_rank_and_counts_stream_once_across_channels() {
        let watch = watch(1, "channel", "9");
        let mut candidates: Vec<_> = (0..16)
            .map(|number| Candidate {
                watch: watch.clone(),
                stream: stream(&number.to_string(), number),
            })
            .collect();
        let occupied = row(&watch, &candidates[0].stream, "active");
        let mut second = candidates[15].clone();
        second.watch.channel_id = "other-channel".into();
        candidates.push(second);
        let selected = select(&candidates, &[occupied]);
        assert_eq!(selected.len(), 15);
        assert!(!selected.contains(&("guild".into(), "0".into())));
        assert!(selected.contains(&("guild".into(), "15".into())));
    }
    #[test]
    fn paid_limits_and_guilds_are_independent_with_stable_ties() {
        let base = watch(1, "channel", "9");
        let candidates: Vec<_> = (0..31)
            .flat_map(|number| {
                let mut paid = base.clone();
                paid.guild_id = "paid".into();
                paid.stream_limit = 30;
                [
                    Candidate {
                        watch: base.clone(),
                        stream: stream(&format!("{number:02}"), 10),
                    },
                    Candidate {
                        watch: paid,
                        stream: stream(&format!("{number:02}"), 10),
                    },
                ]
            })
            .collect();
        let occupied = row(&base, &stream("30", 10), "active");
        let selected = select(&candidates, &[occupied]);
        assert_eq!(
            selected
                .iter()
                .filter(|(guild, _)| guild == "guild")
                .count(),
            15
        );
        assert_eq!(
            selected.iter().filter(|(guild, _)| guild == "paid").count(),
            30
        );
        assert!(selected.contains(&("guild".into(), "30".into())));
        assert!(selected.contains(&("guild".into(), "00".into())));
        assert!(!selected.contains(&("guild".into(), "14".into())));
    }
    #[test]
    fn activations_rank_highest_replacements_first_when_slots_remain_occupied() {
        let watch = watch(1, "channel", "9");
        let games = HashMap::from([("9".into(), vec![stream("a-low", 5), stream("z-high", 50)])]);
        let result = candidates(&[watch], &[], &games, &HashMap::new());
        assert_eq!(result[0].stream.id, "z-high");
        assert_eq!(result[1].stream.id, "a-low");
    }
    #[test]
    fn minimum_is_admission_only_and_threshold_equality_passes() {
        let mut watch = watch(1, "channel", "9");
        watch.minimum_viewers = 5;
        let mut games = HashMap::from([("9".into(), vec![stream("one", 4)])]);
        assert!(candidates(&[watch.clone()], &[], &games, &HashMap::new()).is_empty());
        games.insert("9".into(), vec![stream("one", 5)]);
        assert_eq!(
            candidates(&[watch.clone()], &[], &games, &HashMap::new()).len(),
            1
        );
        let live = stream("one", 0);
        let announced = row(&watch, &live, "active");
        assert_eq!(
            candidates(
                &[watch.clone()],
                &[announced],
                &HashMap::new(),
                &HashMap::from([("one".into(), live)])
            )
            .len(),
            1
        );
        let mut pending = row(&watch, &stream("pending", 0), "limit_paused");
        pending.message_id = None;
        pending.activation_pending = true;
        assert!(
            candidates(
                std::slice::from_ref(&watch),
                &[pending],
                &HashMap::new(),
                &HashMap::from([("pending".into(), stream("pending", 0))]),
            )
            .is_empty()
        );
        watch.minimum_viewers = 0;
        games.insert("9".into(), vec![stream("one", 0)]);
        assert_eq!(candidates(&[watch], &[], &games, &HashMap::new()).len(), 1);
    }
    #[test]
    fn category_departure_return_and_latest_watch_policy_reuse_card() {
        let first = watch(1, "channel", "9");
        let mut second = watch(2, "channel", "10");
        second.allow_category_switches = true;
        let original = stream("one", 12);
        let mut changed = original.clone();
        changed.game_id = "outside".into();
        let old = row(&first, &original, "active");
        assert!(
            candidates(
                &[first.clone(), second.clone()],
                std::slice::from_ref(&old),
                &HashMap::new(),
                &HashMap::from([("one".into(), changed.clone())])
            )
            .is_empty()
        );
        changed.game_id = "10".into();
        let result = candidates(
            &[first.clone(), second.clone()],
            std::slice::from_ref(&old),
            &HashMap::new(),
            &HashMap::from([("one".into(), changed.clone())]),
        );
        assert_eq!(result[0].watch.id, 2);
        let mut paused = old.clone();
        paused.tracking_state = "category_paused".into();
        let result = candidates(
            &[first.clone(), second.clone()],
            &[paused.clone()],
            &HashMap::new(),
            &HashMap::from([("one".into(), original.clone())]),
        );
        assert_eq!(result.len(), 1);
        paused.policy_watch_id = second.id;
        changed.game_id = "outside".into();
        assert!(
            candidates(
                &[first.clone(), second.clone()],
                &[paused.clone()],
                &HashMap::new(),
                &HashMap::from([("one".into(), changed.clone())])
            )
            .is_empty()
        );
        paused.tracking_state = "limit_paused".into();
        assert_eq!(
            candidates(
                &[first, second],
                &[paused],
                &HashMap::new(),
                &HashMap::from([("one".into(), changed)])
            )
            .len(),
            1
        );
    }
    #[test]
    fn terminal_rows_never_reopen_and_paused_summaries_freeze_peak_and_time() {
        let watch = watch(1, "channel", "9");
        let mut another_channel = watch.clone();
        another_channel.channel_id = "new-channel".into();
        let stream = stream("one", 12);
        let row = row(&watch, &stream, "finished");
        assert!(
            candidates(
                &[watch, another_channel],
                &[row],
                &HashMap::from([("9".into(), vec![stream.clone()])]),
                &HashMap::from([("one".into(), stream.clone())])
            )
            .is_empty()
        );
        let old = Snapshot::live(stream.clone(), 30, 100);
        let paused = stopped(&old, "category_paused", 200);
        assert!(paused.category_stopped);
        assert_eq!(paused.ended_at, Some(200));
        assert_eq!(stopped(&paused, "finished", 300), paused);
        let resumed = Snapshot::live(stream, paused.peak_viewers, 300);
        assert_eq!(resumed.ended_at, None);
        assert!(!resumed.category_stopped);
        assert_eq!(resumed.peak_viewers, 30);
    }
}
