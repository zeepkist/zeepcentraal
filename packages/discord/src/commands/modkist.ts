import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import type { CommandContext } from './context'
import { modkistGtrHandler } from './utils/modkist-gtr'

export const modkistDefinition = new SlashCommandBuilder()
	.setName('modkist')
	.setDescription('Show Modkist and GTR setup information')

export function modkistHandler(interaction: ChatInputCommandInteraction, context: CommandContext) {
	return modkistGtrHandler(interaction, context)
}
