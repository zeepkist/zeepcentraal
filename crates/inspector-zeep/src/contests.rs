#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContestTitle {
    pub season: u64,
    pub round: u64,
    pub theme: String,
}

pub fn parse_contest_title(title: &str) -> Option<ContestTitle> {
    let title = title.trim();
    let rest = title.strip_prefix('S')?;
    let (season, rest) = rest.split_once('R')?;
    let split = rest.find(char::is_whitespace)?;
    let (round, theme) = rest.split_at(split);
    let theme = theme.trim();
    if season.starts_with('0') || round.starts_with('0') || theme.is_empty() {
        return None;
    }
    Some(ContestTitle {
        season: season.parse().ok()?,
        round: round.parse().ok()?,
        theme: theme.to_owned(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_strict_contest_titles() {
        assert_eq!(
            parse_contest_title(" S12R3  Soap Box "),
            Some(ContestTitle {
                season: 12,
                round: 3,
                theme: "Soap Box".into()
            })
        );
        assert!(parse_contest_title("S0R1 invalid").is_none());
        assert!(parse_contest_title("Season 1").is_none());
    }
}
