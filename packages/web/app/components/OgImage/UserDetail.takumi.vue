<template>
	<OgFrame
		style="font-family: DINish"
		:eyebrow="$t('users.profile.eyebrow')"
		:title="user?.steamName ?? profileSlug"
		:description="$t('users.profile.seoDescription', { name: user?.steamName ?? profileSlug })"
	>
		<OgMetrics :items="metrics" />
	</OgFrame>
</template>

<script setup vapor lang="ts">
const props = defineProps<{ slug: string }>()

const { locale, t } = useI18n()
const number = getNumberFormatter(locale.value)
const user = await useOgUserDetailData(props.slug)
const profileSlug = props.slug
const metrics = [
	{
		label: t('users.profile.globalRank'),
		value:
			user?.userPoints?.rank == null || user.userPoints.rank < 0
				? t('users.profile.unranked')
				: `#${number.format(user.userPoints.rank)}`,
	},
	{
		label: t('users.columns.rankedPoints'),
		value: number.format(user?.userPoints?.points ?? 0),
	},
	{
		label: t('users.columns.worldRecords'),
		value: number.format(user?.worldRecordGlobals.totalCount ?? 0),
	},
	{
		label: t('dashboard.metrics.personalBests'),
		value: number.format(user?.personalBestGlobals.totalCount ?? 0),
	},
	{ label: t('common.records'), value: number.format(user?.records.totalCount ?? 0) },
	{ label: t('common.levels'), value: number.format(user?.levelItems.totalCount ?? 0) },
]
</script>
