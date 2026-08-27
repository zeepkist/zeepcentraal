import { Zc_DiscordHotLevelsDocument, Zc_DiscordLevelsDocument } from '@zeepkist/graphql/generated'
import { type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js'
import type { CommandContext } from './context'
import { linkedUserOrThrow } from './utils/linked-user'
import { type PlaylistLevel, playlistResponse } from './utils/playlist'

export const playlistDefinition = new SlashCommandBuilder()
	.setName('playlist')
	.setDescription('Generate playlist from top public levels')
	.addIntegerOption((option) =>
		option
			.setName('count')
			.setDescription('Level count')
			.setMinValue(1)
			.setMaxValue(100)
			.setRequired(true),
	)
	.addStringOption((option) =>
		option
			.setName('sort')
			.setDescription('Ranking source')
			.setRequired(true)
			.addChoices(
				{ name: 'Ranked points', value: 'points' },
				{ name: 'Popularity', value: 'popularity' },
				{ name: 'Record count', value: 'records' },
				{ name: 'Newest workshop item', value: 'created' },
				{ name: 'Recently updated', value: 'updated' },
			),
	)
	.addBooleanOption((option) => option.setName('without-wr').setDescription('Exclude your WRs'))
	.addBooleanOption((option) => option.setName('without-pb').setDescription('Exclude your PBs'))
	.addBooleanOption((option) =>
		option.setName('no-records').setDescription('Only levels without records'),
	)
	.addStringOption((option) =>
		option.setName('name').setDescription('Playlist name').setMaxLength(50),
	)

export async function playlistHandler(
	interaction: ChatInputCommandInteraction,
	context: CommandContext,
) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral })
	const count = interaction.options.getInteger('count', true)
	const sort = interaction.options.getString('sort', true)
	const withoutWr = interaction.options.getBoolean('without-wr') ?? false
	const withoutPb = interaction.options.getBoolean('without-pb') ?? false
	const noRecords = interaction.options.getBoolean('no-records') ?? false
	const linked =
		withoutWr || withoutPb
			? linkedUserOrThrow(await context.backend.user(interaction.user.id))
			: null
	const filter: Record<string, unknown> = {
		publiclyVisible: { equalTo: true },
		levelItems: { some: { deleted: { equalTo: false } } },
		...(withoutWr && linked
			? {
					or: [
						{ worldRecordGlobalExists: false },
						{ worldRecordGlobal: { userId: { distinctFrom: linked.id } } },
					],
				}
			: {}),
		...(withoutPb && linked
			? { personalBestGlobals: { none: { userId: { equalTo: linked.id } } } }
			: {}),
		...(noRecords ? { recordsExist: false } : {}),
	}
	let levels: PlaylistLevel[]
	if (sort === 'created' || sort === 'updated') {
		const data = await context.graphql.recentWorkshopLevels(
			filter,
			sort === 'created' ? 'CREATED_AT_DESC' : 'UPDATED_AT_DESC',
			count,
		)
		levels = data.levelItems.nodes.flatMap((item) => {
			if (!item.level) return []
			return [
				{
					...(item.level as unknown as PlaylistLevel),
					levelItems: { nodes: [item] },
				},
			]
		})
	} else if (sort === 'popularity') {
		const data = await context.graphql.query<Record<string, unknown>>(
			Zc_DiscordHotLevelsDocument,
			{
				first: Math.min(100, Math.max(count, 20)),
				filter,
				since: new Date(context.runtime.now().getTime() - 30 * 86_400_000).toISOString(),
			},
		)
		levels = (
			(data as { levels?: { edges: Array<{ node: PlaylistLevel }> } }).levels?.edges ?? []
		).map((edge) => edge.node)
	} else {
		const orderBy = sort === 'records' ? 'RECORDS_COUNT_DESC' : 'LEVEL_POINTS_POINTS_DESC'
		const data = await context.graphql.query<Record<string, unknown>>(
			Zc_DiscordLevelsDocument,
			{
				first: count,
				filter,
				orderBy: [orderBy, 'ID_ASC'],
			},
		)
		levels = (
			(data as { levels?: { edges: Array<{ node: PlaylistLevel }> } }).levels?.edges ?? []
		).map((edge) => edge.node)
	}
	levels = levels.slice(0, count)
	const filters = [
		sort,
		...(withoutWr ? ['without-wr'] : []),
		...(withoutPb ? ['without-pb'] : []),
		...(noRecords ? ['no-records'] : []),
	]
	await interaction.editReply(
		playlistResponse(
			context,
			interaction.user.id,
			interaction.options.getString('name') ?? 'ZeepCentraal Top Levels',
			levels,
			filters,
		),
	)
}
