import { Zc_UserContributionsDocument } from '@zeepkist/graphql/generated'
import { type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js'
import type { CommandContext } from './context'
import { linkedUserOrThrow } from './utils/linked-user'
import { type PlaylistLevel, playlistResponse } from './utils/playlist'

export const playlistRecommendDefinition = new SlashCommandBuilder()
	.setName('playlist-recommend')
	.setDescription('Generate high-value ranked point improvement playlist')
	.addIntegerOption((option) =>
		option.setName('count').setDescription('Level count').setMinValue(1).setMaxValue(50),
	)

export async function playlistRecommendHandler(
	interaction: ChatInputCommandInteraction,
	context: CommandContext,
) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral })
	const linked = linkedUserOrThrow(await context.backend.user(interaction.user.id))
	const count = interaction.options.getInteger('count') ?? 15
	const data = await context.graphql.query<Record<string, unknown>>(
		Zc_UserContributionsDocument,
		{
			first: Math.min(100, count * 4),
			filter: { userId: { equalTo: linked.id }, levelPosition: { greaterThan: 1 } },
			orderBy: ['LEVEL_POINTS_DESC', 'LEVEL_POSITION_DESC'],
		},
	)
	const nodes = (
		(data as { userPointContributions?: { edges: Array<{ node: Record<string, unknown> }> } })
			.userPointContributions?.edges ?? []
	)
		.map((edge) => edge.node)
		.filter(
			(node) =>
				Number(node.levelPoints) - Number(node.playerDecayedPoints) >=
				Math.max(100, Number(node.levelPoints) * 0.15),
		)
		.sort(
			(left, right) =>
				Number(right.levelPoints) -
				Number(right.playerDecayedPoints) -
				(Number(left.levelPoints) - Number(left.playerDecayedPoints)),
		)
		.slice(0, count)
	const levels = (
		await Promise.all(
			nodes.map((node) =>
				context.graphql.levelById(Number((node.record as { levelId: number }).levelId)),
			),
		)
	).filter((level): level is Record<string, unknown> =>
		Boolean(level),
	) as unknown as PlaylistLevel[]
	await interaction.editReply(
		playlistResponse(context, interaction.user.id, 'Ranked Points Recommendations', levels, [
			'high-points',
			'improvement-potential',
			'has-pb',
		]),
	)
}
