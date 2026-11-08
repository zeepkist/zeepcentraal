<script setup lang="ts">
import type { TrackTournamentType } from '~/types/tournament'

const props = defineProps<{ type: TrackTournamentType }>()
const { locale, t } = useAppI18n()
const session = useSessionStore()
const viewerId = computed(() => session.user?.id)
const { standings, page, period, pagination, result, prefetch } = useTrackTournamentOverall(props.type, viewerId)
const { supporters } = useSupporterBadges()
const date = computed(() => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }))
const formatDate = (value: unknown) => date.value.format(new Date(String(value)))
const paginationLabels = computed(() => ({
	label: t('common.pagination'), loadingLabel: t('common.loading'),
	firstLabel: t('common.first'), previousLabel: t('common.previous'),
	nextLabel: t('common.next'), lastLabel: t('common.last'),
}))
await prefetch()
</script>

<template>
	<div class="space-y-5">
		<div class="space-y-2 text-sm text-muted">
			<p>{{ t(type === 0 ? 'tournaments.overall.weeklyWindow' : 'tournaments.overall.monthlyWindow') }}</p>
			<p>{{ t(type === 0 ? 'tournaments.overall.weeklySchedule' : 'tournaments.overall.monthlySchedule') }}</p>
			<p>{{ t('tournaments.overall.frozen') }}</p>
			<template v-if="period">
				<p>{{ t('tournaments.overall.eventCount', { count: period.eligibleEventCount }) }}</p>
				<p v-if="period.periodStart && period.periodEnd">{{ formatDate(period.periodStart) }} – {{ formatDate(period.periodEnd) }} UTC</p>
				<p>{{ t('tournaments.overall.updated', { date: formatDate(period.lastUpdatedAt) }) }} UTC</p>
			</template>
		</div>
		<DataState :pending="pagination.isInitialPending(result.fetching.value, standings.length)" :error="result.error.value?.message" :empty="standings.length === 0" :loading-label="t('common.loading')" :error-title="t('common.error')" :empty-title="t('tournaments.overall.empty')">
			<TournamentOverallTable :standings="standings" :viewer-user-id="viewerId" :supporters="supporters" />
		</DataState>
		<CursorPagination :page="page" :can-go-previous="pagination.canGoPrevious(page)" :can-go-next="pagination.canGoNext(page)" :pending="result.fetching.value" v-bind="paginationLabels" @first="pagination.first()" @previous="pagination.previous(page)" @next="pagination.next(page)" @last="pagination.last()" />
	</div>
</template>
