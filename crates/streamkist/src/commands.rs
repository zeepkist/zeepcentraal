use serenity::{
    all::{ChannelType, CommandOptionType, Permissions},
    builder::{CreateCommand, CreateCommandOption},
};

pub fn definitions() -> Vec<CreateCommand<'static>> {
    vec![
        CreateCommand::new("ping").description("Check the bot's latency"),
        CreateCommand::new("add-stream-channel")
            .description("Add a Discord channel to post Twitch stream notifications in")
            .default_member_permissions(Permissions::MANAGE_GUILD)
            .add_option(
                CreateCommandOption::new(
                    CommandOptionType::String,
                    "category",
                    "The Twitch game category to set",
                )
                .required(true)
                .set_autocomplete(true),
            )
            .add_option(
                CreateCommandOption::new(
                    CommandOptionType::Channel,
                    "channel",
                    "The Discord channel to post stream notifications in",
                )
                .required(true)
                .channel_types(vec![ChannelType::Text, ChannelType::News]),
            )
            .add_option(
                CreateCommandOption::new(
                    CommandOptionType::Integer,
                    "minimum-viewers",
                    "Minimum viewers before first announcement (default: 0)",
                )
                .min_int_value(0)
                .max_int_value(i64::from(i32::MAX)),
            )
            .add_option(CreateCommandOption::new(
                CommandOptionType::Boolean,
                "allow-category-switches",
                "Keep tracking outside watched categories (default: false)",
            )),
        CreateCommand::new("show-stream-channels")
            .description("Show and delete active Twitch stream channels")
            .default_member_permissions(Permissions::MANAGE_GUILD),
    ]
}

pub fn can_manage(permissions: Option<Permissions>) -> bool {
    permissions.is_some_and(|permissions| {
        permissions.intersects(Permissions::MANAGE_GUILD | Permissions::ADMINISTRATOR)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn commands_preserve_names_and_support_game_and_native_channel_completion() {
        let commands = serde_json::to_value(definitions()).unwrap();
        assert_eq!(commands[0]["name"], "ping");
        assert_eq!(commands[1]["name"], "add-stream-channel");
        assert_eq!(commands[2]["name"], "show-stream-channels");
        assert_eq!(commands[1]["options"][0]["autocomplete"], true);
        assert_eq!(commands[1]["options"][1]["type"], 7);
        assert_eq!(commands[1]["default_member_permissions"], "32");
        let minimum = &commands[1]["options"][2];
        assert_eq!(minimum["name"], "minimum-viewers");
        assert_eq!(minimum["type"], 4);
        assert_eq!(minimum["min_value"], 0);
        assert_eq!(minimum["max_value"], i32::MAX);
        assert_ne!(minimum["required"], true);
        let switches = &commands[1]["options"][3];
        assert_eq!(switches["name"], "allow-category-switches");
        assert_eq!(switches["type"], 5);
        assert_ne!(switches["required"], true);
    }
    #[test]
    fn requires_server_moderation_permission() {
        assert!(!can_manage(None));
        assert!(!can_manage(Some(Permissions::SEND_MESSAGES)));
        assert!(can_manage(Some(Permissions::MANAGE_GUILD)));
        assert!(can_manage(Some(Permissions::ADMINISTRATOR)));
    }
}
