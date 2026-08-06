import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import type { CommandContext } from './context'
import { dateRangeChoices } from './utils/date-range.definition'
import { handleStatistics } from './utils/statistics.handler'

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

export function statsHandler(interaction: ChatInputCommandInteraction, context: CommandContext) {
	return handleStatistics(interaction, context, false)
}
