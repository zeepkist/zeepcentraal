#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Ranked<T> {
    pub value: T,
    pub points: i32,
    pub position: i32,
}

pub fn rank_by_points<T>(rows: impl IntoIterator<Item = (T, i32)>) -> Vec<Ranked<T>> {
    let mut rows: Vec<(T, i32)> = rows.into_iter().collect();
    rows.sort_by_key(|row| std::cmp::Reverse(row.1));
    let mut previous = None;
    let mut position = 1;
    rows.into_iter()
        .enumerate()
        .map(|(index, (value, points))| {
            if previous.is_some_and(|previous| previous != points) {
                position = i32::try_from(index + 1).expect("ZSL rank exceeds i32");
            }
            previous = Some(points);
            Ranked {
                value,
                points,
                position,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_competition_ranking_and_stable_ties() {
        let ranked = rank_by_points([("low", 5), ("first", 10), ("second", 10), ("last", 1)]);
        assert_eq!(
            ranked,
            vec![
                Ranked {
                    value: "first",
                    points: 10,
                    position: 1
                },
                Ranked {
                    value: "second",
                    points: 10,
                    position: 1
                },
                Ranked {
                    value: "low",
                    points: 5,
                    position: 3
                },
                Ranked {
                    value: "last",
                    points: 1,
                    position: 4
                },
            ]
        );
    }
}
