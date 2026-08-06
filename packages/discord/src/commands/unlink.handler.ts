import { type ChatInputCommandInteraction, MessageFlags } from 'discord.js'
import type { CommandContext } from './context'

export async function handleUnlink(
	interaction: ChatInputCommandInteraction,
	context: CommandContext,
) {
	await context.backend.unlink(interaction.user.id)
	await interaction.reply({
		flags: MessageFlags.Ephemeral,
		content: 'Discord account unlinked.',
	})
}
