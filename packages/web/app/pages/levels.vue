<template>
	<ExplorerLayout>
		<template #header>
			<PageHeader :eyebrow="$t('pages.levels.eyebrow')" :title="$t('pages.levels.title')" :description="$t('pages.levels.description')" />
		</template>
		<template #sidebar>
			<LevelFilterPanel
				:title="$t('levels.filters.title')"
				:result-count-label="$t('levels.results', { count: result.data.value?.levels?.totalCount ?? 0 })"
				:search="search"
				:author="author"
				:author-suggestions="authorSuggestions"
				:author-suggestions-pending="authorSuggestionsPending"
				:adventure="adventure"
				:points="points"
				:rating="rating"
				:personal-best="personalBest"
				:world-record="worldRecord"
				:sort="sort"
				:search-label="$t('levels.filters.search')"
				:author-label="$t('levels.filters.author')"
				:adventure-label="$t('levels.filters.adventure')"
				:points-label="$t('levels.filters.points')"
				:rating-label="$t('levels.filters.rating')"
				:personal-best-label="$t('levels.filters.personalBest')"
				:world-record-label="$t('levels.filters.worldRecord')"
				:viewer-filters-disabled="!session.user"
				:viewer-filters-disabled-label="$t('levels.filters.viewerFilterHint')"
				:sort-label="$t('levels.filters.sort')"
				:apply-label="$t('levels.filters.apply')"
				:points-minimum="LEVEL_POINTS_MIN"
				:points-maximum="LEVEL_POINTS_MAX"
				:rating-minimum="LEVEL_RATING_MIN"
				:rating-maximum="LEVEL_RATING_MAX"
				:adventure-options="adventureOptions"
				:viewer-filter-options="viewerFilterOptions"
				:sort-options="sortOptions"
				@update:search="search = $event"
				@update:author="author = $event"
				@update:adventure="adventure = $event"
				@update:points="points = $event"
				@update:rating="rating = $event"
				@update:personal-best="personalBest = $event as ViewerLevelFilter"
				@update:world-record="worldRecord = $event as ViewerLevelFilter"
				@update:sort="sort = $event as LevelSort"
				@apply="applyFilters"
			/>
		</template>
		<div class="min-w-0 space-y-6">
			<DataState
				:pending="pagination.isInitialPending(result.fetching.value, levels.length)"
				:error="result.error.value?.message"
				:empty="levels.length === 0"
				:loading-label="$t('common.loading')"
				:error-title="$t('common.error')"
				:empty-title="$t('common.empty')"
			>
				<LevelGrid :levels="levels" :columns="4" v-bind="levelLabels" />
			</DataState>
			<CursorPagination
				:page="page"
				:can-go-previous="pagination.canGoPrevious(page)"
				:can-go-next="pagination.canGoNext(page)"
				:pending="result.fetching.value"
				:label="$t('common.pagination')"
				:loading-label="$t('common.loading')"
				:first-label="$t('common.first')"
				:previous-label="$t('common.previous')"
				:next-label="$t('common.next')"
				:last-label="$t('common.last')"
				@first="pagination.first()"
				@previous="pagination.previous(page)"
				@next="pagination.next(page)"
				@last="pagination.last()"
			/>
		</div>
	</ExplorerLayout>
</template>

<script setup lang="ts">
import { LEVEL_SORTS, type LevelSort } from '~/composables/useLevels'
import {
	LEVEL_POINTS_MAX,
	LEVEL_POINTS_MIN,
	LEVEL_RATING_MAX,
	LEVEL_RATING_MIN,
	type ViewerLevelFilter,
} from '~/utils/levelExplorer'

usePageSeo('levels')
const { t } = useI18n()
const session = useSessionStore()
const viewerId = computed(() => session.user?.id)
const explorer = useLevels(viewerId)
const {
	adventure,
	applyFilters,
	author,
	authorSuggestions,
	authorSuggestionsPending,
	levels,
	page,
	pagination,
	personalBest,
	points,
	rating,
	result,
	search,
	sort,
	worldRecord,
} = explorer
const adventureOptions = computed(() => [
	{ label: t('levels.filters.all'), value: 'all' },
	{ label: t('levels.filters.adventureOnly'), value: 'yes' },
	{ label: t('levels.filters.communityOnly'), value: 'no' },
])
const sortOptions = computed(() => [
	{ label: t('levels.sort.points'), value: LEVEL_SORTS.points },
	{ label: t('levels.sort.rating'), value: LEVEL_SORTS.rating },
	{ label: t('levels.sort.popular'), value: LEVEL_SORTS.popular },
	{ label: t('levels.sort.popularYear'), value: LEVEL_SORTS.hotYear },
	{ label: t('levels.sort.popularMonth'), value: LEVEL_SORTS.hotMonth },
	{ label: t('levels.sort.popularToday'), value: LEVEL_SORTS.hotToday },
	{ label: t('levels.sort.latest'), value: LEVEL_SORTS.latest },
	{ label: t('levels.sort.records'), value: LEVEL_SORTS.records },
	{ label: t('levels.sort.votes'), value: LEVEL_SORTS.votes },
	{ label: t('levels.sort.favourites'), value: LEVEL_SORTS.favourites },
])
const viewerFilterOptions = computed(() => [
	{ label: t('levels.filters.viewerAll'), value: 'all' },
	{ label: t('levels.filters.viewerYes'), value: 'yes' },
	{ label: t('levels.filters.viewerNo'), value: 'no' },
])
const levelLabels = computed(() => ({
	adventureLabel: t('common.adventure'),
	pointsLabel: t('common.points'),
	recordsLabel: t('common.records'),
	personalBestsLabel: t('levels.card.personalBests'),
	worldRecordLabel: t('levels.card.worldRecord'),
	authorTimeLabel: t('levels.card.authorTime'),
	byLabel: t('levels.card.by'),
	createdLabel: t('levels.card.created'),
}))
</script>
