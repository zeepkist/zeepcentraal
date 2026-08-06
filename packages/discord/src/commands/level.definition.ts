import { SlashCommandBuilder } from 'discord.js'

export const levelDefinition = new SlashCommandBuilder()
	.setName('level')
	.setDescription('Find level by hash, ID, name, or author')
	.addStringOption((option) =>
		option
			.setName('query')
			.setDescription('Level hash, ID, name, or author')
			.setAutocomplete(true)
			.setRequired(true),
	)
