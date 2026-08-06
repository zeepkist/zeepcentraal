import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import type { CommandContext } from './context'
import { handleModkistGtr } from './utils/modkist-gtr.handler'

export const gtrDefinition = new SlashCommandBuilder()
	.setName('gtr')
	.setDescription('Show Modkist and GTR setup information')

export function gtrHandler(interaction: ChatInputCommandInteraction, context: CommandContext) {
	return handleModkistGtr(interaction, context)
}
