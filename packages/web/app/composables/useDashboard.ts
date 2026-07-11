import { useQuery, useSubscription } from '@urql/vue'
import type { Ref } from 'vue'
import {
	Zc_DashboardDocument,
	Zc_DashboardViewerDocument,
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
	const mounted = ref(false)
	onMounted(() => {
		mounted.value = true
	})

	const query = useQuery({
		query: Zc_DashboardDocument,
		variables: computed(() => ({ activeSince: activeSince.value })),
	})
	const viewerQuery = useQuery({
		query: Zc_DashboardViewerDocument,
		variables: computed(() => ({ id: viewerId.value ?? 0 })),
		pause: computed(() => viewerId.value === undefined),
	})
	const worldRecordsLive = useSubscription({
		query: Zc_RecentWorldRecordsDocument,
		pause: computed(() => !mounted.value),
	})
	const personalBestsLive = useSubscription({
		query: Zc_RecentPersonalBestsDocument,
		pause: computed(() => !mounted.value),
	})
	const news = useFetch<SteamNewsItem[]>('/api/steam-news', { default: () => [] })

	const dashboard = query.data
	const viewer = computed(() => viewerQuery.data.value?.user)
	const popularLevels = computed(
		() =>
			(dashboard.value?.popularLevels?.nodes ?? [])
				.map(mapLevel)
				.filter(Boolean) as LevelSummary[],
	)
	const latestLevels = computed(
		() =>
			(dashboard.value?.latestLevels?.nodes ?? [])
				.map(mapLevel)
				.filter(Boolean) as LevelSummary[],
	)
	const worldRecordRecords = computed(() => {
		const source =
			worldRecordsLive.data.value?.worldRecordGlobals ?? dashboard.value?.recentWorldRecords
		return (source?.nodes ?? [])
			.map((node) => mapRecord(node.record, viewerId.value))
			.filter(Boolean) as RecordRow[]
	})
	const personalBestRecords = computed(() => {
		const source =
			personalBestsLive.data.value?.personalBestGlobals ??
			dashboard.value?.recentPersonalBests
		return (source?.nodes ?? [])
			.map((node) => mapRecord(node.record, viewerId.value))
			.filter(Boolean) as RecordRow[]
	})
	const viewerRecords = computed(
		() =>
			(viewer.value?.records.nodes ?? [])
				.map((record) => mapRecord(record, viewerId.value))
				.filter(Boolean) as RecordRow[],
	)
	const viewerLevels = computed(
		() =>
			(viewer.value?.levelItems.nodes ?? [])
				.map((item) =>
					item.level ? mapLevel({ ...item.level, levelItems: { nodes: [item] } }) : null,
				)
				.filter(Boolean) as LevelSummary[],
	)

	return {
		dashboard,
		latestLevels,
		news,
		personalBestRecords,
		popularLevels,
		query,
		viewer,
		viewerLevels,
		viewerQuery,
		viewerRecords,
		worldRecordRecords,
	}
}
