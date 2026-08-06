import { useQuery } from '@urql/vue'
import {
	type UserPointFilter,
	type UserPointsOrderBy,
	Zc_UsersDocument,
} from '@zeepkist/graphql/generated'
import type { CursorPage, UserSummary } from '~/types/app'

export const USER_SORTS = {
	rank: 'RANK_ASC',
	points: 'POINTS_DESC',
	totalPoints: 'TOTAL_POINTS_DESC',
	worldRecords: 'WORLD_RECORDS_DESC',
} as const satisfies Record<string, UserPointsOrderBy>

export function usePlayers() {
	const route = useRoute()
	const pagination = useCursorPagination(50)
	const appliedSearch = computed(() => (typeof route.query.q === 'string' ? route.query.q : ''))
	const appliedSort = computed<UserPointsOrderBy>(() =>
		(Object.values(USER_SORTS) as readonly string[]).includes(String(route.query.sort))
			? (route.query.sort as UserPointsOrderBy)
			: USER_SORTS.rank,
	)
	const search = ref(appliedSearch.value)
	const sort = ref(appliedSort.value)

	watch([appliedSearch, appliedSort], (values) => {
		search.value = values[0]
		sort.value = values[1]
	})

	const filter = computed<UserPointFilter>(() => ({
		...(appliedSort.value === USER_SORTS.rank ? { rank: { notEqualTo: -1 } } : {}),
		user: {
			banned: { equalTo: false },
			...(appliedSearch.value
				? {
						or: [
							{ steamName: { includesInsensitive: appliedSearch.value } },
							...(/^\d+$/.test(appliedSearch.value)
								? [{ steamId: { equalTo: appliedSearch.value } }]
								: []),
						],
					}
				: {}),
		},
	}))
	const result = useQuery({
		query: Zc_UsersDocument,
		variables: computed(() => ({
			...pagination.variables.value,
			filter: filter.value,
			orderBy: [appliedSort.value],
		})),
	})
	const users = computed<UserSummary[]>(() =>
		(result.data.value?.userPoints?.edges ?? []).flatMap(({ node }) =>
			node.user
				? [
						{
							id: node.user.id,
							steamId: String(node.user.steamId),
							steamName: node.user.steamName ?? String(node.user.steamId),
							rank: node.rank,
							points: node.points,
							totalPoints: node.totalPoints,
							worldRecords: node.worldRecords,
						},
					]
				: [],
		),
	)
	const page = computed<CursorPage>(() => {
		const info = result.data.value?.userPoints?.pageInfo
		return info
			? {
					startCursor: String(info.startCursor ?? '') || null,
					endCursor: String(info.endCursor ?? '') || null,
					hasNextPage: info.hasNextPage,
					hasPreviousPage: info.hasPreviousPage,
				}
			: { hasNextPage: false, hasPreviousPage: false }
	})

	async function applyFilters() {
		await pagination.reset({ q: search.value || undefined, sort: sort.value })
	}

	return { applyFilters, page, pagination, result, search, sort, users }
}
