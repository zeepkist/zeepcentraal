import { SlashCommandBuilder } from 'discord.js'

export const zslDefinition = new SlashCommandBuilder()
	.setName('zsl')
	.setDescription('Show Super League season, round, or level results')
	.addStringOption((option) =>
		option
			.setName('scope')
			.setDescription('Result scope')
			.setRequired(true)
			.addChoices(
				{ name: 'Season', value: 'season' },
				{ name: 'Round', value: 'round' },
				{ name: 'Level', value: 'level' },
			),
	)
	.addIntegerOption((option) =>
		option
			.setName('id')
			.setDescription('Season or ZSL level ID')
			.setRequired(true)
			.setMinValue(1),
	)
	.addIntegerOption((option) =>
		option.setName('round').setDescription('Round number for round scope').setMinValue(1),
	)
