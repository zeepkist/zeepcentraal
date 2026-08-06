import type { ChatInputCommandInteraction } from 'discord.js'
import type { LinkedUser } from '../types'
import type { CommandContext } from './context'
import { linkedUserOrThrow } from './utils/linked-user'
import { renderUser } from './utils/user-profile.handler'

async function userForInteraction(
	interaction: ChatInputCommandInteraction,
	context: CommandContext,
) {
	const target = interaction.options.getUser('discord')
	if (target) return linkedUserOrThrow(await context.backend.user(target.id))
	const identifier = interaction.options.getString('id')
	if (identifier) {
		const filter =
			identifier.length >= 16
				? { steamId: { equalTo: identifier } }
				: { id: { equalTo: Number(identifier) } }
		const result = await context.graphql.userByFilter(filter)
		if (!result) throw new Error('Player not found.')
		return result as unknown as LinkedUser
	}
	return linkedUserOrThrow(await context.backend.user(interaction.user.id))
}

export async function handleUser(
	interaction: ChatInputCommandInteraction,
	context: CommandContext,
) {
	await interaction.deferReply()
	await renderUser(interaction, context, await userForInteraction(interaction, context))
}
