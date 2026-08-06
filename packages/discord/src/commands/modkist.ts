import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import type { CommandContext } from './context'
import { handleModkistGtr } from './utils/modkist-gtr.handler'

export const modkistDefinition = new SlashCommandBuilder()
	.setName('modkist')
	.setDescription('Show Modkist and GTR setup information')

export function modkistHandler(interaction: ChatInputCommandInteraction, context: CommandContext) {
	return handleModkistGtr(interaction, context)
}
