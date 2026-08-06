import { type ChatInputCommandInteraction, MessageFlags } from 'discord.js'
import type { CommandContext } from './context'

export async function handleWrPing(
	interaction: ChatInputCommandInteraction,
	context: CommandContext,
) {
	const enabled = interaction.options.getBoolean('enabled', true)
	await context.backend.setPreference(interaction.user.id, enabled)
	await interaction.reply({
		flags: MessageFlags.Ephemeral,
		content: `WR-loss pings ${enabled ? 'enabled' : 'disabled'}.`,
	})
}
