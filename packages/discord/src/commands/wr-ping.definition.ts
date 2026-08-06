import { SlashCommandBuilder } from 'discord.js'

export const wrPingDefinition = new SlashCommandBuilder()
	.setName('wr-ping')
	.setDescription('Configure ping when you lose a world record')
	.addBooleanOption((option) =>
		option.setName('enabled').setDescription('Ping on WR loss').setRequired(true),
	)
