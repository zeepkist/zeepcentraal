import { SlashCommandBuilder } from 'discord.js'

export const playlistRecommendDefinition = new SlashCommandBuilder()
	.setName('playlist-recommend')
	.setDescription('Generate high-value ranked point improvement playlist')
	.addIntegerOption((option) =>
		option.setName('count').setDescription('Level count').setMinValue(1).setMaxValue(50),
	)
