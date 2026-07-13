import { useQuery } from '@urql/vue'
import type { Ref } from 'vue'
import {
	type RecordsOrderBy,
	Zc_LevelDetailDocument,
	Zc_LevelPointsHistoryDocument,
	Zc_LevelRecordsDocument,
	Zc_LevelSplitAnalysisDocument,
	Zc_LevelStatisticsDocument,
	Zc_LevelViewerBestDocument,
	Zc_LevelViewerRankDocument,
} from '~/graphql/generated/graphql'
import type { CursorPage, LevelSummary, LevelWorldRecordSummary, RecordRow } from '~/types/app'
import { buildLevelPointsHistory, getLevelPointsHistoryWindow } from '~/utils/levelPointsHistory'
import { buildLevelSplitAnalysis } from '~/utils/levelSplitAnalysis'

function mapRecord(
	record: {
		id: number
		time: number
		dateCreated: unknown
		levelId: number
		userId: number
		user?: { steamId: unknown; steamName: string | null } | null
	},
	viewerId?: number,
): RecordRow {
	return {
		id: record.id,
		time: record.time,
		dateCreated: String(record.dateCreated),
		levelId: record.levelId,
		userId: record.userId,
		userSteamId: record.user?.steamId == null ? null : String(record.user.steamId),
		userName: record.user?.steamName,
		viewer: viewerId === record.userId,
	}
}

export function useLevelDetail(xxHash: Ref<string>, viewerId: Ref<number | undefined>) {
	const recentPagination = useCursorPagination(25, 'records')
	const pbPagination = useCursorPagination(25, 'pbs')
	const pointsHistoryPrefetch = useViewportPrefetch()
	const statisticsPrefetch = useViewportPrefetch()
	const splitAnalysisPrefetch = useViewportPrefetch()
	const pointsHistoryWindow = useState(`level-points-history-window:${xxHash.value}`, () =>
		getLevelPointsHistoryWindow(),
	)
	const recentPrefetch = useViewportPrefetch()
	const personalBestsPrefetch = useViewportPrefetch()
	const detail = useQuery({
		query: Zc_LevelDetailDocument,
		variables: computed(() => ({ xxHash: xxHash.value })),
	})
	const level = computed(() => detail.data.value?.levelByXxHash)
	const levelId = computed(() => level.value?.id)
	const pointsHistoryQuery = useQuery({
		query: Zc_LevelPointsHistoryDocument,
		variables: computed(() => ({
			levelId: levelId.value ?? 0,
			since: pointsHistoryWindow.value.since,
		})),
		pause: computed(() => levelId.value === undefined || !pointsHistoryPrefetch.active.value),
	})
	const pointsHistory = computed(() =>
		buildLevelPointsHistory({
			baseline: pointsHistoryQuery.data.value?.baseline?.nodes[0],
			groups: pointsHistoryQuery.data.value?.history?.groupedAggregates,
			currentPoints: level.value?.levelPoints?.points,
			createdAt: String(level.value?.dateCreated ?? pointsHistoryWindow.value.since),
			since: pointsHistoryWindow.value.since,
			now: pointsHistoryWindow.value.now,
		}),
	)
	const statistics = useQuery({
		query: Zc_LevelStatisticsDocument,
		variables: computed(() => ({ levelId: levelId.value ?? 0, minimumModVersion: '1.2.0' })),
		pause: computed(() => levelId.value === undefined || !statisticsPrefetch.active.value),
	})
	const splitAnalysisQuery = useQuery({
		query: Zc_LevelSplitAnalysisDocument,
		variables: computed(() => ({ levelId: levelId.value ?? 0 })),
		pause: computed(() => levelId.value === undefined || !splitAnalysisPrefetch.active.value),
	})
	const splitAnalysis = computed(() =>
		buildLevelSplitAnalysis(splitAnalysisQuery.data.value?.records?.nodes ?? []),
	)
	const recent = useQuery({
		query: Zc_LevelRecordsDocument,
		variables: computed(() => ({
			...recentPagination.variables.value,
			filter: { levelId: { equalTo: levelId.value ?? 0 } },
			orderBy: ['DATE_CREATED_DESC' as RecordsOrderBy],
		})),
		pause: computed(() => levelId.value === undefined || !recentPrefetch.active.value),
	})
	const personalBests = useQuery({
		query: Zc_LevelRecordsDocument,
		variables: computed(() => ({
			...pbPagination.variables.value,
			filter: {
				levelId: { equalTo: levelId.value ?? 0 },
				personalBestGlobalsExist: true,
			},
			orderBy: ['TIME_ASC' as RecordsOrderBy],
		})),
		pause: computed(() => levelId.value === undefined || !personalBestsPrefetch.active.value),
	})
	const viewerBest = useQuery({
		query: Zc_LevelViewerBestDocument,
		variables: computed(() => ({ userId: viewerId.value ?? 0, levelId: levelId.value ?? 0 })),
		pause: computed(
			() =>
				viewerId.value === undefined ||
				levelId.value === undefined ||
				!personalBestsPrefetch.active.value,
		),
	})
	const viewerBestRecord = computed(
		() => viewerBest.data.value?.personalBestGlobalByUserIdAndLevelId?.record,
	)
	const viewerRank = useQuery({
		query: Zc_LevelViewerRankDocument,
		variables: computed(() => ({
			levelId: levelId.value ?? 0,
			time: viewerBestRecord.value?.time ?? 0,
		})),
		pause: computed(
			() =>
				!personalBestsPrefetch.active.value ||
				viewerBestRecord.value === undefined ||
				viewerBestRecord.value === null,
		),
	})

	const summary = computed<LevelSummary | null>(() => {
		const value = level.value
		if (!value) return null
		const item = value.levelItems.nodes[0]
		return {
			id: value.id,
			xxHash: value.xxHash,
			name: item?.name ?? value.xxHash,
			imageUrl: item?.imageUrl,
			authorName: item?.author?.steamName,
			authorSteamId: item?.author?.steamId == null ? null : String(item.author.steamId),
			authorId: item?.authorId == null ? null : String(item.authorId),
			workshopId: item?.workshopId == null ? null : String(item.workshopId),
			trackLength: value.worldRecordGlobal?.record?.recordStatistic?.distance,
			adventure: value.adventure,
			dateCreated: String(value.dateCreated),
			points: value.levelPoints?.points,
			rating: value.levelPoints?.rating,
			competitiveness: value.levelPoints?.modifierCompetitiveness,
			recordCount: value.records.totalCount,
			personalBestCount: value.personalBestGlobals.totalCount,
			medals: item
				? {
						author: item.validationTimeAuthor,
						gold: item.validationTimeGold,
						silver: item.validationTimeSilver,
						bronze: item.validationTimeBronze,
					}
				: null,
		}
	})
	const worldRecord = computed<LevelWorldRecordSummary | null>(() => {
		const value = level.value?.worldRecordGlobal
		if (!value?.record) return null
		return {
			recordId: value.record.id,
			time: value.record.time,
			userName: value.user?.steamName,
			userSteamId: value.user?.steamId == null ? null : String(value.user.steamId),
		}
	})
	const recentRows = computed(() =>
		(recent.data.value?.records?.edges ?? []).map(({ node }) =>
			mapRecord(node, viewerId.value),
		),
	)
	const personalBestRows = computed(() => {
		const rows = (personalBests.data.value?.records?.edges ?? []).map(({ node }, index) => ({
			...mapRecord(node, viewerId.value),
			rank: pbPagination.after.value || pbPagination.before.value ? null : index + 1,
		}))
		const own = viewerBestRecord.value
		if (!own || rows.some((row) => row.id === own.id)) return rows
		return [
			...rows,
			{
				...mapRecord(own, viewerId.value),
				rank: Number(viewerRank.data.value?.records?.totalCount ?? 0) + 1,
			},
		]
	})
	const recentPage = computed<CursorPage>(() =>
		recent.data.value?.records?.pageInfo
			? {
					startCursor:
						String(recent.data.value.records.pageInfo.startCursor ?? '') || null,
					endCursor: String(recent.data.value.records.pageInfo.endCursor ?? '') || null,
					hasNextPage: recent.data.value.records.pageInfo.hasNextPage,
					hasPreviousPage: recent.data.value.records.pageInfo.hasPreviousPage,
				}
			: { hasNextPage: false, hasPreviousPage: false },
	)
	const personalBestPage = computed<CursorPage>(() =>
		personalBests.data.value?.records?.pageInfo
			? {
					startCursor:
						String(personalBests.data.value.records.pageInfo.startCursor ?? '') || null,
					endCursor:
						String(personalBests.data.value.records.pageInfo.endCursor ?? '') || null,
					hasNextPage: personalBests.data.value.records.pageInfo.hasNextPage,
					hasPreviousPage: personalBests.data.value.records.pageInfo.hasPreviousPage,
				}
			: { hasNextPage: false, hasPreviousPage: false },
	)

	async function prefetchCritical() {
		if (import.meta.server) await detail
	}

	return {
		detail,
		level,
		prefetchCritical,
		pointsHistory,
		pointsHistoryActive: pointsHistoryPrefetch.active,
		pointsHistoryQuery,
		pointsHistoryTarget: pointsHistoryPrefetch.target,
		personalBestsActive: personalBestsPrefetch.active,
		personalBestPage,
		personalBestRows,
		personalBests,
		personalBestsTarget: personalBestsPrefetch.target,
		pbPagination,
		recent,
		recentActive: recentPrefetch.active,
		recentPage,
		recentPagination,
		recentRows,
		recentTarget: recentPrefetch.target,
		splitAnalysis,
		splitAnalysisActive: splitAnalysisPrefetch.active,
		splitAnalysisQuery,
		splitAnalysisTarget: splitAnalysisPrefetch.target,
		statistics,
		statisticsActive: statisticsPrefetch.active,
		statisticsTarget: statisticsPrefetch.target,
		summary,
		viewerBest,
		viewerRank,
		worldRecord,
	}
}
