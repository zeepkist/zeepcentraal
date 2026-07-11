import { useQuery } from '@urql/vue'
import {
	Zc_ZslLevelDocument,
	Zc_ZslRoundDocument,
	Zc_ZslSeasonDocument,
	Zc_ZslSeasonsDocument,
} from '~/graphql/generated/graphql'
import type { CursorPage, ZslStanding } from '~/types/app'

function pageInfo(
	info?: {
		startCursor?: unknown
		endCursor?: unknown
		hasNextPage: boolean
		hasPreviousPage: boolean
	} | null,
): CursorPage {
	return info
		? {
				startCursor: String(info.startCursor ?? '') || null,
				endCursor: String(info.endCursor ?? '') || null,
				hasNextPage: info.hasNextPage,
				hasPreviousPage: info.hasPreviousPage,
			}
		: { hasNextPage: false, hasPreviousPage: false }
}

export function useZslSeasons() {
	const pagination = useCursorPagination(12)
	const result = useQuery({ query: Zc_ZslSeasonsDocument, variables: pagination.variables })
	const seasons = computed(
		() => result.data.value?.zslSeasons?.edges.map(({ node }) => node) ?? [],
	)
	const page = computed(() => pageInfo(result.data.value?.zslSeasons?.pageInfo))
	return { page, pagination, result, seasons }
}

function standing(node: {
	position: number
	points: number
	user?: { steamId: unknown; steamName?: string | null } | null
	time?: number
}): ZslStanding {
	return {
		position: node.position,
		points: node.points,
		steamId: node.user ? String(node.user.steamId) : null,
		steamName: node.user?.steamName ?? null,
		time: node.time,
	}
}

export function useZslSeason(id: Ref<number>) {
	const pagination = useCursorPagination(50, 'season')
	const result = useQuery({
		query: Zc_ZslSeasonDocument,
		variables: computed(() => ({ id: id.value, ...pagination.variables.value })),
	})
	const season = computed(() => result.data.value?.zslSeason)
	const standings = computed(
		() => result.data.value?.zslSeasonResults?.edges.map(({ node }) => standing(node)) ?? [],
	)
	const page = computed(() => pageInfo(result.data.value?.zslSeasonResults?.pageInfo))
	return { page, pagination, result, season, standings }
}

export function useZslRound(id: Ref<number>) {
	const pagination = useCursorPagination(50, 'round')
	const result = useQuery({
		query: Zc_ZslRoundDocument,
		variables: computed(() => ({ id: id.value, ...pagination.variables.value })),
	})
	const round = computed(() => result.data.value?.zslRound)
	const standings = computed(
		() => result.data.value?.zslRoundResults?.edges.map(({ node }) => standing(node)) ?? [],
	)
	const page = computed(() => pageInfo(result.data.value?.zslRoundResults?.pageInfo))
	return { page, pagination, result, round, standings }
}

export function useZslLevel(id: Ref<number>) {
	const pagination = useCursorPagination(50, 'level')
	const result = useQuery({
		query: Zc_ZslLevelDocument,
		variables: computed(() => ({ id: id.value, ...pagination.variables.value })),
	})
	const level = computed(() => result.data.value?.zslLevel)
	const standings = computed(
		() => result.data.value?.zslLevelResults?.edges.map(({ node }) => standing(node)) ?? [],
	)
	const page = computed(() => pageInfo(result.data.value?.zslLevelResults?.pageInfo))
	return { level, page, pagination, result, standings }
}
