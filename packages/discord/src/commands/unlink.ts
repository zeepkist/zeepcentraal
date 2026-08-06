import { type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js'
import type { CommandContext } from './context'

export const unlinkDefinition = new SlashCommandBuilder()
	.setName('unlink')
	.setDescription('Unlink your Discord and ZeepCentraal accounts')

export async function unlinkHandler(
	interaction: ChatInputCommandInteraction,
	context: CommandContext,
) {
	await context.backend.unlink(interaction.user.id)
	await interaction.reply({
		flags: MessageFlags.Ephemeral,
		content: 'Discord account unlinked.',
	})
}
