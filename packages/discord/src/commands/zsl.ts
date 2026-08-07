import {
	Zc_ZslLevelResultsDocument,
	Zc_ZslRoundResultsDocument,
	Zc_ZslSeasonResultsDocument,
} from '@zeepkist/graphql/generated'
import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import type { DocumentNode } from 'graphql'
import { formatTime, playerLabel } from '../format'
import type { LinkedUser } from '../types'
import type { CommandContext } from './context'
import { createPages } from './utils/pagination'

export const zslDefinition = new SlashCommandBuilder()
	.setName('zsl')
	.setDescription('Show Super League season, round, or level results')
	.addStringOption((option) =>
		option
			.setName('scope')
			.setDescription('Result scope')
			.setRequired(true)
			.addChoices(
				{ name: 'Season', value: 'season' },
				{ name: 'Round', value: 'round' },
				{ name: 'Level', value: 'level' },
			),
	)
	.addIntegerOption((option) =>
		option
			.setName('id')
			.setDescription('Season or ZSL level ID')
			.setRequired(true)
			.setMinValue(1),
	)
	.addIntegerOption((option) =>
		option.setName('round').setDescription('Round number for round scope').setMinValue(1),
	)

export async function zslHandler(
	interaction: ChatInputCommandInteraction,
	context: CommandContext,
) {
	await interaction.deferReply()
	const scope = interaction.options.getString('scope', true)
	const id = interaction.options.getInteger('id', true)
	const linked = (await context.backend.user(interaction.user.id)).linkedUser
	const viewerId = linked?.id ?? 0
	let document: DocumentNode = Zc_ZslLevelResultsDocument
	let connectionName = 'zslLevelResults' as
		| 'zslLevelResults'
		| 'zslRoundResults'
		| 'zslSeasonResults'
	let variables: Record<string, unknown> = { id }
	let title: string
	if (scope === 'season') {
		document = Zc_ZslSeasonResultsDocument
		connectionName = 'zslSeasonResults'
		title = `Super League season ${id}`
	} else if (scope === 'round') {
		const round = interaction.options.getInteger('round')
		if (!round) throw new Error('Round scope needs `round`.')
		document = Zc_ZslRoundResultsDocument
		connectionName = 'zslRoundResults'
		variables = { seasonId: id, round }
		title = `Super League season ${id}, round ${round}`
	} else {
		title = `Super League level ${id}`
	}
	const nodes: Array<Record<string, unknown>> = []
	let viewer: Record<string, unknown> | undefined
	let after: unknown
	for (let page = 0; page < 50; page++) {
		const data = await context.graphql.query<Record<string, unknown>>(document, {
			...variables,
			viewerId,
			includeViewer: Boolean(linked),
			first: 100,
			after,
		})
		const result = data as {
			viewerStanding?: { nodes: Array<Record<string, unknown>> }
			[key: string]: unknown
		}
		viewer ??= result.viewerStanding?.nodes[0]
		const connection = result[connectionName] as
			| {
					edges: Array<{ node: Record<string, unknown> }>
					pageInfo: { endCursor?: unknown; hasNextPage: boolean }
			  }
			| undefined
		if (!connection) break
		nodes.push(...connection.edges.map((edge) => edge.node))
		if (!connection.pageInfo.hasNextPage || !connection.pageInfo.endCursor) break
		after = connection.pageInfo.endCursor
	}
	const ids = [
		...nodes
			.map((node) => (node.user as { id?: number } | null)?.id)
			.filter((value): value is number => typeof value === 'number'),
		...[(viewer?.user as { id?: number } | null)?.id].filter(
			(value): value is number => typeof value === 'number',
		),
	]
	const users = await context.graphql.usersByIds(ids)
	const rows = nodes.map((node) => {
		const position = Number(node.position ?? 0)
		const points = Number(node.points ?? 0)
		const user = node.user as LinkedUser | null
		const time = typeof node.time === 'number' ? ` • ${formatTime(node.time)}` : ''
		return `**${position}.** ${playerLabel(users.get(user?.id ?? 0) ?? user)}${time} • ${points} pts`
	})
	if (viewer && !nodes.some((node) => node.userId === viewer.userId)) {
		const user = viewer.user as LinkedUser | null
		rows.push(
			`\n**Your result:** ${viewer.position}. ${playerLabel(users.get(user?.id ?? 0) ?? user)}${typeof viewer.time === 'number' ? ` • ${formatTime(viewer.time)}` : ''} • ${viewer.points} pts`,
		)
	}
	await interaction.editReply(createPages(context, interaction.user.id, title, rows))
}
