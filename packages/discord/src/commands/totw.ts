import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import type { CommandContext } from './context'
import { tournamentHandler } from './utils/tournament'

export const totwDefinition = new SlashCommandBuilder()
	.setName('totw')
	.setDescription('Show latest Track of the Week tournament')

export function totwHandler(interaction: ChatInputCommandInteraction, context: CommandContext) {
	return tournamentHandler(interaction, context, 0)
}
