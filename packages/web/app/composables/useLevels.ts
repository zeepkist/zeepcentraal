import { useQuery } from '@urql/vue'
import {
	type LevelFilter,
	type LevelsOrderBy,
	Zc_LevelsDocument,
} from '~/graphql/generated/graphql'

export const LEVEL_SORTS = {
	latest: 'DATE_CREATED_DESC',
	popular: 'LEVEL_POINTS_MODIFIER_POPULARITY_DESC',
	points: 'LEVEL_POINTS_POINTS_DESC',
	rating: 'LEVEL_POINTS_RATING_DESC',
	records: 'RECORDS_COUNT_DESC',
	votes: 'VOTES_COUNT_DESC',
	favourites: 'FAVOURITES_COUNT_DESC',
} as const satisfies Record<string, LevelsOrderBy>

import type { CursorPage, LevelSummary } from '~/types/app'

export function useLevels() {
	const route = useRoute()
	const pagination = useCursorPagination(24)
	const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
	const author = ref(typeof route.query.author === 'string' ? route.query.author : '')
	const adventure = ref(typeof route.query.adventure === 'string' ? route.query.adventure : 'all')
	const sort = ref(
		(Object.values(LEVEL_SORTS) as readonly string[]).includes(String(route.query.sort))
			? (route.query.sort as LevelsOrderBy)
			: LEVEL_SORTS.latest,
	)
	const filter = computed<LevelFilter>(() => {
		const and: LevelFilter[] = [{ levelItems: { some: { deleted: { equalTo: false } } } }]
		if (search.value) {
			and.push({
				or: [
					{ xxHash: { includesInsensitive: search.value } },
					{ hash: { includesInsensitive: search.value } },
					{ levelItems: { some: { name: { includesInsensitive: search.value } } } },
				],
			})
		}
		if (author.value) {
			and.push({
				levelItems: {
					some: { author: { steamName: { includesInsensitive: author.value } } },
				},
			})
		}
		if (adventure.value !== 'all') {
			and.push({ adventure: { equalTo: adventure.value === 'yes' } })
		}
		return { and }
	})
	const result = useQuery({
		query: Zc_LevelsDocument,
		variables: computed(() => ({
			...pagination.variables.value,
			filter: filter.value,
			orderBy: [sort.value],
		})),
	})
	const levels = computed(() =>
		(result.data.value?.levels?.edges ?? []).map(({ node }) => {
			const item = node.levelItems.nodes[0]
			return {
				id: node.id,
				xxHash: node.xxHash,
				name: item?.name ?? node.xxHash,
				imageUrl: item?.imageUrl,
				authorName: item?.author?.steamName,
				authorSteamId: item?.author?.steamId == null ? null : String(item.author.steamId),
				adventure: node.adventure,
				dateCreated: String(node.dateCreated),
				points: node.levelPoints?.points,
				rating: node.levelPoints?.rating,
				popularity: node.levelPoints?.modifierPopularity,
				recordCount: node.records.totalCount,
				medals: item
					? {
							author: item.validationTimeAuthor,
							gold: item.validationTimeGold,
							silver: item.validationTimeSilver,
							bronze: item.validationTimeBronze,
						}
					: null,
			} satisfies LevelSummary
		}),
	)
	const page = computed<CursorPage>(() =>
		result.data.value?.levels?.pageInfo
			? {
					startCursor:
						String(result.data.value.levels.pageInfo.startCursor ?? '') || null,
					endCursor: String(result.data.value.levels.pageInfo.endCursor ?? '') || null,
					hasNextPage: result.data.value.levels.pageInfo.hasNextPage,
					hasPreviousPage: result.data.value.levels.pageInfo.hasPreviousPage,
				}
			: { hasNextPage: false, hasPreviousPage: false },
	)

	async function applyFilters() {
		await pagination.reset({
			q: search.value || undefined,
			author: author.value || undefined,
			adventure: adventure.value === 'all' ? undefined : adventure.value,
			sort: sort.value,
		})
	}

	return { adventure, applyFilters, author, levels, page, pagination, result, search, sort }
}
