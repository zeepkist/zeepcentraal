import { SlashCommandBuilder } from 'discord.js'
import { dateRangeChoices } from './utils/date-range.definition'

export const statsDefinition = new SlashCommandBuilder()
	.setName('stats')
	.setDescription('Show player activity statistics')
	.addStringOption((option) =>
		option
			.setName('range')
			.setDescription('Date range')
			.setRequired(true)
			.addChoices(...dateRangeChoices.map(([value, name]) => ({ value, name }))),
	)
	.addStringOption((option) => option.setName('from').setDescription('Custom start: YYYY-MM-DD'))
	.addStringOption((option) => option.setName('to').setDescription('Custom end: YYYY-MM-DD'))
