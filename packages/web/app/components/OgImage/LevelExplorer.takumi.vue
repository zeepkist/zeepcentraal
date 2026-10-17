<template>
	<OgFrame
		style="font-family: DINish"
		:eyebrow="t('pages.levels.eyebrow')"
		:title="t('pages.levels.title')"
		:description="t('pages.levels.description')"
	>
		<OgMetrics :items="metrics" />
	</OgFrame>
</template>

<script setup lang="ts">
defineProps<{ slug: string }>()

const { locale, t } = useAppI18n()
const number = getNumberFormatter(locale.value)
const count = await useOgLevelExplorerData()
const metrics = [{ label: t('common.levels'), value: number.format(count) }]
</script>
