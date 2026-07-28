<template>
	<OgFrame
		style="font-family: DINish"
		:eyebrow="status"
		:title="recordTime"
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
const date = getDateTimeFormatter(locale.value, 'medium-london')
const record = await useOgRecordDetailData(props.slug)
const publicLevel = record?.level?.publiclyVisible === true
const item = publicLevel ? record.level?.levelItems.nodes[0] : undefined
const levelName = getLevelDisplayName(item?.name, record?.level?.xxHash ?? '')
const playerName = record?.user?.steamName ?? t('common.unknownPlayer')
const status =
	record?.worldRecordGlobals.totalCount
		? t('common.worldRecord')
		: record?.personalBestGlobals.totalCount
			? t('common.personalBest')
			: t('common.records')
const recordTime =
	record?.time == null ? t('pages.recordDetail.notFound') : formatTournamentTime(record.time)
const description = record ? `${playerName} · ${levelName}` : t('pages.recordDetail.seo.description')
const imageUrl = item?.imageUrl
const contribution = record?.userPointContributions.nodes[0]
const createdAt = record?.dateCreated == null ? null : new Date(String(record.dateCreated))
const metrics = [
	{ label: t('common.user'), value: playerName },
	{ label: t('common.level'), value: levelName },
	{
		label: t('common.levelRank'),
		value:
			contribution?.levelPosition == null
				? t('common.unavailable')
				: `#${number.format(contribution.levelPosition)}`,
	},
	{
		label: t('common.rankedPoints'),
		value:
			contribution?.playerDecayedPoints == null
				? t('common.unavailable')
				: number.format(contribution.playerDecayedPoints),
	},
	{
		label: t('common.set'),
		value:
			createdAt && !Number.isNaN(createdAt.getTime())
				? date.format(createdAt)
				: t('common.unavailable'),
	},
]
</script>
