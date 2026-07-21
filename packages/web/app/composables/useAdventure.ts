import { useQuery } from '@urql/vue'
import type { InjectionKey, Ref } from 'vue'
import {
	type Zc_AdventureLevelCardFragment,
	Zc_AdventureSeriesCountsDocument,
	Zc_AdventureSeriesDocument,
} from '~/graphql/generated/graphql'
import type { LevelSummary } from '~/types/app'
import {
	ADVENTURE_SERIES,
	type AdventureSeriesSlug,
	findAdventureSeries,
	sortAdventureLevels,
} from '~/utils/adventureSeries'
import { getLevelDisplayName } from '~/utils/levelDisplay'

function mapLevel(level: Zc_AdventureLevelCardFragment): LevelSummary {
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
		recordCount: level.records.totalCount,
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

export function useAdventure(seriesSlug: Ref<string | undefined>) {
	const selectedSeries = computed(() => findAdventureSeries(seriesSlug.value))
	const cache = shallowReactive(new Map<AdventureSeriesSlug, LevelSummary[]>())
	const queryPaused = computed(() => {
		const series = selectedSeries.value
		return series === undefined || cache.has(series.slug)
	})
	const countsQuery = useQuery({
		query: Zc_AdventureSeriesCountsDocument,
		variables: {},
		pause: computed(() => selectedSeries.value === undefined),
		requestPolicy: 'cache-first',
	})
	const seriesQuery = useQuery({
		query: Zc_AdventureSeriesDocument,
		variables: computed(() => ({ prefix: selectedSeries.value?.prefix ?? '' })),
		pause: queryPaused,
		requestPolicy: 'cache-first',
	})

	function cacheResolvedSeries() {
		if (seriesQuery.fetching.value || seriesQuery.error.value) return
		const levelsConnection = seriesQuery.data.value?.levels
		if (!levelsConnection) return
		const prefix = seriesQuery.operation.value?.variables.prefix
		const series = ADVENTURE_SERIES.find((entry) => entry.prefix === prefix)
		if (!series) return
		const levels = levelsConnection.nodes.map(mapLevel)
		cache.set(series.slug, sortAdventureLevels(levels, series))
	}

	watch(
		[seriesQuery.data, seriesQuery.fetching, seriesQuery.error, seriesQuery.operation],
		cacheResolvedSeries,
		{ immediate: true },
	)

	const seriesCounts = computed(() => {
		const data = countsQuery.data.value
		return Object.fromEntries(
			ADVENTURE_SERIES.map((series) => [series.slug, data?.[series.countField]?.totalCount]),
		) as Record<AdventureSeriesSlug, number | undefined>
	})
	const tabs = computed(() =>
		ADVENTURE_SERIES.map((series) => ({ ...series, count: seriesCounts.value[series.slug] })),
	)
	const levels = computed(() => {
		const series = selectedSeries.value
		return series ? (cache.get(series.slug) ?? []) : []
	})
	const selectedPending = computed(() => {
		const series = selectedSeries.value
		const operationMatches = seriesQuery.operation.value?.variables.prefix === series?.prefix
		return Boolean(
			series &&
				!cache.has(series.slug) &&
				(!operationMatches ||
					seriesQuery.fetching.value ||
					seriesQuery.data.value === undefined),
		)
	})
	const selectedError = computed(() => {
		const series = selectedSeries.value
		if (!series || cache.has(series.slug)) return undefined
		return seriesQuery.operation.value?.variables.prefix === series.prefix
			? seriesQuery.error.value
			: undefined
	})

	async function prefetch() {
		if (!import.meta.server || !selectedSeries.value) return
		await Promise.all([countsQuery, seriesQuery])
		cacheResolvedSeries()
	}

	return {
		countsQuery,
		levels,
		prefetch,
		selectedError,
		selectedPending,
		selectedSeries,
		seriesCounts,
		seriesQuery,
		tabs,
	}
}

export type AdventureContext = ReturnType<typeof useAdventure>

const adventureContextKey: InjectionKey<AdventureContext> = Symbol('adventure-context')

export function provideAdventureContext(context: AdventureContext) {
	provide(adventureContextKey, context)
}

export function useAdventureContext() {
	const context = inject(adventureContextKey)
	if (!context) throw new Error('Adventure context is unavailable')
	return context
}
