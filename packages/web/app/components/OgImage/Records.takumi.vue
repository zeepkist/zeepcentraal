<template>
	<OgFrame
		style="font-family: DINish"
		:eyebrow="$t('pages.records.live.active')"
		:title="$t('pages.records.title')"
		:description="$t('pages.records.description')"
	>
		<OgMetrics :items="metrics" />
	</OgFrame>
</template>

<script setup vapor lang="ts">
defineProps<{ slug: string }>()

const { locale, t } = useI18n()
const number = getNumberFormatter(locale.value, 'compact-one-decimal')
const data = await useOgRecordCountsData()
const recentLabel = (label: string) =>
	`${label} · ${t('dashboard.metrics.past24Hours')}`
const metrics = [
	{
		label: recentLabel(t('pages.records.tabs.recent')),
		value: number.format(data?.recordsDay?.totalCount ?? 0),
	},
	{
		label: recentLabel(t('pages.records.tabs.personalBests')),
		value: number.format(data?.personalBestGlobalsDay?.totalCount ?? 0),
	},
	{
		label: recentLabel(t('pages.records.tabs.worldRecords')),
		value: number.format(data?.worldRecordGlobalsDay?.totalCount ?? 0),
	},
]
</script>
