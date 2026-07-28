<template>
	<OgFrame
		style="font-family: DINish"
		:eyebrow="$t('common.level')"
		:title="levelName"
		:description="description"
		:image-url="imageUrl"
	>
		<OgMetrics :items="metrics" />
	</OgFrame>
</template>

<script setup vapor lang="ts">
import { getLevelDisplayName } from '~/utils/levelDisplay'
import { formatTournamentTime } from '~/utils/tournament'

const props = defineProps<{ slug: string }>()

const { locale, t } = useI18n()
const number = getNumberFormatter(locale.value)
const level = await useOgLevelDetailData(props.slug)
const item = level?.publiclyVisible ? level.levelItems.nodes[0] : undefined
const worldRecord = level?.publiclyVisible ? level.worldRecordGlobal : null
const levelName = getLevelDisplayName(item?.name, level?.xxHash ?? props.slug)
const authorName = item?.author?.steamName ?? t('common.unknownAuthor')
const description = level?.publiclyVisible
	? `${t('levels.card.by')} ${authorName}`
	: t('common.notAvailable')
const imageUrl = item?.imageUrl
const metrics = [
	{
		label: t('common.levelPoints'),
		value:
			level?.levelPoints?.points == null
				? t('common.unavailable')
				: number.format(level.levelPoints.points),
	},
	{
		label: t('dashboard.metrics.personalBests'),
		value: number.format(level?.personalBestGlobals.totalCount ?? 0),
	},
	{ label: t('common.records'), value: number.format(level?.records.totalCount ?? 0) },
	{
		label: t('levels.detail.worldRecord.title'),
		value: worldRecord?.record?.time == null
			? t('common.unavailable')
			: formatTournamentTime(worldRecord.record.time),
	},
	{
		label: t('common.user'),
		value: worldRecord?.user?.steamName ?? t('common.unknownPlayer'),
	},
]
</script>
