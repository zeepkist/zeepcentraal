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
import { type CursorWindow, createCursorPages } from './utils/pagination'

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

function zslRow(node: Record<string, unknown>, users: Map<number, LinkedUser>) {
	const position = Number(node.position ?? 0)
	const points = Number(node.points ?? 0)
	const user = node.user as LinkedUser | null
	const time = typeof node.time === 'number' ? ` • ${formatTime(node.time)}` : ''
	return `**${position}.** ${playerLabel(users.get(user?.id ?? 0) ?? user)}${time} • ${points} pts`
}

function zslLeaderboard(
	document: DocumentNode,
	connectionName: 'zslLevelResults' | 'zslRoundResults' | 'zslSeasonResults',
	variables: Record<string, unknown>,
	viewerId: number,
	includeViewer: boolean,
	context: CommandContext,
) {
	return async (window: CursorWindow) => {
		const data = await context.graphql.query<Record<string, unknown>>(document, {
			...variables,
			...window,
			viewerId,
			includeViewer,
		})
		const result = data as {
			viewerStanding?: { nodes: Array<Record<string, unknown>> }
			[key: string]: unknown
		}
		const connection = result[connectionName] as
			| {
					edges: Array<{ node: Record<string, unknown> }>
					pageInfo: {
						endCursor?: string | null
						hasNextPage: boolean
						hasPreviousPage: boolean
						startCursor?: string | null
					}
					totalCount: number
			  }
			| undefined
		if (!connection) {
			return {
				pageInfo: { hasNextPage: false, hasPreviousPage: false },
				rows: [],
				totalCount: 0,
			}
		}
		const nodes = connection.edges.map((edge) => edge.node)
		const viewer = result.viewerStanding?.nodes[0]
		const ids = [
			...nodes.map((node) => Number(node.userId)),
			...(viewer ? [Number(viewer.userId)] : []),
		].filter(Number.isFinite)
		const users = (await context.graphql.usersByIds(ids)) as Map<number, LinkedUser>
		const viewerOnPage = viewer && nodes.some((node) => node.userId === viewer.userId)
		return {
			pageInfo: connection.pageInfo,
			rows: nodes.map((node) => zslRow(node, users)),
			sections:
				viewer && !viewerOnPage
					? [{ content: zslRow(viewer, users), heading: 'Your result' }]
					: undefined,
			totalCount: connection.totalCount,
		}
	}
}

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
	await interaction.editReply(
		await createCursorPages(
			context,
			interaction.user.id,
			{
				description: 'Super League standings',
				emptyDescription: 'No results yet.',
				title,
			},
			zslLeaderboard(document, connectionName, variables, viewerId, Boolean(linked), context),
		),
	)
}
