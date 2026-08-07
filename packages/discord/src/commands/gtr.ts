import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import type { CommandContext } from './context'
import { modkistGtrHandler } from './utils/modkist-gtr'

export const gtrDefinition = new SlashCommandBuilder()
	.setName('gtr')
	.setDescription('Show Modkist and GTR setup information')

export function gtrHandler(interaction: ChatInputCommandInteraction, context: CommandContext) {
	return modkistGtrHandler(interaction, context)
}
