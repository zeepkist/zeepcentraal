import { Zc_OmniSearchDocument } from '@zeepkist/graphql/generated'
import {
	type AutocompleteInteraction,
	type ChatInputCommandInteraction,
	SlashCommandBuilder,
} from 'discord.js'
import {
	baseEmbed,
	compactNumber,
	formatTime,
	playerLabel,
	safeMentions,
	truncate,
} from '../format'
import type { LinkedUser } from '../types'
import type { CommandContext } from './context'
import { findLevel } from './utils/level-lookup'
import { enrichUser } from './utils/user-enrichment'

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
	await interaction.editReply({
		embeds: [
			{
				...baseEmbed(item?.name ?? typed.xxHash, `By ${playerLabel(author)}`),
				url: `${context.config.frontendUrl}/level/${typed.xxHash}`,
				thumbnail: item?.imageUrl ? { url: item.imageUrl } : undefined,
				fields: [
					{
						name: 'Hash / ID',
						value: `\`${typed.xxHash}\` / \`${typed.id}\``,
						inline: false,
					},
					{
						name: 'Ranked points',
						value: compactNumber(typed.levelPoints?.points),
						inline: true,
					},
					{
						name: 'Rating',
						value: (typed.levelPoints?.rating ?? 0).toFixed(2),
						inline: true,
					},
					{
						name: 'Records / PBs',
						value: `${typed.records?.totalCount ?? 0} / ${typed.personalBestGlobals?.totalCount ?? 0}`,
						inline: true,
					},
					{ name: 'Votes', value: String(typed.votes?.totalCount ?? 0), inline: true },
					{
						name: 'World record',
						value: `${formatTime(typed.worldRecordGlobal?.record?.time)} • ${playerLabel(worldRecord)}`,
						inline: false,
					},
				],
			},
		],
		allowedMentions: safeMentions,
	})
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
