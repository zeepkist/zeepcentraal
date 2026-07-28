<template>
	<OgFrame
		style="font-family: DINish"
		:eyebrow="$t('pages.users.eyebrow')"
		:title="$t('pages.users.title')"
		:description="$t('pages.users.description')"
	>
		<OgPodium :players="players" />
	</OgFrame>
</template>

<script setup vapor lang="ts">
defineProps<{ slug: string }>()

const { locale, t } = useI18n()
const number = getNumberFormatter(locale.value)
const rows = await useOgUserRankingsData()
const players = rows.flatMap(({ node }) =>
	node.user
		? [
				{
					name: node.user.steamName ?? String(node.user.steamId),
					points: number.format(node.points),
					rank: node.rank,
				},
			]
		: [],
)
</script>
