<template>
	<UContainer class="py-2">
		<PageHeader :eyebrow="$t('pages.levels.eyebrow')" :title="$t('pages.levels.title')" :description="$t('pages.levels.description')" />
		<div class="grid gap-6 lg:grid-cols-[18rem_1fr]">
			<aside class="h-fit lg:sticky lg:top-4">
				<LevelFilterPanel
					:title="$t('levels.filters.title')"
					:search="search"
					:author="author"
					:adventure="adventure"
					:sort="sort"
					:search-label="$t('levels.filters.search')"
					:author-label="$t('levels.filters.author')"
					:adventure-label="$t('levels.filters.adventure')"
					:sort-label="$t('levels.filters.sort')"
					:apply-label="$t('levels.filters.apply')"
					:adventure-options="adventureOptions"
					:sort-options="sortOptions"
					@update:search="search = $event"
					@update:author="author = $event"
					@update:adventure="adventure = $event"
					@update:sort="sort = $event as LevelsOrderBy"
					@apply="applyFilters"
				/>
			</aside>
			<div class="min-w-0 space-y-6">
				<div class="flex items-center justify-between gap-3">
					<p class="text-sm text-muted-foreground">{{ $t('levels.results', { count: result.data.value?.levels?.totalCount ?? 0 }) }}</p>
				</div>
				<DataState
					:pending="result.fetching.value"
					:error="result.error.value?.message"
					:empty="levels.length === 0"
					:loading-label="$t('common.loading')"
					:error-title="$t('common.error')"
					:empty-title="$t('common.empty')"
				>
					<LevelGrid :levels="levels" v-bind="levelLabels" />
				</DataState>
				<CursorPagination
					:page="page"
					:can-go-previous="pagination.canGoPrevious(page)"
					:can-go-next="pagination.canGoNext(page)"
					:pending="result.fetching.value"
					:label="$t('common.pagination')"
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
		</div>
	</UContainer>
</template>

<script setup lang="ts">
import { LEVEL_SORTS } from '~/composables/useLevels'
import type { LevelsOrderBy } from '~/graphql/generated/graphql'

usePageSeo('levels')
const { t } = useI18n()
const explorer = useLevels()
const { adventure, applyFilters, author, levels, page, pagination, result, search, sort } = explorer
const adventureOptions = computed(() => [
	{ label: t('levels.filters.all'), value: 'all' },
	{ label: t('levels.filters.adventureOnly'), value: 'yes' },
	{ label: t('levels.filters.communityOnly'), value: 'no' },
])
const sortOptions = computed(() => [
	{ label: t('levels.sort.latest'), value: LEVEL_SORTS.latest },
	{ label: t('levels.sort.popular'), value: LEVEL_SORTS.popular },
	{ label: t('levels.sort.points'), value: LEVEL_SORTS.points },
	{ label: t('levels.sort.rating'), value: LEVEL_SORTS.rating },
	{ label: t('levels.sort.records'), value: LEVEL_SORTS.records },
	{ label: t('levels.sort.votes'), value: LEVEL_SORTS.votes },
	{ label: t('levels.sort.favourites'), value: LEVEL_SORTS.favourites },
])
const levelLabels = computed(() => ({
	adventureLabel: t('common.adventure'),
	pointsLabel: t('common.points'),
	recordsLabel: t('common.records'),
}))
</script>
