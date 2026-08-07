import type { ButtonInteraction } from 'discord.js'
import type { CommandContext } from '../context'
import { paginationHandler } from './pagination'
import { playlistHandler } from './playlist'

export async function buttonHandler(interaction: ButtonInteraction, context: CommandContext) {
	context.runtime.sessions.cleanup()
	const [kind, id, direction] = interaction.customId.split(':')
	if (!id) return false
	if (kind === 'page') return paginationHandler(interaction, context, id, direction)
	if (kind === 'playlist') return playlistHandler(interaction, context, id)
	return false
}
