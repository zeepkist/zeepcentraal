<template>
	<UContainer class="space-y-8 py-2">
		<PageHeader
			:eyebrow="t('pages.zsl.eyebrow')"
			:title="t('pages.zsl.title')"
			:description="t('pages.zsl.description')"
		/>
		<ContestLinks />
		<DataState
			:pending="pagination.isInitialPending(result.fetching.value, seasons.length)"
			:error="result.error.value?.message"
			:empty="seasons.length === 0"
			v-bind="stateLabels"
		>
			<ZslSeasonGrid
				:seasons="seasons"
				:rounds-label="roundsLabel"
				:competitors-label="competitorsLabel"
				transition-scope="zsl-seasons"
			/>
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
	</UContainer>
</template>
<script setup lang="ts">
usePageSeo('zsl')
defineOgImage('SuperLeague.takumi', { slug: 'super-league' })
const { t } = useAppI18n()
const { page, pagination, result, seasons } = useZslSeasons()
useDiscordComponentEmbed(() => ({
	title: t('pages.zsl.seo.title'),
	rows: result.error.value ? undefined : seasons.value.slice(0, 3).map((season) => ({
		name: season.name,
		url: superLeagueSeasonPath(season.id),
		value: `${season.zslSeasonResults.totalCount} competitors`,
	})),
	links: [{ label: 'Vote', url: '/super-league/vote' }, { label: 'Submit level', url: '/super-league/submit-level' }],
}))
onServerPrefetch(async () => { await result })
const roundsLabel = (count: number) => t('zsl.roundCount', { count })
const competitorsLabel = (count: number) => t('zsl.competitorCount', { count })
const stateLabels = computed(() => ({
	loadingLabel: t('common.loading'),
	errorTitle: t('common.error'),
	emptyTitle: t('common.empty'),
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
