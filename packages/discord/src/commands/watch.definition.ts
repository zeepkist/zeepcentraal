import { SlashCommandBuilder } from 'discord.js'

export const watchDefinition = new SlashCommandBuilder()
	.setName('watch')
	.setDescription('Manage direct-message watches')
	.addSubcommand((subcommand) =>
		subcommand
			.setName('add')
			.setDescription('Watch a player, level, author, or tournament')
			.addStringOption((option) =>
				option
					.setName('kind')
					.setDescription('Watch type')
					.setRequired(true)
					.addChoices(
						{ name: 'Player', value: 'player' },
						{ name: 'Level', value: 'level' },
						{ name: 'Author', value: 'author' },
						{ name: 'Tournament', value: 'tournament' },
					),
			)
			.addStringOption((option) =>
				option
					.setName('target')
					.setDescription('ID, hash, name, or slug')
					.setRequired(true),
			),
	)
	.addSubcommand((subcommand) => subcommand.setName('list').setDescription('List active watches'))
	.addSubcommand((subcommand) =>
		subcommand
			.setName('remove')
			.setDescription('Remove a watch')
			.addStringOption((option) =>
				option.setName('id').setDescription('Watch ID from /watch list').setRequired(true),
			),
	)
