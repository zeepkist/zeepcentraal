import { SlashCommandBuilder } from 'discord.js'

export const playlistDefinition = new SlashCommandBuilder()
	.setName('playlist')
	.setDescription('Generate playlist from top public levels')
	.addIntegerOption((option) =>
		option
			.setName('count')
			.setDescription('Level count')
			.setMinValue(1)
			.setMaxValue(100)
			.setRequired(true),
	)
	.addStringOption((option) =>
		option
			.setName('sort')
			.setDescription('Ranking source')
			.setRequired(true)
			.addChoices(
				{ name: 'Ranked points', value: 'points' },
				{ name: 'Popularity', value: 'popularity' },
				{ name: 'Record count', value: 'records' },
				{ name: 'Newest workshop item', value: 'created' },
				{ name: 'Recently updated', value: 'updated' },
			),
	)
	.addBooleanOption((option) => option.setName('without-wr').setDescription('Exclude your WRs'))
	.addBooleanOption((option) => option.setName('without-pb').setDescription('Exclude your PBs'))
	.addBooleanOption((option) =>
		option.setName('no-records').setDescription('Only levels without records'),
	)
	.addStringOption((option) =>
		option.setName('name').setDescription('Playlist name').setMaxLength(50),
	)
