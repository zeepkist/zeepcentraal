<template>
	<UContainer class="space-y-8 py-2">
		<DataState
			:pending="result.fetching.value"
			:error="result.error.value?.message"
			:empty="!result.fetching.value && !level"
			v-bind="stateLabels"
		>
			<template v-if="level">
				<section class="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-center">
					<div>
						<p class="text-sm font-semibold uppercase tracking-widest text-primary">
							{{ $t('zsl.levelResults') }}
						</p>
						<h1 class="mt-2 text-4xl font-black">
							{{ level.level?.levelItems.nodes[0]?.name ?? $t('common.level') }}
						</h1>
						<NuxtLink
							v-if="level.level"
							:to="`/level/${level.level.xxHash}`"
							class="mt-3 inline-block text-primary"
						>
							{{ $t('zsl.openLevel') }}
						</NuxtLink>
					</div>
					<NuxtImg
						v-if="level.level?.levelItems.nodes[0]?.imageUrl"
						:src="level.level.levelItems.nodes[0].imageUrl"
						:alt="level.level.levelItems.nodes[0]?.name ?? $t('common.level')"
						class="aspect-video w-full rounded-2xl object-cover"
					/>
				</section>
				<section :ref="standingsTarget">
					<SectionHeader :title="$t('zsl.standings')" :description="$t('zsl.levelStandings')" />
					<DataState
						:pending="!standingsActive.value || standingsResult.fetching.value"
						:error="standingsResult.error.value?.message"
						:empty="standings.length === 0"
						v-bind="stateLabels"
					>
						<ZslStandingsTable :standings="standings" show-time :labels="tableLabels" />
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
const parsedSeasonId = parseSuperLeagueSlug(route.params.seasonSlug, 'season')
const parsedRoundNumber = parseSuperLeagueSlug(route.params.roundSlug, 'round')
const parsedLevelId = parseSuperLeagueSlug(route.params.levelSlug, 'level')
if (parsedSeasonId === null || parsedRoundNumber === null || parsedLevelId === null) {
	throw createError({ statusCode: 404, statusMessage: t('zsl.notFound') })
}
const id = computed(() => parsedLevelId)
const {
	level,
	page,
	pagination,
	result,
	standings,
	standingsActive,
	standingsResult,
	standingsTarget,
} = useZslLevel(id)
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
	unknown: t('zsl.unknown'),
}))
const paginationLabels = computed(() => ({
	label: t('common.pagination'),
	previousLabel: t('common.previous'),
	nextLabel: t('common.next'),
}))
</script>
