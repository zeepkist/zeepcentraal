import { type ChatInputCommandInteraction, MessageFlags } from 'discord.js'
import type { CommandContext } from './context'

export async function handleLinkedRole(
	interaction: ChatInputCommandInteraction,
	context: CommandContext,
) {
	if (!interaction.guildId) throw new Error('Run this command inside a server.')
	const role = interaction.options.getRole('role')
	await context.backend.setLinkedRole(interaction.guildId, role?.id ?? null)
	await interaction.reply({
		flags: MessageFlags.Ephemeral,
		content: role
			? `Linked-account role set to <@&${role.id}>.`
			: 'Linked-account role disabled.',
	})
}
