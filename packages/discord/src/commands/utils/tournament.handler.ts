import {
	Zc_TrackTournamentDetailDocument,
	Zc_TrackTournamentIndexDocument,
} from '@zeepkist/graphql/generated'
import {
	ActionRowBuilder,
	type APIEmbed,
	ButtonBuilder,
	ButtonStyle,
	type ChatInputCommandInteraction,
} from 'discord.js'
import { baseEmbed, formatTime, playerLabel, safeMentions } from '../../format'
import type { LinkedUser } from '../../types'
import type { CommandContext } from '../context'
import { createPages } from './pagination.handler'

type TournamentResult = {
	points: number
	rank: number
	time: number
	user?: LinkedUser | null
	userId: number
}

async function tournamentLeaderboard(type: 0 | 1, slug: string, context: CommandContext) {
	const results: TournamentResult[] = []
	let after: unknown
	while (true) {
		const data = await context.graphql.query<Record<string, unknown>>(
			Zc_TrackTournamentDetailDocument,
			{
				type,
				slug,
				viewerId: 0,
				includeViewer: false,
				first: 100,
				after,
			},
		)
		const leaderboard = (
			data as {
				tournament?: {
					leaderboard?: {
						edges: Array<{ node: TournamentResult }>
						pageInfo: { endCursor?: unknown; hasNextPage: boolean }
					}
				} | null
			}
		).tournament?.leaderboard
		if (!leaderboard) break
		results.push(...leaderboard.edges.map((edge) => edge.node))
		const next = leaderboard.pageInfo.endCursor
		if (!leaderboard.pageInfo.hasNextPage || next == null || next === after) break
		after = next
	}
	return results
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
	const value = tournament as {
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
	const results = value.trackTournamentResults?.nodes ?? []
	const users = await context.graphql.usersByIds(results.map((result) => result.userId))
	const standings = results
		.map(
			(result) =>
				`${result.rank}. ${playerLabel(users.get(result.userId) ?? result.user)} • ${formatTime(result.time)} • ${result.points} pts`,
		)
		.join('\n')
	const name = type === 0 ? 'Track of the Week' : 'Track of the Month'
	const message = {
		embeds: [
			{
				...baseEmbed(`${name} • ${value.slug}`, standings || 'No submitted times yet.'),
				timestamp: context.runtime.now().toISOString(),
				url: `${context.config.frontendUrl}/${type === 0 ? 'totw' : 'totm'}/${value.slug}`,
				thumbnail: value.level?.levelItems.nodes[0]?.imageUrl
					? { url: value.level.levelItems.nodes[0].imageUrl }
					: undefined,
				fields: [
					{
						name: 'Level',
						value: value.level?.levelItems.nodes[0]?.name ?? 'Unknown',
						inline: true,
					},
					{
						name: 'Entries',
						value: String(value.trackTournamentResults?.totalCount ?? 0),
						inline: true,
					},
					{
						name: 'Ends',
						value: `<t:${Math.floor(new Date(value.endAt).getTime() / 1000)}:R>`,
						inline: true,
					},
				],
			},
		],
		components: [
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setLabel(`Open ${type === 0 ? 'TOTW' : 'TOTM'}`)
					.setStyle(ButtonStyle.Link)
					.setURL(
						`${context.config.frontendUrl}/${type === 0 ? 'totw' : 'totm'}/${value.slug}`,
					),
				new ButtonBuilder()
					.setLabel('Download level playlist')
					.setStyle(ButtonStyle.Link)
					.setURL(
						`${context.config.frontendUrl}/api/tournaments/playlist?type=${type}&slug=${value.slug}`,
					),
			),
		],
		allowedMentions: safeMentions,
	}
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
		message,
		tournamentId: value.id,
		tournamentSlug: value.slug,
		tournamentType: type === 0 ? 'totw' : 'totm',
		contentHash,
	}
}

export async function handleTournament(
	interaction: ChatInputCommandInteraction,
	context: CommandContext,
	type: 0 | 1,
) {
	await interaction.deferReply()
	const snapshot = await buildTournamentMessage(type, context)
	const results = await tournamentLeaderboard(type, snapshot.tournamentSlug, context)
	const users = await context.graphql.usersByIds(results.map((result) => result.userId))
	const rows = results.map(
		(result) =>
			`**${result.rank}.** ${playerLabel(users.get(result.userId) ?? result.user)} • ${formatTime(result.time)} • ${result.points} pts`,
	)
	const embed = snapshot.message.embeds[0] as APIEmbed
	const title = embed.title as string
	const presentation = {
		embed,
		components: snapshot.message.components.map((row) => row.toJSON()),
		emptyDescription: 'No submitted times yet.',
	}
	const response = createPages(context, interaction.user.id, title, rows, 10, presentation)
	return interaction.editReply(response)
}
