import type { ButtonInteraction } from 'discord.js'
import type { CommandContext } from '../context'
import { handlePaginationButton } from './pagination.handler'
import { handlePlaylistButton } from './playlist.handler'

export async function handleButton(interaction: ButtonInteraction, context: CommandContext) {
	context.runtime.sessions.cleanup()
	const [kind, id, direction] = interaction.customId.split(':')
	if (!id) return false
	if (kind === 'page') return handlePaginationButton(interaction, context, id, direction)
	if (kind === 'playlist') return handlePlaylistButton(interaction, context, id)
	return false
}
