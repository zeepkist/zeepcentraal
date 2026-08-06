import type { ChatInputCommandInteraction } from 'discord.js'
import type { CommandContext } from './context'
import { handleModkistGtr } from './utils/modkist-gtr.handler'

export function handleGtr(interaction: ChatInputCommandInteraction, context: CommandContext) {
	return handleModkistGtr(interaction, context)
}
