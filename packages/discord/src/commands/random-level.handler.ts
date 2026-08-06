import { Zc_LevelsDocument } from '@zeepkist/graphql/generated'
import type { ChatInputCommandInteraction } from 'discord.js'
import { baseEmbed, compactNumber } from '../format'
import type { CommandContext } from './context'
import type { PlaylistLevel } from './utils/playlist.handler'

export async function handleRandomLevel(
	interaction: ChatInputCommandInteraction,
	context: CommandContext,
) {
	await interaction.deferReply()
	const minimum = interaction.options.getInteger('minimum-points') ?? 0
	const data = await context.graphql.query<Record<string, unknown>>(Zc_LevelsDocument, {
		first: 100,
		filter: {
			publiclyVisible: { equalTo: true },
			levelPoints: { points: { greaterThanOrEqualTo: minimum } },
			levelItems: { some: { deleted: { equalTo: false } } },
		},
		orderBy: ['ID_DESC'],
	})
	const levels = (
		(data as { levels?: { edges: Array<{ node: PlaylistLevel }> } }).levels?.edges ?? []
	).map((edge) => edge.node)
	const level = levels[Math.floor(context.runtime.random() * levels.length)]
	if (!level) throw new Error('No public level matched.')
	await interaction.editReply({
		embeds: [
			{
				...baseEmbed(
					level.levelItems?.nodes[0]?.name ?? level.xxHash,
					`Random public level • ${compactNumber(level.levelPoints?.points)} ranked points`,
				),
				url: `${context.config.frontendUrl}/level/${level.xxHash}`,
			},
		],
	})
}
