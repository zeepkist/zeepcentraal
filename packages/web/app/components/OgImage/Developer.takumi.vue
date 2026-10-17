<template>
	<OgFrame
		style="font-family: DINish"
		:eyebrow="t('nav.developer')"
		:title="t('pages.developer.title')"
		:description="t('pages.developer.description')"
	/>
</template>

<script setup lang="ts">
const { t } = useAppI18n()

defineProps<{ slug: string }>()
</script>
