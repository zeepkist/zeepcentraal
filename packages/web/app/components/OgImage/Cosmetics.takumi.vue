<template>
	<OgFrame
		style="font-family: DINish"
		:eyebrow="t('nav.cosmetics')"
		:title="t('pages.cosmetics.title')"
		:description="t('pages.cosmetics.description')"
	/>
</template>

<script setup lang="ts">
const { t } = useAppI18n()

defineProps<{ slug: string }>()
</script>
