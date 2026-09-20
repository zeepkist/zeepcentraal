use anyhow::{Context, Result, bail};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use serenity::{
    all::{ChannelType, CommandOptionType, CommandType, GuildId, Permissions},
    builder::{CreateCommand, CreateCommandOption},
    http::Http,
    model::application::Command,
};

const COMMANDS_JSON: &str = include_str!("../fixtures/commands.json");

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct CommandSpec {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub kind: u8,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub options: Vec<OptionSpec>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_member_permissions: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct OptionSpec {
    #[serde(rename = "type")]
    pub kind: u8,
    pub name: String,
    pub description: String,
    #[serde(default, skip_serializing_if = "is_false")]
    pub required: bool,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub choices: Vec<ChoiceSpec>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub options: Vec<OptionSpec>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub channel_types: Vec<u8>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_value: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_value: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_length: Option<u16>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_length: Option<u16>,
    #[serde(default, skip_serializing_if = "is_false")]
    pub autocomplete: bool,
}

fn is_false(value: &bool) -> bool {
    !*value
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ChoiceSpec {
    pub name: String,
    pub value: Value,
}

pub fn command_specs() -> Result<Vec<CommandSpec>> {
    serde_json::from_str(COMMANDS_JSON).context("Invalid embedded Discord command definitions")
}

pub fn command_builders() -> Result<Vec<CreateCommand<'static>>> {
    command_specs()?.into_iter().map(build_command).collect()
}

pub async fn register(http: &Http, development_guild_id: Option<u64>) -> Result<usize> {
    let commands = command_builders()?;
    if let Some(guild_id) = development_guild_id {
        GuildId::new(guild_id).set_commands(http, &commands).await?;
    } else {
        Command::set_global_commands(http, &commands).await?;
    }
    Ok(commands.len())
}

fn build_command(spec: CommandSpec) -> Result<CreateCommand<'static>> {
    let mut command = CreateCommand::new(spec.name).kind(command_type(spec.kind)?);
    if let Some(description) = spec.description {
        command = command.description(description);
    }
    if let Some(bits) = spec.default_member_permissions {
        command = command.default_member_permissions(Permissions::from_bits_truncate(
            bits.parse().context("Invalid command permission bits")?,
        ));
    }
    for option in spec.options {
        command = command.add_option(build_option(option)?);
    }
    Ok(command)
}

fn build_option(spec: OptionSpec) -> Result<CreateCommandOption<'static>> {
    let kind = option_type(spec.kind)?;
    let mut option = CreateCommandOption::new(kind, spec.name, spec.description)
        .required(spec.required)
        .set_autocomplete(spec.autocomplete);
    for choice in spec.choices {
        option = match choice.value {
            Value::String(value) => option.add_string_choice(choice.name, value),
            Value::Number(value) if value.is_i64() => {
                option.add_int_choice(choice.name, value.as_i64().expect("checked integer"))
            }
            Value::Number(value) => option.add_number_choice(
                choice.name,
                value.as_f64().context("Invalid numeric command choice")?,
            ),
            _ => bail!("Unsupported Discord command choice"),
        };
    }
    for child in spec.options {
        option = option.add_sub_option(build_option(child)?);
    }
    if !spec.channel_types.is_empty() {
        let types = spec
            .channel_types
            .into_iter()
            .map(channel_type)
            .collect::<Result<Vec<_>>>()?;
        option = option.channel_types(types);
    }
    if let Some(value) = spec.min_value {
        option = number_bound(option, kind, value, true)?;
    }
    if let Some(value) = spec.max_value {
        option = number_bound(option, kind, value, false)?;
    }
    if let Some(value) = spec.min_length {
        option = option.min_length(value);
    }
    if let Some(value) = spec.max_length {
        option = option.max_length(value);
    }
    Ok(option)
}

fn number_bound(
    option: CreateCommandOption<'static>,
    kind: CommandOptionType,
    value: Value,
    minimum: bool,
) -> Result<CreateCommandOption<'static>> {
    Ok(match kind {
        CommandOptionType::Integer => {
            let value = value
                .as_i64()
                .context("Integer option bound must be integral")?;
            if minimum {
                option.min_int_value(value)
            } else {
                option.max_int_value(value)
            }
        }
        CommandOptionType::Number => {
            let value = value
                .as_f64()
                .context("Number option bound must be numeric")?;
            if minimum {
                option.min_number_value(value)
            } else {
                option.max_number_value(value)
            }
        }
        _ => bail!("Only numeric command options support bounds"),
    })
}

fn command_type(value: u8) -> Result<CommandType> {
    Ok(match value {
        1 => CommandType::ChatInput,
        2 => CommandType::User,
        3 => CommandType::Message,
        _ => bail!("Unsupported Discord command type {value}"),
    })
}

fn option_type(value: u8) -> Result<CommandOptionType> {
    Ok(match value {
        1 => CommandOptionType::SubCommand,
        2 => CommandOptionType::SubCommandGroup,
        3 => CommandOptionType::String,
        4 => CommandOptionType::Integer,
        5 => CommandOptionType::Boolean,
        6 => CommandOptionType::User,
        7 => CommandOptionType::Channel,
        8 => CommandOptionType::Role,
        9 => CommandOptionType::Mentionable,
        10 => CommandOptionType::Number,
        11 => CommandOptionType::Attachment,
        _ => bail!("Unsupported Discord command option type {value}"),
    })
}

fn channel_type(value: u8) -> Result<ChannelType> {
    Ok(match value {
        0 => ChannelType::Text,
        5 => ChannelType::News,
        _ => bail!("Unsupported Discord channel type {value}"),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn embedded_registry_matches_active_typescript_registry() {
        let specs = command_specs().unwrap();
        assert_eq!(specs.len(), 20);
        assert_eq!(specs.last().unwrap().name, "ZeepCentraal profile");
        assert_eq!(
            specs
                .iter()
                .map(|entry| &entry.name)
                .collect::<HashSet<_>>()
                .len(),
            specs.len()
        );
        assert_eq!(command_builders().unwrap().len(), specs.len());
    }

    #[test]
    fn feed_permissions_and_watch_tree_are_preserved() {
        let specs = command_specs().unwrap();
        let feed = specs.iter().find(|entry| entry.name == "feed").unwrap();
        assert_eq!(feed.default_member_permissions.as_deref(), Some("32"));
        let watch = specs.iter().find(|entry| entry.name == "watch").unwrap();
        assert_eq!(
            watch
                .options
                .iter()
                .map(|entry| entry.name.as_str())
                .collect::<Vec<_>>(),
            ["add", "list", "remove"]
        );
    }
}
