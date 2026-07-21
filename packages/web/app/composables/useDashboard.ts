import { useQuery, useSubscription } from '@urql/vue'
import type { Ref } from 'vue'
import {
	Zc_DashboardCriticalDocument,
	Zc_DashboardHeroSummaryDocument,
	Zc_DashboardHotLevelsDocument,
	Zc_DashboardMetricsLiveDocument,
	Zc_DashboardStatisticsDocument,
	Zc_DashboardViewerLevelsDocument,
} from '~/graphql/generated/graphql'
import type { LevelSummary, SteamNewsItem } from '~/types/app'
import { getDashboardLevelWindows, getDashboardMetricWindows } from '~/utils/dashboardMetrics'
import { getLevelDisplayName } from '~/utils/levelDisplay'

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
	levelPoints?: { points: number; rating: number } | null
	records?: { totalCount: number }
	periodRecords?: { totalCount: number }
	personalBestGlobals?: { totalCount: number }
	votes?: { totalCount: number }
	worldRecordGlobal?: {
		record: { time: number } | null
		user: { steamId: unknown; steamName: string | null } | null
	} | null
}

function mapLevel(level?: DashboardLevelLike | null): LevelSummary | null {
	if (!level) return null
	const item = level.levelItems.nodes[0]
	return {
		id: level.id,
		xxHash: level.xxHash,
		name: getLevelDisplayName(item?.name, level.xxHash),
		imageUrl: item?.imageUrl,
		authorName: item?.author?.steamName,
		authorSteamId: item?.author?.steamId == null ? null : String(item.author.steamId),
		adventure: level.adventure,
		dateCreated: String(level.dateCreated),
		points: level.levelPoints?.points,
		rating: level.levelPoints?.rating,
		recordCount: level.periodRecords?.totalCount ?? level.records?.totalCount,
		personalBestCount: level.personalBestGlobals?.totalCount,
		voteCount: level.votes?.totalCount,
		worldRecordTime: level.worldRecordGlobal?.record?.time,
		worldRecordAuthorName: level.worldRecordGlobal?.user?.steamName,
		worldRecordAuthorSteamId:
			level.worldRecordGlobal?.user?.steamId == null
				? null
				: String(level.worldRecordGlobal.user.steamId),
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
	const levelWindows = useState('dashboard-level-windows', () => getDashboardLevelWindows())
	const metricsSubscriptionActive = ref(false)
	let metricWindowTimer: ReturnType<typeof setInterval> | undefined
	onMounted(() => {
		const refreshWindows = () => {
			liveMetricWindows.value = getDashboardMetricWindows()
		}
		refreshWindows()
		levelWindows.value = getDashboardLevelWindows()
		metricsSubscriptionActive.value = true
		metricWindowTimer = setInterval(refreshWindows, 60_000)
	})
	onScopeDispose(() => {
		if (metricWindowTimer) clearInterval(metricWindowTimer)
	})
	const hotLevelsPrefetch = useViewportPrefetch()
	const popularLevelsPrefetch = useViewportPrefetch()
	const viewerPrefetch = useViewportPrefetch()
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
	const hotLevelsQuery = useQuery({
		query: Zc_DashboardHotLevelsDocument,
		variables: computed(() => ({ since: levelWindows.value.weekSince })),
		pause: computed(() => import.meta.server || !hotLevelsPrefetch.active.value),
	})
	const popularLevelsQuery = useQuery({
		query: Zc_DashboardHotLevelsDocument,
		variables: computed(() => ({ since: levelWindows.value.rollingMonthSince })),
		pause: computed(() => import.meta.server || !popularLevelsPrefetch.active.value),
	})
	const viewerQuery = useQuery({
		query: Zc_DashboardHeroSummaryDocument,
		variables: computed(() => ({ id: viewerId.value ?? 0 })),
		pause: computed(() => viewerId.value === undefined),
	})
	const latestSeason = computed(() => viewerQuery.data.value?.zslSeasons?.nodes[0])
	const viewerLevelsQuery = useQuery({
		query: Zc_DashboardViewerLevelsDocument,
		variables: computed(() => ({ id: viewerId.value ?? 0 })),
		pause: computed(
			() =>
				import.meta.server || viewerId.value === undefined || !viewerPrefetch.active.value,
		),
	})
	const statisticsQuery = useQuery({
		query: Zc_DashboardStatisticsDocument,
		variables: computed(() => ({
			daySince: ssrMetricWindows.value.daySince,
			monthSince: ssrMetricWindows.value.monthSince,
			minimumModVersion: '1.2.0',
		})),
		pause: computed(() => import.meta.server || !statisticsPrefetch.active.value),
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
	const trendingLevels = computed(
		() =>
			(criticalQuery.data.value?.trendingLevels?.nodes ?? [])
				.map(mapLevel)
				.filter(Boolean) as LevelSummary[],
	)
	const hotLevels = computed(
		() =>
			(hotLevelsQuery.data.value?.levels?.nodes ?? [])
				.map(mapLevel)
				.filter(Boolean) as LevelSummary[],
	)
	const popularLevels = computed(
		() =>
			(popularLevelsQuery.data.value?.levels?.nodes ?? [])
				.map(mapLevel)
				.filter(Boolean) as LevelSummary[],
	)
	const viewerLevelsData = computed(() => viewerLevelsQuery.data.value?.user)
	const viewerLevels = computed(
		() =>
			(viewerLevelsData.value?.levelItems.nodes ?? [])
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
		hotLevelsActive: hotLevelsPrefetch.active,
		hotLevelsQuery,
		hotLevelsTarget: hotLevelsPrefetch.target,
		metricMonthSince,
		metrics,
		metricsLive,
		hotLevels,
		news,
		newsActive: newsPrefetch.active,
		newsTarget: newsPrefetch.target,
		popularLevels,
		popularLevelsActive: popularLevelsPrefetch.active,
		popularLevelsQuery,
		popularLevelsTarget: popularLevelsPrefetch.target,
		prefetchCritical,
		statistics: statisticsQuery.data,
		statisticsActive: statisticsPrefetch.active,
		statisticsQuery,
		statisticsTarget: statisticsPrefetch.target,
		trendingLevels,
		viewer,
		viewerActive: viewerPrefetch.active,
		viewerLevelsQuery,
		viewerStanding,
		viewerLevels,
		viewerQuery,
		viewerTarget: viewerPrefetch.target,
	}
}
