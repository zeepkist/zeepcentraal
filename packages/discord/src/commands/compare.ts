import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import { displayContainer, editPayload } from '../display'
import { compactNumber, playerLabel } from '../format'
import type { CommandContext } from './context'
import { linkedUserOrThrow } from './utils/linked-user'

export const compareDefinition = new SlashCommandBuilder()
	.setName('compare')
	.setDescription('Compare two linked players')
	.addUserOption((option) =>
		option.setName('player').setDescription('Other player').setRequired(true),
	)

export async function compareHandler(
	interaction: ChatInputCommandInteraction,
	context: CommandContext,
) {
	await interaction.deferReply()
	const first = linkedUserOrThrow(await context.backend.user(interaction.user.id))
	const secondDiscord = interaction.options.getUser('player', true)
	const second = linkedUserOrThrow(await context.backend.user(secondDiscord.id))
	const profiles = await Promise.all([
		context.graphql.userByFilter({ id: { equalTo: first.id } }),
		context.graphql.userByFilter({ id: { equalTo: second.id } }),
	])
	const sections = profiles.map((profile, index) => {
		const typed = profile as {
			discordId: string
			steamName: string
			userPoints?: { points: number; rank: number; worldRecords: number } | null
		}
		return {
			content: `**${playerLabel(typed)}**\nRank ${typed.userPoints?.rank ? `#${typed.userPoints.rank}` : 'Unranked'} • ${compactNumber(typed.userPoints?.points)} pts • ${typed.userPoints?.worldRecords ?? 0} WRs`,
			heading: index === 0 ? 'You' : 'Opponent',
		}
	})
	await interaction.editReply(
		editPayload(displayContainer({ sections, title: 'Player comparison' })),
	)
}
