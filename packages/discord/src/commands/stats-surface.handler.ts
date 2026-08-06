import type { ChatInputCommandInteraction } from 'discord.js'
import type { CommandContext } from './context'
import { handleStatistics } from './utils/statistics.handler'

export function handleStatsSurface(
	interaction: ChatInputCommandInteraction,
	context: CommandContext,
) {
	return handleStatistics(interaction, context, true)
}
