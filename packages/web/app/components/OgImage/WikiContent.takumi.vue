<template>
	<OgFrame
		eyebrow="Wiki"
		:title="content.title"
		:description="content.description"
		style="font-family: DINish, sans-serif"
	>
		<OgBreadcrumbs :items="content.breadcrumbs" />
	</OgFrame>
</template>

<script setup lang="ts">
const props = defineProps<{
	slug: string
}>()

const content = await useOgWikiContentData(props.slug)
</script>
