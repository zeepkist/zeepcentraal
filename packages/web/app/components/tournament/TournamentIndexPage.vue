<template>
	<UContainer class="space-y-12 py-2">
		<TournamentEvent v-if="active" :type="type" :slug="active.slug" :title="title" />
		<TournamentCountdown v-else :title="title" :start-at="countdownStart" />
		<TournamentPlaylistActions
			v-if="!active && history.length > 0"
			:type="type"
			:format-name="title"
		/>

		<section class="space-y-5">
			<SectionHeader
				:title="$t('tournaments.history')"
				:description="$t('tournaments.historyDescription')"
			/>
			<DataState
				:pending="pagination.isInitialPending(result.fetching.value, history.length)"
				:error="result.error.value?.message"
				:empty="history.length === 0"
				:loading-label="$t('common.loading')"
				:error-title="$t('common.error')"
				:empty-title="$t('tournaments.noHistory')"
			>
				<div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
					<TournamentCard
						v-for="tournament in history"
						:key="tournament.id"
						:tournament="tournament"
						:transition-scope="`tournament-history-${type}`"
					/>
				</div>
			</DataState>
			<CursorPagination
				:page="page"
				:can-go-previous="pagination.canGoPrevious(page)"
				:can-go-next="pagination.canGoNext(page)"
				:pending="result.fetching.value"
				v-bind="paginationLabels"
				@first="pagination.first()"
				@previous="pagination.previous(page)"
				@next="pagination.next(page)"
				@last="pagination.last()"
			/>
		</section>
	</UContainer>
</template>

<script setup vapor lang="ts">
import type { TrackTournamentType } from '~/types/tournament'
import { nextTournamentBoundary } from '~/utils/tournament'

const props = defineProps<{ type: TrackTournamentType; title: string }>()
const { t } = useI18n()
const { active, future, history, page, pagination, prefetch, result } =
	useTrackTournamentIndex(props.type)
await prefetch()
const countdownStart = computed(
	() => future.value?.startAt ?? nextTournamentBoundary(props.type, new Date()).toISOString(),
)
const paginationLabels = computed(() => ({
	label: t('common.pagination'),
	loadingLabel: t('common.loading'),
	firstLabel: t('common.first'),
	previousLabel: t('common.previous'),
	nextLabel: t('common.next'),
	lastLabel: t('common.last'),
}))

useSeoMeta({
	title: () => props.title,
	description: () => t('tournaments.seoDescription', { title: props.title }),
	robots: 'index, follow',
})
</script>
