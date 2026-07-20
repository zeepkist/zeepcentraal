import { useQuery } from '@urql/vue'
import {
	calculateDecayMultiplier,
	GLOBAL_DECAY_FACTOR,
	LEVEL_DECAY_FACTOR,
} from '@zeepkist/core/score'
import type { Ref } from 'vue'
import {
	type RecordsOrderBy,
	Zc_LevelDetailDocument,
	Zc_LevelPersonalBestRanksDocument,
	Zc_LevelPointsHistoryDocument,
	Zc_LevelRecordsDocument,
	Zc_LevelSplitAnalysisDocument,
	Zc_LevelStatisticsDocument,
	Zc_LevelViewerBestDocument,
} from '~/graphql/generated/graphql'
import type {
	CursorPage,
	LevelScoreInsights,
	LevelSummary,
	LevelWorldRecordSummary,
	RecordHistoryRow,
} from '~/types/app'
import { getLevelDisplayName } from '~/utils/levelDisplay'
import { buildLevelPointsHistory, getLevelPointsHistoryWindow } from '~/utils/levelPointsHistory'
import {
	buildLevelPersonalBestRanks,
	calculateLevelPersonalBestPoints,
	resolveRecordPbOrWr,
} from '~/utils/levelRecordRows'
import { buildLevelSplitAnalysis } from '~/utils/levelSplitAnalysis'

type LevelScoreInsightsSource = LevelScoreInsights & {
	modifierAfk?: number | null
	modifierRating?: number | null
}

function mapRecord(
	record: {
		id: number
		time: number
		dateCreated: unknown
		levelId: number
		userId: number
		user?: { steamId: unknown; steamName: string | null } | null
		userPointContributions?: {
			nodes: Array<{
				levelPosition: number
				contributionRank: number
				levelPoints: number
				levelDecayedPoints: number
				playerDecayedPoints: number
			}>
		} | null
		personalBestGlobals?: { totalCount: number } | null
		worldRecordGlobals?: { totalCount: number } | null
	},
	levelXxHash: string,
	levelName: string,
	baseLevelPoints: number | null | undefined,
	assumePersonalBest = false,
): RecordHistoryRow {
	const status = assumePersonalBest
		? record.userPointContributions?.nodes[0]?.levelPosition === 1
			? 'world-record'
			: 'personal-best'
		: resolveRecordPbOrWr(record)
	const contribution = status ? record.userPointContributions?.nodes[0] : undefined
	return {
		id: record.id,
		time: record.time,
		dateCreated: String(record.dateCreated),
		levelId: record.levelId,
		userId: record.userId,
		userSteamId: record.user?.steamId == null ? null : String(record.user.steamId),
		userName: record.user?.steamName,
		levelXxHash,
		levelName,
		levelPosition: contribution?.levelPosition,
		contributionRank: contribution?.contributionRank,
		levelPoints: contribution?.levelPoints ?? baseLevelPoints,
		levelDecayedPoints: contribution?.levelDecayedPoints,
		playerDecayedPoints: contribution?.playerDecayedPoints,
		levelDecayMultiplier:
			contribution?.levelPosition == null
				? undefined
				: calculateDecayMultiplier(contribution.levelPosition, LEVEL_DECAY_FACTOR),
		globalDecayMultiplier:
			contribution?.contributionRank == null
				? undefined
				: calculateDecayMultiplier(contribution.contributionRank, GLOBAL_DECAY_FACTOR),
		pbOrWr: status,
		pinned: false,
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
	const mapLevelRecord = (record: Parameters<typeof mapRecord>[0], assumePersonalBest = false) =>
		mapRecord(
			record,
			level.value?.xxHash ?? xxHash.value,
			getLevelDisplayName(
				level.value?.publiclyVisible ? level.value.levelItems.nodes[0]?.name : undefined,
				level.value?.xxHash ?? xxHash.value,
			),
			level.value?.levelPoints?.points,
			assumePersonalBest,
		)
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
		variables: computed(() => ({
			levelId: levelId.value ?? 0,
			viewerId: viewerId.value ?? 0,
			includeViewer: viewerId.value !== undefined,
		})),
		pause: computed(() => levelId.value === undefined || !splitAnalysisPrefetch.active.value),
	})
	const splitAnalysis = computed(() =>
		buildLevelSplitAnalysis(
			splitAnalysisQuery.data.value?.records?.nodes ?? [],
			splitAnalysisQuery.data.value?.viewerPersonalBest?.record,
		),
	)
	const recent = useQuery({
		query: Zc_LevelRecordsDocument,
		variables: computed(() => ({
			...recentPagination.variables.value,
			filter: { levelId: { equalTo: levelId.value ?? 0 } },
			orderBy: ['DATE_CREATED_DESC' as RecordsOrderBy],
			includeStatus: true,
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
			orderBy: ['TIME_ASC' as RecordsOrderBy, 'ID_ASC' as RecordsOrderBy],
			includeStatus: false,
		})),
		pause: computed(() => levelId.value === undefined || !personalBestsPrefetch.active.value),
	})
	const personalBestRecords = computed(() =>
		(personalBests.data.value?.records?.edges ?? []).map(({ node }) => node),
	)
	const personalBestRankWindow = computed(() => {
		const times = personalBestRecords.value.map((record) => record.time)
		if (times.length === 0) return null
		return { minimumTime: Math.min(...times), maximumTime: Math.max(...times) }
	})
	const personalBestRanks = useQuery({
		query: Zc_LevelPersonalBestRanksDocument,
		variables: computed(() => ({
			levelId: levelId.value ?? 0,
			minimumTime: personalBestRankWindow.value?.minimumTime ?? 0,
			maximumTime: personalBestRankWindow.value?.maximumTime ?? 0,
		})),
		pause: computed(
			() =>
				levelId.value === undefined ||
				!personalBestsPrefetch.active.value ||
				personalBestRankWindow.value === null,
		),
	})
	const personalBestRanksByTime = computed(() =>
		buildLevelPersonalBestRanks(
			personalBestRanks.data.value?.fasterPersonalBests?.totalCount,
			personalBestRanks.data.value?.visiblePersonalBestTimes?.groupedAggregates,
		),
	)
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

	const summary = computed<LevelSummary | null>(() => {
		const value = level.value
		if (!value) return null
		const item = value.publiclyVisible ? value.levelItems.nodes[0] : undefined
		return {
			id: value.id,
			xxHash: value.xxHash,
			publiclyVisible: value.publiclyVisible,
			name: getLevelDisplayName(item?.name, value.xxHash),
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
			competitiveness:
				(value.levelPoints?.sampleSize ?? 0) > 0
					? value.levelPoints?.modifierCompetitiveness
					: undefined,
			recordCount: value.records.totalCount,
			personalBestCount: value.personalBestGlobals.totalCount,
			voteCount: value.votes.totalCount,
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
	const scoreInsights = computed<LevelScoreInsights>(() => {
		const points = level.value?.levelPoints as LevelScoreInsightsSource | null | undefined
		return {
			sampleSize: points?.sampleSize,
			leaderboardConfidence: points?.leaderboardConfidence,
			inputSampleSize: points?.inputSampleSize,
			inputCoverage: points?.inputCoverage,
			airSampleSize: points?.airSampleSize,
			wheelSampleSize: points?.wheelSampleSize,
			slipSampleSize: points?.slipSampleSize,
			ragdollSampleSize: points?.ragdollSampleSize,
			stateSampleSize: points?.stateSampleSize,
			surfaceSampleSize: points?.surfaceSampleSize,
			velocitySampleSize: points?.velocitySampleSize,
			competitivenessScore: points?.competitivenessScore,
			worldRecordDifficultyScore: points?.worldRecordDifficultyScore,
			participationScore: points?.participationScore,
			voteAdjustment: points?.modifierRating,
			passivePlaySeverity: points?.passivePlaySeverity,
			afkModifier: points?.modifierAfk,
			passiveRunRatio: points?.passiveRunRatio,
			passiveTop10Share: points?.passiveTop10Share,
			bestPassiveRank: points?.bestPassiveRank,
			bestPassiveGap: points?.bestPassiveGap,
			driverEngagementScore: points?.driverEngagementScore,
			worldRecordMargin: points?.worldRecordMargin,
			top5Spread: points?.top5Spread,
			top10Spread: points?.top10Spread,
			top50Spread: points?.top50Spread,
			wrChallengerCount: points?.wrChallengerCount,
			worldRecordOptimizationScore: points?.worldRecordOptimizationScore,
			leaderboardAnomalyScore: points?.leaderboardAnomalyScore,
			telemetryAnomalyScore: points?.telemetryAnomalyScore,
			worldRecordExcluded: points?.worldRecordExcluded,
			pathConsistencyScore: points?.pathConsistencyScore,
			speedConsistencyScore: points?.speedConsistencyScore,
			routeConsistencyScore: points?.routeConsistencyScore,
			surfaceDiversityScore: points?.surfaceDiversityScore,
			matureVoteCount: points?.matureVoteCount,
			typicalDistance: points?.typicalDistance,
			typicalAverageSpeed: points?.typicalAverageSpeed,
			typicalMaxSpeed: points?.typicalMaxSpeed,
			typicalAirTimeShare: points?.typicalAirTimeShare,
			typicalGroundTimeShare: points?.typicalGroundTimeShare,
			typicalSlipShare: points?.typicalSlipShare,
			typicalRagdollShare: points?.typicalRagdollShare,
			typicalAverageAngularVelocity: points?.typicalAverageAngularVelocity,
			typicalAverageGforce: points?.typicalAverageGforce,
			medianSteeringShare: points?.medianSteeringShare,
			q25SteeringShare: points?.q25SteeringShare,
			lowSteeringRatio: points?.lowSteeringRatio,
			zeroControlRatio: points?.zeroControlRatio,
			medianBrakeShare: points?.medianBrakeShare,
			medianArmsUpShare: points?.medianArmsUpShare,
			medianControlTransitionRate: points?.medianControlTransitionRate,
		}
	})
	const worldRecord = computed<LevelWorldRecordSummary | null>(() => {
		const value = level.value?.worldRecordGlobal
		if (!value?.record) return null
		return {
			recordId: value.record.id,
			time: value.record.time,
			dateCreated: String(value.record.dateCreated),
			userName: value.user?.steamName,
			userSteamId: value.user?.steamId == null ? null : String(value.user.steamId),
		}
	})
	const recentRowsSource = computed(() =>
		(recent.data.value?.records?.edges ?? []).map(({ node }) => mapLevelRecord(node)),
	)
	const recentRows = useRecordRankFallback(recentRowsSource)
	const nextPersonalBestRows = computed<RecordHistoryRow[] | null>(() => {
		if (
			personalBests.fetching.value ||
			personalBestRanks.fetching.value ||
			viewerBest.fetching.value
		) {
			return null
		}
		if (
			personalBestRecords.value.length > 0 &&
			personalBestRecords.value.some(
				(record) => !personalBestRanksByTime.value.has(record.time),
			)
		) {
			return null
		}
		if (
			viewerId.value !== undefined &&
			personalBestsPrefetch.active.value &&
			viewerBest.data.value === undefined
		) {
			return null
		}

		const levelPoints = level.value?.levelPoints?.points
		const rows = personalBestRecords.value.map((record) => {
			const rank = personalBestRanksByTime.value.get(record.time)
			const mapped = mapLevelRecord(record, true)
			return {
				...mapped,
				levelPosition: rank,
				levelPoints: mapped.levelPoints ?? levelPoints,
				levelDecayedPoints:
					mapped.levelDecayedPoints ??
					calculateLevelPersonalBestPoints(levelPoints, rank),
				levelDecayMultiplier:
					rank == null ? undefined : calculateDecayMultiplier(rank, LEVEL_DECAY_FACTOR),
			}
		})
		const own = viewerBestRecord.value
		if (!own || rows.some((row) => row.id === own.id)) return rows
		return [
			...rows,
			{
				...mapLevelRecord(own, true),
				pinned: true,
			},
		]
	})
	const personalBestRowsSource = shallowRef<RecordHistoryRow[]>([])
	watch(
		nextPersonalBestRows,
		(rows) => {
			if (rows !== null) personalBestRowsSource.value = rows
		},
		{ immediate: true },
	)
	const personalBestRows = useRecordRankFallback(personalBestRowsSource)
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
		personalBestRanks,
		personalBestsTarget: personalBestsPrefetch.target,
		pbPagination,
		recent,
		recentActive: recentPrefetch.active,
		recentPage,
		recentPagination,
		recentRows,
		recentTarget: recentPrefetch.target,
		scoreInsights,
		splitAnalysis,
		splitAnalysisActive: splitAnalysisPrefetch.active,
		splitAnalysisQuery,
		splitAnalysisTarget: splitAnalysisPrefetch.target,
		statistics,
		statisticsActive: statisticsPrefetch.active,
		statisticsTarget: statisticsPrefetch.target,
		summary,
		viewerBest,
		worldRecord,
	}
}
