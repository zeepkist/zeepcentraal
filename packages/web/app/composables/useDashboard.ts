import { useQuery, useSubscription } from '@urql/vue'
import type { Ref } from 'vue'
import {
	Zc_DashboardCriticalDocument,
	Zc_DashboardLevelsDocument,
	Zc_DashboardStatisticsDocument,
	Zc_DashboardViewerContentDocument,
	Zc_DashboardViewerSummaryDocument,
	Zc_RecentPersonalBestsDocument,
	Zc_RecentWorldRecordsDocument,
} from '~/graphql/generated/graphql'
import type { LevelSummary, RecordRow, SteamNewsItem } from '~/types/app'

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
	const activeSince = useState('dashboard-active-since', () =>
		new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
	)
	const levelsPrefetch = useViewportPrefetch()
	const viewerPrefetch = useViewportPrefetch()
	const recordsPrefetch = useViewportPrefetch()
	const statisticsPrefetch = useViewportPrefetch()
	const newsPrefetch = useViewportPrefetch()

	const query = useQuery({
		query: Zc_DashboardCriticalDocument,
		variables: computed(() => ({ activeSince: activeSince.value })),
	})
	const levelsQuery = useQuery({
		query: Zc_DashboardLevelsDocument,
		pause: computed(() => !levelsPrefetch.active.value),
	})
	const viewerQuery = useQuery({
		query: Zc_DashboardViewerSummaryDocument,
		variables: computed(() => ({ id: viewerId.value ?? 0 })),
		pause: computed(() => viewerId.value === undefined),
	})
	const viewerContentQuery = useQuery({
		query: Zc_DashboardViewerContentDocument,
		variables: computed(() => ({ id: viewerId.value ?? 0 })),
		pause: computed(() => viewerId.value === undefined || !viewerPrefetch.active.value),
	})
	const statisticsQuery = useQuery({
		query: Zc_DashboardStatisticsDocument,
		pause: computed(() => !statisticsPrefetch.active.value),
	})
	const worldRecordsLive = useSubscription({
		query: Zc_RecentWorldRecordsDocument,
		pause: computed(() => !recordsPrefetch.active.value),
	})
	const personalBestsLive = useSubscription({
		query: Zc_RecentPersonalBestsDocument,
		pause: computed(() => !recordsPrefetch.active.value),
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

	const dashboard = query.data
	const viewer = computed(() => viewerQuery.data.value?.user)
	const popularLevels = computed(
		() =>
			(levelsQuery.data.value?.popularLevels?.nodes ?? [])
				.map(mapLevel)
				.filter(Boolean) as LevelSummary[],
	)
	const latestLevels = computed(
		() =>
			(levelsQuery.data.value?.latestLevels?.nodes ?? [])
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

	return {
		dashboard,
		latestLevels,
		levelsActive: levelsPrefetch.active,
		levelsQuery,
		levelsTarget: levelsPrefetch.target,
		news,
		newsActive: newsPrefetch.active,
		newsTarget: newsPrefetch.target,
		personalBestRecords,
		personalBestsLive,
		popularLevels,
		query,
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
		viewerLevels,
		viewerQuery,
		viewerRecords,
		viewerTarget: viewerPrefetch.target,
		worldRecordRecords,
		worldRecordsLive,
	}
}
