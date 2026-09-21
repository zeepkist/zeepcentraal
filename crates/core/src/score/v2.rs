use super::calculate_vote_rating;

pub const MAX_LEVEL_POINTS: i32 = 9_984;

#[derive(Clone, Debug, Default)]
pub struct LevelScoreTelemetry {
    pub arms_up_count: Option<i32>,
    pub arms_up_time: Option<f64>,
    pub brake_count: Option<i32>,
    pub brake_time: Option<f64>,
    pub driver_input_transition_count: Option<i32>,
    pub has_input_data: Option<bool>,
    pub time: Option<f64>,
    pub turn_left_count: Option<i32>,
    pub turn_left_time: Option<f64>,
    pub turn_right_count: Option<i32>,
    pub turn_right_time: Option<f64>,
}

#[derive(Clone, Debug, Default)]
pub struct LevelScorePersonalBest {
    pub splits: Vec<f64>,
    pub telemetry: Option<LevelScoreTelemetry>,
    pub time: f64,
}

#[derive(Clone, Copy, Debug, Default)]
pub struct LevelScoreSkillMetrics {
    pub alignment: Option<f64>,
    pub field_strength: Option<f64>,
    pub rated_player_count: i32,
    pub separation: Option<f64>,
}

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct LevelScoreResult {
    pub points: i32,
    pub rating: f64,
    pub length_modifier: f64,
    pub evidence_modifier: f64,
    pub quality_modifier: f64,
    pub rating_modifier: f64,
    pub complexity_confidence: Option<f64>,
    pub complexity_score: Option<f64>,
    pub field_strength: Option<f64>,
    pub quality_score: Option<f64>,
    pub skill_alignment: Option<f64>,
    pub skill_confidence: Option<f64>,
    pub skill_sample_size: Option<i32>,
    pub skill_score: Option<f64>,
    pub skill_separation: Option<f64>,
}

fn clamp(value: f64, minimum: f64, maximum: f64) -> f64 {
    if value.is_finite() {
        value.clamp(minimum, maximum)
    } else {
        minimum
    }
}

fn smoothstep(value: f64) -> f64 {
    let value = clamp(value, 0.0, 1.0);
    value * value * (3.0 - 2.0 * value)
}

fn smoothstep_between(value: f64, minimum: f64, maximum: f64) -> f64 {
    if maximum > minimum {
        smoothstep((value - minimum) / (maximum - minimum))
    } else {
        0.0
    }
}

fn percentile(values: impl IntoIterator<Item = f64>, quantile: f64) -> Option<f64> {
    let mut values: Vec<_> = values
        .into_iter()
        .filter(|value| value.is_finite())
        .collect();
    values.sort_by(f64::total_cmp);
    if values.is_empty() {
        return None;
    }
    if values.len() == 1 {
        return values.first().copied();
    }
    let index = clamp(quantile, 0.0, 1.0) * (values.len() - 1) as f64;
    let lower = values[index.floor() as usize];
    let upper = values[index.ceil() as usize];
    Some(lower + (upper - lower) * index.fract())
}

fn mean(values: &[f64]) -> Option<f64> {
    (!values.is_empty()).then(|| values.iter().sum::<f64>() / values.len() as f64)
}

fn length_factor(time: Option<f64>) -> f64 {
    let Some(time) = time.filter(|value| value.is_finite() && *value > 0.0) else {
        return 0.0;
    };
    if time < 5.0 {
        0.35
    } else if time < 20.0 {
        0.35 + 0.65 * smoothstep_between(time, 5.0, 20.0)
    } else if time <= 180.0 {
        1.0
    } else if time < 600.0 {
        1.0 - 0.25 * smoothstep_between(time, 180.0, 600.0)
    } else {
        0.75
    }
}

fn split_durations(run: &LevelScorePersonalBest) -> Option<Vec<f64>> {
    if run.splits.is_empty() {
        return None;
    }
    let mut previous = 0.0;
    let mut result = Vec::with_capacity(run.splits.len() + 1);
    for &time in &run.splits {
        if !time.is_finite() || time <= previous || time > run.time {
            return None;
        }
        result.push(time - previous);
        previous = time;
    }
    if previous < run.time {
        result.push(run.time - previous);
    }
    Some(result)
}

fn theoretical_best(runs: &[LevelScorePersonalBest]) -> Option<f64> {
    let candidates: Vec<_> = runs.iter().filter_map(split_durations).collect();
    let mut counts = std::collections::HashMap::<usize, usize>::new();
    for candidate in &candidates {
        *counts.entry(candidate.len()).or_default() += 1;
    }
    let segments = counts
        .into_iter()
        .filter(|(_, count)| *count >= 5)
        .max_by(
            |(left_segments, left_count), (right_segments, right_count)| {
                left_count
                    .cmp(right_count)
                    .then(left_segments.cmp(right_segments))
            },
        )?
        .0;
    let comparable: Vec<_> = candidates
        .iter()
        .filter(|candidate| candidate.len() == segments)
        .collect();
    (0..segments)
        .map(|index| percentile(comparable.iter().map(|run| run[index]), 0.05))
        .sum()
}

fn anomalous_world_record(runs: &[LevelScorePersonalBest]) -> bool {
    let Some(world_record) = runs.first() else {
        return false;
    };
    let next: Vec<_> = runs.iter().skip(1).take(5).map(|run| run.time).collect();
    let leaderboard = next.len() == 5 && world_record.time <= mean(&next).unwrap_or_default() * 0.5;
    let telemetry = theoretical_best(runs.get(1..).unwrap_or_default())
        .is_some_and(|best| smoothstep_between(best / world_record.time - 1.0, 0.03, 0.15) >= 1.0);
    leaderboard || telemetry
}

fn complexity_run(run: &LevelScorePersonalBest) -> Option<f64> {
    let telemetry = run.telemetry.as_ref()?;
    if telemetry.has_input_data != Some(true) {
        return None;
    }
    let duration = telemetry
        .time
        .filter(|value| value.is_finite() && *value > 0.0)
        .unwrap_or(run.time);
    if !duration.is_finite() || duration <= 0.0 {
        return None;
    }
    let times = [
        telemetry.turn_left_time,
        telemetry.turn_right_time,
        telemetry.brake_time,
        telemetry.arms_up_time,
    ];
    if times
        .iter()
        .any(|value| value.is_none_or(|value| !value.is_finite()))
    {
        return None;
    }
    let parts = [
        telemetry.turn_left_count,
        telemetry.turn_right_count,
        telemetry.brake_count,
        telemetry.arms_up_count,
    ];
    let transitions = telemetry
        .driver_input_transition_count
        .map(f64::from)
        .or_else(|| {
            parts
                .iter()
                .all(Option::is_some)
                .then(|| parts.into_iter().flatten().sum::<i32>() as f64)
        })?;
    let steering = clamp(
        (telemetry.turn_left_time.unwrap_or_default()
            + telemetry.turn_right_time.unwrap_or_default())
            / duration,
        0.0,
        1.0,
    );
    let primary = steering
        .max(clamp(
            telemetry.brake_time.unwrap_or_default() / duration,
            0.0,
            1.0,
        ))
        .max(clamp(
            telemetry.arms_up_time.unwrap_or_default() / duration,
            0.0,
            1.0,
        ));
    let occupancy = smoothstep_between(primary, 0.15, 0.63);
    let transitions = smoothstep_between(transitions.max(0.0) / duration, 0.73, 1.89);
    Some((occupancy * transitions).sqrt())
}

pub fn calculate_level_points_v2(
    mut personal_bests: Vec<LevelScorePersonalBest>,
    personal_best_count: i64,
    skill: Option<LevelScoreSkillMetrics>,
    votes: &[f64],
) -> LevelScoreResult {
    personal_bests.retain(|run| run.time.is_finite() && run.time > 0.0);
    personal_bests.sort_by(|left, right| left.time.total_cmp(&right.time));
    personal_bests.truncate(20);
    let all_count = personal_bests.len();
    while !personal_bests.is_empty() && anomalous_world_record(&personal_bests) {
        personal_bests.remove(0);
    }
    let rating = calculate_vote_rating(votes);
    let vote_factor = if votes.is_empty() {
        0.8
    } else {
        clamp(
            if rating <= 0.5 {
                0.76 + rating * 0.08
            } else {
                0.8 + (rating - 0.5) * 0.4
            },
            0.76,
            1.0,
        )
    };
    if personal_bests.is_empty() {
        return LevelScoreResult {
            rating,
            evidence_modifier: 0.1,
            length_modifier: 1.0,
            quality_modifier: 0.55,
            rating_modifier: vote_factor,
            ..Default::default()
        };
    }
    let sample = &personal_bests[..personal_bests.len().min(20)];
    let complexity_runs: Vec<_> = sample.iter().filter_map(complexity_run).collect();
    let observed = if complexity_runs.is_empty() {
        0.5
    } else {
        0.6 * percentile(complexity_runs.iter().copied(), 0.5).unwrap_or_default()
            + 0.4 * percentile(complexity_runs.iter().copied(), 0.25).unwrap_or_default()
    };
    let coverage = complexity_runs.len() as f64 / sample.len() as f64;
    let complexity_confidence = clamp(
        coverage.powi(2) * smoothstep_between(complexity_runs.len() as f64, 3.0, 10.0),
        0.0,
        1.0,
    );
    let complexity_score = 0.5 + complexity_confidence * (observed - 0.5);
    let skill = skill.unwrap_or_default();
    let alignment = skill
        .alignment
        .filter(|value| value.is_finite())
        .map(|value| value.max(0.0));
    let separation = skill
        .separation
        .filter(|value| value.is_finite())
        .map(|value| value.max(0.0));
    let field = skill
        .field_strength
        .filter(|value| value.is_finite())
        .map(|value| clamp(value, 0.0, 1.0));
    let complete = alignment.is_some() && separation.is_some() && field.is_some();
    let skill_confidence = if complete {
        smoothstep_between(skill.rated_player_count.max(0) as f64, 8.0, 64.0)
    } else {
        0.0
    };
    let skill_observed = if complete {
        0.8 * (smoothstep_between(alignment.unwrap(), 0.45, 0.85)
            * smoothstep_between(separation.unwrap(), 0.005, 0.07))
        .sqrt()
            + 0.2 * smoothstep_between(field.unwrap(), 0.6, 0.8)
    } else {
        0.5
    };
    let skill_score = 0.5 + skill_confidence * (skill_observed - 0.5);
    let quality_score = 0.55 * complexity_score + 0.45 * skill_score;
    let quality_factor = 0.1 + 0.9 * quality_score;
    let excluded = (all_count - personal_bests.len()) as i64;
    let credible = (personal_best_count.max(all_count as i64) - excluded).max(0);
    let evidence = 0.1 + 0.9 * smoothstep_between(credible as f64, 3.0, 16.0);
    let length = length_factor(percentile(
        personal_bests.iter().take(10).map(|run| run.time),
        0.5,
    ));
    let multiplier = clamp(length * evidence * quality_factor * vote_factor, 0.0, 1.0);
    let rounded = (clamp(
        MAX_LEVEL_POINTS as f64 * multiplier,
        2.0,
        MAX_LEVEL_POINTS as f64,
    ) / 2.0)
        .ceil() as i32
        * 2;
    let points = if multiplier < 1.0 {
        rounded.min(MAX_LEVEL_POINTS - 2)
    } else {
        rounded
    };
    LevelScoreResult {
        points,
        rating,
        length_modifier: length,
        evidence_modifier: evidence,
        quality_modifier: quality_factor,
        rating_modifier: vote_factor,
        complexity_confidence: Some(complexity_confidence),
        complexity_score: Some(complexity_score),
        field_strength: field,
        quality_score: Some(quality_score),
        skill_alignment: alignment,
        skill_confidence: Some(skill_confidence),
        skill_sample_size: Some(skill.rated_player_count.max(0)),
        skill_score: Some(skill_score),
        skill_separation: separation,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn empty_leader_has_zero_points() {
        let result = calculate_level_points_v2(Vec::new(), 0, None, &[]);
        assert_eq!(result.points, 0);
        assert_eq!(result.rating_modifier, 0.8);
    }
    #[test]
    fn supported_level_combines_all_factors() {
        let runs = (0..20)
            .map(|index| LevelScorePersonalBest {
                time: 30.0 + index as f64,
                splits: vec![10.0, 20.0],
                telemetry: Some(LevelScoreTelemetry {
                    has_input_data: Some(true),
                    time: Some(30.0 + index as f64),
                    turn_left_time: Some(15.0),
                    turn_right_time: Some(5.0),
                    brake_time: Some(8.0),
                    arms_up_time: Some(3.0),
                    driver_input_transition_count: Some(100),
                    ..Default::default()
                }),
            })
            .collect();
        let result = calculate_level_points_v2(
            runs,
            100,
            Some(LevelScoreSkillMetrics {
                alignment: Some(1.0),
                field_strength: Some(1.0),
                rated_player_count: 100,
                separation: Some(1.0),
            }),
            &[2.0; 5],
        );
        assert!(result.points > 9_000);
        assert!(result.points <= MAX_LEVEL_POINTS);
        assert_eq!(result.points % 2, 0);
    }
}
