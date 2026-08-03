<template>
	<UContainer class="space-y-8 py-2">
		<PageHeader
			:eyebrow="$t('pages.adventure.eyebrow')"
			:title="$t('pages.adventure.title')"
			:description="$t('pages.adventure.description')"
		/>
		<AdventureSeriesTabs
			:series="seriesTabs"
			:active-slug="seriesSlug"
			:label="$t('adventure.tabsLabel')"
			:unavailable-label="$t('levels.card.unavailable')"
		/>
		<UAlert
			v-if="adventure.countsQuery.error.value"
			color="error"
			variant="soft"
			:title="$t('common.error')"
			:description="$t('adventure.countsError')"
		/>
		<NuxtPage />
	</UContainer>
</template>

<script setup vapor lang="ts">
usePageSeo('adventure')

const route = useRoute()
const { t } = useI18n()
const seriesSlug = computed(() =>
	'series' in route.params && typeof route.params.series === 'string'
		? route.params.series
		: undefined,
)
const adventure = useAdventure(seriesSlug)
const seriesTabs = computed(() =>
	adventure.tabs.value.map((series) => ({
		...series,
		label: t('adventure.series', { series: series.key }),
	})),
)
provideAdventureContext(adventure)
await adventure.prefetch()
</script>
