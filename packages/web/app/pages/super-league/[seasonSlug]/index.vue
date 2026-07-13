<template>
	<UContainer class="space-y-8 py-2">
		<DataState
			:pending="result.fetching.value"
			:error="result.error.value?.message"
			:empty="!result.fetching.value && !season"
			v-bind="stateLabels"
		>
			<template v-if="season">
				<PageHeader
					:eyebrow="$t('zsl.season')"
					:title="season.name"
					:description="$t('zsl.seasonDescription')"
				/>
				<section>
					<SectionHeader :title="$t('zsl.rounds')" :description="$t('zsl.roundsDescription')" />
					<ZslRoundGrid
						:rounds="season.zslRounds.nodes"
						:link="roundLink"
						:round-label="$t('zsl.roundNumber')"
					/>
				</section>
				<section>
					<SectionHeader :title="$t('zsl.standings')" :description="$t('zsl.seasonStandings')" />
					<DataState
						:pending="
							pagination.isInitialPending(
								standingsResult.fetching.value,
								standings.length,
							)
						"
						:error="standingsResult.error.value?.message"
						:empty="standings.length === 0"
						v-bind="stateLabels"
					>
						<ZslStandingsTable :standings="standings" :labels="tableLabels" />
					</DataState>
					<CursorPagination
						class="mt-4"
						:page="page"
						:can-go-previous="pagination.canGoPrevious(page)"
						:can-go-next="pagination.canGoNext(page)"
						:pending="standingsResult.fetching.value"
						v-bind="paginationLabels"
						@first="pagination.first()"
						@previous="pagination.previous(page)"
						@next="pagination.next(page)"
						@last="pagination.last()"
					/>
				</section>
			</template>
		</DataState>
	</UContainer>
</template>

<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const parsedSeasonId = parseSuperLeagueSlug(route.params.seasonSlug, 'season')
if (parsedSeasonId === null) {
	throw createError({ statusCode: 404, statusMessage: t('zsl.notFound') })
}
const id = computed(() => parsedSeasonId)
const {
	page,
	pagination,
	prefetch,
	result,
	season,
	standings,
	standingsResult,
} = useZslSeason(id)
await prefetch()
watchEffect(() => {
	if (result.fetching.value || result.data.value === undefined) return
	if (!season.value) {
		showError(createError({ statusCode: 404, statusMessage: t('zsl.notFound') }))
	}
})
const roundLink = (round: { round: number }) => superLeagueRoundPath(id.value, round.round)
useSeoMeta({
	title: () => season.value?.name,
	description: () => t('zsl.seasonDescription'),
})
const stateLabels = computed(() => ({
	loadingLabel: t('common.loading'),
	errorTitle: t('common.error'),
	emptyTitle: t('common.empty'),
}))
const tableLabels = computed(() => ({
	position: t('common.rank'),
	player: t('common.user'),
	time: t('common.time'),
	points: t('common.points'),
	unknown: t('zsl.unknown'),
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

