use serde::{Deserialize, Serialize};

mod v2;
pub use v2::*;

pub const DEFAULT_VOTE_RATING: f64 = 0.5;
pub const NEGATIVE_VOTE_WEIGHT: f64 = 0.5;
pub const MINIMUM_VOTE_COUNT: usize = 5;
pub const GLOBAL_DECAY_FACTOR: f64 = 0.95;
pub const LEVEL_DECAY_FACTOR: f64 = 0.985;
pub const MIN_PERSISTED_DECAYED_POINTS: f64 = f32::from_bits(1) as f64;

pub fn calculate_vote_score(vote: f64) -> f64 {
    if !vote.is_finite() {
        return DEFAULT_VOTE_RATING;
    }
    let vote = vote.clamp(-2.0, 2.0);
    let weighted = if vote < 0.0 {
        vote * NEGATIVE_VOTE_WEIGHT
    } else {
        vote
    };
    (weighted + 2.0) / 4.0
}

pub fn calculate_vote_rating(votes: &[f64]) -> f64 {
    if votes.len() < MINIMUM_VOTE_COUNT {
        return DEFAULT_VOTE_RATING;
    }
    let rating = votes.iter().copied().map(calculate_vote_score).sum::<f64>() / votes.len() as f64;
    if rating.is_finite() {
        (rating.clamp(0.0, 1.0) * 1_000_000.0).round() / 1_000_000.0
    } else {
        DEFAULT_VOTE_RATING
    }
}

pub fn calculate_decay_multiplier(position: f64, decay_factor: f64) -> f64 {
    if position < 1.0 || !position.is_finite() || !decay_factor.is_finite() || decay_factor <= 0.0 {
        return 0.0;
    }
    decay_factor.powf(position - 1.0)
}

pub fn calculate_decayed_points(points: f64, position: f64, decay_factor: f64) -> f64 {
    if !points.is_finite() || points <= 0.0 {
        return 0.0;
    }
    let value = points * calculate_decay_multiplier(position, decay_factor);
    if value < MIN_PERSISTED_DECAYED_POINTS {
        0.0
    } else {
        value
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LevelContribution {
    pub id_level: i32,
    pub id_record: i32,
    pub level_position: i64,
    pub level_points: i32,
    pub level_decayed_points: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerContribution {
    pub id_level: i32,
    pub id_record: i32,
    pub level_position: i64,
    pub level_points: i32,
    pub level_decayed_points: f64,
    pub contribution_rank: i32,
    pub player_decayed_points: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerPoints {
    pub contributions: Vec<PlayerContribution>,
    pub points: i64,
    pub total_points: i64,
}

pub fn calculate_player_points(mut values: Vec<LevelContribution>) -> PlayerPoints {
    values.retain(|value| {
        value.level_position >= 1
            && value.level_points > 0
            && value.level_decayed_points.is_finite()
    });
    values.sort_by(|left, right| {
        right
            .level_decayed_points
            .total_cmp(&left.level_decayed_points)
            .then(left.id_level.cmp(&right.id_level))
            .then(left.id_record.cmp(&right.id_record))
    });
    let contributions: Vec<_> = values
        .into_iter()
        .enumerate()
        .map(|(index, value)| {
            let contribution_rank = index as i32 + 1;
            PlayerContribution {
                id_level: value.id_level,
                id_record: value.id_record,
                level_position: value.level_position,
                level_points: value.level_points,
                level_decayed_points: value.level_decayed_points,
                contribution_rank,
                player_decayed_points: calculate_decayed_points(
                    value.level_decayed_points,
                    contribution_rank as f64,
                    GLOBAL_DECAY_FACTOR,
                ),
            }
        })
        .collect();
    PlayerPoints {
        points: contributions
            .iter()
            .map(|value| value.player_decayed_points)
            .sum::<f64>()
            .round() as i64,
        total_points: contributions
            .iter()
            .map(|value| value.level_decayed_points)
            .sum::<f64>()
            .round() as i64,
        contributions,
    }
}

pub fn level_score_eligible(adventure: bool, item_count: i64, accessible_item_count: i64) -> bool {
    adventure || item_count == 0 || accessible_item_count > 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vote_contract_matches_typescript() {
        assert_eq!(calculate_vote_score(-2.0), 0.25);
        assert_eq!(calculate_vote_score(-1.0), 0.375);
        assert_eq!(calculate_vote_score(1.0), 0.75);
        assert_eq!(calculate_vote_score(2.0), 1.0);
        assert_eq!(
            calculate_vote_rating(&[2.0, 2.0, 2.0, 1.0, 1.0, -1.0, -2.0]),
            0.732143
        );
    }

    #[test]
    fn player_decay_contract_matches_typescript() {
        let result = calculate_player_points(vec![
            LevelContribution {
                id_level: 2,
                id_record: 20,
                level_position: 2,
                level_points: 1_000,
                level_decayed_points: 985.0,
            },
            LevelContribution {
                id_level: 1,
                id_record: 10,
                level_position: 1,
                level_points: 1_000,
                level_decayed_points: 1_000.0,
            },
        ]);
        assert_eq!(result.points, 1_936);
        assert_eq!(result.total_points, 1_985);
        assert_eq!(result.contributions[0].id_level, 1);
        assert_eq!(result.contributions[1].player_decayed_points, 935.75);
    }
}
