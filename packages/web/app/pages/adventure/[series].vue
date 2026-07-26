<template>
	<section
		id="adventure-series-panel"
		role="tabpanel"
		:aria-labelledby="`adventure-series-${series.slug}`"
	>
		<SectionHeader
			:id="`adventure-series-${series.slug}-heading`"
			:title="$t('adventure.series', { series: series.key })"
			:description="$t('adventure.count', { count: formattedCount })"
		/>
		<DataState
			:pending="adventure.selectedPending.value"
			:error="adventure.selectedError.value?.message"
			:empty="adventure.levels.value.length === 0"
			:loading-label="$t('common.loading')"
			:error-title="$t('common.error')"
			:empty-title="$t('common.empty')"
		>
			<LevelGrid :levels="adventure.levels.value" :columns="4" v-bind="levelLabels" />
		</DataState>
	</section>
</template>

<script setup lang="ts">
import { findAdventureSeries } from '~/utils/adventureSeries'

const route = useRoute()
const { t, locale } = useI18n()
const adventure = useAdventureContext()
const initialSeries = findAdventureSeries(route.params.series)

if (!initialSeries) {
	throw createError({ statusCode: 404, statusMessage: t('adventure.notFound') })
}

const series = computed(() => findAdventureSeries(route.params.series) ?? initialSeries)
watch(
	() => route.params.series,
	(value) => {
		if (!findAdventureSeries(value)) {
			showError(createError({ statusCode: 404, statusMessage: t('adventure.notFound') }))
		}
	},
)

const count = computed(
	() => adventure.seriesCounts.value[series.value.slug] ?? adventure.levels.value.length,
)
const number = computed(() => new Intl.NumberFormat(locale.value))
const formattedCount = computed(() => number.value.format(count.value))
const levelLabels = computed(() => ({
	adventureLabel: t('common.adventure'),
	pointsLabel: t('common.points'),
	recordsLabel: t('common.records'),
	personalBestsLabel: t('levels.card.personalBests'),
	ratingLabel: t('levels.card.rating'),
	unavailableLabel: t('levels.card.unavailable'),
	worldRecordLabel: t('levels.card.worldRecord'),
	authorTimeLabel: t('levels.card.authorTime'),
	byLabel: t('levels.card.by'),
}))
</script>
