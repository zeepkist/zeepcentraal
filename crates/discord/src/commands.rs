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
    // Registration runs before gateway Ready initializes Serenity's application ID.
    if http.application_id().is_none() {
        let application = http
            .get_current_application_info()
            .await
            .context("Failed to resolve Discord application ID before command registration")?;
        http.set_application_id(application.id);
    }
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
    use axum::{
        Json, Router,
        body::to_bytes,
        extract::Request,
        http::{Method, StatusCode},
    };
    use serenity::{all::ApplicationId, http::HttpBuilder};
    use std::{
        collections::HashSet,
        sync::{Arc, Mutex},
    };

    type Requests = Arc<Mutex<Vec<(Method, String, Value)>>>;

    async fn mock_discord(
        application_status: StatusCode,
    ) -> (Http, Requests, tokio::task::JoinHandle<()>) {
        let requests: Requests = Arc::default();
        let captured = requests.clone();
        let app = Router::new().fallback(move |request: Request| {
            let captured = captured.clone();
            async move {
                let path = request.uri().path().to_owned();
                let method = request.method().clone();
                let body = to_bytes(request.into_body(), 64 * 1024).await.unwrap();
                let body = if body.is_empty() {
                    Value::Null
                } else {
                    serde_json::from_slice(&body).unwrap()
                };
                captured.lock().unwrap().push((method, path.clone(), body));
                if path.ends_with("/oauth2/applications/@me") {
                    let body = if application_status.is_success() {
                        serde_json::json!({
                            "id": "123456789012345678",
                            "name": "Test bot",
                            "description": "",
                            "bot_public": true,
                            "bot_require_code_grant": false,
                            "verify_key": "test-key"
                        })
                    } else {
                        serde_json::json!({"code": 0, "message": "401: Unauthorized"})
                    };
                    (application_status, Json(body))
                } else {
                    (StatusCode::OK, Json(serde_json::json!([])))
                }
            }
        });
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        let http = HttpBuilder::without_token()
            .proxy(format!("http://{address}"))
            .ratelimiter_disabled(true)
            .build();
        (http, requests, server)
    }

    #[tokio::test]
    async fn registration_resolves_application_before_global_or_guild_commands() {
        for guild_id in [None, Some(987654321098765432)] {
            let (http, requests, server) = mock_discord(StatusCode::OK).await;
            assert!(http.application_id().is_none());
            let result = register(&http, guild_id).await;
            server.abort();

            assert_eq!(result.unwrap(), command_specs().unwrap().len());
            assert_eq!(
                http.application_id(),
                Some(ApplicationId::new(123456789012345678))
            );
            let requests = requests.lock().unwrap();
            assert_eq!(requests.len(), 2);
            assert_eq!(requests[0].0, Method::GET);
            assert_eq!(requests[0].1, "/api/v10/oauth2/applications/@me");
            assert_eq!(requests[1].0, Method::PUT);
            let expected_path = match guild_id {
                Some(id) => {
                    format!("/api/v10/applications/123456789012345678/guilds/{id}/commands")
                }
                None => "/api/v10/applications/123456789012345678/commands".to_owned(),
            };
            assert_eq!(requests[1].1, expected_path);
            assert_eq!(
                requests[1].2,
                serde_json::to_value(command_builders().unwrap()).unwrap()
            );
        }
    }

    #[tokio::test]
    async fn registration_stops_when_application_lookup_fails() {
        let (http, requests, server) = mock_discord(StatusCode::UNAUTHORIZED).await;
        let result = register(&http, None).await;
        server.abort();

        assert_eq!(
            result.unwrap_err().to_string(),
            "Failed to resolve Discord application ID before command registration"
        );
        assert!(http.application_id().is_none());
        assert_eq!(requests.lock().unwrap().len(), 1);
    }

    #[tokio::test]
    async fn registration_reuses_initialized_application_id() {
        let (http, requests, server) = mock_discord(StatusCode::UNAUTHORIZED).await;
        http.set_application_id(ApplicationId::new(123456789012345678));
        let result = register(&http, None).await;
        server.abort();

        assert_eq!(result.unwrap(), command_specs().unwrap().len());
        let requests = requests.lock().unwrap();
        assert_eq!(requests.len(), 1);
        assert_eq!(requests[0].0, Method::PUT);
        assert_eq!(
            requests[0].1,
            "/api/v10/applications/123456789012345678/commands"
        );
    }

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
