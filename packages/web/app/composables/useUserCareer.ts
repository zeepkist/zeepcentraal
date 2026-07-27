import { useQuery } from '@urql/vue'
import type { UserProfileSummaryModel } from '~/composables/useUserProfileSummary'
import {
	Zc_UserPointsHistoryDocument,
	Zc_UserPointsHistorySecondaryDocument,
	Zc_UserStatisticsDocument,
} from '~/graphql/generated/graphql'
import {
	buildUserCareerHistory,
	buildUserCareerSecondaryHistory,
	getUserCareerHistoryWindow,
} from '~/utils/userCareerHistory'
import { getUserTelemetryWindows, type UserTelemetryPeriod } from '~/utils/userTelemetry'

export function useUserCareer(steamId: Ref<string>, summaryData: UserProfileSummaryModel) {
	const careerPrefetch = useViewportPrefetch()
	const statisticsPrefetch = useViewportPrefetch()
	const careerSecondaryActive = ref(false)
	const { user } = summaryData
	const userId = computed(() => user.value?.id)
	const historyWindow = useState(`user-career-history-window:${steamId.value}`, () =>
		getUserCareerHistoryWindow(),
	)
	const telemetryWindows = useState(`user-telemetry-windows:${steamId.value}`, () =>
		getUserTelemetryWindows(),
	)
	const telemetryPeriod = ref<UserTelemetryPeriod>('all-time')

	const pointsHistoryQuery = useQuery({
		query: Zc_UserPointsHistoryDocument,
		variables: computed(() => ({
			userId: userId.value ?? 0,
			since: historyWindow.value.since,
		})),
		pause: computed(
			() => import.meta.server || userId.value === undefined || !careerPrefetch.active.value,
		),
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
			() =>
				import.meta.server ||
				userId.value === undefined ||
				!careerPrefetch.active.value ||
				!careerSecondaryActive.value,
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
	const statistics = useQuery({
		query: Zc_UserStatisticsDocument,
		variables: computed(() => ({
			userId: userId.value ?? 0,
			minimumModVersion: '1.2.0',
			daySince: telemetryWindows.value.daySince,
			monthSince: telemetryWindows.value.monthSince,
			yearSince: telemetryWindows.value.yearSince,
		})),
		pause: computed(
			() =>
				import.meta.server ||
				userId.value === undefined ||
				!careerPrefetch.active.value ||
				!statisticsPrefetch.active.value,
		),
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

	function activateCareerSecondary() {
		careerSecondaryActive.value = true
	}

	return {
		activateCareerSecondary,
		careerActive: careerPrefetch.active,
		careerSecondaryActive: readonly(careerSecondaryActive),
		careerTarget: careerPrefetch.target,
		pointsHistory,
		pointsHistoryQuery,
		secondaryPointsHistory,
		secondaryPointsHistoryQuery,
		secondaryPointsHistoryReady,
		selectedStatistics,
		statistics,
		statisticsActive: statisticsPrefetch.active,
		statisticsTarget: statisticsPrefetch.target,
		telemetryPeriod,
		telemetryWindows,
	}
}
