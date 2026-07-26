<template>
	<UContainer>
		<DataState
			:pending="result.fetching.value"
			:error="result.error.value?.message"
			:empty="!result.fetching.value && !level"
			v-bind="stateLabels"
			class="space-y-8 py-2"
		>
			<template v-if="level">
				<ZslBreadcrumbs :label="$t('zsl.breadcrumbs')" :items="breadcrumbItems" />
				<ZslLevelHero
					:title="levelTitle"
					:context="levelContext"
					:image-src="level.level?.levelItems.nodes[0]?.imageUrl"
					:level-url="levelUrl"
					:workshop-url="workshopUrl"
					:competitor-count="competitorCount"
					:event-date="level.round?.eventDate"
					:labels="heroLabels"
				/>
				<section>
					<SectionHeader :title="$t('zsl.standings')" :description="$t('zsl.levelStandings')" />
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
						<ZslStandingsTable :standings="standings" :viewer-user-id="viewerId" show-time :labels="tableLabels" />
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
const parsedLevelId = parseSuperLeagueSlug(route.params.levelSlug, 'level')
if (parsedSeasonId === null || parsedRoundNumber === null || parsedLevelId === null) {
	throw createError({ statusCode: 404, statusMessage: t('zsl.notFound') })
}
const id = computed(() => parsedLevelId)
const {
	competitorCount,
	level,
	page,
	pagination,
	prefetch,
	result,
	standings,
	standingsResult,
} = useZslLevel(id, viewerId)
await prefetch()
watchEffect(() => {
	if (result.fetching.value || result.data.value === undefined) return
	const entry = level.value
	if (
		!entry ||
		entry.round?.seasonId !== parsedSeasonId ||
		entry.round.round !== parsedRoundNumber
	) {
		showError(createError({ statusCode: 404, statusMessage: t('zsl.notFound') }))
	}
})
const levelTitle = computed(
	() => level.value?.level?.levelItems.nodes[0]?.name ?? t('common.level'),
)
const levelUrl = computed(() =>
	level.value?.level ? `/level/${level.value.level.xxHash}` : undefined,
)
const workshopUrl = computed(() =>
	steamWorkshopItemUrl(level.value?.level?.levelItems.nodes[0]?.workshopId),
)
const levelContext = computed(() =>
	t('zsl.levelContext', {
		season: level.value?.round?.season?.name ?? t('zsl.season'),
		round: level.value?.round?.round ?? parsedRoundNumber,
	}),
)
const breadcrumbItems = computed(() => [
	{ label: t('zsl.seasons'), to: '/super-league' },
	{
		label: level.value?.round?.season?.name ?? t('zsl.season'),
		to: superLeagueSeasonPath(parsedSeasonId),
	},
	{
		label: level.value?.round?.name ?? t('zsl.roundNumber', { round: parsedRoundNumber }),
		to: superLeagueRoundPath(parsedSeasonId, parsedRoundNumber),
	},
	{ label: levelTitle.value },
])
useSeoMeta({
	title: () => level.value?.level?.levelItems.nodes[0]?.name,
	description: () => t('zsl.levelStandings'),
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
	levelsPlayed: t('zsl.levelsPlayed'),
	openPlayer: t('auth.profile'),
	unknown: t('zsl.unknown'),
	yourStanding: t('zsl.yourStanding'),
	emptyValue: t('common.unavailable'),
}))
const heroLabels = computed(() => ({
	eyebrow: t('zsl.levelResults'),
	openLevel: t('zsl.openLevel'),
	workshop: t('zsl.openWorkshop'),
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
