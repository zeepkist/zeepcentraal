import {
	ApplicationCommandType,
	ContextMenuCommandBuilder,
	type UserContextMenuCommandInteraction,
} from 'discord.js'
import type { CommandContext } from './context'
import { linkedUserOrThrow } from './utils/linked-user'
import { userProfileHandler } from './utils/user-profile'

export const zeepCentraalProfileDefinition = new ContextMenuCommandBuilder()
	.setName('ZeepCentraal profile')
	.setType(ApplicationCommandType.User)

export async function zeepCentraalProfileHandler(
	interaction: UserContextMenuCommandInteraction,
	context: CommandContext,
) {
	await interaction.deferReply()
	const user = linkedUserOrThrow(await context.backend.user(interaction.targetId))
	await userProfileHandler(interaction, context, user)
}
