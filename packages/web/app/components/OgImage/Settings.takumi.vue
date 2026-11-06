<template>
	<OgFrame
		style="font-family: DINish, sans-serif"
		:eyebrow="t('pages.settings.eyebrow')"
		:title="t('pages.settings.title')"
		:description="t('pages.settings.description')"
	/>
</template>

<script setup lang="ts">
const { t } = useAppI18n()

defineProps<{ slug: string }>()
</script>
