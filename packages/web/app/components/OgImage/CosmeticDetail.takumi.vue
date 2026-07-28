<template>
	<OgFrame
		style="font-family: DINish"
		:eyebrow="$t('nav.cosmetics')"
		:title="$t('pages.cosmeticDetail.seo.title', { id: cosmeticSlug })"
		:description="$t('pages.cosmeticDetail.description', { id: cosmeticSlug })"
	>
		<OgMetrics :items="metrics" />
	</OgFrame>
</template>

<script setup vapor lang="ts">
const props = defineProps<{ slug: string }>()

const { t } = useI18n()
const cosmeticSlug = props.slug
const metrics = [{ label: t('nav.cosmetics'), value: `#${cosmeticSlug}` }]
</script>
