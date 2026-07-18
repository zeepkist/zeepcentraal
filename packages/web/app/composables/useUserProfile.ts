import { useQuery } from '@urql/vue'
import {
	calculateDecayMultiplier,
	GLOBAL_DECAY_FACTOR,
	LEVEL_DECAY_FACTOR,
} from '@zeepkist/core/score'
import {
	type UserPointContributionsOrderBy,
	Zc_UserContributionsDocument,
	type Zc_UserLevelCardFragment,
	Zc_UserLevelsDocument,
	Zc_UserPointsHistoryDocument,
	Zc_UserPointsHistorySecondaryDocument,
	Zc_UserProfileDocument,
	Zc_UserResultsDocument,
	Zc_UserStatisticsDocument,
	Zc_UserSuperLeagueSeasonDocument,
	Zc_UserSuperLeagueSeasonsDocument,
} from '~/graphql/generated/graphql'
import type { CursorPage, LevelSummary, RecordHistoryRow, UserProfileSummary } from '~/types/app'
import { getLevelHotWindows } from '~/utils/levelExplorer'
import { resolveRecordPbOrWr } from '~/utils/levelRecordRows'
import type { RecordHistorySort } from '~/utils/recordHistory'
import {
	buildUserCareerHistory,
	buildUserCareerSecondaryHistory,
	getUserCareerHistoryWindow,
} from '~/utils/userCareerHistory'
import { buildUserSuperLeagueSummary } from '~/utils/userSuperLeague'
import { getUserTelemetryWindows, type UserTelemetryPeriod } from '~/utils/userTelemetry'

function cursorPage(
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

function mapUserLevel(
	level: Zc_UserLevelCardFragment,
	recordCount = level.records.totalCount,
): LevelSummary {
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
		recordCount,
		personalBestCount: level.personalBestGlobals.totalCount,
		voteCount: level.votes.totalCount,
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

export function useUserProfile(steamId: Ref<string>) {
	const statisticsPrefetch = useViewportPrefetch()
	const levelsPrefetch = useViewportPrefetch()
	const personalBestsPrefetch = useViewportPrefetch()
	const recentPrefetch = useViewportPrefetch()
	const careerSecondaryActive = ref(false)
	onMounted(() => {
		careerSecondaryActive.value = true
	})
	const profile = useQuery({
		query: Zc_UserProfileDocument,
		variables: computed(() => ({ steamId: steamId.value })),
	})
	const user = computed(() => profile.data.value?.users?.nodes[0])
	const userId = computed(() => user.value?.id)
	const historyWindow = useState(`user-career-history-window:${steamId.value}`, () =>
		getUserCareerHistoryWindow(),
	)
	const levelWindows = useState(`user-level-windows:${steamId.value}`, () => getLevelHotWindows())
	const telemetryWindows = useState(`user-telemetry-windows:${steamId.value}`, () =>
		getUserTelemetryWindows(),
	)
	const telemetryPeriod = ref<UserTelemetryPeriod>('all-time')
	const selectedSuperLeagueSeasonId = useState<number | undefined>(
		`user-super-league-season:${steamId.value}`,
		() => undefined,
	)
	const summary = computed<UserProfileSummary | null>(() => {
		const value = user.value
		if (!value) return null
		return {
			id: value.id,
			steamId: String(value.steamId),
			steamName: value.steamName,
			dateCreated: String(value.dateCreated),
			rank: value.userPoints?.rank ?? null,
			rankedPoints: value.userPoints?.points ?? 0,
			totalPoints: value.userPoints?.totalPoints ?? 0,
			records: value.records.totalCount,
			personalBests: value.personalBestGlobals.totalCount,
			worldRecords: value.worldRecordGlobals.totalCount,
			levels: value.levelItems.totalCount,
		}
	})
	const pointsHistoryQuery = useQuery({
		query: Zc_UserPointsHistoryDocument,
		variables: computed(() => ({
			userId: userId.value ?? 0,
			since: historyWindow.value.since,
		})),
		pause: computed(() => userId.value === undefined),
	})
	const pointsHistory = computed(() =>
		buildUserCareerHistory({
			baseline: pointsHistoryQuery.data.value?.baseline?.nodes[0],
			groups: pointsHistoryQuery.data.value?.history?.groupedAggregates,
			current: user.value?.userPoints,
			since: historyWindow.value.since,
			now: historyWindow.value.now,
		}),
	)
	const secondaryPointsHistoryQuery = useQuery({
		query: Zc_UserPointsHistorySecondaryDocument,
		variables: computed(() => ({
			userId: userId.value ?? 0,
			since: historyWindow.value.since,
		})),
		pause: computed(
			() => import.meta.server || userId.value === undefined || !careerSecondaryActive.value,
		),
	})
	const secondaryPointsHistory = computed(() =>
		buildUserCareerSecondaryHistory({
			baseline: secondaryPointsHistoryQuery.data.value?.baseline?.nodes[0],
			groups: secondaryPointsHistoryQuery.data.value?.history?.groupedAggregates,
			current: user.value?.userPoints,
			since: historyWindow.value.since,
			now: historyWindow.value.now,
		}),
	)
	const secondaryPointsHistoryReady = computed(
		() => careerSecondaryActive.value && secondaryPointsHistoryQuery.data.value !== undefined,
	)
	const superLeagueSeasonsQuery = useQuery({
		query: Zc_UserSuperLeagueSeasonsDocument,
		variables: computed(() => ({ userId: userId.value ?? 0 })),
		pause: computed(() => userId.value === undefined),
	})
	const superLeagueSeasons = computed(
		() => superLeagueSeasonsQuery.data.value?.zslSeasons?.nodes ?? [],
	)
	const currentSuperLeagueSeason = computed(() => {
		const season = superLeagueSeasonsQuery.data.value?.currentSeason?.nodes[0]
		return season ? buildUserSuperLeagueSummary(season) : null
	})
	watch(
		superLeagueSeasons,
		(seasons) => {
			if (
				seasons.length > 0 &&
				!seasons.some((season) => season.id === selectedSuperLeagueSeasonId.value)
			) {
				selectedSuperLeagueSeasonId.value = seasons[0]?.id
			}
		},
		{ immediate: true, flush: 'sync' },
	)
	const superLeagueSeasonQuery = useQuery({
		query: Zc_UserSuperLeagueSeasonDocument,
		variables: computed(() => ({
			seasonId: selectedSuperLeagueSeasonId.value ?? 0,
			userId: userId.value ?? 0,
		})),
		pause: computed(
			() =>
				userId.value === undefined ||
				selectedSuperLeagueSeasonId.value === undefined ||
				selectedSuperLeagueSeasonId.value === currentSuperLeagueSeason.value?.id,
		),
	})
	const superLeagueSeason = computed(() => {
		if (selectedSuperLeagueSeasonId.value === currentSuperLeagueSeason.value?.id) {
			return currentSuperLeagueSeason.value
		}
		const season = superLeagueSeasonQuery.data.value?.zslSeason
		return season?.id === selectedSuperLeagueSeasonId.value
			? buildUserSuperLeagueSummary(season)
			: null
	})
	const statistics = useQuery({
		query: Zc_UserStatisticsDocument,
		variables: computed(() => ({
			userId: userId.value ?? 0,
			minimumModVersion: '1.2.0',
			daySince: telemetryWindows.value.daySince,
			monthSince: telemetryWindows.value.monthSince,
			yearSince: telemetryWindows.value.yearSince,
		})),
		pause: computed(() => userId.value === undefined || !statisticsPrefetch.active.value),
	})
	const selectedStatistics = computed(() => {
		const value = statistics.data.value
		if (!value) return undefined
		if (telemetryPeriod.value === 'today') {
			return {
				allStatistics: value.dayStatistics,
				v6Statistics: value.v6DayStatistics,
			}
		}
		if (telemetryPeriod.value === 'month') {
			return {
				allStatistics: value.monthStatistics,
				v6Statistics: value.v6MonthStatistics,
			}
		}
		if (telemetryPeriod.value === 'year') {
			return {
				allStatistics: value.yearStatistics,
				v6Statistics: value.v6YearStatistics,
			}
		}
		return {
			allStatistics: value.allStatistics,
			v6Statistics: value.v6Statistics,
		}
	})
	const levelsQuery = useQuery({
		query: Zc_UserLevelsDocument,
		variables: computed(() => ({
			userId: userId.value ?? 0,
			steamId: steamId.value,
			since: levelWindows.value.yearSince,
		})),
		pause: computed(() => userId.value === undefined || !levelsPrefetch.active.value),
	})
	const recentLevels = computed<LevelSummary[]>(() =>
		(levelsQuery.data.value?.recentUser?.levelItems.nodes ?? []).flatMap(({ level }) =>
			level ? [mapUserLevel(level)] : [],
		),
	)
	const popularLevels = computed<LevelSummary[]>(() =>
		(levelsQuery.data.value?.popularLevels?.nodes ?? []).map((level) =>
			mapUserLevel(level, level.periodRecords.totalCount),
		),
	)

	const recentPagination = useCursorPagination(25, 'recent')
	const wrPagination = useCursorPagination(25, 'wr')
	const pbPagination = useCursorPagination(25, 'pb')
	const wrSort = ref<RecordHistorySort>('valuable-pbs')
	const pbSort = ref<RecordHistorySort>('valuable-pbs')
	const contributionOrderBy = (sort: RecordHistorySort): UserPointContributionsOrderBy[] =>
		sort === 'valuable-levels'
			? ['LEVEL_POINTS_DESC', 'RECORD_ID_DESC']
			: ['PLAYER_DECAYED_POINTS_DESC', 'RECORD_ID_DESC']

	const wrValuable = useQuery({
		query: Zc_UserContributionsDocument,
		variables: computed(() => ({
			...wrPagination.variables.value,
			filter: { userId: { equalTo: userId.value ?? 0 }, levelPosition: { equalTo: 1 } },
			orderBy: contributionOrderBy(wrSort.value),
		})),
		pause: computed(() => userId.value === undefined || wrSort.value === 'latest'),
	})
	const pbValuable = useQuery({
		query: Zc_UserContributionsDocument,
		variables: computed(() => ({
			...pbPagination.variables.value,
			filter: { userId: { equalTo: userId.value ?? 0 } },
			orderBy: contributionOrderBy(pbSort.value),
		})),
		pause: computed(
			() =>
				userId.value === undefined ||
				pbSort.value === 'latest' ||
				!personalBestsPrefetch.active.value,
		),
	})
	const wrRecent = useQuery({
		query: Zc_UserResultsDocument,
		variables: computed(() => ({
			...wrPagination.variables.value,
			filter: { userId: { equalTo: userId.value ?? 0 }, worldRecordGlobalsExist: true },
		})),
		pause: computed(() => userId.value === undefined || wrSort.value !== 'latest'),
	})
	const pbRecent = useQuery({
		query: Zc_UserResultsDocument,
		variables: computed(() => ({
			...pbPagination.variables.value,
			filter: {
				userId: { equalTo: userId.value ?? 0 },
				personalBestGlobalsExist: true,
			},
		})),
		pause: computed(
			() =>
				userId.value === undefined ||
				pbSort.value !== 'latest' ||
				!personalBestsPrefetch.active.value,
		),
	})
	const recent = useQuery({
		query: Zc_UserResultsDocument,
		variables: computed(() => ({
			...recentPagination.variables.value,
			filter: { userId: { equalTo: userId.value ?? 0 } },
		})),
		pause: computed(() => userId.value === undefined || !recentPrefetch.active.value),
	})

	const contributionRows = (source: typeof wrValuable) =>
		computed<RecordHistoryRow[]>(() =>
			(source.data.value?.userPointContributions?.edges ?? []).flatMap(({ node }) =>
				node.record && node.level
					? [
							{
								id: node.record.id,
								time: node.record.time,
								dateCreated: String(node.record.dateCreated),
								userId: node.record.userId,
								userSteamId: steamId.value,
								userName: user.value?.steamName,
								levelId: node.record.levelId,
								levelXxHash: node.level.xxHash,
								levelName:
									node.level.levelItems.nodes[0]?.name ?? node.level.xxHash,
								levelPosition: node.levelPosition,
								contributionRank: node.contributionRank,
								levelPoints: node.levelPoints,
								levelDecayedPoints: node.levelDecayedPoints,
								playerDecayedPoints: node.playerDecayedPoints,
								levelDecayMultiplier: calculateDecayMultiplier(
									node.levelPosition,
									LEVEL_DECAY_FACTOR,
								),
								globalDecayMultiplier: calculateDecayMultiplier(
									node.contributionRank,
									GLOBAL_DECAY_FACTOR,
								),
								pbOrWr: node.levelPosition === 1 ? 'world-record' : 'personal-best',
							},
						]
					: [],
			),
		)
	const resultRows = (source: typeof recent) =>
		computed<RecordHistoryRow[]>(() =>
			(source.data.value?.records?.edges ?? []).flatMap(({ node }) => {
				if (!node.level) return []
				const status = resolveRecordPbOrWr(node)
				const contribution = status ? node.userPointContributions.nodes[0] : undefined
				return [
					{
						id: node.id,
						time: node.time,
						dateCreated: String(node.dateCreated),
						userId: node.userId,
						userSteamId: steamId.value,
						userName: user.value?.steamName,
						levelId: node.levelId,
						levelXxHash: node.level.xxHash,
						levelName: node.level.levelItems.nodes[0]?.name ?? node.level.xxHash,
						levelPosition: contribution?.levelPosition,
						contributionRank: contribution?.contributionRank,
						levelPoints: contribution?.levelPoints ?? node.level.levelPoints?.points,
						levelDecayedPoints: contribution?.levelDecayedPoints,
						playerDecayedPoints: contribution?.playerDecayedPoints,
						levelDecayMultiplier:
							contribution?.levelPosition == null
								? undefined
								: calculateDecayMultiplier(
										contribution.levelPosition,
										LEVEL_DECAY_FACTOR,
									),
						globalDecayMultiplier:
							contribution?.contributionRank == null
								? undefined
								: calculateDecayMultiplier(
										contribution.contributionRank,
										GLOBAL_DECAY_FACTOR,
									),
						pbOrWr: status,
					},
				]
			}),
		)
	const wrValuableRows = contributionRows(wrValuable)
	const pbValuableRows = contributionRows(pbValuable)
	const wrRecentRows = resultRows(wrRecent)
	const pbRecentRows = resultRows(pbRecent)
	const recentRowsSource = resultRows(recent)
	const wrRowsSource = computed(() =>
		wrSort.value === 'latest' ? wrRecentRows.value : wrValuableRows.value,
	)
	const pbRowsSource = computed(() =>
		pbSort.value === 'latest' ? pbRecentRows.value : pbValuableRows.value,
	)
	const wrResult = computed(() => (wrSort.value === 'latest' ? wrRecent : wrValuable))
	const pbResult = computed(() => (pbSort.value === 'latest' ? pbRecent : pbValuable))
	const wrRowsResolved = useRecordRankFallback(wrRowsSource)
	const pbRowsResolved = useRecordRankFallback(pbRowsSource)
	const recentRowsResolved = useRecordRankFallback(recentRowsSource)
	function retainRows(rows: ComputedRef<RecordHistoryRow[]>, hasSnapshot: ComputedRef<boolean>) {
		const retained = shallowRef<RecordHistoryRow[]>([])
		watch(
			[rows, hasSnapshot],
			([nextRows, ready]) => {
				if (ready) retained.value = nextRows
			},
			{ immediate: true, flush: 'sync' },
		)
		return readonly(retained)
	}
	const wrRows = retainRows(
		wrRowsResolved,
		computed(() => wrResult.value.data.value !== undefined),
	)
	const pbRows = retainRows(
		pbRowsResolved,
		computed(() => pbResult.value.data.value !== undefined),
	)
	const recentRows = retainRows(
		recentRowsResolved,
		computed(() => recent.data.value !== undefined),
	)
	const wrPage = computed(() =>
		cursorPage(
			wrSort.value !== 'latest'
				? wrValuable.data.value?.userPointContributions?.pageInfo
				: wrRecent.data.value?.records?.pageInfo,
		),
	)
	const pbPage = computed(() =>
		cursorPage(
			pbSort.value !== 'latest'
				? pbValuable.data.value?.userPointContributions?.pageInfo
				: pbRecent.data.value?.records?.pageInfo,
		),
	)
	const recentPage = computed(() => cursorPage(recent.data.value?.records?.pageInfo))

	async function setWrSort(value: RecordHistorySort) {
		wrSort.value = value
		await wrPagination.reset()
	}
	async function setPbSort(value: RecordHistorySort) {
		pbSort.value = value
		await pbPagination.reset()
	}

	async function prefetchCritical() {
		await profile
		await nextTick()
		if (userId.value === undefined) return
		await Promise.all([
			pointsHistoryQuery.executeQuery(),
			superLeagueSeasonsQuery.executeQuery(),
			wrResult.value.executeQuery(),
		])
		await nextTick()
	}

	return {
		personalBestsActive: personalBestsPrefetch.active,
		personalBestsTarget: personalBestsPrefetch.target,
		pbPage,
		pbPagination,
		pbResult,
		pbRows,
		pbSort,
		pointsHistory,
		pointsHistoryQuery,
		secondaryPointsHistory,
		secondaryPointsHistoryQuery,
		secondaryPointsHistoryReady,
		selectedSuperLeagueSeasonId,
		superLeagueSeason,
		superLeagueSeasonQuery,
		superLeagueSeasons,
		superLeagueSeasonsQuery,
		prefetchCritical,
		profile,
		recent,
		recentActive: recentPrefetch.active,
		recentPage,
		recentPagination,
		recentRows,
		recentTarget: recentPrefetch.target,
		setPbSort,
		setWrSort,
		statistics,
		selectedStatistics,
		statisticsActive: statisticsPrefetch.active,
		statisticsTarget: statisticsPrefetch.target,
		telemetryPeriod,
		telemetryWindows,
		levelsActive: levelsPrefetch.active,
		levelsQuery,
		levelsTarget: levelsPrefetch.target,
		popularLevels,
		recentLevels,
		summary,
		user,
		wrPage,
		wrPagination,
		wrResult,
		wrRows,
		wrSort,
	}
}
