use super::*;

#[derive(Clone)]
pub(super) struct NativeTarget {
    target: ActivationTarget,
    asset: SubmissionAsset,
    seconds: f64,
    scoring: Option<ScoringScope>,
}

impl NativeTarget {
    fn matches(&self, round: &ServerRound) -> bool {
        let level = &self.asset.playlist.levels[self.target.2];
        level.uid == round.key.uid && level.workshop_id == round.key.workshop_id
    }
}

impl ZslSession {
    pub(super) fn phase_seconds(&self, phase: Phase) -> f64 {
        match phase {
            Phase::Practice => {
                self.shared
                    .practice
                    .as_ref()
                    .unwrap_or(&self.shared.tournament)
                    .round_time_seconds as f64
            }
            Phase::Tournament => self.shared.tournament.round_time_seconds as f64,
            _ => 300.0,
        }
    }

    async fn warmup_asset(
        &self,
        state: &mut SavedState,
        slot: usize,
    ) -> Result<Option<SubmissionAsset>> {
        if state.warmups[slot].is_none() {
            state.warmups[slot] = self
                .shared
                .selections
                .lock()
                .await
                .warmup
                .as_ref()
                .and_then(|asset| asset.bundle.as_deref().cloned())
                .or_else(|| state.warmup.clone());
        }
        match &state.warmups[slot] {
            Some(bundle) => Ok(Some(self.shared.pinned(bundle, true).await?)),
            None => Ok(None),
        }
    }

    async fn phase_asset(
        &self,
        state: &mut SavedState,
        event: &ZslEvent,
        phase: Phase,
        slot: usize,
    ) -> Result<Option<SubmissionAsset>> {
        match phase {
            Phase::Practice => Ok(self.shared.practice_asset.lock().await.clone()),
            Phase::Warmup => self.warmup_asset(state, slot).await,
            Phase::Tournament => match &state.pinned {
                Some(bundle) => Ok(Some(self.shared.pinned(bundle, false).await?)),
                None => {
                    self.shared
                        .tournament_candidate(event_start(event, slot))
                        .await
                }
            },
            _ => Ok(None),
        }
    }

    pub(super) fn eligible_slot(state: &SavedState, event: &ZslEvent, now: i64) -> usize {
        usize::from(
            now >= event.second - 1200
                && (state.completed[0]
                    || state.failed[0]
                    || (!state.started[0]
                        && !(state.phase == Phase::Warmup && state.timeslot == 0))),
        )
    }

    async fn initial_target(
        &self,
        state: &mut SavedState,
        event: &ZslEvent,
        now: i64,
    ) -> Result<Option<NativeTarget>> {
        let slot = Self::eligible_slot(state, event, now);
        let start = event_start(event, slot);
        if let Some(target) = state.next
            && let Some(asset) = self.phase_asset(state, event, target.0, target.1).await?
            && target.2 < asset.playlist.levels.len()
        {
            let next = NativeTarget {
                target,
                asset,
                seconds: 0.0,
                scoring: None,
            };
            if self.context.server_round().is_some_and(|round| {
                round.state == 0
                    && next.matches(&round)
                    && state
                        .loaded_at
                        .is_none_or(|loaded_at| round.key.loaded_at > loaded_at)
            }) {
                if state.phase == Phase::Tournament {
                    self.finalize_round(state, state.timeslot, state.index)
                        .await?;
                }
                return Ok(Some(next));
            }
        }
        let active = (state.phase, state.timeslot, state.index);
        if matches!(
            active.0,
            Phase::Practice | Phase::Warmup | Phase::Tournament
        ) && !state.completed[active.1]
            && !state.failed[active.1]
            && (active.0 != Phase::Tournament || state.progress[active.1] == active.2)
            && let Some(asset) = self.phase_asset(state, event, active.0, active.1).await?
            && active.2 < asset.playlist.levels.len()
        {
            let current = NativeTarget {
                target: active,
                asset,
                seconds: 0.0,
                scoring: None,
            };
            if self
                .context
                .server_round()
                .is_some_and(|round| round.state == 0 && current.matches(&round))
            {
                return Ok(Some(current));
            }
        }
        let mut target = (Phase::Practice, slot, 0);
        if state.started[slot] && !state.completed[slot] && !state.failed[slot] {
            target = (Phase::Tournament, slot, state.progress[slot]);
        } else if now >= start - 1200 && !state.completed[slot] && !state.failed[slot] {
            target = (
                Phase::Warmup,
                slot,
                if state.phase == Phase::Warmup && state.timeslot == slot {
                    state.index
                } else {
                    0
                },
            );
        } else if state.phase == Phase::Practice && state.timeslot == slot {
            target.2 = state.index;
        }
        let asset = match self.phase_asset(state, event, target.0, target.1).await? {
            Some(asset) => asset,
            None if target.0 == Phase::Warmup => {
                target = (Phase::Practice, slot, 0);
                let Some(asset) = self.phase_asset(state, event, target.0, slot).await? else {
                    return Ok(None);
                };
                asset
            }
            None => return Ok(None),
        };
        ensure!(
            target.0 != Phase::Tournament || target.2 < asset.playlist.levels.len(),
            "ZSL tournament progress out of range"
        );
        target.2 %= asset.playlist.levels.len();
        Ok(Some(NativeTarget {
            target,
            asset,
            seconds: 0.0,
            scoring: None,
        }))
    }

    async fn next_target(
        &self,
        state: &mut SavedState,
        live: &LiveState,
        event: &ZslEvent,
        boundary: bool,
        now: i64,
    ) -> Result<Option<NativeTarget>> {
        let (phase, slot, index) = live.active.context("ZSL active phase unavailable")?;
        let Some(asset) = live.asset.as_ref() else {
            return Ok(None);
        };
        let last = index + 1 == asset.playlist.levels.len();
        let next_index = match phase {
            Phase::Practice => (index + 1) % asset.playlist.levels.len(),
            _ => (index + 1).min(asset.playlist.levels.len() - 1),
        };
        let mut target = NativeTarget {
            target: (phase, slot, next_index),
            asset: asset.clone(),
            seconds: 0.0,
            scoring: None,
        };
        if !boundary {
            return Ok(Some(target));
        }
        match phase {
            Phase::Practice => {
                let next_slot = Self::eligible_slot(state, event, now);
                if now >= event_start(event, next_slot) - 1200
                    && !state.completed[next_slot]
                    && !state.failed[next_slot]
                    && let Some(asset) = self.warmup_asset(state, next_slot).await?
                {
                    target.target = (Phase::Warmup, next_slot, 0);
                    target.asset = asset;
                } else if let Some(asset) = self.shared.practice_asset.lock().await.clone()
                    && target.asset.digest != asset.digest
                {
                    let current = &target.asset.playlist.levels[index];
                    let next = asset
                        .playlist
                        .levels
                        .iter()
                        .position(|entry| {
                            entry.uid == current.uid && entry.workshop_id == current.workshop_id
                        })
                        .map_or(0, |position| (position + 1) % asset.playlist.levels.len());
                    target.target = (Phase::Practice, next_slot, next);
                    target.asset = asset;
                }
            }
            Phase::Warmup if last && now >= event_start(event, slot) => {
                if !state.failed[slot] {
                    if let Some(asset) = self
                        .phase_asset(state, event, Phase::Tournament, slot)
                        .await?
                    {
                        return Ok(Some(NativeTarget {
                            target: (Phase::Tournament, slot, 0),
                            asset,
                            seconds: 0.0,
                            scoring: None,
                        }));
                    }
                    self.mark_slot_failed(state, slot).await?;
                }
                if slot == 0
                    && now >= event.second - 1200
                    && let Some(asset) = self.warmup_asset(state, 1).await?
                {
                    target.target = (Phase::Warmup, 1, 0);
                    target.asset = asset;
                } else if let Some(asset) = self.shared.practice_asset.lock().await.clone() {
                    target.target = (Phase::Practice, Self::eligible_slot(state, event, now), 0);
                    target.asset = asset;
                }
            }
            Phase::Tournament if last => {
                if slot == 1 {
                    return Ok(None);
                }
                if now >= event.second - 1200
                    && let Some(asset) = self.warmup_asset(state, 1).await?
                {
                    target.target = (Phase::Warmup, 1, 0);
                    target.asset = asset;
                } else if let Some(asset) = self.shared.practice_asset.lock().await.clone() {
                    target.target = (Phase::Practice, 1, 0);
                    target.asset = asset;
                }
            }
            _ => {}
        }
        Ok(Some(target))
    }

    async fn select_native(
        &self,
        state: &mut SavedState,
        live: &mut LiveState,
        mut target: NativeTarget,
        seconds: f64,
    ) -> Result<()> {
        let index = live.active.context("ZSL active level unavailable")?.2;
        let outgoing = &live
            .asset
            .as_ref()
            .context("ZSL active playlist unavailable")?
            .playlist
            .levels[index];
        let (playlist, current_index) = target.asset.playlist.with_current(outgoing)?;
        let (phase, slot, index) = target.target;
        target.scoring = if phase == Phase::Tournament && Some(target.target) != live.active {
            if let Some(previous) = live.next.as_ref().filter(|next| {
                next.target == target.target && next.asset.digest == target.asset.digest
            }) {
                previous.scoring.clone()
            } else {
                let bundle = target
                    .asset
                    .bundle
                    .as_ref()
                    .context("ZSL playlist unavailable")?;
                let level_id = self.scoring_level(bundle, index).await?;
                let level = &target.asset.playlist.levels[index];
                let finishes = if slot == 1 && state.phase != Phase::Tournament {
                    self.shared
                        .database
                        .zsl_finishes(self.shared.round_id)
                        .await?
                } else {
                    live.finishes.clone()
                };
                Some(ScoringScope {
                    phase,
                    timeslot: slot,
                    level_id,
                    index: Some(index),
                    deadline: 0,
                    round: live.round.clone(),
                    identity: Some((level.uid.clone(), level.workshop_id)),
                    generation: live.generation + 1,
                    ready: true,
                    locked_players: finishes
                        .iter()
                        .filter(|finish| {
                            Some(finish.id_level) == level_id
                                && finish.finalised
                                && finish.timeslot == 1
                        })
                        .map(|finish| finish.steam_id as u64)
                        .collect(),
                })
            }
        } else {
            None
        };
        if self.context.server_round().as_ref().map(|round| &round.key) != live.round.as_ref() {
            return Ok(());
        }
        *self.next_scoring.write().unwrap() = target.scoring.clone();
        self.context
            .select_round(playlist, current_index, target.target.2, seconds)
            .await
            .context(TransitionFailed)?;
        ensure!(
            self.context.is_host() && !self.stopped.load(Ordering::Acquire),
            TransitionFailed
        );
        if target.target.0 == Phase::Tournament && state.pinned.is_none() {
            state.pinned = target.asset.bundle.as_deref().cloned();
        }
        target.seconds = seconds;
        state.next = Some(target.target);
        live.next = Some(target);
        self.shared.save(state).await
    }

    pub(super) async fn sync_scoring_clock(
        &self,
        state: &mut SavedState,
        live: &LiveState,
    ) -> Result<()> {
        let slot = state.timeslot;
        let index = state.index;
        if state.phase != Phase::Tournament || state.progress[slot] > index {
            return Ok(());
        }
        let Some(deadline_ms) = live
            .round
            .as_ref()
            .and_then(|key| self.context.server_round_for(key))
            .and_then(|round| round.deadline_ms)
            .filter(|deadline| state.deadline_ms != Some(*deadline))
        else {
            return Ok(());
        };
        self.shared
            .database
            .open_zsl_level_at_ms(
                self.shared.round_id,
                &self.shared.owner,
                slot as i32 + 1,
                index as i32,
                live.current_level_id,
                deadline_ms,
            )
            .await?;
        state.deadline_ms = Some(deadline_ms);
        state.deadline = deadline_ms.div_euclid(1000);
        self.shared.save(state).await
    }

    async fn finalize_round(
        &self,
        state: &mut SavedState,
        slot: usize,
        index: usize,
    ) -> Result<()> {
        if state.progress[slot] > index {
            return Ok(());
        }
        ensure!(
            state.progress[slot] == index,
            "ZSL scoring progress out of order"
        );
        self.flush(state).await?;
        self.shared
            .database
            .close_zsl_level(
                self.shared.round_id,
                &self.shared.owner,
                slot as i32 + 1,
                index as i32,
            )
            .await?;
        state.progress[slot] = index + 1;
        self.shared.save(state).await
    }

    async fn commit_native(
        &self,
        state: &mut SavedState,
        live: &mut LiveState,
        next: NativeTarget,
        round: ServerRound,
    ) -> Result<()> {
        let (phase, slot, index) = next.target;
        let deadline_ms = round.deadline_ms.context("ZSL server clock unavailable")?;
        let level = next.asset.playlist.levels[index].clone();
        let prepared = next
            .asset
            .load(&level.uid, level.workshop_id)
            .await?
            .context("ZSL level payload unavailable")?;
        let scoring_level = if phase == Phase::Tournament {
            let bundle = next
                .asset
                .bundle
                .as_ref()
                .context("ZSL playlist unavailable")?;
            let scoring = match &next.scoring {
                Some(scope) => scope.level_id,
                None => self.scoring_level(bundle, index).await?,
            };
            self.shared
                .database
                .open_zsl_level_at_ms(
                    self.shared.round_id,
                    &self.shared.owner,
                    slot as i32 + 1,
                    index as i32,
                    scoring,
                    deadline_ms,
                )
                .await?;
            live.finishes = self
                .shared
                .database
                .zsl_finishes(self.shared.round_id)
                .await?;
            state.started[slot] = true;
            state.scored_through[slot] = Some(index);
            scoring
        } else {
            None
        };
        ensure!(
            self.context.is_host() && !self.stopped.load(Ordering::Acquire),
            TransitionFailed
        );
        self.context.advance_generation();
        let packets = {
            let mut board = self.board.lock().await;
            board.clear_standings();
            board.set_ready(true);
            board.reconcile()?
        };
        self.context.publish(packets).await?;
        state.phase = phase;
        state.timeslot = slot;
        state.index = index;
        state.loaded_at = Some(round.key.loaded_at);
        state.deadline_ms = Some(deadline_ms);
        state.deadline = deadline_ms.div_euclid(1000);
        state.next = None;
        live.active = Some(next.target);
        live.asset = Some(next.asset);
        live.round = Some(round.key);
        live.next = None;
        live.ready = Some((level.uid.clone(), level.workshop_id));
        live.current_level_id = scoring_level;
        live.records.clear();
        live.generation += 1;
        live.last_board = None;
        self.shared.remember_playable(phase, index, &prepared).await;
        self.shared.save(state).await?;
        self.scoring_scope(state, live);
        *self.next_scoring.write().unwrap() = None;
        let name = match phase {
            Phase::Practice => format!("ZSL {} Practice", self.shared.event()?.name),
            _ => format!(
                "Zeepkist Super League: {} (Timeslot {})",
                self.shared.event()?.name,
                slot + 1
            ),
        };
        self.context
            .publish(vec![change_lobby_name_packet(&name)?])
            .await
    }

    pub(super) async fn drive_round(
        &self,
        state: &mut SavedState,
        live: &mut LiveState,
        event: &ZslEvent,
        select_requested: bool,
    ) -> Result<()> {
        let now = jiff::Timestamp::now().as_second();
        if self.shared.retire.load(Ordering::Acquire) || !self.context.is_host() {
            return Ok(());
        }
        for slot in 0..2 {
            if state.started[slot] && !state.completed[slot] && state.progress[slot] == 15 {
                self.finish(state, event, slot).await?;
                if self.shared.retire.load(Ordering::Acquire) {
                    return Ok(());
                }
            }
        }
        if live.active.is_none_or(|active| active.0 == Phase::Waiting) {
            let Some(target) = self.initial_target(state, event, now).await? else {
                return self
                    .restore_playable(state, live, Self::eligible_slot(state, event, now))
                    .await;
            };
            let (phase, slot, index) = target.target;
            let deadline = now + self.phase_seconds(phase) as i64;
            return match self
                .activate(state, live, phase, slot, index, target.asset, deadline)
                .await
            {
                Err(error) if error.is::<TransitionUnavailable>() => {
                    self.fail_slot(state, live, slot).await
                }
                result => result,
            };
        }
        let Some(round) = self.context.server_round() else {
            return Ok(());
        };
        let Some(key) = live.round.as_ref() else {
            live.active = None;
            return Ok(());
        };
        let (phase, slot, index) = live.active.unwrap();
        let same_round = round.key == *key;
        let boundary = !same_round || round.state != 0;
        if same_round
            && (boundary || select_requested || live.next.is_none())
            && let Some(target) = self.next_target(state, live, event, boundary, now).await?
        {
            let seconds = if boundary {
                self.phase_seconds(target.target.0)
            } else {
                round.seconds
            };
            let changed = live.next.as_ref().is_none_or(|next| {
                next.target != target.target
                    || next.asset.digest != target.asset.digest
                    || next.seconds != seconds
            });
            if select_requested || changed {
                self.select_native(state, live, target, seconds).await?;
            }
        }
        self.sync_scoring_clock(state, live).await?;
        if boundary && phase == Phase::Tournament {
            live.ready = None;
            *self.scoring.write().unwrap() = None;
            self.finalize_round(state, slot, index).await?;
            if state.progress[slot] == live.asset.as_ref().unwrap().playlist.levels.len()
                && !state.completed[slot]
            {
                self.finish(state, event, slot).await?;
                if self.shared.retire.load(Ordering::Acquire) {
                    return Ok(());
                }
            }
        }
        if !same_round && round.state == 0 && round.deadline_ms.is_some() {
            let next = live
                .next
                .clone()
                .filter(|next| next.matches(&round))
                .context(TransitionFailed)?;
            if state.completed[next.target.1] && next.target.0 == Phase::Tournament {
                // Keep the room available after Timeslot 1 when no standby playlist exists.
                live.round = Some(round.key);
                return Ok(());
            }
            self.commit_native(state, live, next, round).await?;
        } else if same_round
            && live.next.is_some()
            && self
                .context
                .remote_now()
                .is_some_and(|now| round.remaining(now) < -60.0)
        {
            return Err(TransitionFailed.into());
        }
        Ok(())
    }

    pub(super) async fn round_announcements(
        &self,
        state: &mut SavedState,
        live: &LiveState,
        event: &ZslEvent,
    ) -> Result<()> {
        let Some(round) = self
            .context
            .server_round()
            .filter(|round| round.state == 0 && live.round.as_ref() == Some(&round.key))
        else {
            return Ok(());
        };
        let slot = state.timeslot;
        let index = state.index;
        if state.phase == Phase::Warmup && !state.failed[slot] {
            let start = event_start(event, slot);
            let now = jiff::Timestamp::now().as_second();
            let remaining = (start - now).max(0) as u64;
            self.once(
                state,
                format!("warmup:{slot}"),
                &zsl_messages::warmup_countdown(remaining),
            )
            .await?;
            let elapsed = (now - (start - 1200)) / 120;
            if (1..10).contains(&elapsed) && remaining > 0 {
                self.once(
                    state,
                    format!("countdown:{slot}:{elapsed}"),
                    &zsl_messages::warmup_countdown(remaining),
                )
                .await?;
            }
        } else if state.phase == Phase::Tournament && !state.completed[slot] {
            self.once(
                state,
                format!("started:{slot}"),
                // Reference command: `/cm14`
                &chat_notice(
                    "ZSL Tournament Started",
                    &format!("{}<br>Good luck and have fun!", zsl_messages::season(event)),
                ),
            )
            .await?;
            if index == 7 {
                // Reference command: `/cm15`
                self.once(
                    state,
                    format!("break:{slot}:{index}"),
                    &chat_notice(
                        "Break Time!",
                        &zsl_messages::gradient(
                            "Grab a drink and stretch before the next ZSL level.",
                            ["#00aaff", "#88ffff"],
                        ),
                    ),
                )
                .await?;
            }
            if let (Some(now), Some(bundle)) = (self.context.remote_now(), state.pinned.as_ref()) {
                let remaining = round.remaining(now);
                let entry = &bundle.levels[index];
                let next = bundle.levels.get(index + 1).map(|next| {
                    escape_text(
                        next.level
                            .name
                            .strip_prefix("ZSL - ")
                            .unwrap_or(&next.level.name),
                    )
                });
                if remaining > 5.0
                    && entry
                        .author_time
                        .is_some_and(|author| remaining <= author + 10.0)
                    && live.current_level_id.is_some()
                {
                    self.once(
                        state,
                        format!("reset:{slot}:{index}"),
                        // Reference command: `/cm16`
                        &chat_notice("Last Chance to Reset", "Reset now to improve your time."),
                    )
                    .await?;
                } else if (0.0..=5.0).contains(&remaining)
                    && let Some(next) = next
                {
                    self.once(
                        state,
                        format!("next:{slot}:{index}"),
                        // Reference command: `/cm17`
                        &chat_message("Up Next:", "#4ad9ff", &format!(" <b>{next}</b>")),
                    )
                    .await?;
                }
            }
        }
        Ok(())
    }
}
