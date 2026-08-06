import { SlashCommandBuilder } from 'discord.js'

export const compareDefinition = new SlashCommandBuilder()
	.setName('compare')
	.setDescription('Compare two linked players')
	.addUserOption((option) =>
		option.setName('player').setDescription('Other player').setRequired(true),
	)
