import { useQuery } from '@urql/vue'
import {
	type UserPointFilter,
	type UserPointsOrderBy,
	Zc_UsersDocument,
} from '~/graphql/generated/graphql'
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
	const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
	const sort = ref(
		(Object.values(USER_SORTS) as readonly string[]).includes(String(route.query.sort))
			? (route.query.sort as UserPointsOrderBy)
			: USER_SORTS.rank,
	)
	const filter = computed<UserPointFilter>(() => ({
		user: {
			banned: { equalTo: false },
			...(search.value
				? {
						or: [
							{ steamName: { includesInsensitive: search.value } },
							...(/^\d+$/.test(search.value)
								? [{ steamId: { equalTo: search.value } }]
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
			orderBy: [sort.value],
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
