Exit code: 0
Wall time: 0 seconds
Output:
<template>
	<UContainer class="py-2">
		<PageHeader :eyebrow="$t('pages.users.eyebrow')" :title="$t('pages.users.title')" :description="$t('pages.users.description')" />
		<div class="grid gap-6 lg:grid-cols-[18rem_1fr]">
			<aside class="h-fit lg:sticky lg:top-4">
				<UserFilterPanel :title="$t('users.filters.title')" :search="search" :sort="sort" :search-label="$t('users.filters.search')" :sort-label="$t('users.filters.sort')" :apply-label="$t('users.filters.apply')" :sort-options="sortOptions" @update:search="search = $event" @update:sort="sort = $event as UserPointsOrderBy" @apply="applyFilters" />
			</aside>
			<div class="min-w-0 space-y-6">
				<p class="text-sm text-muted-foreground">{{ $t('users.results', { count: result.data.value?.userPoints?.totalCount ?? 0 }) }}</p>
				<DataState :pending="result.fetching.value" :error="result.error.value?.message" :empty="users.length === 0" :loading-label="$t('common.loading')" :error-title="$t('common.error')" :empty-title="$t('common.empty')">
					<UserLeaderboardTable :users="users" :labels="tableLabels" />
				</DataState>
				<CursorPagination :page="page" :pending="result.fetching.value" v-bind="paginationLabels" @first="pagination.first()" @previous="pagination.previous(page)" @next="pagination.next(page)" @last="pagination.last()" />
			</div>
		</div>
	</UContainer>
</template>

<script setup lang="ts">
import { USER_SORTS } from '~/composables/usePlayers'
import type { UserPointsOrderBy } from '~/graphql/generated/graphql'

usePageSeo('users')
const { t } = useI18n()
const { applyFilters, page, pagination, result, search, sort, users } = usePlayers()
const sortOptions = computed(() => [
	{ label: t('users.sort.rank'), value: USER_SORTS.rank },
	{ label: t('users.sort.points'), value: USER_SORTS.points },
	{ label: t('users.sort.totalPoints'), value: USER_SORTS.totalPoints },
	{ label: t('users.sort.worldRecords'), value: USER_SORTS.worldRecords },
])
const tableLabels = computed(() => ({
	rank: t('common.rank'),
	player: t('common.user'),
	points: t('users.columns.rankedPoints'),
	totalPoints: t('users.columns.totalPoints'),
	worldRecords: t('users.columns.worldRecords'),
}))
const paginationLabels = computed(() => ({
	label: t('common.pagination'),
	firstLabel: t('common.first'),
	previousLabel: t('common.previous'),
	nextLabel: t('common.next'),
	lastLabel: t('common.last'),
}))
</script>
