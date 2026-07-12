import { useQuery, useSubscription } from '@urql/vue'
import type { Ref } from 'vue'
import {
	Zc_DashboardCriticalDocument,
	Zc_DashboardHeroSummaryDocument,
	Zc_DashboardLatestLevelsDocument,
	Zc_DashboardMetricsLiveDocument,
	Zc_DashboardStatisticsDocument,
	Zc_DashboardViewerLevelsDocument,
} from '~/graphql/generated/graphql'
import type { LevelSummary, SteamNewsItem } from '~/types/app'
import { getDashboardMetricWindows } from '~/utils/dashboardMetrics'

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
		popularLevels,
		prefetchCritical,
		statistics: statisticsQuery.data,
		statisticsActive: statisticsPrefetch.active,
		statisticsQuery,
		statisticsTarget: statisticsPrefetch.target,
		viewer,
		viewerActive: viewerPrefetch.active,
		viewerLevelsQuery,
		viewerStanding,
		viewerLevels,
		viewerQuery,
		viewerTarget: viewerPrefetch.target,
	}
}
