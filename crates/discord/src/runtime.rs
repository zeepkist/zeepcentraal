use crate::{backend::Backend, commands, config::DiscordConfig, health::RuntimeState};
use anyhow::{Context as _, Result, bail};
use serenity::{
    all::{
        Client, CommandDataOption, CommandDataOptionValue, CommandInteraction, Context,
        EventHandler, FullEvent, GatewayIntents, Interaction, Member, MessageFlags, RoleId,
    },
    async_trait,
    builder::{
        CreateAllowedMentions, CreateComponent, CreateContainer, CreateContainerComponent,
        CreateInteractionResponse, CreateInteractionResponseMessage, CreateTextDisplay,
    },
    model::Colour,
};
use std::sync::Arc;

pub struct Handler {
    config: Arc<DiscordConfig>,
    backend: Backend,
    state: Arc<RuntimeState>,
}

impl Handler {
    pub fn new(config: Arc<DiscordConfig>, backend: Backend, state: Arc<RuntimeState>) -> Self {
        Self {
            config,
            backend,
            state,
        }
    }

    async fn command(&self, context: &Context, command: &CommandInteraction) -> Result<()> {
        let user_id = command.user.id.get();
        let response = match command.data.name.as_str() {
            "link" => {
                if let Some(code) = string_option(&command.data.options, "code") {
                    self.backend.redeem(code, user_id).await?;
                    Some(("Account linked", "Discord login and extended bot features are now available for your account.".to_owned()))
                } else {
                    Some(("Link ZeepCentraal", format!("Generate account-link code at {}/settings/discord, then run `/link code:12345678`.", self.config.frontend_url)))
                }
            }
            "unlink" => {
                self.backend.unlink(user_id).await?;
                Some(("Account unlinked", "Discord account unlinked.".to_owned()))
            }
            "wr-ping" => {
                let enabled = bool_option(&command.data.options, "enabled").context("Missing enabled option")?;
                self.backend.preference(user_id, enabled).await?;
                Some(("Notification preference updated", format!("World-record loss pings {}.", if enabled { "enabled" } else { "disabled" })))
            }
            "feed" => {
                let guild_id = command.guild_id.context("Run this command inside a server")?.get();
                let kind = string_option(&command.data.options, "kind").context("Missing feed kind")?;
                let channel_id = channel_option(&command.data.options, "channel").context("Missing channel")?;
                let enabled = bool_option(&command.data.options, "enabled").context("Missing enabled option")?;
                self.backend.set_feed(guild_id, kind, channel_id, enabled).await?;
                Some(("Feed updated", format!("**{}** feed {} in <#{channel_id}>.", kind.replace('_', " "), if enabled { "enabled" } else { "disabled" })))
            }
            "watch" => Some(self.watch(command).await?),
            "help" => Some(("ZeepCentraal bot", "Use `/level`, `/user`, `/stats`, `/playlist`, `/watch`, `/feed`, `/totw`, or `/totm`. Link account with `/link`.".to_owned())),
            "modkist" | "gtr" => Some(("Modkist + GTR", "Install Modkist and Zeepkist.GTR.Mod from https://zeepki.st/mods.".to_owned())),
            "bot-status" => {
                let backend = self.backend.ready().await.is_ok();
                Some(("Bot status", format!("Discord: connected\nBackend: {}", if backend { "ready" } else { "unavailable" })))
            }
            _ => None,
        };
        let Some((title, description)) = response else {
            bail!("Command handler not migrated: {}", command.data.name);
        };
        command
            .create_response(
                &context.http,
                interaction_message(title, description, false),
            )
            .await?;
        if matches!(command.data.name.as_str(), "link" | "unlink")
            && let Some(guild_id) = command.guild_id
            && let Ok(member) = guild_id.member(&context.http, command.user.id).await
        {
            self.sync_linked_role(&context.http, &member).await?;
        }
        Ok(())
    }

    async fn watch(&self, command: &CommandInteraction) -> Result<(&'static str, String)> {
        let user_id = command.user.id.get();
        let state = self.backend.user(user_id).await?;
        anyhow::ensure!(
            state.linked_user.is_some(),
            "Link your ZeepCentraal account first"
        );
        let (action, options) =
            subcommand(&command.data.options).context("Missing watch action")?;
        match action {
            "list" => {
                let description = if state.watches.is_empty() {
                    "No watches configured.".to_owned()
                } else {
                    state
                        .watches
                        .iter()
                        .map(|watch| {
                            format!(
                                "`{}` • **{}** • {}{}",
                                watch.id,
                                watch.kind,
                                watch.target_id,
                                if watch.paused { " • paused" } else { "" }
                            )
                        })
                        .collect::<Vec<_>>()
                        .join("\n")
                };
                Ok(("Your watches", description))
            }
            "add" => {
                let kind = string_option(options, "kind").context("Missing watch kind")?;
                let target = string_option(options, "target").context("Missing watch target")?;
                self.backend.add_watch(user_id, kind, target).await?;
                Ok((
                    "Watch active",
                    "Watch added. Updates arrive by direct message.".to_owned(),
                ))
            }
            "remove" => {
                let id = string_option(options, "id").context("Missing watch ID")?;
                self.backend.remove_watch(user_id, id).await?;
                Ok(("Watch updated", "Watch removed.".to_owned()))
            }
            _ => bail!("Unknown watch action"),
        }
    }

    async fn sync_linked_role(&self, http: &serenity::http::Http, member: &Member) -> Result<()> {
        let state = self.backend.guild(member.guild_id.get()).await?;
        let role_id = state
            .pointer("/config/linkedRoleId")
            .and_then(|value| value.as_str())
            .and_then(|value| value.parse::<u64>().ok());
        let Some(role_id) = role_id else {
            return Ok(());
        };
        let role_id = RoleId::new(role_id);
        let linked = self
            .backend
            .user(member.user.id.get())
            .await?
            .linked_user
            .is_some();
        let assigned = member.roles.contains(&role_id);
        match (linked, assigned) {
            (true, false) => {
                member
                    .add_role(http, role_id, Some("ZeepCentraal account linked"))
                    .await?
            }
            (false, true) => {
                member
                    .remove_role(http, role_id, Some("ZeepCentraal account unlinked"))
                    .await?
            }
            _ => {}
        }
        Ok(())
    }
}

#[async_trait]
impl EventHandler for Handler {
    async fn dispatch(&self, context: &Context, event: &FullEvent) {
        match event {
            FullEvent::Ready {
                data_about_bot, ..
            } => {
                self.state.set_guilds(data_about_bot.guilds.len() as usize);
                self.state.set_ready(true);
                tracing::info!(user = %data_about_bot.user.name, guilds = data_about_bot.guilds.len(), "Discord gateway ready");
            }
            FullEvent::GuildCreate {
                is_new: Some(true), ..
            } => self.state.add_guild(),
            FullEvent::GuildDelete { .. } => self.state.remove_guild(),
            FullEvent::GuildMemberAddition { new_member, .. } => {
                if let Err(error) = self.sync_linked_role(&context.http, new_member).await {
                    tracing::error!(user_id = new_member.user.id.get(), %error, "Linked role sync failed");
                }
            }
            FullEvent::InteractionCreate { interaction, .. } => match interaction {
                Interaction::Command(command) => {
                    if let Err(error) = self.command(context, command).await {
                        tracing::error!(interaction_id = command.id.get(), %error, "Discord command failed");
                        let _ = command
                            .create_response(
                                &context.http,
                                interaction_message("Command failed", error.to_string(), true),
                            )
                            .await;
                    }
                }
                Interaction::Autocomplete(command) => {
                    let _ = command
                        .create_response(
                            &context.http,
                            CreateInteractionResponse::Autocomplete(Default::default()),
                        )
                        .await;
                }
                _ => {}
            },
            _ => {}
        }
    }
}

pub async fn run(config: Arc<DiscordConfig>, state: Arc<RuntimeState>) -> Result<()> {
    let token = config.bot_token.parse()?;
    let backend = Backend::new(config.backend_url.clone(), config.api_token.clone())?;
    backend
        .ready()
        .await
        .context("Discord backend is not ready")?;
    let handler = Arc::new(Handler::new(config.clone(), backend, state));
    let mut client = Client::builder(
        token,
        GatewayIntents::GUILDS | GatewayIntents::GUILD_MEMBERS,
    )
    .event_handler(handler)
    .await?;
    if config.register_commands {
        let count = commands::register(&client.http, config.development_guild_id).await?;
        tracing::info!(count, guild_id = ?config.development_guild_id, "Registered Discord commands");
    }
    client.start().await?;
    Ok(())
}

fn interaction_message(
    title: impl Into<String>,
    description: impl Into<String>,
    error: bool,
) -> CreateInteractionResponse<'static> {
    let body = format!(
        "## {}\n{}\n-# ZeepCentraal",
        title.into(),
        description.into()
    );
    CreateInteractionResponse::Message(
        CreateInteractionResponseMessage::new()
            .components(vec![CreateComponent::Container(
                CreateContainer::new(vec![CreateContainerComponent::TextDisplay(
                    CreateTextDisplay::new(body),
                )])
                .accent_color(if error {
                    Colour::RED
                } else {
                    Colour::DARK_GREEN
                }),
            )])
            .flags(MessageFlags::IS_COMPONENTS_V2 | MessageFlags::EPHEMERAL)
            .allowed_mentions(CreateAllowedMentions::new()),
    )
}

fn string_option<'a>(options: &'a [CommandDataOption], name: &str) -> Option<&'a str> {
    options
        .iter()
        .find(|option| option.name == name)?
        .value
        .as_str()
}

fn bool_option(options: &[CommandDataOption], name: &str) -> Option<bool> {
    options
        .iter()
        .find(|option| option.name == name)?
        .value
        .as_bool()
}

fn channel_option(options: &[CommandDataOption], name: &str) -> Option<u64> {
    Some(
        options
            .iter()
            .find(|option| option.name == name)?
            .value
            .as_channel_id()?
            .get(),
    )
}

fn subcommand(options: &[CommandDataOption]) -> Option<(&str, &[CommandDataOption])> {
    let option = options.first()?;
    let CommandDataOptionValue::SubCommand(children) = &option.value else {
        return None;
    };
    Some((&option.name, children))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn response_uses_components_v2_and_ephemeral_flags() {
        let value = serde_json::to_value(interaction_message("Title", "Body", false)).unwrap();
        assert_eq!(value["type"], 4);
        let flags = value["data"]["flags"].as_u64().unwrap();
        assert_ne!(flags & u64::from(MessageFlags::EPHEMERAL.bits()), 0);
        assert_ne!(
            flags & u64::from(MessageFlags::IS_COMPONENTS_V2.bits()),
            0
        );
    }
}
