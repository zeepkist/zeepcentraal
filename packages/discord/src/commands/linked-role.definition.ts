import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'

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
