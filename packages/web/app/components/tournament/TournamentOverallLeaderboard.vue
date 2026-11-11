<script setup lang="ts">
import type { TrackTournamentType } from '~/types/tournament'

const props = defineProps<{ type: TrackTournamentType }>()
const { locale, t } = useAppI18n()
const session = useSessionStore()
const viewerId = computed(() => session.user?.id)
const { standings, page, period, pagination, result, prefetch } = useTrackTournamentOverall(props.type, viewerId)
const { supporters } = useSupporterBadges()
const date = computed(() => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeZone: 'UTC' }))
const dateTime = computed(() => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }))
const periodLabel = computed(() => period.value?.periodStart && period.value.periodEnd
	? date.value.formatRange(new Date(String(period.value.periodStart)), new Date(String(period.value.periodEnd)))
	: t('common.unavailable'))
const updatedLabel = computed(() => period.value?.lastUpdatedAt
	? `${dateTime.value.format(new Date(String(period.value.lastUpdatedAt)))} UTC`
	: t('common.unavailable'))
const paginationLabels = computed(() => ({
	label: t('common.pagination'), loadingLabel: t('common.loading'),
	firstLabel: t('common.first'), previousLabel: t('common.previous'),
	nextLabel: t('common.next'), lastLabel: t('common.last'),
}))
useDiscordComponentEmbed(() => ({
	title: `Track of the ${props.type === 0 ? 'Week' : props.type === 2 ? 'Day' : 'Month'} | Overall standings`,
	description: period.value ? `${period.value.eligibleEventCount} eligible events | ${periodLabel.value} | Updated ${updatedLabel.value}` : undefined,
	rows: result.error.value ? undefined : result.data.value?.standings?.nodes.slice(0, 3).map(discordStandingRow),
	links: [{ label: 'Current event', url: props.type === 0 ? '/totw' : props.type === 2 ? '/totd' : '/totm' }],
}))
await prefetch()
</script>

<template>
	<div class="space-y-5">
		<div class="rounded-xl border border-border bg-card/70 p-4 sm:p-5">
			<dl class="grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
				<div class="min-w-0">
					<dt class="flex flex-wrap items-center gap-2 text-muted-foreground">
						<TablerIcon name="calendar" class="size-4 shrink-0" aria-hidden="true" />
						{{ t('tournaments.overall.period') }}
						<UBadge v-if="period" color="neutral" variant="soft" size="sm">{{ t('tournaments.overall.eventCount', { count: period.eligibleEventCount }) }}</UBadge>
					</dt>
					<dd class="mt-2 font-medium text-foreground">{{ periodLabel }}</dd>
				</div>
				<div class="min-w-0">
					<dt class="flex items-center gap-2 text-muted-foreground"><TablerIcon name="clock" class="size-4 shrink-0" aria-hidden="true" />{{ t('tournaments.overall.rotation') }}</dt>
					<dd class="mt-2 font-medium text-foreground">{{ t(type === 0 ? 'tournaments.overall.weeklySchedule' : type === 2 ? 'tournaments.overall.dailySchedule' : 'tournaments.overall.monthlySchedule') }}</dd>
				</div>
				<div class="min-w-0">
					<dt class="flex items-center gap-2 text-muted-foreground"><TablerIcon name="rotate-clockwise-2" class="size-4 shrink-0" aria-hidden="true" />{{ t('tournaments.overall.updated') }}</dt>
					<dd class="mt-2 font-medium text-foreground"><time v-if="period" :datetime="String(period.lastUpdatedAt)">{{ updatedLabel }}</time><template v-else>{{ updatedLabel }}</template></dd>
				</div>
			</dl>
			<p class="mt-4 border-t border-border/70 pt-3 text-sm text-muted-foreground">{{ t('tournaments.overall.updateNotice') }}</p>
		</div>
		<DataState :pending="pagination.isInitialPending(result.fetching.value, standings.length)" :error="result.error.value?.message" :empty="standings.length === 0" :loading-label="t('common.loading')" :error-title="t('common.error')" :empty-title="t('tournaments.overall.empty')">
			<TournamentOverallTable :standings="standings" :viewer-user-id="viewerId" :supporters="supporters" />
		</DataState>
		<CursorPagination :page="page" :can-go-previous="pagination.canGoPrevious(page)" :can-go-next="pagination.canGoNext(page)" :pending="result.fetching.value" v-bind="paginationLabels" @first="pagination.first()" @previous="pagination.previous(page)" @next="pagination.next(page)" @last="pagination.last()" />
	</div>
</template>
