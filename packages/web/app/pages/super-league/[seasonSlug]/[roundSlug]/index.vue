Exit code: 0
Wall time: 0 seconds
Output:
<template>
	<UContainer class="space-y-8 py-2">
		<DataState
			:pending="result.fetching.value"
			:error="result.error.value?.message"
			:empty="!result.fetching.value && !round"
			v-bind="stateLabels"
		>
			<template v-if="round">
				<PageHeader
					:eyebrow="$t('zsl.roundNumber', { round: round.round })"
					:title="round.name"
					:description="$t('zsl.roundDescription')"
				/>
				<section>
					<SectionHeader :title="$t('zsl.levels')" :description="$t('zsl.levelsDescription')" />
					<ZslLevelGrid
						:levels="round.zslLevels.nodes"
						:link="levelLink"
						:level-label="$t('common.level')"
					/>
				</section>
				<section :ref="standingsTarget">
					<SectionHeader :title="$t('zsl.standings')" :description="$t('zsl.roundStandings')" />
					<DataState
						:pending="!standingsActive.value || standingsResult.fetching.value"
						:error="standingsResult.error.value?.message"
						:empty="standings.length === 0"
						v-bind="stateLabels"
					>
						<ZslStandingsTable :standings="standings" :labels="tableLabels" />
					</DataState>
					<CursorPagination
						class="mt-4"
						:page="page"
						:pending="!standingsActive.value || standingsResult.fetching.value"
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
const parsedRoundNumber = parseSuperLeagueSlug(route.params.roundSlug, 'round')
if (parsedSeasonId === null || parsedRoundNumber === null) {
	throw createError({ statusCode: 404, statusMessage: t('zsl.notFound') })
}
const seasonId = computed(() => parsedSeasonId)
const roundNumber = computed(() => parsedRoundNumber)
const {
	page,
	pagination,
	result,
	round,
	standings,
	standingsActive,
	standingsResult,
	standingsTarget,
} = useZslRound(seasonId, roundNumber)
watchEffect(() => {
	if (result.fetching.value || result.data.value === undefined) return
	if (!round.value) {
		showError(createError({ statusCode: 404, statusMessage: t('zsl.notFound') }))
	}
})
const levelLink = (levelId: number) =>
	superLeagueLevelPath(seasonId.value, roundNumber.value, levelId)
useSeoMeta({
	title: () => round.value?.name,
	description: () => t('zsl.roundDescription'),
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
	firstLabel: t('common.first'),
	previousLabel: t('common.previous'),
	nextLabel: t('common.next'),
	lastLabel: t('common.last'),
}))
</script>
