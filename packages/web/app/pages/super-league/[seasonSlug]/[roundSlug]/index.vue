<template>
	<UContainer>
		<DataState
			:pending="result.fetching.value"
			:error="result.error.value?.message"
			:empty="!result.fetching.value && !round"
			v-bind="stateLabels"
			class="space-y-8 py-2"
		>
			<template v-if="round">
				<ZslBreadcrumbs :label="$t('zsl.breadcrumbs')" :items="breadcrumbItems" />
				<PageHeader
					:eyebrow="$t('zsl.roundNumber', { round: round.round })"
					:title="round.name"
					:description="$t('zsl.roundDescription')"
				>
					<template #actions>
						<ZslPageFacts
							class="w-full sm:w-auto sm:min-w-[18rem]"
							:competitor-count="competitorCount"
							:event-date="round.eventDate"
							:labels="factLabels"
							stacked
						/>
					</template>
				</PageHeader>
				<section>
					<SectionHeader :title="$t('zsl.levels')" :description="$t('zsl.levelsDescription')" />
					<ZslLevelGrid
						:levels="round.zslLevels.nodes"
						:link="levelLink"
						:level-label="$t('common.level')"
						:results-label="$t('zsl.viewResults')"
					/>
				</section>
				<section>
					<SectionHeader :title="$t('zsl.standings')" :description="$t('zsl.roundStandings')" />
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
						<ZslStandingsTable
							:standings="standings"
							:viewer-user-id="viewerId"
							show-levels-played
							:labels="tableLabels"
						/>
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

<script setup vapor lang="ts">
const route = useRoute()
const { t } = useI18n()
const session = useSessionStore()
const viewerId = computed(() => session.user?.id)
const parsedSeasonId = parseSuperLeagueSlug(route.params.seasonSlug, 'season')
const parsedRoundNumber = parseSuperLeagueSlug(route.params.roundSlug, 'round')
if (parsedSeasonId === null || parsedRoundNumber === null) {
	throw createError({ statusCode: 404, statusMessage: t('zsl.notFound') })
}
defineOgImage('SuperLeagueRound.takumi', {
	slug: `season-${parsedSeasonId}/round-${parsedRoundNumber}`,
})
const seasonId = computed(() => parsedSeasonId)
const roundNumber = computed(() => parsedRoundNumber)
const {
	competitorCount,
	page,
	pagination,
	prefetch,
	result,
	round,
	standings,
	standingsResult,
} = useZslRound(seasonId, roundNumber, viewerId)
await prefetch()
watchEffect(() => {
	if (result.fetching.value || result.data.value === undefined) return
	if (!round.value) {
		showError(createError({ statusCode: 404, statusMessage: t('zsl.notFound') }))
	}
})
const levelLink = (levelId: number) =>
	superLeagueLevelPath(seasonId.value, roundNumber.value, levelId)
const breadcrumbItems = computed(() => [
	{ label: t('zsl.seasons'), to: '/super-league' },
	{
		label: round.value?.season?.name ?? t('zsl.season'),
		to: superLeagueSeasonPath(seasonId.value),
	},
	{ label: round.value?.name ?? t('zsl.roundNumber', { round: roundNumber.value }) },
])
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
	delta: t('common.delta'),
	points: t('common.points'),
	levelsPlayed: t('zsl.levelsPlayed'),
	openPlayer: t('auth.profile'),
	unknown: t('zsl.unknown'),
	yourStanding: t('zsl.yourStanding'),
	emptyValue: t('common.unavailable'),
}))
const factLabels = computed(() => ({
	competitors: t('zsl.competitors'),
	playedOn: t('zsl.playedOn'),
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
