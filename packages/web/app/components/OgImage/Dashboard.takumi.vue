<template>
	<OgFrame
		style="font-family: DINish"
		:eyebrow="$t('nav.home')"
		:title="$t('pages.home.seo.title')"
		:description="$t('dashboard.liveStats.description')"
	>
		<OgMetrics :items="metrics" />
	</OgFrame>
</template>

<script setup vapor lang="ts">
defineProps<{ slug: string }>()

const { locale, t } = useI18n()
const number = getNumberFormatter(locale.value, 'compact-one-decimal')
const oneDecimal = getNumberFormatter(locale.value, 'one-decimal')
const data = await useOgDashboardData()
const critical = data.critical
const distance = Number(data.statistics?.allTimeStatistics?.aggregates?.sum?.distance ?? 0)
const metrics = [
	{
		label: t('dashboard.totals.distance.total'),
		value: `${oneDecimal.format(distance / 1000)} ${t('dashboard.totals.units.kilometres')}`,
	},
	{ label: t('dashboard.metrics.levels'), value: number.format(critical?.levels?.totalCount ?? 0) },
	{
		label: t('dashboard.metrics.rankedAndTotalPlayers'),
		value: `${number.format(critical?.rankedUsers?.totalCount ?? 0)} / ${number.format(
			critical?.totalUsers?.totalCount ?? 0,
		)}`,
	},
	{ label: t('dashboard.metrics.records'), value: number.format(critical?.records?.totalCount ?? 0) },
	{
		label: t('dashboard.metrics.worldRecords'),
		value: number.format(critical?.worldRecordGlobals?.totalCount ?? 0),
	},
	{
		label: t('dashboard.metrics.personalBests'),
		value: number.format(critical?.personalBestGlobals?.totalCount ?? 0),
	},
]
</script>
