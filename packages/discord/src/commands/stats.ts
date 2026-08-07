import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import type { CommandContext } from './context'
import { dateRangeDefinition } from './utils/date-range'
import { statisticsHandler } from './utils/statistics'

export const statsDefinition = new SlashCommandBuilder()
	.setName('stats')
	.setDescription('Show player activity statistics')
	.addStringOption((option) =>
		option
			.setName('range')
			.setDescription('Date range')
			.setRequired(true)
			.addChoices(...dateRangeDefinition.map(([value, name]) => ({ value, name }))),
	)
	.addStringOption((option) => option.setName('from').setDescription('Custom start: YYYY-MM-DD'))
	.addStringOption((option) => option.setName('to').setDescription('Custom end: YYYY-MM-DD'))

export function statsHandler(interaction: ChatInputCommandInteraction, context: CommandContext) {
	return statisticsHandler(interaction, context, false)
}
