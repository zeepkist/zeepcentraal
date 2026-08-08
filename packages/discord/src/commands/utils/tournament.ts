import {
	Zc_TrackTournamentDetailDocument,
	Zc_TrackTournamentIndexDocument,
} from '@zeepkist/graphql/generated'
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	type ChatInputCommandInteraction,
} from 'discord.js'
import { displayContainer, messagePayload } from '../../display'
import { formatTime, playerLabel } from '../../format'
import type { LinkedUser } from '../../types'
import type { CommandContext } from '../context'
import { type CursorWindow, createCursorPages, type PagePresentation } from './pagination'

type TournamentResult = {
	points: number
	rank: number
	time: number
	user?: LinkedUser | null
	userId: number
}

type Tournament = {
	endAt: string
	id: number
	level?: {
		levelItems: { nodes: Array<{ imageUrl: string; name: string }> }
		xxHash: string
	} | null
	slug: string
	startAt: string
	trackTournamentResults?: {
		nodes: TournamentResult[]
		totalCount: number
	}
	type: number
}

function tournamentName(type: 0 | 1) {
	return type === 0 ? 'Track of the Week' : 'Track of the Month'
}

function tournamentRoute(type: 0 | 1) {
	return type === 0 ? 'totw' : 'totm'
}

function tournamentActions(type: 0 | 1, slug: string, context: CommandContext) {
	const route = tournamentRoute(type)
	return [
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setLabel(`Open ${type === 0 ? 'TOTW' : 'TOTM'}`)
				.setStyle(ButtonStyle.Link)
				.setURL(`${context.config.frontendUrl}/${route}/${slug}`),
			new ButtonBuilder()
				.setLabel('Download level playlist')
				.setStyle(ButtonStyle.Link)
				.setURL(
					`${context.config.frontendUrl}/api/tournaments/playlist?type=${type}&slug=${slug}`,
				),
		),
	]
}

function tournamentPresentation(
	type: 0 | 1,
	value: Tournament,
	context: CommandContext,
): PagePresentation {
	const item = value.level?.levelItems.nodes[0]
	return {
		actions: tournamentActions(type, value.slug, context),
		description: 'Current competition standings',
		emptyDescription: 'No submitted times yet.',
		sections: [
			{
				content: [
					`**Level**  ${item?.name ?? 'Unknown'}`,
					`**Entries**  ${value.trackTournamentResults?.totalCount ?? 0}`,
					`**Ends**  <t:${Math.floor(new Date(value.endAt).getTime() / 1000)}:R>`,
				].join('\n'),
				heading: 'Tournament details',
			},
		],
		thumbnail: item?.imageUrl
			? { description: `${item.name} thumbnail`, url: item.imageUrl }
			: undefined,
		title: `${tournamentName(type)} • ${value.slug}`,
	}
}

function tournamentLeaderboard(type: 0 | 1, slug: string, context: CommandContext) {
	return async (window: CursorWindow) => {
		const data = await context.graphql.query<Record<string, unknown>>(
			Zc_TrackTournamentDetailDocument,
			{
				...window,
				type,
				slug,
				viewerId: 0,
				includeViewer: false,
			},
		)
		const leaderboard = (
			data as {
				tournament?: {
					leaderboard?: {
						edges: Array<{ node: TournamentResult }>
						pageInfo: {
							endCursor?: string | null
							hasNextPage: boolean
							hasPreviousPage: boolean
							startCursor?: string | null
						}
						totalCount: number
					}
				} | null
			}
		).tournament?.leaderboard
		if (!leaderboard) {
			return {
				pageInfo: { hasNextPage: false, hasPreviousPage: false },
				rows: [],
				totalCount: 0,
			}
		}
		const results = leaderboard.edges.map((edge) => edge.node)
		const users = await context.graphql.usersByIds(results.map((result) => result.userId))
		return {
			pageInfo: leaderboard.pageInfo,
			rows: results.map(
				(result) =>
					`**${result.rank}.** ${playerLabel(users.get(result.userId) ?? result.user)} • ${formatTime(result.time)} • ${result.points} pts`,
			),
			totalCount: leaderboard.totalCount,
		}
	}
}

export async function buildTournamentMessage(type: 0 | 1, context: CommandContext) {
	const data = await context.graphql.query<Record<string, unknown>>(
		Zc_TrackTournamentIndexDocument,
		{
			type,
			now: context.runtime.now().toISOString(),
			first: 1,
		},
	)
	const typed = data as {
		active?: { nodes: Array<Record<string, unknown>> }
		history?: { edges: Array<{ node: Record<string, unknown> }> }
	}
	const tournament = typed.active?.nodes[0] ?? typed.history?.edges[0]?.node
	if (!tournament) throw new Error('No tournament found.')
	const value = tournament as Tournament
	const results = value.trackTournamentResults?.nodes ?? []
	const users = await context.graphql.usersByIds(results.map((result) => result.userId))
	const standings = results
		.slice(0, 3)
		.map(
			(result) =>
				`**${result.rank}.** ${playerLabel(users.get(result.userId) ?? result.user)} • ${formatTime(result.time)} • ${result.points} pts`,
		)
		.join('\n')
	const presentation = tournamentPresentation(type, value, context)
	const container = displayContainer({
		...presentation,
		sections: [
			...(presentation.sections ?? []),
			{
				content: standings || 'No submitted times yet.',
				heading: 'Leaderboard',
			},
		],
	})
	const message = messagePayload(container)
	const contentHash = Array.from(
		new Uint8Array(
			await crypto.subtle.digest(
				'SHA-256',
				new TextEncoder().encode(JSON.stringify(message)),
			),
		),
	)
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('')
	return {
		container,
		contentHash,
		message,
		presentation,
		tournamentId: value.id,
		tournamentSlug: value.slug,
		tournamentType: tournamentRoute(type),
	}
}

export async function tournamentHandler(
	interaction: ChatInputCommandInteraction,
	context: CommandContext,
	type: 0 | 1,
) {
	await interaction.deferReply()
	const snapshot = await buildTournamentMessage(type, context)
	return interaction.editReply(
		await createCursorPages(
			context,
			interaction.user.id,
			snapshot.presentation,
			tournamentLeaderboard(type, snapshot.tournamentSlug, context),
		),
	)
}
