<template>
	<OgFrame
		style="font-family: DINish"
		:eyebrow="$t('pages.adventure.eyebrow')"
		:title="title"
		:description="$t('pages.adventure.description')"
	>
		<OgMetrics :items="metrics" />
	</OgFrame>
</template>

<script setup vapor lang="ts">
const props = defineProps<{ slug: string }>()

const { locale, t } = useI18n()
const number = getNumberFormatter(locale.value)
const data = await useOgAdventureSeriesData(props.slug)
const title = data.series
	? t('adventure.series', { series: data.series.key })
	: t('pages.adventure.title')
const metrics = [
	{
		label: t('common.levels'),
		value: number.format(data.count),
	},
]
</script>
