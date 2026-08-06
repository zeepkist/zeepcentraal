import {
	type ChatInputCommandInteraction,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from 'discord.js'
import type { CommandContext } from './context'

export const linkedRoleDefinition = new SlashCommandBuilder()
	.setName('linked-role')
	.setDescription('Configure role assigned to linked ZeepCentraal users')
	.setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
	.addRoleOption((option) =>
		option
			.setName('role')
			.setDescription('Role, omit to disable automatic role')
			.setRequired(false),
	)

export async function linkedRoleHandler(
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
