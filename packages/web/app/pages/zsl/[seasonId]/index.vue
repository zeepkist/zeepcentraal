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
				<section :ref="standingsTarget">
					<SectionHeader :title="$t('zsl.standings')" :description="$t('zsl.seasonStandings')" />
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
						@previous="pagination.previous(page)"
						@next="pagination.next(page)"
					/>
				</section>
			</template>
		</DataState>
	</UContainer>
</template>

<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const id = computed(() => Number(route.params.seasonId))
const {
	page,
	pagination,
	result,
	season,
	standings,
	standingsActive,
	standingsResult,
	standingsTarget,
} = useZslSeason(id)
const roundLink = (roundId: number) => `/zsl/${id.value}/${roundId}`
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
	previousLabel: t('common.previous'),
	nextLabel: t('common.next'),
}))
</script>
