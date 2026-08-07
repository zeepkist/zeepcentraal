import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import type { LinkedUser } from '../types'
import type { CommandContext } from './context'
import { linkedUserOrThrow } from './utils/linked-user'
import { userProfileHandler } from './utils/user-profile'

export const userDefinition = new SlashCommandBuilder()
	.setName('user')
	.setDescription('Get ZeepCentraal player information')
	.addUserOption((option) =>
		option.setName('discord').setDescription('Linked Discord user').setRequired(false),
	)
	.addStringOption((option) =>
		option.setName('id').setDescription('Steam ID or ZeepCentraal user ID').setRequired(false),
	)

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

export async function userHandler(
	interaction: ChatInputCommandInteraction,
	context: CommandContext,
) {
	await interaction.deferReply()
	await userProfileHandler(interaction, context, await userForInteraction(interaction, context))
}
