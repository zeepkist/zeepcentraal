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

const LEVEL_POINT_SORTS = new Set<LevelsOrderBy>([
	LEVEL_SORTS.popular,
	LEVEL_SORTS.points,
	LEVEL_SORTS.rating,
])

import type { CursorPage, LevelSummary } from '~/types/app'
import { buildLevelAvailabilityFilter } from '~/utils/levelExplorer'

export function useLevels() {
	const route = useRoute()
	const pagination = useCursorPagination(24)
	const appliedSearch = computed(() => (typeof route.query.q === 'string' ? route.query.q : ''))
	const appliedAuthor = computed(() =>
		typeof route.query.author === 'string' ? route.query.author : '',
	)
	const appliedAdventure = computed(() =>
		typeof route.query.adventure === 'string' ? route.query.adventure : 'all',
	)
	const appliedSort = computed<LevelsOrderBy>(() =>
		(Object.values(LEVEL_SORTS) as readonly string[]).includes(String(route.query.sort))
			? (route.query.sort as LevelsOrderBy)
			: LEVEL_SORTS.latest,
	)
	const search = ref(appliedSearch.value)
	const author = ref(appliedAuthor.value)
	const adventure = ref(appliedAdventure.value)
	const sort = ref(appliedSort.value)

	watch([appliedSearch, appliedAuthor, appliedAdventure, appliedSort], (values) => {
		search.value = values[0]
		author.value = values[1]
		adventure.value = values[2]
		sort.value = values[3]
	})

	const filter = computed<LevelFilter>(() => {
		const and: LevelFilter[] = [buildLevelAvailabilityFilter(appliedAdventure.value)]
		if (LEVEL_POINT_SORTS.has(appliedSort.value)) {
			and.push({ levelPointExists: true })
		}
		if (appliedSearch.value) {
			and.push({
				or: [
					{ xxHash: { includesInsensitive: appliedSearch.value } },
					{ hash: { includesInsensitive: appliedSearch.value } },
					{
						levelItems: {
							some: { name: { includesInsensitive: appliedSearch.value } },
						},
					},
				],
			})
		}
		if (appliedAuthor.value) {
			and.push({
				levelItems: {
					some: { author: { steamName: { includesInsensitive: appliedAuthor.value } } },
				},
			})
		}
		return { and }
	})
	const result = useQuery({
		query: Zc_LevelsDocument,
		variables: computed(() => ({
			...pagination.variables.value,
			filter: filter.value,
			orderBy: [appliedSort.value],
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
