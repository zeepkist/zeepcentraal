import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import type { CommandContext } from './context'
import { handleTournament } from './utils/tournament.handler'

export const totwDefinition = new SlashCommandBuilder()
	.setName('totw')
	.setDescription('Show latest Track of the Week tournament')

export function totwHandler(interaction: ChatInputCommandInteraction, context: CommandContext) {
	return handleTournament(interaction, context, 0)
}
