import { useQuery } from '@urql/vue'
import type { ComputedRef, Ref } from 'vue'
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

function stageStandings(
	rows: ComputedRef<ZslStanding[]>,
	fetching: Ref<boolean>,
	hasData: ComputedRef<boolean>,
) {
	const snapshot = shallowRef<ZslStanding[]>([])
	const resolved = ref(false)
	watchEffect(() => {
		if (fetching.value || !hasData.value) return
		snapshot.value = rows.value
		resolved.value = true
	})
	return computed(() => (resolved.value ? snapshot.value : rows.value))
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
		variables: computed(() => ({ id: id.value })),
	})
	const standingsResult = useQuery({
		query: Zc_ZslSeasonResultsDocument,
		variables: computed(() => ({ id: id.value, ...pagination.variables.value })),
	})
	const season = computed(() => result.data.value?.zslSeason)
	const incomingStandings = computed(
		() =>
			standingsResult.data.value?.zslSeasonResults?.edges.map(({ node }) => standing(node)) ??
			[],
	)
	const standings = stageStandings(
		incomingStandings,
		standingsResult.fetching,
		computed(() => standingsResult.data.value?.zslSeasonResults !== undefined),
	)
	const page = computed(() => pageInfo(standingsResult.data.value?.zslSeasonResults?.pageInfo))
	async function prefetch() {
		if (import.meta.server) await Promise.all([result, standingsResult])
	}
	return { page, pagination, prefetch, result, season, standings, standingsResult }
}

export function useZslRound(seasonId: Ref<number>, roundNumber: Ref<number>) {
	const pagination = useCursorPagination(50, 'round')
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
			seasonId: seasonId.value,
			round: roundNumber.value,
			...pagination.variables.value,
		})),
	})
	const incomingStandings = computed(
		() =>
			standingsResult.data.value?.zslRoundResults?.edges.map(({ node }) => standing(node)) ??
			[],
	)
	const standings = stageStandings(
		incomingStandings,
		standingsResult.fetching,
		computed(() => standingsResult.data.value?.zslRoundResults !== undefined),
	)
	const page = computed(() => pageInfo(standingsResult.data.value?.zslRoundResults?.pageInfo))
	async function prefetch() {
		if (import.meta.server) await Promise.all([result, standingsResult])
	}
	return { page, pagination, prefetch, result, round, standings, standingsResult }
}

export function useZslLevel(id: Ref<number>) {
	const pagination = useCursorPagination(50, 'level')
	const result = useQuery({
		query: Zc_ZslLevelDocument,
		variables: computed(() => ({ id: id.value })),
	})
	const standingsResult = useQuery({
		query: Zc_ZslLevelResultsDocument,
		variables: computed(() => ({ id: id.value, ...pagination.variables.value })),
	})
	const level = computed(() => result.data.value?.zslLevel)
	const incomingStandings = computed(
		() =>
			standingsResult.data.value?.zslLevelResults?.edges.map(({ node }) => standing(node)) ??
			[],
	)
	const standings = stageStandings(
		incomingStandings,
		standingsResult.fetching,
		computed(() => standingsResult.data.value?.zslLevelResults !== undefined),
	)
	const page = computed(() => pageInfo(standingsResult.data.value?.zslLevelResults?.pageInfo))
	async function prefetch() {
		if (import.meta.server) await Promise.all([result, standingsResult])
	}
	return { level, page, pagination, prefetch, result, standings, standingsResult }
}
