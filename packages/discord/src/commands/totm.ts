import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import type { CommandContext } from './context'
import { tournamentHandler } from './utils/tournament'

export const totmDefinition = new SlashCommandBuilder()
	.setName('totm')
	.setDescription('Show latest Track of the Month tournament')

export function totmHandler(interaction: ChatInputCommandInteraction, context: CommandContext) {
	return tournamentHandler(interaction, context, 1)
}
