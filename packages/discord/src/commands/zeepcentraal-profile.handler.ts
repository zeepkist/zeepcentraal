import type { UserContextMenuCommandInteraction } from 'discord.js'
import type { CommandContext } from './context'
import { linkedUserOrThrow } from './utils/linked-user'
import { renderUser } from './utils/user-profile.handler'

export async function handleZeepCentraalProfile(
	interaction: UserContextMenuCommandInteraction,
	context: CommandContext,
) {
	await interaction.deferReply()
	const user = linkedUserOrThrow(await context.backend.user(interaction.targetId))
	await renderUser(interaction, context, user)
}
