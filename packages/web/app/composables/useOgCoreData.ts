import { useQuery } from '@urql/vue'
import {
	Zc_AdventureSeriesCountsDocument,
	Zc_DashboardStatisticsDocument,
	Zc_LevelDetailDocument,
	Zc_LevelsDocument,
	Zc_UserProfileDocument,
	Zc_UsersDocument,
} from '@zeepkist/graphql/generated'
import { findAdventureSeries } from '~/utils/adventureSeries'
import { getDashboardMetricWindows } from '~/utils/dashboardMetrics'

export async function useOgDashboardData() {
	const windows = getDashboardMetricWindows()
	const metrics = useGlobalMetrics()
	const statisticsQuery = useQuery({
		query: Zc_DashboardStatisticsDocument,
		variables: {
			...windows,
		},
	})

	await Promise.all([metrics, statisticsQuery])
	if (!metrics.data.value)
		throw createError({ statusCode: 503, statusMessage: 'Global metrics unavailable' })

	return {
		critical: metrics.data.value,
		statistics: statisticsQuery.data.value,
	}
}

export async function useOgRecordCountsData() {
	const metrics = useGlobalMetrics()
	await metrics
	if (!metrics.data.value)
		throw createError({ statusCode: 503, statusMessage: 'Global metrics unavailable' })
	return metrics.data.value
}

export async function useOgUserRankingsData() {
	const query = useQuery({
		query: Zc_UsersDocument,
		variables: {
			first: 3,
			filter: {
				rank: { notEqualTo: -1 },
				user: { banned: { equalTo: false } },
			},
			orderBy: ['RANK_ASC' as const],
		},
	})

	await query
	return query.data.value?.userPoints?.edges ?? []
}

export async function useOgUserDetailData(slug: string) {
	const query = useQuery({
		query: Zc_UserProfileDocument,
		variables: { steamId: slug },
	})

	await query
	return query.data.value?.users?.nodes[0] ?? null
}

export async function useOgLevelExplorerData() {
	const query = useQuery({
		query: Zc_LevelsDocument,
		variables: {
			first: 0,
			filter: { publiclyVisible: { equalTo: true } },
			viewerId: 0,
			includeViewer: false,
		},
	})

	await query
	return query.data.value?.levels?.totalCount ?? 0
}

export async function useOgLevelDetailData(slug: string) {
	const query = useQuery({
		query: Zc_LevelDetailDocument,
		variables: {
			xxHash: slug,
			now: new Date().toISOString(),
			viewerId: 0,
			includeViewer: false,
		},
	})

	await query
	return query.data.value?.levelByXxHash ?? null
}

export async function useOgAdventureSeriesData(slug: string) {
	const series = findAdventureSeries(slug)
	const query = useQuery({
		query: Zc_AdventureSeriesCountsDocument,
		variables: {},
		pause: series === undefined,
	})

	if (series) await query

	return {
		series,
		count: series ? (query.data.value?.[series.countField]?.totalCount ?? 0) : 0,
	}
}
