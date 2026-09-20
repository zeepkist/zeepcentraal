use crate::{
    backend::{Backend, LevelProfile, PlaylistLevel, Profile, RandomLevel, UserStatistics},
    commands,
    config::DiscordConfig,
    feeds::{FeedService, tournament_components},
    health::RuntimeState,
};
use anyhow::{Context as _, Result, bail};
use serenity::{
    all::{
        Client, CommandDataOption, CommandDataOptionValue, CommandInteraction, Context,
        EventHandler, FullEvent, GatewayIntents, Interaction, Member, MessageFlags, RoleId,
    },
    async_trait,
    builder::{
        AutocompleteChoice, CreateAllowedMentions, CreateAttachment, CreateAutocompleteResponse,
        CreateButton, CreateComponent, CreateContainer, CreateContainerComponent,
        CreateInteractionResponse, CreateInteractionResponseMessage, CreateTextDisplay,
    },
    model::Colour,
};
use std::sync::Arc;

pub struct Handler {
    config: Arc<DiscordConfig>,
    backend: Backend,
    feeds: Arc<FeedService>,
    state: Arc<RuntimeState>,
}

impl Handler {
    pub fn new(
        config: Arc<DiscordConfig>,
        backend: Backend,
        feeds: Arc<FeedService>,
        state: Arc<RuntimeState>,
    ) -> Self {
        Self {
            config,
            backend,
            feeds,
            state,
        }
    }

    async fn command(&self, context: &Context, command: &CommandInteraction) -> Result<()> {
        anyhow::ensure!(
            supports_command(&command.data.name),
            "Command handler not migrated: {}",
            command.data.name
        );
        let user_id = command.user.id.get();
        if matches!(command.data.name.as_str(), "totw" | "totm") {
            return self.tournament_command(context, command).await;
        }
        if matches!(command.data.name.as_str(), "user" | "ZeepCentraal profile") {
            return self.profile_command(context, command).await;
        }
        if command.data.name == "compare" {
            return self.compare_command(context, command).await;
        }
        if command.data.name == "level" {
            return self.level_command(context, command).await;
        }
        if command.data.name == "random-level" {
            return self.random_level_command(context, command).await;
        }
        if matches!(command.data.name.as_str(), "stats" | "stats-surface") {
            return self.statistics_command(context, command).await;
        }
        if matches!(
            command.data.name.as_str(),
            "playlist" | "playlist-recommend"
        ) {
            return self.playlist_command(context, command).await;
        }
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

    async fn tournament_command(
        &self,
        context: &Context,
        command: &CommandInteraction,
    ) -> Result<()> {
        let tournament_type = i32::from(command.data.name == "totm");
        let snapshot = self
            .backend
            .current_tournaments()
            .await?
            .into_iter()
            .find(|snapshot| snapshot.tournament_type == tournament_type)
            .context("No tournament found")?;
        command
            .create_response(
                &context.http,
                CreateInteractionResponse::Message(
                    CreateInteractionResponseMessage::new()
                        .components(tournament_components(&snapshot, &self.config.frontend_url))
                        .flags(MessageFlags::IS_COMPONENTS_V2)
                        .allowed_mentions(CreateAllowedMentions::new()),
                ),
            )
            .await?;
        Ok(())
    }

    async fn profile_command(&self, context: &Context, command: &CommandInteraction) -> Result<()> {
        let (kind, identifier) = if let Some(target) = command.data.target_id {
            ("discord", target.to_user_id().get().to_string())
        } else if let Some(target) = user_option(&command.data.options, "discord") {
            ("discord", target.to_string())
        } else if let Some(identifier) = string_option(&command.data.options, "id") {
            (
                if identifier.len() >= 16 {
                    "steam"
                } else {
                    "id"
                },
                identifier.to_owned(),
            )
        } else {
            ("discord", command.user.id.get().to_string())
        };
        let profile = self.backend.profile(kind, &identifier).await?;
        command
            .create_response(
                &context.http,
                profile_response(&profile, &self.config.frontend_url),
            )
            .await?;
        Ok(())
    }

    async fn compare_command(&self, context: &Context, command: &CommandInteraction) -> Result<()> {
        let opponent = user_option(&command.data.options, "player").context("Missing player")?;
        let current_id = command.user.id.get().to_string();
        let opponent_id = opponent.to_string();
        let (first, second) = tokio::try_join!(
            self.backend.profile("discord", &current_id),
            self.backend.profile("discord", &opponent_id),
        )?;
        let description = format!(
            "### You\n{}\n### Opponent\n{}",
            profile_summary(&first),
            profile_summary(&second)
        );
        command
            .create_response(
                &context.http,
                interaction_message("Player comparison", description, false),
            )
            .await?;
        Ok(())
    }

    async fn level_command(&self, context: &Context, command: &CommandInteraction) -> Result<()> {
        let query = string_option(&command.data.options, "query").context("Missing level query")?;
        let level = self.backend.level(query).await?;
        command
            .create_response(
                &context.http,
                level_response(&level, &self.config.frontend_url),
            )
            .await?;
        Ok(())
    }

    async fn random_level_command(
        &self,
        context: &Context,
        command: &CommandInteraction,
    ) -> Result<()> {
        let minimum = integer_option(&command.data.options, "minimum-points").unwrap_or_default();
        let level = self.backend.random_level(minimum).await?;
        command
            .create_response(
                &context.http,
                random_level_response(&level, &self.config.frontend_url),
            )
            .await?;
        Ok(())
    }

    async fn autocomplete(
        &self,
        context: &Context,
        command: &serenity::all::CommandInteraction,
    ) -> Result<()> {
        let focused = command
            .data
            .autocomplete()
            .map_or("", |option| option.value)
            .trim();
        let choices = if command.data.name == "level" && focused.len() >= 2 {
            self.backend.level_search(focused).await?
        } else {
            Vec::new()
        };
        command
            .create_response(
                &context.http,
                CreateInteractionResponse::Autocomplete(
                    CreateAutocompleteResponse::new().set_choices(
                        choices
                            .into_iter()
                            .map(|choice| AutocompleteChoice::new(choice.name, choice.value))
                            .collect::<Vec<_>>(),
                    ),
                ),
            )
            .await?;
        Ok(())
    }

    async fn statistics_command(
        &self,
        context: &Context,
        command: &CommandInteraction,
    ) -> Result<()> {
        let range = string_option(&command.data.options, "range").context("Missing date range")?;
        let statistics = self
            .backend
            .user_statistics(
                command.user.id.get(),
                range,
                string_option(&command.data.options, "from"),
                string_option(&command.data.options, "to"),
            )
            .await?;
        command
            .create_response(
                &context.http,
                statistics_response(&statistics, range, command.data.name == "stats-surface"),
            )
            .await?;
        Ok(())
    }

    async fn playlist_command(
        &self,
        context: &Context,
        command: &CommandInteraction,
    ) -> Result<()> {
        let discord_id = command.user.id.get();
        let (name, filters, levels) = if command.data.name == "playlist-recommend" {
            anyhow::ensure!(
                self.backend.user(discord_id).await?.linked_user.is_some(),
                "Link your ZeepCentraal account first"
            );
            let count = integer_option(&command.data.options, "count").unwrap_or(15);
            (
                "Ranked Points Recommendations".to_owned(),
                vec!["high-points", "improvement-potential", "has-pb"],
                self.backend.recommended_playlist(discord_id, count).await?,
            )
        } else {
            let count = integer_option(&command.data.options, "count").context("Missing count")?;
            let sort = string_option(&command.data.options, "sort").context("Missing sort")?;
            let without_wr = bool_option(&command.data.options, "without-wr").unwrap_or(false);
            let without_pb = bool_option(&command.data.options, "without-pb").unwrap_or(false);
            let no_records = bool_option(&command.data.options, "no-records").unwrap_or(false);
            if without_wr || without_pb {
                anyhow::ensure!(
                    self.backend.user(discord_id).await?.linked_user.is_some(),
                    "Link your ZeepCentraal account first"
                );
            }
            let mut filters = vec![sort];
            if without_wr {
                filters.push("without-wr");
            }
            if without_pb {
                filters.push("without-pb");
            }
            if no_records {
                filters.push("no-records");
            }
            (
                string_option(&command.data.options, "name")
                    .unwrap_or("ZeepCentraal Top Levels")
                    .to_owned(),
                filters,
                self.backend
                    .playlist(discord_id, count, sort, without_wr, without_pb, no_records)
                    .await?,
            )
        };
        anyhow::ensure!(!levels.is_empty(), "No public levels matched these filters");
        command
            .create_response(&context.http, playlist_response(&name, &filters, &levels)?)
            .await?;
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
            FullEvent::Ready { data_about_bot, .. } => {
                self.state.set_guilds(data_about_bot.guilds.len() as usize);
                self.state.set_ready(true);
                self.feeds.start(context.http.clone()).await;
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
                    if let Err(error) = self.autocomplete(context, command).await {
                        tracing::error!(interaction_id = command.id.get(), %error, "Discord autocomplete failed");
                        let _ = command
                            .create_response(
                                &context.http,
                                CreateInteractionResponse::Autocomplete(Default::default()),
                            )
                            .await;
                    }
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
    let feeds = Arc::new(FeedService::new(backend.clone(), &config));
    let handler = Arc::new(Handler::new(config.clone(), backend, feeds.clone(), state));
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
    let result = client.start().await;
    feeds.stop().await;
    result?;
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

fn integer_option(options: &[CommandDataOption], name: &str) -> Option<i64> {
    options
        .iter()
        .find(|option| option.name == name)?
        .value
        .as_i64()
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

fn user_option(options: &[CommandDataOption], name: &str) -> Option<u64> {
    Some(
        options
            .iter()
            .find(|option| option.name == name)?
            .value
            .as_user_id()?
            .get(),
    )
}

fn profile_summary(profile: &Profile) -> String {
    format!(
        "**{}**\nRank {} • {} points • {} WRs",
        profile.steam_name.as_deref().unwrap_or("Unknown player"),
        if profile.rank > 0 {
            format!("#{}", profile.rank)
        } else {
            "Unranked".into()
        },
        profile.points,
        profile.world_records,
    )
}

fn profile_response(
    profile: &Profile,
    frontend_url: &reqwest::Url,
) -> CreateInteractionResponse<'static> {
    let mut components = vec![CreateContainerComponent::TextDisplay(
        CreateTextDisplay::new(format!(
            "## {}\nSteam ID  `{}`\n### Career summary\n**Rank**  {}  •  **Points**  {}\n**World records**  {}\n**Records / PBs**  {} / {}\n**Published levels / votes**  {} / {}\n-# ZeepCentraal",
            profile.steam_name.as_deref().unwrap_or("Unknown player"),
            profile.steam_id.as_deref().unwrap_or("Unknown"),
            if profile.rank > 0 {
                format!("#{}", profile.rank)
            } else {
                "Unranked".into()
            },
            profile.points,
            profile.world_records,
            profile.records,
            profile.personal_bests,
            profile.published_levels,
            profile.votes,
        )),
    )];
    if let Some(steam_id) = &profile.steam_id {
        let target = frontend_url
            .join(&format!("/user/{steam_id}"))
            .map(|url| url.to_string())
            .unwrap_or_else(|_| frontend_url.to_string());
        components.push(CreateContainerComponent::ActionRow(
            serenity::builder::CreateActionRow::buttons(vec![
                CreateButton::new_link(target).label("Open profile"),
            ]),
        ));
    }
    CreateInteractionResponse::Message(
        CreateInteractionResponseMessage::new()
            .components(vec![CreateComponent::Container(
                CreateContainer::new(components).accent_color(Colour::DARK_GREEN),
            )])
            .flags(MessageFlags::IS_COMPONENTS_V2)
            .allowed_mentions(CreateAllowedMentions::new()),
    )
}

fn level_response(
    level: &LevelProfile,
    frontend_url: &reqwest::Url,
) -> CreateInteractionResponse<'static> {
    let world_record = level.world_record.as_ref().map_or_else(
        || "None".into(),
        |record| {
            format!(
                "{} • {}",
                command_time(record.time),
                record.steam_name.as_deref().unwrap_or("Unknown player")
            )
        },
    );
    let leaderboard = if level.leaderboard.is_empty() {
        "No personal bests yet.".into()
    } else {
        level
            .leaderboard
            .iter()
            .map(|standing| {
                format!(
                    "**{}.** {} • {}",
                    standing.rank,
                    standing.steam_name.as_deref().unwrap_or("Unknown player"),
                    command_time(standing.time)
                )
            })
            .collect::<Vec<_>>()
            .join("\n")
    };
    let target = frontend_url
        .join(&format!("/level/{}", level.xx_hash))
        .map(|url| url.to_string())
        .unwrap_or_else(|_| frontend_url.to_string());
    CreateInteractionResponse::Message(
        CreateInteractionResponseMessage::new()
            .components(vec![CreateComponent::Container(
                CreateContainer::new(vec![
                    CreateContainerComponent::TextDisplay(CreateTextDisplay::new(format!(
                        "## {}\nBy {}\n### Level details\n**Hash / ID**  `{}` / `{}`\n**Points**  {}  •  **Rating**  {:.2}\n**Records / PBs**  {} / {}  •  **Votes**  {}\n**World record**  {}\n### Leaderboard\n{}\n-# ZeepCentraal",
                        level.name,
                        level.author_name.as_deref().unwrap_or("Unknown author"),
                        level.xx_hash,
                        level.id,
                        level.points,
                        level.rating,
                        level.records,
                        level.personal_bests,
                        level.votes,
                        world_record,
                        leaderboard,
                    ))),
                    CreateContainerComponent::ActionRow(
                        serenity::builder::CreateActionRow::buttons(vec![
                            CreateButton::new_link(target).label("Open level"),
                        ]),
                    ),
                ])
                .accent_color(Colour::DARK_GREEN),
            )])
            .flags(MessageFlags::IS_COMPONENTS_V2)
            .allowed_mentions(CreateAllowedMentions::new()),
    )
}

fn random_level_response(
    level: &RandomLevel,
    frontend_url: &reqwest::Url,
) -> CreateInteractionResponse<'static> {
    let target = frontend_url
        .join(&format!("/level/{}", level.xx_hash))
        .map(|url| url.to_string())
        .unwrap_or_else(|_| frontend_url.to_string());
    CreateInteractionResponse::Message(
        CreateInteractionResponseMessage::new()
            .components(vec![CreateComponent::Container(
                CreateContainer::new(vec![
                    CreateContainerComponent::TextDisplay(CreateTextDisplay::new(format!(
                        "## {}\nRandom public level • {} ranked points\n-# ZeepCentraal",
                        level.name, level.points
                    ))),
                    CreateContainerComponent::ActionRow(
                        serenity::builder::CreateActionRow::buttons(vec![
                            CreateButton::new_link(target).label("Open level"),
                        ]),
                    ),
                ])
                .accent_color(Colour::DARK_GREEN),
            )])
            .flags(MessageFlags::IS_COMPONENTS_V2)
            .allowed_mentions(CreateAllowedMentions::new()),
    )
}

fn command_time(seconds: f32) -> String {
    let milliseconds = (seconds * 1_000.0).round() as i64;
    format!(
        "{:02}:{:02}.{:03}",
        milliseconds / 60_000,
        milliseconds / 1_000 % 60,
        milliseconds % 1_000
    )
}

fn statistics_response(
    statistics: &UserStatistics,
    range: &str,
    surface: bool,
) -> CreateInteractionResponse<'static> {
    let body = if surface {
        [
            ("Tarmac", statistics.distance_on_tarmac),
            ("Grass", statistics.distance_on_grass),
            ("Sand", statistics.distance_on_sand),
            ("Soap", statistics.distance_on_soap),
            ("Wood", statistics.distance_on_wood),
            ("Mud", statistics.distance_on_mud),
            ("Ice 5", statistics.distance_on_ice1),
            ("Ice 10", statistics.distance_on_ice2),
            ("Ice 15", statistics.distance_on_ice3),
            ("Airborne", statistics.distance_in_air),
        ]
        .into_iter()
        .map(|(name, value)| format!("**{name}**  {:.0} m", value))
        .collect::<Vec<_>>()
        .join("\n")
    } else {
        format!(
            "**Records / PBs / WRs**  {} / {} / {}\n**Levels / votes**  {} / {}\n**Distance / time**  {:.0} m / {}\n**Average speed / G-force**  {:.2} km/h / {:.2} G\n**Maximum speed / G-force**  {:.2} km/h / {:.2} G",
            statistics.records,
            statistics.personal_bests,
            statistics.world_records,
            statistics.levels,
            statistics.votes,
            statistics.distance,
            command_time(statistics.time as f32),
            statistics.average_speed,
            statistics.average_gforce,
            statistics.max_speed,
            statistics.max_gforce,
        )
    };
    let title = if surface {
        "Surface statistics"
    } else {
        "Player statistics"
    };
    CreateInteractionResponse::Message(
        CreateInteractionResponseMessage::new()
            .components(vec![CreateComponent::Container(
                CreateContainer::new(vec![CreateContainerComponent::TextDisplay(
                    CreateTextDisplay::new(format!(
                        "## {title} • {}\n{} • {} telemetry samples\n### {}\n{}\n-# ZeepCentraal",
                        range.replace('-', " "),
                        statistics.steam_name.as_deref().unwrap_or("Unknown player"),
                        statistics.samples,
                        if surface {
                            "Distance by surface"
                        } else {
                            "Performance summary"
                        },
                        body,
                    )),
                )])
                .accent_color(Colour::DARK_GREEN),
            )])
            .flags(MessageFlags::IS_COMPONENTS_V2)
            .allowed_mentions(CreateAllowedMentions::new()),
    )
}

fn playlist_response(
    name: &str,
    filters: &[&str],
    levels: &[PlaylistLevel],
) -> Result<CreateInteractionResponse<'static>> {
    let playlist = serde_json::json!({
        "name":name,
        "amountOfLevels":levels.len(),
        "roundLength":720,
        "shufflePlaylist":true,
        "UID":[],
        "levels":levels.iter().map(|level| serde_json::json!({
            "UID":level.file_uid,
            "WorkshopID":level.workshop_id,
            "Name":level.name,
            "Author":level.file_author,
        })).collect::<Vec<_>>(),
    });
    let mut content = serde_json::to_string_pretty(&playlist)?;
    content.push('\n');
    let slug = format!("{}-{}", name, filters.join("-"))
        .to_ascii_lowercase()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    let filename = format!("{slug}.zeeplist");
    let preview = levels
        .iter()
        .take(15)
        .enumerate()
        .map(|(index, level)| format!("{}. {}", index + 1, level.name))
        .collect::<Vec<_>>()
        .join("\n");
    Ok(CreateInteractionResponse::Message(
        CreateInteractionResponseMessage::new()
            .components(vec![CreateComponent::Container(
                CreateContainer::new(vec![CreateContainerComponent::TextDisplay(
                    CreateTextDisplay::new(format!(
                        "## {name}\n{} public levels matched.\n### Preview\n{}\n### Playlist details\n**Filters**  {}\n**Install**  Place attached file in `%AppData%\\Zeepkist\\Playlists`.\n-# ZeepCentraal",
                        levels.len(),
                        preview,
                        filters.join(", "),
                    )),
                )])
                .accent_color(Colour::DARK_GREEN),
            )])
            .add_file(CreateAttachment::bytes(content.into_bytes(), filename))
            .flags(MessageFlags::IS_COMPONENTS_V2 | MessageFlags::EPHEMERAL)
            .allowed_mentions(CreateAllowedMentions::new()),
    ))
}

fn subcommand(options: &[CommandDataOption]) -> Option<(&str, &[CommandDataOption])> {
    let option = options.first()?;
    let CommandDataOptionValue::SubCommand(children) = &option.value else {
        return None;
    };
    Some((&option.name, children))
}

fn supports_command(name: &str) -> bool {
    matches!(
        name,
        "link"
            | "unlink"
            | "wr-ping"
            | "feed"
            | "watch"
            | "level"
            | "user"
            | "totw"
            | "totm"
            | "playlist"
            | "playlist-recommend"
            | "stats"
            | "stats-surface"
            | "modkist"
            | "gtr"
            | "compare"
            | "random-level"
            | "help"
            | "bot-status"
            | "ZeepCentraal profile"
    )
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
        assert_ne!(flags & u64::from(MessageFlags::IS_COMPONENTS_V2.bits()), 0);
    }

    #[test]
    fn every_registered_command_has_a_dispatch_path() {
        let commands = commands::command_specs().unwrap();
        assert_eq!(commands.len(), 20);
        assert!(
            commands
                .iter()
                .all(|command| supports_command(&command.name))
        );
    }
}
