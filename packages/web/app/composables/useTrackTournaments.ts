import { useQuery, useSubscription } from '@urql/vue'
import type {
	Zc_TrackTournamentGhostStandingFragment,
	Zc_TrackTournamentStandingFragment,
	Zc_TrackTournamentSummaryFragment,
} from '@zeepkist/graphql/generated'
import {
	Zc_TrackTournamentDetailDocument,
	Zc_TrackTournamentIndexDocument,
	Zc_TrackTournamentLiveDocument,
	Zc_TrackTournamentNavigationDocument,
} from '@zeepkist/graphql/generated'
import type { Ref } from 'vue'
import type {
	TournamentNavigation,
	TournamentStanding,
	TournamentSummary,
	TrackTournamentType,
} from '~/types/tournament'
import { mapGhostRecordSource } from '~/utils/ghostRecordSource'
import { isTrackTournamentActive, mapTournamentFeature } from '~/utils/tournament'

function mapStanding(node: Zc_TrackTournamentStandingFragment): TournamentStanding {
	return {
		tournamentId: node.tournamentId,
		userId: node.userId,
		recordId: node.recordId,
		time: node.time,
		rank: node.rank,
		points: node.points,
		steamId: node.user?.steamId == null ? null : String(node.user.steamId),
		steamName: node.user?.steamName ?? null,
		setAt: node.record?.dateCreated == null ? null : String(node.record.dateCreated),
		ghost: null,
	}
}

function mapGhostStanding(node: Zc_TrackTournamentGhostStandingFragment): TournamentStanding {
	return {
		...mapStanding(node),
		ghost: node.record ? mapGhostRecordSource(node.record) : null,
	}
}

function mapTournament(
	node: Zc_TrackTournamentSummaryFragment | null | undefined,
): TournamentSummary | null {
	const feature = mapTournamentFeature(node)
	if (!node?.level || !feature) return null
	return {
		...feature,
		level: {
			...feature.level,
			points: node.level.levelPoints?.points ?? null,
		},
		podium: node.trackTournamentResults.nodes.map(mapStanding),
	}
}

function pageInfo(
	info:
		| {
				startCursor?: unknown
				endCursor?: unknown
				hasNextPage: boolean
				hasPreviousPage: boolean
		  }
		| null
		| undefined,
) {
	return info
		? {
				startCursor: String(info.startCursor ?? '') || null,
				endCursor: String(info.endCursor ?? '') || null,
				hasNextPage: info.hasNextPage,
				hasPreviousPage: info.hasPreviousPage,
			}
		: { hasNextPage: false, hasPreviousPage: false }
}

export function useTrackTournamentIndex(type: TrackTournamentType) {
	const pagination = useCursorPagination(12, 'history')
	const now = useState(`track-tournament-index-now:${type}`, () => new Date().toISOString())
	const result = useQuery({
		query: Zc_TrackTournamentIndexDocument,
		variables: computed(() => ({ type, now: now.value, ...pagination.variables.value })),
	})
	const active = computed(() => mapTournament(result.data.value?.active?.nodes[0]))
	const future = computed(() => mapTournament(result.data.value?.future?.nodes[0]))
	const history = computed(() =>
		(result.data.value?.history?.edges ?? []).flatMap(({ node }) => {
			const tournament = mapTournament(node)
			return tournament ? [tournament] : []
		}),
	)
	const page = computed(() => pageInfo(result.data.value?.history?.pageInfo))
	async function prefetch() {
		if (import.meta.server) await result
	}
	return { active, future, history, page, pagination, prefetch, result }
}

export function useTrackTournamentDetail(
	type: TrackTournamentType,
	slug: Ref<string>,
	viewerId: Ref<number | undefined>,
	includeNavigation = false,
) {
	const pagination = useCursorPagination(50, 'standings')
	const mounted = ref(false)
	const pageVisible = usePageVisibility()
	const navigationNow = useState(`track-tournament-detail-now:${type}:${slug.value}`, () =>
		new Date().toISOString(),
	)
	const result = useQuery({
		query: Zc_TrackTournamentDetailDocument,
		variables: computed(() => ({
			type,
			slug: slug.value,
			viewerId: viewerId.value ?? 0,
			includeViewer: viewerId.value !== undefined,
			...pagination.variables.value,
		})),
	})
	const tournament = computed(() => mapTournament(result.data.value?.tournament))
	const navigationResult = useQuery({
		query: Zc_TrackTournamentNavigationDocument,
		variables: computed(() => ({
			type,
			startAt: tournament.value?.startAt ?? '1970-01-01T00:00:00.000Z',
			now: navigationNow.value,
		})),
		pause: computed(() => !includeNavigation || !tournament.value),
	})
	const navigation = computed<TournamentNavigation>(() => ({
		previous: mapTournament(navigationResult.data.value?.previous?.nodes[0]),
		current: mapTournament(navigationResult.data.value?.current?.nodes[0]),
		next: mapTournament(navigationResult.data.value?.next?.nodes[0]),
	}))
	const active = computed(() => {
		const value = tournament.value
		return Boolean(value && isTrackTournamentActive(value))
	})
	const liveEnabled = computed(
		() => mounted.value && active.value && pagination.isFirstPage.value,
	)
	const live = useSubscription({
		query: Zc_TrackTournamentLiveDocument,
		variables: computed(() => ({
			id: tournament.value?.id ?? 0,
			viewerId: viewerId.value ?? 0,
			includeViewer: viewerId.value !== undefined,
		})),
		pause: computed(() => import.meta.server || !liveEnabled.value || !pageVisible.value),
	})
	const connection = computed(
		() =>
			(liveEnabled.value ? live.data.value?.trackTournament?.leaderboard : undefined) ??
			result.data.value?.tournament?.leaderboard,
	)
	const ghostConnection = computed(
		() =>
			(liveEnabled.value ? live.data.value?.trackTournament?.ghostFeed : undefined) ??
			result.data.value?.tournament?.ghostFeed,
	)
	const viewerNode = computed(
		() =>
			(liveEnabled.value
				? live.data.value?.trackTournament?.viewerStanding?.nodes[0]
				: undefined) ?? result.data.value?.tournament?.viewerStanding?.nodes[0],
	)
	const hasViewerTime = computed(() => viewerNode.value !== undefined)
	const standings = computed(() => {
		const rows = (connection.value?.edges ?? []).map(({ node }) => mapStanding(node))
		const own = viewerNode.value
		if (!own || rows.some((row) => row.userId === own.userId)) return rows
		return [...rows, { ...mapStanding(own), pinned: true }]
	})
	const podium = computed(() => {
		const fallback = tournament.value?.podium.slice(0, 3) ?? []
		if (!pagination.isFirstPage.value) return fallback
		const firstPage = standings.value.filter((row) => !row.pinned).slice(0, 3)
		return firstPage.length > 0 ? firstPage : fallback
	})
	const ghostStandings = computed(() =>
		(ghostConnection.value?.nodes ?? []).map(mapGhostStanding),
	)
	const updateFeed = computed(
		() =>
			(liveEnabled.value ? live.data.value?.trackTournament?.updateFeed?.nodes : undefined) ??
			result.data.value?.tournament?.updateFeed?.nodes ??
			[],
	)
	const page = computed(() => pageInfo(connection.value?.pageInfo))
	const totalCount = computed(() => connection.value?.totalCount ?? 0)
	const missingGhostCount = computed(() =>
		Math.max(0, totalCount.value - (ghostConnection.value?.totalCount ?? 0)),
	)
	async function prefetch() {
		if (!import.meta.server) return
		await result
		if (includeNavigation && tournament.value) await navigationResult
	}
	onMounted(() => {
		mounted.value = true
	})
	return {
		active,
		ghostStandings,
		hasViewerTime,
		live,
		liveEnabled,
		missingGhostCount,
		navigation,
		navigationResult,
		page,
		pagination,
		podium,
		prefetch,
		result,
		standings,
		totalCount,
		tournament,
		updateFeed,
	}
}
