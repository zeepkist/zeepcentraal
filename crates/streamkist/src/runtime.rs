use crate::{cards, commands, config::Config, polling, twitch::Twitch};
use anyhow::{Context as _, Result, ensure};
use serenity::{
    all::{
        Channel, ChannelType, Client, Command, CommandDataOptionValue, CommandInteraction,
        ComponentInteraction, ComponentInteractionDataKind, Context, EventHandler, FullEvent,
        GatewayIntents, GuildId, Interaction, MessageFlags,
    },
    async_trait,
    builder::{
        AutocompleteChoice, CreateActionRow, CreateAutocompleteResponse, CreateButton,
        CreateComponent, CreateContainer, CreateContainerComponent, CreateInteractionResponse,
        CreateInteractionResponseMessage, CreateSelectMenu, CreateSelectMenuKind,
        CreateSelectMenuOption, CreateTextDisplay, EditInteractionResponse,
    },
};
use std::{
    sync::Arc,
    time::{Duration, Instant},
};
use zc_database::{
    Database,
    services::streamkist::{AddWatch, Watch},
};

struct Handler {
    database: Database,
    twitch: Arc<Twitch>,
}

impl Handler {
    async fn command(&self, context: &Context, command: &CommandInteraction) -> Result<()> {
        command
            .create_response(
                &context.http,
                CreateInteractionResponse::Defer(
                    CreateInteractionResponseMessage::new().ephemeral(true),
                ),
            )
            .await?;
        let start = Instant::now();
        let result = self.execute(context, command).await;
        if result.is_err() {
            tracing::warn!(command = %command.data.name, "Streamkist command failed");
            command
                .edit_response(
                    &context.http,
                    edit(cards::notice(
                        "An error occurred",
                        "There was an error while executing this command. Please try again.",
                        true,
                    )),
                )
                .await?;
        }
        let guild = command.guild_id.map(|id| id.to_string());
        let channel = command.channel_id.to_string();
        if self
            .database
            .streamkist_log_command(
                &command.data.name,
                guild.as_deref(),
                Some(&channel),
                i64::try_from(start.elapsed().as_millis()).unwrap_or(i64::MAX),
                &serde_json::to_value(&command.data.options)?,
            )
            .await
            .is_err()
        {
            tracing::warn!("Streamkist command audit failed");
        }
        Ok(())
    }

    async fn execute(&self, context: &Context, command: &CommandInteraction) -> Result<()> {
        if command.data.name == "ping" {
            command
                .edit_response(
                    &context.http,
                    EditInteractionResponse::new().content("Pong!"),
                )
                .await?;
            return Ok(());
        }
        let Some(guild) = command.guild_id else {
            command
                .edit_response(
                    &context.http,
                    edit(cards::notice(
                        "An error occurred",
                        "Guild ID not found",
                        true,
                    )),
                )
                .await?;
            return Ok(());
        };
        if !commands::can_manage(
            command
                .member
                .as_ref()
                .and_then(|member| member.permissions),
        ) {
            command
                .edit_response(
                    &context.http,
                    edit(cards::notice(
                        "An error occurred",
                        "You need the \"Manage Server\" permission to use this command.",
                        true,
                    )),
                )
                .await?;
            return Ok(());
        }
        match command.data.name.as_str() {
            "add-stream-channel" => {
                let category = command
                    .data
                    .options
                    .iter()
                    .find_map(|option| match &option.value {
                        CommandDataOptionValue::String(value) if option.name == "category" => {
                            Some(value.as_str())
                        }
                        _ => None,
                    })
                    .context("Missing category")?;
                let channel = command
                    .data
                    .options
                    .iter()
                    .find_map(|option| match &option.value {
                        CommandDataOptionValue::Channel(value) if option.name == "channel" => {
                            Some(*value)
                        }
                        _ => None,
                    })
                    .context("Missing channel")?;
                let resolved = channel.to_channel(&context.http, Some(guild)).await?;
                let Channel::Guild(resolved) = resolved else {
                    anyhow::bail!("Guild channel required");
                };
                ensure!(
                    resolved.base.guild_id == guild
                        && matches!(resolved.base.kind, ChannelType::Text | ChannelType::News),
                    "Channel must belong to this server and accept messages"
                );
                let bot = context.http.get_current_user().await?;
                let member = guild.member(&context.http, bot.id).await?;
                let server = guild.to_partial_guild(&context.http).await?;
                let permissions = server.user_permissions_in(&resolved, &member);
                if !permissions.contains(
                    serenity::all::Permissions::VIEW_CHANNEL
                        | serenity::all::Permissions::SEND_MESSAGES
                        | serenity::all::Permissions::EMBED_LINKS,
                ) {
                    command.edit_response(&context.http, edit(cards::notice(
                        "Channel unavailable",
                        "Streamkist needs View Channel, Send Messages, and Embed Links in the selected channel.",
                        true,
                    ))).await?;
                    return Ok(());
                }
                let Some(game) = self.twitch.game(category).await? else {
                    command
                        .edit_response(
                            &context.http,
                            edit(cards::notice(
                                "An error occurred",
                                &format!(
                                    "Twitch category \"{}\" not found",
                                    cards::escape(category)
                                ),
                                true,
                            )),
                        )
                        .await?;
                    return Ok(());
                };
                let (title, text, error) = match self.database.streamkist_add_watch(&guild.to_string(), &channel.to_string(), &game.id, &game.name).await? {
                    AddWatch::Added => ("Channel added",format!("Now tracking **{}** Twitch streams in <#{channel}>",cards::escape(&game.name)),false),
                    AddWatch::Duplicate => ("Channel already exists",format!("Channel already exists for category \"{}\" in <#{channel}>",cards::escape(&game.name)),true),
                    AddWatch::LimitReached => ("Channel limit reached","Your server has reached its watch limit. Free servers support 1 watch; paid plans with 3 or 5 watches are planned.".into(),true),
                };
                command
                    .edit_response(&context.http, edit(cards::notice(title, &text, error)))
                    .await?;
            }
            "show-stream-channels" => {
                let watches = self
                    .database
                    .streamkist_watches(Some(&guild.to_string()))
                    .await?;
                let expires = jiff::Timestamp::now().as_second() + 30;
                command
                    .edit_response(
                        &context.http,
                        edit(watch_list(&watches, command.user.id.get(), expires, None)),
                    )
                    .await?;
                if !watches.is_empty() {
                    let command = command.clone();
                    let http = context.http.clone();
                    tokio::spawn(async move {
                        tokio::time::sleep(Duration::from_secs(30)).await;
                        let _ = command.edit_response(&http,edit(cards::notice("Active Twitch stream channels","Selection expired. Run `/show-stream-channels` again to manage watches.",false))).await;
                    });
                }
            }
            _ => anyhow::bail!("Unknown Streamkist command"),
        }
        Ok(())
    }

    async fn autocomplete(&self, context: &Context, command: &CommandInteraction) -> Result<()> {
        let focused = command.data.autocomplete();
        let query = focused.as_ref().map(|option| option.value).unwrap_or("");
        let games =
            match tokio::time::timeout(Duration::from_secs(2), self.twitch.search_games(query))
                .await
            {
                Ok(Ok(games)) => games,
                _ => Vec::new(),
            };
        let choices: Vec<_> = games
            .into_iter()
            .take(25)
            .map(|game| {
                AutocompleteChoice::new(game.name.chars().take(100).collect::<String>(), game.id)
            })
            .collect();
        command
            .create_response(
                &context.http,
                CreateInteractionResponse::Autocomplete(
                    CreateAutocompleteResponse::new().set_choices(choices),
                ),
            )
            .await?;
        Ok(())
    }

    async fn component(&self, context: &Context, component: &ComponentInteraction) -> Result<()> {
        let control = parse_control(&component.data.custom_id);
        let permissions = component
            .member
            .as_ref()
            .and_then(|member| member.permissions);
        let now = jiff::Timestamp::now().as_second();
        let Some(control) = control
            .filter(|control| authorized(control, component.user.id.get(), now, permissions))
        else {
            component.create_response(&context.http,CreateInteractionResponse::Message(CreateInteractionResponseMessage::new()
                .components(cards::notice("Selection unavailable","Only the command author with Manage Server permission can use this selection for 30 seconds.",true))
                .flags(cards::flags() | MessageFlags::EPHEMERAL).allowed_mentions(cards::mentions()))).await?;
            return Ok(());
        };
        component
            .create_response(&context.http, CreateInteractionResponse::Acknowledge)
            .await?;
        let guild = component.guild_id.context("Guild required")?.to_string();
        let mut watches = self.database.streamkist_watches(Some(&guild)).await?;
        let selected = match control.action {
            Action::Select => {
                let ComponentInteractionDataKind::StringSelect { values } = &component.data.kind
                else {
                    anyhow::bail!("Selection required");
                };
                let id = values
                    .first()
                    .context("Missing selection")?
                    .parse::<i64>()?;
                ensure!(
                    watches.iter().any(|watch| watch.id == id),
                    "Watch belongs to another server or has been removed"
                );
                Some(id)
            }
            Action::Delete(id) => {
                ensure!(
                    watches.iter().any(|watch| watch.id == id),
                    "Watch belongs to another server or has been removed"
                );
                self.database.streamkist_remove_watch(&guild, id).await?;
                watches.retain(|watch| watch.id != id);
                None
            }
        };
        component
            .edit_response(
                &context.http,
                edit(watch_list(
                    &watches,
                    control.owner,
                    control.expires,
                    selected,
                )),
            )
            .await?;
        Ok(())
    }
}

#[async_trait]
impl EventHandler for Handler {
    async fn dispatch(&self, context: &Context, event: &FullEvent) {
        match event {
            FullEvent::Ready { .. } => tracing::info!("Streamkist Discord gateway ready"),
            FullEvent::InteractionCreate { interaction, .. } => {
                let result = match interaction {
                    Interaction::Command(command) => self.command(context, command).await,
                    Interaction::Autocomplete(command) => self.autocomplete(context, command).await,
                    Interaction::Component(component) => self.component(context, component).await,
                    _ => Ok(()),
                };
                if result.is_err() {
                    tracing::warn!("Streamkist interaction failed");
                }
            }
            _ => {}
        }
    }
}

pub async fn run(config: Config, database: Database) -> Result<()> {
    let twitch = Arc::new(Twitch::new(
        config.twitch_client_id,
        config.twitch_client_secret,
    )?);
    let mut client = Client::builder(config.discord_token.parse()?, GatewayIntents::GUILDS)
        .event_handler(Arc::new(Handler {
            database: database.clone(),
            twitch: twitch.clone(),
        }))
        .await?;
    let application = client.http.get_current_application_info().await?;
    client.http.set_application_id(application.id);
    let commands = commands::definitions();
    if let Some(guild) = config.development_guild_id {
        GuildId::new(guild)
            .set_commands(&client.http, &commands)
            .await?;
    } else {
        Command::set_global_commands(&client.http, &commands).await?;
    }
    let poll = tokio::spawn(polling::run(
        database,
        twitch,
        client.http.clone(),
        config.poll_seconds,
    ));
    let shutdown = client.shard_manager.get_shutdown_trigger();
    let result = tokio::select! {
        result = client.start() => result.map_err(anyhow::Error::from),
        result = shutdown_signal() => { shutdown(); result },
    };
    poll.abort();
    let _ = poll.await;
    result
}

async fn shutdown_signal() -> Result<()> {
    #[cfg(unix)]
    {
        let mut terminate =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())?;
        tokio::select! { result = tokio::signal::ctrl_c() => result?, _ = terminate.recv() => {} }
    }
    #[cfg(not(unix))]
    tokio::signal::ctrl_c().await?;
    Ok(())
}

fn edit(components: Vec<CreateComponent<'static>>) -> EditInteractionResponse<'static> {
    EditInteractionResponse::new()
        .components(components)
        .flags(cards::flags())
        .allowed_mentions(cards::mentions())
}

fn watch_list(
    watches: &[Watch],
    owner: u64,
    expires: i64,
    selected: Option<i64>,
) -> Vec<CreateComponent<'static>> {
    if watches.is_empty() {
        return cards::notice(
            "Active Twitch stream channels",
            "No active channels found",
            true,
        );
    }
    let text = watches
        .iter()
        .map(|watch| {
            format!(
                "**{}** · <#{}>",
                cards::escape(&watch.game_name),
                watch.channel_id
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    let options: Vec<_> = watches
        .iter()
        .map(|watch| {
            CreateSelectMenuOption::new(
                format!("{} ({})", watch.game_name, watch.channel_id)
                    .chars()
                    .take(100)
                    .collect::<String>(),
                watch.id.to_string(),
            )
            .default_selection(selected == Some(watch.id))
        })
        .collect();
    let menu = CreateSelectMenu::new(
        format!("streamkist:select:{owner}:{expires}"),
        CreateSelectMenuKind::String {
            options: options.into(),
        },
    )
    .placeholder("Select a channel");
    let mut children = vec![
        CreateContainerComponent::TextDisplay(CreateTextDisplay::new(format!(
            "## Active Twitch stream channels\n{text}"
        ))),
        CreateContainerComponent::ActionRow(CreateActionRow::select_menu(menu)),
    ];
    if let Some(id) = selected {
        children.push(CreateContainerComponent::ActionRow(
            CreateActionRow::buttons(vec![
                CreateButton::new(format!("streamkist:delete:{owner}:{expires}:{id}"))
                    .label("Remove Channel")
                    .style(serenity::all::ButtonStyle::Danger),
            ]),
        ));
    }
    vec![CreateComponent::Container(
        CreateContainer::new(children).accent_color(0x9146ff),
    )]
}

#[derive(Debug, PartialEq, Eq)]
enum Action {
    Select,
    Delete(i64),
}
struct Control {
    action: Action,
    owner: u64,
    expires: i64,
}
fn parse_control(value: &str) -> Option<Control> {
    let mut parts = value.split(':');
    if parts.next()? != "streamkist" {
        return None;
    }
    let action = parts.next()?;
    let owner = parts.next()?.parse().ok()?;
    let expires = parts.next()?.parse().ok()?;
    let action = match action {
        "select" => Action::Select,
        "delete" => Action::Delete(parts.next()?.parse().ok()?),
        _ => return None,
    };
    if parts.next().is_some() {
        return None;
    }
    Some(Control {
        action,
        owner,
        expires,
    })
}
fn authorized(
    control: &Control,
    user: u64,
    now: i64,
    permissions: Option<serenity::all::Permissions>,
) -> bool {
    control.owner == user && now < control.expires && commands::can_manage(permissions)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn controls_bind_owner_expiry_and_moderation_permission() {
        let control = parse_control("streamkist:delete:42:100:9").unwrap();
        assert_eq!(control.action, Action::Delete(9));
        let permissions = Some(serenity::all::Permissions::MANAGE_GUILD);
        assert!(authorized(&control, 42, 99, permissions));
        assert!(!authorized(&control, 43, 99, permissions));
        assert!(!authorized(&control, 42, 100, permissions));
        assert!(!authorized(&control, 42, 99, None));
        assert!(parse_control("streamkist:delete:42:100:9:extra").is_none());
    }
}
