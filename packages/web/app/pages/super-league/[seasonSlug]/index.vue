<template>
	<UContainer>
		<DataState
			:pending="result.fetching.value"
			:error="result.error.value?.message"
			:empty="!result.fetching.value && !season"
			v-bind="stateLabels"
			class="space-y-8 py-2"
		>
			<template #pending>
				<SharedDetailPreview
					v-if="transitionPreview"
					entity="zsl-season"
					:entity-id="parsedSeasonId"
					:preview="transitionPreview"
					compact
				/>
				<div v-else class="space-y-3">
					<USkeleton v-for="index in 3" :key="index" class="h-24 rounded-xl" />
				</div>
			</template>
			<template v-if="season">
				<ZslBreadcrumbs :label="$t('zsl.breadcrumbs')" :items="breadcrumbItems" />
				<PageHeader
					:eyebrow="$t('zsl.season')"
					:title="season.name"
					:description="$t('zsl.seasonDescription')"
					:title-transition-style="transition.targetStyle('zsl-season', parsedSeasonId, 'title')"
				>
					<template #actions>
						<ZslPageFacts
							class="w-full sm:w-auto sm:min-w-[18rem]"
							:competitor-count="competitorCount"
							:labels="factLabels"
							stacked
						/>
					</template>
				</PageHeader>
				<section>
					<SectionHeader :title="$t('zsl.rounds')" :description="$t('zsl.roundsDescription')" />
					<ZslRoundGrid
						:rounds="season.zslRounds.nodes"
						:link="roundLink"
						:season-id="parsedSeasonId"
						:transition-scope="`zsl-rounds-${parsedSeasonId}`"
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
						<ZslStandingsTable
							:standings="standings"
							:viewer-user-id="viewerId"
							:round-labels="roundLabels"
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
if (parsedSeasonId === null) {
	throw createError({ statusCode: 404, statusMessage: t('zsl.notFound') })
}
defineOgImage('SuperLeagueSeason.takumi', { slug: `season-${parsedSeasonId}` })
const id = computed(() => parsedSeasonId)
const transition = useSharedViewTransition()
const transitionPreview = computed(() => transition.preview('zsl-season', parsedSeasonId))
const {
	competitorCount,
	page,
	pagination,
	prefetch,
	result,
	season,
	standings,
	standingsResult,
} = useZslSeason(id, viewerId)
await prefetch()
watchEffect(() => {
	if (result.fetching.value || result.data.value === undefined) return
	if (!season.value) {
		showError(createError({ statusCode: 404, statusMessage: t('zsl.notFound') }))
	}
})
const roundLink = (round: { round: number }) => superLeagueRoundPath(id.value, round.round)
const breadcrumbItems = computed(() => [
	{ label: t('zsl.seasons'), to: '/super-league' },
	{ label: season.value?.name ?? t('zsl.season') },
])
const roundLabels = computed(() =>
	Array.from({ length: 6 }, (_, index) => t('zsl.roundShort', { round: index + 1 })),
)
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
