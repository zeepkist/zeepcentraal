<template>
	<OgFrame
		style="font-family: DINish"
		:eyebrow="$t('nav.cosmetics')"
		:title="$t('pages.cosmetics.title')"
		:description="$t('pages.cosmetics.description')"
	/>
</template>

<script setup vapor lang="ts">
defineProps<{ slug: string }>()
</script>
