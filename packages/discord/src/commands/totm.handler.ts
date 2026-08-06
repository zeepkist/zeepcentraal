import type { ChatInputCommandInteraction } from 'discord.js'
import type { CommandContext } from './context'
import { handleTournament } from './utils/tournament.handler'

export function handleTotm(interaction: ChatInputCommandInteraction, context: CommandContext) {
	return handleTournament(interaction, context, 1)
}
