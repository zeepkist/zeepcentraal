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

type StandingNode = {
	position: number
	points: number
	userId: number
	user?: { steamId: unknown; steamName?: string | null } | null
	time?: number
}

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

function standing(node: StandingNode): ZslStanding {
	return {
		userId: node.userId,
		position: node.position,
		points: node.points,
		steamId: node.user ? String(node.user.steamId) : null,
		steamName: node.user?.steamName ?? null,
		time: node.time,
	}
}

export function mergeViewerStanding(
	rows: ZslStanding[],
	viewerNode?: StandingNode | null,
): ZslStanding[] {
	if (!viewerNode || rows.some((row) => row.userId === viewerNode.userId)) return rows
	return [...rows, { ...standing(viewerNode), pinned: true }]
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

function viewerVariables(viewerId: Ref<number | undefined>) {
	return {
		viewerId: viewerId.value ?? 0,
		includeViewer: viewerId.value !== undefined,
	}
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

export function useZslSeason(id: Ref<number>, viewerId: Ref<number | undefined>) {
	const pagination = useCursorPagination(50, 'season')
	const result = useQuery({
		query: Zc_ZslSeasonDocument,
		variables: computed(() => ({ id: id.value })),
	})
	const standingsResult = useQuery({
		query: Zc_ZslSeasonResultsDocument,
		variables: computed(() => ({
			id: id.value,
			...viewerVariables(viewerId),
			...pagination.variables.value,
		})),
	})
	const season = computed(() => result.data.value?.zslSeason)
	const incomingStandings = computed(() =>
		mergeViewerStanding(
			standingsResult.data.value?.zslSeasonResults?.edges.map(({ node }) => standing(node)) ??
				[],
			standingsResult.data.value?.viewerStanding?.nodes[0],
		),
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

export function useZslRound(
	seasonId: Ref<number>,
	roundNumber: Ref<number>,
	viewerId: Ref<number | undefined>,
) {
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
			...viewerVariables(viewerId),
			...pagination.variables.value,
		})),
	})
	const incomingStandings = computed(() =>
		mergeViewerStanding(
			standingsResult.data.value?.zslRoundResults?.edges.map(({ node }) => standing(node)) ??
				[],
			standingsResult.data.value?.viewerStanding?.nodes[0],
		),
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

export function useZslLevel(id: Ref<number>, viewerId: Ref<number | undefined>) {
	const pagination = useCursorPagination(50, 'level')
	const result = useQuery({
		query: Zc_ZslLevelDocument,
		variables: computed(() => ({ id: id.value })),
	})
	const standingsResult = useQuery({
		query: Zc_ZslLevelResultsDocument,
		variables: computed(() => ({
			id: id.value,
			...viewerVariables(viewerId),
			...pagination.variables.value,
		})),
	})
	const level = computed(() => result.data.value?.zslLevel)
	const incomingStandings = computed(() =>
		mergeViewerStanding(
			standingsResult.data.value?.zslLevelResults?.edges.map(({ node }) => standing(node)) ??
				[],
			standingsResult.data.value?.viewerStanding?.nodes[0],
		),
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
