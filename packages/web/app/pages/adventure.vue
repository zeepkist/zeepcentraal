<template>
	<UContainer class="space-y-8 py-2">
		<PageHeader :eyebrow="$t('pages.adventure.eyebrow')" :title="$t('pages.adventure.title')" :description="$t('pages.adventure.description')" />
		<DataState :pending="result.fetching.value" :error="result.error.value?.message" :empty="series.length === 0" :loading-label="$t('common.loading')" :error-title="$t('common.error')" :empty-title="$t('common.empty')">
			<AdventureSeries :series="series" :series-label="$t('adventure.series')" :count-label="$t('adventure.count')" :level-labels="levelLabels" />
		</DataState>
	</UContainer>
</template>
<script setup lang="ts">
usePageSeo('adventure')
const { t } = useI18n()
const { result, series } = useAdventure()
const levelLabels = computed(() => ({
	adventureLabel: t('common.adventure'),
	pointsLabel: t('common.points'),
	recordsLabel: t('common.records'),
	personalBestsLabel: t('levels.card.personalBests'),
	ratingLabel: t('levels.card.rating'),
	unavailableLabel: t('levels.card.unavailable'),
}))
</script>
