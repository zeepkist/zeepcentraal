import { SlashCommandBuilder } from 'discord.js'

export const randomLevelDefinition = new SlashCommandBuilder()
	.setName('random-level')
	.setDescription('Pick a random public level')
	.addIntegerOption((option) =>
		option.setName('minimum-points').setDescription('Minimum level points'),
	)
