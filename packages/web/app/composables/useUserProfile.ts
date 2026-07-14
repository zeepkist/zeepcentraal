import { useQuery } from '@urql/vue'
import {
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
import type { CursorPage, LevelSummary, RecordRow, UserProfileSummary } from '~/types/app'
import { getLevelHotWindows } from '~/utils/levelExplorer'
import { resolveRecordPbOrWr } from '~/utils/levelRecordRows'
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
	const selectedSuperLeagueSeasonId = ref<number>()
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
		{ immediate: true },
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
	const wrSort = ref<'valuable' | 'recent'>('valuable')
	const pbSort = ref<'valuable' | 'recent'>('valuable')

	const wrValuable = useQuery({
		query: Zc_UserContributionsDocument,
		variables: computed(() => ({
			...wrPagination.variables.value,
			filter: { userId: { equalTo: userId.value ?? 0 }, levelPosition: { equalTo: 1 } },
		})),
		pause: computed(() => userId.value === undefined || wrSort.value !== 'valuable'),
	})
	const pbValuable = useQuery({
		query: Zc_UserContributionsDocument,
		variables: computed(() => ({
			...pbPagination.variables.value,
			filter: { userId: { equalTo: userId.value ?? 0 } },
		})),
		pause: computed(
			() =>
				userId.value === undefined ||
				pbSort.value !== 'valuable' ||
				!personalBestsPrefetch.active.value,
		),
	})
	const wrRecent = useQuery({
		query: Zc_UserResultsDocument,
		variables: computed(() => ({
			...wrPagination.variables.value,
			filter: { userId: { equalTo: userId.value ?? 0 }, worldRecordGlobalsExist: true },
		})),
		pause: computed(() => userId.value === undefined || wrSort.value !== 'recent'),
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
				pbSort.value !== 'recent' ||
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
		computed<RecordRow[]>(() =>
			(source.data.value?.userPointContributions?.edges ?? []).flatMap(({ node }) =>
				node.record && node.level
					? [
							{
								id: node.record.id,
								time: node.record.time,
								dateCreated: String(node.record.dateCreated),
								userId: node.record.userId,
								levelId: node.record.levelId,
								levelXxHash: node.level.xxHash,
								levelName:
									node.level.levelItems.nodes[0]?.name ?? node.level.xxHash,
								rank: node.levelPosition,
								points: node.playerDecayedPoints,
								pbOrWr: node.levelPosition === 1 ? 'world-record' : 'personal-best',
								rankedPoints: node.playerDecayedPoints,
								nonDecayedPoints: node.levelDecayedPoints,
							},
						]
					: [],
			),
		)
	const resultRows = (source: typeof recent) =>
		computed<RecordRow[]>(() =>
			(source.data.value?.records?.edges ?? []).flatMap(({ node }) =>
				node.level
					? [
							{
								id: node.id,
								time: node.time,
								dateCreated: String(node.dateCreated),
								userId: node.userId,
								levelId: node.levelId,
								levelXxHash: node.level.xxHash,
								levelName:
									node.level.levelItems.nodes[0]?.name ?? node.level.xxHash,
								rank: node.userPointContributions.nodes[0]?.levelPosition,
								points: node.userPointContributions.nodes[0]?.playerDecayedPoints,
								pbOrWr: resolveRecordPbOrWr(node),
								rankedPoints:
									node.userPointContributions.nodes[0]?.playerDecayedPoints,
								nonDecayedPoints:
									node.userPointContributions.nodes[0]?.levelDecayedPoints,
							},
						]
					: [],
			),
		)
	const wrValuableRows = contributionRows(wrValuable)
	const pbValuableRows = contributionRows(pbValuable)
	const wrRecentRows = resultRows(wrRecent)
	const pbRecentRows = resultRows(pbRecent)
	const recentRowsSource = resultRows(recent)
	const wrRowsSource = computed(() =>
		wrSort.value === 'valuable' ? wrValuableRows.value : wrRecentRows.value,
	)
	const pbRowsSource = computed(() =>
		pbSort.value === 'valuable' ? pbValuableRows.value : pbRecentRows.value,
	)
	const wrResult = computed(() => (wrSort.value === 'valuable' ? wrValuable : wrRecent))
	const pbResult = computed(() => (pbSort.value === 'valuable' ? pbValuable : pbRecent))
	function retainRows(rows: ComputedRef<RecordRow[]>, hasSnapshot: ComputedRef<boolean>) {
		const retained = shallowRef<RecordRow[]>([])
		watch(
			[rows, hasSnapshot],
			([nextRows, ready]) => {
				if (ready) retained.value = nextRows
			},
			{ immediate: true },
		)
		return readonly(retained)
	}
	const wrRows = retainRows(
		wrRowsSource,
		computed(() => wrResult.value.data.value !== undefined),
	)
	const pbRows = retainRows(
		pbRowsSource,
		computed(() => pbResult.value.data.value !== undefined),
	)
	const recentRows = retainRows(
		recentRowsSource,
		computed(() => recent.data.value !== undefined),
	)
	const wrPage = computed(() =>
		cursorPage(
			wrSort.value === 'valuable'
				? wrValuable.data.value?.userPointContributions?.pageInfo
				: wrRecent.data.value?.records?.pageInfo,
		),
	)
	const pbPage = computed(() =>
		cursorPage(
			pbSort.value === 'valuable'
				? pbValuable.data.value?.userPointContributions?.pageInfo
				: pbRecent.data.value?.records?.pageInfo,
		),
	)
	const recentPage = computed(() => cursorPage(recent.data.value?.records?.pageInfo))

	async function setWrSort(value: 'valuable' | 'recent') {
		wrSort.value = value
		await wrPagination.reset()
	}
	async function setPbSort(value: 'valuable' | 'recent') {
		pbSort.value = value
		await pbPagination.reset()
	}

	async function prefetchCritical() {
		await profile
		await nextTick()
		if (userId.value === undefined) return
		await Promise.all([pointsHistoryQuery, superLeagueSeasonsQuery, wrResult.value])
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
