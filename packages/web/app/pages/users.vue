<template>
	<ExplorerLayout>
		<template #header>
			<PageHeader :eyebrow="$t('pages.users.eyebrow')" :title="$t('pages.users.title')" :description="$t('pages.users.description')" />
		</template>
		<template #sidebar>
			<UserFilterPanel
				:title="$t('users.filters.title')"
				:result-count-label="$t('users.results', { count: result.data.value?.userPoints?.totalCount ?? 0 })"
				:search="search"
				:sort="sort"
				:search-label="$t('users.filters.search')"
				:sort-label="$t('users.filters.sort')"
				:apply-label="$t('users.filters.apply')"
				:sort-options="sortOptions"
				@update:search="search = $event"
				@update:sort="sort = $event as UserPointsOrderBy"
				@apply="applyFilters"
			/>
		</template>
		<div class="min-w-0 space-y-6">
			<DataState :pending="pagination.isInitialPending(result.fetching.value, users.length)" :error="result.error.value?.message" :empty="users.length === 0" :loading-label="$t('common.loading')" :error-title="$t('common.error')" :empty-title="$t('common.empty')">
				<UserLeaderboardTable
					:users="users"
					:viewer-user-id="session.user?.id"
					:labels="tableLabels"
					transition-scope="users-ranking"
				/>
			</DataState>
			<CursorPagination :page="page" :can-go-previous="pagination.canGoPrevious(page)" :can-go-next="pagination.canGoNext(page)" :pending="result.fetching.value" v-bind="paginationLabels" @first="pagination.first()" @previous="pagination.previous(page)" @next="pagination.next(page)" @last="pagination.last()" />
		</div>
	</ExplorerLayout>
</template>

<script setup vapor lang="ts">
import type { UserPointsOrderBy } from '@zeepkist/graphql/generated'
import { USER_SORTS } from '~/composables/usePlayers'

usePageSeo('users')
defineOgImage('UserRankings.takumi', { slug: 'users' })
const { t } = useI18n()
const session = useSessionStore()
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
	openPlayer: t('auth.profile'),
}))
const paginationLabels = computed(() => ({
	label: t('common.pagination'),
	loadingLabel: t('common.loading'),
	firstLabel: t('common.first'),
	previousLabel: t('common.previous'),
	nextLabel: t('common.next'),
	lastLabel: t('common.last'),
}))
</script>
