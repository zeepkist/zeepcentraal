<template>
	<OgFrame
		style="font-family: DINish"
		:eyebrow="$t('nav.developer')"
		:title="$t('pages.developer.title')"
		:description="$t('pages.developer.description')"
	/>
</template>

<script setup vapor lang="ts">
defineProps<{ slug: string }>()
</script>
