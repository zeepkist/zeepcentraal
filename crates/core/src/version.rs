use std::cmp::Ordering;

#[derive(Debug, Eq, PartialEq)]
struct Version<'a> {
    release: [u64; 3],
    prerelease: Option<Vec<&'a str>>,
}

pub fn is_mod_outdated(current: &str, minimum: &str) -> bool {
    let (Some(current), Some(minimum)) = (parse(current), parse(minimum)) else {
        return true;
    };
    compare(&current, &minimum).is_lt()
}

fn parse(input: &str) -> Option<Version<'_>> {
    let value = input.trim().strip_prefix('v').unwrap_or(input.trim());
    let without_build = value.split_once('+').map_or(value, |(release, _)| release);
    let (release, prerelease) = without_build
        .split_once('-')
        .map_or((without_build, None), |(release, suffix)| {
            (release, Some(suffix))
        });
    let mut numbers = release.split('.');
    let release = [
        exact_number(numbers.next()?)?,
        exact_number(numbers.next()?)?,
        exact_number(numbers.next()?)?,
    ];
    if numbers.next().is_some() {
        return None;
    }
    let prerelease = match prerelease {
        Some(suffix) => {
            let values = suffix.split('.').collect::<Vec<_>>();
            if values.is_empty()
                || !values.iter().all(|value| {
                    !value.is_empty()
                        && value
                            .bytes()
                            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
                        && (!value.bytes().all(|byte| byte.is_ascii_digit())
                            || value == &"0"
                            || !value.starts_with('0'))
                })
            {
                return None;
            }
            Some(values)
        }
        None => None,
    };
    Some(Version {
        release,
        prerelease,
    })
}

fn exact_number(value: &str) -> Option<u64> {
    (!value.is_empty() && (value == "0" || !value.starts_with('0')))
        .then(|| value.parse().ok())
        .flatten()
}

fn compare(left: &Version<'_>, right: &Version<'_>) -> Ordering {
    left.release
        .cmp(&right.release)
        .then_with(|| match (&left.prerelease, &right.prerelease) {
            (None, None) => Ordering::Equal,
            (None, Some(_)) => Ordering::Greater,
            (Some(_), None) => Ordering::Less,
            (Some(left), Some(right)) => compare_prerelease(left, right),
        })
}

fn compare_prerelease(left: &[&str], right: &[&str]) -> Ordering {
    for (left, right) in left.iter().zip(right) {
        let order = match (left.parse::<u64>(), right.parse::<u64>()) {
            (Ok(left), Ok(right)) => left.cmp(&right),
            (Ok(_), Err(_)) => Ordering::Less,
            (Err(_), Ok(_)) => Ordering::Greater,
            (Err(_), Err(_)) => left.cmp(right),
        };
        if !order.is_eq() {
            return order;
        }
    }
    left.len().cmp(&right.len())
}

#[cfg(test)]
mod tests {
    use super::is_mod_outdated;

    #[test]
    fn matches_existing_exact_semver_contract() {
        for (current, minimum, expected) in [
            ("1.2.2", "1.2.3", true),
            ("1.2.3", "1.2.3", false),
            ("1.2.4", "1.2.3", false),
            ("1.2.3-beta.1", "1.2.3", true),
            ("1.2.3+build.7", "1.2.3", false),
            ("v1.2.3", "1.2.3", false),
            ("invalid", "1.2.3", true),
            ("1.2.3", "invalid", true),
        ] {
            assert_eq!(is_mod_outdated(current, minimum), expected);
        }
    }
}
