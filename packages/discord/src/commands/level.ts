import { Zc_LevelRecordsDocument, Zc_OmniSearchDocument } from '@zeepkist/graphql/generated'
import {
	ActionRowBuilder,
	type AutocompleteInteraction,
	ButtonBuilder,
	ButtonStyle,
	type ChatInputCommandInteraction,
	SlashCommandBuilder,
} from 'discord.js'
import { compactNumber, formatTime, playerLabel, truncate } from '../format'
import type { LinkedUser } from '../types'
import type { CommandContext } from './context'
import { findLevel } from './utils/level-lookup'
import { type CursorWindow, createCursorPages } from './utils/pagination'
import { enrichUser } from './utils/user-enrichment'

type LevelLeaderboardRecord = {
	time: number
	user?: LinkedUser | null
	userId: number
}

function levelLeaderboard(levelId: number, context: CommandContext) {
	return async (window: CursorWindow, page: number) => {
		const data = await context.graphql.query<Record<string, unknown>>(Zc_LevelRecordsDocument, {
			...window,
			filter: {
				levelId: { equalTo: levelId },
				personalBestGlobalsExist: true,
			},
			orderBy: ['TIME_ASC', 'ID_ASC'],
			includeStatus: false,
		})
		const connection = (
			data as {
				records?: {
					edges: Array<{ node: LevelLeaderboardRecord }>
					pageInfo: {
						endCursor?: string | null
						hasNextPage: boolean
						hasPreviousPage: boolean
						startCursor?: string | null
					}
					totalCount: number
				} | null
			}
		).records
		if (!connection) {
			return {
				pageInfo: { hasNextPage: false, hasPreviousPage: false },
				rows: [],
				totalCount: 0,
			}
		}
		const records = connection.edges.map((edge) => edge.node)
		const users = await context.graphql.usersByIds(records.map((record) => record.userId))
		return {
			pageInfo: connection.pageInfo,
			rows: records.map(
				(record, index) =>
					`**${page * 10 + index + 1}.** ${playerLabel(users.get(record.userId) ?? record.user)} • ${formatTime(record.time)}`,
			),
			totalCount: connection.totalCount,
		}
	}
}

export const levelDefinition = new SlashCommandBuilder()
	.setName('level')
	.setDescription('Find level by hash, ID, name, or author')
	.addStringOption((option) =>
		option
			.setName('query')
			.setDescription('Level hash, ID, name, or author')
			.setAutocomplete(true)
			.setRequired(true),
	)

export async function levelHandler(
	interaction: ChatInputCommandInteraction,
	context: CommandContext,
) {
	await interaction.deferReply()
	const level = await findLevel(interaction.options.getString('query', true), context)
	if (!level) throw new Error('Public level not found.')
	const typed = level as {
		id: number
		levelItems?: {
			nodes: Array<{
				author?: LinkedUser | null
				imageUrl: string
				name: string
				workshopId?: string
			}>
		}
		levelPoints?: { points: number; rating: number } | null
		personalBestGlobals?: { totalCount: number }
		publiclyVisible: boolean
		records?: { totalCount: number }
		votes?: { totalCount: number }
		worldRecordGlobal?: { record?: { time: number } | null; user?: LinkedUser | null } | null
		xxHash: string
	}
	if (!typed.publiclyVisible) throw new Error('Level is not publicly visible.')
	const item = typed.levelItems?.nodes[0]
	const userIds = [item?.author?.id, typed.worldRecordGlobal?.user?.id].filter(
		(value): value is number => typeof value === 'number',
	)
	const users = await context.graphql.usersByIds(userIds)
	const author = enrichUser(
		item?.author as unknown as Record<string, unknown>,
		users,
	) as LinkedUser | null
	const worldRecord = enrichUser(
		typed.worldRecordGlobal?.user as unknown as Record<string, unknown>,
		users,
	) as LinkedUser | null
	await interaction.editReply(
		await createCursorPages(
			context,
			interaction.user.id,
			{
				actions: [
					new ActionRowBuilder<ButtonBuilder>().addComponents(
						new ButtonBuilder()
							.setLabel('Open level')
							.setStyle(ButtonStyle.Link)
							.setURL(`${context.config.frontendUrl}/level/${typed.xxHash}`),
					),
				],
				description: `By ${playerLabel(author)}`,
				emptyDescription: 'No personal bests yet.',
				sections: [
					{
						content: [
							`**Hash / ID**  \`${typed.xxHash}\` / \`${typed.id}\``,
							`**Points**  ${compactNumber(typed.levelPoints?.points)}  •  **Rating**  ${(typed.levelPoints?.rating ?? 0).toFixed(2)}`,
							`**Records / PBs**  ${typed.records?.totalCount ?? 0} / ${typed.personalBestGlobals?.totalCount ?? 0}  •  **Votes**  ${typed.votes?.totalCount ?? 0}`,
							`**World record**  ${formatTime(typed.worldRecordGlobal?.record?.time)} • ${playerLabel(worldRecord)}`,
						].join('\n'),
						heading: 'Level details',
					},
				],
				thumbnail: item?.imageUrl
					? { description: `${item.name} thumbnail`, url: item.imageUrl }
					: undefined,
				title: item?.name ?? typed.xxHash,
			},
			levelLeaderboard(typed.id, context),
		),
	)
}

export async function levelAutocompleteHandler(
	interaction: AutocompleteInteraction,
	context: CommandContext,
) {
	const focusedOption = interaction.options.getFocused() as
		| number
		| string
		| { value: number | string }
	const focused = String(
		typeof focusedOption === 'object' ? focusedOption.value : focusedOption,
	).trim()
	if (focused.length < 2) return interaction.respond([])
	const data = await context.graphql.query<Record<string, unknown>>(Zc_OmniSearchDocument, {
		search: focused,
	})
	const levels =
		(
			data as {
				levels?: {
					nodes: Array<{
						levelItems: {
							nodes: Array<{
								author?: { steamName?: string | null } | null
								name: string
							}>
						}
						xxHash: string
					}>
				}
			}
		).levels?.nodes ?? []
	return interaction.respond(
		levels.slice(0, 25).map((level) => ({
			name: truncate(level.levelItems.nodes[0]?.name ?? level.xxHash, 100),
			value: level.xxHash,
		})),
	)
}
