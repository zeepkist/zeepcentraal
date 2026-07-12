import { useQuery, useSubscription } from '@urql/vue'
import type { Ref } from 'vue'
import {
	Zc_DashboardCriticalDocument,
	Zc_DashboardHeroSummaryDocument,
	Zc_DashboardLatestLevelsDocument,
	Zc_DashboardMetricsLiveDocument,
	Zc_DashboardStatisticsDocument,
	Zc_DashboardViewerContentDocument,
	Zc_RecentPersonalBestsDocument,
	Zc_RecentWorldRecordsDocument,
} from '~/graphql/generated/graphql'
import type { LevelSummary, RecordRow, SteamNewsItem } from '~/types/app'
import { getDashboardMetricWindows } from '~/utils/dashboardMetrics'

type DashboardRecordLike = {
	id: number
	time: number
	dateCreated: unknown
	levelId: number
	userId: number
	user?: { steamId: unknown; steamName: string | null } | null
	level?: { xxHash: string; levelItems: { nodes: Array<{ name: string }> } } | null
}

type DashboardLevelLike = {
	id: number
	xxHash: string
	adventure: boolean
	dateCreated: unknown
	levelItems: {
		nodes: Array<{
			name: string
			imageUrl: string
			validationTimeAuthor: number
			validationTimeGold: number
			validationTimeSilver: number
			validationTimeBronze: number
			author: { steamId: unknown; steamName: string | null } | null
		}>
	}
	levelPoints?: { points: number; rating: number; modifierPopularity: number } | null
	records?: { totalCount: number }
}

function mapRecord(record?: DashboardRecordLike | null, viewerId?: number): RecordRow | null {
	if (!record) return null
	const levelItem = record.level?.levelItems.nodes[0]
	return {
		id: record.id,
		time: record.time,
		dateCreated: String(record.dateCreated),
		userId: record.userId,
		userSteamId: record.user?.steamId == null ? null : String(record.user.steamId),
		userName: record.user?.steamName,
		levelId: record.levelId,
		levelXxHash: record.level?.xxHash,
		levelName: levelItem?.name,
		viewer: viewerId === record.userId,
	}
}

function mapLevel(level?: DashboardLevelLike | null): LevelSummary | null {
	if (!level) return null
	const item = level.levelItems.nodes[0]
	return {
		id: level.id,
		xxHash: level.xxHash,
		name: item?.name ?? level.xxHash,
		imageUrl: item?.imageUrl,
		authorName: item?.author?.steamName,
		authorSteamId: item?.author?.steamId == null ? null : String(item.author.steamId),
		adventure: level.adventure,
		dateCreated: String(level.dateCreated),
		points: level.levelPoints?.points,
		rating: level.levelPoints?.rating,
		popularity: level.levelPoints?.modifierPopularity,
		recordCount: level.records?.totalCount,
		medals: item
			? {
					author: item.validationTimeAuthor,
					gold: item.validationTimeGold,
					silver: item.validationTimeSilver,
					bronze: item.validationTimeBronze,
				}
			: null,
	}
}

export function useDashboard(viewerId: Ref<number | undefined>) {
	const ssrMetricWindows = useState('dashboard-metric-windows', () => getDashboardMetricWindows())
	const liveMetricWindows = ref({ ...ssrMetricWindows.value })
	const metricsSubscriptionActive = ref(false)
	let metricWindowTimer: ReturnType<typeof setInterval> | undefined
	onMounted(() => {
		const refreshWindows = () => {
			liveMetricWindows.value = getDashboardMetricWindows()
		}
		refreshWindows()
		metricsSubscriptionActive.value = true
		metricWindowTimer = setInterval(refreshWindows, 60_000)
	})
	onScopeDispose(() => {
		if (metricWindowTimer) clearInterval(metricWindowTimer)
	})
	const levelsPrefetch = useViewportPrefetch()
	const viewerPrefetch = useViewportPrefetch()
	const recordsPrefetch = useViewportPrefetch()
	const statisticsPrefetch = useViewportPrefetch()
	const newsPrefetch = useViewportPrefetch()

	const criticalQuery = useQuery({
		query: Zc_DashboardCriticalDocument,
		variables: ssrMetricWindows,
	})
	const metricsLive = useSubscription({
		query: Zc_DashboardMetricsLiveDocument,
		variables: liveMetricWindows,
		pause: computed(() => !metricsSubscriptionActive.value),
	})
	const latestLevelsQuery = useQuery({
		query: Zc_DashboardLatestLevelsDocument,
		pause: computed(() => import.meta.server || !levelsPrefetch.active.value),
	})
	const viewerQuery = useQuery({
		query: Zc_DashboardHeroSummaryDocument,
		variables: computed(() => ({ id: viewerId.value ?? 0 })),
		pause: computed(() => viewerId.value === undefined),
	})
	const latestSeason = computed(() => viewerQuery.data.value?.zslSeasons?.nodes[0])
	const viewerContentQuery = useQuery({
		query: Zc_DashboardViewerContentDocument,
		variables: computed(() => ({ id: viewerId.value ?? 0 })),
		pause: computed(
			() =>
				import.meta.server || viewerId.value === undefined || !viewerPrefetch.active.value,
		),
	})
	const statisticsQuery = useQuery({
		query: Zc_DashboardStatisticsDocument,
		pause: computed(() => import.meta.server || !statisticsPrefetch.active.value),
	})
	const worldRecordsLive = useSubscription({
		query: Zc_RecentWorldRecordsDocument,
		pause: computed(() => import.meta.server || !recordsPrefetch.active.value),
	})
	const personalBestsLive = useSubscription({
		query: Zc_RecentPersonalBestsDocument,
		pause: computed(() => import.meta.server || !recordsPrefetch.active.value),
	})
	const news = useFetch<SteamNewsItem[]>('/api/steam-news', {
		default: () => [],
		immediate: false,
		server: false,
	})
	watch(
		newsPrefetch.active,
		(active) => {
			if (active) void news.execute()
		},
		{ immediate: true },
	)

	const metrics = computed(() => metricsLive.data.value?.query ?? criticalQuery.data.value)
	const metricMonthSince = computed(() =>
		metricsLive.data.value?.query
			? liveMetricWindows.value.monthSince
			: ssrMetricWindows.value.monthSince,
	)
	const viewer = computed(() => viewerQuery.data.value?.user)
	const viewerStanding = computed(() => latestSeason.value?.zslSeasonResults.nodes[0])
	const popularLevels = computed(
		() =>
			(criticalQuery.data.value?.popularLevels?.nodes ?? [])
				.map(mapLevel)
				.filter(Boolean) as LevelSummary[],
	)
	const latestLevels = computed(
		() =>
			(latestLevelsQuery.data.value?.latestLevels?.nodes ?? [])
				.map(mapLevel)
				.filter(Boolean) as LevelSummary[],
	)
	const worldRecordRecords = computed(
		() =>
			(worldRecordsLive.data.value?.worldRecordGlobals?.nodes ?? [])
				.map((node) => mapRecord(node.record, viewerId.value))
				.filter(Boolean) as RecordRow[],
	)
	const personalBestRecords = computed(
		() =>
			(personalBestsLive.data.value?.personalBestGlobals?.nodes ?? [])
				.map((node) => mapRecord(node.record, viewerId.value))
				.filter(Boolean) as RecordRow[],
	)
	const recordsReady = computed(
		() =>
			worldRecordsLive.data.value !== undefined && personalBestsLive.data.value !== undefined,
	)
	const viewerContent = computed(() => viewerContentQuery.data.value?.user)
	const viewerRecords = computed(
		() =>
			(viewerContent.value?.records.nodes ?? [])
				.map((record) => mapRecord(record, viewerId.value))
				.filter(Boolean) as RecordRow[],
	)
	const viewerLevels = computed(
		() =>
			(viewerContent.value?.levelItems.nodes ?? [])
				.map((item) =>
					item.level ? mapLevel({ ...item.level, levelItems: { nodes: [item] } }) : null,
				)
				.filter(Boolean) as LevelSummary[],
	)

	async function prefetchCritical() {
		if (!import.meta.server) return
		if (viewerId.value === undefined) {
			await criticalQuery
			return
		}
		await Promise.all([criticalQuery, viewerQuery])
	}

	return {
		criticalQuery,
		latestSeason,
		latestLevelsActive: levelsPrefetch.active,
		latestLevelsQuery,
		latestLevelsTarget: levelsPrefetch.target,
		metricMonthSince,
		metrics,
		metricsLive,
		latestLevels,
		news,
		newsActive: newsPrefetch.active,
		newsTarget: newsPrefetch.target,
		personalBestRecords,
		personalBestsLive,
		popularLevels,
		prefetchCritical,
		recordsActive: recordsPrefetch.active,
		recordsReady,
		recordsTarget: recordsPrefetch.target,
		statistics: statisticsQuery.data,
		statisticsActive: statisticsPrefetch.active,
		statisticsQuery,
		statisticsTarget: statisticsPrefetch.target,
		viewer,
		viewerActive: viewerPrefetch.active,
		viewerContentQuery,
		viewerStanding,
		viewerLevels,
		viewerQuery,
		viewerRecords,
		viewerTarget: viewerPrefetch.target,
		worldRecordRecords,
		worldRecordsLive,
	}
}
