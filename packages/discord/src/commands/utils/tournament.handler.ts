import { Zc_TrackTournamentIndexDocument } from '@zeepkist/graphql/generated'
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	type ChatInputCommandInteraction,
} from 'discord.js'
import { baseEmbed, formatTime, playerLabel, safeMentions } from '../../format'
import type { LinkedUser } from '../../types'
import type { CommandContext } from '../context'

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
			nodes: Array<{
				points: number
				rank: number
				time: number
				user?: LinkedUser | null
				userId: number
			}>
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
	await interaction.editReply((await buildTournamentMessage(type, context)).message)
}
