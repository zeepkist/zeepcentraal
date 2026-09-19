use anyhow::{Result, ensure};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct InspectorConfig {
    pub version: u8,
    pub forums: Vec<ForumConfig>,
    pub seasons: HashMap<String, i32>,
    pub active_showcase_thread_id: Option<String>,
    pub contests: Vec<ContestConfig>,
    #[serde(default = "default_run_timeout")]
    pub run_timeout_ms: u64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct ForumConfig {
    pub guild_id: String,
    pub forum_id: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct ContestConfig {
    pub thread_id: String,
    pub rules: Rules,
    pub round_id: Option<i32>,
    #[serde(default)]
    pub closed: bool,
    #[serde(default)]
    pub reopen: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct Rules {
    pub min_blocks: usize,
    pub max_blocks: usize,
    pub min_time: f64,
    pub max_time: f64,
    pub min_checkpoints: usize,
    #[serde(default)]
    pub required_modes: Vec<RequiredMode>,
    pub max_center_span: Option<f64>,
    #[serde(default)]
    pub fixed_checkpoints: Vec<FixedCheckpoint>,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, Hash, PartialEq, Serialize)]
pub enum RequiredMode {
    #[serde(rename = "Invert Steering")]
    InvertSteering,
    #[serde(rename = "Invert Arms Up Braking")]
    InvertArmsUpBraking,
    #[serde(rename = "Offroad Wheels")]
    OffroadWheels,
    Paraglider,
    #[serde(rename = "Soap Wheels")]
    SoapWheels,
    #[serde(rename = "First Person")]
    FirstPerson,
    #[serde(rename = "Third Person")]
    ThirdPerson,
    Logic,
    Music,
    Reset,
}

impl RequiredMode {
    pub const fn label(self) -> &'static str {
        match self {
            Self::InvertSteering => "Invert Steering",
            Self::InvertArmsUpBraking => "Invert Arms Up Braking",
            Self::OffroadWheels => "Offroad Wheels",
            Self::Paraglider => "Paraglider",
            Self::SoapWheels => "Soap Wheels",
            Self::FirstPerson => "First Person",
            Self::ThirdPerson => "Third Person",
            Self::Logic => "Logic",
            Self::Music => "Music",
            Self::Reset => "Reset",
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct FixedCheckpoint {
    pub id: u64,
    pub position: [f64; 3],
    #[serde(default = "default_tolerance")]
    pub tolerance: f64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct InspectorOptions {
    pub dry_run: bool,
    pub force: bool,
}

impl InspectorConfig {
    pub fn parse(source: &str) -> Result<Self> {
        let config: Self = serde_json::from_str(source)?;
        config.validate()?;
        Ok(config)
    }

    pub fn validate(&self) -> Result<()> {
        ensure!(self.version == 1, "Unsupported inspector config version");
        ensure!(
            (1..=32).contains(&self.forums.len()),
            "Invalid inspector forum count"
        );
        ensure!(
            (1..=128).contains(&self.contests.len()),
            "Invalid inspector contest count"
        );
        ensure!(
            (60_000..=29 * 60_000).contains(&self.run_timeout_ms),
            "Invalid inspector timeout"
        );
        for forum in &self.forums {
            validate_snowflake(&forum.guild_id)?;
            validate_snowflake(&forum.forum_id)?;
        }
        ensure!(
            self.seasons.iter().all(|(season, id)| {
                !season.starts_with('0')
                    && season.bytes().all(|byte| byte.is_ascii_digit())
                    && *id > 0
            }),
            "Invalid inspector season mapping"
        );
        let mut threads = HashSet::new();
        for contest in &self.contests {
            validate_snowflake(&contest.thread_id)?;
            ensure!(
                threads.insert(&contest.thread_id),
                "Duplicate contest thread"
            );
            ensure!(
                contest.round_id.is_none_or(|id| id > 0),
                "Invalid contest round ID"
            );
            contest.rules.validate()?;
        }
        if let Some(showcase) = &self.active_showcase_thread_id {
            validate_snowflake(showcase)?;
            ensure!(
                threads.contains(showcase),
                "Showcase thread must have explicit rules"
            );
        }
        Ok(())
    }
}

impl Rules {
    fn validate(&self) -> Result<()> {
        ensure!(
            self.max_blocks > 0 && self.max_blocks <= 100_000,
            "Invalid block maximum"
        );
        ensure!(
            self.min_blocks <= self.max_blocks,
            "Rule minimum exceeds maximum"
        );
        ensure!(
            self.min_time.is_finite()
                && self.min_time >= 0.0
                && self.max_time.is_finite()
                && self.max_time > 0.0
                && self.min_time <= self.max_time,
            "Rule minimum exceeds maximum"
        );
        ensure!(self.required_modes.len() <= 10, "Too many required modes");
        ensure!(
            self.max_center_span
                .is_none_or(|value| value.is_finite() && value > 0.0),
            "Invalid center span"
        );
        ensure!(
            self.fixed_checkpoints.len() <= 1_000,
            "Too many fixed checkpoints"
        );
        ensure!(
            self.fixed_checkpoints.iter().all(|checkpoint| {
                checkpoint.position.iter().all(|value| value.is_finite())
                    && checkpoint.tolerance.is_finite()
                    && (0.0..=1.0).contains(&checkpoint.tolerance)
            }),
            "Invalid fixed checkpoint"
        );
        Ok(())
    }
}

pub fn parse_options(arguments: &[String]) -> Result<InspectorOptions> {
    ensure!(
        arguments
            .iter()
            .all(|argument| matches!(argument.as_str(), "--dry-run" | "--force")),
        "Unknown inspector option"
    );
    Ok(InspectorOptions {
        dry_run: arguments.iter().any(|argument| argument == "--dry-run"),
        force: arguments.iter().any(|argument| argument == "--force"),
    })
}

fn validate_snowflake(value: &str) -> Result<()> {
    ensure!(
        !value.is_empty()
            && value.len() <= 20
            && !value.starts_with('0')
            && value.bytes().all(|byte| byte.is_ascii_digit()),
        "Invalid Discord ID"
    );
    Ok(())
}

const fn default_run_timeout() -> u64 {
    25 * 60_000
}

const fn default_tolerance() -> f64 {
    0.01
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_options_and_rejects_invalid_rule_ranges() {
        assert_eq!(
            parse_options(&["--force".into(), "--dry-run".into()]).unwrap(),
            InspectorOptions {
                dry_run: true,
                force: true
            }
        );
        assert!(parse_options(&["--unknown".into()]).is_err());
        let config = r#"{"version":1,"forums":[{"guildId":"1","forumId":"2"}],"seasons":{"1":1},"contests":[{"threadId":"3","rules":{"minBlocks":10,"maxBlocks":1,"minTime":25,"maxTime":60,"minCheckpoints":3}}]}"#;
        assert!(InspectorConfig::parse(config).is_err());
    }
}
