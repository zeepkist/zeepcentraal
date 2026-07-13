import { useQuery } from '@urql/vue'
import {
	Zc_ZslLevelDocument,
	Zc_ZslLevelResultsDocument,
	Zc_ZslRoundBySeasonAndNumberDocument,
	Zc_ZslRoundResultsDocument,
	Zc_ZslSeasonDocument,
	Zc_ZslSeasonResultsDocument,
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
	const standingsPrefetch = useViewportPrefetch()
	const result = useQuery({
		query: Zc_ZslSeasonDocument,
		variables: computed(() => ({ id: id.value })),
	})
	const standingsResult = useQuery({
		query: Zc_ZslSeasonResultsDocument,
		variables: computed(() => ({ id: id.value, ...pagination.variables.value })),
		pause: computed(() => !standingsPrefetch.active.value),
	})
	const season = computed(() => result.data.value?.zslSeason)
	const standings = computed(
		() =>
			standingsResult.data.value?.zslSeasonResults?.edges.map(({ node }) => standing(node)) ??
			[],
	)
	const page = computed(() => pageInfo(standingsResult.data.value?.zslSeasonResults?.pageInfo))
	return {
		page,
		pagination,
		result,
		season,
		standings,
		standingsActive: standingsPrefetch.active,
		standingsResult,
		standingsTarget: standingsPrefetch.target,
	}
}

export function useZslRound(seasonId: Ref<number>, roundNumber: Ref<number>) {
	const pagination = useCursorPagination(50, 'round')
	const standingsPrefetch = useViewportPrefetch()
	const result = useQuery({
		query: Zc_ZslRoundBySeasonAndNumberDocument,
		variables: computed(() => ({
			seasonId: seasonId.value,
			round: roundNumber.value,
		})),
	})
	const round = computed(() => result.data.value?.zslRounds?.nodes[0])
	const standingsResult = useQuery({
		query: Zc_ZslRoundResultsDocument,
		variables: computed(() => ({
			id: round.value?.id ?? 0,
			...pagination.variables.value,
		})),
		pause: computed(() => round.value === undefined || !standingsPrefetch.active.value),
	})
	const standings = computed(
		() =>
			standingsResult.data.value?.zslRoundResults?.edges.map(({ node }) => standing(node)) ??
			[],
	)
	const page = computed(() => pageInfo(standingsResult.data.value?.zslRoundResults?.pageInfo))
	return {
		page,
		pagination,
		result,
		round,
		standings,
		standingsActive: standingsPrefetch.active,
		standingsResult,
		standingsTarget: standingsPrefetch.target,
	}
}

export function useZslLevel(id: Ref<number>) {
	const pagination = useCursorPagination(50, 'level')
	const standingsPrefetch = useViewportPrefetch()
	const result = useQuery({
		query: Zc_ZslLevelDocument,
		variables: computed(() => ({ id: id.value })),
	})
	const standingsResult = useQuery({
		query: Zc_ZslLevelResultsDocument,
		variables: computed(() => ({ id: id.value, ...pagination.variables.value })),
		pause: computed(() => !standingsPrefetch.active.value),
	})
	const level = computed(() => result.data.value?.zslLevel)
	const standings = computed(
		() =>
			standingsResult.data.value?.zslLevelResults?.edges.map(({ node }) => standing(node)) ??
			[],
	)
	const page = computed(() => pageInfo(standingsResult.data.value?.zslLevelResults?.pageInfo))
	return {
		level,
		page,
		pagination,
		result,
		standings,
		standingsActive: standingsPrefetch.active,
		standingsResult,
		standingsTarget: standingsPrefetch.target,
	}
}
