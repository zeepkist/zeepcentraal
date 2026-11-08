<script setup lang="ts">
const props = defineProps<{ series?: string }>()
const { t } = useAppI18n()
const session = useSessionStore()
const viewerId = computed(() => session.user?.id)
const { scope, entries, page, pagination, result, live, prefetch } = useAdventureLeaderboard(computed(() => props.series), viewerId)
const paginationLabels = computed(() => ({
	label: t('common.pagination'), loadingLabel: t('common.loading'),
	firstLabel: t('common.first'), previousLabel: t('common.previous'),
	nextLabel: t('common.next'), lastLabel: t('common.last'),
}))
await prefetch()
</script>

<template>
	<section class="space-y-5" :aria-label="t('adventure.leaderboard.title')">
		<SectionHeader :title="t('adventure.leaderboard.title')" :description="t('adventure.leaderboard.rules')" />
		<AdventurePlayerProgress v-if="viewerId && scope" :leaderboard="scope" />
		<p v-if="scope" class="text-sm text-muted">{{ t('adventure.leaderboard.participants', { count: scope.totalPlayers ?? 0 }) }}</p>
		<DataState :pending="pagination.isInitialPending(result.fetching.value, entries.length)" :error="result.error.value?.message" :empty="entries.length === 0" :loading-label="t('common.loading')" :error-title="t('common.error')" :empty-title="t('adventure.leaderboard.empty')">
			<AdventureLeaderboardTable :entries="entries" :viewer-id="viewerId" />
		</DataState>
		<UAlert v-if="live.error.value" color="warning" variant="soft" :title="t('adventure.leaderboard.liveError')" />
		<CursorPagination :page="page" :can-go-previous="pagination.canGoPrevious(page)" :can-go-next="pagination.canGoNext(page)" :pending="result.fetching.value" v-bind="paginationLabels" @first="pagination.first()" @previous="pagination.previous(page)" @next="pagination.next(page)" @last="pagination.last()" />
	</section>
</template>
